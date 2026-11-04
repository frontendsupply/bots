---
name: bots
description: Design a unique, animated avatar character from a short idea ("cat fish", "flying tiger", "a sleepy cloud for our support bot"). Draws it in a hand-drawn house style (a flat colour disc with off-register ink line art) and gives it its own personality, with expressions, a signature move, reacting body parts and effects, as self-contained animated SVGs for idle, working and sleeping. Use it whenever someone wants a bot avatar, a mascot, an animated character or profile icon, or an avatar for an AI agent, even if they never say "avatar".
license: MIT
compatibility: Written for Claude Code; works in any agent that supports Agent Skills. Needs Node.js 18+. Chrome, Chromium, Brave or Edge is optional, for the frames check.
argument-hint: <idea, e.g. flying tiger>
allowed-tools:
  - Read
  - WebSearch
  - WebFetch
  - Write(avatars/**)
  - Edit(avatars/**)
  - Bash(node ${CLAUDE_SKILL_DIR}/kit/build.mjs *)
---

# Bots: design a character

Turn **$ARGUMENTS** into a finished character in one pass. If that's blank, or your agent doesn't fill it in, use the idea the user asked for. Don't ask questions: read the concept playfully and commit. For example, "cat fish" is a cat face on a fish (fins, tail, barbel whiskers) and "flying tiger" is a striped tiger with wings.

`${CLAUDE_SKILL_DIR}` below is this skill's folder, the one that holds this SKILL.md. If your agent doesn't expand it, use that folder's path.

**Output:** one character file, `avatars/<slug>/<slug>.json`, in the user's current project (or in the folder they name). The slug is the character's name if the user gives one ("a lighthouse called Pip" → `pip`), otherwise the concept, in lowercase with hyphens (`cat-fish`, `flying-tiger`). The build step writes the SVGs next to it. If the file already exists, treat the request as a redesign and replace it. Write and edit the JSON directly with your file tools; don't generate it with scripts. Keep it compact like the examples: one layer, beat or key list per line. Never edit the kit.

Read `${CLAUDE_SKILL_DIR}/examples/turkey/turkey.json` first. It's a complete, working example of every field below. `examples/cat-fish` and `examples/flying-tiger` are two more.

## 0. Famous characters: faithful first

If the idea names something that already exists, people know exactly what it looks like. That covers cartoon and game characters, mascots, people and brands. The goal is a fan saying "that's Blossom from The Powerpuff Girls!" at first sight. A creature that merely shares one of the character's traits fails, and so does anything that reads as a ghost. In "our style" the house style is the *drawing*: flat fills, confident ink outlines, the off-register disc, the line boil. It is not the one-colour palette. Before drawing:

- **Research it.** Search the web for its wiki or official page (appearance and personality), and study any image the user attached. **Look at several official pictures, not one:** a close-up of the face plus two or three other poses. An image search of the show's own art is the quickest way to see them side by side. A single picture can be an alternate or off-model design, so draw what most official art agrees on. If you can't see pictures, compare written descriptions from more than one source.
- **Write down what makes it recognisable**, most iconic first:
  - **Head shape and proportions:** round or long, big or small eyes, how far the hair reaches.
  - **Face:** eye style and size, skin colour, nose and mouth.
  - **Hair and silhouette,** then accessories.
  - **Its canonical colours.**
  - **How it moves in its source:** walk, fly, hop, signature attacks, catchphrase gestures.
  - **Personality.**

  For Blossom: a big round peach head; huge pink eyes; orange hair as a cap with blunt, notched bangs, and one long lock flowing out behind to one side; a tall red bow; she hovers and zips off on a pink streak; ice breath; the bossy, clever leader.

  Note each feature's **size, shape and placement** against the head, not just that it's there. For Uncle Grandpa: a tall, narrow bald dome with a long jaw; a tiny blue propeller beanie on top; small ears tucked against the sides; two small eyes close together, with a big pink nose over their bottom edge; one thick, curly mustache that starts under the nose and wraps around the mouth down to the chin; one buck tooth.
- **Use its real colours.** Declare 4–7 flat colours in `colors` (skin, hair, outfit, accessories, eyes; more if an effect needs them, like a rainbow) and set `color` to the head's colour. Shades of one colour are fine (a lighter and a darker pink for a streak). Only original characters stay with one palette colour.
- **Heads only, always.** The avatar is the character's head. Never draw a torso, arms, legs or clothes below the chin, not even for a character people know by its body. Recognition comes from the head: face, eyes, skin, hair, headwear and colours. Small parts that attach to a head are welcome: wings for a bird, fins for a fish, ears, horns, antennae, a tail, a bow. Show what the body would do through the head, its appendages and effects (a flight streak, a punch's impact lines).
- **Hair must flatter.** Draw it the way the character wears it, simple and friendly:
  - a cap over the top of the head, with the character's bangs
  - **copy the bangs exactly; at head-only scale they are the identity:**
    - where the hairline sits: Blossom's comes straight down onto her eyes
    - which way the cuts go: her skin shows *up* into the hair as a tall centre triangle and two thin slits slanting toward it. Hair points hanging down into the face would be a different character.
    - how many cuts there are, and where
  - long hair as one lock or ponytail flowing out behind to one side, the way it moves in the wind
  - never a curtain hanging down both sides of the face, and never a mass framing the whole head; both read as a horror-movie ghost
  - keep the face open and well lit
- **Draw its face, not a generic one.** Never leave a face white when the character has skin. Iconic eyes get your own eye drawings, in colour (section 3). **Copy the eye anatomy from a close reference:**
  - their size against the face: Powerpuff eyes are each nearly half the face and almost touch
  - how low they sit, and whether the hair covers their top edge (use an `over` layer for those bangs)
  - pupil size: Powerpuff pupils are mostly black, inside a thick coloured iris ring
  - the highlight's size and position
  - lashes, and brows only if the character has them

  Expressions change the lids. Cut the white of the eye with a slanted lid line for angry or determined. For thinking or plotting, glance the pupils up and to the side instead of using flat half-lids. If the eyes are too small under a straight hairline, the whole face reads as glasses.
- **Make the effects look like the source's.** Match the shape, colour and direction. The Powerpuff flight streak is a straight band in the character's colour, with darker blocks and a broken pixel end, left behind as they shoot straight up. Effects never cross the face: breath blows forward and down from the mouth.
- **Animate it the way it moves in its source.** Its signature movement becomes the custom action, and its powers become the effects. Hair locks, bows, ears, wings and tails react to moods: streaming back in a dash, bouncing in a cheer.
- **Judge the frames against the reference, trait by trait.** Put frames.png next to the pictures and compare each feature's size, shape and placement. The usual misses are a feature at the wrong size (ears twice too big turn a man into a monkey) and the wrong shape (a wrap-around mustache drawn as two hanging braids). Would a fan name it at 48px? If it reads as something else, the skin, eyes or hair are wrong. Fix those first. If anything looks scary or creepy, it's wrong too: check the hair first, then eyes that are too intense.

## 1. Brief (decide before drawing)

- **Silhouette:** 2–4 features that make the concept readable at 48px, for example tiger = ears + stripes + wings. Features should break the circle's outline, because that's what makes the character recognisable.
- **Personality:** an adjective pair with a twist, such as "proud but clumsy" or "lazy, vain".
- **Signature move:** a custom action only this character does (a flap-and-hover, a tail-swish strut).
- **Signature effect:** a custom effect tied to the concept (bubbles, feathers, roar lines, steam).
- **Reactions:** how the appendages react to moods. Wings flap fast when laughing and droop when sad; a tail wags when happy and goes stiff when surprised.

## 2. Canvas and house style

The look is a flat colour disc with off-register black ink line art. The kit prints the disc up to 2 units off the line art (it varies per character), so keep solid black fills about 2.5 units inside the head's edge, and let headbands or helmets overlap the head rather than just touch it.

- **Every character is a head:** the disc, plus small parts that attach to it (section 0). **Nothing sits under it:** no shadow, ring, plate, bowl, puddle or floor line. The head floats on its own. viewBox is `-5 -10 110 110`. **The disc is centred at (50, 54) with r 28**, so it spans x 22–78 and y 26–82. Keep drawings inside x −3…103 and y −2…98. **At rest, put nothing above y 6**, because jumps lift the whole body by up to 15. A taller feature (a bow, horns, ears) needs small lifts: use your own moves with `y` no higher than −8, and skip `jump` and `pop`. A head piece that's tied on, like a bow or a hairband, goes in `front`; `top` makes it lag and lift like a loose hat. A lean pivots at the bottom of the head, so it swings tall headwear furthest. Keep leans under about 10°, and check the frames' left and right edges.
- Every layer inherits the ink style: stroke `#151515`, width 1.8, round caps and joins, `fill none`. Only override it on purpose:
  - `fill="#fff"` for solid objects that should hide the disc (fins, horns, wing fronts, bones).
  - `fill="#151515" stroke="none"` for solid black (pupils, noses, stripes as shapes).
  - Thin detail: `stroke-width="1.2"`. Highlight: `stroke="#fff" stroke-width="2.4"`.
- **Original characters use one colour:** the disc. `color` is a palette name: `blue`, `yellow`, `green`, `red`, `purple` or `orange`. No gradients, no other colours, and no text. Known characters use their canonical flat colours instead (section 0). To paint a part in the disc's own colour, use `fill="disc"` (or `stroke="disc"`): hair, ears or a tail that should match it.
- Use few, confident strokes: simple Q/C curves and at most ~6 drawn elements per layer. A `<g>` wrapper doesn't count, and several subpaths in one `d` are fine. Line art crossing the disc's edge is the style, so ears poke out and whiskers run past the rim.
- To mirror around x = 50: `<g transform="translate(100 0) scale(-1 1)">…</g>`.
- Allowed elements are `path circle ellipse rect line polyline polygon g`. Script, style, text, image, href and `on*` attributes are rejected.

## 3. Face

The engine draws the eyes, brows and mouth for each mood, so don't draw a face in layers. Place it with `face: { x, y, spacing }`: x, y is the point between the eyes (default 50, 50) and spacing defaults to 6.5. Face drawings are scaled ×1.3, so each eye sits at `x ± spacing×1.3` and the mouth about 12 units below the eyes. Before scaling, eye radii are `dots` 2, `tiny` 1.4, `ring` 3.3 and `wide` 3.8, and brows sit about 4–6 above each eye's centre. Keep your own face-layer drawings (nose, whiskers) clear of that eye-and-mouth area. **When the eyes are part of who the character is** (cartoon eyes, anime eyes, a cyclops), draw your own. A custom mood's `eye` can be an SVG, either one for both eyes or `[left, right]`, drawn around each eye's centre before the ×1.3 scale. Redefine every mood you use with those eyes (you can override built-in names like `happy`). Put the brows above the bigger eyes, and set `"blink": false` on eyes drawn closed. Off-centre faces add character (the turkey's face sits at x 40). Face accessories that should turn with the head, such as noses, snouts, whiskers and cheek marks, go in an `at: "face"` layer.

## 4. File format

```jsonc
{
  "name": "Flying Tiger",                 // display name
  "prompt": "/bots flying tiger",         // the user's request, word for word as they typed it
  "color": "orange",                      // palette name
  "parts": { "eyes": "dots", "mouth": "mood", "top": "none", "neck": "none", "extra": "none", "outline": "none" },
  "face": { "x": 50, "y": 50, "spacing": 6.5 },
  "colors": { "skin": "#ffddc7", "hair": "#f5901f" },   // known characters only: named flat colours, used as fill="hair" etc.
  "disc": { "x": 50, "y": 58, "r": 27 },                // optional: move the head down a little to make room for tall headwear (default 50, 54, 28)
  "layers": [ /* drawings, see below */ ],
  "moods":   { /* optional custom expressions */ },
  "actions": { /* custom body moves */ },
  "fx":      { /* custom effects */ },
  "idle":     [ ["happy", "idle", "", 3], … ],   // waiting, ready to work: [mood, action, effect or "", seconds]
  "working":  [ ["focus", "swim", "bubbles", 2], … ], // busy: 2–3 beats with the signature move and effect
  "sleeping": [ ["sleep", "breathe", "zzz", 5.2] ] // optional; the default is a slow breath with zzz
}
```

**Layer:** `{ "at", "svg", "origin"?, "loop"?, "react"? }`

| at | depth | moves with |
|---|---|---|
| `back` | behind the disc | body. The disc hides the base, so wings, tails, fins and tentacles attach naturally |
| `front` | over the disc | body (stripes, bellies, hair, held objects) |
| `face` | over the disc and the eyes and mouth | body + head turns (noses, whiskers, snouts, an eye patch) |
| `over` | over the face | body: bangs or a hat brim that covers the top of the eyes, masks |
| `top` | over the disc | body + lagging hat motion (ears, horns, tufts) |

- `origin` is the pivot, relative to the layer's own bounding box: the shapes' geometry, not counting stroke width (`"center"`, `"100% 50%"` = right-middle). Put it at the attachment point: a left wing uses `"100% 80%"`, a tail on the right uses `"0% 50%"`.
- **Paired appendages (two wings, two ears) go in separate layers**, so each one pivots at its own root. Draw the second one mirrored inside its layer (`<g transform="translate(100 0) scale(-1 1)">`) and mirror its origin's x too (`"0% 80%"` instead of `"100% 80%"`). The motion runs outside your mirror transform, so **negate `r` and `x` in the mirrored layer's keys** to keep the pair symmetric.
- `loop` is always running, in every state: `{ "period": seconds, "keys": [...] }`. So it must stay gentle: period ≥ 1 s, within ±12°, ±3 units and scale ±8% (a slow hair sway, a breathing tail). Any layer can have `loop` and/or `react`.
- `react` is per mood and plays during beats with that mood: `{ "laugh": Motion, "sad": Motion, … }`. It **adds to** `loop`: the loop keeps running and the reaction plays on top of it. The two are nested groups, so their transforms combine and their opacities multiply. Lively reactions (a fast wag, a flap) go on moods used only in `working`; a mood that also plays in `idle` keeps its reactions as gentle as a loop.

**Motion:** `{ "period"?: seconds, "keys": [[t, pose, ease?], …] }`
- `t` runs 0…1 across the beat. With `period` set, `t` spans one cycle instead, and the engine stretches the period slightly so a whole number of cycles fills each beat. Nothing snaps at beat edges.
- `pose` takes `x`, `y` (units, +y is down), `r` (degrees, + is clockwise), `sx`, `sy` (scale), `o` (opacity). Missing fields are at rest.
- `ease` applies to the segment that starts at that key:
  - `out`: decelerate (take-offs, settling)
  - `in`: accelerate (falls, wind-ups)
  - `io`: smooth there-and-back
  - `sine`: gentle (breathing, floating)
  - `back`: overshoot and settle (pops, landings, anything snappy)
  - `ioBack`: wind up, then overshoot (head turns)
  - `step`: holds the value until the next key, then jumps to it (frame swap, flicker, jitter)
- Start and end every motion at rest `{}` so beats chain without snapping.

**Custom action:** `"actions": { "strut": { "body": Motion, "face"?: Motion, "top"?: Motion } }`. Here `body` is the whole character with its pivot at the bottom centre, `face` shifts the features (x ±8 reads as a head turn), and `top` moves the hats and `top` layers.

**Custom effect:** `"fx": { "bubbles": [ { "x", "y", "svg", "period"?, "behind"?, "keys" }, … ] }`. Set `"behind": true` for a part drawn behind the character, such as a flight streak, a dust cloud or a speed trail. Each part is drawn around its own (0, 0) and placed at x, y. Its poses pivot on that (0, 0), so put (0, 0) where the effect attaches (a lamp, a mouth, a tail tip). `sx: -1` mirrors the part there, and `sx`/`sy` from 0 grow it out of that point. Use x 0, y 0 to draw in disc coordinates instead. Effects are fixed to the canvas and don't follow the body, so place them where the action happens at that moment, such as above the head or beside a tail. **The first and last keys must have `o: 0`.** With `period`, the keys describe one cycle, so each cycle starts and ends hidden. Stagger parts by giving each a different hidden lead-in (see `steam` in the turkey example).

**Custom mood:** `"moods": { "smug": { "eye": "base", "brow": ["M-3-5Q0-7 3-5", "M-3-4H3"], "mouth": "M-4 1Q0 3 4-1", "blush": true } }`. Custom moods work everywhere built-in ones do: in every state's beats and as `react` keys. A custom mood with a built-in name replaces it.
- `eye`: `base` (the character's own eyes), `dots`, `tiny`, `ring`, `wide`, `happy` (^), `closed` (‿) or `down`. It can also be your own SVG: one string for both eyes, or `[left, right]`.
- `blink`: defaults to true, except for `happy` and `closed`. Set it to false for your own closed eyes.
- `brow`: [left, right] paths drawn around each eye's centre.
- `mouth`: a path around the mouth point, or one of `open`, `grit`, `o`, `osmall`.

## 5. Built-ins (use freely alongside your own)

- **parts:** eyes `dots|tiny|ring`. mouth `mood|mustache|beak|nose|cat|teeth`. **Prefer `mood`**: the mouth then changes with every expression. `beak`, `cat`, `teeth` and `mustache` are fixed mouths that never change shape (only the beak and mustache chatter), so the character loses its mouth acting. Use one only when that fixed mouth is the whole joke. For a snout or nose, set `mood` and draw it in a `face` layer. top `none|tophat|fedora|antenna|ears|bow|headphones|crown|sprout`. neck `none|bowtie`. extra `none|glasses|freckles|whiskers`. outline `none|ring|curls|swoop`. Set anything you replace with your own drawing to `none`.
- **moods:**
  - `neutral`: small smile
  - `happy`: smile
  - `laugh`: ^^ eyes, open mouth
  - `skeptic`: raised brow, wavy mouth
  - `sad`: worried brows, frown
  - `angry`: V brows, gritted teeth
  - `surprised`: wide eyes, o
  - `bliss`: closed eyes, blush
  - `cool`: smirk
  - `shy`: looks down, blush
  - `focus`: determined
  - `sleep`
- **actions:**
  - `idle`: slow, small bob (calm: fine in idle)
  - `glance`: looks to one side and back (calm: fine in idle)
  - `bop`: happy bouncing
  - `turn`: looks aside
  - `tilt`: thinking head tilt
  - `pop`: squash, burst up, laugh-jiggle
  - `jump`: anticipation, leap, squash landing
  - `shake`: angry vibrate
  - `huff`: big sigh
  - `droop`: sag
  - `sway`: dreamy rock
  - `hide` then `peek`: a pair. hide turns away, peek must follow it.
  - `breathe`: slow breath (calm: fine in idle and sleeping)
  - `hustle`: busy hops
- **fx:** these sit at fixed spots on the canvas. When you use one, keep your own drawings clear of its spot, or draw your own effect instead.
  - `question`: "?" at the top right (76, 22)
  - `burst`: idea ticks fanned around the top of the disc
  - `sparkles`: "+" twinkles at four spots just outside the disc
  - `grawlix`: "#!@!#" in a row above the head (y ≈ 13)
  - `sweat`: a drop sliding down from the right temple (75, 38)
  - `notes`: ♪ floating up on the right (74–82, 36–44)
  - `hearts`: floating up at the top left and top right
  - `lines`: shake lines on both sides at disc height
  - `shades`: sunglasses dropping onto the eyes
  - `zzz`: z's drifting up from the top right (72, 26). This is also the default sleeping effect. If horns, ears, a shell or headwear sit there, draw your own sleep effect on the free side.

## 6. Make it act (what separates good from bland)

Every avatar has three states, and each must be unmistakable at a glance. Someone looking at it should know whether the agent is waiting, busy or asleep.

- **idle: waiting, ready to work.** Awake and attentive, but nearly still: a slow bob, a breath, a look to the side. 2–4 beats, 6–14 s, calm moods (`neutral`, `happy`, `cool`, or the character's resting face). Use only `idle`, `breathe`, `glance`, or a custom move within ±3 units, ±5° and scale ±5% (a gentle hover). **No effects.** A big move, an effect or a lively reaction in idle makes it look like it's working; the build refuses all three.
- **working: busy.** **2–3 beats, about 4–6 s.** A focused face (`focus`, or the character's own determined mood) doing `hustle` or its signature move, with its signature effect. One beat can burst into a quick laugh or a big signature moment (the turkey's laugh and wobble, Blossom's launch on her pink streak). Start on the busy beat, so the switch from idle shows at once.
- **sleeping:** eyes closed (`sleep`, or your own closed eyes with `"blink": false`), `breathe`, and `zzz` or your own drowsy effect. One beat is enough; the default is fine.
- **Required uniqueness:** ≥ 1 custom action, ≥ 1 custom effect, and ≥ 2 custom layers with `loop` and/or `react`. Use built-ins for the rest.
- **Depth clashes:** `back` layers pass behind the disc and behind everything drawn over it, including `top` ears and horns. Plan swinging appendages around that. Keep wings mostly sideways and flap them ±15–20° so they clear the ears, or put the ears in `back` too.
- **Anticipation:** squash (`sx` 1.1–1.18, `sy` 0.82–0.9) for 10–15% of the beat before a jump or pop.
- **Overshoot:** use `back` easing into big poses and landings.
- **Follow-through:** appendages lag and settle after the body. React with larger rotations in working (wings and tails ±15–35°, ears ±8–15°).
- **Tempo:** fast loops (0.15–0.35 s) read as excited (flaps, wags, shivers) and belong in working reactions. Slow loops (1.2–3 s) read as calm (floating, breathing).
- **Ranges:** body y −15…+4 and r ±15°. Keep scale within 0.82–1.18.

## 7. Build, look, finish

1. **Build:** `node ${CLAUDE_SKILL_DIR}/kit/build.mjs avatars/<slug>/<slug>.json --shot`
   - It validates the file and prints exact errors (`layers[2].react.laugh.keys[1]: unknown ease "bounce"`). Fix them until it prints ✓.
   - It writes `<slug>.svg` (idle), `<slug>-working.svg`, `<slug>-sleeping.svg` and `preview.html`.
   - With a Chrome, Chromium, Brave or Edge installed, it also writes `frames.png`.
2. **Look at `frames.png`** (open it as an image). It shows the character large (look hard at the face there) and at 48px and 32px, then two paused frames inside every beat of each state, each labelled with its beat and time.
   - Ask yourself: does it read as $ARGUMENTS at a glance, even at 32px? Does the IDLE row look like waiting, clearly calmer than WORKING, and SLEEPING like sleep? For a known character, check it against the reference trait by trait. Is anything clipped at the top during jumps? Do appendages attach cleanly behind the disc? Do the effects fire where intended? Does every beat look different from the one before?
   - Fix the issues, build again and look once more.
   - Without `frames.png`, open `preview.html` in a browser tool if you have one; otherwise skip this step.
3. Reply in 3–5 lines:
   - the personality in one sentence
   - the three states in one line each (idle, working, sleeping)
   - the files: the three SVGs and `preview.html`
   - how to use it: `<img src="avatars/<slug>/<slug>.svg" width="128" alt="<name>">`. The animation is CSS inside the SVG, so it plays anywhere an image does and respects reduced-motion settings.
