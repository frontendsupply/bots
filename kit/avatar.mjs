// Bots kit: renders a character file (JSON) as a self-contained, animated SVG. No dependencies.
//
// Look: a flat colour disc with off-register ink line art. Motion: each state (idle, working, sleeping) is a loop
// of beats. Each beat is an expression (swapped instantly, like hand-drawn frames), a body action
// (squash & stretch, jumps, head turns) and an effect (sparkles, grawlix, sweat…). The ink lines
// "boil" constantly, so nothing is ever fully still.
//
// The file format is documented in ../SKILL.md. The main entry points:
//   render(character, { state: 'idle' | 'working' | 'sleeping', size: 128 }) → SVG string
//   check(character) → array of readable error messages (empty means valid)

/**
 * @typedef {{ x?: number, y?: number, r?: number, sx?: number, sy?: number, o?: number }} Pose
 * @typedef {[number, Pose, string?]} Key  t 0..1, pose, ease name
 * @typedef {{ period?: number, keys: Key[] }} Motion  with `period` (seconds) the keys repeat to fill the beat
 * @typedef {[string, string, string, number]} Beat  [mood, action, effect or "", seconds]
 * @typedef {{ at: 'back'|'front'|'face'|'over'|'top', svg: string, origin?: string, loop?: Motion, react?: Record<string, Motion> }} Layer
 * @typedef {{ eye: string | [string, string], brow?: [string, string], mouth: string, blush?: boolean, blink?: boolean }} Mood  eye: a built-in name or your own SVG (one for both eyes, or [left, right])
 * @typedef {{
 *   name: string, prompt?: string, color: string, colors?: Record<string, string>, disc?: { x?: number, y?: number, r?: number, shape?: string },
 *   parts?: Record<string, string>, face?: { x?: number, y?: number, spacing?: number },
 *   layers?: Layer[], moods?: Record<string, Mood>, actions?: Record<string, { body?: Motion, face?: Motion, top?: Motion }>,
 *   fx?: Record<string, Array<{ x: number, y: number, svg: string } & Motion>>,
 *   idle: Beat[], working: Beat[], sleeping?: Beat[]
 * }} Character
 */

export const COLORS = {
  blue: '#2E7FF7',
  yellow: '#FBBD2E',
  green: '#2EA043',
  red: '#F2463A',
  purple: '#9B6BCC',
  orange: '#FFA21C',
}

/** built-in parts; the first value of each list is the default */
export const PARTS = {
  eyes: ['dots', 'tiny', 'ring'],
  mouth: ['mood', 'mustache', 'beak', 'nose', 'cat', 'teeth'],
  top: ['none', 'tophat', 'fedora', 'antenna', 'ears', 'bow', 'headphones', 'crown', 'sprout'],
  neck: ['none', 'bowtie'],
  extra: ['none', 'glasses', 'freckles', 'whiskers'],
  outline: ['none', 'ring', 'curls', 'swoop'],
}
export const STATES = ['idle', 'working', 'sleeping']

const INK = '#151515',
  PAPER = '#fff',
  CX = 50,
  CY = 54,
  R = 28,
  FACE = 1.3
const INK_ATTRS = `fill="none" stroke="${INK}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"`

const f = (n) => +n.toFixed(2)
const p = (d, attrs = '') => `<path d="${d}" ${attrs}/>`
const dot = (x, y, r) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${INK}" stroke="none"/>`
const at = (x, y, svg, extra = '') => `<g transform="translate(${f(x)} ${f(y)})${extra}">${svg}</g>`
const mirror = (svg) => `${svg}<g transform="scale(-1 1)">${svg}</g>`
const esc = (s) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)
const pt = (a, r) => `${f(CX + r * Math.cos(a))} ${f(CY + r * Math.sin(a))}`

function hash(s) {
  let h = 2166136261 // FNV-1a + avalanche so short names spread well
  for (const c of s) h = Math.imul(h ^ c.codePointAt(0), 16777619)
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b)
  return (h ^ (h >>> 13)) >>> 0
}

