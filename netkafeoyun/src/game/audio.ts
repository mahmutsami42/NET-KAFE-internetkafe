export class AudioSys {
  ctx: AudioContext | null = null;
  master!: GainNode; sfx!: GainNode; amb!: GainNode; mus!: GainNode;
  muted = false; musicOn = true; vol = 0.8;
  noise!: AudioBuffer;
  fanG!: GainNode; rainG!: GainNode; rainF!: BiquadFilterNode; hum!: GainNode; elevG!: GainNode; sizG!: GainNode; busG!: GainNode;
  private musT = 0; private musStep = 0;

  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    try {
      const AC = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AC(); this.ctx = ctx;
      this.master = ctx.createGain(); this.master.connect(ctx.destination);
      this.sfx = ctx.createGain(); this.sfx.connect(this.master);
      this.amb = ctx.createGain(); this.amb.connect(this.master);
      this.mus = ctx.createGain(); this.mus.gain.value = 0.12; this.mus.connect(this.master);
      const len = ctx.sampleRate * 2; this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = this.noise.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      const loop = (f: number, type: BiquadFilterType, q = 0.7) => {
        const s = ctx.createBufferSource(); s.buffer = this.noise; s.loop = true;
        const fl = ctx.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q;
        const g = ctx.createGain(); g.gain.value = 0; s.connect(fl); fl.connect(g); g.connect(this.amb); s.start(); return { g, fl };
      };
      const fan = loop(380, 'bandpass', 0.6); this.fanG = fan.g;
      const rain = loop(5200, 'highpass', 0.4); this.rainG = rain.g; this.rainF = rain.fl;
      const siz = loop(3000, 'bandpass', 0.5); this.sizG = siz.g;
      const bus = loop(160, 'lowpass', 0.5); this.busG = bus.g;
      const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 58; const og = ctx.createGain(); og.gain.value = 0;
      const of = ctx.createBiquadFilter(); of.type = 'lowpass'; of.frequency.value = 180; o.connect(of); of.connect(og); og.connect(this.amb); o.start(); this.hum = og;
      const e = ctx.createOscillator(); e.type = 'triangle'; e.frequency.value = 74; const eg = ctx.createGain(); eg.gain.value = 0; e.connect(eg); eg.connect(this.amb); e.start(); this.elevG = eg;
      this.apply();
    } catch { this.ctx = null; }
  }
  apply() { if (!this.ctx) return; this.master.gain.value = this.muted ? 0 : this.vol; this.mus.gain.value = this.musicOn ? 0.1 : 0; }
  setMuted(m: boolean) { this.muted = m; this.apply(); }
  setMusic(m: boolean) { this.musicOn = m; this.apply(); }
  setVol(v: number) { this.vol = v; this.apply(); }

  ambient(dt: number, p: { pcs: number; rain: number; outdoors: number; elevMove: number; cook: number; traffic: number; power: number }) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.fanG.gain.setTargetAtTime(Math.min(0.12, 0.012 + p.pcs * 0.006) * p.power * (1 - p.outdoors * 0.7), t, 0.4);
    this.hum.gain.setTargetAtTime(0.015 * p.power * (1 - p.outdoors * 0.8), t, 0.5);
    this.rainG.gain.setTargetAtTime(p.rain * (0.05 + p.outdoors * 0.1), t, 0.6);
    this.rainF.frequency.setTargetAtTime(p.outdoors > 0.5 ? 5200 : 2400, t, 0.3);
    this.elevG.gain.setTargetAtTime(p.elevMove * 0.04, t, 0.2);
    this.sizG.gain.setTargetAtTime(p.cook * 0.05, t, 0.15);
    this.busG.gain.setTargetAtTime(p.outdoors * p.traffic * 0.08, t, 0.5);
    if (this.musicOn && !this.muted) { this.musT -= dt; if (this.musT <= 0) { this.musT = 0.55; this.musicNote(); } }
  }
  private musicNote() {
    const ctx = this.ctx!; const chords = [[220, 261.6, 329.6, 392], [174.6, 220, 261.6, 329.6], [196, 246.9, 293.7, 392], [164.8, 196, 246.9, 329.6]];
    const ch = chords[Math.floor(this.musStep / 8) % 4]; const i = this.musStep % 8; this.musStep++;
    const f = ch[[0, 2, 1, 3, 2, 1, 3, 2][i]] * (i === 0 ? 0.5 : 1);
    const o = ctx.createOscillator(); o.type = i === 0 ? 'sine' : 'triangle'; o.frequency.value = f;
    const g = ctx.createGain(); const t = ctx.currentTime; g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(i === 0 ? 0.6 : 0.28, t + 0.04); g.gain.exponentialRampToValueAtTime(0.001, t + (i === 0 ? 1.6 : 0.8));
    o.connect(g); g.connect(this.mus); o.start(t); o.stop(t + 1.7);
  }
  tone(f: number, dur = 0.15, type: OscillatorType = 'sine', v = 0.3, slide = 0, delay = 0) {
    if (!this.ctx || this.muted) return; const ctx = this.ctx; const t = ctx.currentTime + delay;
    const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, t); if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, f + slide), t + dur);
    const g = ctx.createGain(); g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    o.connect(g); g.connect(this.sfx); o.start(t); o.stop(t + dur + 0.02);
  }
  burst(dur = 0.06, v = 0.2, f = 2000, q = 1, type: BiquadFilterType = 'bandpass', delay = 0) {
    if (!this.ctx || this.muted) return; const ctx = this.ctx; const t = ctx.currentTime + delay;
    const s = ctx.createBufferSource(); s.buffer = this.noise; s.playbackRate.value = 0.8 + Math.random() * 0.5;
    const fl = ctx.createBiquadFilter(); fl.type = type; fl.frequency.value = f * (0.85 + Math.random() * 0.3); fl.Q.value = q;
    const g = ctx.createGain(); g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    s.connect(fl); fl.connect(g); g.connect(this.sfx); s.start(t, Math.random()); s.stop(t + dur + 0.02);
  }
  click() { this.tone(900, 0.05, 'square', 0.08); }
  key(v = 1) { this.burst(0.025, 0.07 * v, 3200 + Math.random() * 1500, 2, 'bandpass'); }
  step(v = 1) { this.burst(0.07, 0.1 * v, 260 + Math.random() * 120, 1, 'lowpass'); }
  cash() { this.tone(1320, 0.12, 'square', 0.12); this.tone(1760, 0.3, 'square', 0.1, 0, 0.1); this.burst(0.08, 0.1, 5000, 1, 'highpass', 0.05); }
  ding() { this.tone(1046, 0.5, 'sine', 0.2); this.tone(1568, 0.6, 'sine', 0.12, 0, 0.08); }
  elevDing() { this.tone(880, 0.7, 'sine', 0.18); this.tone(660, 0.9, 'sine', 0.14, 0, 0.25); }
  pop() { this.tone(520, 0.08, 'sine', 0.18, 300); }
  good() { this.tone(523, 0.12, 'triangle', 0.18); this.tone(659, 0.12, 'triangle', 0.18, 0, 0.1); this.tone(784, 0.25, 'triangle', 0.18, 0, 0.2); }
  bad() { this.tone(240, 0.3, 'sawtooth', 0.15, -90); }
  alarm() { for (let i = 0; i < 4; i++) { this.tone(900, 0.18, 'square', 0.12, 0, i * 0.28); this.tone(620, 0.18, 'square', 0.12, 0, i * 0.28 + 0.14); } }
  honk() { this.tone(330, 0.3, 'square', 0.07); this.tone(415, 0.3, 'square', 0.06); }
  buzz(v = 1) { this.tone(110, 0.25, 'sawtooth', 0.07 * v, -20); this.burst(0.2, 0.05 * v, 1200, 3); }
  thunder() { this.burst(1.8, 0.35, 120, 0.5, 'lowpass'); this.burst(1.2, 0.2, 90, 0.5, 'lowpass', 0.4); }
  mumble(v = 1) {
    if (!this.ctx || this.muted) return; const ctx = this.ctx; const t = ctx.currentTime; const base = 90 + Math.random() * 120;
    for (let i = 0; i < 3; i++) {
      const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = base * (1 + Math.random() * 0.2);
      const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 500 + Math.random() * 900; f.Q.value = 4;
      const g = ctx.createGain(); const s = t + i * 0.13; g.gain.setValueAtTime(0, s); g.gain.linearRampToValueAtTime(0.045 * v, s + 0.03); g.gain.linearRampToValueAtTime(0, s + 0.11);
      o.connect(f); f.connect(g); g.connect(this.sfx); o.start(s); o.stop(s + 0.13);
    }
  }
  cheer(v = 1) { this.burst(1.2, 0.18 * v, 1500, 0.6, 'bandpass'); this.burst(0.9, 0.1 * v, 700, 0.8, 'bandpass', 0.1); }
  clap(v = 1) { for (let i = 0; i < 8; i++) this.burst(0.05, 0.06 * v, 2500, 0.8, 'bandpass', i * 0.07 + Math.random() * 0.05); }
  shutter() { this.burst(1.4, 0.18, 900, 2, 'bandpass'); this.burst(1.4, 0.1, 400, 2, 'bandpass', 0.1); }
  door() { this.tone(300, 0.2, 'sine', 0.06, 200); this.burst(0.3, 0.05, 800, 0.8, 'lowpass'); }
  sweep() { this.burst(0.25, 0.08, 1800, 0.7, 'highpass'); }
  clink() { this.tone(2400 + Math.random() * 500, 0.1, 'sine', 0.07); }
  wrench() { this.burst(0.05, 0.12, 1200, 4); this.tone(1800, 0.05, 'square', 0.05); }
}
