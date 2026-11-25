import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowUp,
  Award,
  BatteryCharging,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Droplets,
  Hand,
  Heart,
  Pause,
  Phone,
  PhoneOff,
  Play,
  Radio,
  RotateCcw,
  Save,
  Utensils,
  Volume2,
  VolumeX,
  Waves,
  Zap,
} from 'lucide-react';
import { sound } from './game/audio';
import {
  CALL_1_LINES,
  CALL_2_LINES,
  CONTEXTUAL_DIALOGUES,
  ContextualCategory,
  INTRO_SCENES,
  LEVELS,
  PhoneDialogueLine,
} from './game/levels';
import { CharacterPortraits, loadCharacterPortraits } from './game/portraits';
import { renderEndingScene, renderGameWorld, renderIntroScene, renderPhoneCallScene } from './game/renderer';
import { clearSaveData, loadSaveData, writeSaveData } from './game/storage';
import { voice, VoiceSpeaker } from './game/voice';
import {
  FloatingText,
  GameScreen,
  HudSnapshot,
  InputState,
  Inventory,
  LevelConfig,
  MissionStep,
  Particle,
  PlayerState,
  SaveData,
  VoiceEmotion,
  WorldObject,
} from './game/types';

const GRAVITY = 1400;
const WATER_GRAVITY = 350;
const WALK_SPEED = 285;
const RUN_SPEED = 355;
const SWIM_SPEED = 215;
const JUMP_VEL = -715;
const DOUBLE_JUMP_VEL = -600;
const CLIMB_SPEED = 235;

function cloneObjects(level: LevelConfig): WorldObject[] {
  return level.objects.map((o) => ({ ...o }));
}

