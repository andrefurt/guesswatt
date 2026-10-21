# GuessWatts

Compares electricity tariffs in Portugal with ERSE's official data and shows people how much they
are losing on their current one. Live at guesswatts.com. A static site: plain JavaScript modules and
CSS, no framework, no build step, no backend. A weekly GitHub Action refreshes the data in `data/`.

## Commands

```sh
python3 -m http.server 8000           # serves the site at http://localhost:8000
node scripts/selftest.js              # data and calculation tests; part of the gate (alfred.json check)
node scripts/size-check.js            # gzip budget from docs/TECH_STACK.mdc; part of the gate
node scripts/rules-check.js           # the greppable rules below and in .claude/rules/; part of the gate
node tests/smoke.mjs                  # the page flows in a browser; CI only (ADR-025), usage in its header
git config core.hooksPath .githooks   # once per clone, so the git hooks run
```

CI (`.github/workflows/ci.yml`) runs the same check on every push and pull request, and a red gate on
main opens an issue. Every Wednesday it checks that the prices are under 21 days old (an issue, never
a red gate).
An issue comment with "@claude" from the owner starts `.github/workflows/claude.yml`: a fix on a
`fix/` branch and a link to open the PR, never a merge (ADR-026).

Data refresh (plain fetch, no dependencies; normally left to the weekly Action):
`node scripts/download-erse.js && node scripts/build-offers.js && node scripts/validate-data.js && node scripts/selftest.js`.
`validate-data.js` holds the data bounds (headers, ranges, the jump against HEAD); `selftest.js` tests the code.

## Rules

`scripts/rules-check.js` tests the part of rules 1, 3, 4 and 7 a grep can see, that every file the
site loads is in git, and that doc links open; the rest is judgement.

1. No framework and no build step: the browser loads the files as they are in the repo.
2. All processing stays in the browser; the user's data never leaves the device.
3. App state lives in the URL, not in localStorage, so a result can be shared as a link
   (`js/url-state.js`, ADR-018: plain params, coerced on the way in).
4. User-facing text is PT-PT and uses "tu"; never "você", never Brazilian forms.
5. Semantic HTML first: `<button>`, `<dialog>`, `<details>` before custom widgets.
6. Every interactive element works with the keyboard, shows focus and respects reduced motion.
7. Never `innerHTML` with user content.
8. `js/calculator.js` owns the formulas; `docs/DATA_MODEL.mdc` explains them and loses where they
   disagree. `scripts/selftest.js` imports the calculator and pins golden values, so a formula change
   updates those literals in the same commit.

## Where to look

| Task | Read first |
|---|---|
| Calculations, CSV fields, formulas | `js/calculator.js`, then `docs/DATA_MODEL.mdc` |
| Any UI copy, tooltips, errors | The code owns the strings; `docs/COPY.mdc` owns the voice and glossary |
| Product intent and user flows | `docs/CONCEPT.mdc` |
| Architecture and CSS or JS patterns | `docs/TECH_STACK.mdc` |
| The weekly data update | `.github/workflows/update-erse.yml` |
| Something looks odd | `docs/DECISIONS.mdc` (the decision log): it is probably deliberate |

## Skills

Owners in this repo:
- Motion values (easing, durations): craft:motion. Emil's review-animations, improve-animations and
  find-animation-opportunities judge purpose, frequency and interruption, never the curve.
- A web app on a phone (the installed PWA, touch, safe areas): mobile-native.
- Worst-case data: break-ui, run by hand only (`skillOverrides` in `.claude/settings.json`).
- Typography, layout, accessibility, interface copy: better-typography, better-layout,
  better-accessibility, better-writing, applied in this repo's own CSS and in `docs/COPY.mdc`'s voice.
- A hard bug: diagnosing-bugs.
- Does the change work: verify.

craft's references win over the lenses.

## Working agreement

- This repo's docs and rules win over any skill or plugin that disagrees with them.
- Stop with a plan when a change shows on the page, adds a file, a token, a component or a dependency,
  or needs a choice the docs leave open. Anything else goes ahead.
- When the docs are silent, ask with a recommendation; the answer lands where the next reader looks,
  in the same commit.
- When the person says a task is done, `/alfred:close` runs the closing round; it does not start on its own.
