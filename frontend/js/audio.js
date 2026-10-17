export class AudioAnalyzer {
  constructor(audioEl) {
    this.el = audioEl;
    this.ctx = null;
    this.analyser = null;
    this.buf = null;
    this.streamDest = null;
    this.level = 0;
  }

  // createMediaElementSource may only be called once per <audio> element.
  init() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    this.ctx = new AC();
    const src = this.ctx.createMediaElementSource(this.el);
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 1024;
    this.buf = new Uint8Array(this.analyser.fftSize);
    this.streamDest = this.ctx.createMediaStreamDestination();
    src.connect(this.analyser);
    this.analyser.connect(this.ctx.destination); // speakers
    src.connect(this.streamDest);                // for recording
  }

  async resume() {
    this.init();
    if (this.ctx.state === "suspended") await this.ctx.resume();
  }

  // Smoothed loudness 0..1 (fast attack, slow release).
  getLevel() {
    if (!this.analyser || this.el.paused) {
      this.level *= 0.8;
      return this.level;
    }
    this.analyser.getByteTimeDomainData(this.buf);
    let sum = 0;
    for (let i = 0; i < this.buf.length; i++) {
      const v = (this.buf[i] - 128) / 128;
      sum += v * v;
    }
    const rms = Math.sqrt(sum / this.buf.length);
    const k = rms > this.level ? 0.6 : 0.2;
    this.level += (rms - this.level) * k;
    return this.level;
  }
}