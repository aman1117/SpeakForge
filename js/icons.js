// Minimal line icons (24px grid, stroke = currentColor).
const P = {
  today: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  mic: '<rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10a7 7 0 0 0 14 0M12 17v5M8 22h8"/>',
  practice: '<path d="M4 6h16M4 12h10M4 18h7"/><circle cx="18" cy="16" r="3"/>',
  real: '<path d="M3 12h2l2-6 3 12 3-9 2 5 2-2h4"/>',
  progress: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  masters: '<path d="M12 3l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.4 6.8 19.1l1-5.8L3.5 9.2l5.9-.9z"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  word: '<path d="M4 7V5h16v2M9 19h6M12 5v14"/>',
  gem: '<path d="M6 3h12l4 6-10 12L2 9z"/><path d="M2 9h20M12 21L8 9l4-6 4 6z"/>',
  filler: '<circle cx="12" cy="12" r="9"/><path d="M8 12h8"/>',
  explain: '<path d="M12 3v4M12 17v4M5 12H3M21 12h-2"/><circle cx="12" cy="12" r="5"/>',
  calm: '<path d="M2 12c3-6 6-6 10 0s7 6 10 0"/><path d="M2 18c3-4 6-4 10 0s7 4 10 0" opacity=".5"/>',
  voice: '<path d="M2 10v4M6 6v12M10 3v18M14 8v8M18 5v14M22 10v4"/>',
  phrases: '<path d="M4 5h16v11H8l-4 4z"/>',
  shadow: '<circle cx="9" cy="12" r="5"/><circle cx="15" cy="12" r="5" opacity=".55"/>',
  play: '<path d="M7 4l13 8-13 8z"/>',
  upload: '<path d="M12 16V4M6 10l6-6 6 6M4 20h16"/>',
  check: '<path d="M4 12l5 5L20 6"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  back: '<path d="M19 12H5M11 18l-6-6 6-6"/>',
  spark: '<path d="M12 3v6M12 15v6M3 12h6M15 12h6"/>',
};
export const icon = (name, cls = 'i') => `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true">${P[name] || ''}</svg>`;

// Concentric progress rings (Apple Fitness style). rings: [{pct 0..1, color}]
export function ringsSvg(rings, size = 132) {
  const c = size / 2, w = size / 11;
  return `<svg class="rings" viewBox="0 0 ${size} ${size}" style="width:${size}px;height:${size}px">${rings.map((r, i) => {
    const rad = c - w / 2 - i * (w + 3), len = 2 * Math.PI * rad, p = Math.max(0, Math.min(1, r.pct));
    return `<circle cx="${c}" cy="${c}" r="${rad}" stroke="${r.color}" stroke-opacity=".16" stroke-width="${w}"/>
      <circle cx="${c}" cy="${c}" r="${rad}" stroke="${r.color}" stroke-width="${w}" stroke-dasharray="${len}" stroke-dashoffset="${len * (1 - p)}" transform="rotate(-90 ${c} ${c})"/>`;
  }).join('')}</svg>`;
}

export function dial(value, max = 10, size = 96, invert = false) {
  const r = size / 2 - 6, len = 2 * Math.PI * r, p = value == null ? 0 : Math.max(0, Math.min(1, value / max));
  const q = invert ? 1 - p : p;
  const col = q >= 0.75 ? 'var(--seaglass)' : q >= 0.5 ? 'var(--brass)' : 'var(--coral)';
  return `<div class="dial" style="width:${size}px;height:${size}px"><svg viewBox="0 0 ${size} ${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${r}" stroke="#ffffff14"/>
    <circle cx="${size / 2}" cy="${size / 2}" r="${r}" stroke="${col}" stroke-dasharray="${len}" stroke-dashoffset="${len * (1 - p)}" transform="rotate(-90 ${size / 2} ${size / 2})"/></svg><b>${value ?? '–'}</b></div>`;
}
