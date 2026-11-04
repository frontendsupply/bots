// node --test tests/*.test.mjs

import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { cpSync, existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { check, PARTS, render, STATES } from '../kit/avatar.mjs'

const root = fileURLToPath(new URL('..', import.meta.url))
const examples = Object.fromEntries(
  readdirSync(join(root, 'examples')).map((slug) => [
    slug,
    JSON.parse(readFileSync(join(root, 'examples', slug, `${slug}.json`), 'utf8')),
  ]),
)
const turkey = examples.turkey
const CALM_IDLE = [
  ['neutral', 'idle', '', 3],
  ['happy', 'glance', '', 3],
]
const build = (...args) => spawnSync(process.execPath, [join(root, 'kit/build.mjs'), ...args], { encoding: 'utf8' })

test('every example is valid', () => {
  for (const [slug, c] of Object.entries(examples)) assert.deepEqual(check(c), [], slug)
})

test('rendering is deterministic, and each state has its own loop', () => {
  assert.equal(render(turkey), render(turkey))
  assert.notEqual(render(turkey), render(turkey, { state: 'working' }))
})

test('every built-in part renders cleanly in every state', () => {
  for (const [k, vals] of Object.entries(PARTS))
    for (const v of vals)
      for (const state of STATES) {
        const svg = render({ ...turkey, parts: { ...turkey.parts, [k]: v } }, { state })
        assert.ok(!/undefined|NaN|Infinity/.test(svg), `${k}=${v} (${state})`)
      }
})

test('effects stay hidden outside their beat', () => {
  const c = {
    name: 'probe',
    color: 'red',
    idle: CALM_IDLE,
    working: [
      ['happy', 'idle', '', 4],
      ['surprised', 'jump', 'lines', 2],
      ['happy', 'idle', '', 4],
    ],
  }
  const lines = render(c, { state: 'working' }).match(/@keyframes \w+xlines0\{0%\{[^}]*\}/)[0]
  assert.ok(lines.includes('opacity:0') && lines.includes('step-end'), lines) // hidden, and holds hidden
})

test('effect parts pivot on their own (0, 0), so sx: -1 mirrors them in place', () => {
  const c = {
    name: 'probe',
    color: 'red',
    idle: CALM_IDLE,
    working: [['happy', 'idle', 'beam', 8]],
    fx: {
      beam: [
        {
          x: 60,
          y: 30,
          svg: '<path d="M0 0H12"/>',
          keys: [
            [0, { o: 0 }],
            [0.5, { o: 1, sx: -1 }],
            [1, { o: 0 }],
          ],
        },
      ],
    },
  }
  assert.match(
    render(c, { state: 'working' }),
    /<g transform="translate\(60 30\)"><g opacity="0" style="transform-origin:0px 0px;/,
  )
})

test('moods can draw their own eyes, and drawings can reuse the disc colour', () => {
  const c = {
    name: 'probe',
    color: 'orange',
    idle: [['stare', 'idle', '', 8]],
    working: [['stare', 'bop', '', 8]],
    moods: { stare: { eye: '<circle r="6" fill="#fff"/><circle r="3" fill="disc"/>', mouth: 'o' } },
    layers: [{ at: 'back', svg: '<path d="M20 80H80" fill="disc"/>' }],
  }
  assert.deepEqual(check(c), [])
  const svg = render(c)
  assert.equal(svg.match(/<circle r="6" fill="#fff"\/>/g).length, 2) // both eyes
  assert.ok(!svg.includes('"disc"') && svg.includes('fill="#FFA21C"'))
})

test('famous characters: named colours, a moved disc, and effects behind the head', () => {
  const c = {
    name: 'probe',
    color: 'skin',
    colors: { skin: '#ffddc7', hair: '#f5901f' },
    disc: { x: 50, y: 44, r: 25 },
    idle: CALM_IDLE,
    working: [['happy', 'idle', 'trail', 8]],
    layers: [{ at: 'back', svg: '<path d="M20 40H80" fill="hair" stroke="hair"/>' }],
    fx: {
      trail: [
        {
          x: 50,
          y: 70,
          behind: true,
          svg: '<path d="M0 0H-20" stroke="hair"/>',
          keys: [
            [0, { o: 0 }],
            [0.5, { o: 1 }],
            [1, { o: 0 }],
          ],
        },
      ],
    },
  }
  assert.deepEqual(check(c), [])
  const svg = render(c, { state: 'working' })
  assert.ok(svg.includes('r="25" fill="#ffddc7"'), 'disc uses the named colour and size')
  assert.ok(svg.includes('fill="#f5901f" stroke="#f5901f"'), 'drawings use named colours')
  assert.ok(svg.indexOf('H-20') < svg.indexOf('r="25"'), 'a behind effect is drawn before the body')
  assert.ok(svg.includes('transform-origin:50px 69px'), 'squash and stretch pivot at the bottom of the head')
  assert.ok(check({ ...c, colors: { skin: 'peach' } }).some((e) => e.includes('hex')))
})

test('an over layer draws on top of the eyes', () => {
  const c = {
    name: 'probe',
    color: 'red',
    idle: CALM_IDLE,
    working: CALM_IDLE,
    layers: [{ at: 'over', svg: '<path d="M20 40H80" fill="#f5901f"/>' }],
  }
  assert.deepEqual(check(c), [])
  const svg = render(c)
  assert.ok(svg.indexOf('M20 40H80') > svg.lastIndexOf('fill="#151515" stroke="none"'), 'drawn after the eye dots')
})

test('the validator catches common mistakes', () => {
  const errors = check({
    name: 'bad',
    color: '#3DA5FF',
    parts: { hat: 'tophat' },
    idle: [['grinning', 'fly', 'smoke', 2]],
    layers: [{ at: 'back', svg: '<path d="M0 0" onclick="x()"/>' }],
    fx: { puff: [{ x: 0, y: 0, svg: '<circle r="1"/>', keys: [[0, { o: 1 }, 'bounce']] }] },
  })
  for (const bit of [
    'palette',
    'not a part',
    'unknown mood "grinning"',
    'unknown action "fly"',
    'unknown effect "smoke"',
    'event attributes',
    'o: 0',
    'unknown ease "bounce"',
    'loop is 2.0s',
  ]) {
    assert.ok(
      errors.some((e) => e.includes(bit)),
      `expected an error mentioning ${bit}; got\n${errors.join('\n')}`,
    )
  }
})

test('idle stays calm: no effects, no lively moves, and the old script field is refused', () => {
  const base = {
    name: 'probe',
    color: 'red',
    working: [['happy', 'jump', 'sparkles', 8]],
    actions: {
      zoom: {
        body: {
          keys: [
            [0, {}],
            [0.5, { y: -20 }],
            [1, {}],
          ],
        },
      },
    },
  }
  const errs = (idle) => check({ ...base, idle }).join('\n')
  assert.equal(
    errs([
      ['happy', 'idle', '', 4],
      ['happy', 'glance', '', 4],
    ]),
    '',
  )
  assert.match(errs([['happy', 'jump', '', 8]]), /too lively for idle/)
  assert.match(errs([['happy', 'idle', 'sparkles', 8]]), /no effects while idle/)
  assert.match(errs([['happy', 'zoom', '', 8]]), /moves too much for idle/)
  assert.match(check({ ...base, script: base.working, idle: CALM_IDLE }).join('\n'), /renamed/)
  // a fast wag is fine in working, not on a mood that also plays while idle
  const wag = {
    at: 'back',
    svg: '<path d="M78 60h10"/>',
    react: {
      laugh: {
        period: 0.3,
        keys: [
          [0, {}],
          [0.5, { r: 20 }],
          [1, {}],
        ],
      },
    },
  }
  assert.equal(check({ ...base, idle: CALM_IDLE, layers: [wag] }).join('\n'), '')
  assert.match(check({ ...base, idle: [['laugh', 'idle', '', 8]], layers: [wag] }).join('\n'), /plays while idle/)
  assert.match(
    check({
      ...base,
      idle: CALM_IDLE,
      layers: [{ at: 'ground', svg: '<ellipse cx="50" cy="90" rx="12" ry="2"/>' }],
    }).join('\n'),
    /no ground layer/,
  )
})

test('names are escaped and size is clamped', () => {
  const svg = render({ ...turkey, name: '"><script>alert(1)</script>' }, { size: 99999 })
  assert.ok(!svg.includes('<script'))
  assert.ok(svg.includes('width="1024"'))
})

test('build writes the SVGs and preview next to the file, from any folder', () => {
  const dir = mkdtempSync(join(tmpdir(), 'avatar-test-'))
  try {
    cpSync(join(root, 'examples/turkey/turkey.json'), join(dir, 'turkey.json'))
    const ok = build(join(dir, 'turkey.json'))
    assert.equal(ok.status, 0, ok.stderr)
    for (const f of ['turkey.svg', 'turkey-working.svg', 'turkey-sleeping.svg', 'preview.html'])
      assert.ok(existsSync(join(dir, f)), f)

    writeFileSync(join(dir, 'broken.json'), '{ "name": "x", ')
    const bad = build(join(dir, 'broken.json'))
    assert.equal(bad.status, 1)
    assert.match(bad.stderr, /broken\.json/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
