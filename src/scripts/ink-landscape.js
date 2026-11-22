/**
 * 山影 · 生成水墨背景
 *
 * The homepage supplies a painted image in place of the base canvas.
 *   [data-ink-base] – the default painting: distant ranges, cloud sea, moon,
 *                    bamboo on the left, a boat. Rendered once per seed /
 *                    resize / theme.
 *   [data-ink-live] – transparent layer on top: drifting mist and the birds.
 *                    Cheap to redraw, paused when the tab is hidden.
 *
 * Everything is derived from the site's own CSS variables (--page, --ink),
 * so the painting follows the light / dark theme instead of fighting it.
 */

/* ── tiny helpers ───────────────────────────────────────────── */
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const gauss = (x, c, w) => Math.exp(-(((x - c) / w) ** 2));

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hash(seed, salt) {
  let h = (seed ^ (salt * 0x9e3779b1)) >>> 0;
  h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b) >>> 0;
  h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35) >>> 0;
  h ^= h >>> 16;
  return h >>> 0;
}
const rngFor = (seed, salt) => mulberry32(hash(seed, salt));

function makeNoise1D(rng) {
  const N = 256, v = new Float32Array(N);
  for (let i = 0; i < N; i++) v[i] = rng() * 2 - 1;
  return (x) => {
    x = ((x % N) + N) % N;
    const i0 = Math.floor(x), i1 = (i0 + 1) % N, t = x - i0;
    const s = t * t * (3 - 2 * t);
    return v[i0] * (1 - s) + v[i1] * s;
  };
}

const rgba = (c, a) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

function parseColor(value, fallback) {
  const s = String(value || '').trim();
  let m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(s);
  if (m) {
    const h = m[1];
    const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
    return [parseInt(full.slice(0, 2), 16), parseInt(full.slice(2, 4), 16), parseInt(full.slice(4, 6), 16)];
  }
  m = /^rgba?\(([^)]+)\)/i.exec(s);
  if (m) {
    const parts = m[1].split(/[\s,/]+/).filter(Boolean).map(Number);
    if (parts.length >= 3) return [parts[0], parts[1], parts[2]];
  }
  return fallback;
}

/* ── palette ────────────────────────────────────────────────── */
function readPalette() {
  const cs = getComputedStyle(document.documentElement);
  const dark = document.documentElement.classList.contains('dark');
  const paper = parseColor(cs.getPropertyValue('--page'), dark ? [33, 31, 25] : [238, 230, 212]);
  const ink = dark ? [236, 226, 204] : [44, 42, 33];
  return { dark, paper, ink };
}

/* ── soft dab sprite cache ──────────────────────────────────── */
const dabCache = new Map();
function dabSprite(color) {
  const key = color.join(',');
  const hit = dabCache.get(key);
  if (hit) return hit;
  const S = 128;
  const cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const g = cv.getContext('2d');
  const grd = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  grd.addColorStop(0, rgba(color, 1));
  grd.addColorStop(0.30, rgba(color, 0.74));
  grd.addColorStop(0.62, rgba(color, 0.30));
  grd.addColorStop(0.85, rgba(color, 0.07));
  grd.addColorStop(1, rgba(color, 0));
  g.fillStyle = grd;
  g.fillRect(0, 0, S, S);
  dabCache.set(key, cv);
  return cv;
}

function paintCrane(c, x, y, size, flap, dark) {
  c.save();
  c.translate(x, y);
  c.scale(size, size);
  const tip = -.28 - flap * .72;
  const feather = dark ? '#819294' : '#515d57';
  c.fillStyle = feather;
  c.beginPath();
  c.moveTo(.12, 0);
  c.quadraticCurveTo(-.35, tip - .06, -.93, tip * .52);
  c.quadraticCurveTo(-.45, tip * .58, -.12, .05);
  c.fill();

  // The long neck and trailing legs stay level between wingbeats.
  c.strokeStyle = feather;
  c.lineWidth = .075;
  c.beginPath();
  c.moveTo(-1.12, .035);
  c.quadraticCurveTo(-.67, -.12, -.24, 0);
  c.lineTo(.91, .12);
  c.stroke();
  c.fillStyle = dark ? '#cbd3c5' : '#f5edda';
  c.beginPath();
  c.moveTo(-.78, -.065);
  c.quadraticCurveTo(-.26, -.14, .53, .045);
  c.quadraticCurveTo(.08, .2, -.32, .025);
  c.lineTo(-.78, 0);
  c.fill();
  c.beginPath();
  c.moveTo(-.17, .025);
  c.quadraticCurveTo(.04, tip * .74, .39, tip);
  c.lineTo(.91, tip + .16);
  c.quadraticCurveTo(.51, tip + .16, .16, .055);
  c.fill();
  c.fillStyle = feather;
  c.beginPath();
  c.moveTo(.39, tip);
  c.lineTo(.99, tip + .16);
  c.lineTo(.81, tip + .16);
  c.lineTo(.9, tip + .23);
  c.quadraticCurveTo(.59, tip + .2, .39, tip);
  c.fill();
  c.restore();
}

/* ── scene description ──────────────────────────────────────── */
// Ranges sit on the right-hand side of the page; the left belongs to bamboo.
const TIERS = [
  {
    tone: { alpha: 0.12, dab: 130 }, veil: { y: 0.450, s: 0.18 },
    masses: [
      { cx: 0.930, w: 0.30, peak: 0.240, base: 0.400, skew: 1.00, sharp: 1.10, bumps: [[0.30, 0.28, 0.09]] },
    ],
  },
  {
    tone: { alpha: 0.19, dab: 200 }, veil: { y: 0.500, s: 0.20 },
    masses: [
      { cx: 0.900, w: 0.34, peak: 0.300, base: 0.465, skew: 0.98, sharp: 1.12, bumps: [[0.66, 0.30, 0.08]] },
    ],
  },
  {
    tone: { alpha: 0.28, dab: 300 }, veil: { y: 0.560, s: 0.22 },
    masses: [
      { cx: 0.960, w: 0.28, peak: 0.360, base: 0.555, skew: 1.02, sharp: 1.10, bumps: [[0.40, 0.34, 0.08]] },
    ],
  },
  {
    tone: { alpha: 0.36, dab: 380 }, veil: { y: 0.640, s: 0.24 },
    masses: [
      { cx: 0.880, w: 0.30, peak: 0.420, base: 0.640, skew: 0.96, sharp: 1.08, bumps: [] },
    ],
  },
];

