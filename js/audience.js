// Virtual audience for graded public-speaking exposure (cf. Anderson et al. 2005; Wallach et al. 2009).
// The view is from the stage looking out at the room: the crowd watches you and reacts to your voice.
// Canvas 2D + generated WebAudio ambience. No assets, no dependencies.

export const AUDIENCE_LEVELS = [
  { id: 1, name: 'One friend', size: 1, room: 'cafe', mood: 'warm' },
  { id: 2, name: 'Team stand-up', size: 5, room: 'meeting', mood: 'neutral' },
  { id: 3, name: 'Classroom', size: 20, room: 'classroom', mood: 'neutral' },
  { id: 4, name: 'Conference room', size: 60, room: 'hall', mood: 'neutral' },
  { id: 5, name: 'Auditorium', size: 200, room: 'auditorium', mood: 'neutral' },
  { id: 6, name: 'Tough crowd', size: 200, room: 'auditorium', mood: 'tough' },
];

const TAU = Math.PI * 2;
const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const css = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
const rng = s => () => { s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const pick = (r, a) => a[Math.floor(r() * a.length)];
const wpick = (r, o) => { let u = r() * Object.values(o).reduce((a, b) => a + b); for (const k in o) if ((u -= o[k]) <= 0) return k; return Object.keys(o)[0]; };
const canvas = (w, h) => { const c = document.createElement('canvas'); c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h)); return c; };
const rr = (c, x, y, w, h, r) => { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); };

const NIGHT = hex('#120815'), BRASS = hex('#f2b544'), IVORY = hex('#f7ede6');
const SKIN = ['#f5d6c1', '#edc3a5', '#e2ad8a', '#d49a74', '#c38563', '#ad714f', '#975f40', '#7f4d33', '#683e29', '#523020', '#40261a'];
const HAIR = ['#141010', '#1f1512', '#2e2018', '#47301f', '#6a4428', '#7a3a22', '#9a7448', '#c4a06a'];
const GREY = ['#8e8a86', '#b5b0aa', '#d2cdc6'];
const CLOTH = ['#4b5a6b', '#6d5d4f', '#3e4752', '#7a6b5a', '#4e5f55', '#6a4e5e', '#8b8173', '#2f343d', '#7b5a4b', '#56616f', '#9a8e7d', '#3d5560', '#6f7b6a', '#7f6f86', '#b3a38d', '#a5776a', '#8a9aa6', '#5a3f45', '#c2b8a8', '#2c3a4a'];
const SHIRT = ['#e0dad1', '#bccad6', '#e8dfd2', '#cdbfae'];
const FRAMES = ['#1a1416', '#3b2a20', '#6b4a2e', '#8c8784', '#2a3140'];

// Room geometry (metres). Camera = the speaker's eyes. wk/hk/hor frame the shot; L = stage-light falloff.
const ROOMS = {
  cafe: { camH: 1.2, wk: 1.5, hk: 1.5, hor: 0.29, light: [1, 1, 9], seat: null, verb: 0.7 },
  meeting: { camH: 1.42, wk: 0.62, hk: 1.05, hor: 0.3, light: [0.9, 0.6, 6], seat: 'office', verb: 0.6 },
  classroom: { camH: 1.7, wk: 0.66, hk: 1.3, hor: 0.2, light: [0.85, 0.42, 5], seat: 'chair', verb: 0.9 },
  hall: { camH: 2.05, wk: 0.62, hk: 1.1, hor: 0.18, light: [0.95, 0.2, 4], seat: 'conf', verb: 1.4 },
  auditorium: { camH: 2.0, wk: 0.5, hk: 1.0, hor: 0.34, light: [0.95, 0.09, 3.2], seat: 'theatre', verb: 2.3 },
};

function seatsFor(room, size, r) {
  const S = [];
  if (room === 'cafe') S.push({ x: 0, z: 1.3, f: 0, row: 0 });
  else if (room === 'meeting') [[-0.74, 2.05, 1], [0.74, 2.15, 1], [-0.76, 3.15, 2], [0.76, 3.25, 2], [0, 4.75, 3]].forEach(([x, z, row]) => S.push({ x, z, f: 0, row, side: Math.sign(x) }));
  else if (room === 'classroom') for (let row = 0; row < 4; row++) for (let c = 0; c < 5; c++) S.push({ x: (c - 2) * 1.12, z: 3.3 + row * 1.2, f: 0, row });
  else if (room === 'hall') {
    for (let row = 0; row < 6; row++) for (let c = 0; c < 12; c++) {
      const x = (c - 5.5) * 0.6 + Math.sign(c - 5.5) * 0.35;
      S.push({ x, z: 3.1 + row * 0.98 - 0.022 * x * x, f: row * 0.2, row });
    }
  } else { // auditorium: concentric fan rows, steep rake, two radial aisles
    const th = 0.78, aisle = 0.3;
    for (let row = 0, n = 0; n < size * 1.1; row++) {
      const R = 3.6 + row * 0.95, step = 0.56 / R, cnt = Math.floor((2 * th) / step);
      for (let i = 0; i < cnt; i++) {
        const a = (i - (cnt - 1) / 2) * step;
        if (Math.abs(Math.abs(a) - aisle) * R < 0.48) continue;
        S.push({ x: R * Math.sin(a), z: R * Math.cos(a), f: row * 0.34, row, a }); n++;
      }
    }
  }
  // leave empty seats (mostly at the back and the edges)
  const empty = S.length - size;
  if (empty > 0) {
    const rows = S.reduce((m, s) => Math.max(m, s.row), 0) || 1;
    [...S].sort((a, b) => (b.row / rows + Math.abs(b.x) / 12 + r() * 0.9) - (a.row / rows + Math.abs(a.x) / 12 + r() * 0.9)).slice(0, empty).forEach(s => (s.empty = true));
  }
  return S;
}

function makePerson(r, seat, mood, room) {
  const age = r();
  const style = wpick(r, { short: 30, long: 18, bob: 9, bun: 10, curly: 11, afro: 4, bald: age > 0.55 ? 9 : 2, cap: room === 'classroom' || room === 'hall' ? 6 : 3 });
  const skin = mix(hex(pick(r, SKIN)), [r() * 255, r() * 200, r() * 160], 0.04);
  const hair = age > 0.82 ? hex(pick(r, GREY)) : hex(pick(r, HAIR));
  const masc = ['short', 'bald', 'cap', 'curly', 'afro'].includes(style) && r() < 0.8;
  return {
    ...seat, style, skin, hair, age,
    beard: masc && r() < 0.32, stubble: masc && r() < 0.3,
    glasses: r() < (age > 0.6 ? 0.45 : 0.22) ? pick(r, FRAMES) : null,
    cloth: hex(pick(r, CLOTH)), shirt: hex(pick(r, SHIRT)), cap: hex(pick(r, CLOTH)),
    top: wpick(r, { tee: 4, shirt: 3, blazer: room === 'hall' || room === 'meeting' ? 4 : 1.5, hoodie: room === 'classroom' ? 4 : 1.5, sweater: 3, turtle: 1 }),
    hs: (room === 'cafe' ? 1.1 : 1.12) * (0.95 + r() * 0.1), bw: (room === 'cafe' ? 0.82 : 0.9) + r() * 0.24, blush: r() < 0.35, part: r() < 0.6 ? (r() < 0.5 ? -1 : 1) : 0,
    cross: mood === 'tough' && r() < 0.38,
    focus: r(), leanT: r() < 0.7 ? 0.4 + r() * 0.6 : 0.1, smileT: r(), nodT: 0.35 + r() * 0.65, sleepy: r(),
    phase: r() * TAU, rate: 0.0011 + r() * 0.0005, gx: (r() - 0.5) * 0.0016, gy: (r() - 0.5) * 0.001, tilt0: (r() - 0.5) * 0.06,
    blinkAt: r() * 4000, blink0: -1e9, act: 'watch', until: 0, turn: 0, turnT: 0, pitch: 0, pitchT: 0,
    lean: 0, smile: 0, brow: 0, mouth: 0, nod0: -1e9, nodAt: 0, clapEnd: 0, clapRate: 3.6 + r() * 2,
  };
}