function rng(seed) {
  let h = hash(seed) // mulberry32
  return () => {
    h = (h + 0x6d2b79f5) | 0
    let t = Math.imul(h ^ (h >>> 15), 1 | h)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// ─── Drawings ──────────────────────────────────────────────────────────────────────────────

const EYES = {
  dots: dot(0, 0, 2),
  tiny: dot(0, 0, 1.4),
  ring: `<circle r="3.3" fill="${PAPER}"/>${dot(0.9, 0.5, 1.3)}`,
  wide: `<circle r="3.8" fill="${PAPER}"/>${dot(0, 0, 1.5)}`,
  happy: p('M-2.6 1.2Q0-2.6 2.6 1.2'),
  closed: p('M-2.6-.6Q0 2.6 2.6-.6'),
  down: dot(0, 1.4, 1.8),
}

const MOUTHS = {
  open:
    p('M-5.5-1.5Q0 10 5.5-1.5Z', `fill="${INK}"`) +
    p('M-2.4 3.2Q0 1.6 2.4 3.2', `stroke="${PAPER}" stroke-width="1.2"`),
  grit: `<rect x="-4.6" y="-2" width="9.2" height="4" rx="1.6" fill="${PAPER}"/>${p('M-4.6 0H4.6M-1.5-2V2M1.5-2V2')}`,
  o: `<ellipse rx="2" ry="2.6" fill="${PAPER}"/>`,
  osmall: `<ellipse rx="1.3" ry="1.6" fill="${PAPER}"/>`,
  none: '',
}

/** expressions: eyes and brows are drawn per eye ([left, right] brows); mouth is a path or a MOUTHS key */
const MOODS = {
  neutral: { eye: 'base', mouth: 'M-2.6 0Q0 2.2 2.6 0' },
  happy: { eye: 'base', mouth: 'M-4.8-.5Q0 5 4.8-.5' },
  laugh: { eye: 'happy', mouth: 'open' },
  skeptic: { eye: 'base', brow: ['M-3-5.6Q0-8.2 3-5.9', 'M-3-4.2H3'], mouth: 'M-4 .6Q-2-1.4 0 .6T4 .6' },
  sad: { eye: 'base', brow: ['M-3.2-3.6L2.6-5.6', 'M-2.6-5.6L3.2-3.6'], mouth: 'M-4 2.2Q0-2.4 4 2.2' },
  angry: { eye: 'base', brow: ['M-3.2-5.8L2.6-3.4', 'M-2.6-3.4L3.2-5.8'], mouth: 'grit' },
  surprised: { eye: 'wide', brow: ['M-3-6.4Q0-8.4 3-6.4', 'M-3-6.4Q0-8.4 3-6.4'], mouth: 'o' },
  bliss: { eye: 'closed', mouth: 'M-3 0Q0 3 3 0', blush: true },
  cool: { eye: 'base', mouth: 'M-4 1Q1 3.6 4.6-1.2' },
  shy: { eye: 'down', mouth: 'M-2.2.6Q-1.1-.6 0 .6T2.2.6', blush: true },
  focus: { eye: 'base', brow: ['M-3-4.8L2.6-3.6', 'M-2.6-3.6L3-4.8'], mouth: 'M-3 .5H3' },
  sleep: { eye: 'closed', mouth: 'osmall' },
}
const BLUSH = p('M-2 1.4L-.6-1.4M.6 1.4L2-1.4')

/** fixed mouths that stay through every mood: [distance below the eyes, still drawing, moving part] */
const IDENTITY = {
  mustache: [
    7,
    '',
    mirror(p('M0-1C2-3.5 6-3 7.5-.5C8.2.8 9.6.4 10-1.2C10 2.5 7 3.5 4.5 2C3 1.2 1.5 1 0 1.2Z', `fill="${PAPER}"`)),
  ],
  beak: [
    6.5,
    p('M0-3C6-6 14-4.6 18-1.2C13-1 6-.4 0 .4Z', `fill="${PAPER}"`),
    p('M.5 1.6C5 1.4 10 1.6 14 2.4C10 5.2 4.5 5.1.5 3.8Z', `fill="${PAPER}"`),
  ],
  nose: [4, p('M0-4.5L-2.6 1.5H2.6Z'), ''],
  cat: [8, p('M-1.8-3.2H1.8L0-1.2Z', `fill="${INK}"`) + p('M0-1.2V.4M-3.6 0Q-1.8 2.8 0 .4Q1.8 2.8 3.6 0'), ''],
  teeth: [10, `<rect x="-9" y="-2.4" width="18" height="4.8" rx="2.4" fill="${PAPER}"/>${p('M-7 0H7')}`, ''],
}

/** hats and head pieces, placed at the top of the disc */
const TOPS = {
  tophat: {
    y: 26.5,
    svg:
      `<rect x="-7" y="-2.4" width="14" height="2.4" rx="1.2" fill="${INK}"/><rect x="-4.6" y="-12" width="9.2" height="10" rx=".6" fill="${INK}"/>` +
      p('M-4.6-4.4H4.6', `stroke="${PAPER}" stroke-width="1.2"`),
  },
  fedora: {
    y: 31,
    r: -10,
    svg: p('M-8 0L-6.5-9Q0-12.5 6.5-9.5L8 0') + p('M-7.4-3.6Q0-5.6 7.6-3.8') + p('M-18 1.5Q0-3 18 .5'),
  },
  antenna: { y: 26.5, svg: `${p('M0 0V-8')}<circle cy="-10.2" r="2.2" fill="${PAPER}"/>` },
  ears: {
    y: 31,
    back: true,
    svg: mirror(
      `<g transform="rotate(16 7 -12)"><ellipse cx="7" cy="-12" rx="3.8" ry="10" fill="${PAPER}"/>${p('M7-17.5Q6.2-12 7-7')}</g>`,
    ),
  },
  bow: {
    x: 34,
    y: 31,
    r: -22,
    svg: `${mirror(p('M0 0C-3-6-10-6-10-1C-10 4-4 4 0 0Z', `fill="${PAPER}"`))}<circle r="2" fill="${PAPER}"/>`,
  },
  headphones: {
    y: CY,
    still: true,
    svg:
      p('M-31 0C-31-44 31-44 31 0') + mirror(`<rect x="-34.5" y="-7" width="7" height="14" rx="3.5" fill="${PAPER}"/>`),
  },
  crown: {
    y: 28.5,
    svg:
      p('M-9 0L-10.5-11L-5-5.5L0-13L5-5.5L10.5-11L9 0Z') +
      [-10.5, 0, 10.5].map((x) => `<circle cx="${x}" cy="${x ? -11 : -13}" r="1.3" fill="${PAPER}"/>`).join(''),
  },
  sprout: {
    y: 26.5,
    svg:
      p('M0 1Q1.5-5 0-10') +
      p('M0-8C-3-13-9-13-10-9C-7-6-3-6 0-8Z', `fill="${PAPER}"`) +
      p('M.5-9C3-14 8-15 10-12C8-8.5 4-8 .5-9Z', `fill="${PAPER}"`),
  },
}

const CURLS = (() => {
  const n = 7,
    a0 = Math.PI * 1.08,
    a1 = Math.PI * 1.92,
    step = (a1 - a0) / n
  let d = `M${pt(a0, R + 1)}`
  for (let i = 1; i <= n; i++) d += `Q${pt(a0 + step * (i - 0.5), R + 7)} ${pt(a0 + step * i, R + 1)}`
  return p(d)
})()
const SWOOP = p('M27 44C27 24 52 16 68 25C82 33 84 56 74 72C70 78 64 80 62 76C68 64 66 48 58 38C52 32 42 32 34 38')

// effect glyphs
const Q_MARK = p('M-2.6-3.6Q-2.6-7.4.6-7.4Q3.8-7.4 3.8-4.4Q3.8-2.2 1.2-1.2Q0-.6 0 1.4') + dot(0, 4.2, 1)
const SPARK = p('M0-4V4M-4 0H4')
const HASH = p('M-1.4-3.6L-2.4 3.6M2.2-3.6L1.2 3.6M-3.4-1.2H3.4M-3.8 1.4H3')
const BANG = p('M0-4V1.2') + dot(0, 3.8, 1)
const AT = `<circle r="1.5"/>${p('M1.5.6Q2.2 2.4 3.4.4Q3.6-3.8 0-3.8Q-3.8-3.8-3.8 0Q-3.8 3.8 0 3.8Q1.6 3.8 2.6 3')}`
const NOTE =
  `<ellipse cx="-1" cy="2" rx="2" ry="1.4" transform="rotate(-20 -1 2)" fill="${INK}"/>` +
  p('M.8 1.6V-5Q2.6-4.4 3.6-2.6')
const HEART = p(
  'M0 3C-3.6 .2-4.2-2.6-2.2-3.6C-1-4.2 0-3.2 0-2.4C0-3.2 1-4.2 2.2-3.6C4.2-2.6 3.6.2 0 3Z',
  `fill="${PAPER}"`,
)
const DROP = p('M0-3.4Q2.6.4 2.6 1.4Q2.6 3.4 0 3.4Q-2.6 3.4-2.6 1.4Q-2.6.4 0-3.4Z', `fill="${PAPER}"`)
const ZED = p('M-2-2H2L-2 2H2')
const TICKS = p(
  Array.from({ length: 7 }, (_, i) => {
    const a = ((-160 + i * 23.3) * Math.PI) / 180
    return `M${pt(a, R + 5)}L${pt(a, R + 11)}`
  }).join(''),
)
const SHAKE_LINES = p('M13 44Q9 54 13 64M8 48Q5 54 8 60M87 44Q91 54 87 64M92 48Q95 54 92 60')
const shades = (s) =>
  [-1, 1]
    .map((k) =>
      p(
        `M${f(k * s - 4.8)}-2.6H${f(k * s + 4.8)}Q${f(k * s + 4.6)} 3.6 ${f(k * s)} 3.6Q${f(k * s - 4.6)} 3.6 ${f(k * s - 4.8)}-2.6Z`,
        `fill="${INK}"`,
      ),
    )
    .join('') + p(`M${f(4.8 - s)}-1.6H${f(s - 4.8)}M${f(-s - 4.8)}-2L${f(-s - 9)}-3.4M${f(s + 4.8)}-2L${f(s + 9)}-3.4`)

// ─── Motion ────────────────────────────────────────────────────────────────────────────────

export const EASES = {
  out: 'cubic-bezier(.33,1,.68,1)', // decelerate
  in: 'cubic-bezier(.32,0,.67,0)', // accelerate (falls, anticipation)
  io: 'cubic-bezier(.65,0,.35,1)',
  sine: 'cubic-bezier(.37,0,.63,1)',
  back: 'cubic-bezier(.34,1.56,.64,1)', // overshoot & settle
  ioBack: 'cubic-bezier(.68,-.6,.32,1.6)', // wind up, overshoot
  step: 'step-end', // hand-drawn frame swap
}
const E = EASES,
  S = E.sine

/** repeat a 0..1 pattern to fill a beat of d seconds with a whole number of cycles of about `period` */
function rep(d, period, pat) {
  const n = Math.max(1, Math.round(d / period)),
    out = []
  for (let i = 0; i < n; i++) for (const [t, pose, e] of pat) out.push([(i + t) / n, pose, e])
  return out
}
/** ease into a pose, hold it, ease back out to rest */
function hold(d, pose, tIn = 0.25) {
  const a = Math.min(tIn / d, 0.3)
  return [
    [0, {}, E.back],
    [a, pose, S],
    [1 - a, pose, E.io],
    [1, {}],
  ]
}

/** built-in body actions: (beat seconds, turn side ±1) → { body, face, top } keys over 0..1 */
const ACTIONS = {
  idle: (d) => ({
    body: rep(d, 2.4, [
      [0, {}, S],
      [0.5, { y: -1.4, sx: 0.99, sy: 1.015 }, S],
      [1, {}],
    ]),
    top: rep(d, 2.4, [
      [0, {}, S],
      [0.6, { y: -0.4, r: 2 }, S],
      [1, {}],
    ]),
  }),
  // a slow look to one side and back, for idle
  glance: (_, s) => ({
    face: [
      [0, {}, E.io],
      [0.25, { x: 3 * s }, S],
      [0.65, { x: 3 * s }, E.io],
      [0.9, {}, S],
      [1, {}],
    ],
    body: [
      [0, {}, S],
      [0.45, { r: 2 * s }, S],
      [1, {}],
    ],
  }),
  bop: (d) => ({
    body: rep(d, 0.5, [
      [0, {}, E.out],
      [0.42, { y: -6, sx: 0.95, sy: 1.06 }, E.in],
      [0.8, { sx: 1.1, sy: 0.9 }, E.out],
      [1, {}],
    ]),
    face: rep(d, 0.5, [
      [0, {}, E.out],
      [0.42, { y: -1 }, E.in],
      [0.85, { y: 1.2 }, E.out],
      [1, {}],
    ]),
    top: rep(d, 0.5, [
      [0, {}, E.out],
      [0.5, { y: -3, r: 6 }, E.in],
      [0.9, { y: 1, r: -3 }, E.out],
      [1, {}],
    ]),
  }),
  turn: (_, s) => ({
    face: [
      [0, {}, E.ioBack],
      [0.16, { x: 8 * s, sx: 0.88, r: 4 * s }, S],
      [0.5, { x: 7 * s, y: -1, sx: 0.88, r: 3 * s }, S],
      [0.84, { x: 8 * s, sx: 0.88, r: 4 * s }, E.ioBack],
      [1, {}],
    ],
    body: [
      [0, {}, E.back],
      [0.16, { r: 5 * s }, S],
      [0.84, { r: 5 * s }, E.back],
      [1, {}],
    ],
    top: [
      [0, {}, E.back],
      [0.2, { x: 2 * s, r: 9 * s }, S],
      [0.84, { x: 2 * s, r: 7 * s }, E.back],
      [1, {}],
    ],
  }),
  tilt: (_, s) => ({
    body: [
      [0, {}, E.back],
      [0.14, { r: -14 * s }, S],
      [0.5, { y: -1, r: -11 * s }, S],
      [0.86, { r: -14 * s }, E.back],
      [1, {}],
    ],
    face: [
      [0, {}, E.io],
      [0.14, { x: -4 * s, y: -3 }, S],
      [0.86, { x: -4 * s, y: -3 }, E.io],
      [1, {}],
    ],
    top: [
      [0, {}, E.back],
      [0.18, { y: -1, r: -10 * s }, S],
      [0.86, { r: -6 * s }, E.back],
      [1, {}],
    ],
  }),
  pop: () => ({
    body: [
      [0, {}, E.in],
      [0.18, { y: 1.5, sx: 1.16, sy: 0.82 }, E.back],
      [0.32, { y: -5, sx: 0.88, sy: 1.16 }, E.out],
      [0.48, { sx: 1.05, sy: 0.96 }, E.back],
      [0.58, {}, S],
      [0.66, { y: -2 }, S],
      [0.74, {}, S],
      [0.82, { y: -2 }, S],
      [0.9, {}, S],
      [1, {}],
    ],
    face: [
      [0, {}, E.in],
      [0.18, { y: 2 }, E.back],
      [0.34, { y: -2 }, E.out],
      [0.5, {}],
    ],
    top: [
      [0, {}, E.in],
      [0.18, { y: 3 }, E.back],
      [0.36, { y: -9, r: -12 }, E.out],
      [0.56, { r: 5 }, E.back],
      [0.72, {}],
    ],
  }),
  jump: () => ({
    body: [
      [0, {}, E.out],
      [0.14, { y: 2, sx: 1.18, sy: 0.82 }, E.out],
      [0.28, { y: -12, sx: 0.88, sy: 1.14 }, E.out],
      [0.42, { y: -15 }, E.in],
      [0.56, { sx: 0.9, sy: 1.1 }, E.out],
      [0.62, { y: 2, sx: 1.18, sy: 0.82 }, E.back],
      [0.78, {}],
    ],
    face: [
      [0, {}, E.out],
      [0.14, { y: 2 }, E.out],
      [0.32, { y: -2 }, E.out],
      [0.62, { y: 2.5 }, E.back],
      [0.8, {}],
    ],
    top: [
      [0, {}, E.out],
      [0.14, { y: 3 }, E.out],
      [0.32, { y: -3 }, E.out],
      [0.48, { y: -6, r: 12 }, E.in],
      [0.64, { y: 1, r: -6 }, E.back],
      [0.84, {}],
    ],
  }),
  shake: (d) => {
    const n = Math.round(d / 0.06),
      body = [[0, {}, E.out]],
      top = [[0, {}]]
    for (let i = 1; i < n; i++) {
      const l = i / n,
        k = i % 2 ? 1 : -1,
        on = l < 0.4 || (l > 0.55 && l < 0.88)
      body.push([l, on ? { x: 1.8 * k, r: 3 * k, sx: 1.05, sy: 0.95 } : { sx: 1.05, sy: 0.95 }])
      top.push([l, on ? { y: -1.5, r: 9 * k } : {}])
    }
    return { body: [...body, [1, {}]], top: [...top, [1, {}]] }
  },
  huff: () => ({
    body: [
      [0, {}, S],
      [0.35, { y: -2, sx: 0.96, sy: 1.06 }, E.out],
      [0.6, { y: 1, sx: 1.1, sy: 0.9 }, E.back],
      [1, {}],
    ],
    top: [
      [0, {}, S],
      [0.38, { y: -2 }, E.out],
      [0.62, { y: 2, r: -5 }, E.back],
      [1, {}],
    ],
  }),
  droop: () => ({
    body: [
      [0, {}, E.out],
      [0.22, { y: 3.5, sx: 1.07, sy: 0.89 }, S],
      [0.55, { y: 4, sx: 1.08, sy: 0.88 }, S],
      [0.86, { y: 3.5, sx: 1.07, sy: 0.89 }, E.back],
      [1, {}],
    ],
    face: [
      [0, {}, E.out],
      [0.22, { y: 3 }, S],
      [0.86, { y: 3 }, E.io],
      [1, {}],
    ],
    top: [
      [0, {}, E.out],
      [0.26, { y: 2, r: -8 }, S],
      [0.86, { y: 2, r: -6 }, E.back],
      [1, {}],
    ],
  }),
  sway: (d) => ({
    body: rep(d, 1.8, [
      [0, {}, S],
      [0.25, { r: 8 }, S],
      [0.75, { r: -8 }, S],
      [1, {}],
    ]),
    face: rep(d, 1.8, [
      [0, {}, S],
      [0.25, { x: 2.5 }, S],
      [0.75, { x: -2.5 }, S],
      [1, {}],
    ]),
    top: rep(d, 1.8, [
      [0, {}, S],
      [0.35, { r: 12 }, S],
      [0.85, { r: -12 }, S],
      [1, {}],
    ]),
  }),
  // hide ends turned away; the next beat (peek) starts from that pose
  hide: (_, s) => ({
    face: [
      [0, {}, E.ioBack],
      [0.3, { x: 30 * s, sx: 0.7 }],
    ],
    body: [
      [0, {}, E.back],
      [0.3, { r: -7 * s, sx: 1.05, sy: 0.95 }],
    ],
    top: [
      [0, {}, E.back],
      [0.3, { r: -10 * s }],
    ],
  }),
  peek: (_, s) => ({
    face: [
      [0, { x: 30 * s, sx: 0.7 }, E.back],
      [0.3, {}],
    ],
    body: [
      [0, { r: -7 * s, sx: 1.05, sy: 0.95 }, E.back],
      [0.25, { y: -4, sx: 0.95, sy: 1.06 }, E.in],
      [0.45, { sx: 1.06, sy: 0.94 }, E.back],
      [0.6, {}],
    ],
    top: [
      [0, { r: -10 * s }, E.back],
      [0.3, { y: -4, r: 6 }, E.back],
      [0.6, {}],
    ],
  }),
  breathe: (d) => ({
    body: rep(d, 2.6, [
      [0, {}, S],
      [0.5, { y: 0.5, sx: 1.04, sy: 0.96 }, S],
      [1, {}],
    ]),
    top: rep(d, 2.6, [
      [0, {}, S],
      [0.5, { y: 1, r: -3 }, S],
      [1, {}],
    ]),
  }),
  hustle: (d, s) => ({
    body: rep(d, 0.34, [
      [0, {}, E.out],
      [0.45, { y: -6, r: 5 * s, sx: 0.95, sy: 1.06 }, E.in],
      [0.85, { sx: 1.1, sy: 0.9 }, E.out],
      [1, {}],
    ]),
    face: [
      [0, {}, E.out],
      [0.1, { x: 3 * s }],
      [0.9, { x: 3 * s }, E.io],
      [1, {}],
    ],
    top: rep(d, 0.34, [
      [0, {}, E.out],
      [0.55, { y: -3, r: -6 * s }, E.in],
      [0.95, { y: 1 }, E.out],
      [1, {}],
    ]),
  }),
}

// beaks chatter and mustaches wiggle with the mood
function jaw(mouth, mood, d) {
  if (mouth === 'mustache')
    return mood === 'laugh' || mood === 'angry'
      ? rep(d, 0.2, [
          [0, {}, E.out],
          [0.5, { y: -1.2, sy: 1.15 }, E.in],
          [1, {}],
        ])
      : rep(d, 1.6, [
          [0, {}],
          [0.8, {}, E.out],
          [0.9, { y: -0.8, sy: 1.1 }, E.in],
          [1, {}],
        ])
  if (mood === 'laugh')
    return rep(d, 0.26, [
      [0, {}, E.out],
      [0.5, { r: 24 }, E.in],
      [1, {}],
    ])
  if (mood === 'surprised') return hold(d, { r: 26 })
  if (mood === 'angry')
    return rep(d, 0.14, [
      [0, {}],
      [0.5, { r: 10 }],
      [1, {}],
    ])
  if (mood === 'happy')
    return rep(d, 0.8, [
      [0, {}],
      [0.2, { r: 16 }, E.out],
      [0.4, {}, E.in],
      [1, {}],
    ])
  return []
}

// ─── Effects ───────────────────────────────────────────────────────────────────────────────

const twinkle = (off) => [
  [0, { o: 0, sx: 0, sy: 0 }],
  [off, { o: 0, sx: 0, sy: 0, r: -45 }, E.back],
  [off + 0.25, { o: 1 }, E.in],
  [off + 0.5, { o: 0, sx: 0, sy: 0, r: 45 }],
  [1, { o: 0, sx: 0, sy: 0 }],
]
const floatUp = (off) => [
  [0, { o: 0 }],
  [off, { o: 0, sx: 0.5, sy: 0.5 }, E.out],
  [off + 0.15, { o: 1, x: 2, y: -4 }, S],
  [off + 0.32, { o: 1, x: -2, y: -10 }, S],
  [off + 0.48, { o: 0, x: 3, y: -16 }],
  [1, { o: 0 }],
]
function jitter(a, i) {
  const out = [
    [0, { o: 0, sx: 0.3, sy: 0.3 }],
    [a, { o: 0, sx: 0.3, sy: 0.3 }, E.back],
    [a + 0.08, { o: 1, r: i % 2 ? 10 : -10 }, E.step],
  ]
  for (let l = a + 0.16, k = 1; l < 0.85; l += 0.08, k = -k)
    out.push([l, { o: 1, y: 0.6 * k, r: 10 * k * (i % 2 ? 1 : -1) }, E.step])
  return [...out, [0.86, { o: 1 }, E.in], [0.95, { o: 0, y: -4, sx: 0.6, sy: 0.6 }]]
}

/** built-in effects: parts placed at x, y (or centred on the disc / anchored to the face) */
const FX = {
  question: [
    {
      x: 76,
      y: 22,
      svg: Q_MARK,
      keys: () => [
        [0, { o: 0, y: 4, sx: 0.2, sy: 0.2 }, E.back],
        [0.12, { o: 1 }, S],
        [0.45, { o: 1, r: -12 }, S],
        [0.8, { o: 1, r: 8 }, E.in],
        [0.95, { o: 0, sx: 0.5, sy: 0.5 }],
      ],
    },
  ],
  burst: [
    {
      x: 0,
      y: 0,
      center: true,
      svg: TICKS,
      keys: () => [
        [0, { o: 0, sx: 0.7, sy: 0.7 }],
        [0.2, { o: 0, sx: 0.7, sy: 0.7 }, E.out],
        [0.3, { o: 1, sx: 1.08, sy: 1.08 }, E.out],
        [0.48, { o: 0, sx: 1.25, sy: 1.25 }],
      ],
    },
  ],
  sparkles: [
    [20, 26, 0.8, 0],
    [82, 22, 1, 0.2],
    [80, 70, 0.9, 0.4],
    [18, 66, 1.15, 0.1],
  ].map(([x, y, per, off]) => ({ x, y, svg: SPARK, keys: (d) => rep(d, per, twinkle(off)) })),
  grawlix: [HASH, BANG, AT, BANG, HASH].map((svg, i) => ({
    x: 30 + i * 10,
    y: 13 + (i % 2) * 2,
    svg,
    keys: () => jitter(0.08 + i * 0.07, i),
  })),
  sweat: [
    {
      x: 75,
      y: 38,
      svg: DROP,
      keys: (d) =>
        rep(d, 1.1, [
          [0, { o: 0, y: -2, sx: 0.4, sy: 0.4 }, E.back],
          [0.18, { o: 1 }, E.in],
          [0.78, { o: 1, y: 7 }, E.in],
          [0.92, { o: 0, y: 9 }],
          [1, { o: 0, y: -2 }],
        ]),
    },
  ],
  notes: [
    [74, 36, 0],
    [82, 44, 0.45],
  ].map(([x, y, off]) => ({ x, y, svg: NOTE, keys: (d) => rep(d, 1.6, floatUp(off)) })),
  hearts: [
    [26, 34, 0],
    [76, 30, 0.4],
  ].map(([x, y, off]) => ({ x, y, svg: HEART, keys: (d) => rep(d, 1.7, floatUp(off)) })),
  lines: [
    {
      x: 0,
      y: 0,
      center: true,
      svg: SHAKE_LINES,
      keys: (d) =>
        rep(d, 0.16, [
          [0, { o: 1 }, E.step],
          [0.5, { o: 0, x: 0.6 }, E.step],
          [1, { o: 1 }],
        ]),
    },
  ],
  shades: [
    {
      x: 0,
      y: 0,
      face: true,
      svg: shades,
      keys: () => [
        [0, { o: 0, y: -16 }],
        [0.03, { o: 1, y: -16 }, E.in],
        [0.16, { o: 1 }, E.back],
        [0.86, { o: 1 }, E.in],
        [0.97, { o: 1, y: -18 }],
        [1, { o: 0, y: -18 }],
      ],
    },
  ],
  zzz: [0, 0.33, 0.66].map((off, i) => ({
    x: 72,
    y: 26,
    svg: at(0, 0, ZED, ` scale(${0.8 + i * 0.25})`),
    keys: (d) =>
      rep(d, 2.6, [
        [0, { o: 0 }],
        [off * 0.6, { o: 0, sx: 0.4, sy: 0.4 }, E.out],
        [off * 0.6 + 0.15, { o: 1 }, S],
        [off * 0.6 + 0.4, { o: 0, x: 8, y: -14, r: 12 }],
        [1, { o: 0 }],
      ]),
  })),
}

/** idle is waiting, ready to work: only these built-in moves (or custom ones within CALM) and no effects */
export const CALM = { actions: ['idle', 'breathe', 'glance'], move: 3, turn: 5, scale: 0.05 }

/** used when a character doesn't define its own loop for a state */
export const DEFAULT_SCRIPTS = {
  idle: [
    ['neutral', 'idle', '', 3],
    ['happy', 'glance', '', 2.4],
    ['neutral', 'idle', '', 2.6],
  ],
  working: [
    ['focus', 'hustle', 'lines', 2.2],
    ['focus', 'hustle', 'sweat', 2],
    ['laugh', 'jump', 'sparkles', 1.4],
  ],
  sleeping: [['sleep', 'breathe', 'zzz', 5.2]],
}

/** the built-in vocabulary, for documentation and tooling */
export const BUILT_INS = {
  moods: Object.keys(MOODS),
  actions: Object.keys(ACTIONS),
  calm: CALM.actions,
  fx: Object.keys(FX),
  eyes: Object.keys(EYES),
  mouths: Object.keys(MOUTHS),
  eases: Object.keys(EASES),
}

const easeOf = (e) => (e ? (E[e] ?? e) : undefined)
const motion = (m, d) => {
  const keys = m.keys.map(([t, q, e]) => [t, q, easeOf(e)])
  return m.period ? rep(d, m.period, keys) : keys
}

// ─── Validation ────────────────────────────────────────────────────────────────────────────

/** Everything wrong with a character, as readable messages. An empty array means it's valid. */
export function check(c) {
  const errs = []
  const err = (where, msg) => errs.push(`${where}: ${msg}`)
  if (!c || typeof c !== 'object') return ['character: must be a JSON object']
  if (typeof c.name !== 'string' || !c.name.trim()) err('name', 'required')
  if (c.prompt !== undefined && (typeof c.prompt !== 'string' || c.prompt.length > 600))
    err('prompt', 'the request as text, up to 600 characters')
  const own = c.colors && typeof c.colors === 'object' ? c.colors : {}
  for (const [k, v] of Object.entries(own)) {
    if (!/^[a-z][a-z0-9-]{0,15}$/.test(k) || k === 'disc' || k === 'none')
      err(`colors.${k}`, 'names are lowercase words (not "disc" or "none")')
    if (!/^#[0-9a-f]{6}$/i.test(v)) err(`colors.${k}`, 'a 6-digit hex like #f5901f')
  }
  if (!COLORS[c.color] && !own[c.color])
    err('color', `one of the palette (${Object.keys(COLORS).join(', ')}) or a name from colors`)
  for (const [k, v] of Object.entries(c.disc ?? {})) {
    if (k === 'shape') {
      if (typeof v !== 'string' || !/^[MmLlHhVvCcSsQqTtAaZz0-9.,\s-]{4,2000}$/.test(v))
        err('disc.shape', 'a path "d" string (M, L, C, Q, A, Z and numbers) for the head outline')
    } else if (!['x', 'y', 'r'].includes(k) || !Number.isFinite(v)) err(`disc.${k}`, 'x, y and r must be numbers')
  }
  if (c.disc?.r !== undefined && !(c.disc.r >= 12 && c.disc.r <= 34)) err('disc.r', 'between 12 and 34')
  const moods = { ...MOODS, ...c.moods },
    actions = { ...ACTIONS, ...c.actions },
    fx = { ...FX, ...c.fx }
  const svgOk = (where, svg) => {
    if (typeof svg !== 'string' || !svg.trim().startsWith('<'))
      return err(where, 'svg must be a string of SVG elements')
    if (/<script|<style|<foreignObject|<text|<image|\son\w+\s*=|javascript:|href\s*=/i.test(svg))
      err(where, 'no script/style/text/image/href/event attributes; draw glyphs as paths')
    if (svg.split('<').length !== svg.split('>').length) err(where, 'unbalanced < >')
  }
  const POSE = new Set(['x', 'y', 'r', 'sx', 'sy', 'o'])
  const motionOk = (where, m, needPeriod = false) => {
    if (!m || !Array.isArray(m.keys) || !m.keys.length) return err(where, 'needs keys: [[t, pose, ease?], …]')
    if ((needPeriod || m.period !== undefined) && !(m.period > 0.05 && m.period <= 20))
      err(where, 'period must be seconds between 0.05 and 20')
    let last = -1
    m.keys.forEach(([t, q, e], i) => {
      if (!(t >= 0 && t <= 1) || t < last) err(`${where}.keys[${i}]`, 't must be 0..1 and ascending')
      last = t
      for (const [k, v] of Object.entries(q ?? {}))
        if (!POSE.has(k) || !Number.isFinite(v)) err(`${where}.keys[${i}]`, `bad pose field ${k}`)
      if (e !== undefined && !(e in E) && !/^(cubic-bezier\(.+\)|steps\(.+\)|linear)$/.test(e))
        err(`${where}.keys[${i}]`, `unknown ease "${e}" (use ${Object.keys(E).join(', ')})`)
    })
  }
  const beatsOk = (where, beats, required) => {
    if (!beats) return required && err(where, 'required')
    if (!Array.isArray(beats) || !beats.length) return err(where, 'needs at least one beat')
    beats.forEach(([m, a, x, d], i) => {
      if (!(m in moods)) err(`${where}[${i}]`, `unknown mood "${m}"`)
      if (!(a in actions)) err(`${where}[${i}]`, `unknown action "${a}"`)
      if (x && !(x in fx)) err(`${where}[${i}]`, `unknown effect "${x}"`)
      if (!(d >= 0.4 && d <= 8)) err(`${where}[${i}]`, 'seconds must be 0.4..8')
    })
  }
  if (c.script) err('script', 'renamed: split it into idle (calm, waiting) and working (busy)')
  beatsOk('idle', c.idle, true)
  beatsOk('working', c.working, true)
  beatsOk('sleeping', c.sleeping, false)
  const total = (beats) => (Array.isArray(beats) ? beats.reduce((s, b) => s + (b[3] || 0), 0) : 0)
  if (Array.isArray(c.idle) && (total(c.idle) < 6 || total(c.idle) > 14))
    err('idle', `loop is ${total(c.idle).toFixed(1)}s; use 6–14s`)
    // idle must read as waiting: no effects, only calm moves
  ;(Array.isArray(c.idle) ? c.idle : []).forEach(([, a, x], i) => {
    if (x) err(`idle[${i}]`, `no effects while idle ("${x}" belongs in working)`)
    const custom = c.actions?.[a]
    if (!custom && !CALM.actions.includes(a))
      err(`idle[${i}]`, `"${a}" is too lively for idle; use ${CALM.actions.join(', ')} or a calm custom move`)
    const loud = ([, q]) =>
      Math.abs(q?.x ?? 0) > CALM.move ||
      Math.abs(q?.y ?? 0) > CALM.move ||
      Math.abs(q?.r ?? 0) > CALM.turn ||
      Math.abs((q?.sx ?? 1) - 1) > CALM.scale ||
      Math.abs((q?.sy ?? 1) - 1) > CALM.scale
    for (const [k, m] of Object.entries(custom ?? {})) {
      if ((m?.keys ?? []).some(loud))
        err(
          `idle[${i}]`,
          `"${a}" ${k} moves too much for idle (keep within ±${CALM.move} units, ±${CALM.turn}°, scale ±${CALM.scale * 100}%)`,
        )
    }
  })
  // a layer loop, or a reaction that fires while idle, must stay gentle
  const idleMoods = new Set((Array.isArray(c.idle) ? c.idle : []).map((b) => b[0]))
  const gentle = (m) =>
    !(m?.period < 1) &&
    !(m?.keys ?? []).some(
      ([, q]) =>
        Math.abs(q?.r ?? 0) > 12 ||
        Math.abs(q?.x ?? 0) > 3 ||
        Math.abs(q?.y ?? 0) > 3 ||
        Math.abs((q?.sx ?? 1) - 1) > 0.08 ||
        Math.abs((q?.sy ?? 1) - 1) > 0.08,
    )
  const GENTLE = 'period ≥ 1s, ±12°, ±3 units, scale ±8%'
  for (const [k, v] of Object.entries(c.parts ?? {}))
    if (!PARTS[k]?.includes(v))
      err(
        `parts.${k}`,
        PARTS[k] ? `must be one of ${PARTS[k].join(', ')}` : `not a part (use ${Object.keys(PARTS).join(', ')})`,
      )
  for (const [k, v] of Object.entries(c.face ?? {}))
    if (!['x', 'y', 'spacing'].includes(k) || !Number.isFinite(v)) err(`face.${k}`, 'x, y and spacing must be numbers')
  ;(c.layers ?? []).forEach((L, i) => {
    const w = `layers[${i}]`
    if (L.at === 'ground') err(w, 'no ground layer: nothing sits under the head (no shadow, ring, plate or bowl)')
    else if (!['back', 'front', 'face', 'over', 'top'].includes(L.at))
      err(w, 'at must be back, front, face, over or top')
    svgOk(w, L.svg)
    if (L.loop) {
      motionOk(`${w}.loop`, L.loop, true)
      // loops run in every state, idle and sleeping included, so they stay gentle; lively motion goes in react
      if (!gentle(L.loop))
        err(`${w}.loop`, `loops run in every state, so keep them gentle: ${GENTLE} (put lively motion in react)`)
    }
    for (const [m, r] of Object.entries(L.react ?? {})) {
      if (!(m in moods)) err(`${w}.react`, `unknown mood "${m}"`)
      motionOk(`${w}.react.${m}`, r)
      if (idleMoods.has(m) && !gentle(r))
        err(`${w}.react.${m}`, `"${m}" plays while idle, so keep this gentle: ${GENTLE} (or give idle a calmer mood)`)
    }
  })
  for (const [name, a] of Object.entries(c.actions ?? {}))
    for (const [k, m] of Object.entries(a)) {
      if (!['body', 'face', 'top'].includes(k)) err(`actions.${name}`, `track "${k}" must be body, face or top`)
      motionOk(`actions.${name}.${k}`, m)
    }
  for (const [name, parts] of Object.entries(c.fx ?? {}))
    (parts ?? []).forEach((q, i) => {
      svgOk(`fx.${name}[${i}]`, q.svg)
      motionOk(`fx.${name}[${i}]`, q)
      if (q.keys?.[0]?.[1]?.o !== 0 || q.keys?.[q.keys.length - 1]?.[1]?.o !== 0)
        err(`fx.${name}[${i}]`, 'first and last key need o: 0 so the effect starts and ends hidden')
      if (q.behind !== undefined && typeof q.behind !== 'boolean') err(`fx.${name}[${i}].behind`, 'true or false')
    })
  for (const [name, m] of Object.entries(c.moods ?? {})) {
    const own = Array.isArray(m.eye)
      ? m.eye
      : typeof m.eye === 'string' && m.eye.trim().startsWith('<')
        ? [m.eye]
        : null
    if (own) {
      if (own.length > 2) err(`moods.${name}.eye`, '[left, right] at most')
      else for (const [i, e] of own.entries()) svgOk(`moods.${name}.eye${own.length > 1 ? `[${i}]` : ''}`, e)
    } else if (!(m.eye === 'base' || m.eye in EYES))
      err(`moods.${name}.eye`, `use base, ${Object.keys(EYES).join(', ')}, or your own SVG`)
    if (m.blink !== undefined && typeof m.blink !== 'boolean') err(`moods.${name}.blink`, 'true or false')
    if (typeof m.mouth !== 'string')
      err(`moods.${name}.mouth`, `a path, your own SVG or one of ${Object.keys(MOUTHS).join(', ')}`)
    else if (m.mouth.trim().startsWith('<')) svgOk(`moods.${name}.mouth`, m.mouth)
  }
  if (!errs.length)
    for (const state of STATES) {
      if (/undefined|NaN|Infinity/.test(render(c, { state }))) err(state, 'renders undefined/NaN — check numbers')
    }
  return errs
}

// ─── Rendering ─────────────────────────────────────────────────────────────────────────────

const tf = (q) =>
  `transform:translate(${f(q.x ?? 0)}px,${f(q.y ?? 0)}px) rotate(${f(q.r ?? 0)}deg) scale(${f(q.sx ?? 1)},${f(q.sy ?? 1)})` +
  (q.o === undefined ? '' : `;opacity:${q.o}`)

/**
 * render a timeline track ([seconds, css, ease]) as @keyframes. Two keys at the same moment with different values are
 * a jump (a 360° spin wrapping to 0, one beat handing over to the next), so both stay, a hair apart; otherwise the
 * later key wins.
 */
function keyframes(name, keys, T) {
  const ks = []
  const hair = T * 2e-5 // 0.002% of the loop: distinct after rounding, invisible on screen
  for (const k of [...keys].sort((a, b) => a[0] - b[0])) {
    const last = ks[ks.length - 1]
    if (!last || Math.abs(last[0] - k[0]) >= 1e-6) ks.push(k)
    else if (last[1] !== k[1] && k[0] - hair > Math.max(0, ks[ks.length - 2]?.[0] ?? 0)) {
      ks[ks.length - 1] = [k[0] - hair, last[1], last[2]]
      ks.push(k)
    } else ks[ks.length - 1] = k
  }
  if (ks[0][0] > 0) ks.unshift([0, ks[0][1]])
  if (ks[ks.length - 1][0] < T) ks.push([T, ks[ks.length - 1][1]])
  return `@keyframes ${name}{${ks.map(([t, css, e]) => `${Math.min(100, +((t / T) * 100).toFixed(3))}%{${css}${e ? `;animation-timing-function:${e}` : ''}}`).join('')}}`
}

const CSS = `.fa-boil{transform-origin:50px 54px;animation:fa-boil .5s step-end infinite}.fa-boil2{animation-delay:-.25s}
@keyframes fa-boil{33%{transform:translate(.45px,-.3px) rotate(.6deg)}66%{transform:translate(-.35px,.35px) rotate(-.45deg)}}
@media (prefers-reduced-motion:reduce){.fa *{animation:none!important}}`

/**
 * Render a character as a standalone, animated SVG string.
 * @param {Character} char
 * @param {{ state?: 'idle' | 'working' | 'sleeping', size?: number }} [options]
 */
export function render(char, { state = 'idle', size = 128 } = {}) {
  const t = Object.fromEntries(Object.entries(PARTS).map(([k, list]) => [k, char.parts?.[k] ?? list[0]]))
  const rand = rng(char.name) // small, stable per-character variation: off-register print, loop phase, turn side
  const ox = rand() * 4 - 2,
    oy = rand() * 4 - 2,
    phase = rand(),
    side = rand() < 0.5 ? -1 : 1
  const fx = char.face?.x ?? (t.outline === 'swoop' ? CX - 3 : CX),
    ey = char.face?.y ?? 50,
    spacing = char.face?.spacing ?? 6.5
  const s =
    t.extra === 'glasses' ? Math.max(spacing, 7.6) : t.mouth === 'beak' || t.eyes === 'tiny' ? spacing * 0.75 : spacing
  const beats = char[state] ?? DEFAULT_SCRIPTS[state]
  const T = beats.reduce((sum, b) => sum + b[3], 0)
  const id = `fa${hash(JSON.stringify(char) + state).toString(36)}`
  const MOOD = { ...MOODS, ...char.moods }
  // colours: the disc's, plus a famous character's own named flat colours, usable in drawings by name
  const named = { ...char.colors }
  const hex = named[char.color] ?? COLORS[char.color] ?? COLORS.blue
  named.disc = hex
  const tint = (svg) =>
    svg.replace(/\b(fill|stroke)="([a-z][a-z0-9-]*)"/g, (m, attr, name) =>
      name in named ? `${attr}="${named[name]}"` : m,
    )
  // the head disc can move and resize (room for tall headwear); squash and stretch pivot at its bottom
  const D = { x: char.disc?.x ?? CX, y: char.disc?.y ?? CY, r: char.disc?.r ?? R }
  const pivot = [D.x, D.y + D.r]
  const FXS = { ...FX }
  for (const [k, parts] of Object.entries(char.fx ?? {}))
    FXS[k] = parts.map((q) => ({ x: q.x, y: q.y, svg: tint(q.svg), behind: q.behind, keys: (d) => motion(q, d) }))
  const act = (name, d) => {
    const custom = char.actions?.[name]
    return custom
      ? Object.fromEntries(Object.entries(custom).map(([k, m]) => [k, motion(m, d)]))
      : ACTIONS[name](d, side)
  }
  const run = (name, origin = 'center', box = true) =>
    `style="${box ? 'transform-box:fill-box;' : ''}transform-origin:${origin};animation:${id}${name} ${f(T)}s linear -${f(phase * T)}s infinite"`

  const blinks = (m) => m.blink ?? (m.eye !== 'happy' && m.eye !== 'closed')

  // lay every beat's tracks onto one timeline
  const tracks = {}
  const trackOf = (name) => {
    tracks[name] ??= []
    return tracks[name]
  }
  const fxUsed = new Set(),
    moods = [...new Set(beats.map((b) => b[0]))]
  const put = (name, t0, d, list) => {
    for (const [l, pose, e] of list) trackOf(name).push([t0 + l * d, tf(pose), e])
  }
  let t0 = 0
  for (const [mood, action, fxName, d] of beats) {
    for (const [k, list] of Object.entries(act(action, d))) put(k, t0, d, list)
    char.layers?.forEach((L, i) => {
      if (L.react?.[mood]) put(`L${i}`, t0, d, motion(L.react[mood], d))
    })
    if (t.mouth === 'beak' || t.mouth === 'mustache') put('jaw', t0, d, jaw(t.mouth, mood, d))
    for (const m of moods) trackOf(`m${m}`).push([t0, `opacity:${m === mood ? 1 : 0}`, E.step])
    if (blinks(MOOD[mood]) && d > 1.2) {
      // a blink somewhere in the beat
      const b = t0 + d * (0.35 + 0.3 * ((phase * 7 + t0) % 1))
      trackOf('blink').push([b, tf({}), E.in], [b + 0.07, tf({ sy: 0.1 }), E.out], [b + 0.16, tf({})])
    }
    if (fxName) {
      fxUsed.add(fxName)
      FXS[fxName].forEach((part, i) => {
        tracks[`x${fxName}${i}`] ??= [
          [0, tf({ o: 0 }), E.step],
          [T, tf({ o: 0 })],
        ] // hidden outside its beats
        put(`x${fxName}${i}`, t0, d, [...part.keys(d), [1, { o: 0 }, E.step]])
      })
    }
    t0 += d
  }
  const has = (k) => (tracks[k]?.length ?? 0) > 0
  const css = Object.entries(tracks)
    .filter(([, ks]) => ks.length)
    .map(([k, ks]) => keyframes(id + k, ks, T))
    .join('')
  const track = (name, svg, origin, box) => (has(name) ? `<g ${run(name, origin, box)}>${svg}</g>` : svg)

  // face: fixed mouth + one group per mood (swapped instantly) + glasses etc.
  const blink = has('blink') ? run('blink') : ''
  const glassesUp = t.extra === 'glasses' ? -3 : 0
  const ident = IDENTITY[t.mouth]
  const flip = t.mouth === 'beak' && fx < CX // a beak points the way the face is turned
  const moodSvg = (name) => {
    const m = MOOD[name]
    const eye = (i) =>
      Array.isArray(m.eye)
        ? tint(m.eye[i])
        : m.eye.trim().startsWith('<')
          ? tint(m.eye)
          : EYES[m.eye === 'base' ? t.eyes : m.eye]
    let svg = `<g ${blinks(m) ? blink : ''}>${at(-s, 0, eye(0))}${at(s, 0, eye(1))}</g>`
    if (m.brow) svg += at(-s, glassesUp, p(m.brow[0])) + at(s, glassesUp, p(m.brow[1]))
    if (!ident || t.mouth === 'nose')
      svg += at(0, ident ? 10 : 9, MOUTHS[m.mouth] ?? (m.mouth.trim().startsWith('<') ? tint(m.mouth) : p(m.mouth)))
    if (m.blush) svg += at(-s - 2, 5, BLUSH) + at(s + 2, 5, BLUSH)
    return `<g opacity="${name === beats[0][0] ? 1 : 0}" ${run(`m${name}`, '0 0', false)}>${svg}</g>`
  }
  let face = ''
  if (ident) {
    const [dy, still, moving] = ident
    face += at(
      t.mouth === 'beak' ? (flip ? 2 : -2) : 0,
      dy,
      still + (moving ? track('jaw', moving, t.mouth === 'beak' ? '0% 0%' : 'center') : ''),
      flip ? ' scale(-1 1)' : '',
    )
  }
  face += moods.map(moodSvg).join('')
  if (t.extra === 'glasses') {
    const L = 6.2,
      a = f(s + L)
    face +=
      `<circle cx="${f(-s)}" r="${L}"/><circle cx="${f(s)}" r="${L}"/>` +
      p(`M${f(L - s)}-1Q0-3 ${f(s - L)}-1M${-a}-1L${f(-a - 5)}-3M${a}-1L${f(a + 5)}-3`)
  } else if (t.extra === 'freckles') {
    const fr = dot(0, 0, 0.8) + dot(2.2, -1.2, 0.8) + dot(1.8, 1.5, 0.8)
    face += at(s + 3, 5, fr) + at(-s - 3, 5, fr, ' scale(-1 1)')
  } else if (t.extra === 'whiskers') {
    face += at(0, 8, mirror(p('M6-2L22-5M6 0H23M6 2L21 5')))
  }

  // effects: face-anchored ones (shades) ride along with head turns, the rest stay fixed on the canvas.
  // A placed part pivots on its own (0, 0), so sx: -1 mirrors it around its attachment point.
  let fxFace = '',
    fxFree = '',
    fxBehind = ''
  for (const name of fxUsed)
    FXS[name].forEach((part, i) => {
      const svg = typeof part.svg === 'function' ? part.svg(s) : part.svg,
        key = `x${name}${i}`
      if (part.face) fxFace += `<g opacity="0" ${run(key)}>${svg}</g>`
      else if (part.center) fxFree += `<g opacity="0" ${run(key, '50px 54px', false)}>${svg}</g>`
      else if (part.behind)
        fxBehind += at(part.x, part.y, `<g opacity="0" ${run(key, '0px 0px', false)}>${svg}</g>`) // trails, behind the body
      else fxFree += at(part.x, part.y, `<g opacity="0" ${run(key, '0px 0px', false)}>${svg}</g>`)
    })

  // custom layers: an always-on loop wrapped around a per-mood timeline track
  const L = { back: '', front: '', face: '', over: '', top: '' }
  let loopCss = ''
  char.layers?.forEach((layer, i) => {
    const origin = layer.origin ?? 'center'
    let svg = track(`L${i}`, layer.svg, origin)
    if (layer.loop) {
      const per = layer.loop.period
      loopCss += keyframes(
        `${id}l${i}`,
        motion(layer.loop, per).map(([u, q, e]) => [u * per, tf(q), e]),
        per,
      )
      svg = `<g style="transform-box:fill-box;transform-origin:${origin};animation:${id}l${i} ${per}s linear -${f(phase * per)}s infinite">${svg}</g>`
    }
    L[layer.at] += tint(svg)
  })

  const faceSvg = track(
    'face',
    at(fx, ey, `<g stroke-width="${f(1.8 / FACE)}">${face}${fxFace}</g>`, ` scale(${FACE})`) + L.face,
    `${f(fx)}px ${f(ey)}px`,
    false,
  )
  const clip = beats.some((b) => b[1] === 'hide') // turning away hides the face behind the disc's edge

  let back = L.back,
    front = '',
    top = ''
  if (t.neck === 'bowtie')
    front += at(
      CX,
      85.5,
      `${mirror(p('M0 0L-6.5-4Q-7.5 0-6.5 4Z', `fill="${PAPER}"`))}<circle r="1.7" fill="${PAPER}"/>`,
    )
  if (t.outline === 'ring') front += `<circle cx="${CX + (ox < 0 ? -2.6 : 2.6)}" cy="${CY - 2.4}" r="${R}"/>`
  if (t.outline === 'curls') front += CURLS
  if (t.outline === 'swoop') front += SWOOP
  const def = TOPS[t.top]
  if (def) {
    const lift = t.outline === 'curls' && !def.still ? 4 : 0
    const g = track(
      'top',
      at(def.x ?? CX, def.y - lift, def.svg, def.r ? ` rotate(${def.r})` : ''),
      def.still ? 'center' : '50% 100%',
    )
    if (def.back) back += g
    else top = g
  }
  front += L.front
  if (L.top) top += track('top', L.top, '50% 100%')

  const bx = f(D.x + ox),
    by = f(D.y + oy)
  // a head that isn't round (pear, bullet, square) is a path; it's printed off-register like the circle
  const shape = /^[MmLlHhVvCcSsQqTtAaZz0-9.,\s-]{4,2000}$/.test(char.disc?.shape ?? '') && char.disc.shape
  const head = shape
    ? `<path d="${shape}" transform="translate(${f(ox)} ${f(oy)})"`
    : `<circle cx="${bx}" cy="${by}" r="${D.r}"`
  const body = `${head} fill="${hex}"/>`
  const defs = clip ? `<clipPath id="${id}c">${head}/></clipPath>` : ''
  const faceLayer = clip ? `<g clip-path="url(#${id}c)">${faceSvg}</g>` : faceSvg
  const px = Math.min(1024, Math.max(16, Math.round(size) || 128))

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-5 -10 110 110" width="${px}" height="${px}" class="fa" role="img" aria-label="${esc(char.name)}"><style>${CSS}${css}${loopCss}</style>${defs}` +
    (fxBehind ? `<g ${INK_ATTRS}>${fxBehind}</g>` : '') +
    `<g ${run('body', `${f(pivot[0])}px ${f(pivot[1])}px`, false)}><g class="fa-boil" ${INK_ATTRS}>${back}</g>${body}<g class="fa-boil fa-boil2" ${INK_ATTRS}>${front}${faceLayer}${L.over}${top}</g></g>` +
    `<g ${INK_ATTRS}>${fxFree}</g></svg>`
  )
}
