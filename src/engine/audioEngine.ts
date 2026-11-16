export class SylhetAudioEngine {
  private ctx: AudioContext | null = null;
  private engineOsc: OscillatorNode | null = null;
  private engineSubOsc: OscillatorNode | null = null;
  private engineGain: GainNode | null = null;
  private rainGain: GainNode | null = null;
  private muted = false;
  private initialized = false;
  private rainEnabled = false;

  public unlock(): void {
    if (this.initialized) {
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
      return;
    }

    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();

      // Diesel engine oscillator chain
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 185;

      this.engineGain = this.ctx.createGain();
      this.engineGain.gain.value = 0.0;

      this.engineOsc = this.ctx.createOscillator();
      this.engineOsc.type = 'sawtooth';
      this.engineOsc.frequency.value = 46;

      this.engineSubOsc = this.ctx.createOscillator();
      this.engineSubOsc.type = 'triangle';
      this.engineSubOsc.frequency.value = 23;

      this.engineOsc.connect(filter);
      this.engineSubOsc.connect(filter);
      filter.connect(this.engineGain);
      this.engineGain.connect(this.ctx.destination);

      this.engineOsc.start();
      this.engineSubOsc.start();

      // Filtered white noise for Sylhet Monsoon Rain
      const bufferSize = this.ctx.sampleRate * 2;
      const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
      }
      const whiteNoise = this.ctx.createBufferSource();
      whiteNoise.buffer = noiseBuffer;
      whiteNoise.loop = true;

      const rainFilter = this.ctx.createBiquadFilter();
      rainFilter.type = 'bandpass';
      rainFilter.frequency.value = 1100;
      rainFilter.Q.value = 0.7;

      this.rainGain = this.ctx.createGain();
      this.rainGain.gain.value = 0;

      whiteNoise.connect(rainFilter);
      rainFilter.connect(this.rainGain);
      this.rainGain.connect(this.ctx.destination);
      whiteNoise.start();

      this.initialized = true;
      this.updateRainGain();
    } catch {
      // Ignore if browser blocks WebAudio
    }
  }

  public setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.engineGain && this.ctx) {
      this.engineGain.gain.setTargetAtTime(muted ? 0 : 0.05, this.ctx.currentTime, 0.08);
    }
    this.updateRainGain();
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public setRain(active: boolean): void {
    this.rainEnabled = active;
    this.updateRainGain();
  }

  private updateRainGain(): void {
    if (!this.ctx || !this.rainGain) return;
    const target = !this.muted && this.rainEnabled ? 0.045 : 0;
    this.rainGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.25);
  }

  public updateEngine(speedKmh: number, throttle: number): void {
    if (!this.ctx || !this.engineOsc || !this.engineSubOsc || !this.engineGain) return;
    if (this.muted) {
      this.engineGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.05);
      return;
    }

    // Simulate 4-speed BRTC Double-Decker gearbox cadence
    const absSpeed = Math.abs(speedKmh);
    const gearRatio = (absSpeed % 19) / 19;
    const baseFreq = 38 + gearRatio * 34 + Math.min(absSpeed * 0.35, 22) + (throttle > 0 ? 7 : 0);

    this.engineOsc.frequency.setTargetAtTime(baseFreq, this.ctx.currentTime, 0.07);
    this.engineSubOsc.frequency.setTargetAtTime(baseFreq * 0.5, this.ctx.currentTime, 0.07);

    const targetGain = 0.038 + Math.min(absSpeed / 65, 1) * 0.032 + (throttle > 0 ? 0.018 : 0);
    this.engineGain.gain.setTargetAtTime(targetGain, this.ctx.currentTime, 0.08);
  }

  /** Authentic Dual-Trumpet BRTC Hydraulic Air Horn */
  public playBusHorn(): void {
    this.unlock();
    if (!this.ctx || this.muted) return;

    const now = this.ctx.currentTime;
    const freqs = [233, 293.66, 349.23]; // Rich resonant Bangladeshi bus chord
    freqs.forEach((f, idx) => {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const filter = this.ctx.createBiquadFilter();

      osc.type = idx === 0 ? 'sawtooth' : 'square';
      osc.frequency.setValueAtTime(f * 0.97, now);
      osc.frequency.exponentialRampToValueAtTime(f, now + 0.05);

      filter.type = 'lowpass';
      filter.frequency.value = 1300;

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.075 / freqs.length, now + 0.03);
      gain.gain.setValueAtTime(0.075 / freqs.length, now + 0.32);
      gain.gain.exponentialRampToValueAtTime(0.0008, now + 0.48);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.5);
    });
  }

  /** Traditional Sylheti Rickshaw "Tun-Tun!" Bell */
  public playRickshawBell(): void {
    if (!this.ctx || this.muted) return;
    const now = this.ctx.currentTime;

    [0, 0.13].forEach((offset, idx) => {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(idx === 0 ? 2280 : 2640, now + offset);

      gain.gain.setValueAtTime(0.055, now + offset);
      gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.16);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now + offset);
      osc.stop(now + offset + 0.18);
    });
  }

  /** Pneumatic Bus Door Open/Close Hiss */
  public playDoorPneumatic(opening: boolean): void {
    this.unlock();
    if (!this.ctx || this.muted) return;

    const now = this.ctx.currentTime;
    const bufferSize = Math.floor(this.ctx.sampleRate * 0.35);
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.45));
    }

    const src = this.ctx.createBufferSource();
    src.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = opening ? 2400 : 1700;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.11, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.34);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);
    src.start(now);
  }

  /** Crisp 5 Tk Student Fare Coin Chime */
  public playFareChime(comboIndex = 0): void {
    if (!this.ctx || this.muted) return;
    const now = this.ctx.currentTime;

    const pitchBoost = Math.min(comboIndex * 18, 220);
    const notes = [880 + pitchBoost, 1318.5 + pitchBoost];
    notes.forEach((freq, i) => {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + i * 0.055);

      gain.gain.setValueAtTime(0.075, now + i * 0.055);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.055 + 0.18);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now + i * 0.055);
      osc.stop(now + i * 0.055 + 0.2);
    });
  }

  /** Gentle bump feedback */
  public playBump(): void {
    if (!this.ctx || this.muted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(125, now);
    osc.frequency.exponentialRampToValueAtTime(42, now + 0.22);

    gain.gain.setValueAtTime(0.16, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.25);
  }

  /** Route Complete Fanfare */
  public playRouteComplete(): void {
    if (!this.ctx || this.muted) return;
    const now = this.ctx.currentTime;
    const chord = [523.25, 659.25, 783.99, 1046.5];
    chord.forEach((freq, i) => {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + i * 0.09);
      gain.gain.setValueAtTime(0.09, now + i * 0.09);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.09 + 0.55);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now + i * 0.09);
      osc.stop(now + i * 0.09 + 0.58);
    });
  }
}