// --- sprite painters (units: metres; origin at the shoulder line / neck pivot) ---
function paintBody(c, p, seatType, col, fade = 0.92) {
  const bw = p.bw;
  if (seatType) {
    const s = col.seat;
    if (seatType === 'theatre' || seatType === 'conf') {
      const y0 = seatType === 'theatre' ? 0.02 : 0.06, hw = seatType === 'theatre' ? 0.26 : 0.23;
      const g = c.createLinearGradient(0, y0, 0, 0.6);
      g.addColorStop(0, css(mix(s, BRASS, 0.18))); g.addColorStop(0.08, css(s)); g.addColorStop(1, css(mix(s, NIGHT, 0.85)));
      c.fillStyle = g; rr(c, -hw, y0, 2 * hw, 0.9, 0.08); c.fill();
    } else if (seatType === 'chair' || seatType === 'office') {
      c.fillStyle = css(s); rr(c, -0.21, seatType === 'office' ? -0.04 : 0.1, 0.42, 0.4, 0.06); c.fill();
    }
  }
  if (p.empty) return;
  const cl = col.cloth, sk = col.skin;
  // torso + arms silhouette, lit from the stage and falling into shadow below the chest
  const torso = () => {
    c.beginPath(); c.moveTo(-0.055 * bw, -0.035);
    c.bezierCurveTo(-0.11 * bw, -0.012, -0.17 * bw, 0.005, -0.2 * bw, 0.03);
    c.bezierCurveTo(-0.24 * bw, 0.06, -0.25 * bw, 0.12, -0.25 * bw, 0.2);
    c.lineTo(-0.255 * bw, 0.95); c.lineTo(0.255 * bw, 0.95); c.lineTo(0.25 * bw, 0.2);
    c.bezierCurveTo(0.25 * bw, 0.12, 0.24 * bw, 0.06, 0.2 * bw, 0.03);
    c.bezierCurveTo(0.17 * bw, 0.005, 0.11 * bw, -0.012, 0.055 * bw, -0.035); c.closePath();
  };
  const g = c.createLinearGradient(0, -0.03, 0, 0.62);
  g.addColorStop(0, css(mix(cl, IVORY, 0.06))); g.addColorStop(0.3, css(cl)); g.addColorStop(0.65, css(mix(cl, NIGHT, fade * 0.7))); g.addColorStop(1, css(mix(cl, NIGHT, fade)));
  c.fillStyle = g; torso(); c.fill();
  c.save(); torso(); c.clip();
  const rg = c.createRadialGradient(0, 0.12, 0.05, 0, 0.12, 0.3);
  rg.addColorStop(0, css(IVORY, 0.04)); rg.addColorStop(1, css(NIGHT, 0.18));
  c.fillStyle = rg; c.fillRect(-0.3, -0.05, 0.6, 0.9);
  // arms: slightly darker bands separated from the chest by a soft crease
  for (const sd of [-1, 1]) {
    const ag = c.createLinearGradient(sd * 0.15 * bw, 0, sd * 0.26 * bw, 0);
    ag.addColorStop(0, css(NIGHT, 0.22)); ag.addColorStop(0.12, css(NIGHT, 0)); ag.addColorStop(0.75, css(NIGHT, 0)); ag.addColorStop(1, css(NIGHT, 0.25));
    c.fillStyle = ag; c.beginPath(); c.moveTo(sd * 0.165 * bw, 0.09); c.quadraticCurveTo(sd * 0.155 * bw, 0.4, sd * 0.17 * bw, 0.95); c.lineTo(sd * 0.27 * bw, 0.95); c.lineTo(sd * 0.27 * bw, 0.05); c.closePath(); c.fill();
  }
  const hs2 = c.createRadialGradient(0, -0.01, 0.01, 0, -0.01, 0.13);
  hs2.addColorStop(0, css(NIGHT, 0.28)); hs2.addColorStop(1, css(NIGHT, 0));
  c.fillStyle = hs2; c.fillRect(-0.15, -0.1, 0.3, 0.25);
  c.restore();
  // neck (shadowed under the chin)
  if (p.top !== 'turtle') {
    const ng = c.createLinearGradient(0, -0.11, 0, 0);
    ng.addColorStop(0, css(mix(sk, NIGHT, 0.45))); ng.addColorStop(0.7, css(mix(sk, NIGHT, 0.15)));
    c.fillStyle = ng; c.beginPath(); c.moveTo(-0.036, -0.12); c.lineTo(-0.04, -0.015); c.quadraticCurveTo(0, 0.02, 0.04, -0.015); c.lineTo(0.036, -0.12); c.fill();
  }
  const dark = css(mix(cl, NIGHT, 0.4)), sh = col.shirt;
  switch (p.top) {
    case 'tee': case 'sweater':
      c.strokeStyle = dark; c.lineWidth = p.top === 'tee' ? 0.008 : 0.018;
      c.beginPath(); c.moveTo(-0.052, -0.028); c.quadraticCurveTo(0, 0.035, 0.052, -0.028); c.stroke(); break;
    case 'turtle':
      c.fillStyle = css(mix(cl, IVORY, 0.03)); c.beginPath(); c.moveTo(-0.045, -0.1); c.lineTo(-0.05, -0.01); c.quadraticCurveTo(0, 0.02, 0.05, -0.01); c.lineTo(0.045, -0.1); c.fill();
      c.strokeStyle = dark; c.lineWidth = 0.004; for (const y of [-0.07, -0.045, -0.02]) { c.beginPath(); c.moveTo(-0.045, y); c.lineTo(0.045, y); c.stroke(); } break;
    case 'shirt': case 'blazer': {
      if (p.top === 'blazer') { c.fillStyle = css(sh); c.beginPath(); c.moveTo(-0.06, -0.03); c.lineTo(0, 0.24); c.lineTo(0.06, -0.03); c.fill(); }
      c.fillStyle = css(p.top === 'blazer' ? mix(sh, IVORY, 0.15) : mix(cl, IVORY, 0.12));
      for (const s of [-1, 1]) { c.beginPath(); c.moveTo(s * 0.045, -0.045); c.lineTo(s * 0.004, 0.035); c.lineTo(s * 0.07, 0.03); c.closePath(); c.fill(); }
      if (p.top === 'blazer') {
        c.strokeStyle = css(mix(cl, NIGHT, 0.55)); c.lineWidth = 0.01;
        for (const s of [-1, 1]) { c.beginPath(); c.moveTo(s * 0.075, -0.02); c.lineTo(s * 0.012, 0.25); c.stroke(); }
      } else { c.strokeStyle = dark; c.lineWidth = 0.004; c.beginPath(); c.moveTo(0, 0.03); c.lineTo(0, 0.6); c.stroke(); }
      break;
    }
    case 'hoodie':
      c.strokeStyle = css(mix(cl, NIGHT, 0.25)); c.lineWidth = 0.035;
      c.beginPath(); c.moveTo(-0.08, -0.05); c.quadraticCurveTo(0, 0.05, 0.08, -0.05); c.stroke();
      c.strokeStyle = css(mix(cl, IVORY, 0.4)); c.lineWidth = 0.006;
      for (const s of [-1, 1]) { c.beginPath(); c.moveTo(s * 0.03, 0.02); c.lineTo(s * 0.032, 0.14); c.stroke(); }
  }
  if (p.cross) { // folded arms
    const sl = css(mix(cl, NIGHT, 0.2));
    c.lineCap = 'round'; c.lineWidth = 0.085;
    c.strokeStyle = css(mix(cl, NIGHT, 0.35)); c.beginPath(); c.moveTo(-0.21 * bw, 0.4); c.lineTo(0.13 * bw, 0.31); c.stroke();
    c.fillStyle = css(sk); c.beginPath(); c.ellipse(0.17 * bw, 0.3, 0.04, 0.032, -0.3, 0, TAU); c.fill();
    c.strokeStyle = sl; c.beginPath(); c.moveTo(0.21 * bw, 0.37); c.lineTo(-0.13 * bw, 0.3); c.stroke();
    c.fillStyle = css(mix(sk, NIGHT, 0.1)); c.beginPath(); c.ellipse(-0.16 * bw, 0.29, 0.036, 0.03, 0.3, 0, TAU); c.fill();
    c.strokeStyle = css(mix(cl, IVORY, 0.08), 0.5); c.lineWidth = 0.006; c.beginPath(); c.moveTo(0.2 * bw, 0.335); c.lineTo(-0.12 * bw, 0.265); c.stroke();
  }
}

function facePath(c) {
  c.beginPath(); c.moveTo(0, -0.272);
  c.bezierCurveTo(0.072, -0.272, 0.083, -0.222, 0.082, -0.17);
  c.bezierCurveTo(0.081, -0.112, 0.064, -0.068, 0.035, -0.049);
  c.quadraticCurveTo(0, -0.03, -0.035, -0.049);
  c.bezierCurveTo(-0.064, -0.068, -0.081, -0.112, -0.082, -0.17);
  c.bezierCurveTo(-0.083, -0.222, -0.072, -0.272, 0, -0.272); c.closePath();
}

function paintHead(c, p, col) {
  const hr = col.hair, sk = col.skin, st = p.style;
  const hairFill = (y0 = -0.3, y1 = -0.15) => { const g = c.createLinearGradient(0, y0, 0, y1); g.addColorStop(0, css(mix(hr, IVORY, 0.1))); g.addColorStop(1, css(mix(hr, NIGHT, 0.25))); return g; };
  // hair behind the head
  if (st === 'long' || st === 'bob') {
    const y = st === 'long' ? 0.08 : -0.035, wd = st === 'long' ? 0.118 : 0.106;
    c.fillStyle = css(mix(hr, NIGHT, 0.3));
    c.beginPath(); c.moveTo(-0.09, -0.25); c.bezierCurveTo(-wd, -0.16, -wd, -0.03, -wd, y - 0.02); c.quadraticCurveTo(-wd + 0.008, y + 0.02, -0.07, y);
    c.lineTo(-0.05, -0.08); c.lineTo(0.05, -0.08); c.lineTo(0.07, y); c.quadraticCurveTo(wd - 0.008, y + 0.02, wd, y - 0.02);
    c.bezierCurveTo(wd, -0.03, wd, -0.16, 0.09, -0.25); c.closePath(); c.fill();
  }
  if (st === 'bun') { c.fillStyle = hairFill(-0.34, -0.26); c.beginPath(); c.arc(0, -0.292, 0.042, 0, TAU); c.fill(); }
  if (st === 'afro' || st === 'curly') {
    const R = st === 'afro' ? 1.32 : 1.1, rr2 = r => r * (st === 'afro' ? 0.042 : 0.03);
    c.fillStyle = css(mix(hr, NIGHT, 0.15));
    c.beginPath(); c.ellipse(0, -0.19, 0.088 * R, 0.1 * R, 0, Math.PI * 0.92, Math.PI * 2.08); c.fill();
    for (let i = 0; i <= 12; i++) {
      const a = Math.PI * (0.9 + (1.2 * i) / 12), rad = rr2(1 + ((i * 7) % 3) * 0.12);
      c.beginPath(); c.arc(Math.cos(a) * 0.088 * R, -0.19 + Math.sin(a) * 0.1 * R, rad, 0, TAU); c.fill();
    }
  }
  // ears
  c.fillStyle = css(mix(sk, NIGHT, 0.12));
  for (const s of [-1, 1]) { c.beginPath(); c.ellipse(s * 0.081, -0.15, 0.016, 0.03, s * 0.15, 0, TAU); c.fill(); }
  // face with soft volume shading
  facePath(c); c.fillStyle = css(sk); c.fill();
  c.save(); facePath(c); c.clip();
  let g = c.createRadialGradient(-0.012, -0.15, 0.02, 0, -0.15, 0.13);
  g.addColorStop(0, css(mix(sk, IVORY, 0.12), 0.5)); g.addColorStop(0.55, css(sk, 0)); g.addColorStop(1, css(mix(sk, NIGHT, 0.55), 0.7));
  c.fillStyle = g; c.fillRect(-0.1, -0.3, 0.2, 0.28);
  g = c.createLinearGradient(0, -0.09, 0, -0.03); g.addColorStop(0, css(BRASS, 0)); g.addColorStop(1, css(BRASS, 0.08 * p.L));
  c.fillStyle = g; c.fillRect(-0.1, -0.09, 0.2, 0.06);
  if (p.blush) for (const s of [-1, 1]) { const bg = c.createRadialGradient(s * 0.045, -0.118, 0, s * 0.045, -0.118, 0.028); bg.addColorStop(0, css(hex('#d0706a'), 0.12)); bg.addColorStop(1, css(hex('#d0706a'), 0)); c.fillStyle = bg; c.fillRect(s * 0.045 - 0.03, -0.15, 0.06, 0.06); }
  if (p.beard || p.stubble) {
    c.fillStyle = css(mix(hr, sk, p.beard ? 0.15 : 0.62), p.beard ? 0.92 : 0.5);
    c.beginPath(); c.moveTo(-0.085, -0.15); c.bezierCurveTo(-0.075, -0.07, -0.04, -0.03, 0, -0.025); c.bezierCurveTo(0.04, -0.03, 0.075, -0.07, 0.085, -0.15);
    c.lineTo(0.06, -0.13); c.quadraticCurveTo(0.045, -0.095, 0.02, -0.105); c.quadraticCurveTo(0, -0.112, -0.02, -0.105); c.quadraticCurveTo(-0.045, -0.095, -0.06, -0.13); c.closePath(); c.fill();
  }
  c.restore();
  // hair in front
  c.fillStyle = hairFill();
  const cap = (hl, side = -0.175, ext = 0.008) => {
    c.beginPath(); c.moveTo(-0.083 - ext, side);
    c.bezierCurveTo(-0.09 - ext, -0.27, -0.06, -0.292 - ext, 0, -0.292 - ext);
    c.bezierCurveTo(0.06, -0.292 - ext, 0.09 + ext, -0.27, 0.083 + ext, side);
    c.lineTo(0.074, side);
    if (sweep) { c.bezierCurveTo(0.07, hl + 0.012, 0.03, hl + 0.016, -0.005, hl + 0.004); c.quadraticCurveTo(-0.03, hl - 0.012, -0.04, hl - 0.03); c.quadraticCurveTo(-0.07, hl - 0.01, -0.074, side); }
    else { c.bezierCurveTo(0.07, hl - 0.008, 0.035, hl - 0.012, 0.005, hl); c.bezierCurveTo(-0.035, hl - 0.004, -0.07, hl - 0.008, -0.074, side); }
    c.closePath(); c.fill();
  };
  const sweep = p.part && (st === 'long' || st === 'bob' || st === 'short');
  c.save(); if (sweep) c.scale(p.part, 1);
  if (st === 'short') cap(-0.226, -0.18, 0.006);
  else if (st === 'curly') cap(-0.222, -0.18, 0.012);
  else if (st === 'afro') cap(-0.226, -0.17, 0.014);
  else if (st === 'bun') cap(-0.236, -0.17, 0.004);
  else if (st === 'long' || st === 'bob') {
    cap(-0.215, -0.16, 0.01);
    for (const s of [-1, 1]) { // side locks framing the face
      const e = st === 'long' ? -0.05 : -0.06;
      c.beginPath(); c.moveTo(s * 0.06, -0.235); c.quadraticCurveTo(s * 0.1, -0.2, s * 0.097, -0.12); c.quadraticCurveTo(s * 0.095, -0.07, s * 0.088, e);
      c.lineTo(s * 0.077, e - 0.008); c.quadraticCurveTo(s * 0.083, -0.15, s * 0.05, -0.222); c.closePath(); c.fill();
    }
  } else if (st === 'bald') {
    c.fillStyle = css(mix(hr, sk, 0.35), 0.8);
    for (const s of [-1, 1]) { c.beginPath(); c.ellipse(s * 0.079, -0.18, 0.012, 0.035, 0, 0, TAU); c.fill(); }
    c.fillStyle = css(IVORY, 0.1); c.beginPath(); c.ellipse(-0.015, -0.245, 0.035, 0.016, -0.2, 0, TAU); c.fill();
  } else if (st === 'cap') {
    const cc = col.cap;
    c.fillStyle = css(cc); c.beginPath(); c.moveTo(-0.088, -0.19); c.bezierCurveTo(-0.09, -0.28, -0.05, -0.3, 0, -0.3); c.bezierCurveTo(0.05, -0.3, 0.09, -0.28, 0.088, -0.19); c.closePath(); c.fill();
    c.fillStyle = css(mix(cc, NIGHT, 0.3)); c.beginPath(); c.moveTo(-0.092, -0.192); c.quadraticCurveTo(0, -0.215, 0.092, -0.192); c.quadraticCurveTo(0, -0.168, -0.092, -0.192); c.fill();
    c.save(); facePath(c); c.clip(); c.fillStyle = css(NIGHT, 0.28); c.fillRect(-0.1, -0.19, 0.2, 0.022); c.restore();
  }
  if (st !== 'bald' && st !== 'cap') { // soft sheen on the crown
    c.strokeStyle = css(mix(hr, IVORY, 0.35), 0.15); c.lineWidth = 0.008; c.lineCap = 'round';
    c.beginPath(); c.arc(0, -0.2, 0.075, Math.PI * 1.25, Math.PI * 1.55); c.stroke();
  }
  c.restore();
}