function initMissions(level: LevelConfig): MissionStep[] {
  return level.missions.map((m) => ({ ...m, current: 0 }));
}

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [screen, setScreen] = useState<GameScreen>('MENU');
  const [muted, setMuted] = useState(false);
  const [portraits, setPortraits] = useState<CharacterPortraits>({
    razonPortraitUrl: '',
    raselPortraitUrl: '',
    razonSheet: null,
    raselSheet: null,
  });
  const [saveData, setSaveData] = useState<SaveData | null>(() => loadSaveData());
  const [showLevelSelect, setShowLevelSelect] = useState(false);

  // Intro state
  const introRef = useRef({ sceneIdx: 0, sceneTime: 0, postVoiceWait: 0, totalTime: 0 });
  const [introSceneIdx, setIntroSceneIdx] = useState(0);

  // Satellite Phone Call state (Call 1 after Beach Level 1, Call 2 on Level 2 High Branch)
  const phoneCallRef = useRef<{
    callKind: 'call1' | 'call2';
    phase: 'no_signal' | 'connecting' | 'talking' | 'disconnected';
    lineIdx: number;
    phaseTime: number;
    postVoiceWait: number;
    battery: number;
    time: number;
    vibrateTick: number;
    staticTick: number;
    pendingCarry?: Partial<SaveData>;
  }>({
    callKind: 'call1',
    phase: 'no_signal',
    lineIdx: 0,
    phaseTime: 0,
    postVoiceWait: 0,
    battery: 42,
    time: 0,
    vibrateTick: 0,
    staticTick: 0,
  });
  const [phoneCallUi, setPhoneCallUi] = useState<{
    callKind: 'call1' | 'call2';
    phase: 'no_signal' | 'connecting' | 'talking' | 'disconnected';
    lineIdx: number;
    signalBars: 0 | 1 | 2 | 3;
    battery: number;
  }>({
    callKind: 'call1',
    phase: 'no_signal',
    lineIdx: 0,
    signalBars: 0,
    battery: 42,
  });

  // Ending state
  const endingRef = useRef<{
    elapsed: number;
    stageTime: number;
    postVoiceWait: number;
    totalTime: number;
    rotorTick: number;
    stage: 'approaching' | 'dialogue' | 'departing' | 'complete';
  }>({ elapsed: 0, stageTime: 0, postVoiceWait: 0, totalTime: 0, rotorTick: 0, stage: 'approaching' });
  const [endingStage, setEndingStage] = useState<'approaching' | 'dialogue' | 'departing' | 'complete'>('approaching');

  // Active gameplay mutable state (all Y coordinates stored relative to groundY: 0 = ground, negative = up)
  const gameRef = useRef<{
    levelIdx: number;
    player: PlayerState;
    inventory: Inventory;
    objects: WorldObject[];
    fallingCoconuts: Array<{ id: string; x: number; y: number; vy: number }>;
    dropTimer: number;
    dropSeq: number;
    dropThroughTimer: number;
    missions: MissionStep[];
    particles: Particle[];
    floatingTexts: FloatingText[];
    cameraX: number;
    time: number;
    levelCleared: boolean;
    clearTimer: number;
    clearPostVoice: number;
    nearObjectId: string | null;
    score: number;
    nextTextId: number;
    unlockedLevel: number;
    satelliteLost: boolean;
    satelliteConnected: boolean;
    phoneBattery: number;
  }>({
    levelIdx: 0,
    player: {
      x: 125,
      y: 0,
      vx: 0,
      vy: 0,
      width: 30,
      height: 62,
      facing: 1,
      pose: 'idle',
      animTime: 0,
      onGround: true,
      inWater: false,
      onClimbable: false,
      crouching: false,
      coyoteTimer: 0.16,
      jumpBufferTimer: 0,
      jumpsRemaining: 2,
      interactingTimer: 0,
      invulnTimer: 0,
      health: 100,
      hunger: 92,
      thirst: 90,
      stamina: 100,
    },
    inventory: { coconuts: 1, water: 1, wood: 0, fronds: 0, flareKit: false },
    objects: cloneObjects(LEVELS[0]),
    fallingCoconuts: [],
    dropTimer: 4,
    dropSeq: 1,
    dropThroughTimer: 0,
    missions: initMissions(LEVELS[0]),
    particles: [],
    floatingTexts: [],
    cameraX: 0,
    time: 0,
    levelCleared: false,
    clearTimer: 0,
    clearPostVoice: 0,
    nearObjectId: null,
    score: 0,
    nextTextId: 1,
    unlockedLevel: 1,
    satelliteLost: false,
    satelliteConnected: false,
    phoneBattery: 42,
  });

  const inputRef = useRef<InputState>({
    left: false,
    right: false,
    run: false,
    crouch: false,
    upHold: false,
    jumpPressed: false,
    swimPressed: false,
    interactPressed: false,
  });

  const [hud, setHud] = useState<HudSnapshot>({
    levelId: 1,
    levelTitleBn: LEVELS[0].titleBn,
    health: 100,
    hunger: 92,
    thirst: 90,
    stamina: 100,
    inventory: { coconuts: 1, water: 1, wood: 0, fronds: 0, flareKit: false },
    missions: initMissions(LEVELS[0]),
    nearPromptBn: null,
    inWater: false,
    onClimbable: false,
    satelliteLost: false,
    satelliteConnected: false,
    phoneBattery: 42,
    subtitle: null,
    levelCleared: false,
    score: 0,
  });

  useEffect(() => {
    loadCharacterPortraits().then(setPortraits);
  }, []);

  const syncHud = useCallback(() => {
    const g = gameRef.current;
    const lvl = LEVELS[g.levelIdx];
    const nearObj = g.objects.find((o) => o.id === g.nearObjectId);
    setHud({
      levelId: lvl.id,
      levelTitleBn: lvl.titleBn,
      health: Math.round(g.player.health),
      hunger: Math.round(g.player.hunger),
      thirst: Math.round(g.player.thirst),
      stamina: Math.round(g.player.stamina),
      inventory: { ...g.inventory },
      missions: g.missions.map((m) => ({ ...m })),
      nearPromptBn: nearObj ? nearObj.labelBn : g.fallingCoconuts.length > 0 ? 'পড়ন্ত ডাব ধরো' : null,
      inWater: g.player.inWater,
      onClimbable: g.player.onClimbable,
      satelliteLost: g.satelliteLost,
      satelliteConnected: g.satelliteConnected,
      phoneBattery: Math.round(g.phoneBattery),
      subtitle: null,
      levelCleared: g.levelCleared,
      score: g.score,
    });
  }, []);

  const usedContextIdsRef = useRef<Set<string>>(new Set());
  const lastContextAtRef = useRef<number>(0);
  const nextAmbientVoiceAtRef = useRef<number>(18);
  const hungerWarnedRef = useRef<boolean>(false);
  const thirstWarnedRef = useRef<boolean>(false);

  const speakBg = useCallback(
    (speaker: VoiceSpeaker, textBn: string, emotion: VoiceEmotion = 'normal') => {
      voice.speak(textBn, speaker, { emotion });
    },
    []
  );

  const speakContextual = useCallback(
    (category: ContextualCategory, minCooldownSec = 14) => {
      const nowSec = performance.now() / 1000;
      if (voice.isSpeaking() || sound.isMuted()) return;
      if (nowSec - lastContextAtRef.current < minCooldownSec) return;

      const pool = CONTEXTUAL_DIALOGUES[category];
      if (!pool || pool.length === 0) return;

      let available = pool.filter((item) => !usedContextIdsRef.current.has(item.id));
      if (available.length === 0) {
        for (const item of pool) usedContextIdsRef.current.delete(item.id);
        available = pool;
      }

      const pick = available[Math.floor(Math.random() * available.length)];
      if (!pick) return;

      usedContextIdsRef.current.add(pick.id);
      lastContextAtRef.current = nowSec;
      voice.speak(pick.textBn, 'razon', { emotion: pick.emotion });
    },
    []
  );

  const speakPhoneLine = useCallback(
    (line: PhoneDialogueLine, upcoming?: PhoneDialogueLine[]) => {
      if (line.disconnectBefore) {
        sound.playCallDisconnect();
      } else if (line.interference) {
        sound.playSignalStatic(0.32, 0.045);
      }
      voice.speak(line.textBn, line.speaker, {
        emotion: line.emotion,
        phoneFilter: line.speaker === 'rasel',
        interference: line.interference,
      });
      if (upcoming) {
        for (const next of upcoming) {
          void voice.prefetch(next.textBn, next.speaker, next.emotion);
        }
      }
    },
    []
  );

  const triggerJump = useCallback((hold: boolean) => {
    inputRef.current.upHold = hold;
    if (hold) {
      inputRef.current.jumpPressed = true;
      inputRef.current.swimPressed = true;
      gameRef.current.player.jumpBufferTimer = 0.2;
    }
  }, []);

  const loadLevel = useCallback(
    (levelNumber: number, carryStats?: Partial<SaveData>) => {
      const idx = Math.max(0, Math.min(LEVELS.length - 1, levelNumber - 1));
      const lvl = LEVELS[idx];
      const g = gameRef.current;
      g.levelIdx = idx;
      g.objects = cloneObjects(lvl);
      g.fallingCoconuts = [];
      g.dropTimer = 3.5;
      g.dropThroughTimer = 0;
      g.missions = initMissions(lvl);
      g.particles = [];
      g.floatingTexts = [];
      g.levelCleared = false;
      g.clearTimer = 0;
      g.clearPostVoice = 0;
      g.nearObjectId = null;

      const prevInv = carryStats?.inventory ?? g.inventory;
      g.inventory = {
        coconuts: prevInv.coconuts ?? 1,
        water: prevInv.water ?? 1,
        wood: 0,
        fronds: 0,
        flareKit: levelNumber >= 6 ? true : Boolean(prevInv.flareKit),
      };

      g.player = {
        x: lvl.startX,
        y: 0, // 0 = ground level!
        vx: 0,
        vy: 0,
        width: 30,
        height: 62,
        facing: 1,
        pose: 'idle',
        animTime: 0,
        onGround: true,
        inWater: false,
        onClimbable: false,
        crouching: false,
        coyoteTimer: 0.16,
        jumpBufferTimer: 0,
        jumpsRemaining: 2,
        interactingTimer: 0,
        invulnTimer: 0,
        health: carryStats?.health ?? 100,
        hunger: carryStats?.hunger ?? 90,
        thirst: carryStats?.thirst ?? 88,
        stamina: carryStats?.stamina ?? 100,
      };
      g.cameraX = 0;
      g.unlockedLevel = Math.max(g.unlockedLevel, levelNumber, saveData?.unlockedLevel ?? 1);
      g.satelliteLost = carryStats?.satelliteLost ?? (levelNumber === 2);
      g.satelliteConnected = levelNumber > 2;
      g.phoneBattery = carryStats?.phoneBattery ?? (levelNumber <= 1 ? 42 : 38);

      const saved: SaveData = {
        levelId: lvl.id,
        unlockedLevel: g.unlockedLevel,
        health: g.player.health,
        hunger: g.player.hunger,
        thirst: g.player.thirst,
        stamina: g.player.stamina,
        inventory: { ...g.inventory },
        satelliteLost: g.satelliteLost,
        phoneBattery: g.phoneBattery,
        savedAt: Date.now(),
      };
      writeSaveData(saved);
      setSaveData(saved);

      sound.startAmbient(lvl.biome === 'night' ? 'night' : 'ocean');
      nextAmbientVoiceAtRef.current = g.time + 17 + Math.random() * 6;
      hungerWarnedRef.current = false;
      thirstWarnedRef.current = false;
      speakBg('razon', lvl.introLineBn, lvl.introEmotion ?? 'normal');
      setScreen('PLAYING');
      syncHud();
    },
    [saveData?.unlockedLevel, speakBg, syncHud]
  );

  const startPhoneCall = useCallback(
    (callKind: 'call1' | 'call2', pendingCarry?: Partial<SaveData>) => {
      voice.stop();
      const battery = callKind === 'call1' ? 42 : Math.max(28, Math.round(gameRef.current.phoneBattery));
      const initialPhase = callKind === 'call1' ? 'no_signal' : 'connecting';
      phoneCallRef.current = {
        callKind,
        phase: initialPhase,
        lineIdx: 0,
        phaseTime: 0,
        postVoiceWait: 0,
        battery,
        time: 0,
        vibrateTick: 0,
        staticTick: 0,
        pendingCarry,
      };
      setPhoneCallUi({
        callKind,
        phase: initialPhase,
        lineIdx: 0,
        signalBars: callKind === 'call1' ? 0 : 2,
        battery,
      });
      sound.playPhoneVibrate();
      setScreen('PHONE_CALL');
      const lines = callKind === 'call1' ? CALL_1_LINES : CALL_2_LINES;
      if (lines[0]) void voice.prefetch(lines[0].textBn, lines[0].speaker, lines[0].emotion);
      if (lines[1]) void voice.prefetch(lines[1].textBn, lines[1].speaker, lines[1].emotion);
      if (lines[2]) void voice.prefetch(lines[2].textBn, lines[2].speaker, lines[2].emotion);
    },
    []
  );

  const finishPhoneCall = useCallback(() => {
    voice.stop();
    const pr = phoneCallRef.current;
    const g = gameRef.current;
    const battery = Math.round(pr.battery);

    if (pr.callKind === 'call1') {
      g.satelliteLost = true;
      g.satelliteConnected = false;
      g.phoneBattery = battery;
      loadLevel(2, {
        ...(pr.pendingCarry ?? {}),
        satelliteLost: true,
        phoneBattery: battery,
      });
      return;
    }

    g.satelliteLost = false;
    g.satelliteConnected = true;
    g.phoneBattery = battery;
    for (const m of g.missions) {
      if (m.kind === 'reconnect_call') m.current = m.target;
    }
    const allDone = g.missions.every((m) => m.current >= m.target);
    if (allDone && !g.levelCleared) {
      g.levelCleared = true;
      g.clearTimer = 1.6;
      g.clearPostVoice = 0;
      g.score += 250;
      const lvl = LEVELS[g.levelIdx];
      sound.playMissionComplete();
      speakBg('razon', lvl.completeLineBn, lvl.completeEmotion ?? 'normal');
    }
    setScreen('PLAYING');
    syncHud();
  }, [loadLevel, speakBg, syncHud]);

  const startNewGame = useCallback(() => {
    sound.playClick();
    clearSaveData();
    setSaveData(null);
    gameRef.current.score = 0;
    gameRef.current.inventory = { coconuts: 1, water: 1, wood: 0, fronds: 0, flareKit: false };
    introRef.current = { sceneIdx: 0, sceneTime: 0, postVoiceWait: 0, totalTime: 0 };
    setIntroSceneIdx(0);
    sound.startAmbient('ocean');
    setScreen('INTRO');

    const s0 = INTRO_SCENES[0];
    voice.speak(s0.textBn, s0.speakerBn === 'রাজন' ? 'razon' : 'narrator', { emotion: s0.emotion });
  }, []);

  const skipIntroToLevel1 = useCallback(() => {
    sound.playClick();
    voice.stop();
    loadLevel(1, {
      health: 100,
      hunger: 92,
      thirst: 90,
      stamina: 100,
      inventory: { coconuts: 1, water: 1, wood: 0, fronds: 0, flareKit: false },
    });
  }, [loadLevel]);

  const continueSavedGame = useCallback(() => {
    if (!saveData) return;
    sound.playClick();
    loadLevel(saveData.levelId, saveData);
  }, [loadLevel, saveData]);

  const toggleMute = useCallback(() => {
    const next = !muted;
    setMuted(next);
    sound.setMuted(next);
    if (next) voice.stop();
  }, [muted]);

  const saveProgressNow = useCallback(() => {
    const g = gameRef.current;
    const lvl = LEVELS[g.levelIdx];
    const data: SaveData = {
      levelId: lvl.id,
      unlockedLevel: Math.max(g.unlockedLevel, lvl.id),
      health: Math.round(g.player.health),
      hunger: Math.round(g.player.hunger),
      thirst: Math.round(g.player.thirst),
      stamina: Math.round(g.player.stamina),
      inventory: { ...g.inventory },
      satelliteLost: g.satelliteLost,
      phoneBattery: Math.round(g.phoneBattery),
      savedAt: Date.now(),
    };
    writeSaveData(data);
    setSaveData(data);
    sound.playPickup();
  }, []);

  const consumeCoconut = useCallback(() => {
    const g = gameRef.current;
    if (screen !== 'PLAYING' || g.inventory.coconuts <= 0) return;
    g.inventory.coconuts -= 1;
    g.player.hunger = Math.min(100, g.player.hunger + 28);
    g.player.thirst = Math.min(100, g.player.thirst + 14);
    g.player.health = Math.min(100, g.player.health + 8);
    sound.playPickup();
    g.floatingTexts.push({
      id: g.nextTextId++,
      x: g.player.x,
      y: g.player.y - 72,
      text: '+২৮ ক্ষুধা',
      color: '#4ade80',
      life: 1.0,
      maxLife: 1.0,
    });
    syncHud();
  }, [screen, syncHud]);

  const consumeWater = useCallback(() => {
    const g = gameRef.current;
    if (screen !== 'PLAYING' || g.inventory.water <= 0) return;
    g.inventory.water -= 1;
    g.player.thirst = Math.min(100, g.player.thirst + 38);
    g.player.health = Math.min(100, g.player.health + 6);
    sound.playSplash();
    g.floatingTexts.push({
      id: g.nextTextId++,
      x: g.player.x,
      y: g.player.y - 72,
      text: '+৩৮ তৃষ্ণা',
      color: '#38bdf8',
      life: 1.0,
      maxLife: 1.0,
    });
    syncHud();
  }, [screen, syncHud]);

  // Keyboard bindings
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') inputRef.current.left = true;
      if (e.code === 'ArrowRight' || e.code === 'KeyD') inputRef.current.right = true;
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') inputRef.current.run = true;
      if (e.code === 'ArrowDown' || e.code === 'KeyS') {
        inputRef.current.crouch = true;
        if (!e.repeat) gameRef.current.dropThroughTimer = 0.24;
      }
      if (e.code === 'ArrowUp' || e.code === 'KeyW' || e.code === 'Space') {
        e.preventDefault();
        triggerJump(true);
      }
      if (e.code === 'KeyE' || e.code === 'Enter' || e.code === 'KeyC') {
        inputRef.current.interactPressed = true;
      }
      if (e.code === 'Digit1') consumeCoconut();
      if (e.code === 'Digit2') consumeWater();
      if (e.code === 'Escape' || e.code === 'KeyP') {
        setScreen((prev) => (prev === 'PLAYING' ? 'PAUSED' : prev === 'PAUSED' ? 'PLAYING' : prev));
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') inputRef.current.left = false;
      if (e.code === 'ArrowRight' || e.code === 'KeyD') inputRef.current.right = false;
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') inputRef.current.run = false;
      if (e.code === 'ArrowDown' || e.code === 'KeyS') inputRef.current.crouch = false;
      if (e.code === 'ArrowUp' || e.code === 'KeyW' || e.code === 'Space') {
        triggerJump(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [consumeCoconut, consumeWater, triggerJump]);

  // Main 60fps Canvas Loop
  useEffect(() => {
    let rafId = 0;
    let lastTime = performance.now();
    let hudTimer = 0;

    const addFloating = (x: number, yRel: number, text: string, color: string) => {
      const g = gameRef.current;
      g.floatingTexts.push({
        id: g.nextTextId++,
        x,
        y: yRel,
        text,
        color,
        life: 1.1,
        maxLife: 1.1,
      });
    };

    const spawnBurst = (x: number, yRel: number, color: string, count = 10) => {
      const g = gameRef.current;
      for (let i = 0; i < count; i++) {
        const a = Math.random() * Math.PI * 2;
        const spd = 40 + Math.random() * 115;
        g.particles.push({
          x,
          y: yRel,
          vx: Math.cos(a) * spd,
          vy: Math.sin(a) * spd - 45,
          size: 2.2 + Math.random() * 2.4,
          color,
          alpha: 1,
          life: 0.5 + Math.random() * 0.35,
          maxLife: 0.85,
        });
      }
    };

    const advanceMission = (kind: MissionStep['kind'], amount = 1) => {
      const g = gameRef.current;
      for (const m of g.missions) {
        if (m.kind === kind && m.current < m.target) {
          m.current = Math.min(m.target, m.current + amount);
        }
      }
      const allDone = g.missions.every((m) => m.current >= m.target);
      if (allDone && !g.levelCleared) {
        g.levelCleared = true;
        g.clearTimer = 2.0;
        g.clearPostVoice = 0;
        g.score += 250;
        const lvl = LEVELS[g.levelIdx];
        sound.playMissionComplete();
        speakBg('razon', lvl.completeLineBn, lvl.completeEmotion ?? 'normal');
      }
      syncHud();
    };

    const handleInteraction = (obj: WorldObject) => {
      const g = gameRef.current;
      g.player.interactingTimer = 0.25;

      switch (obj.kind) {
        case 'coconut':
          obj.collected = true;
          g.inventory.coconuts += 1;
          g.score += 50;
          sound.playPickup();
          spawnBurst(obj.x + 14, obj.y + 14, '#84cc16');
          addFloating(obj.x, obj.y - 10, '+১ ডাব', '#bef264');
          advanceMission('collect_coconut', 1);
          if (Math.random() < 0.36) speakContextual('pickup_food', 14);
          break;
        case 'water_bottle':
          obj.collected = true;
          g.inventory.water += 1;
          g.score += 50;
          sound.playPickup();
          spawnBurst(obj.x + 12, obj.y + 16, '#38bdf8');
          addFloating(obj.x, obj.y - 10, '+১ পানি', '#7dd3fc');
          advanceMission('collect_water', 1);
          if (Math.random() < 0.36) speakContextual('pickup_food', 14);
          break;
        case 'fresh_spring':
          if (!obj.activated) {
            obj.activated = true;
            g.inventory.water += 2;
            g.player.thirst = Math.min(100, g.player.thirst + 35);
            g.score += 100;
            sound.playSplash();
            spawnBurst(obj.x + 36, obj.y + 20, '#22d3ee', 16);
            addFloating(obj.x + 20, obj.y - 10, '+২ মিষ্টি জল', '#67e8f9');
            advanceMission('collect_water', 2);
          }
          break;
        case 'wood':
          obj.collected = true;
          g.inventory.wood += 1;
          g.score += 45;
          sound.playPickup();
          spawnBurst(obj.x + 18, obj.y + 10, '#d97706');
          addFloating(obj.x, obj.y - 10, '+১ কাঠ', '#fcd34d');
          advanceMission('collect_wood', 1);
          if (Math.random() < 0.38) speakContextual('pickup_wood', 14);
          break;
        case 'frond':
          obj.collected = true;
          g.inventory.fronds += 1;
          g.score += 45;
          sound.playPickup();
          spawnBurst(obj.x + 20, obj.y + 12, '#22c55e');
          addFloating(obj.x, obj.y - 10, '+১ পাতা', '#86efac');
          advanceMission('collect_frond', 1);
          if (Math.random() < 0.32) speakContextual('pickup_wood', 14);
          break;
        case 'flare_crate':
          if (!obj.collected) {
            obj.collected = true;
            g.inventory.flareKit = true;
            g.score += 150;
            sound.playMissionComplete();
            spawnBurst(obj.x + 24, obj.y + 20, '#facc15', 18);
            addFloating(obj.x, obj.y - 14, '+সিগন্যাল ফ্লেয়ার', '#fde047');
            if (obj.subtitleBn) speakBg('razon', obj.subtitleBn, 'surprise');
            advanceMission('collect_flare', 1);
          }
          break;
        case 'safe_spot':
          if (!obj.activated) {
            obj.activated = true;
            sound.playPickup();
            spawnBurst(obj.x + 42, obj.y + 25, '#fbbf24', 16);
            if (obj.subtitleBn) speakBg('razon', obj.subtitleBn, 'normal');
            advanceMission('reach', 1);
          }
          break;
        case 'reconnect_spot':
          if (!obj.activated) {
            obj.activated = true;
            sound.playSatelliteConnect();
            spawnBurst(obj.x + 32, obj.y + 24, '#22d3ee', 20);
            addFloating(obj.x + 28, obj.y - 12, 'সিগন্যাল ফিরেছে!', '#67e8f9');
            for (const m of g.missions) {
              if (m.kind === 'reconnect_call') m.current = m.target;
            }
            g.satelliteLost = false;
            g.satelliteConnected = true;
            startPhoneCall('call2');
          }
          break;
        case 'shelter_site': {
          if (obj.activated) break;
          const needWood = g.missions.find((m) => m.kind === 'collect_wood');
          const needFrond = g.missions.find((m) => m.kind === 'collect_frond');
          if (
            (needWood && needWood.current < needWood.target) ||
            (needFrond && needFrond.current < needFrond.target)
          ) {
            speakBg('razon', 'আগে ৩টি কাঠ আর ৩টি নারকেল পাতা জোগাড় করতে হবে!', 'normal');
            sound.playTone(220, 0.14, 'triangle', 0.08);
            break;
          }
          obj.activated = true;
          sound.playBuild();
          spawnBurst(obj.x + 70, obj.y + 60, '#f59e0b', 22);
          addFloating(obj.x + 60, obj.y - 12, 'আশ্রয় তৈরি!', '#fde68a');
          advanceMission('build_shelter', 1);
          break;
        }
        case 'signal_beacon': {
          if (obj.activated) break;
          const needWood = g.missions.find((m) => m.kind === 'collect_wood');
          if (needWood && needWood.current < needWood.target) {
            speakBg('razon', 'আগুন জ্বালাতে আরও শুকনো কাঠ লাগবে!', 'fear');
            sound.playTone(220, 0.14, 'triangle', 0.08);
            break;
          }
          obj.activated = true;
          sound.playMissionComplete();
          spawnBurst(obj.x + 52, obj.y + 60, '#ef4444', 28);
          addFloating(obj.x + 45, obj.y - 20, 'সংকেত পাঠানো হয়েছে!', '#fca5a5');
          advanceMission('light_signal', 1);
          break;
        }
      }
    };

    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - lastTime) / 1000);
      lastTime = now;

      const canvas = canvasRef.current;
      if (canvas) {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const cssW = canvas.clientWidth || window.innerWidth;
        const cssH = canvas.clientHeight || window.innerHeight;
        if (canvas.width !== Math.floor(cssW * dpr) || canvas.height !== Math.floor(cssH * dpr)) {
          canvas.width = Math.floor(cssW * dpr);
          canvas.height = Math.floor(cssH * dpr);
        }
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const isPortrait = cssW < cssH;
          const worldScale = isPortrait
            ? Math.max(0.56, Math.min(0.95, cssW / 520))
            : Math.max(0.62, Math.min(1, cssH / 460));
          const viewW = cssW / worldScale;
          const viewH = cssH / worldScale;
          const groundY = isPortrait ? viewH * 0.67 : viewH * 0.74;

          ctx.save();
          ctx.scale(dpr * worldScale, dpr * worldScale);

          if (screen === 'MENU') {
            introRef.current.totalTime += dt;
            renderIntroScene(ctx, viewW, viewH, 5, 0.6, introRef.current.totalTime);
          } else if (screen === 'INTRO') {
            const ir = introRef.current;
            ir.sceneTime += dt;
            ir.totalTime += dt;
            const currentScene = INTRO_SCENES[ir.sceneIdx];
            const progress = Math.min(1, ir.sceneTime / currentScene.duration);

            renderIntroScene(ctx, viewW, viewH, ir.sceneIdx, progress, ir.totalTime);

            const minVisualTime = sound.isMuted() ? Math.max(4.0, currentScene.duration * 0.78) : 2.0;
            const voiceBusy = voice.isSpeaking();
            if (!voiceBusy && ir.sceneTime >= minVisualTime) {
              ir.postVoiceWait += dt;
            } else {
              ir.postVoiceWait = 0;
            }

            const readyToAdvance = ir.postVoiceWait >= 0.85 || ir.sceneTime >= 45;
            if (readyToAdvance) {
              if (ir.sceneIdx < INTRO_SCENES.length - 1) {
                ir.sceneIdx += 1;
                ir.sceneTime = 0;
                ir.postVoiceWait = 0;
                setIntroSceneIdx(ir.sceneIdx);
                const nextSc = INTRO_SCENES[ir.sceneIdx];
                voice.speak(nextSc.textBn, nextSc.speakerBn === 'রাজন' ? 'razon' : 'narrator', {
                  emotion: nextSc.emotion,
                });
                const preloadSc = INTRO_SCENES[ir.sceneIdx + 1];
                if (preloadSc) {
                  void voice.prefetch(
                    preloadSc.textBn,
                    preloadSc.speakerBn === 'রাজন' ? 'razon' : 'narrator',
                    preloadSc.emotion
                  );
                }
                if (ir.sceneIdx === 2) {
                  sound.startAmbient('storm');
                  sound.playThunder();
                } else if (ir.sceneIdx === 4) {
                  sound.startAmbient('ocean');
                }
              } else {
                skipIntroToLevel1();
              }
            }
          } else if (screen === 'PHONE_CALL') {
            const pr = phoneCallRef.current;
            const lines = pr.callKind === 'call1' ? CALL_1_LINES : CALL_2_LINES;
            const currentLine = lines[pr.lineIdx] ?? lines[lines.length - 1];
            pr.time += dt;
            pr.phaseTime += dt;
            pr.battery = Math.max(24, pr.battery - dt * 0.08);

            const animPhonePose =
              pr.phase === 'no_signal'
                ? 'check'
                : pr.phase === 'connecting'
                ? pr.callKind === 'call2'
                  ? 'raise'
                  : 'check'
                : pr.phase === 'disconnected'
                ? 'check'
                : currentLine.phonePose;

            const animMood =
              pr.phase === 'no_signal'
                ? 'worried'
                : pr.phase === 'disconnected'
                ? 'annoyed'
                : currentLine.mood;

            const signalBars: 0 | 1 | 2 | 3 =
              pr.phase === 'no_signal' || pr.phase === 'disconnected'
                ? 0
                : pr.phase === 'connecting'
                ? pr.callKind === 'call2'
                  ? 2
                  : 1
                : currentLine.signalBars;

            const talkingNow =
              pr.phase === 'talking' &&
              currentLine.speaker === 'razon' &&
              voice.isSpeaking() &&
              !sound.isMuted();

            renderPhoneCallScene(ctx, viewW, viewH, {
              biome: pr.callKind === 'call1' ? 'beach' : 'grove',
              phonePose: animPhonePose,
              mood: animMood,
              talking: talkingNow,
              signalBars,
              time: pr.time,
            });

            if (pr.phase === 'no_signal') {
              pr.vibrateTick += dt;
              if (pr.vibrateTick >= 1.1) {
                pr.vibrateTick = 0;
                sound.playPhoneVibrate();
              }
              if (pr.phaseTime >= 2.2) {
                pr.phase = 'connecting';
                pr.phaseTime = 0;
                pr.postVoiceWait = 0;
                sound.playSatelliteConnect();
                setPhoneCallUi({
                  callKind: pr.callKind,
                  phase: 'connecting',
                  lineIdx: 0,
                  signalBars: 1,
                  battery: Math.round(pr.battery),
                });
              }
            } else if (pr.phase === 'connecting') {
              const connectDur = pr.callKind === 'call1' ? 1.5 : 1.1;
              if (pr.phaseTime >= connectDur) {
                pr.phase = 'talking';
                pr.lineIdx = 0;
                pr.phaseTime = 0;
                pr.postVoiceWait = 0;
                if (pr.callKind === 'call2') sound.playSatelliteConnect();
                speakPhoneLine(lines[0], lines.slice(1, 3));
                setPhoneCallUi({
                  callKind: pr.callKind,
                  phase: 'talking',
                  lineIdx: 0,
                  signalBars: lines[0].signalBars,
                  battery: Math.round(pr.battery),
                });
              }
            } else if (pr.phase === 'talking') {
              if (currentLine.interference) {
                pr.staticTick += dt;
                if (pr.staticTick >= 1.35) {
                  pr.staticTick = 0;
                  sound.playSignalStatic(0.22, 0.032);
                }
              }

              const minHold = sound.isMuted() ? 2.1 : 0.9;
              if (!voice.isSpeaking() && pr.phaseTime >= minHold) {
                pr.postVoiceWait += dt;
              } else {
                pr.postVoiceWait = 0;
              }

              const pauseNeeded = currentLine.pauseAfter ?? 0.45;
              if (pr.postVoiceWait >= pauseNeeded || pr.phaseTime >= 35) {
                if (pr.lineIdx < lines.length - 1) {
                  pr.lineIdx += 1;
                  pr.phaseTime = 0;
                  pr.postVoiceWait = 0;
                  pr.staticTick = 0;
                  const nextLine = lines[pr.lineIdx];
                  speakPhoneLine(nextLine, lines.slice(pr.lineIdx + 1, pr.lineIdx + 3));
                  setPhoneCallUi({
                    callKind: pr.callKind,
                    phase: 'talking',
                    lineIdx: pr.lineIdx,
                    signalBars: nextLine.signalBars,
                    battery: Math.round(pr.battery),
                  });
                } else if (pr.callKind === 'call1') {
                  pr.phase = 'disconnected';
                  pr.phaseTime = 0;
                  sound.playCallDisconnect();
                  setPhoneCallUi({
                    callKind: pr.callKind,
                    phase: 'disconnected',
                    lineIdx: pr.lineIdx,
                    signalBars: 0,
                    battery: Math.round(pr.battery),
                  });
                } else {
                  finishPhoneCall();
                }
              }
            } else if (pr.phase === 'disconnected') {
              if (pr.phaseTime >= 2.6) {
                finishPhoneCall();
              }
            }
          } else if (screen === 'PLAYING') {
            const g = gameRef.current;
            const lvl = LEVELS[g.levelIdx];
            const p = g.player;
            const inp = inputRef.current;

            g.time += dt;
            p.animTime += dt;
            if (p.interactingTimer > 0) p.interactingTimer = Math.max(0, p.interactingTimer - dt);
            if (p.invulnTimer > 0) p.invulnTimer = Math.max(0, p.invulnTimer - dt);
            if (g.dropThroughTimer > 0) g.dropThroughTimer = Math.max(0, g.dropThroughTimer - dt);

            // Falling coconuts in levels 1..4 (y relative to groundY)
            if (lvl.id <= 4) {
              g.dropTimer -= dt;
              if (g.dropTimer <= 0 && g.fallingCoconuts.length < 2) {
                g.dropTimer = 6.5 + Math.random() * 4;
                const dropX = Math.max(150, Math.min(lvl.worldWidth - 150, p.x + 80 + Math.random() * 140));
                g.fallingCoconuts.push({
                  id: `fc_${g.dropSeq++}`,
                  x: dropX,
                  y: -210,
                  vy: 85,
                });
              }
            }

            for (let i = g.fallingCoconuts.length - 1; i >= 0; i--) {
              const fc = g.fallingCoconuts[i];
              fc.vy += 320 * dt;
              fc.y += fc.vy * dt;
              const distToRazon = Math.hypot(p.x - (fc.x + 14), p.y - 34 - (fc.y + 14));
              if (distToRazon < 42 || (inp.interactPressed && distToRazon < 105)) {
                g.fallingCoconuts.splice(i, 1);
                g.player.interactingTimer = 0.25;
                g.inventory.coconuts += 1;
                g.score += 100;
                sound.playPickup();
                spawnBurst(fc.x + 14, fc.y + 14, '#84cc16', 12);
                addFloating(fc.x, fc.y - 10, 'ধরেছি! +১ ডাব', '#bef264');
                advanceMission('collect_coconut', 1);
                continue;
              }
              if (fc.y >= -26) {
                g.objects.push({
                  id: fc.id,
                  kind: 'coconut',
                  x: fc.x,
                  y: -28,
                  w: 28,
                  h: 28,
                  labelBn: 'ডাব নাও',
                });
                g.fallingCoconuts.splice(i, 1);
                spawnBurst(fc.x + 14, -4, '#d7b56e', 5);
              }
            }

            // Water check (p.y >= -6 means in water zone at or below ground waterline)
            const inWaterZone = lvl.waterZones.find((wz) => p.x >= wz.x && p.x <= wz.x + wz.w);
            const wasInWater = p.inWater;
            p.inWater = Boolean(inWaterZone && p.y >= -6);
            if (p.inWater && !wasInWater) {
              sound.playSplash();
              spawnBurst(p.x, 0, '#7dd3fc', 8);
              p.jumpsRemaining = 2;
            }

            // Climbable vine/ladder/rope check
            const climbZone = (lvl.climbZones ?? []).find(
              (cz) =>
                p.x >= cz.x - 24 &&
                p.x <= cz.x + cz.w + 24 &&
                p.y >= cz.topY - 14 &&
                p.y <= cz.bottomY + 12
            );
            if (climbZone && (inp.upHold || (p.onClimbable && inp.crouch))) {
              p.onClimbable = true;
              p.jumpsRemaining = 2;
            } else if (!climbZone || (p.onGround && !inp.upHold && !inp.crouch)) {
              p.onClimbable = false;
            }

            // Survival meters
            const isRunning =
              inp.run &&
              (inp.left || inp.right) &&
              !inp.crouch &&
              !p.onClimbable &&
              p.stamina > 2;
            p.hunger = Math.max(0, p.hunger - dt * 0.42);
            p.thirst = Math.max(0, p.thirst - dt * 0.58);
            if (isRunning) {
              p.stamina = Math.max(0, p.stamina - dt * 14);
            } else if (p.inWater && (inp.left || inp.right || inp.upHold)) {
              p.stamina = Math.max(0, p.stamina - dt * 4);
            } else {
              p.stamina = Math.min(100, p.stamina + dt * (inp.crouch ? 26 : 16));
            }
            if (p.hunger <= 0 || p.thirst <= 0) {
              p.health = Math.max(0, p.health - dt * 2.5);
            }
            if (g.satelliteLost && g.phoneBattery > 22) {
              g.phoneBattery = Math.max(22, g.phoneBattery - dt * 0.12);
            }

            // Horizontal movement
            p.crouching = inp.crouch && p.onGround && !p.inWater && !p.onClimbable;
            const moveDir = (inp.right ? 1 : 0) - (inp.left ? 1 : 0);
            if (moveDir !== 0) p.facing = moveDir as 1 | -1;

            const targetSpeed = p.onClimbable
              ? WALK_SPEED * 0.72
              : p.inWater
              ? SWIM_SPEED
              : p.crouching
              ? WALK_SPEED * 0.6
              : isRunning
              ? RUN_SPEED
              : WALK_SPEED;
            p.vx = moveDir * targetSpeed;

            // Jump buffer + Coyote timers
            if (inp.jumpPressed || inp.swimPressed) {
              p.jumpBufferTimer = 0.2;
              inp.jumpPressed = false;
              inp.swimPressed = false;
            } else {
              p.jumpBufferTimer = Math.max(0, p.jumpBufferTimer - dt);
            }

            if (p.onGround) {
              p.coyoteTimer = 0.16;
              p.jumpsRemaining = 2;
            } else {
              p.coyoteTimer = Math.max(0, p.coyoteTimer - dt);
            }

            // Vertical movement: Climb > Swim > Jump / Double-Jump
            if (p.onClimbable && climbZone) {
              const czCenter = climbZone.x + climbZone.w / 2;
              if (moveDir === 0) {
                p.x += (czCenter - p.x) * Math.min(1, dt * 10);
              }
              if (inp.upHold) {
                p.vy = -CLIMB_SPEED;
              } else if (inp.crouch) {
                p.vy = CLIMB_SPEED;
              } else {
                p.vy = 0;
              }
            } else if (p.inWater) {
              if (p.jumpBufferTimer > 0 && p.y <= 16) {
                // Strong leap out of water onto land/rocks!
                p.vy = -560;
                p.inWater = false;
                p.jumpBufferTimer = 0;
                p.jumpsRemaining = 1;
                sound.playJump();
              } else if (inp.upHold || p.jumpBufferTimer > 0) {
                p.vy = -285;
                p.jumpBufferTimer = 0;
              } else if (inp.crouch) {
                p.vy = 165;
              } else {
                p.vy += WATER_GRAVITY * dt;
                if (p.vy > 130) p.vy = 130;
              }
            } else {
              if (p.jumpBufferTimer > 0) {
                if (p.coyoteTimer > 0) {
                  p.vy = JUMP_VEL;
                  p.onGround = false;
                  p.coyoteTimer = 0;
                  p.jumpBufferTimer = 0;
                  p.jumpsRemaining = 1;
                  sound.playJump();
                  spawnBurst(p.x, p.y, '#e7c677', 5);
                } else if (p.jumpsRemaining > 0) {
                  p.vy = DOUBLE_JUMP_VEL;
                  p.jumpsRemaining -= 1;
                  p.jumpBufferTimer = 0;
                  sound.playJump();
                  spawnBurst(p.x, p.y - 10, '#cbd5e1', 6);
                }
              }
              p.vy += GRAVITY * dt;
              if (!inp.upHold && p.vy < -320) {
                p.vy += GRAVITY * 0.45 * dt;
              }
            }

            const prevY = p.y;
            p.x += p.vx * dt;
            p.y += p.vy * dt;

            p.x = Math.max(28, Math.min(lvl.worldWidth - 28, p.x));

            if (p.onClimbable && climbZone) {
              if (p.y < climbZone.topY) {
                p.y = climbZone.topY;
                p.vy = 0;
              }
              if (p.y >= climbZone.bottomY) {
                p.y = climbZone.bottomY;
                p.onClimbable = false;
                p.onGround = true;
              }
            }

            // Platform collisions (all ground-relative!)
            p.onGround = false;
            const prevX = p.x - p.vx * dt;
            for (const plat of lvl.platforms) {
              if (plat.passThrough && g.dropThroughTimer > 0) continue;

              if (p.x + 14 > plat.x && p.x - 14 < plat.x + plat.w) {
                if (p.vy >= 0 && prevY <= plat.y + 16 && p.y >= plat.y) {
                  p.y = plat.y;
                  p.vy = 0;
                  p.onGround = true;
                  p.onClimbable = false;
                }
              }
              // Auto ledge-mantle on solid cliffs
              if (
                !plat.passThrough &&
                !p.onGround &&
                moveDir !== 0 &&
                p.y > plat.y &&
                p.y <= plat.y + 30 &&
                ((moveDir > 0 && p.x >= plat.x - 20 && p.x <= plat.x + 12) ||
                  (moveDir < 0 && p.x <= plat.x + plat.w + 20 && p.x >= plat.x + plat.w - 12))
              ) {
                p.y = plat.y;
                p.vy = 0;
                p.onGround = true;
              } else if (
                !plat.passThrough &&
                !p.onClimbable &&
                p.y > plat.y + 30 &&
                p.y - 45 < plat.y + plat.h
              ) {
                // Solid cliff side push-out
                if (prevX + 14 <= plat.x + 6 && p.x + 14 > plat.x) {
                  p.x = plat.x - 14;
                  p.vx = 0;
                } else if (prevX - 14 >= plat.x + plat.w - 6 && p.x - 14 < plat.x + plat.w) {
                  p.x = plat.x + plat.w + 14;
                  p.vx = 0;
                }
              }
            }

            // Floor / water bed (0 = ground)
            const waterBedY = inWaterZone ? inWaterZone.depth - 14 : 0;
            if (p.y >= waterBedY) {
              p.y = waterBedY;
              p.vy = 0;
              if (!inWaterZone) p.onGround = true;
            }

            // Pose selection
            if (p.interactingTimer > 0) {
              p.pose = 'interact';
            } else if (p.onClimbable) {
              p.pose = 'climb';
            } else if (p.inWater) {
              p.pose = 'swim';
            } else if (!p.onGround) {
              p.pose = 'jump';
            } else if (p.crouching) {
              p.pose = 'crouch';
            } else if (Math.abs(p.vx) > 270) {
              p.pose = 'run';
            } else if (Math.abs(p.vx) > 10) {
              p.pose = 'walk';
            } else {
              p.pose = 'idle';
            }

            // Objects & forgiving hazard collision
            let closestObj: WorldObject | null = null;
            let closestDist = 115;

            for (const obj of g.objects) {
              if (obj.collected) continue;

              if (obj.kind === 'crab' && obj.vx && obj.patrolMinX !== undefined && obj.patrolMaxX !== undefined) {
                obj.x += obj.vx * dt;
                if (obj.x < obj.patrolMinX) {
                  obj.x = obj.patrolMinX;
                  obj.vx = Math.abs(obj.vx);
                } else if (obj.x > obj.patrolMaxX) {
                  obj.x = obj.patrolMaxX;
                  obj.vx = -Math.abs(obj.vx);
                }
              }

              const oxCenter = obj.x + obj.w / 2;
              const oyCenter = obj.y + obj.h / 2;
              const pTop = p.y - (p.crouching ? 36 : 56);
              const pyCenter = (p.y + pTop) / 2;
              const dist = Math.hypot(p.x - oxCenter, pyCenter - oyCenter);

              const isHazard = obj.kind === 'crab' || obj.kind === 'thorns' || obj.kind === 'sharp_coral';
              if (isHazard) {
                const horizOverlap = Math.abs(p.x - oxCenter) < obj.w * 0.34 + 6;
                const vertOverlap = p.y > obj.y + 8 && pTop < obj.y + obj.h - 4;
                if (p.invulnTimer <= 0 && horizOverlap && vertOverlap) {
                  p.health = Math.max(0, p.health - 15);
                  p.invulnTimer = 1.25;
                  p.vy = -340;
                  p.vx = p.x < oxCenter ? -180 : 180;
                  sound.playHurt();
                  spawnBurst(p.x, p.y - 25, '#ef4444', 12);
                  addFloating(p.x, p.y - 68, '-১৫ স্বাস্থ্য', '#fca5a5');
                  speakContextual('danger_hurt', 8);
                }
                continue;
              }

              const autoPickup =
                obj.kind === 'coconut' ||
                obj.kind === 'water_bottle' ||
                obj.kind === 'wood' ||
                obj.kind === 'frond';
              if (autoPickup && dist < 48) {
                handleInteraction(obj);
                continue;
              }

              if (obj.kind === 'safe_spot' && !obj.activated && dist < 62) {
                handleInteraction(obj);
                continue;
              }

              if (obj.kind === 'reconnect_spot' && !obj.activated && dist < 56) {
                handleInteraction(obj);
                continue;
              }

              if (!obj.activated && dist < closestDist) {
                closestDist = dist;
                closestObj = obj;
              }
            }

            g.nearObjectId = closestObj ? closestObj.id : null;

            if (inp.interactPressed) {
              inp.interactPressed = false;
              p.interactingTimer = 0.25;
              if (closestObj) {
                handleInteraction(closestObj);
              } else if (climbZone) {
                p.onClimbable = true;
                p.vy = -120;
              }
            }

            // Particles & floating texts (stored relative to groundY)
            for (let i = g.particles.length - 1; i >= 0; i--) {
              const pt = g.particles[i];
              pt.x += pt.vx * dt;
              pt.y += pt.vy * dt;
              pt.vy += 260 * dt;
              pt.life -= dt;
              if (pt.life <= 0) g.particles.splice(i, 1);
            }
            for (let i = g.floatingTexts.length - 1; i >= 0; i--) {
              const ft = g.floatingTexts[i];
              ft.y -= 26 * dt;
              ft.life -= dt;
              if (ft.life <= 0) g.floatingTexts.splice(i, 1);
            }

            // Camera adapts to portrait vs landscape viewW
            const focusRatio = isPortrait ? 0.34 : 0.36;
            const desiredCam = Math.max(0, Math.min(lvl.worldWidth - viewW, p.x - viewW * focusRatio));
            g.cameraX += (desiredCam - g.cameraX) * Math.min(1, dt * 8);

            // Contextual non-repeating survival & exploration voice acting
            if (p.hunger > 55) hungerWarnedRef.current = false;
            if (p.thirst > 55) thirstWarnedRef.current = false;
            if (!g.levelCleared && p.health > 0) {
              if (p.hunger < 32 && !hungerWarnedRef.current) {
                hungerWarnedRef.current = true;
                speakContextual('hunger_low', 12);
              } else if (p.thirst < 32 && !thirstWarnedRef.current) {
                thirstWarnedRef.current = true;
                speakContextual('thirst_low', 12);
              } else if (g.time >= nextAmbientVoiceAtRef.current) {
                nextAmbientVoiceAtRef.current = g.time + 19 + Math.random() * 8;
                const category: ContextualCategory =
                  lvl.id === 7 && p.x > 1600
                    ? 'beacon_ready'
                    : lvl.biome === 'jungle' || lvl.biome === 'night' || lvl.biome === 'rocky'
                    ? 'explore_mystery'
                    : 'explore_day';
                speakContextual(category, 16);
              }
            }

            if (p.health <= 0) {
              sound.playHurt();
              setScreen('GAME_OVER');
            }

            if (g.levelCleared) {
              g.clearTimer -= dt;
              const minStagePauseDone = g.clearTimer <= 0;
              if (minStagePauseDone && !voice.isSpeaking()) {
                g.clearPostVoice += dt;
              } else {
                g.clearPostVoice = 0;
              }
              if ((minStagePauseDone && g.clearPostVoice >= 0.85) || g.clearTimer <= -45) {
                if (g.levelIdx === 0) {
                  startPhoneCall('call1', {
                    health: Math.min(100, p.health + 15),
                    hunger: p.hunger,
                    thirst: p.thirst,
                    stamina: 100,
                    inventory: g.inventory,
                  });
                } else if (g.levelIdx < LEVELS.length - 1) {
                  loadLevel(g.levelIdx + 2, {
                    health: Math.min(100, p.health + 15),
                    hunger: p.hunger,
                    thirst: p.thirst,
                    stamina: 100,
                    inventory: g.inventory,
                    satelliteLost: false,
                    phoneBattery: Math.round(g.phoneBattery),
                  });
                } else {
                  endingRef.current = {
                    elapsed: 0,
                    stageTime: 0,
                    postVoiceWait: 0,
                    totalTime: 0,
                    rotorTick: 0,
                    stage: 'approaching',
                  };
                  setEndingStage('approaching');
                  sound.startAmbient('ocean');
                  void voice.prefetch(
                    'রাজন! অবশেষে তোমায় পেলাম ভাই! তাড়াতাড়ি হাত ধরো, হেলিকপ্টারে ওঠো!',
                    'rasel',
                    'surprise'
                  );
                  void voice.prefetch(
                    'সব ভয় শেষ। সেন্ট মার্টিন পেছনে ফেলে আমরা এখন বাড়ি ফিরছি!',
                    'rasel',
                    'normal'
                  );
                  setScreen('ENDING');
                }
              }
            }

            const renderObjects: WorldObject[] = [
              ...g.objects,
              ...g.fallingCoconuts.map((fc) => ({
                id: fc.id,
                kind: 'coconut' as const,
                x: fc.x,
                y: fc.y,
                w: 28,
                h: 28,
                labelBn: 'ধরো',
              })),
            ];

            renderGameWorld(ctx, viewW, viewH, {
              level: lvl,
              player: { ...p, y: groundY + p.y },
              cameraX: g.cameraX,
              groundY,
              objects: renderObjects,
              particles: g.particles.map((pt) => ({ ...pt, y: groundY + pt.y })),
              floatingTexts: g.floatingTexts.map((ft) => ({ ...ft, y: groundY + ft.y })),
              nearObjectId: g.nearObjectId,
              time: g.time,
            });

            hudTimer += dt;
            if (hudTimer >= 0.08) {
              hudTimer = 0;
              syncHud();
            }
          } else if (screen === 'PAUSED' || screen === 'GAME_OVER') {
            const g = gameRef.current;
            renderGameWorld(ctx, viewW, viewH, {
              level: LEVELS[g.levelIdx],
              player: { ...g.player, y: groundY + g.player.y },
              cameraX: g.cameraX,
              groundY,
              objects: g.objects,
              particles: g.particles.map((pt) => ({ ...pt, y: groundY + pt.y })),
              floatingTexts: g.floatingTexts.map((ft) => ({ ...ft, y: groundY + ft.y })),
              nearObjectId: null,
              time: g.time,
            });
          } else if (screen === 'ENDING') {
            const er = endingRef.current;
            er.elapsed += dt;
            er.stageTime += dt;
            er.totalTime += dt;
            er.rotorTick += dt;
            if (er.stage !== 'complete' && er.rotorTick > 0.16) {
              er.rotorTick = 0;
              sound.playHelicopterPulse();
            }

            renderEndingScene(ctx, viewW, viewH, er.stage, er.stageTime, er.elapsed, er.totalTime);

            if (er.stage === 'approaching' && er.stageTime >= 4.2) {
              er.stage = 'dialogue';
              er.stageTime = 0;
              er.postVoiceWait = 0;
              setEndingStage('dialogue');
              voice.speak(
                'রাজন! অবশেষে তোমায় পেলাম ভাই! তাড়াতাড়ি হাত ধরো, হেলিকপ্টারে ওঠো!',
                'rasel',
                { emotion: 'surprise' }
              );
            } else if (er.stage === 'dialogue') {
              const minDialogueVisual = sound.isMuted() ? 4.4 : 3.8;
              if (!voice.isSpeaking() && er.stageTime >= minDialogueVisual) {
                er.postVoiceWait += dt;
              } else {
                er.postVoiceWait = 0;
              }
              if (er.postVoiceWait >= 0.85 || er.stageTime >= 45) {
                er.stage = 'departing';
                er.stageTime = 0;
                er.postVoiceWait = 0;
                setEndingStage('departing');
                voice.speak(
                  'সব ভয় শেষ। সেন্ট মার্টিন পেছনে ফেলে আমরা এখন বাড়ি ফিরছি!',
                  'rasel',
                  { emotion: 'normal' }
                );
              }
            } else if (er.stage === 'departing') {
              const minFlightTime = 5.4;
              if (!voice.isSpeaking() && er.stageTime >= minFlightTime) {
                er.postVoiceWait += dt;
              } else {
                er.postVoiceWait = 0;
              }
              if (er.postVoiceWait >= 0.85 || er.stageTime >= 45) {
                er.stage = 'complete';
                er.stageTime = 0;
                setEndingStage('complete');
                sound.playMissionComplete();
              }
            }
          }

          ctx.restore();
        }
      }

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [finishPhoneCall, loadLevel, screen, skipIntroToLevel1, speakBg, speakPhoneLine, startPhoneCall, syncHud]);

  const currentIntroScene = INTRO_SCENES[introSceneIdx] || INTRO_SCENES[0];
  const activePhoneLines = phoneCallUi.callKind === 'call1' ? CALL_1_LINES : CALL_2_LINES;
  const currentPhoneLine = activePhoneLines[phoneCallUi.lineIdx] || activePhoneLines[0];
  const unlockedMax = Math.max(gameRef.current.unlockedLevel, saveData?.unlockedLevel ?? 1);

  return (
    <div
      className="relative w-screen h-dvh overflow-hidden bg-[#071117] font-bangla select-none touch-none"
      onContextMenu={(e) => e.preventDefault()}
    >
      <canvas ref={canvasRef} className="block w-full h-full" />

      {/* ==================== MAIN MENU (Responsive across Portrait & Short Landscape) ==================== */}
      {screen === 'MENU' && (
        <div className="absolute inset-0 z-20 flex flex-col bg-gradient-to-b landscape:bg-gradient-to-r md:bg-gradient-to-r from-slate-950/92 via-slate-950/72 to-slate-950/42 px-[max(0.85rem,env(safe-area-inset-left))] pr-[max(0.85rem,env(safe-area-inset-right))] py-[max(0.65rem,env(safe-area-inset-top))] pb-[max(0.65rem,env(safe-area-inset-bottom))] overflow-y-auto">
          <div className="my-auto w-full max-w-6xl mx-auto flex flex-col landscape:flex-row md:flex-row items-center justify-between gap-3 sm:gap-6">
          <div className="max-w-xl w-full space-y-2 sm:space-y-4 text-center landscape:text-left md:text-left">
            <div className="space-y-1">
              <p className="text-[11px] sm:text-sm font-medium text-amber-300/90 tracking-wide">
                সেন্ট মার্টিন দ্বীপে বেঁচে থাকার ২ডি অ্যাডভেঞ্চার
              </p>
              <h1 className="font-display text-[clamp(2.25rem,7vw,4.3rem)] leading-[0.95] text-white drop-shadow-lg">
                LOST IN <span className="text-amber-400">SAINT MARTIN</span>
              </h1>
              <p className="text-xs sm:text-base text-slate-200 max-w-md mx-auto landscape:mx-0 md:mx-0">
                টেকনাফ থেকে ট্রলারডুবি, নির্জন প্রবাল দ্বীপে একা বেঁচে থাকা এবং শেষ উদ্ধারের গল্প।
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-center landscape:justify-start md:justify-start gap-2 pt-0.5">
              <button
                onClick={startNewGame}
                className="flex items-center gap-2 px-4 py-2.5 sm:px-5 sm:py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs sm:text-base shadow-lg shadow-amber-500/20 active:scale-95 transition-all whitespace-nowrap cursor-pointer"
              >
                <Play className="w-4 h-4 sm:w-5 sm:h-5 fill-current" />
                নতুন অভিযান শুরু
              </button>

              {saveData && (
                <button
                  onClick={continueSavedGame}
                  className="flex items-center gap-1.5 px-3.5 py-2.5 sm:px-4 sm:py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs sm:text-base shadow-lg active:scale-95 transition-all whitespace-nowrap cursor-pointer"
                >
                  <RotateCcw className="w-4 h-4" />
                  চালিয়ে যাও (ধাপ {saveData.levelId})
                </button>
              )}

              <button
                onClick={() => {
                  sound.playClick();
                  setShowLevelSelect((v) => !v);
                }}
                className="px-3.5 py-2.5 sm:px-4 sm:py-3 rounded-xl bg-slate-800/85 hover:bg-slate-700 text-slate-100 font-semibold text-xs sm:text-sm border border-slate-700 active:scale-95 transition-all whitespace-nowrap cursor-pointer"
              >
                ধাপসমূহ (১–৭)
              </button>

              <button
                onClick={toggleMute}
                aria-label="শব্দ"
                className="p-2.5 sm:p-3 rounded-xl bg-slate-800/85 hover:bg-slate-700 text-slate-200 border border-slate-700 active:scale-95 transition-all cursor-pointer"
              >
                {muted ? <VolumeX className="w-4 h-4 sm:w-5 sm:h-5" /> : <Volume2 className="w-4 h-4 sm:w-5 sm:h-5" />}
              </button>
            </div>

            {showLevelSelect && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 sm:gap-2 pt-1 max-w-xl mx-auto landscape:mx-0 md:mx-0">
                {LEVELS.map((lvl) => {
                  const unlocked = lvl.id <= unlockedMax || lvl.id === 1;
                  return (
                    <button
                      key={lvl.id}
                      onClick={() => {
                        sound.playClick();
                        loadLevel(lvl.id);
                      }}
                      className={`text-left px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-lg border text-[11px] sm:text-xs transition-all cursor-pointer ${
                        unlocked
                          ? 'bg-slate-900/90 border-amber-500/40 hover:border-amber-400 text-slate-100'
                          : 'bg-slate-900/65 border-slate-800 hover:border-slate-600 text-slate-300'
                      }`}
                    >
                      <div className="font-bold text-amber-400">ধাপ {lvl.id}</div>
                      <div className="truncate">{lvl.titleBn.replace(/^ধাপ [১-৭]:\s*/, '')}</div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex flex-row landscape:flex-col md:flex-col items-center gap-2.5 bg-slate-900/75 border border-slate-700/70 rounded-2xl p-2.5 sm:p-3.5 backdrop-blur-sm shrink-0">
            {portraits.razonPortraitUrl ? (
              <img
                src={portraits.razonPortraitUrl}
                alt="Razon"
                referrerPolicy="no-referrer"
                className="w-14 h-16 landscape:w-20 landscape:h-22 md:w-32 md:h-36 object-cover rounded-xl border border-amber-500/40 shrink-0"
              />
            ) : (
              <div className="w-14 h-16 landscape:w-20 landscape:h-22 md:w-32 md:h-36 rounded-xl bg-slate-800 flex items-center justify-center text-slate-400 text-xs">
                রাজন
              </div>
            )}
            <div className="text-left landscape:text-center md:text-center">
              <div className="text-sm md:text-base font-bold text-white">রাজন</div>
              <div className="text-[11px] sm:text-xs text-slate-300">অভিযাত্রী · সেন্ট মার্টিন</div>
            </div>
          </div>
          </div>
        </div>
      )}

      {/* ==================== CINEMATIC INTRO ==================== */}
      {screen === 'INTRO' && (
        <div className="absolute inset-0 z-20 pointer-events-none flex flex-col justify-between px-[max(0.75rem,env(safe-area-inset-left))] pr-[max(0.75rem,env(safe-area-inset-right))] pt-[max(0.65rem,env(safe-area-inset-top))] pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <div className="flex flex-wrap items-center justify-between pointer-events-auto gap-2">
            <div className="flex items-center gap-1.5 bg-slate-950/65 px-2.5 py-1.5 rounded-lg border border-slate-800/80">
              {INTRO_SCENES.map((sc, idx) => (
                <span
                  key={sc.id}
                  className={`h-1.5 rounded-full transition-all ${
                    idx === introSceneIdx
                      ? 'w-5 bg-amber-400'
                      : idx < introSceneIdx
                      ? 'w-2 bg-emerald-400'
                      : 'w-2 bg-slate-600'
                  }`}
                />
              ))}
            </div>

            <div className="flex items-center gap-1.5 sm:gap-2">
              <button
                onClick={toggleMute}
                aria-label="শব্দ"
                className="p-2 rounded-lg bg-slate-950/75 hover:bg-slate-900 text-slate-200 border border-slate-700 cursor-pointer"
              >
                {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </button>
              <button
                onClick={skipIntroToLevel1}
                className="px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs sm:text-sm tracking-wide shadow-lg active:scale-95 transition-transform whitespace-nowrap cursor-pointer"
              >
                SKIP STORY · এড়িয়ে যান
              </button>
            </div>
          </div>

          <div className="mx-auto max-w-[94vw] sm:max-w-2xl text-center bg-slate-950/60 px-3.5 py-1.5 rounded-lg backdrop-blur-[2px]">
            <p className="text-xs sm:text-sm text-slate-100 drop-shadow leading-snug">
              {currentIntroScene.textBn}
            </p>
          </div>
        </div>
      )}

      {/* ==================== SATELLITE PHONE CONVERSATION ==================== */}
      {screen === 'PHONE_CALL' && (
        <div className="absolute inset-0 z-20 pointer-events-none flex flex-col justify-between pl-[max(0.65rem,env(safe-area-inset-left))] pr-[max(0.65rem,env(safe-area-inset-right))] pt-[max(0.55rem,env(safe-area-inset-top))] pb-[max(0.65rem,env(safe-area-inset-bottom))]">
          {/* Top Bar: Rugged Satellite Status + Skip / Mute */}
          <div className="flex flex-wrap items-center justify-between gap-1.5 sm:gap-2 pointer-events-auto">
            <div className="flex items-center gap-1.5 sm:gap-2 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-xl bg-slate-950/82 border border-slate-700/80 backdrop-blur-md text-[11px] sm:text-xs text-slate-100 max-w-full">
              <Radio
                className={`w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0 ${
                  phoneCallUi.phase === 'no_signal' || phoneCallUi.phase === 'disconnected'
                    ? 'text-rose-400 animate-pulse'
                    : currentPhoneLine.interference
                    ? 'text-amber-400 animate-pulse'
                    : 'text-cyan-400'
                }`}
              />
              <span className="font-bold tracking-wide truncate">
                {phoneCallUi.phase === 'no_signal'
                  ? 'NO SIGNAL'
                  : phoneCallUi.phase === 'disconnected'
                  ? 'SATELLITE CONNECTION LOST'
                  : phoneCallUi.phase === 'connecting'
                  ? 'CONNECTING...'
                  : currentPhoneLine.interference
                  ? 'WEAK SIGNAL'
                  : 'SAT-PHONE CONNECTED'}
              </span>
              <span className="flex items-end gap-0.5 h-3 px-0.5 shrink-0">
                {[1, 2, 3].map((bar) => (
                  <span
                    key={bar}
                    className={`w-1 rounded-xs transition-all ${
                      bar <= phoneCallUi.signalBars ? 'bg-cyan-400' : 'bg-slate-700'
                    }`}
                    style={{ height: `${bar * 3 + 3}px` }}
                  />
                ))}
              </span>
              <span className="flex items-center gap-0.5 text-[10px] sm:text-[11px] text-amber-300 tabular-nums shrink-0">
                <BatteryCharging className="w-3.5 h-3.5" />
                {phoneCallUi.battery}%
              </span>
            </div>

            <div className="flex items-center gap-1.5 shrink-0 ml-auto">
              <button
                onClick={toggleMute}
                aria-label="শব্দ"
                className="p-1.5 sm:p-2 rounded-lg bg-slate-950/80 hover:bg-slate-900 text-slate-200 border border-slate-700 cursor-pointer"
              >
                {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </button>
              <button
                onClick={() => {
                  sound.playClick();
                  finishPhoneCall();
                }}
                className="px-2.5 py-1.5 sm:px-3 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-[11px] sm:text-xs shadow-lg active:scale-95 transition-transform whitespace-nowrap cursor-pointer"
              >
                SKIP · এড়িয়ে যান
              </button>
            </div>
          </div>

          {/* Portrait: centered bottom card below Razon; Landscape: right-aligned card keeping Razon clear on left */}
          <div className="flex flex-col items-center landscape:items-end md:items-end justify-end gap-2">
            <div className="w-full max-w-md landscape:max-w-[54vw] md:max-w-md bg-slate-950/88 border border-slate-700/85 rounded-2xl p-2.5 sm:p-4 backdrop-blur-md shadow-2xl space-y-2">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  {phoneCallUi.phase === 'talking' ? (
                    <img
                      src={
                        currentPhoneLine.speaker === 'rasel'
                          ? portraits.raselPortraitUrl || portraits.razonPortraitUrl
                          : portraits.razonPortraitUrl
                      }
                      alt={currentPhoneLine.speakerNameBn}
                      referrerPolicy="no-referrer"
                      className={`w-11 h-12 sm:w-12 sm:h-14 rounded-xl object-cover border-2 shrink-0 ${
                        currentPhoneLine.speaker === 'rasel'
                          ? 'border-cyan-400/80'
                          : 'border-amber-400/80'
                      }`}
                    />
                  ) : (
                    <div className="w-11 h-12 sm:w-12 sm:h-14 rounded-xl bg-slate-900 border border-slate-700 flex items-center justify-center shrink-0">
                      {phoneCallUi.phase === 'disconnected' || phoneCallUi.phase === 'no_signal' ? (
                        <PhoneOff className="w-5 h-5 text-rose-400 animate-pulse" />
                      ) : (
                        <Phone className="w-5 h-5 text-cyan-400 animate-bounce" />
                      )}
                    </div>
                  )}

                  <div className="min-w-0">
                    <div className="text-xs sm:text-sm font-bold text-white truncate">
                      {phoneCallUi.phase === 'talking'
                        ? currentPhoneLine.speakerNameBn
                        : 'রাসেল ভাই (Satellite)'}
                    </div>
                    <div
                      className={`text-[11px] font-semibold ${
                        phoneCallUi.phase === 'no_signal' || phoneCallUi.phase === 'disconnected'
                          ? 'text-rose-400'
                          : phoneCallUi.phase === 'connecting'
                          ? 'text-amber-300'
                          : currentPhoneLine.interference
                          ? 'text-amber-300'
                          : 'text-emerald-400'
                      }`}
                    >
                      {phoneCallUi.phase === 'no_signal'
                        ? 'NO SIGNAL · নেটওয়ার্ক নেই'
                        : phoneCallUi.phase === 'connecting'
                        ? 'স্যাটেলাইট সংযোগ হচ্ছে...'
                        : phoneCallUi.phase === 'disconnected'
                        ? 'SATELLITE CONNECTION LOST'
                        : currentPhoneLine.speaker === 'rasel'
                        ? 'ফোন কলে কথা বলছেন...'
                        : 'রাজন কথা বলছে...'}
                    </div>
                  </div>
                </div>

                {/* Animated voice waveform bars */}
                {phoneCallUi.phase === 'talking' && (
                  <div className="flex items-center gap-0.5 h-6 px-2 rounded-lg bg-slate-900/90 border border-slate-800">
                    {[12, 20, 15, 22, 10].map((ht, i) => (
                      <span
                        key={i}
                        className={`w-1 rounded-full ${
                          currentPhoneLine.interference
                            ? 'bg-amber-400 animate-pulse'
                            : currentPhoneLine.speaker === 'rasel'
                            ? 'bg-cyan-400 animate-pulse'
                            : 'bg-emerald-400 animate-pulse'
                        }`}
                        style={{
                          height: `${ht}px`,
                          animationDelay: `${i * 95}ms`,
                        }}
                      />
                    ))}
                  </div>
                )}
              </div>

              <div className="bg-slate-900/85 border border-slate-800 rounded-xl px-3 py-2 text-xs sm:text-sm text-slate-100 leading-relaxed">
                {phoneCallUi.phase === 'no_signal' &&
                  'রাজন: ব্যাকপ্যাক থেকে স্যাটেলাইট ফোন বের করলাম... কিন্তু NO SIGNAL দেখাচ্ছে!'}
                {phoneCallUi.phase === 'connecting' &&
                  (phoneCallUi.callKind === 'call1'
                    ? 'ক্ষীণ স্যাটেলাইট সিগন্যাল পাওয়া গেছে! রাসেল ভাইকে কল ঢুকছে...'
                    : 'উঁচু জায়গায় সিগন্যাল ফিরেছে! রাসেল ভাইয়ের সাথে আবার সংযোগ হচ্ছে...')}
                {phoneCallUi.phase === 'talking' && currentPhoneLine.textBn}
                {phoneCallUi.phase === 'disconnected' &&
                  'SATELLITE CONNECTION LOST · উঁচু কোনো স্থানে উঠে আবার রাসেল ভাইয়ের সাথে যোগাযোগ করো!'}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================== PLAYABLE SURVIVAL HUD + RESPONSIVE TOUCH CONTROLS ==================== */}
      {(screen === 'PLAYING' || screen === 'PAUSED' || screen === 'GAME_OVER') && (
        <div className="absolute inset-0 z-20 pointer-events-none flex flex-col justify-between pl-[max(0.5rem,env(safe-area-inset-left))] pr-[max(0.5rem,env(safe-area-inset-right))] pt-[max(0.45rem,env(safe-area-inset-top))] pb-[max(0.55rem,env(safe-area-inset-bottom))]">
          {/* TOP HUD — Strictly fits Portrait & Landscape without horizontal overflow */}
          <div className="flex flex-col gap-1 min-w-0">
            <div className="flex items-start justify-between gap-1.5 min-w-0">
              <div className="pointer-events-auto flex items-center gap-1.5 sm:gap-2 bg-slate-950/78 border border-slate-800/80 rounded-xl p-1.5 backdrop-blur-sm min-w-0 shrink">
                {portraits.razonPortraitUrl && (
                  <img
                    src={portraits.razonPortraitUrl}
                    alt="রাজন"
                    referrerPolicy="no-referrer"
                    className="hidden min-[380px]:block w-8 h-9 sm:w-10 sm:h-11 rounded-lg object-cover border border-amber-500/40 shrink-0"
                  />
                )}
                <div className="grid grid-cols-2 gap-x-1.5 sm:gap-x-2 gap-y-0.5 sm:gap-y-1 text-[9px] sm:text-[10px] w-[112px] min-[390px]:w-[136px] sm:w-[160px]">
                  <StatBar icon={<Heart className="w-2.5 h-2.5 text-rose-400" />} label="স্বাস্থ্য" value={hud.health} barColor="bg-rose-500" />
                  <StatBar icon={<Utensils className="w-2.5 h-2.5 text-amber-400" />} label="ক্ষুধা" value={hud.hunger} barColor="bg-amber-500" />
                  <StatBar icon={<Droplets className="w-2.5 h-2.5 text-sky-400" />} label="তৃষ্ণা" value={hud.thirst} barColor="bg-sky-500" />
                  <StatBar icon={<Zap className="w-2.5 h-2.5 text-emerald-400" />} label="শক্তি" value={hud.stamina} barColor="bg-emerald-500" />
                </div>
              </div>

              {/* Inline Center Mission Bar on Landscape & Desktop (saves vertical canvas height!) */}
              <div className="hidden landscape:block lg:block flex-1 min-w-0 bg-slate-950/72 border border-slate-800/80 rounded-lg px-2.5 py-1 text-center backdrop-blur-sm max-w-md mx-auto">
                <div className="text-[10px] sm:text-[11px] font-bold text-amber-400 truncate">{hud.levelTitleBn}</div>
                <div className="flex flex-wrap justify-center gap-x-2 text-[10px] sm:text-[11px] text-slate-200 tabular-nums leading-tight">
                  {hud.missions.map((m) => (
                    <span key={m.id} className={m.current >= m.target ? 'text-emerald-400 line-through' : ''}>
                      {m.labelBn} ({m.current}/{m.target})
                    </span>
                  ))}
                  {(hud.levelId === 4 || hud.levelId === 7 || hud.inventory.wood > 0 || hud.inventory.fronds > 0) && (
                    <span className="text-amber-200">
                      · কাঠ:{hud.inventory.wood} পাতা:{hud.inventory.fronds}
                    </span>
                  )}
                </div>
              </div>

              <div className="pointer-events-auto flex items-center gap-1 sm:gap-1.5 shrink-0">
                <button
                  onClick={consumeCoconut}
                  disabled={hud.inventory.coconuts <= 0}
                  title="ডাব খান"
                  className="flex items-center gap-0.5 sm:gap-1 px-1.5 sm:px-2 py-1.5 rounded-lg bg-slate-950/80 border border-slate-700 hover:border-lime-400 disabled:opacity-45 text-[11px] sm:text-xs font-semibold text-lime-300 cursor-pointer"
                >
                  <span>🥥</span>
                  <span className="tabular-nums">{hud.inventory.coconuts}</span>
                </button>
                <button
                  onClick={consumeWater}
                  disabled={hud.inventory.water <= 0}
                  title="পানি পান করুন"
                  className="flex items-center gap-0.5 sm:gap-1 px-1.5 sm:px-2 py-1.5 rounded-lg bg-slate-950/80 border border-slate-700 hover:border-sky-400 disabled:opacity-45 text-[11px] sm:text-xs font-semibold text-sky-300 cursor-pointer"
                >
                  <Droplets className="w-3.5 h-3.5" />
                  <span className="tabular-nums">{hud.inventory.water}</span>
                </button>
                <button
                  onClick={toggleMute}
                  aria-label="শব্দ"
                  className="p-1.5 sm:p-2 rounded-lg bg-slate-950/80 border border-slate-700 text-slate-200 cursor-pointer"
                >
                  {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                </button>
                <button
                  onClick={() => {
                    sound.playClick();
                    setScreen((s) => (s === 'PAUSED' ? 'PLAYING' : 'PAUSED'));
                  }}
                  aria-label="বিরতি"
                  className="p-1.5 sm:p-2 rounded-lg bg-slate-950/80 border border-slate-700 hover:border-amber-400 text-slate-100 cursor-pointer"
                >
                  <Pause className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Compact Stacked Mission Strip ONLY in Portrait */}
            <div className="landscape:hidden lg:hidden mx-auto bg-slate-950/70 border border-slate-800/80 rounded-lg px-2.5 py-0.5 text-center max-w-full">
              <div className="text-[10px] sm:text-[11px] font-bold text-amber-400 truncate">{hud.levelTitleBn}</div>
              <div className="flex flex-wrap justify-center gap-x-2 text-[10px] text-slate-200 tabular-nums leading-tight">
                {hud.missions.map((m) => (
                  <span key={m.id} className={m.current >= m.target ? 'text-emerald-400 line-through' : ''}>
                    {m.labelBn} ({m.current}/{m.target})
                  </span>
                ))}
                {(hud.levelId === 4 || hud.levelId === 7 || hud.inventory.wood > 0 || hud.inventory.fronds > 0) && (
                  <span className="text-amber-200">
                    কাঠ:{hud.inventory.wood} পাতা:{hud.inventory.fronds}
                  </span>
                )}
              </div>
            </div>

            {(hud.satelliteLost || (hud.levelId === 2 && hud.satelliteConnected)) && (
              <div className="mx-auto flex items-center gap-2 bg-slate-950/82 border border-slate-700/80 px-2.5 py-0.5 rounded-lg text-[10px] sm:text-xs shadow">
                {hud.satelliteLost ? (
                  <span className="flex items-center gap-1 text-rose-300 font-bold">
                    <PhoneOff className="w-3 h-3 text-rose-400 animate-pulse" />
                    SATELLITE CONNECTION LOST
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-cyan-300 font-bold">
                    <Radio className="w-3 h-3 text-cyan-400" />
                    SATELLITE CONNECTED
                  </span>
                )}
                <span className="flex items-center gap-0.5 text-amber-300 tabular-nums font-semibold">
                  <BatteryCharging className="w-3 h-3" />
                  {hud.phoneBattery}%
                </span>
              </div>
            )}

            {hud.levelCleared && (
              <div className="mx-auto bg-emerald-950/85 border border-emerald-400/50 text-emerald-200 px-3 py-1 rounded-lg text-xs font-bold shadow-lg">
                ধাপ {hud.levelId} সম্পন্ন! পরবর্তী ধাপে যাচ্ছে...
              </div>
            )}
          </div>

          {/* CLEAN TOUCH CONTROLS: ONLY Left / Down / Right + Catch (ধরো) + Jump / Climb / Swim */}
          <div className="flex items-end justify-between gap-2 px-0.5 sm:px-2">
            {/* Left Thumb: Left / Down / Right Pad */}
            <div className="pointer-events-auto touch-none shrink-0">
              <DirectionPad
                onChange={({ left, right, down }) => {
                  inputRef.current.left = left;
                  inputRef.current.right = right;
                  inputRef.current.crouch = down;
                  if (down) gameRef.current.dropThroughTimer = 0.24;
                }}
              />
            </div>

            {/* Right Thumb: ধরো (Catch) + লাফ / ওঠো / সাঁতার (Jump/Climb/Swim) */}
            <div className="pointer-events-auto flex items-end gap-2 sm:gap-3 touch-none shrink-0">
              <button
                onPointerDown={(e) => {
                  e.preventDefault();
                  inputRef.current.interactPressed = true;
                }}
                onClick={(e) => {
                  if (e.detail === 0) inputRef.current.interactPressed = true;
                }}
                className={`w-14 h-14 sm:w-16 sm:h-16 rounded-2xl border backdrop-blur-md flex flex-col items-center justify-center gap-0.5 font-bold text-[10px] sm:text-[11px] touch-none select-none transition-all active:scale-90 cursor-pointer shadow-lg ${
                  hud.nearPromptBn
                    ? 'bg-gradient-to-b from-amber-400 to-amber-600 border-amber-200 text-slate-950 shadow-amber-500/40 ring-2 ring-amber-300/60'
                    : 'bg-slate-950/55 border-white/18 text-slate-100 hover:border-white/35'
                }`}
              >
                <Hand className="w-5 h-5" />
                <span>ধরো</span>
              </button>

              <TouchJumpButton
                label={hud.onClimbable ? 'ওঠো' : hud.inWater ? 'সাঁতার' : 'লাফ'}
                inWater={hud.inWater}
                onJumpStateChange={triggerJump}
              />
            </div>
          </div>
        </div>
      )}

      {/* ==================== PAUSE MODAL ==================== */}
      {screen === 'PAUSED' && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-3 sm:p-4">
          <div className="w-full max-w-sm max-h-[90dvh] overflow-y-auto bg-slate-900 border border-slate-700 rounded-2xl p-5 sm:p-6 space-y-3.5 text-center shadow-2xl">
            <h2 className="text-xl sm:text-2xl font-bold text-amber-400">খেলা বিরতি</h2>
            <p className="text-xs text-slate-300">{hud.levelTitleBn}</p>
            <div className="space-y-2 pt-1">
              <button
                onClick={() => {
                  sound.playClick();
                  setScreen('PLAYING');
                }}
                className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm cursor-pointer"
              >
                খেলা চালিয়ে যাও
              </button>
              <button
                onClick={saveProgressNow}
                className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm flex items-center justify-center gap-2 cursor-pointer"
              >
                <Save className="w-4 h-4" />
                অগ্রগতি সংরক্ষণ করো
              </button>
              <button
                onClick={() => {
                  sound.playClick();
                  loadLevel(hud.levelId);
                }}
                className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 font-semibold text-sm cursor-pointer"
              >
                এই ধাপ পুনরায় শুরু করো
              </button>
              <button
                onClick={() => {
                  sound.playClick();
                  voice.stop();
                  sound.stopAmbient();
                  setScreen('MENU');
                }}
                className="w-full py-2.5 rounded-xl bg-slate-800/70 hover:bg-slate-700 text-slate-300 font-medium text-sm cursor-pointer"
              >
                মূল মেনুতে ফিরুন
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== GAME OVER MODAL ==================== */}
      {screen === 'GAME_OVER' && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-slate-950/85 backdrop-blur-sm p-3 sm:p-4">
          <div className="w-full max-w-sm max-h-[90dvh] overflow-y-auto bg-slate-900 border border-rose-500/40 rounded-2xl p-5 sm:p-6 space-y-3.5 text-center shadow-2xl">
            <h2 className="text-xl sm:text-2xl font-bold text-rose-400">রাজন দুর্বল হয়ে পড়েছে!</h2>
            <p className="text-xs sm:text-sm text-slate-200">
              হাল ছেড়ো না। আবার চেষ্টা করে দ্বীপ থেকে বেরিয়ে আসার পথ খুঁজে নাও।
            </p>
            <div className="flex flex-col gap-2 pt-1">
              <button
                onClick={() => {
                  sound.playClick();
                  loadLevel(hud.levelId, {
                    health: 100,
                    hunger: 90,
                    thirst: 88,
                    stamina: 100,
                    inventory: {
                      ...hud.inventory,
                      coconuts: Math.max(1, hud.inventory.coconuts),
                      water: Math.max(1, hud.inventory.water),
                    },
                  });
                }}
                className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm cursor-pointer"
              >
                আবার চেষ্টা করো
              </button>
              <button
                onClick={() => {
                  sound.playClick();
                  voice.stop();
                  sound.stopAmbient();
                  setScreen('MENU');
                }}
                className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-sm cursor-pointer"
              >
                মূল মেনু
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== HELICOPTER RESCUE ENDING ==================== */}
      {screen === 'ENDING' && (
        <div className="absolute inset-0 z-20 pointer-events-none flex flex-col justify-between p-3 sm:p-6">
          <div className="flex justify-end pointer-events-auto">
            <button
              onClick={toggleMute}
              className="p-2 rounded-lg bg-slate-950/80 text-slate-200 border border-slate-700 cursor-pointer"
            >
              {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>
          </div>

          {endingStage === 'dialogue' && (
            <div className="mx-auto max-w-[92vw] sm:max-w-xl bg-slate-950/65 px-3.5 py-1.5 rounded-lg text-center">
              <p className="text-xs sm:text-sm text-slate-100">
                রাসেল ভাই: রাজন! অবশেষে তোমায় পেলাম ভাই! তাড়াতাড়ি হেলিকপ্টারে ওঠো!
              </p>
            </div>
          )}

          {endingStage === 'departing' && (
            <div className="mx-auto max-w-[92vw] bg-slate-950/65 px-3.5 py-1.5 rounded-lg text-center">
              <p className="text-xs sm:text-sm text-slate-100">
                রাসেল ভাই: সব ভয় শেষ। সেন্ট মার্টিন পেছনে ফেলে আমরা এখন বাড়ি ফিরছি!
              </p>
            </div>
          )}

          {endingStage === 'complete' && (
            <div className="pointer-events-auto m-auto max-w-md w-full max-h-[88dvh] overflow-y-auto bg-slate-950/88 border border-amber-400/70 rounded-3xl p-4 sm:p-6 text-center space-y-3 sm:space-y-4 shadow-[0_20px_70px_rgba(245,158,11,0.28)] backdrop-blur-md">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-400/40 text-amber-300 text-xs font-semibold">
                <Award className="w-4 h-4" />
                <span>সেন্ট মার্টিন উদ্ধার অভিযান সম্পন্ন</span>
              </div>

              <div className="flex items-center justify-center gap-4">
                {portraits.razonPortraitUrl && (
                  <div className="text-center">
                    <img
                      src={portraits.razonPortraitUrl}
                      alt="রাজন"
                      referrerPolicy="no-referrer"
                      className="w-14 h-16 sm:w-16 sm:h-18 rounded-2xl object-cover border-2 border-amber-400/75 shadow-lg"
                    />
                    <div className="text-[11px] text-amber-300 font-semibold mt-1">রাজন</div>
                  </div>
                )}
                {portraits.raselPortraitUrl && (
                  <div className="text-center">
                    <img
                      src={portraits.raselPortraitUrl}
                      alt="রাসেল ভাই"
                      referrerPolicy="no-referrer"
                      className="w-14 h-16 sm:w-16 sm:h-18 rounded-2xl object-cover border-2 border-sky-400/75 shadow-lg"
                    />
                    <div className="text-[11px] text-sky-300 font-semibold mt-1">রাসেল ভাই</div>
                  </div>
                )}
              </div>

              <div>
                <div className="font-display text-3xl sm:text-5xl text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-yellow-200 to-amber-400 leading-none drop-shadow">
                  MISSION COMPLETE
                </div>
                <p className="text-sm sm:text-base font-bold text-emerald-400 mt-1">
                  অভিযান সফল! রাজন নিরাপদে উদ্ধার হয়েছে।
                </p>
              </div>
              <p className="text-xs sm:text-sm text-slate-200 leading-relaxed">
                সেন্ট মার্টিনের উত্তাল সাগর, গভীর জঙ্গল আর পাথুরে উপকূল পেরিয়ে রাজন টিকে থেকেছে। রাসেল ভাইয়ের হেলিকপ্টারে সে আবার ফিরছে আপনজনদের কাছে।
              </p>
              <div className="flex flex-wrap items-center justify-center gap-2.5 pt-1">
                <button
                  onClick={() => {
                    sound.playClick();
                    voice.stop();
                    sound.stopAmbient();
                    setScreen('MENU');
                  }}
                  className="px-4 py-2 sm:px-5 sm:py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs sm:text-sm shadow-lg shadow-amber-500/25 cursor-pointer"
                >
                  মূল মেনুতে ফিরুন
                </button>
                <button
                  onClick={startNewGame}
                  className="px-4 py-2 sm:px-5 sm:py-2.5 rounded-xl bg-slate-800/90 hover:bg-slate-700 text-slate-100 border border-slate-600 font-semibold text-xs sm:text-sm cursor-pointer"
                >
                  আবার খেলুন
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function DirectionPad({
  onChange,
}: {
  onChange: (state: { left: boolean; right: boolean; down: boolean }) => void;
}) {
  const padRef = useRef<HTMLDivElement | null>(null);
  const pointerIdRef = useRef<number | null>(null);
  const [activeDir, setActiveDir] = useState<'none' | 'left' | 'down' | 'right'>('none');

  const resolvePoint = (clientX: number) => {
    const el = padRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const relX = (clientX - rect.left) / rect.width;
    if (relX < 0.35) {
      setActiveDir('left');
      onChange({ left: true, right: false, down: false });
    } else if (relX > 0.65) {
      setActiveDir('right');
      onChange({ left: false, right: true, down: false });
    } else {
      setActiveDir('down');
      onChange({ left: false, right: false, down: true });
    }
  };

  const reset = () => {
    pointerIdRef.current = null;
    setActiveDir('none');
    onChange({ left: false, right: false, down: false });
  };

  return (
    <div
      ref={padRef}
      onPointerDown={(e) => {
        e.preventDefault();
        pointerIdRef.current = e.pointerId;
        try {
          (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
        } catch {
          // Ignore pointer capture errors on synthetic events
        }
        resolvePoint(e.clientX);
      }}
      onPointerMove={(e) => {
        if (pointerIdRef.current === e.pointerId) {
          e.preventDefault();
          resolvePoint(e.clientX);
        }
      }}
      onPointerUp={(e) => {
        if (pointerIdRef.current === e.pointerId) {
          e.preventDefault();
          reset();
        }
      }}
      onPointerCancel={() => reset()}
      onLostPointerCapture={() => reset()}
      className="flex items-center gap-1 p-1.5 rounded-2xl bg-slate-950/48 border border-white/15 backdrop-blur-md shadow-[0_8px_28px_rgba(0,0,0,0.42)] touch-none select-none cursor-pointer"
    >
      <div
        className={`w-11 h-11 sm:w-14 sm:h-14 rounded-xl border flex items-center justify-center transition-all ${
          activeDir === 'left'
            ? 'bg-gradient-to-b from-amber-400 to-amber-600 border-amber-200 text-slate-950 scale-95 shadow-lg shadow-amber-500/35'
            : 'bg-slate-900/75 border-white/10 text-slate-200'
        }`}
      >
        <ChevronLeft className="w-6 h-6 sm:w-7 sm:h-7" />
      </div>
      <div
        className={`w-10 h-11 sm:w-12 sm:h-14 rounded-xl border flex items-center justify-center transition-all ${
          activeDir === 'down'
            ? 'bg-gradient-to-b from-amber-400 to-amber-600 border-amber-200 text-slate-950 scale-95 shadow-lg shadow-amber-500/35'
            : 'bg-slate-900/75 border-white/10 text-slate-300'
        }`}
      >
        <ChevronDown className="w-5 h-5 sm:w-6 sm:h-6" />
      </div>
      <div
        className={`w-11 h-11 sm:w-14 sm:h-14 rounded-xl border flex items-center justify-center transition-all ${
          activeDir === 'right'
            ? 'bg-gradient-to-b from-amber-400 to-amber-600 border-amber-200 text-slate-950 scale-95 shadow-lg shadow-amber-500/35'
            : 'bg-slate-900/75 border-white/10 text-slate-200'
        }`}
      >
        <ChevronRight className="w-6 h-6 sm:w-7 sm:h-7" />
      </div>
    </div>
  );
}

function TouchJumpButton({
  label,
  inWater,
  onJumpStateChange,
}: {
  label: string;
  inWater: boolean;
  onJumpStateChange: (hold: boolean) => void;
}) {
  const [pressed, setPressed] = useState(false);
  const pointerIdRef = useRef<number | null>(null);

  const release = () => {
    if (pointerIdRef.current !== null || pressed) {
      pointerIdRef.current = null;
      setPressed(false);
      onJumpStateChange(false);
    }
  };

  return (
    <button
      onPointerDown={(e) => {
        e.preventDefault();
        pointerIdRef.current = e.pointerId;
        try {
          (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
        } catch {
          // Ignore pointer capture errors on synthetic events
        }
        setPressed(true);
        onJumpStateChange(true);
      }}
      onPointerUp={(e) => {
        e.preventDefault();
        release();
      }}
      onPointerCancel={() => release()}
      onLostPointerCapture={() => release()}
      onClick={(e) => {
        if (e.detail === 0) {
          onJumpStateChange(true);
          setTimeout(() => onJumpStateChange(false), 120);
        }
      }}
      className={`relative w-16 h-16 sm:w-20 sm:h-20 rounded-full border-2 backdrop-blur-md flex flex-col items-center justify-center font-bold text-[10px] sm:text-xs touch-none select-none transition-all cursor-pointer shadow-[0_10px_30px_rgba(0,0,0,0.45)] ${
        pressed
          ? inWater
            ? 'bg-gradient-to-b from-sky-300 to-cyan-500 border-white text-slate-950 scale-90 shadow-sky-400/50'
            : 'bg-gradient-to-b from-emerald-300 to-emerald-500 border-white text-slate-950 scale-90 shadow-emerald-400/50'
          : inWater
          ? 'bg-gradient-to-b from-sky-500/80 to-cyan-700/85 border-sky-200/70 text-white'
          : 'bg-gradient-to-b from-emerald-500/80 to-emerald-700/85 border-emerald-200/70 text-white'
      }`}
    >
      <span className="absolute inset-1.5 rounded-full border border-white/25 pointer-events-none" />
      {inWater ? <Waves className="w-6 h-6 sm:w-7 sm:h-7" /> : <ArrowUp className="w-6 h-6 sm:w-7 sm:h-7" />}
      <span className="leading-none mt-0.5">{label}</span>
    </button>
  );
}

function StatBar({
  icon,
  label,
  value,
  barColor,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  barColor: string;
}) {
  return (
    <div className="space-y-0.5">
      <div className="flex items-center justify-between gap-1 text-slate-200">
        <span className="flex items-center gap-1 font-medium">
          {icon}
          <span>{label}</span>
        </span>
        <span className="tabular-nums text-[10px] text-slate-300">{value}%</span>
      </div>
      <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
        <div
          className={`h-full ${barColor} transition-[width] duration-150`}
          style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
        />
      </div>
    </div>
  );
}