// 版心后面那层"淡山"。页芯是 90% 不透明的纸，只有 10% 透出来，
// 所以这一层要在画布上画得比两侧重，透过去才刚好是淡淡一层，不会压住字。
const CENTER = [
  { cx: 0.300, w: 0.32, peak: 0.300, base: 0.560, skew: 1.02, sharp: 1.05, bumps: [[0.36, 0.28, 0.10]] },
  { cx: 0.505, w: 0.36, peak: 0.245, base: 0.545, skew: 0.96, sharp: 1.02, bumps: [[0.64, 0.32, 0.10]] },
  { cx: 0.705, w: 0.30, peak: 0.315, base: 0.565, skew: 1.04, sharp: 1.08, bumps: [] },
];

const MOON = { x: 0.952, y: 0.150, r: 0.029 };

const BAMBOO = [
  { x: 0.030, top: -0.09, lean: 0.012, w: 12.0, bow: 0.005, phase: 0.4, salt: 11 },
  { x: 0.068, top: 0.090, lean: -0.010, w: 8.6, bow: 0.004, phase: 1.6, salt: 12 },
  { x: 0.100, top: 0.290, lean: 0.018, w: 6.4, bow: 0.003, phase: 2.4, salt: 13 },
  { x: 0.130, top: 0.455, lean: -0.014, w: 4.8, bow: 0.003, phase: 3.1, salt: 14 },
];