export class Audience {
  constructor(cv, { level = 1, sound = true } = {}) {
    this.c = cv; this.x = cv.getContext('2d'); this.sound = sound;
    this.reduced = !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    this.E = 0.5; this.mode = 'idle'; this.hushed = false; this.started = false;
    this._frame = this._frame.bind(this); this._seen = 0; this.w = this.h = 0;
    this.glow = this._glowSprite();
    this.setLevel(level);
    this.raf = requestAnimationFrame(this._frame);
  }

  setLevel(level) {
    const lv = AUDIENCE_LEVELS.find(l => l.id === (level?.id ?? +level)) || AUDIENCE_LEVELS[0];
    this.lv = lv; this.room = ROOMS[lv.room];
    const r = rng(lv.id * 7919 + 13);
    this.seats = seatsFor(lv.room, lv.size, r);
    this.people = [];
    const lt = this.room.light, z0 = Math.min(...this.seats.map(s => s.z));
    for (const s of this.seats) {
      s.L = lt[1] + (lt[0] - lt[1]) * Math.exp(-(s.z - z0) / lt[2]) * (1 - 0.4 * clamp(Math.abs(s.x / s.z)));
      if (s.empty) continue;
      Object.assign(s, makePerson(r, s, lv.mood, lv.room));
      this.people.push(s);
    }
    // a few people with fixed habits: stern faces & phone checkers in the tough crowd, idle phone glows in the dark auditorium
    const back = this.people.filter(p => p.row >= 4);
    if (lv.mood === 'tough') { for (let i = 0; i < 3; i++) pick(r, this.people).stern = true; for (let i = 0; i < 2; i++) pick(r, this.people).phoneish = true; }
    if (lv.room === 'auditorium' && back.length) for (let i = 0; i < 3; i++) pick(r, back).idlePhone = true;
    // chatting pairs for the pre-talk buzz
    const byRow = {};
    for (const p of this.people) (byRow[p.row] ||= []).push(p);
    for (const row of Object.values(byRow)) {
      row.sort((a, b) => a.x - b.x);
      for (let i = 0; i + 1 < row.length; i += 2 + (r() < 0.4)) if (r() < 0.6) { row[i].partner = 1; row[i + 1].partner = -1; row[i].pairT = row[i + 1].pairT = r() * 3000; }
    }
    this.E = lv.mood === 'warm' ? 0.65 : lv.mood === 'tough' ? 0.4 : 0.5;
    this.order = [...this.seats].sort((a, b) => b.row - a.row || b.z - a.z);
    this.w = 0; this.hushed = false; this.clapUntil = 0; // force re-layout, back to the pre-talk buzz
    if (this.ac) this._ambience(true);
  }

  engagement() { return this.E; }

  feed(db, threshold, mode) {
    const now = performance.now(), dt = clamp((now - (this._lf || now)) / 1000, 0, 0.2);
    this._lf = now; this.mode = mode;
    const v = clamp((db - threshold + 6) / 30), tough = this.lv.mood === 'tough', warm = this.lv.mood === 'warm';
    if (mode === 'speaking') {
      if (!this.hushed) this._hush();
      if (now - (this._lastSpeech || 0) > 350) this._burst = now;
      this._lastSpeech = now;
      this._ve = (this._ve ?? v) + (v - (this._ve ?? v)) * 0.05;
      this._dev = (this._dev ?? 0.1) + (Math.abs(v - this._ve) - (this._dev ?? 0.1)) * 0.05;
    }
    const steady = clamp(1 - (this._dev ?? 0.1) * 3);
    const up = (warm ? 1.3 : tough ? 0.75 : 1) * 0.022 * (0.5 + steady) * (0.6 + 0.6 * clamp(v * 2));
    const down = warm ? 0.6 : tough ? 1.2 : 1;
    const toward = (t, rate) => { this.E += clamp(t - this.E, -rate * dt, rate * dt); };
    if (mode === 'speaking') toward(1, up);
    else if (mode === 'freeze') toward(0.04, 0.05 * down);
    else if (mode === 'quiet') toward(0.2, 0.028 * down);
    else if (this.hushed) toward(0.45, 0.006);
    this.E = clamp(this.E, warm ? 0.35 : 0.04, 1);
  }

  start() {
    this.started = true; this.hushed = false; this._lf = 0;
    for (const p of this.people) p.until = 0;
    if (!this.raf && this.c.isConnected) this.raf = requestAnimationFrame(this._frame);
    if (this._audio()) this._ambience(true);
  }

  stop() {
    cancelAnimationFrame(this.raf); this.raf = 0;
    clearInterval(this._tickId); this._tickId = 0;
    const ac = this.ac; this.ac = null; this.mur = null;
    if (ac && ac.state !== 'closed') ac.close().catch(() => {});
  }

  applause() {
    const now = performance.now(), sz = this.lv.size, tough = this.lv.mood === 'tough';
    const len = (2.4 + 2.4 * Math.log(sz) / Math.log(200)) * (tough ? 0.85 : 1);
    this.clapUntil = now + len * 1000;
    for (const p of this.people) {
      p.clapStart = now + Math.random() * 600 * (Math.random() < 0.15 ? 2 : 1);
      p.clapEnd = now + len * 1000 * (0.75 + Math.random() * 0.25);
      p.until = p.clapEnd; p.act = 'clap';
    }
    this.hushed = true;
    const ac = this._audio(); if (!ac) return;
    const buf = this._applauseBuffer(sz, len, tough);
    const src = ac.createBufferSource(), g = ac.createGain();
    src.buffer = buf; g.gain.value = 0.3 + 0.45 * Math.log10(sz) / Math.log10(200);
    src.connect(g); g.connect(this.out); g.connect(this.wet);
    src.start();
    this.mur?.gain.gain.setTargetAtTime(0.0001, ac.currentTime, 0.3);
  }

