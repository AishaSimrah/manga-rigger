const W = 720;
const H = 900;
const MARGIN = 30;
const BLINK_DURATION = 0.16; // seconds
const GUIDE_COLORS = { left_eye: "#e63946", right_eye: "#f4a261", mouth: "#2a9d8f" };

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const rand = (a, b) => Math.min(a, b) + Math.random() * Math.abs(b - a);

export class RigAnimator {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    canvas.width = W;
    canvas.height = H;

    this.img = null;
    this.rig = null;
    this.layout = null;
    this.off = null;           // offscreen copy of the image, used to sample colors
    this.colors = {};
    this.mode = "rig";         // "rig" | "preview"
    this.selected = null;
    this.draft = null;         // box currently being dragged
    this.bg = "#f4f4f4";
    this.getLevel = () => 0;   // replaced by main.js with the audio analyzer
    this.mouthOpen = 0;
    this.blinkStart = -1;
    this.nextBlink = 2;
    this.t = 0;
    this.t0 = performance.now();

    this._loop = this._loop.bind(this);
    requestAnimationFrame(this._loop);
  }

  setCharacter(img, rig) {
    this.img = img;
    const iw = img.naturalWidth;
    const ih = img.naturalHeight;
    const scale = Math.min((W - 2 * MARGIN) / iw, (H - 2 * MARGIN) / ih);
    this.layout = {
      dw: iw * scale,
      dh: ih * scale,
      dx: (W - iw * scale) / 2,
      dy: H - MARGIN - ih * scale, // feet sit at the bottom
    };
    const off = document.createElement("canvas");
    off.width = iw;
    off.height = ih;
    this.offCtx = off.getContext("2d", { willReadFrequently: true });
    this.offCtx.drawImage(img, 0, 0);
    this.off = off;
    this.setRig(rig);
    this.setMode(this.mode);
  }

  clear() {
    this.img = null;
    this.rig = null;
    this.colors = {};
  }

  setRig(rig) {
    this.rig = rig; // kept by reference so slider changes apply live
    this.colors = {};
    for (const key of Object.keys(GUIDE_COLORS)) {
      if (rig[key]) this.colors[key] = this._sampleBorder(rig[key]);
    }
  }

  setMode(mode) {
    this.mode = mode;
    this.blinkStart = -1;
    this.nextBlink = this.t + 1;
    this.draft = null;
  }

  // Average color of the outer 2px ring of a box = the "skin" around the feature.
  _sampleBorder(box) {
    const iw = this.off.width;
    const ih = this.off.height;
    const x0 = Math.max(0, Math.floor((box.cx - box.w / 2) * iw));
    const y0 = Math.max(0, Math.floor((box.cy - box.h / 2) * ih));
    const x1 = Math.min(iw, Math.ceil((box.cx + box.w / 2) * iw));
    const y1 = Math.min(ih, Math.ceil((box.cy + box.h / 2) * ih));
    const w = x1 - x0;
    const h = y1 - y0;
    if (w < 3 || h < 3) return "#ffffff";
    const { data } = this.offCtx.getImageData(x0, y0, w, h);
    let r = 0, g = 0, b = 0, n = 0;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (!(x < 2 || y < 2 || x >= w - 2 || y >= h - 2)) continue;
        const i = (y * w + x) * 4;
        if (data[i + 3] < 128) continue;
        r += data[i]; g += data[i + 1]; b += data[i + 2]; n++;
      }
    }
    if (!n) return "#ffffff";
    return `rgb(${Math.round(r / n)},${Math.round(g / n)},${Math.round(b / n)})`;
  }

  _rect(box) {
    const L = this.layout;
    return {
      x: L.dx + (box.cx - box.w / 2) * L.dw,
      y: L.dy + (box.cy - box.h / 2) * L.dh,
      w: box.w * L.dw,
      h: box.h * L.dh,
    };
  }

  _loop(now) {
    this.t = (now - this.t0) / 1000;
    this._update();
    this._draw();
    requestAnimationFrame(this._loop);
  }

  _update() {
    if (!this.rig) return;
    const s = this.rig.settings;

    // Mouth follows audio loudness
    const target = clamp(this.getLevel() * s.mouth_sensitivity, 0, 1);
    this.mouthOpen += (target - this.mouthOpen) * 0.5;

    // Blink scheduler
    if (this.mode === "preview") {
      if (this.blinkStart < 0 && this.t >= this.nextBlink) this.blinkStart = this.t;
      if (this.blinkStart >= 0 && this.t - this.blinkStart > BLINK_DURATION) {
        this.blinkStart = -1;
        this.nextBlink = this.t + rand(s.blink_min, s.blink_max);
      }
    }
  }

  _draw() {
    const ctx = this.ctx;
    ctx.fillStyle = this.bg;
    ctx.fillRect(0, 0, W, H);
    if (!this.img || !this.rig) return;

    const L = this.layout;
    const preview = this.mode === "preview";
    const s = this.rig.settings;

    let blink = 0;
    if (preview && this.blinkStart >= 0) {
      const p = clamp((this.t - this.blinkStart) / BLINK_DURATION, 0, 1);
      blink = Math.sin(Math.PI * p); // 0 -> 1 -> 0
    }

    ctx.save();
    if (preview) {
      // Breathing: scale up from the feet; overlays are drawn inside the same transform
      const breath = s.breath_amount * (0.5 + 0.5 * Math.sin(2 * Math.PI * s.breath_speed * this.t));
      const px = L.dx + L.dw / 2;
      const py = L.dy + L.dh;
      ctx.translate(px, py);
      ctx.scale(1 + breath * 0.4, 1 + breath);
      ctx.translate(-px, -py);
    }
    ctx.drawImage(this.img, L.dx, L.dy, L.dw, L.dh);
    if (preview) {
      this._drawEye(this.rig.left_eye, "left_eye", blink);
      this._drawEye(this.rig.right_eye, "right_eye", blink);
      this._drawMouth(this.rig.mouth);
    }
    ctx.restore();

    if (!preview) this._drawGuides();
  }

  _drawEye(box, key, blink) {
    if (!box || blink < 0.02) return;
    const ctx = this.ctx;
    const r = this._rect(box);
    const lidH = r.h * blink;
    ctx.fillStyle = this.colors[key] || "#ffffff";
    ctx.fillRect(r.x, r.y, r.w, lidH);
    ctx.strokeStyle = "#1a1a1a";
    ctx.lineWidth = Math.max(1.5, r.h * 0.08);
    ctx.beginPath();
    ctx.moveTo(r.x, r.y + lidH);
    ctx.quadraticCurveTo(r.x + r.w / 2, r.y + lidH + r.h * 0.15 * blink, r.x + r.w, r.y + lidH);
    ctx.stroke();
  }

  _drawMouth(box) {
    if (!box || this.mouthOpen < 0.08) return; // closed: original drawing shows
    const ctx = this.ctx;
    const r = this._rect(box);
    const o = this.mouthOpen;

    ctx.fillStyle = this.colors.mouth || "#ffffff"; // hide the original mouth
    ctx.fillRect(r.x, r.y, r.w, r.h);

    const cx = r.x + r.w / 2;
    const cy = r.y + r.h / 2;
    const rx = (r.w / 2) * (0.55 + 0.45 * o);
    const ry = Math.max(1.5, (r.h / 2) * o);
    ctx.fillStyle = "#2a0c0c";
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#b8545a"; // tongue
    ctx.beginPath();
    ctx.ellipse(cx, cy + ry * 0.45, rx * 0.6, ry * 0.45, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  _drawGuides() {
    const ctx = this.ctx;
    ctx.lineWidth = 2;
    for (const key of Object.keys(GUIDE_COLORS)) {
      const box = this.rig[key];
      if (!box) continue;
      const r = this._rect(box);
      ctx.strokeStyle = GUIDE_COLORS[key];
      ctx.setLineDash(key === this.selected ? [] : [6, 4]);
      ctx.strokeRect(r.x, r.y, r.w, r.h);
    }
    if (this.draft && this.selected) {
      const r = this._rect(this.draft);
      ctx.strokeStyle = GUIDE_COLORS[this.selected];
      ctx.setLineDash([2, 3]);
      ctx.strokeRect(r.x, r.y, r.w, r.h);
    }
    ctx.setLineDash([]);
  }
}