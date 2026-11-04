# Contributing

Thanks for helping. The skill is three things that must agree with each other:

- `SKILL.md` tells the agent how to design a character: the style, the file format, the built-ins and the acting rules.
- `kit/avatar.mjs` renders and validates character files. `kit/build.mjs` is the command the skill runs.
- `examples/` holds complete characters the agent reads before it starts.

## Setup

You need Node.js 18 or later; there's nothing to install. For `--shot`, have Chrome, Chromium, Brave or Edge installed (or set `CHROME_PATH`).

```sh
node --test tests/*.test.mjs
```

## Changing the kit

- **New built-in mood, action, effect or part:** add it to the table in `kit/avatar.mjs`, then document it in section 5 of `SKILL.md`. For an effect, include where it sits on the canvas.
- **New validation rule:** add it to `check()` with a message that says exactly how to fix the problem, and add the mistake to the validator test in `tests/avatar.test.mjs`.
- Keep the kit dependency-free and the output a single self-contained SVG: no scripts, fonts or external files.
- Rebuild the examples and commit their SVGs: `for d in examples/*/; do node kit/build.mjs "$d$(basename "$d").json"; done`. CI fails if they're out of date.

## Changing the skill

`SKILL.md` is what makes characters good on the first try, so test changes on fresh agents. Run `/bots` for a few of the prompts in `evals/evals.json` in a new session, then look at each `frames.png`. Note anything the agent found unclear or got wrong.

## Adding an example

An example should teach something the others don't. Put it in `examples/<slug>/<slug>.json`, build it, and add it to the README table.