  // ---------------- rendering ----------------
  _layout(w, h, dpr) {
    const R = this.room, F = Math.min(w * R.wk, h * R.hk) * dpr, hor = h * R.hor * dpr, cx = (w / 2) * dpr;
    this.F = F; this.hor = hor; this.cx = cx; this.dpr = dpr; this.W = this.c.width; this.H = this.c.height;
    this.P = (x, Y, z) => [cx + (F * x) / z, hor + (F * (R.camH - Y)) / z];
    const st = R.seat, seatCol = { theatre: '#5a2232', conf: '#2c2f3a', chair: '#3a2a22', office: '#24262e', cafe: '#3a2418' }[st];
    for (const s of this.seats) {
      [s.sx, s.sy] = this.P(s.x, s.f + 1.05, s.z);
      s.k = F / s.z;
      const L = s.L, warm = c => mix(c, [c[0] * 1.08, c[1] * 0.96, c[2] * 0.8], 0.35 * L), lit = c => mix(NIGHT, warm(c), L);
      const col = { seat: lit(hex(seatCol || '#24262e')) };
      if (!s.empty) Object.assign(col, { skin: lit(s.skin), hair: lit(s.hair), cloth: lit(s.cloth), shirt: lit(s.shirt), cap: lit(s.cap) });
      s.col = col;
      if (!s.empty) {
        col.eye = lit(hex('#1b1210')); col.white = lit(mix(hex('#efe5dc'), s.skin, 0.25)); col.lip = lit(mix(s.skin, hex('#8e3e40'), 0.38));
        col.brow = lit(mix(s.hair, NIGHT, 0.3)); col.mouthIn = lit(hex('#3a1418')); col.frame = s.glasses ? lit(hex(s.glasses)) : null;
        col.shade = lit(mix(s.skin, NIGHT, 0.35));
      }
      // sprites: body (+seat) and head, rendered at device resolution
      const k = s.k, bx = 0.31, b0 = -0.13, b1 = this.lv.room === 'cafe' ? 0.6 : 0.82;
      s.body = canvas(2 * bx * k, (b1 - b0) * k); s.bo = [bx * k, -b0 * k];
      const bc = s.body.getContext('2d'); bc.setTransform(k, 0, 0, k, bx * k, -b0 * k);
      paintBody(bc, s, st, col, this.lv.room === 'cafe' ? 0.5 : 0.95);
      if (this.lv.room !== 'cafe') { // dissolve the lower body into the dark between rows
        const fg2 = bc.createLinearGradient(0, 0.3, 0, 0.8); fg2.addColorStop(0, 'rgba(0,0,0,0)'); fg2.addColorStop(1, 'rgba(0,0,0,1)');
        bc.globalCompositeOperation = 'destination-out'; bc.fillStyle = fg2; bc.fillRect(-bx, 0.3, 2 * bx, b1); bc.globalCompositeOperation = 'source-over';
      }
      if (!s.empty) {
        const hk = k * s.hs, hx = 0.18, h0 = -0.38, h1 = 0.11;
        s.head = canvas(2 * hx * hk, (h1 - h0) * hk); s.ho = [hx * hk, -h0 * hk];
        const hc = s.head.getContext('2d'); hc.setTransform(hk, 0, 0, hk, hx * hk, -h0 * hk);
        paintHead(hc, s, col);
        s.hpx = (0.232 * hk) / dpr; // head height in CSS px, decides detail level
      }
    }
    this.bg = canvas(this.W, this.H); this._paintBg(this.bg.getContext('2d'));
    this.fg = canvas(this.W, this.H); this._paintFg(this.fg.getContext('2d'));
  }

  _glowSprite() {
    const g = canvas(64, 64), c = g.getContext('2d'), r = c.createRadialGradient(32, 32, 0, 32, 32, 32);
    r.addColorStop(0, 'rgba(140,190,255,0.9)'); r.addColorStop(0.45, 'rgba(110,160,255,0.3)'); r.addColorStop(1, 'rgba(90,140,255,0)');
    c.fillStyle = r; c.fillRect(0, 0, 64, 64); return g;
  }

