#!/usr/bin/env node
import { execFileSync } from 'node:child_process'
// Build a character: validate it, then write its animated SVGs and a preview page next to the JSON.
//
//   node kit/build.mjs avatars/cat-fish/cat-fish.json [--shot] [--size 160]
//
// Writes <slug>.svg (idle), <slug>-working.svg, <slug>-sleeping.svg and preview.html.
// --shot also saves frames.png, a screenshot of the preview (two paused frames inside every beat), using a headless
// Chrome, Chromium, Brave or Edge if one is installed (set CHROME_PATH to pick one).
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, delimiter, dirname, join, relative, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { check, DEFAULT_SCRIPTS, render, STATES } from './avatar.mjs'

const args = process.argv.slice(2)
const file = args.find((a) => a.endsWith('.json'))
if (!file) {
  console.error('usage: node kit/build.mjs <character>.json [--shot] [--size 160]')
  process.exit(2)
}
const size = args.includes('--size') ? Number(args[args.indexOf('--size') + 1]) : 160

let char
try {
  char = JSON.parse(readFileSync(file, 'utf8'))
} catch (e) {
  console.error(`${file}: ${e.message}`)
  process.exit(1)
}
const errors = check(char)
if (errors.length) {
  console.error(
    `✗ ${basename(file)} has ${errors.length} problem${errors.length > 1 ? 's' : ''}:\n  ${errors.join('\n  ')}`,
  )
  process.exit(1)
}

const dir = dirname(resolve(file)),
  slug = basename(file, '.json')
const written = []
const write = (name, text) => {
  writeFileSync(join(dir, name), text)
  written.push(join(dir, name))
}
for (const state of STATES)
  write(state === 'idle' ? `${slug}.svg` : `${slug}-${state}.svg`, `${render(char, { state, size })}\n`)
write('preview.html', preview(char))
let note = ''
if (args.includes('--shot')) note = shot(join(dir, 'preview.html'), join(dir, 'frames.png'))
console.log(`✓ ${char.name} is valid\n${written.map((w) => `  ${relative(process.cwd(), w)}`).join('\n')}${note}`)

/** a page with the live character (also at 48 and 32px) and, per state, frames paused inside every beat */
function preview(c) {
  const strip = (state) => {
    const beats = c[state] ?? DEFAULT_SCRIPTS[state]
    const svg = render(c, { state, size: 100 })
    let start = 0
    const frames = beats.flatMap(([mood, action, , d]) => {
      // two looks per beat (a third of the way in, where pops, jumps and effects peak, and later on), one for short beats
      const out = (d >= 1.2 ? [0.3, 0.65] : [0.45]).map((u) => {
        const t = start + u * d
        return `<figure data-t="${+t.toFixed(3)}">${svg}<figcaption>${mood} · ${action}<br>${t.toFixed(1)}s</figcaption></figure>`
      })
      start += d
      return out
    })
    return `<section><h2>${state}</h2><div class="strip">${frames.join('')}</div></section>`
  }
  const beats = (c.working ?? [])
    .map(([m, a, x, d]) => `<li><b>${m}</b> · ${a}${x ? ` · ${x}` : ''} <span>${d}s</span></li>`)
    .join('')
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(c.name)}</title>
<style>
body{margin:0;padding:28px 32px;font:14px/1.4 system-ui,sans-serif;color:#151515;background:#fff}
header{display:flex;gap:32px;align-items:center;margin-bottom:12px}
.hero{background:#fafafa;border-radius:24px;flex:none}.hero svg{display:block}
h1{font-size:30px;margin:0 0 12px;letter-spacing:-.02em}
h2{font-size:12px;font-weight:500;color:#9a9a9a;text-transform:uppercase;letter-spacing:.06em;margin:14px 0 4px}
ol{display:flex;flex-wrap:wrap;gap:6px;padding:0;margin:0;list-style:none}
li{background:#f3f3f3;border-radius:999px;padding:4px 12px}li span{color:#8a8a8a}
.strip{display:flex;flex-wrap:wrap;gap:4px}
.small{display:flex;gap:14px;align-items:end;margin-top:14px;color:#8a8a8a;font-size:12px}.small svg{display:block}figure{margin:0;text-align:center}figcaption{font-size:11px;color:#8a8a8a;line-height:1.3}
</style></head><body>
<header><div class="hero">${render(c, { size: 320 })}</div><div><h1>${esc(c.name)}</h1><ol>${beats}</ol>
<div class="small">${render(c, { size: 48 })}<span>48px</span>${render(c, { size: 32 })}<span>32px</span></div></div></header>
${STATES.map(strip).join('\n')}
<script>
// pause each frame at its moment of the loop (undoing the avatar's built-in start offset)
for (const fig of document.querySelectorAll('figure')) {
  const svg = fig.querySelector('svg');
  const [, T, D] = svg.outerHTML.match(/body ([\\d.]+)s linear -([\\d.]+)s/).map(Number);
  const at = (((Number(fig.dataset.t) - D) % T) + T) % T;
  for (const a of svg.getAnimations({ subtree: true })) { a.pause(); a.currentTime = at * 1000; }
}
</script></body></html>
`
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`)
}

/** screenshot the preview with a headless Chromium-family browser; returns a line for the summary */
function shot(html, png) {
  const browser = findBrowser()
  if (!browser)
    return '\n  (no Chrome/Chromium/Brave/Edge found for --shot; set CHROME_PATH, or open preview.html yourself)'
  const profile = mkdtempSync(join(tmpdir(), 'avatar-shot-')) // never touch the user's own browser profile
  try {
    execFileSync(
      browser,
      [
        '--headless=new',
        '--disable-gpu',
        '--hide-scrollbars',
        '--no-first-run',
        '--no-default-browser-check',
        `--user-data-dir=${profile}`,
        '--window-size=1540,1100',
        '--virtual-time-budget=3000',
        `--screenshot=${png}`,
        pathToFileURL(html).href,
      ],
      { stdio: 'ignore', timeout: 60_000 },
    )
  } catch (e) {
    return `\n  (screenshot failed with ${basename(browser)}: ${e.message.split('\n')[0]})`
  } finally {
    rmSync(profile, { recursive: true, force: true })
  }
  return `\n  ${relative(process.cwd(), png)}  ← look at this: two paused frames inside every beat, plus 48px and 32px`
}

function findBrowser() {
  const apps = ['Google Chrome', 'Chromium', 'Brave Browser', 'Microsoft Edge'].map(
    (n) => `/Applications/${n}.app/Contents/MacOS/${n}`,
  )
  const win = [
    'Google\\Chrome\\Application\\chrome.exe',
    'Microsoft\\Edge\\Application\\msedge.exe',
    'BraveSoftware\\Brave-Browser\\Application\\brave.exe',
  ].flatMap((p) =>
    [process.env.PROGRAMFILES, process.env['PROGRAMFILES(X86)'], process.env.LOCALAPPDATA]
      .filter(Boolean)
      .map((root) => join(root, p)),
  )
  const names = [
    'google-chrome',
    'google-chrome-stable',
    'chromium',
    'chromium-browser',
    'brave-browser',
    'microsoft-edge',
  ]
  const onPath = names.flatMap((n) => (process.env.PATH ?? '').split(delimiter).map((d) => join(d, n)))
  return [process.env.CHROME_PATH, ...apps, ...win, ...onPath].find((p) => p && existsSync(p))
}
