class SoundEngine {
  private ctx: AudioContext | null = null;
  private muted = false;
  private ducked = false;
  private ambientMode: 'ocean' | 'storm' | 'night' = 'ocean';
  private ambientGain: GainNode | null = null;
  private ambientSource: AudioBufferSourceNode | null = null;
  private ambientFilter: BiquadFilterNode | null = null;

  private ensureContext(): AudioContext | null {
    if (this.muted) return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return null;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  private getTargetAmbientGain(): number {
    if (this.muted) return 0;
    const base = this.ambientMode === 'storm' ? 0.085 : this.ambientMode === 'night' ? 0.035 : 0.05;
    return this.ducked ? base * 0.35 : base;
  }

  public setDucking(duck: boolean) {
    this.ducked = duck;
    if (this.ambientGain && this.ctx) {
      this.ambientGain.gain.setTargetAtTime(this.getTargetAmbientGain(), this.ctx.currentTime, 0.15);
    }
  }

  public setMuted(mute: boolean) {
    this.muted = mute;
    if (this.ambientGain && this.ctx) {
      this.ambientGain.gain.setTargetAtTime(this.getTargetAmbientGain(), this.ctx.currentTime, 0.15);
    }
  }

  public isMuted() {
    return this.muted;
  }

  public startAmbient(mode: 'ocean' | 'storm' | 'night') {
    this.ambientMode = mode;
    const ctx = this.ensureContext();
    if (!ctx) return;

    if (!this.ambientSource) {
      const bufferSize = ctx.sampleRate * 3;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      let lastOut = 0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        data[i] = (lastOut + 0.02 * white) / 1.02;
        lastOut = data[i];
        data[i] *= 2.5;
      }

      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.loop = true;

      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 340;

      const gain = ctx.createGain();
      gain.gain.value = this.getTargetAmbientGain();

      source.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      source.start();

      this.ambientSource = source;
      this.ambientFilter = filter;
      this.ambientGain = gain;
    }

    if (this.ambientFilter && this.ambientGain) {
      const freq = mode === 'storm' ? 780 : mode === 'night' ? 220 : 380;
      this.ambientFilter.frequency.setTargetAtTime(freq, ctx.currentTime, 0.4);
      this.ambientGain.gain.setTargetAtTime(this.getTargetAmbientGain(), ctx.currentTime, 0.4);
    }
  }

  public stopAmbient() {
    if (this.ambientGain && this.ctx) {
      this.ambientGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.2);
    }
  }

  public playTone(freq: number, duration = 0.12, type: OscillatorType = 'sine', volume = 0.12, slideTo?: number) {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (slideTo) {
      osc.frequency.exponentialRampToValueAtTime(slideTo, now + duration);
    }
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  public playClick() {
    this.playTone(520, 0.06, 'triangle', 0.08, 660);
  }

  public playJump() {
    this.playTone(210, 0.16, 'sine', 0.11, 410);
  }

  public playSplash() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const duration = 0.22;
    const buf = ctx.createBuffer(1, ctx.sampleRate * duration, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.07));
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 950;
    const gain = ctx.createGain();
    gain.gain.value = 0.14;
    src.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    src.start();
  }

  public playPickup() {
    this.playTone(540, 0.09, 'triangle', 0.11, 720);
    setTimeout(() => this.playTone(760, 0.14, 'triangle', 0.1, 980), 65);
  }

  public playBuild() {
    this.playTone(180, 0.09, 'square', 0.08, 120);
    setTimeout(() => this.playTone(260, 0.08, 'triangle', 0.09, 210), 110);
  }

  public playHurt() {
    this.playTone(170, 0.22, 'sawtooth', 0.11, 75);
  }

  public playThunder() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const duration = 1.1;
    const buf = ctx.createBuffer(1, ctx.sampleRate * duration, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.45));
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 180;
    const gain = ctx.createGain();
    gain.gain.value = 0.28;
    src.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    src.start();
  }

  public playMissionComplete() {
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((n, idx) => {
      setTimeout(() => this.playTone(n, 0.24, 'triangle', 0.12), idx * 110);
    });
  }

  public getContext(): AudioContext | null {
    return this.ensureContext();
  }

  public playHelicopterPulse() {
    this.playTone(68, 0.09, 'sawtooth', 0.06, 52);
  }

  public playPhoneVibrate() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    [0, 0.28].forEach((offset) => {
      const now = ctx.currentTime + offset;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(142, now);
      gain.gain.setValueAtTime(0.075, now);
      gain.gain.exponentialRampToValueAtTime(0.002, now + 0.18);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.2);
    });
  }

  public playSatelliteConnect() {
    // Realistic digital satellite chirp + classic ringback beep
    this.playTone(980, 0.08, 'sine', 0.08, 1340);
    setTimeout(() => this.playTone(1340, 0.11, 'sine', 0.09, 1720), 100);
    setTimeout(() => this.playTone(440, 0.42, 'sine', 0.07), 340);
    setTimeout(() => this.playTone(480, 0.42, 'sine', 0.07), 340);
  }

  public playSignalStatic(duration = 0.35, volume = 0.09) {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * duration), ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      const burst = Math.sin(i * 0.04) > -0.3 ? 1 : 0.25;
      data[i] = (Math.random() * 2 - 1) * burst;
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 1850;
    filter.Q.value = 1.4;
    const gain = ctx.createGain();
    gain.gain.value = volume;
    src.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    src.start();
  }

  public playCallDisconnect() {
    [0, 170, 340].forEach((delay) => {
      setTimeout(() => this.playTone(480, 0.12, 'square', 0.065), delay);
    });
  }
}

export const sound = new SoundEngine();