  _glow(c, x, y, r, col, a) {
    const g = c.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, css(col, a)); g.addColorStop(1, css(col, 0));
    c.fillStyle = g; c.fillRect(x - r, y - r, 2 * r, 2 * r);
  }

  _paintBg(c) {
    const { W, H, cx } = this, room = this.lv.room, P = this.P;
    const g = c.createLinearGradient(0, 0, 0, H);
    const top = { cafe: '#2a1520', meeting: '#1d1220', classroom: '#1c1222', hall: '#150b18', auditorium: '#0d0610' }[room];
    g.addColorStop(0, top); g.addColorStop(1, room === 'hall' || room === 'auditorium' ? '#110813' : '#241229');
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    const u = H / 100;
    if (room === 'cafe') {
      // warm wall, window with night street, shelf, string lights with bokeh
      c.fillStyle = '#2f1a26'; c.fillRect(0, 0, W, H);
      const wy = H * 0.05, wh = H * 0.5, wx = W * 0.64, ww = W * 0.3;
      const wg = c.createLinearGradient(0, wy, 0, wy + wh); wg.addColorStop(0, '#1a1b33'); wg.addColorStop(1, '#2b2340');
      c.fillStyle = wg; c.fillRect(wx, wy, ww, wh);
      const r = rng(5);
      for (let i = 0; i < 26; i++) this._glow(c, wx + r() * ww, wy + wh * (0.45 + r() * 0.55), u * (1.5 + r() * 4), pick(r, [BRASS, hex('#ff8a7a'), hex('#7fd1c4'), IVORY]), 0.12 + r() * 0.18);
      c.strokeStyle = '#1a0d14'; c.lineWidth = u * 1.2; c.strokeRect(wx, wy, ww, wh);
      c.beginPath(); c.moveTo(wx + ww / 2, wy); c.lineTo(wx + ww / 2, wy + wh); c.moveTo(wx, wy + wh * 0.42); c.lineTo(wx + ww, wy + wh * 0.42); c.stroke();
      c.fillStyle = '#24131c'; c.fillRect(W * 0.04, H * 0.3, W * 0.26, u * 1.2);
      for (let i = 0; i < 7; i++) { c.fillStyle = css(mix(hex(pick(r, ['#6b4a3a', '#4a5a50', '#7a6040', '#5a4050'])), NIGHT, 0.4)); const jw = u * (2.5 + r() * 2), jh = u * (4 + r() * 5); c.fillRect(W * 0.05 + i * W * 0.035, H * 0.3 - jh, jw, jh); }
      // plant
      c.fillStyle = '#27352c';
      for (let i = 0; i < 14; i++) { const a = -Math.PI / 2 + (r() - 0.5) * 2.4; c.save(); c.translate(W * 0.02, H * 0.62); c.rotate(a + Math.PI / 2); c.beginPath(); c.ellipse(0, -u * 12, u * 2.6, u * 12, 0, 0, TAU); c.fill(); c.restore(); }
      c.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 9; i++) { const t = i / 8; this._glow(c, W * (0.04 + t * 0.92), H * (0.04 + Math.sin(t * Math.PI) * 0.09), u * 5, BRASS, 0.32); this._glow(c, W * (0.04 + t * 0.92), H * (0.04 + Math.sin(t * Math.PI) * 0.09), u * 0.9, hex('#ffe2a3'), 0.9); }
      for (let i = 0; i < 12; i++) this._glow(c, r() * W, H * (0.15 + r() * 0.4), u * (4 + r() * 8), pick(r, [BRASS, hex('#ff8a7a')]), 0.05 + r() * 0.05);
      c.globalCompositeOperation = 'source-over';
      c.strokeStyle = 'rgba(20,10,14,0.8)'; c.lineWidth = u * 0.25; c.beginPath();
      for (let i = 0; i <= 40; i++) { const t = i / 40; c.lineTo(W * (0.04 + t * 0.92), H * (0.04 + Math.sin(t * Math.PI) * 0.09)); } c.stroke();
      this._glow(c, cx, H * 0.45, H * 0.6, BRASS, 0.12);
    } else if (room === 'meeting') {
      // window wall with dusk city, blinds, pendant lamp over the table
      const [, wy0] = P(0, 2.7, 6), [, wy1] = P(0, 0.9, 6), [wx0] = P(-2.4, 0, 6), [wx1] = P(2.4, 0, 6);
      const wg = c.createLinearGradient(0, wy0, 0, wy1); wg.addColorStop(0, '#1b1a35'); wg.addColorStop(1, '#3a2a45');
      c.fillStyle = wg; c.fillRect(wx0, wy0, wx1 - wx0, wy1 - wy0);
      const r = rng(9);
      c.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 60; i++) { const x = wx0 + r() * (wx1 - wx0), y = wy0 + (wy1 - wy0) * (0.5 + r() * 0.5); c.fillStyle = css(pick(r, [BRASS, IVORY, hex('#7fd1c4')]), 0.15 + r() * 0.3); c.fillRect(x, y, u * 0.4, u * 0.4); }
      c.globalCompositeOperation = 'source-over';
      c.fillStyle = 'rgba(10,5,12,0.35)';
      for (let y = wy0; y < wy1; y += u * 1.6) c.fillRect(wx0, y, wx1 - wx0, u * 0.5);
      c.strokeStyle = '#140a16'; c.lineWidth = u * 0.8;
      for (let i = 0; i <= 4; i++) { const x = wx0 + ((wx1 - wx0) * i) / 4; c.beginPath(); c.moveTo(x, wy0); c.lineTo(x, wy1); c.stroke(); }
      c.fillStyle = '#1e1121'; c.fillRect(0, wy1, W, H - wy1);
      const [lx, ly] = P(0, 2.1, 3.3);
      c.strokeStyle = '#000'; c.lineWidth = u * 0.2; c.beginPath(); c.moveTo(lx, 0); c.lineTo(lx, ly); c.stroke();
      c.globalCompositeOperation = 'lighter';
      this._glow(c, lx, ly + u * 8, H * 0.55, BRASS, 0.16);
      c.globalCompositeOperation = 'source-over';
      c.fillStyle = '#2a1a14'; c.beginPath(); c.moveTo(lx - u * 5, ly + u * 1.6); c.quadraticCurveTo(lx, ly - u * 3, lx + u * 5, ly + u * 1.6); c.fill();
      c.globalCompositeOperation = 'lighter';
      this._glow(c, lx, ly + u * 1.8, u * 7, hex('#ffe2a3'), 0.7);
      c.globalCompositeOperation = 'source-over';
    } else if (room === 'classroom') {
      // back wall: tall evening windows, clock, pinboard
      const [, wb] = P(0, 0, 8.6), [, wt] = P(0, 3, 8.6);
      c.fillStyle = '#211526'; c.fillRect(0, 0, W, wb);
      c.fillStyle = '#1a1018'; c.fillRect(0, wb, W, H - wb);
      for (const xw of [-2.9, -1.6]) {
        const [x0, y0] = P(xw, 2.5, 8.6), [x1, y1] = P(xw + 1.1, 1.0, 8.6);
        const g2 = c.createLinearGradient(0, y0, 0, y1); g2.addColorStop(0, '#24264a'); g2.addColorStop(1, '#4a3550');
        c.fillStyle = g2; c.fillRect(x0, y0, x1 - x0, y1 - y0);
        c.strokeStyle = '#140b16'; c.lineWidth = u * 0.6; c.strokeRect(x0, y0, x1 - x0, y1 - y0);
        c.beginPath(); c.moveTo((x0 + x1) / 2, y0); c.lineTo((x0 + x1) / 2, y1); c.stroke();
      }
      const [bx0, by0] = P(0.6, 2.2, 8.6), [bx1, by1] = P(2.8, 1.2, 8.6);
      c.fillStyle = '#3a2a22'; c.fillRect(bx0, by0, bx1 - bx0, by1 - by0);
      const r = rng(3);
      for (let i = 0; i < 9; i++) { c.fillStyle = css(mix(hex(pick(r, ['#d8cfc0', '#e8c070', '#9fc8c0', '#e0a090'])), NIGHT, 0.5)); c.save(); c.translate(bx0 + r() * (bx1 - bx0) * 0.85, by0 + r() * (by1 - by0) * 0.7); c.rotate((r() - 0.5) * 0.2); c.fillRect(0, 0, u * 2.4, u * 3); c.restore(); }
      const [ckx, cky] = P(-0.3, 2.45, 8.6);
      c.fillStyle = '#d8cfc4'; c.beginPath(); c.arc(ckx, cky, u * 2.4, 0, TAU); c.fill();
      c.strokeStyle = '#2a1a1e'; c.lineWidth = u * 0.4; c.stroke();
      c.beginPath(); c.moveTo(ckx, cky); c.lineTo(ckx + u * 1.2, cky - u * 0.6); c.moveTo(ckx, cky); c.lineTo(ckx - u * 0.2, cky - u * 1.8); c.stroke();
      c.globalCompositeOperation = 'lighter'; this._glow(c, cx, H * 0.9, H * 0.9, BRASS, 0.1); c.globalCompositeOperation = 'source-over';
    } else {
      // theatre / hall: side drapes, sconces, booth window, exit signs, aisle lights
      const r = rng(11);
      for (const s of [-1, 1]) for (let i = 0; i < 7; i++) {
        const x = s < 0 ? i * W * 0.012 : W - i * W * 0.012, g2 = c.createLinearGradient(x - u * 2, 0, x + u * 2, 0);
        g2.addColorStop(0, 'rgba(47,26,54,0)'); g2.addColorStop(0.5, `rgba(70,32,56,${0.35 - i * 0.04})`); g2.addColorStop(1, 'rgba(47,26,54,0)');
        c.fillStyle = g2; c.fillRect(x - u * 2, 0, u * 4, H);
      }
      c.globalCompositeOperation = 'lighter';
      if (room === 'auditorium') {
        this._glow(c, cx, H * 0.05, u * 9, BRASS, 0.08);
        for (const s of [-1, 1]) { this._glow(c, cx + s * W * 0.43, H * 0.06, u * 3, hex('#7fd1c4'), 0.35); c.fillStyle = 'rgba(127,209,196,0.55)'; c.fillRect(cx + s * W * 0.43 - u * 1.4, H * 0.055, u * 2.8, u * 1); }
      } else {
        for (let i = 0; i < 6; i++) this._glow(c, W * (0.1 + i * 0.16), H * 0.05, u * 4, BRASS, 0.12);
      }
      for (const s of [-1, 1]) for (const y of [0.18, 0.4]) { this._glow(c, cx + s * W * 0.47, H * y, u * 6, BRASS, 0.18); this._glow(c, cx + s * W * 0.47, H * y, u * 1, hex('#ffe2a3'), 0.6); }
      if (room === 'auditorium') {
        const rows = Math.max(...this.seats.map(s => s.row)) + 1;
        for (let row = 0; row < rows; row++) for (const s of [-1, 1]) {
          const R = 3.6 + row * 0.95 - 0.45, [x, y] = P(R * Math.sin(s * 0.3), row * 0.34 + 0.05, R * Math.cos(0.3));
          this._glow(c, x, y, u * 0.8, BRASS, 0.5);
        }
      }
      c.globalCompositeOperation = 'source-over';
    }
  }

  _paintFg(c) {
    const { W, H, cx } = this, room = this.lv.room, P = this.P, u = H / 100;
    const poly = (pts, fill) => { c.beginPath(); pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.closePath(); c.fillStyle = fill; c.fill(); };
    if (room === 'cafe') {
      const zc = 0.92, rad = 0.34, top = [], edge = [];
      for (let i = 0; i <= 48; i++) { const a = (i / 48) * TAU; top.push(P(rad * Math.cos(a), 0.74, zc + rad * Math.sin(a))); edge.push(P(rad * Math.cos(a), 0.7, zc + rad * Math.sin(a))); }
      poly(edge, '#1c0e10');
      const [, ty0] = P(0, 0.74, zc + rad), [, ty1] = P(0, 0.74, zc - rad);
      const g = c.createLinearGradient(0, ty0, 0, ty1); g.addColorStop(0, '#6b4a38'); g.addColorStop(0.5, '#4e3226'); g.addColorStop(1, '#2e1c16');
      poly(top, g);
      c.globalCompositeOperation = 'lighter'; const [hx, hy] = P(0.05, 0.74, zc + 0.12); this._glow(c, hx, hy, u * 18, BRASS, 0.12); c.globalCompositeOperation = 'source-over';
      this.cups = [this._cup(c, 0.15, 1.05, 0.04), this._cup(c, -0.17, 0.74, 0.044)];
    } else if (room === 'meeting') {
      const T = [[-0.62, 1.1], [0.62, 1.1], [0.62, 4.55], [-0.62, 4.55]].map(([x, z]) => P(x, 0.74, z));
      const g = c.createLinearGradient(0, T[2][1], 0, H); g.addColorStop(0, '#3e2619'); g.addColorStop(0.5, '#4f3020'); g.addColorStop(1, '#2a160e');
      poly(T, g);
      poly([P(-0.62, 0.74, 4.55), P(0.62, 0.74, 4.55), P(0.62, 0.69, 4.55), P(-0.62, 0.69, 4.55)], '#1e0f0b');
      poly([P(-0.62, 0.74, 1.1), P(0.62, 0.74, 1.1), P(0.62, 0.68, 1.1), P(-0.62, 0.68, 1.1)], '#24120b');
      c.globalCompositeOperation = 'lighter';
      const [lx, ly] = P(0, 0.74, 3.0); c.save(); c.translate(lx, ly); c.scale(1, 0.35); this._glow(c, 0, 0, u * 30, BRASS, 0.2); c.restore();
      c.globalCompositeOperation = 'source-over';
      const paper = (x, z, w, d, col) => poly([P(x - w, 0.745, z - d), P(x + w, 0.745, z - d), P(x + w, 0.745, z + d), P(x - w, 0.745, z + d)], col);
      paper(-0.38, 2.0, 0.11, 0.15, 'rgba(225,215,200,0.55)'); paper(0.35, 3.15, 0.12, 0.16, 'rgba(225,215,200,0.4)'); paper(0.3, 2.1, 0.16, 0.12, 'rgba(40,40,48,0.9)');
      this._cup(c, -0.3, 3.2, 0.04); this._cup(c, 0.42, 2.0, 0.04); this._cup(c, 0.15, 4.3, 0.04);
    } else if (room === 'hall' || room === 'auditorium') {
      // stage apron at the bottom with footlights
      const lipY = H * (room === 'hall' ? 0.9 : 0.91);
      c.beginPath(); c.moveTo(0, H); c.lineTo(0, lipY + u * 3); c.quadraticCurveTo(cx, lipY - u * 3, W, lipY + u * 3); c.lineTo(W, H); c.closePath();
      const g = c.createLinearGradient(0, lipY - u * 3, 0, H); g.addColorStop(0, '#4a2c1c'); g.addColorStop(0.12, '#2a1610'); g.addColorStop(1, '#120709');
      c.fillStyle = g; c.fill();
      c.strokeStyle = 'rgba(242,181,68,0.55)'; c.lineWidth = Math.max(1, u * 0.25);
      c.beginPath(); c.moveTo(0, lipY + u * 3); c.quadraticCurveTo(cx, lipY - u * 3, W, lipY + u * 3); c.stroke();
      c.globalCompositeOperation = 'lighter';
      if (room === 'auditorium') for (let i = 0; i < 11; i++) {
        const t = (i + 0.5) / 11, x = t * W, y = lipY + u * 3 - 4 * t * (1 - t) * u * 6 * 0.5 * 2 + u * 1.2;
        this._glow(c, x, y, u * 7, BRASS, 0.22); this._glow(c, x, y, u * 1.1, hex('#ffe2a3'), 0.85);
      }
      c.globalCompositeOperation = 'source-over';
    } else if (room === 'classroom') {
      const g = c.createLinearGradient(0, H * 0.88, 0, H); g.addColorStop(0, 'rgba(18,8,21,0)'); g.addColorStop(1, 'rgba(18,8,21,0.6)'); c.fillStyle = g; c.fillRect(0, H * 0.88, W, H * 0.12);
    }
    // stage-light spill and vignette
    c.globalCompositeOperation = 'lighter';
    const sp = c.createRadialGradient(cx, H * 1.1, 0, cx, H * 1.1, H * 1.1);
    sp.addColorStop(0, css(BRASS, room === 'auditorium' ? 0.16 : 0.1)); sp.addColorStop(1, css(BRASS, 0));
    c.fillStyle = sp; c.fillRect(0, 0, W, H);
    c.globalCompositeOperation = 'source-over';
    const vg = c.createRadialGradient(cx, H * 0.62, Math.min(W, H) * 0.35, cx, H * 0.55, Math.max(W, H) * 0.75);
    vg.addColorStop(0, 'rgba(14,6,16,0)'); vg.addColorStop(1, `rgba(14,6,16,${room === 'cafe' ? 0.55 : 0.75})`);
    c.fillStyle = vg; c.fillRect(0, 0, W, H);
    if (room === 'auditorium' || room === 'hall') {
      const tg = c.createLinearGradient(0, 0, 0, H * 0.45); tg.addColorStop(0, 'rgba(10,4,12,0.55)'); tg.addColorStop(1, 'rgba(10,4,12,0)');
      c.fillStyle = tg; c.fillRect(0, 0, W, H * 0.45);
    }
  }

  _cup(c, x, z, r) {
    const P = this.P, [cx0, cy0] = P(x, 0.745, z), k = this.F / z;
    const w = r * k, hh = r * 1.6 * k, e = w * 0.3;
    c.fillStyle = 'rgba(10,4,8,0.35)'; c.beginPath(); c.ellipse(cx0, cy0, w * 1.9, e * 1.7, 0, 0, TAU); c.fill();
    c.fillStyle = '#d8cfc4'; c.beginPath(); c.ellipse(cx0, cy0, w * 1.7, e * 1.5, 0, 0, TAU); c.fill();
    const g = c.createLinearGradient(cx0 - w, 0, cx0 + w, 0); g.addColorStop(0, '#a89a8e'); g.addColorStop(0.4, '#efe6dc'); g.addColorStop(1, '#8a7c72');
    c.fillStyle = g; c.beginPath(); c.moveTo(cx0 - w, cy0 - hh); c.lineTo(cx0 - w * 0.82, cy0); c.ellipse(cx0, cy0, w * 0.82, e * 0.82, 0, Math.PI, 0, true); c.lineTo(cx0 + w, cy0 - hh); c.closePath(); c.fill();
    c.strokeStyle = '#cfc4b8'; c.lineWidth = w * 0.18; c.beginPath(); c.ellipse(cx0 + w * 1.15, cy0 - hh * 0.55, w * 0.3, hh * 0.28, 0, 0, TAU); c.stroke();
    c.fillStyle = '#efe6dc'; c.beginPath(); c.ellipse(cx0, cy0 - hh, w, e, 0, 0, TAU); c.fill();
    c.fillStyle = '#3b2216'; c.beginPath(); c.ellipse(cx0, cy0 - hh + e * 0.12, w * 0.86, e * 0.8, 0, 0, TAU); c.fill();
    return [cx0, cy0 - hh, w];
  }

  _frame(t) {
    const cv = this.c;
    if (!cv.isConnected) { if (this._seen || ++this._wait > 120) return this.stop(); this.raf = requestAnimationFrame(this._frame); return; }
    this._seen = 1; this._wait = 0;
    this.raf = requestAnimationFrame(this._frame);
    const w = cv.clientWidth, h = cv.clientHeight, dpr = Math.min(window.devicePixelRatio || 1, 2, Math.sqrt(2.6e6 / Math.max(1, w * h)));
    if (!w || !h) return;
    if (w !== this.w || h !== this.h || dpr !== this.dpr) {
      this.w = w; this.h = h; cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
      this._layout(w, h, dpr);
    }
    const now = performance.now(), dt = clamp((now - (this._lt || now)) / 1000, 0, 0.1);
    this._lt = now;
    const t0 = performance.now();
    this._update(now, dt);
    this._draw(now);
    this._ft = (this._ft || 0) * 0.95 + (performance.now() - t0) * 0.05;
  }

  _choose(p, now) {
    const r = Math.random, warm = this.lv.mood === 'warm', tough = this.lv.mood === 'tough', E = this.E;
    const set = (act, turn, pitch, dur) => { if (act === 'phone' && p.cross) [act, pitch] = ['down', 0.75]; p.act = act; p.turnT = turn; p.pitchT = pitch; p.until = now + dur; };
    const look = -clamp(p.x / p.z, -1, 1) * 0.35 + p.tilt0; // turn the head toward the speaker
    if (!this.hushed && !warm) { // pre-talk buzz
      if (p.partner && r() < 0.8) return set('chat', p.partner * 0.75, 0, 2500 + r() * 3000);
      const u = r();
      return u < 0.07 ? set('phone', 0, 1, 3000 + r() * 4000) : u < 0.4 ? set('side', (r() < 0.5 ? -1 : 1) * (0.4 + r() * 0.5), -0.1, 1500 + r() * 2500) : set('watch', look, 0, 1500 + r() * 3000);
    }
    const distract = !warm && p.focus < (0.78 - E) * 0.3 + (tough ? 0.04 : 0);
    if ((p.phoneish && r() < 0.45) || (p.idlePhone && r() < 0.65)) return set('phone', 0, 1, 3000 + r() * 5000);
    if (distract && r() < 0.75) {
      const u = r();
      return u < 0.4 ? set('phone', 0, 1, 3000 + r() * 5000) : u < 0.75 ? set('side', (r() < 0.5 ? -1 : 1) * (0.6 + r() * 0.3), 0, 2000 + r() * 3000) : set('down', 0, 0.75, 2500 + r() * 3000);
    }
    if (warm && E < 0.45 && r() < 0.25) return set('side', 0.6, 0, 1200 + r() * 1500);
    set('watch', look, 0, 2000 + r() * 4000);
  }

  _update(now, dt) {
    const E = this.E, mood = this.lv.mood, warm = mood === 'warm', tough = mood === 'tough', red = this.reduced;
    const k = red ? 1 : 1 - Math.exp(-dt * 5), speaking = this.mode === 'speaking';
    const burst = this._burst && this._burst !== this._seenBurst; this._seenBurst = this._burst;
    // one gentle yawn at a time when attention is low (never for the warm friend)
    if (this.hushed && !warm && E < (tough ? 0.45 : 0.32) && !this.people.some(p => p.act === 'yawn') && Math.random() < dt * 0.07) {
      const c = this.people.filter(p => p.act === 'watch' && p.row < 5);
      const p = c[(Math.random() * c.length) | 0];
      if (p) { p.act = 'yawn'; p.until = now + 2800; p.act0 = now; p.turnT = 0; p.pitchT = -0.4; }
    }
    for (const p of this.people) {
      if (now > p.blinkAt) { p.blink0 = now; p.blinkAt = now + 2000 + Math.random() * 4000; }
      if (now > p.until) this._choose(p, now);
      if (p.act === 'clap' && now > p.clapEnd) p.until = 0;
      const engaged = p.act === 'watch';
      // nods follow speech bursts
      if (engaged && this.hushed && E > 0.42 && now - p.nod0 > 2500 && !p.nodAt) {
        const chance = burst ? (warm ? 0.75 : (0.08 + 0.35 * (E - 0.42)) * p.nodT) : speaking ? dt * 0.03 * E * p.nodT : 0;
        if (Math.random() < chance) p.nodAt = now + 150 + Math.random() * 650;
      }
      if (p.nodAt && now > p.nodAt) { p.nod0 = now; p.nodAt = 0; }
      const leanT = !engaged || !this.hushed ? 0 : warm ? 0.4 + 0.5 * E : clamp((E - 0.5) / 0.4) * p.leanT;
      let smileT = warm ? 0.55 + 0.35 * E : tough ? clamp(E - 0.65) * p.smileT * 1.2 : p.smileT * clamp((E - 0.45) * 1.6) * 0.8;
      if (p.act === 'chat') smileT = 0.3 + p.smileT * 0.4;
      if (p.act === 'clap') smileT = p.stern ? 0.3 : 0.75;
      else if (p.stern) smileT = -0.35;
      p.turn += (p.turnT - p.turn) * k; p.pitch += (p.pitchT - p.pitch) * k;
      p.lean += (leanT - p.lean) * k * 0.6; p.smile += (smileT - p.smile) * k * 0.5;
      p.brow = p.stern && p.act !== 'clap' ? -1 : engaged ? p.lean * 0.6 : 0;
      p.talk = p.act === 'chat' && Math.floor((now + p.pairT) / 1800) % 2 === (p.partner > 0 ? 0 : 1);
    }
    if (this.clapUntil && now > this.clapUntil + 500) this.clapUntil = 0;
  }

  _draw(now) {
    const c = this.x, red = this.reduced;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.drawImage(this.bg, 0, 0);
    const room = this.lv.room;
    for (const s of this.order) {
      if (s.empty) { c.drawImage(s.body, s.sx - s.bo[0], s.sy - s.bo[1]); continue; }
      this._person(c, s, now, red);
      if (room === 'classroom') this._desk(c, s);
    }
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.drawImage(this.fg, 0, 0);
    if (room === 'cafe') this._cafeExtras(c, now, red);
  }

  _person(c, p, now, red) {
    const k = p.k, t = now * p.rate + p.phase;
    const breath = red ? 0 : Math.sin(t) * 0.003;
    const slump = this.hushed ? clamp((0.35 - this.E) / 0.35) * 0.012 : 0;
    const by = (breath + p.lean * 0.018 + slump) * k, sc = 1 + p.lean * 0.035;
    const sx = p.side ? 0.86 : 1;
    // body
    const bx = p.sx, bY = p.sy + by;
    c.setTransform(sc * sx, 0, 0, sc, bx, bY);
    c.drawImage(p.body, -p.bo[0], -p.bo[1]);
    // hands for clapping / phone
    const clapping = p.act === 'clap' && !p.cross && now > p.clapStart && now < p.clapEnd;
    if (p.act === 'phone' || clapping) {
      c.setTransform(k * sc * sx, 0, 0, k * sc, bx, bY);
      const sk = css(p.col.skin);
      if (clapping) {
        const ph = ((now - p.clapStart) / 1000) * p.clapRate * TAU, gap = red ? 0.03 : 0.004 + 0.035 * (0.5 + 0.5 * Math.cos(ph));
        c.lineCap = 'round';
        for (const s of [-1, 1]) {
          const hx = s * (gap + 0.02);
          c.strokeStyle = css(mix(p.col.cloth, NIGHT, 0.15)); c.lineWidth = 0.07; c.beginPath(); c.moveTo(s * 0.17 * p.bw, 0.5); c.quadraticCurveTo(s * 0.12, 0.3, hx + s * 0.01, 0.2); c.stroke();
          c.fillStyle = css(mix(p.col.skin, NIGHT, s > 0 ? 0.12 : 0)); c.beginPath(); c.ellipse(hx, 0.14, 0.024, 0.05, s * 0.25, 0, TAU); c.fill();
        }
      } else {
        c.fillStyle = sk; c.beginPath(); c.ellipse(0.01, 0.23, 0.05, 0.03, 0, 0, TAU); c.fill();
        c.fillStyle = 'rgba(200,225,255,0.95)'; c.fillRect(-0.025, 0.14, 0.05, 0.085);
      }
    }
    // head
    let nod = 0;
    const nu = (now - p.nod0) / 900;
    if (nu >= 0 && nu < 1) nod = (0.5 - 0.5 * Math.cos(nu * TAU * 2)) * (1 - nu) * (red ? 0.4 : 1);
    let pitch = p.pitch + nod * 0.9;
    let yawn = 0, cough = 0;
    if (p.act === 'yawn') { const u = (now - p.act0) / 2800; yawn = Math.sin(clamp(u) * Math.PI); pitch -= yawn * 0.5; }
    if (p.act === 'cough') { const u = (now - p.act0) / 900; cough = u < 1 ? Math.abs(Math.sin(u * Math.PI * 3)) * (1 - u) : 0; pitch += cough * 0.6; }
    const tilt = (red ? 0 : Math.sin(t * 0.37) * 0.025) + p.tilt0 * 0.5 + p.turn * 0.06 + (p.act === 'clap' ? 0 : p.lean * 0.04 * Math.sign(p.tilt0 || 1));
    const hy = -0.045 + pitch * 0.006, hx = p.turn * 0.01, sq = 1 - 0.1 * Math.abs(p.turn);
    const ca = Math.cos(tilt), sa = Math.sin(tilt), hs = sc * p.hs;
    c.setTransform(ca * sc * sq, sa * sc * sq, -sa * sc, ca * sc, bx + hx * k * sc * sx, bY + hy * k * sc);
    c.drawImage(p.head, -p.ho[0], -p.ho[1]);
    if (p.hpx < 4) return;
    c.setTransform(ca * k * hs * sq, sa * k * hs * sq, -sa * k * hs, ca * k * hs, bx + hx * k * sc * sx, bY + hy * k * sc);
    this._face(c, p, now, pitch, yawn, cough);
    if (p.act === 'phone') {
      c.globalCompositeOperation = 'lighter'; c.globalAlpha = 0.2;
      c.drawImage(this.glow, -0.075, -0.15, 0.15, 0.13);
      c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
    }
  }

  _face(c, p, now, pitch, yawn, cough) {
    const col = p.col, hp = p.hpx, turn = p.turn, fx = turn * 0.03, fy = pitch * 0.011;
    const blink = now - p.blink0 < 130;
    const down = p.act === 'phone' || p.act === 'down';
    let open = blink || yawn > 0.5 || cough > 0.3 ? 0.08 : down ? 0.35 : 1 - 0.35 * clamp((0.35 - this.E) / 0.35) * p.sleepy * (this.hushed ? 1 : 0);
    const ey = -0.158 + fy, gx = clamp(-p.x / p.z * 0.4, -0.5, 0.5) * 0.004 + p.gx + turn * 0.006, gy = (down ? 0.004 : 0.0018) + p.gy;
    // nose shadow
    if (hp > 14) { c.fillStyle = css(col.shade, 0.35); c.beginPath(); c.ellipse(fx * 1.1, -0.117 + fy, 0.013, 0.006, 0, 0, TAU); c.fill(); }
    // eyes
    if (hp < 9) {
      c.fillStyle = css(col.eye, 0.9);
      const ew = 0.018, eh = Math.max(0.004, 0.01 * open);
      c.fillRect(-0.033 + fx - ew / 2, ey - eh / 2, ew, eh); c.fillRect(0.033 + fx - ew / 2, ey - eh / 2, ew, eh);
    } else for (const s of [-1, 1]) {
      const x = s * 0.033 + fx;
      if (hp >= 24) {
        const ry = 0.0068 * open;
        if (ry > 0.0012) {
          c.fillStyle = css(col.white); c.beginPath(); c.ellipse(x, ey, 0.0125, ry, 0, 0, TAU); c.fill();
          c.save(); c.beginPath(); c.ellipse(x, ey, 0.0125, ry, 0, 0, TAU); c.clip();
          c.fillStyle = css(mix(col.eye, hex('#5a3a28'), 0.35)); c.beginPath(); c.arc(x + gx, ey + gy * 0.6, 0.0064, 0, TAU); c.fill();
          c.fillStyle = css(col.eye); c.beginPath(); c.arc(x + gx, ey + gy * 0.6, 0.0032, 0, TAU); c.fill();
          c.fillStyle = 'rgba(255,240,215,0.85)'; c.beginPath(); c.arc(x + gx - 0.002, ey + gy * 0.6 - 0.002, 0.0013, 0, TAU); c.fill();
          c.restore();
        }
        c.strokeStyle = css(col.eye, 0.85); c.lineWidth = 0.0024;
        c.beginPath(); c.ellipse(x, ey + 0.0005, 0.0128, Math.max(0.0015, ry), 0, Math.PI * 1.05, Math.PI * 1.95); c.stroke();
      } else {
        c.fillStyle = css(col.eye, 0.95);
        c.beginPath(); c.ellipse(x + gx * 0.6, ey + (down ? 0.002 : 0), 0.0085, Math.max(0.0018, 0.0062 * open), 0, 0, TAU); c.fill();
      }
    }
    // brows
    if (hp >= 12) {
      c.strokeStyle = css(col.brow, 0.9); c.lineWidth = hp >= 24 ? 0.0055 : 0.007; c.lineCap = 'round';
      const b = p.brow, by = -0.179 + fy - (yawn * 0.006);
      for (const s of [-1, 1]) {
        c.beginPath(); c.moveTo(s * 0.017 + fx, by + (b < 0 ? 0.005 : -0.004 * b)); c.quadraticCurveTo(s * 0.033 + fx, by - 0.006 - 0.003 * Math.max(0, b), s * 0.05 + fx, by - 0.001); c.stroke();
      }
    }
    // mouth
    if (hp >= 10) {
      const my = -0.086 + fy * 1.2, mw = 0.021 + Math.max(0, p.smile) * 0.005;
      if (yawn > 0.05) {
        c.fillStyle = css(col.mouthIn); c.beginPath(); c.ellipse(fx, my + 0.004, 0.012 + yawn * 0.004, 0.004 + yawn * 0.018, 0, 0, TAU); c.fill();
        if (hp >= 18) { c.fillStyle = css(col.skin); c.beginPath(); c.ellipse(fx + 0.004, my + 0.018 * yawn, 0.022, 0.016, 0, 0, TAU); c.globalAlpha = yawn > 0.4 ? 1 : 0; c.fill(); c.globalAlpha = 1; }
      } else if (cough > 0.05 || (p.talk && Math.sin(now / 75 + p.phase) > -0.2)) {
        if (cough > 0.05) { c.fillStyle = css(col.skin); c.beginPath(); c.ellipse(fx, my + 0.006, 0.026, 0.02, 0, 0, TAU); c.fill(); }
        else { c.fillStyle = css(col.mouthIn); c.beginPath(); c.ellipse(fx, my + 0.002, 0.012, 0.003 + 0.004 * Math.abs(Math.sin(now / 110 + p.phase)), 0, 0, TAU); c.fill(); }
      } else {
        const sm = p.smile;
        if (hp >= 24 && sm > 0.45) { // open, toothy smile
          c.fillStyle = css(col.mouthIn); c.beginPath(); c.moveTo(fx - mw, my - 0.002); c.quadraticCurveTo(fx, my + 0.004, fx + mw, my - 0.002); c.quadraticCurveTo(fx, my + 0.02 * sm, fx - mw, my - 0.002); c.fill();
          c.fillStyle = 'rgba(240,232,222,0.85)'; c.beginPath(); c.moveTo(fx - mw * 0.8, my - 0.0005); c.quadraticCurveTo(fx, my + 0.0045, fx + mw * 0.8, my - 0.0005); c.quadraticCurveTo(fx, my + 0.0075, fx - mw * 0.8, my - 0.0005); c.fill();
        }
        c.strokeStyle = css(col.lip, 0.95); c.lineWidth = hp >= 24 ? 0.0042 : 0.006; c.lineCap = 'round';
        c.beginPath(); c.moveTo(fx - mw, my - sm * 0.006); c.quadraticCurveTo(fx, my + sm * 0.012, fx + mw, my - sm * 0.006); c.stroke();
      }
    }
    // glasses (with a brass glint from the stage)
    if (col.frame && hp >= 8) {
      c.strokeStyle = css(col.frame); c.lineWidth = hp >= 24 ? 0.0035 : 0.005;
      for (const s of [-1, 1]) { rr(c, s * 0.033 + fx - 0.02, ey - 0.014, 0.04, 0.027, 0.009); c.stroke(); }
      c.beginPath(); c.moveTo(-0.013 + fx, ey - 0.004); c.quadraticCurveTo(fx, ey - 0.009, 0.013 + fx, ey - 0.004); c.stroke();
      if (hp >= 12) { c.strokeStyle = css(BRASS, 0.18 + 0.3 * p.L); c.lineWidth = 0.003; c.beginPath(); c.moveTo(0.022 + fx, ey + 0.008); c.lineTo(0.032 + fx, ey - 0.008); c.stroke(); }
    }
  }

  _desk(c, s) {
    const P = this.P, x = s.x, z = s.z - 0.42;
    c.setTransform(1, 0, 0, 1, 0, 0);
    const q = pts => { c.beginPath(); pts.forEach(([a, b], i) => (i ? c.lineTo(a, b) : c.moveTo(a, b))); c.closePath(); };
    const lit = cc => css(mix(NIGHT, hex(cc), s.L));
    q([P(x - 0.38, 0.74, z - 0.25), P(x + 0.38, 0.74, z - 0.25), P(x + 0.38, 0.74, z + 0.22), P(x - 0.38, 0.74, z + 0.22)]); c.fillStyle = lit('#5e4232'); c.fill();
    const [, py0] = P(x, 0.74, z - 0.25), [, py1] = P(x, 0, z - 0.25), pg = c.createLinearGradient(0, py0, 0, py1);
    pg.addColorStop(0, lit('#3e2a20')); pg.addColorStop(1, css(NIGHT));
    q([P(x - 0.38, 0.74, z - 0.25), P(x + 0.38, 0.74, z - 0.25), P(x + 0.38, 0.0, z - 0.25), P(x - 0.38, 0.0, z - 0.25)]); c.fillStyle = pg; c.fill();
    q([P(x - 0.38, 0.74, z - 0.25), P(x + 0.38, 0.74, z - 0.25), P(x + 0.38, 0.71, z - 0.25), P(x - 0.38, 0.71, z - 0.25)]); c.fillStyle = lit('#8a6a4e'); c.fill();
    if ((s.focus * 10 | 0) % 3) { const px = x + (s.smileT - 0.5) * 0.3; q([P(px - 0.1, 0.745, z - 0.08), P(px + 0.1, 0.745, z - 0.08), P(px + 0.1, 0.745, z + 0.12), P(px - 0.1, 0.745, z + 0.12)]); c.fillStyle = lit('#d8d0c4'); c.fill(); }
  }

  _cafeExtras(c, now, red) {
    const p = this.people[0];
    c.setTransform(1, 0, 0, 1, 0, 0);
    if (p && !(p.act === 'clap' && now < p.clapEnd)) { // forearms resting on the table
      const P = this.P;
      const k = this.F / 1.1, cl = p.col.cloth;
      for (const s of [-1, 1]) {
        const [x0, y0] = P(s * 0.21, 0.765, 1.2), [x1, y1] = P(s * 0.05, 0.765, 1.03);
        c.lineCap = 'round';
        c.strokeStyle = css(mix(cl, NIGHT, 0.3)); c.lineWidth = 0.062 * k; c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke();
        c.strokeStyle = css(mix(cl, IVORY, 0.04)); c.lineWidth = 0.042 * k; c.beginPath(); c.moveTo(x0, y0 - 0.008 * k); c.lineTo(x1, y1 - 0.008 * k); c.stroke();
      }
      for (const s of [-1, 1]) {
        const [hx, hy] = P(s * 0.03, 0.77, 1.0);
        c.fillStyle = css(mix(p.col.skin, NIGHT, s > 0 ? 0.12 : 0)); c.beginPath(); c.ellipse(hx, hy, 0.042 * k, 0.026 * k, s * 0.5, 0, TAU); c.fill();
      }
    }
    if (!this.cups) return;
    c.strokeStyle = 'rgba(247,237,230,0.035)'; c.lineCap = 'round';
    for (const [x, y, w] of this.cups) {
      if (y > this.H) continue;
      c.lineWidth = w * 0.4;
      for (let i = 0; i < 2; i++) {
        const t = red ? 0.5 : (now / 2600 + i * 0.5) % 1, ph = now / 700 + i * 2;
        c.globalAlpha = Math.sin(t * Math.PI);
        c.beginPath(); c.moveTo(x, y - w * 0.3 - t * w * 2);
        c.bezierCurveTo(x + Math.sin(ph) * w * 0.6, y - w * 1.2 - t * w * 2, x - Math.sin(ph) * w * 0.6, y - w * 2 - t * w * 2, x + Math.sin(ph + 1) * w * 0.4, y - w * 2.8 - t * w * 2); c.stroke();
      }
      c.globalAlpha = 1;
    }
  }

  // ---------------- sound ----------------
  _audio() {
    if (!this.sound) return null;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    if (!this.ac) {
      const ac = (this.ac = new AC()), comp = ac.createDynamicsCompressor();
      comp.threshold.value = -20; comp.ratio.value = 4;
      this.out = ac.createGain(); this.out.gain.value = 0.7;
      this.out.connect(comp); comp.connect(ac.destination);
      this.verb = ac.createConvolver(); this.wet = ac.createGain(); this.wet.gain.value = 0.22;
      this.wet.connect(this.verb); this.verb.connect(comp);
      const n = ac.sampleRate * 4, nb = ac.createBuffer(1, n, ac.sampleRate), d = nb.getChannelData(0);
      let b0 = 0, b1 = 0, b2 = 0; // pinkish noise
      for (let i = 0; i < n; i++) { const w = Math.random() * 2 - 1; b0 = 0.997 * b0 + w * 0.029; b1 = 0.985 * b1 + w * 0.032; b2 = 0.95 * b2 + w * 0.048; d[i] = (b0 + b1 + b2 + w * 0.05) * 1.6; }
      this.noise = nb;
      this._tickId = setInterval(() => this._tick(), 90);
    }
    if (this.ac.state === 'suspended') this.ac.resume().catch(() => {});
    return this.ac;
  }

  _ir(sec) {
    const ac = this.ac, n = Math.floor(ac.sampleRate * sec), b = ac.createBuffer(2, n, ac.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const d = b.getChannelData(ch); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 3.2); }
    return b;
  }

  _ambience(reset) {
    const ac = this.ac; if (!ac) return;
    if (this.verb && this._verbRoom !== this.lv.room) { this.verb.buffer = this._ir(this.room.verb); this._verbRoom = this.lv.room; }
    if (this.mur && reset) { const old = this.mur; old.gain.gain.setTargetAtTime(0, ac.currentTime, 0.2); setTimeout(() => old.nodes.forEach(n => { try { n.stop(); } catch { /* */ } }), 1500); this.mur = null; }
    if (this.mur || !this.started) return;
    const sz = this.lv.size, room = this.lv.room, t = ac.currentTime;
    const vol = { cafe: 0.2, meeting: 0.17, classroom: 0.3, hall: 0.42, auditorium: 0.55 }[room];
    const g = ac.createGain(); g.gain.value = 0; g.gain.setTargetAtTime(vol, t, 0.6); g.connect(this.out); g.connect(this.wet);
    const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = room === 'cafe' ? 2600 : 1600; lp.connect(g);
    const nodes = [], layers = [], voices = [];
    const src = ac.createBufferSource(); src.buffer = this.noise; src.loop = true; src.start(); nodes.push(src);
    for (const [f, q] of [[380, 1], [650, 1.3], [1100, 1.4], [1800, 1.6]]) {
      const bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = f; bp.Q.value = q;
      const lg = ac.createGain(); lg.gain.value = 0.2; src.connect(bp); bp.connect(lg); lg.connect(lp); layers.push(lg);
    }
    const nv = { cafe: 3, meeting: 3, classroom: 5, hall: 7, auditorium: 8 }[room];
    for (let i = 0; i < nv; i++) { // muffled "walla" voices
      const o = ac.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 95 + Math.random() * 150;
      const bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 4; bp.frequency.value = 500;
      const vg = ac.createGain(); vg.gain.value = 0;
      o.connect(bp); bp.connect(vg); vg.connect(lp); o.start(); nodes.push(o);
      voices.push({ o, bp, g: vg, f0: o.frequency.value, on: false });
    }
    if (room === 'cafe') { // room tone
      const rt = ac.createBiquadFilter(); rt.type = 'lowpass'; rt.frequency.value = 300; const rg = ac.createGain(); rg.gain.value = 0.25;
      src.connect(rt); rt.connect(rg); rg.connect(lp);
    }
    this.mur = { gain: g, layers, voices, nodes, vol, depth: sz >= 60 ? 0.25 : 0.6 };
  }

  _hush() {
    this.hushed = true;
    for (const p of this.people) if (p.act !== 'watch') p.until = performance.now() + Math.random() * 1200;
    const ac = this.ac; if (!ac || !this.mur) return;
    this.mur.gain.gain.setTargetAtTime(this.mur.vol * (this.lv.room === 'cafe' ? 0.4 : 0.04), ac.currentTime, 0.45);
  }

  _tick() {
    const ac = this.ac;
    if (!ac) return;
    if (!this.c.isConnected && this._seen) return this.stop();
    const t = ac.currentTime, m = this.mur, r = Math.random, sz = this.lv.size, tough = this.lv.mood === 'tough';
    if (m) {
      for (const lg of m.layers) lg.gain.setTargetAtTime(0.12 + m.depth * 0.3 * r() ** 2, t, 0.12);
      for (const v of m.voices) {
        if (r() < 0.3) v.on = !v.on && r() < 0.75;
        v.g.gain.setTargetAtTime(v.on ? (0.02 + 0.03 * r()) : 0, t, 0.04);
        v.o.frequency.setTargetAtTime(v.f0 * (0.85 + 0.3 * r()), t, 0.06);
        v.bp.frequency.setTargetAtTime(350 + r() * 900, t, 0.05);
      }
      if (this.hushed && !this.clapUntil && sz >= 20) { // a faint rustle returns during long freezes
        const want = m.vol * (0.04 + (this.mode === 'freeze' ? 0.12 * (1 - this.E) : 0));
        m.gain.gain.setTargetAtTime(want, t, 1.2);
      }
    }
    if (!this.started || this.clapUntil) return;
    if (sz >= 20 && r() < 0.09 * (tough ? 1 / 9 : 1 / 30)) this._cough();
    if (sz >= 20 && r() < 0.09 / 25) this._creak();
    if (this.lv.room === 'cafe' && r() < 0.09 / 10) this._clink();
  }

  _pan(x) { const p = this.ac.createStereoPanner?.(); if (p) { p.pan.value = clamp(x, -1, 1); p.connect(this.out); p.connect(this.wet); return p; } return this.out; }

  _cough() {
    const ac = this.ac, r = Math.random, c = this.people.filter(p => p.act === 'watch');
    const p = c[(r() * c.length) | 0]; if (!p) return;
    p.act = 'cough'; p.act0 = performance.now(); p.until = p.act0 + 900;
    const out = this._pan(clamp(p.x / p.z, -0.9, 0.9)), vol = 0.12 * (0.6 + 0.4 * p.L), t = ac.currentTime + 0.02;
    for (const [dt, a] of [[0, 1], [0.2 + r() * 0.08, 0.55]]) {
      const s = ac.createBufferSource(); s.buffer = this.noise;
      const bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 450 + r() * 400; bp.Q.value = 1.2;
      const g = ac.createGain(); g.gain.setValueAtTime(0, t + dt); g.gain.linearRampToValueAtTime(vol * a, t + dt + 0.012); g.gain.exponentialRampToValueAtTime(0.0005, t + dt + 0.22);
      s.connect(bp); bp.connect(g); g.connect(out); s.start(t + dt, r() * 3, 0.3);
    }
  }

  _creak() {
    const ac = this.ac, r = Math.random, n = Math.floor(ac.sampleRate * (0.3 + r() * 0.3)), b = ac.createBuffer(1, n, ac.sampleRate), d = b.getChannelData(0);
    for (let i = 0, gap = 0; i < n; i += gap) { gap = Math.floor(ac.sampleRate * (0.006 + r() * 0.014 + (i / n) * 0.01)); const a = Math.sin((i / n) * Math.PI) * (0.5 + r() * 0.5); for (let j = 0; j < 60 && i + j < n; j++) d[i + j] += a * Math.exp(-j / 8) * (j % 2 ? -1 : 1); }
    const s = ac.createBufferSource(); s.buffer = b;
    const bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 500 + r() * 500; bp.Q.value = 6;
    const g = ac.createGain(); g.gain.value = 0.05;
    s.connect(bp); bp.connect(g); g.connect(this._pan(r() * 1.6 - 0.8)); s.start();
  }

  _clink() {
    const ac = this.ac, t = ac.currentTime, f = 2600 + Math.random() * 900, out = this._pan(Math.random() * 1.4 - 0.7);
    for (const [m, a] of [[1, 1], [1.47, 0.5], [2.1, 0.25]]) {
      const o = ac.createOscillator(), g = ac.createGain(); o.frequency.value = f * m;
      g.gain.setValueAtTime(0.012 * a, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
      o.connect(g); g.connect(out); o.start(t); o.stop(t + 0.55);
    }
  }

  _applauseBuffer(sz, len, tough) {
    const ac = this.ac, sr = ac.sampleRate, n = Math.floor(sr * (len + 0.6)), buf = ac.createBuffer(2, n, sr);
    const L = buf.getChannelData(0), R = buf.getChannelData(1), r = Math.random;
    const claps = [];
    for (let v = 0; v < 8; v++) { // a handful of clap timbres: noise burst through a JS biquad band-pass
      const m = Math.floor(sr * 0.05), d = new Float32Array(m), tau = sr * (0.004 + r() * 0.005);
      for (let i = 0; i < m; i++) d[i] = (r() * 2 - 1) * Math.exp(-i / tau) * Math.min(1, i / (sr * 0.0007));
      const w = (TAU * (900 + r() * 1400)) / sr, al = Math.sin(w) / 2.2, a0 = 1 + al, b0 = al / a0, a1 = (-2 * Math.cos(w)) / a0, a2 = (1 - al) / a0;
      let x1 = 0, x2 = 0, y1 = 0, y2 = 0, pk = 0;
      for (let i = 0; i < m; i++) { const x = d[i], y = b0 * x - b0 * x2 - a1 * y1 - a2 * y2; x2 = x1; x1 = x; y2 = y1; y1 = y; d[i] = y + x * 0.25; pk = Math.max(pk, Math.abs(d[i])); }
      for (let i = 0; i < m; i++) d[i] /= pk;
      claps.push(d);
    }
    const M = Math.min(sz, 90) * (tough ? 0.75 : 1) || 1;
    for (let k = 0; k < M; k++) {
      const pan = sz === 1 ? 0 : r() * 1.6 - 0.8, gl = Math.cos(((pan + 1) * Math.PI) / 4), gr = Math.sin(((pan + 1) * Math.PI) / 4);
      const start = r() * 0.45 * (r() < 0.15 ? 2.5 : 1), end = len * (0.65 + r() * 0.35), rate = 3.4 + r() * 2.2, base = 0.6 + r() * 0.4;
      const cl = claps[(r() * claps.length) | 0];
      for (let tt = start; tt < end; tt += (1 / rate) * (0.92 + r() * 0.16)) {
        const env = Math.min(1, (tt - start) / 0.3) * Math.min(1, (end - tt) / 0.9) * base * (0.75 + r() * 0.25);
        const i0 = Math.floor(tt * sr);
        for (let j = 0; j < cl.length && i0 + j < n; j++) { const s = cl[j] * env; L[i0 + j] += s * gl; R[i0 + j] += s * gr; }
      }
    }
    let pk = 0;
    for (let i = 0; i < n; i++) pk = Math.max(pk, Math.abs(L[i]), Math.abs(R[i]));
    if (pk > 0) for (let i = 0; i < n; i++) { L[i] /= pk; R[i] /= pk; }
    return buf;
  }
}
