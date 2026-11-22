// The stage spotlight: a beam + pool of light that follows your voice.
// mode: 'idle' | 'speaking' | 'freeze' | 'quiet'
export class Spotlight {
  constructor(canvas) {
    this.c = canvas;
    this.ctx = canvas.getContext('2d');
    this.level = 0;
    this.target = 0;
    this.mode = 'idle';
    this.warmth = 1;
    this.reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    this.frame = this.frame.bind(this);
    requestAnimationFrame(this.frame);
  }
  // db: dBFS from the mic; threshold: speech threshold
  feed(db, threshold, mode) {
    this.target = Math.max(0, Math.min(1, (db - threshold + 6) / 30));
    this.mode = mode;
  }
  frame(t) {
    if (!this.c.isConnected) return;
    const dpr = window.devicePixelRatio || 1;
    const w = this.c.clientWidth, h = this.c.clientHeight;
    if (this.c.width !== Math.round(w * dpr)) { this.c.width = Math.round(w * dpr); this.c.height = Math.round(h * dpr); }
    const x = this.ctx;
    x.setTransform(dpr, 0, 0, dpr, 0, 0);
    x.clearRect(0, 0, w, h);
    this.level += (this.target - this.level) * (this.reduced ? 1 : 0.18);
    const warmTarget = this.mode === 'freeze' ? 0 : this.mode === 'quiet' ? 0.45 : 1;
    this.warmth += (warmTarget - this.warmth) * 0.06;
    const lerp = (a, b, k) => Math.round(a + (b - a) * k);
    const col = [lerp(127, 242, this.warmth), lerp(209, 181, this.warmth), lerp(196, 68, this.warmth)];
    const rgba = a => `rgba(${col[0]},${col[1]},${col[2]},${a})`;
    const breathe = this.reduced ? 0 : Math.sin(t / 900) * 0.02;
    const cx = w / 2, cy = h * 0.62;
    const base = Math.min(w, h) * 0.42;
    const r = base * (0.72 + 0.38 * this.level + breathe);
    const glow = (this.mode === 'quiet' ? 0.18 : 0.3) + 0.35 * this.level;
    // beam from the rig above the stage
    const beam = x.createLinearGradient(cx, 0, cx, cy);
    beam.addColorStop(0, rgba(0));
    beam.addColorStop(1, rgba(0.10 + 0.12 * this.level));
    x.fillStyle = beam;
    x.beginPath();
    x.moveTo(cx - w * 0.05, 0);
    x.lineTo(cx + w * 0.05, 0);
    x.lineTo(cx + r, cy);
    x.lineTo(cx - r, cy);
    x.closePath();
    x.fill();
    // pool of light on the floor
    const pool = x.createRadialGradient(cx, cy, 0, cx, cy, r);
    pool.addColorStop(0, rgba(glow));
    pool.addColorStop(0.55, rgba(glow * 0.45));
    pool.addColorStop(1, rgba(0));
    x.fillStyle = pool;
    x.save();
    x.translate(cx, cy);
    x.scale(1, 0.42);
    x.beginPath();
    x.arc(0, 0, r * 1.35, 0, Math.PI * 2);
    x.restore();
    x.fill();
    requestAnimationFrame(this.frame);
  }
}