/* ── the painter ────────────────────────────────────────────── */
export function mountInkLandscape(options = {}) {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => mountInkLandscape(options), { once: true });
    return null;
  }
  const baseCv = document.querySelector('[data-ink-base]');
  const liveCv = document.querySelector('[data-ink-live]');
  const baseCtx = baseCv?.getContext('2d', { alpha: false });
  const liveCtx = liveCv?.getContext('2d', { alpha: true });
  if (!liveCtx) return null;

  const illustrated = !baseCv;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const artwork = liveCv.parentElement.querySelector('.home-cloudscape');
  const mistImage = liveCv.dataset.mistSrc ? new Image() : null;
  const mistBands = [
    { level: .42, width: .93, depth: .19, travel: .81, seconds: 27, phase: .66, alpha: .56 },
    { level: .28, width: .67, depth: .21, travel: .94, seconds: 17, phase: .36, alpha: .82 },
  ];
  const state = {
    seed: options.seed ?? hash(Math.floor(Date.now() / 86400000), 7),
    W: 1440,
    H: 900,
    artTop: 0,
    artHeight: 900,
    palette: readPalette(),
    scale: 1,
    wisps: [],
    birds: [],
    page: { l: 0, r: 1440 },
    raf: 0,
    lastPaint: 0,
    lastTime: 0,
    pointer: { x: 0, y: 0, active: false },
    visible: !document.hidden,
  };

  const u = () => state.W / 1440;
  const U = () => state.W / 1440;
  const AR = () => state.H / 900;

  /* ── masses ───────────────────────────────────────────────── */
  function makeMassif(seed, salt, m) {
    const rng = rngFor(seed, salt);
    const n1 = makeNoise1D(rng), n2 = makeNoise1D(rng);
    const cx = (m.cx + (rng() - 0.5) * 0.06) * state.W;
    const w = m.w * state.W * (0.9 + rng() * 0.22);
    const ar = AR();
    const shape = ar > 1 ? Math.pow(ar, -0.72) : 1;
    const base = (m.base + (rng() - 0.5) * 0.02) * state.H;
    const peak = base - (base - (m.peak + (rng() - 0.5) * 0.02) * state.H) * shape;
    const skew = m.skew * (0.94 + rng() * 0.12);
    const sharp = m.sharp * (0.94 + rng() * 0.14);
    const bumps = m.bumps.map((b) => [b[0] + (rng() - 0.5) * 0.06, b[1] * (0.75 + rng() * 0.5), b[2]]);

    const n = 150;
    const pts = new Array(n + 1);
    for (let k = 0; k <= n; k++) {
      const t = k / n;
      const tt = Math.pow(t, skew);
      const tri = 1 - Math.abs(2 * tt - 1);
      const bell = Math.pow(Math.sin(Math.PI * Math.min(1, tt)), 1.12);
      let h = 0.6 * tri + 0.4 * bell;
      h = Math.pow(clamp(h, 0, 1), sharp);
      for (const b of bumps) h += b[1] * gauss(t, b[0], b[2]);
      const rough = n1(t * 7.2 + 11) * 0.085 + n2(t * 2.1 + 3) * 0.06;
      h = clamp(h + rough * (0.55 + (1 - h) * 0.75), 0, 1.55);
      pts[k] = [cx - w / 2 + t * w, base - (base - peak) * h];
    }
    return { pts, base };
  }

  function massPath(c, pts, base) {
    const n = pts.length;
    c.beginPath();
    c.moveTo(pts[0][0], pts[0][1]);
    for (let k = 1; k < n - 1; k++) {
      const mx = (pts[k][0] + pts[k + 1][0]) / 2;
      const my = (pts[k][1] + pts[k + 1][1]) / 2;
      c.quadraticCurveTo(pts[k][0], pts[k][1], mx, my);
    }
    c.lineTo(pts[n - 1][0], pts[n - 1][1]);
    c.lineTo(pts[n - 1][0] + 60 * u(), base + 90 * u());
    c.lineTo(pts[0][0] - 60 * u(), base + 90 * u());
    c.closePath();
  }

  function paintMass(c, pts, base, tone, rng) {
    const uu = u();
    const { paper, ink } = state.palette;
    const tint = mix(paper, ink, tone.k);
    const dab = dabSprite(tint);
    const paperDab = dabSprite(paper);
    let minY = Infinity;
    for (const p of pts) minY = Math.min(minY, p[1]);

    const blob = (sprite, x, y, w, h, rot, a) => {
      if (a <= 0.003) return;
      c.save();
      c.globalAlpha = a > 1 ? 1 : a;
      c.translate(x, y); c.rotate(rot);
      c.drawImage(sprite, -w / 2, -h / 2, w, h);
      c.restore();
    };

    /* body: a few offset passes of wet wash */
    for (let pass = 0; pass < 3; pass++) {
      c.save();
      c.translate((rng() - 0.5) * 8 * uu, (rng() - 0.5) * 5 * uu);
      massPath(c, pts, base);
      const g = c.createLinearGradient(0, minY - 10 * uu, 0, base + 10 * uu);
      g.addColorStop(0, rgba(tint, tone.alpha * (0.82 + pass * 0.1)));
      g.addColorStop(0.22, rgba(tint, tone.alpha * 0.55));
      g.addColorStop(0.55, rgba(tint, tone.alpha * 0.24));
      g.addColorStop(1, rgba(tint, 0));
      c.fillStyle = g;
      c.fill();
      c.restore();
    }

    /* the crest is tone, not a line */
    const bandH = (12 + tone.alpha * 30) * uu;
    for (let k = 0; k < pts.length; k += 3) {
      const p = pts[k];
      const t = k / (pts.length - 1);
      const swell = 0.5 + 0.5 * Math.sin(t * 19 + 1.3);
      blob(dab, p[0], p[1] + bandH * 0.45, bandH * 4.8, bandH * 2.0, 0, tone.alpha * 0.2 * swell);
    }

    /* tonal patches inside the wash */
    for (let k = 0; k < Math.round(tone.dab * 0.14); k++) {
      const i = Math.floor(rng() * pts.length);
      const p = pts[i];
      const depth = Math.pow(rng(), 1.2) * (base - minY) * 0.95;
      const w = (34 + rng() * 92) * uu;
      blob(dab, p[0] + (rng() - 0.5) * 26 * uu, p[1] + depth,
        w, w * (0.85 + rng() * 1.3), (rng() - 0.5) * 0.4, tone.alpha * (0.13 + rng() * 0.34));
    }

    /* dry grain */
    for (let k = 0; k < Math.round(tone.dab * 0.2); k++) {
      const i = Math.floor(rng() * pts.length);
      const p = pts[i];
      c.fillStyle = rgba(tint, 0.02 + rng() * 0.05);
      c.fillRect(p[0] + (rng() - 0.5) * 30 * uu,
        p[1] + (0.08 + rng() * 0.55) * (base - p[1]),
        0.7 + rng() * 1.8, 0.7 + rng() * 1.8);
    }

    /* paper breathing through the ink */
    for (let k = 0; k < Math.round(tone.dab * 0.07); k++) {
      const i = Math.floor(rng() * pts.length);
      const p = pts[i];
      const w = (54 + rng() * 150) * uu;
      blob(paperDab, p[0] + (rng() - 0.5) * 44 * uu,
        p[1] + (base - p[1]) * (0.12 + rng() * 0.75),
        w, w * (0.4 + rng() * 0.55), (rng() - 0.5) * 0.35, 0.10 + rng() * 0.22);
    }

    /* 苔点 */
    const clusters = 2 + Math.floor(rng() * 3);
    for (let cl = 0; cl < clusters; cl++) {
      const i0 = Math.floor(rng() * (pts.length - 6)) + 3;
      const p0 = pts[i0];
      const dots = 3 + Math.floor(rng() * 5);
      for (let k = 0; k < dots; k++) {
        c.beginPath();
        c.arc(p0[0] + (rng() - 0.5) * 16 * uu, p0[1] + (2 + rng() * 7) * uu,
          (0.7 + rng() * 1.8) * uu, 0, Math.PI * 2);
        c.fillStyle = rgba(tint, 0.2 + rng() * 0.35);
        c.fill();
      }
    }

    /* the foot dissolves into the mist */
    for (let k = 0; k < Math.round(tone.dab * 0.1); k++) {
      const i = Math.floor(rng() * pts.length);
      const p = pts[i];
      const w = (90 + rng() * 260) * uu;
      blob(paperDab, p[0] + (rng() - 0.5) * 60 * uu,
        p[1] + (base - p[1]) * (0.55 + rng() * 0.65),
        w, w * (0.4 + rng() * 0.5), (rng() - 0.5) * 0.22, 0.08 + rng() * 0.2);
    }
  }

  function fogVeil(c, rng, y, strength) {
    const paperDab = dabSprite(state.palette.paper);
    for (let k = 0; k < 12; k++) {
      const x = rng() * state.W;
      const yy = (y + (rng() - 0.5) * 0.05) * state.H;
      const rx = (150 + rng() * 380) * u();
      const ry = (18 + rng() * 52) * u();
      c.save();
      c.globalAlpha = strength * (0.35 + rng() * 0.65);
      c.translate(x, yy);
      c.drawImage(paperDab, -rx, -ry, rx * 2, ry * 2);
      c.restore();
    }
  }

  /* ── sky / moon / weather ─────────────────────────────────── */
  function skyGradient(c) {
    const { paper } = state.palette;
    const g = c.createLinearGradient(0, 0, 0, state.H * 0.72);
    g.addColorStop(0, rgba(mix(paper, [255, 255, 255], 0.35), 1));
    g.addColorStop(0.6, rgba(paper, 1));
    g.addColorStop(1, rgba(paper, 1));
    return g;
  }
  function paintSky(c) {
    c.fillStyle = skyGradient(c);
    c.fillRect(0, 0, state.W, state.H);
  }

  function paintMoon(c) {
    const { paper, dark } = state.palette;
    const uu = u();
    const cx = MOON.x * state.W, cy = MOON.y * state.H, R = MOON.r * state.W;
    const light = dark ? mix(paper, [255, 252, 240], 0.5) : mix(paper, [255, 255, 250], 0.85);

    const halo = c.createRadialGradient(cx, cy, R * 0.7, cx, cy, R * 5.2);
    halo.addColorStop(0, rgba(light, dark ? 0.22 : 0.5));
    halo.addColorStop(0.3, rgba(light, dark ? 0.08 : 0.17));
    halo.addColorStop(1, rgba(light, 0));
    c.fillStyle = halo;
    c.fillRect(cx - R * 5.4, cy - R * 5.4, R * 10.8, R * 10.8);

    c.save();
    if ('filter' in c) c.filter = `blur(${2.4 * uu}px)`;
    const disc = c.createRadialGradient(cx - R * 0.2, cy - R * 0.25, R * 0.1, cx, cy, R * 1.05);
    disc.addColorStop(0, rgba(light, 0.95));
    disc.addColorStop(0.7, rgba(light, dark ? 0.72 : 0.9));
    disc.addColorStop(1, rgba(light, dark ? 0.3 : 0.55));
    c.beginPath(); c.arc(cx, cy, R, 0, Math.PI * 2);
    c.fillStyle = disc; c.fill();
    c.restore();
  }

  function paintCloudSea(c, rng) {
    const { paper } = state.palette;
    const paperDab = dabSprite(paper);
    for (let k = 0; k < 26; k++) {
      const x = rng() * state.W;
      const y = (0.70 + Math.sin((x / state.W) * 6.4 + 0.8) * 0.02 + rng() * 0.11) * state.H;
      const rx = (120 + rng() * 330) * u();
      const ry = (24 + rng() * 68) * u();
      c.save();
      c.globalAlpha = 0.16 + rng() * 0.44;
      c.translate(x, y);
      c.drawImage(paperDab, -rx, -ry, rx * 2, ry * 2);
      c.restore();
    }
    const g = c.createLinearGradient(0, 0.56 * state.H, 0, state.H * 1.02);
    g.addColorStop(0, rgba(paper, 0));
    g.addColorStop(0.28, rgba(paper, 0.16));
    g.addColorStop(0.52, rgba(paper, 0.46));
    g.addColorStop(0.74, rgba(paper, 0.72));
    g.addColorStop(1, rgba(paper, 0.86));
    c.fillStyle = g;
    c.fillRect(0, 0.74 * state.H, state.W, state.H);

    for (let k = 0; k < 16; k++) {
      const x = rng() * state.W;
      const y = (0.78 + rng() * 0.2) * state.H;
      const rx = (140 + rng() * 320) * u();
      const ry = (18 + rng() * 50) * u();
      c.save();
      c.globalAlpha = 0.14 + rng() * 0.36;
      c.translate(x, y);
      c.drawImage(paperDab, -rx, -ry, rx * 2, ry * 2);
      c.restore();
    }
  }

  function paintBoat(c, seed) {
    const rng = rngFor(seed, 1234);
    const { paper, ink } = state.palette;
    const uu = u();
    const tone = mix(paper, ink, 0.82);
    const x = (0.80 + rng() * 0.07) * state.W;
    const y = (0.795 + rng() * 0.025) * state.H;
    const s = (38 + rng() * 10) * uu;
    const paint = rgba(tone, 0.6);

    c.save();
    c.lineCap = 'round';
    c.fillStyle = paint;
    c.beginPath();
    c.moveTo(x - s * 0.5, y);
    c.quadraticCurveTo(x, y + s * 0.26, x + s * 0.5, y);
    c.quadraticCurveTo(x, y + s * 0.09, x - s * 0.5, y);
    c.fill();

    const fx = x + s * 0.1, fy = y;
    c.beginPath();
    c.moveTo(fx - s * 0.055, fy);
    c.lineTo(fx - s * 0.035, fy - s * 0.21);
    c.lineTo(fx + s * 0.025, fy - s * 0.21);
    c.lineTo(fx + s * 0.045, fy);
    c.closePath();
    c.fill();
    c.beginPath();
    c.moveTo(fx - s * 0.105, fy - s * 0.225);
    c.quadraticCurveTo(fx - s * 0.01, fy - s * 0.325, fx + s * 0.085, fy - s * 0.225);
    c.closePath();
    c.fill();

    c.beginPath();
    c.moveTo(fx + s * 0.02, fy - s * 0.13);
    c.lineTo(fx + s * 0.34, fy - s * 0.6);
    c.lineWidth = 0.9 * uu;
    c.strokeStyle = rgba(tone, 0.4);
    c.stroke();

    for (let k = 0; k < 3; k++) {
      const yy = y + s * (0.12 + k * 0.075);
      c.beginPath();
      c.moveTo(x - s * (0.62 + rng() * 0.2), yy);
      c.quadraticCurveTo(x, yy + 1.2 * uu, x + s * (0.42 + rng() * 0.25), yy);
      c.lineWidth = (0.6 + rng() * 0.5) * uu;
      c.strokeStyle = rgba(tone, 0.1 + rng() * 0.1);
      c.stroke();
    }
    c.restore();
  }

  /* ── bamboo on the left margin ────────────────────────────── */
  function bambooLeaf(c, x, y, ang, len, wid, alpha, bend, tone) {
    const steps = 12;
    const nx = -Math.sin(ang), ny = Math.cos(ang);
    const tipx = x + Math.cos(ang) * len, tipy = y + Math.sin(ang) * len;
    const cx = x + Math.cos(ang) * len * 0.45 + nx * bend * len * 0.2;
    const cy = y + Math.sin(ang) * len * 0.45 + ny * bend * len * 0.2;
    const left = [], right = [];
    for (let i = 0; i <= steps; i++) {
      const t = i / steps, mt = 1 - t;
      const px = mt * mt * x + 2 * mt * t * cx + t * t * tipx;
      const py = mt * mt * y + 2 * mt * t * cy + t * t * tipy;
      const tx = 2 * mt * (cx - x) + 2 * t * (tipx - cx);
      const ty = 2 * mt * (cy - y) + 2 * t * (tipy - cy);
      const L = Math.hypot(tx, ty) || 1;
      const n2x = -ty / L, n2y = tx / L;
      const w = wid * Math.pow(Math.sin(Math.PI * Math.pow(t, 0.7)), 0.72);
      left.push([px + n2x * w, py + n2y * w]);
      right.push([px - n2x * w, py - n2y * w]);
    }
    c.beginPath();
    c.moveTo(left[0][0], left[0][1]);
    for (let i = 1; i < left.length; i++) c.lineTo(left[i][0], left[i][1]);
    for (let i = right.length - 1; i >= 0; i--) c.lineTo(right[i][0], right[i][1]);
    c.closePath();
    c.fillStyle = rgba(tone, alpha);
    c.fill();
  }

  function leafSpray(c, x, y, ang, rng, uu, scale, tone, count, alphaScale) {
    const tx = Math.cos(ang), ty = Math.sin(ang);
    if (AR() > 1) scale *= Math.pow(AR(), 0.4);
    for (let k = 0; k < count; k++) {
      const t = 0.1 + (count > 1 ? k * (0.85 / (count - 1)) : 0.4);
      const ox = x + tx * 46 * uu * scale * t + (rng() - 0.5) * 6 * uu;
      const oy = y + ty * 46 * uu * scale * t + (rng() - 0.5) * 6 * uu;
      const droop = rng() < 0.42 ? 0.48 : (rng() - 0.5) * 0.6;
      const len = (38 + rng() * 56) * uu * scale;
      bambooLeaf(c, ox, oy, ang + droop, len, len * (0.042 + rng() * 0.02),
        (0.48 + rng() * 0.45) * alphaScale, (rng() - 0.5) * 1.9, tone);
    }
  }

  function bambooStalk(c, seed, cfg, tone) {
    const rng = rngFor(seed, cfg.salt);
    const uu = u() * (AR() > 1 ? Math.pow(AR(), 0.26) : 1);
    const x0 = cfg.x * state.W, y0 = state.H + 10 * uu, y1 = cfg.top * state.H;
    const wBase = cfg.w * uu, wTop = cfg.w * 0.52 * uu;
    const N = 72;
    const at = (t) => [
      x0 + cfg.lean * state.W * t + Math.sin(t * 2.2 + cfg.phase) * cfg.bow * state.W,
      y0 + (y1 - y0) * t,
    ];
    const widthAt = (t) => wBase + (wTop - wBase) * Math.pow(t, 0.8);

    c.lineCap = 'butt';
    for (let k = 0; k < N; k++) {
      const t0 = k / N, t1 = (k + 1) / N;
      const p = at(t0), q = at(t1);
      c.beginPath();
      c.moveTo(p[0], p[1]);
      c.lineTo(q[0], q[1]);
      c.lineWidth = widthAt(t0) * 1.02;
      c.strokeStyle = rgba(tone, 0.82 + rng() * 0.12);
      c.stroke();
    }
    // a dry streak down one side
    c.beginPath();
    for (let k = 0; k <= N; k++) {
      const p = at(k / N);
      if (k === 0) c.moveTo(p[0] - widthAt(0) * 0.28, p[1]);
      else c.lineTo(p[0] - widthAt(k / N) * 0.28, p[1]);
    }
    c.lineWidth = Math.max(0.6, wBase * 0.14);
    c.strokeStyle = rgba(state.palette.paper, 0.4);
    c.stroke();

    // nodes
    const gap = 0.105 + rng() * 0.03;
    for (let t = gap * (0.6 + rng() * 0.5); t < 0.985; t += gap) {
      const p = at(t);
      const w = widthAt(t);
      c.beginPath();
      c.moveTo(p[0] - w * 0.98, p[1]);
      c.lineTo(p[0] + w * 0.98, p[1]);
      c.lineWidth = Math.max(2, w * 0.34);
      c.strokeStyle = rgba(state.palette.paper, 0.9);
      c.stroke();
      c.beginPath();
      c.moveTo(p[0] - w * 0.86, p[1] - Math.max(1.2, w * 0.28));
      c.lineTo(p[0] + w * 0.86, p[1] - Math.max(1.2, w * 0.28));
      c.lineWidth = Math.max(1.1, w * 0.16);
      c.strokeStyle = rgba(tone, 0.6);
      c.stroke();
    }

    // branches and leaves
    const branches = 3 + Math.floor(rng() * 3);
    for (let b = 0; b < branches; b++) {
      const t = 0.22 + (b / branches) * 0.66 + rng() * 0.06;
      const p = at(t);
      const dir = rng() < 0.5 ? 1 : -1;
      const blen = (0.09 + rng() * 0.13) * state.H;
      const ex = p[0] + dir * blen * 0.82;
      const ey = p[1] - blen * (0.42 + rng() * 0.25);
      c.beginPath();
      c.moveTo(p[0], p[1]);
      c.bezierCurveTo(p[0] + dir * blen * 0.3, p[1] - blen * 0.1,
        (p[0] + ex) / 2, (p[1] + ey) / 2, ex, ey);
      c.lineWidth = Math.max(1, (2.4 - t * 1.6) * uu);
      c.strokeStyle = rgba(tone, 0.7);
      c.stroke();

      const sprays = 2 + (rng() < 0.5 ? 1 : 0);
      for (let s = 0; s < sprays; s++) {
        const tt = 0.45 + s * 0.28;
        const lx = p[0] + (ex - p[0]) * tt + (rng() - 0.5) * 6 * uu;
        const ly = p[1] + (ey - p[1]) * tt + (rng() - 0.5) * 6 * uu;
        const baseAng = (dir > 0 ? 0.55 : Math.PI - 0.55) + (rng() - 0.5) * 0.35;
        leafSpray(c, lx, ly, baseAng, rng, uu, 1, tone, 2 + Math.floor(rng() * 3), 1);
      }
    }

    const crown = at(0.97);
    leafSpray(c, crown[0], crown[1], -Math.PI / 2 + (rng() - 0.5) * 0.8, rng, uu, 1.05, tone, 4, 1);
    leafSpray(c, crown[0] + 10 * uu, crown[1] + 34 * uu, -0.35 + (rng() - 0.5) * 0.5, rng, uu, 1.15, tone, 3, 1);
  }

  function paintBamboo(c, seed) {
    const rng = rngFor(seed, 1717);
    const { paper, ink } = state.palette;
    const tone = mix(paper, ink, state.palette.dark ? 0.86 : 0.94);
    // a few pale leaves behind, for depth
    const paleTone = mix(paper, ink, 0.4);
    for (let k = 0; k < 3; k++) {
      const x = (0.05 + rng() * 0.12) * state.W;
      const y = (0.16 + rng() * 0.3) * state.H;
      leafSpray(c, x, y, (rng() - 0.5) * 6, rng, u(), 1, paleTone, 3, 1);
    }
    for (const cfg of BAMBOO) {
      bambooStalk(c, seed, {
        ...cfg,
        x: cfg.x + (rng() - 0.5) * 0.006,
        top: cfg.top + (rng() - 0.5) * 0.02,
      }, tone);
    }
  }

  /* ── paper texture ────────────────────────────────────────── */
  let grainTile = null;
  function makeGrain() {
    if (grainTile) return grainTile;
    const rng = rngFor(7, 4242);
    const S = 320;
    const cv = document.createElement('canvas');
    cv.width = cv.height = S;
    const g = cv.getContext('2d');
    const img = g.createImageData(S, S);
    for (let i = 0; i < S * S; i++) {
      const v = 124 + (rng() * 2 - 1) * 46;
      const o = i * 4;
      img.data[o] = img.data[o + 1] = img.data[o + 2] = v;
      img.data[o + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    grainTile = cv;
    return cv;
  }

  function paintPaper(c, seed) {
    const rng = rngFor(seed, 77);
    const uu = u();
    const pat = c.createPattern(makeGrain(), 'repeat');
    c.save();
    c.globalCompositeOperation = 'overlay';
    c.globalAlpha = state.palette.dark ? 0.16 : 0.2;
    c.fillStyle = pat;
    c.fillRect(0, 0, state.W, state.H);
    c.restore();

    c.save();
    for (let k = 0; k < 120; k++) {
      const y = rng() * state.H, x = rng() * state.W;
      const len = (10 + rng() * 80) * uu;
      c.beginPath();
      c.moveTo(x, y);
      c.quadraticCurveTo(x + len * 0.5, y + (rng() - 0.5) * 2 * uu, x + len, y + (rng() - 0.5) * 1.5 * uu);
      c.lineWidth = 0.6 * uu;
      c.strokeStyle = rgba(state.palette.ink, 0.02 + rng() * 0.02);
      c.stroke();
    }
    c.restore();
  }

  /* ── base painting ────────────────────────────────────────── */
  function renderBase() {
    if (!baseCtx) return;
    const { paper, dark } = state.palette;
    const gain = dark ? 0.78 : 1.32;
    const c = baseCtx;
    // map the design space onto the bitmap (and re-apply on every repaint)
    c.setTransform(baseCv.width / state.W, 0, 0, baseCv.height / state.H, 0, 0);
    paintSky(c);

    // the centre range: heavy ink on the canvas, a whisper through the paper
    const centreTone = { alpha: dark ? 0.78 : 0.82, dab: 260, k: dark ? 0.48 : 0.52 };
    CENTER.forEach((m, ci) => {
      const rng = rngFor(state.seed, 820 + ci * 5);
      const mass = makeMassif(state.seed, 1520 + ci * 9, m);
      paintMass(c, mass.pts, mass.base, centreTone, rng);
    });
    fogVeil(c, rngFor(state.seed, 833), 0.560, 0.20);

    // …and keep it inside the paper panel: outside it fades back to bare paper
    (() => {
      const { l, r } = state.page;
      const f = 130 * u();
      const sky = skyGradient(c);
      const restore = (x0, x1) => {
        if (x1 <= x0) return;
        c.fillStyle = sky;
        c.fillRect(x0, 0, x1 - x0, state.H);
      };
      restore(0, l - f);
      restore(r + f, state.W);
      // feather back to the sky wash on both sides
      const sfx = c.createLinearGradient(l - f, 0, l + f, 0);
      sfx.addColorStop(0, rgba(state.palette.paper, 1));
      sfx.addColorStop(1, rgba(state.palette.paper, 0));
      c.fillStyle = sfx;
      c.fillRect(l - f, 0, f * 2, state.H);
      const sfr = c.createLinearGradient(r + f, 0, r - f, 0);
      sfr.addColorStop(0, rgba(state.palette.paper, 1));
      sfr.addColorStop(1, rgba(state.palette.paper, 0));
      c.fillStyle = sfr;
      c.fillRect(r - f, 0, f * 2, state.H);
    })();

    const crests = [[], [], [], []];
    for (let t = 0; t < TIERS.length; t++) {
      const tier = TIERS[t];
      tier.masses.forEach((m, mi) => {
        const rng = rngFor(state.seed, 600 + t * 40 + mi * 7);
        const mass = makeMassif(state.seed, 900 + t * 40 + mi * 11, m);
        paintMass(c, mass.pts, mass.base, { ...tier.tone, alpha: tier.tone.alpha * gain, k: [0.14, 0.26, 0.40, 0.54][t] }, rng);
        crests[t].push(mass.pts);
      });
      fogVeil(c, rngFor(state.seed, 700 + t * 13), tier.veil.y, tier.veil.s);
    }

    paintCloudSea(c, rngFor(state.seed, 333));
    paintMoon(c);
    paintBoat(c, state.seed);
    paintBamboo(c, state.seed);
    paintPaper(c, state.seed);

    // a whisper of paper at the very edges keeps the page feeling printed
    const edge = c.createLinearGradient(0, 0, state.W * 0.06, 0);
    edge.addColorStop(0, rgba(paper, 0.5));
    edge.addColorStop(1, rgba(paper, 0));
    c.fillStyle = edge;
    c.fillRect(0, 0, state.W * 0.06, state.H);
  }

  /* ── live layer: mist and birds ───────────────────────────── */
  const wispSprite = (() => {
    if (illustrated) {
      // A feathered bank of cloud for the illustrated mountainside.
      const cloud = document.createElement('canvas');
      cloud.width = 448;
      cloud.height = 104;
      const brush = cloud.getContext('2d');
      const dab = dabSprite([247, 243, 224]);
      const rng = rngFor(31, 616);
      const contour = makeNoise1D(rng);
      for (let i = 0; i < 140; i++) {
        const along = rng();
        const taper = Math.sin(along * Math.PI);
        const width = 32 + rng() * 78 * taper;
        const height = width * (.35 + rng() * .35);
        const x = 28 + along * (cloud.width - 56);
        const y = 52 + 20 * contour(along * 4) + (rng() - .5) * 21 * taper;
        brush.globalAlpha = (.2 + rng() * .36) * taper;
        brush.drawImage(dab, x - width / 2, y - height / 2, width, height);
      }
      return cloud;
    }
    const S = 256, cv = document.createElement('canvas');
    cv.width = cv.height = S;
    const g = cv.getContext('2d');
    const grd = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
    grd.addColorStop(0, 'rgba(255,255,255,.9)');
    grd.addColorStop(0.4, 'rgba(255,255,255,.48)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, S, S);
    return cv;
  })();

  function buildWisps() {
    const rng = rngFor(state.seed, 616);
    const upperBand = illustrated ? 0.22 : 0.3;
    const upperOpacity = illustrated ? 0.22 : 0.05;
    state.wisps = [];
    for (let i = 0; i < 14; i++) {
      const deep = i > 8;
      state.wisps.push({
        x: rng(),
        y: (deep ? 0.6 : upperBand) + rng() * 0.34,
        r: (deep ? 0.3 : 0.22) * state.W * (0.7 + rng() * 0.9),
        alpha: (deep ? 0.2 : upperOpacity) + rng() * (deep ? 0.16 : 0.05),
        speed: 0.003 + rng() * 0.006,
        bob: 0.1 + rng() * 0.16,
        phase: rng() * 6.28,
        amp: 2 + rng() * 7,
      });
    }
  }

  function buildBirds() {
    const rng = rngFor(state.seed, 717);
    state.birds = [];
    const n = illustrated ? 3 : 4 + Math.floor(rng() * 3);
    const cx = (illustrated ? 0.72 : 0.925) + rng() * 0.045;
    const cy = (illustrated ? 0.14 : 0.235) + rng() * 0.075;
    for (let i = 0; i < n; i++) {
      state.birds.push({
        x: cx + (rng() - 0.5) * 0.11,
        y: cy + (rng() - 0.5) * 0.09,
        s: 7 + rng() * 6,
        ph: rng() * 6.28,
        sp: (illustrated ? 0.011 : 0.003) + rng() * 0.003,
        ox: 0,
        oy: 0,
        vx: 0,
        vy: 0,
        alarm: 0,
      });
    }
  }

  function paintLive(t, dt = 0) {
    const c = liveCtx;
    const { W, H } = state;
    c.clearRect(0, 0, W, H);
    const { paper, ink } = state.palette;

    // mist: paper-coloured veils drifting across the ranges
    const mistWidth = illustrated ? 1.8 : 1;
    const mistAspect = illustrated ? wispSprite.width / wispSprite.height : 2.1;
    const mistStrength = illustrated && state.palette.dark ? 0.62 : 1;
    for (const w of state.wisps) {
      const wx = ((w.x - t * w.speed) % 1.4 + 1.4) % 1.4 - 0.2;
      const px = wx * W;
      const py = (w.y + Math.sin(t * w.bob + w.phase) * 0.008) * H + Math.sin(t * 0.2 + w.phase) * w.amp;
      const a = w.alpha * (0.7 + 0.3 * Math.sin(t * 0.29 + w.phase));
      const width = w.r * mistWidth;
      const height = width / mistAspect;
      c.globalAlpha = a * mistStrength;
      c.drawImage(wispSprite, px - width / 2, py - height / 2, width, height);
    }
    c.globalAlpha = 1;

    // Cross the darker slopes at different depths. Fade only at the ends of a pass.
    if (mistImage?.complete && mistImage.naturalWidth) {
      for (const band of mistBands) {
        const phase = (t / band.seconds + band.phase) % 1;
        const width = W * band.width * (1 + .12 * phase);
        const height = width * band.depth;
        const x = W * (1.08 - band.travel * phase);
        const y = state.artTop + state.artHeight * (band.level - .035 * phase + .012 * Math.sin(phase * 6.28));
        const fade = Math.min(1, phase / .16, (1 - phase) / .18);
        c.globalAlpha = band.alpha * fade * (state.palette.dark ? .57 : 1);
        c.drawImage(mistImage, x - width / 2, y - height / 2, width, height);
      }
      c.globalAlpha = 1;
    }

    // Birds keep their own spring offsets. A nearby pointer startles the flock;
    // release lets each bird settle independently instead of snapping back.
    const tone = mix(paper, ink, 0.85);
    const pointer = state.pointer;
    for (const b of state.birds) {
      const x = ((b.x - t * b.sp) % 1.4 + 1.4) % 1.4;
      let px = x * W;
      let py = (b.y + Math.sin(t * 0.32 + b.ph) * 0.004) * H;
      let tx = 0;
      let ty = 0;
      if (pointer.active) {
        const dx = px - pointer.x;
        const dy = py - pointer.y;
        const distance = Math.hypot(dx, dy) || 1;
        const radius = Math.max(95, 155 * (W / 1440));
        if (distance < radius) {
          const force = (1 - distance / radius) ** 2 * 46;
          tx = dx / distance * force;
          ty = dy / distance * force * .72;
        }
      }
      if (dt > 0) {
        b.vx += (tx - b.ox) * 62 * dt;
        b.vy += (ty - b.oy) * 62 * dt;
        const damping = Math.exp(-8.5 * dt);
        b.vx *= damping;
        b.vy *= damping;
        b.ox += b.vx * dt;
        b.oy += b.vy * dt;
        b.alarm = clamp(Math.hypot(b.ox, b.oy) / 28, 0, 1);
      }
      px += b.ox;
      py += b.oy;
      const flap = Math.sin(t * (2.2 + b.alarm * 3.4) + b.ph);
      const s = b.s * (W / 1440) * 1.6;
      if (illustrated) {
        paintCrane(c, px, py, s, flap, state.palette.dark);
        continue;
      }
      c.beginPath();
      c.moveTo(px - s, py + flap * s * 0.4);
      c.quadraticCurveTo(px - s * 0.42, py - s * (0.52 - flap * 0.22), px, py);
      c.quadraticCurveTo(px + s * 0.42, py - s * (0.52 - flap * 0.22), px + s, py + flap * s * 0.4);
      c.lineWidth = Math.max(0.8, 1.05 * (W / 1440));
      c.strokeStyle = rgba(tone, 0.62 + b.alarm * .2);
      c.stroke();
    }
  }

  /* ── sizing ───────────────────────────────────────────────── */
  function resize() {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    state.W = 1440;
    state.H = Math.round(clamp(1440 * vh / Math.max(1, vw), 700, 3200));
    if (artwork) {
      const rect = artwork.getBoundingClientRect();
      state.artTop = rect.top * state.H / vh;
      state.artHeight = rect.height * state.H / vh;
    }

    // the typeset panel: the centre range is only allowed to show through it
    const shell = document.querySelector('.site-shell');
    if (shell) {
      const r = shell.getBoundingClientRect();
      state.page = {
        l: clamp((r.left / vw) * state.W, 0, state.W),
        r: clamp((r.right / vw) * state.W, 0, state.W),
      };
    }

    // base: up to 1.4x device pixels, capped for wide screens
    if (baseCtx) {
      const bs = Math.min(dpr, 1.4);
      const bw = Math.max(1, Math.round(vw * bs));
      const bh = Math.max(1, Math.round(bw * state.H / state.W));
      baseCv.width = bw;
      baseCv.height = bh;
      renderBase();
    }

    // live: CSS pixels are plenty for soft mist
    liveCv.width = Math.max(1, Math.round(vw));
    liveCv.height = Math.max(1, Math.round(vh));
    liveCtx.setTransform(liveCv.width / state.W, 0, 0, liveCv.height / state.H, 0, 0);
    buildWisps();
    buildBirds();
    paintLive(performance.now() / 1000);
  }

  /* ── loop ─────────────────────────────────────────────────── */
  function tick(now) {
    state.raf = 0;
    if (document.hidden || reduced.matches) return;
    if (now - state.lastPaint < 33) { state.raf = requestAnimationFrame(tick); return; }
    const dt = state.lastTime ? Math.min((now - state.lastTime) / 1000, .05) : 1 / 30;
    state.lastPaint = now;
    state.lastTime = now;
    paintLive(now / 1000, dt);
    state.raf = requestAnimationFrame(tick);
  }
  function start() {
    if (state.raf || reduced.matches || document.hidden) return;
    if (mistImage && !mistImage.hasAttribute('src')) mistImage.src = liveCv.dataset.mistSrc;
    state.lastPaint = 0;
    state.lastTime = 0;
    state.raf = requestAnimationFrame(tick);
  }
  function stop() {
    if (state.raf) cancelAnimationFrame(state.raf);
    state.raf = 0;
  }

  /* ── wiring ───────────────────────────────────────────────── */
  let resizeTimer = 0;
  const onResize = () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(resize, 160);
  };
  window.addEventListener('resize', onResize, { passive: true });

  const onPointerMove = (event) => {
    if (reduced.matches || (event.pointerType === 'touch' && !event.buttons)) return;
    state.pointer.x = event.clientX / Math.max(1, window.innerWidth) * state.W;
    state.pointer.y = event.clientY / Math.max(1, window.innerHeight) * state.H;
    state.pointer.active = true;
  };
  const onPointerUp = (event) => {
    if (event.pointerType === 'touch') state.pointer.active = false;
  };
  const onPointerLeave = () => { state.pointer.active = false; };
  window.addEventListener('pointermove', onPointerMove, { passive: true });
  window.addEventListener('pointerup', onPointerUp, { passive: true });
  window.addEventListener('blur', onPointerLeave);
  document.documentElement.addEventListener('pointerleave', onPointerLeave);

  const onVisibility = () => {
    if (document.hidden) stop();
    else start();
  };
  document.addEventListener('visibilitychange', onVisibility);

  const onMotionChange = () => {
    if (reduced.matches) {
      stop();
      state.pointer.active = false;
      for (const bird of state.birds) {
        bird.ox = bird.oy = bird.vx = bird.vy = bird.alarm = 0;
      }
      paintLive(0);
    } else start();
  };
  if (reduced.addEventListener) reduced.addEventListener('change', onMotionChange);

  // re-render when the site's theme flips
  const themeObserver = new MutationObserver(() => {
    state.palette = readPalette();
    renderBase();
    paintLive(reduced.matches ? 0 : performance.now() / 1000);
  });
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });

  resize();
  start();

  return {
    reseed(seed) {
      state.seed = seed >>> 0;
      resize();
    },
    destroy() {
      stop();
      window.removeEventListener('resize', onResize);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('blur', onPointerLeave);
      document.documentElement.removeEventListener('pointerleave', onPointerLeave);
      document.removeEventListener('visibilitychange', onVisibility);
      if (reduced.removeEventListener) reduced.removeEventListener('change', onMotionChange);
      themeObserver.disconnect();
    },
  };
}
