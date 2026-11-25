import { sound } from './audio';
import { VoiceEmotion } from './types';
import { resolvePreGeneratedVoiceUrl } from './voiceManifest';

export type VoiceSpeaker = 'narrator' | 'razon' | 'rasel';

export interface SpeakOptions {
  emotion?: VoiceEmotion;
  phoneFilter?: boolean;
  interference?: boolean;
}

export interface QueuedVoiceItem {
  text: string;
  speaker: VoiceSpeaker;
  options?: SpeakOptions;
}

class BanglaVoiceEngine {
  private urlCache = new Map<string, string>();
  private bufferCache = new Map<string, ArrayBuffer>();
  private inFlight = new Map<string, Promise<string | null>>();
  private currentAudio: HTMLAudioElement | null = null;
  private currentBufferSource: AudioBufferSourceNode | null = null;
  private interferenceTimer: ReturnType<typeof setInterval> | null = null;
  private pendingQueue: QueuedVoiceItem[] = [];
  private playSeq = 0;
  private busy = false;
  private safetyTimer: ReturnType<typeof setTimeout> | null = null;
  private fallbackTimer: ReturnType<typeof setTimeout> | null = null;

  private key(text: string, speaker: VoiceSpeaker, emotion: VoiceEmotion) {
    return `${speaker}:${emotion}:${text}`;
  }

  public isSpeaking(): boolean {
    if (this.busy || this.pendingQueue.length > 0) return true;
    if (this.currentAudio && !this.currentAudio.ended && !this.currentAudio.paused) {
      return true;
    }
    return false;
  }

  private clearTimers() {
    if (this.safetyTimer) {
      clearTimeout(this.safetyTimer);
      this.safetyTimer = null;
    }
    if (this.fallbackTimer) {
      clearTimeout(this.fallbackTimer);
      this.fallbackTimer = null;
    }
    if (this.interferenceTimer) {
      clearInterval(this.interferenceTimer);
      this.interferenceTimer = null;
    }
  }

  private markDone(seq: number) {
    if (seq !== this.playSeq) return;
    this.busy = false;
    this.clearTimers();
    if (this.pendingQueue.length > 0 && !sound.isMuted()) {
      const next = this.pendingQueue.shift()!;
      void this.playSingle(next.text, next.speaker, next.options);
      return;
    }
    this.pendingQueue = [];
    sound.setDucking(false);
  }

  public async prefetch(
    text: string,
    speaker: VoiceSpeaker = 'narrator',
    emotion: VoiceEmotion = 'normal'
  ): Promise<string | null> {
    if (!text) return null;
    const assetUrl = resolvePreGeneratedVoiceUrl(text, speaker, emotion);
    if (!assetUrl) return null;

    const k = this.key(text, speaker, emotion);
    const cached = this.urlCache.get(k);
    if (cached) return cached;

    const existing = this.inFlight.get(k);
    if (existing) return existing;

    const promise = (async () => {
      try {
        const res = await fetch(assetUrl);
        if (!res.ok) return assetUrl;
        const arrayBuf = await res.arrayBuffer();
        if (arrayBuf.byteLength < 128) return assetUrl;

        this.bufferCache.set(k, arrayBuf);
        const blob = new Blob([arrayBuf], { type: 'audio/mpeg' });
        const blobUrl = URL.createObjectURL(blob);
        this.urlCache.set(k, blobUrl);
        return blobUrl;
      } catch {
        return assetUrl;
      } finally {
        this.inFlight.delete(k);
      }
    })();

    this.inFlight.set(k, promise);
    return promise;
  }

  private stopCurrentOnly() {
    this.playSeq += 1;
    this.busy = false;
    this.clearTimers();
    if (this.currentAudio) {
      this.currentAudio.onended = null;
      this.currentAudio.onerror = null;
      this.currentAudio.onloadedmetadata = null;
      this.currentAudio.pause();
      this.currentAudio.currentTime = 0;
      this.currentAudio = null;
    }
    if (this.currentBufferSource) {
      try {
        this.currentBufferSource.onended = null;
        this.currentBufferSource.stop();
        this.currentBufferSource.disconnect();
      } catch {
        // Ignore already stopped source
      }
      this.currentBufferSource = null;
    }
  }

  public stop() {
    this.pendingQueue = [];
    this.stopCurrentOnly();
    sound.setDucking(false);
  }

  private holdReadingTime(text: string, seq: number, options?: SpeakOptions) {
    if (seq !== this.playSeq) return;
    if (options?.interference) {
      this.startInterferenceEffects(seq);
    }
    if (this.fallbackTimer) clearTimeout(this.fallbackTimer);
    // Silent reading-time hold if browser blocks autoplay (never fall back to robotic TTS)
    const holdMs = Math.min(9500, Math.max(2400, text.length * 64));
    this.fallbackTimer = setTimeout(() => this.markDone(seq), holdMs);
  }

  private startInterferenceEffects(seq: number) {
    if (this.interferenceTimer) clearInterval(this.interferenceTimer);
    sound.playSignalStatic(0.18, 0.032);
    this.interferenceTimer = setInterval(() => {
      if (seq !== this.playSeq || !this.busy) {
        if (this.interferenceTimer) {
          clearInterval(this.interferenceTimer);
          this.interferenceTimer = null;
        }
        return;
      }
      if (Math.random() < 0.55) {
        sound.playSignalStatic(0.12 + Math.random() * 0.14, 0.025 + Math.random() * 0.02);
      }
    }, 1150);
  }

