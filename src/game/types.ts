export type GameScreen = 'MENU' | 'INTRO' | 'PHONE_CALL' | 'PLAYING' | 'PAUSED' | 'GAME_OVER' | 'ENDING';

export type VoiceEmotion = 'funny' | 'suspense' | 'fear' | 'surprise' | 'normal';

export type PlayerPose =
  | 'idle'
  | 'walk'
  | 'run'
  | 'jump'
  | 'crouch'
  | 'swim'
  | 'climb'
  | 'interact';

export interface PlayerState {
  x: number;
  y: number;
  vx: number;
  vy: number;
  width: number;
  height: number;
  facing: 1 | -1;
  pose: PlayerPose;
  animTime: number;
  onGround: boolean;
  inWater: boolean;
  onClimbable: boolean;
  crouching: boolean;
  coyoteTimer: number;
  jumpBufferTimer: number;
  jumpsRemaining: number;
  interactingTimer: number;
  invulnTimer: number;
  health: number; // 0..100
  hunger: number; // 0..100
  thirst: number; // 0..100
  stamina: number; // 0..100
}

export interface Inventory {
  coconuts: number;
  water: number;
  wood: number;
  fronds: number;
  flareKit: boolean;
}

export type BiomeType =
  | 'beach'
  | 'grove'
  | 'spring'
  | 'camp'
  | 'jungle'
  | 'rocky'
  | 'night';

export interface Platform {
  x: number;
  y: number; // top surface Y relative to baseline groundY (0 = ground level, negative = elevated)
  w: number;
  h: number;
  kind: 'sand' | 'coral' | 'wood' | 'moss' | 'cliff' | 'branch';
  passThrough?: boolean;
}

export interface WaterZone {
  x: number;
  w: number;
  depth: number;
  salty?: boolean;
}

export interface ClimbZone {
  x: number;
  w: number;
  topY: number; // relative to groundY (negative = up)
  bottomY: number; // relative to groundY (0 = ground)
  kind: 'vine' | 'ladder' | 'rope';
}

export type WorldItemKind =
  | 'coconut'
  | 'water_bottle'
  | 'fresh_spring'
  | 'wood'
  | 'frond'
  | 'flare_crate'
  | 'safe_spot'
  | 'reconnect_spot'
  | 'shelter_site'
  | 'signal_beacon'
  | 'crab'
  | 'thorns'
  | 'sharp_coral';

export interface WorldObject {
  id: string;
  kind: WorldItemKind;
  x: number;
  y: number; // offset above groundY (negative = up)
  w: number;
  h: number;
  collected?: boolean;
  activated?: boolean;
  progress?: number; // 0..1 for building/lighting
  patrolMinX?: number;
  patrolMaxX?: number;
  vx?: number;
  labelBn: string;
  subtitleBn?: string;
}

export interface MissionStep {
  id: string;
  labelBn: string;
  target: number;
  current: number;
  kind:
    | 'reach'
    | 'collect_coconut'
    | 'collect_water'
    | 'collect_wood'
    | 'collect_frond'
    | 'build_shelter'
    | 'collect_flare'
    | 'reconnect_call'
    | 'light_signal';
}

export interface LevelConfig {
  id: number;
  titleBn: string;
  subtitleBn: string;
  biome: BiomeType;
  worldWidth: number;
  startX: number;
  storyIntroBn?: string;
  storyIntroEmotion?: VoiceEmotion;
  introLineBn: string;
  introEmotion?: VoiceEmotion;
  storyBeatBn?: string;
  storyBeatEmotion?: VoiceEmotion;
  completeLineBn: string;
  completeEmotion?: VoiceEmotion;
  platforms: Platform[];
  waterZones: WaterZone[];
  climbZones?: ClimbZone[];
  objects: WorldObject[];
  missions: Omit<MissionStep, 'current'>[];
  checkpointX: number;
}

export interface SubtitleState {
  speaker: 'narrator' | 'razon' | 'rasel';
  speakerNameBn: string;
  textBn: string;
  expiresAt: number;
}

export interface FloatingText {
  id: number;
  x: number;
  y: number;
  text: string;
  color: string;
  life: number;
  maxLife: number;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  alpha: number;
  life: number;
  maxLife: number;
}

export interface InputState {
  left: boolean;
  right: boolean;
  run: boolean;
  crouch: boolean;
  upHold: boolean;
  jumpPressed: boolean;
  swimPressed: boolean;
  interactPressed: boolean;
}

export interface SaveData {
  levelId: number;
  unlockedLevel: number;
  health: number;
  hunger: number;
  thirst: number;
  stamina: number;
  inventory: Inventory;
  satelliteLost?: boolean;
  phoneBattery?: number;
  savedAt: number;
}

export interface HudSnapshot {
  levelId: number;
  levelTitleBn: string;
  health: number;
  hunger: number;
  thirst: number;
  stamina: number;
  inventory: Inventory;
  missions: MissionStep[];
  nearPromptBn: string | null;
  inWater: boolean;
  onClimbable: boolean;
  satelliteLost: boolean;
  satelliteConnected: boolean;
  phoneBattery: number;
  subtitle: SubtitleState | null;
  levelCleared: boolean;
  score: number;
}