  private async playFilteredAudioBuffer(
    rawBuf: ArrayBuffer,
    seq: number,
    options?: SpeakOptions
  ): Promise<boolean> {
    const ctx = sound.getContext();
    if (!ctx) return false;

    try {
      if (ctx.state === 'suspended') {
        await ctx.resume().catch(() => {});
      }
      if (ctx.state !== 'running' || seq !== this.playSeq || sound.isMuted()) {
        return false;
      }

      const cloned = rawBuf.slice(0);
      const decoded = await ctx.decodeAudioData(cloned);
      if (seq !== this.playSeq || sound.isMuted() || ctx.state !== 'running') {
        return false;
      }

      if (this.safetyTimer) clearTimeout(this.safetyTimer);
      this.safetyTimer = setTimeout(
        () => this.markDone(seq),
        Math.max(22000, Math.ceil((decoded.duration + 4) * 1000))
      );

      const src = ctx.createBufferSource();
      src.buffer = decoded;
      this.currentBufferSource = src;

      let lastNode: AudioNode = src;
      if (options?.phoneFilter) {
        const hp = ctx.createBiquadFilter();
        hp.type = 'highpass';
        hp.frequency.value = 260;

        const lp = ctx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.value = 3800;

        const mid = ctx.createBiquadFilter();
        mid.type = 'peaking';
        mid.frequency.value = 1450;
        mid.Q.value = 0.9;
        mid.gain.value = 2.2;

        lastNode.connect(hp);
        hp.connect(lp);
        lp.connect(mid);
        lastNode = mid;
      }

      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -19;
      comp.ratio.value = 2.4;

      const gain = ctx.createGain();
      gain.gain.value = options?.phoneFilter ? 1.1 : 1.02;

      if (options?.interference) {
        const now = ctx.currentTime;
        for (let t = 0.65; t < decoded.duration - 0.35; t += 1.2) {
          gain.gain.setValueAtTime(0.62, now + t);
          gain.gain.setValueAtTime(1.32, now + t + 0.14);
        }
        this.startInterferenceEffects(seq);
      }

      lastNode.connect(comp);
      comp.connect(gain);
      gain.connect(ctx.destination);

      sound.setDucking(true);
      src.onended = () => {
        if (this.currentBufferSource === src) {
          this.currentBufferSource = null;
        }
        this.markDone(seq);
      };
      src.start();
      return true;
    } catch {
      return false;
    }
  }

  private async playSingle(
    text: string,
    speaker: VoiceSpeaker = 'narrator',
    options?: SpeakOptions
  ): Promise<void> {
    if (!text || sound.isMuted()) {
      this.stop();
      return;
    }
    const emotion: VoiceEmotion = options?.emotion ?? 'normal';
    this.stopCurrentOnly();
    const seq = this.playSeq;
    this.busy = true;
    this.clearTimers();
    this.safetyTimer = setTimeout(() => this.markDone(seq), 36000);

    const audioUrl = await this.prefetch(text, speaker, emotion);
    if (seq !== this.playSeq || sound.isMuted()) {
      this.markDone(seq);
      return;
    }

    const k = this.key(text, speaker, emotion);
    const rawBuf = this.bufferCache.get(k);
    if (rawBuf && (options?.phoneFilter || options?.interference)) {
      const played = await this.playFilteredAudioBuffer(rawBuf, seq, options);
      if (played) return;
      if (seq !== this.playSeq || sound.isMuted()) {
        this.markDone(seq);
        return;
      }
    }

    if (audioUrl) {
      const audio = new Audio(audioUrl);
      audio.volume = 1.0;
      this.currentAudio = audio;
      sound.setDucking(true);
      audio.onloadedmetadata = () => {
        if (seq === this.playSeq && Number.isFinite(audio.duration) && audio.duration > 0) {
          if (this.safetyTimer) clearTimeout(this.safetyTimer);
          this.safetyTimer = setTimeout(
            () => this.markDone(seq),
            Math.max(22000, Math.ceil((audio.duration + 4) * 1000))
          );
        }
      };
      audio.onended = () => {
        if (this.currentAudio === audio) {
          this.currentAudio = null;
        }
        this.markDone(seq);
      };
      audio.onerror = () => {
        if (this.currentAudio === audio) {
          this.currentAudio = null;
        }
        if (seq === this.playSeq) {
          this.holdReadingTime(text, seq, options);
        }
      };
      try {
        await audio.play();
        if (options?.interference) {
          this.startInterferenceEffects(seq);
        }
        return;
      } catch {
        if (this.currentAudio === audio) {
          this.currentAudio = null;
        }
      }
    }

    if (seq === this.playSeq) {
      this.holdReadingTime(text, seq, options);
    }
  }

  public async speak(
    text: string,
    speaker: VoiceSpeaker = 'narrator',
    options?: SpeakOptions
  ): Promise<void> {
    this.pendingQueue = [];
    await this.playSingle(text, speaker, options);
  }

  public async speakSequence(items: QueuedVoiceItem[]): Promise<void> {
    const valid = items.filter((item) => Boolean(item.text));
    if (valid.length === 0 || sound.isMuted()) {
      this.stop();
      return;
    }
    const [first, ...rest] = valid;
    this.pendingQueue = rest;
    for (const item of rest) {
      void this.prefetch(item.text, item.speaker, item.options?.emotion ?? 'normal');
    }
    await this.playSingle(first.text, first.speaker, first.options);
  }
}

export const voice = new BanglaVoiceEngine();
