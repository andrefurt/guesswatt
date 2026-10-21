---
name: verify
description: >
  Use when a code change is ready to commit and its behaviour needs confirming in this project.
  Runs the app, opens what the change touches and checks it does what was asked, with the gate as
  one step. Triggers on: verify, does it work, check the change, before commit, confirm behaviour,
  smoke test.
---

# Verify

Claude Code runs this skill before each commit in this repo. Confirm the change works by using it,
not only by the gate passing.

1. The `check` command in `alfred.json`: clean.
2. `python3 -m http.server 8000`, then open `http://localhost:8000/` and `/sobre.html` in a browser.
3. For what the change touches: the behaviour asked for and its states (the estimate from a €/month
   amount, the precise mode by PDF upload and by manual entry, the result with the best offer, an
   invalid or empty input, a PDF that cannot be read), no errors in the console, the keyboard, and a
   narrow and a wide viewport.
4. A change to `js/calculator.js` or the data scripts: `node scripts/selftest.js 2>&1 | grep golden`
   lists the golden cases, ERSE's worked examples to the cent among them; every line is ✅. A red one
   is the bug, or a deliberate formula change whose literal moves in the same commit with the source
   of the new value (CLAUDE.md rule 8). A behaviour no golden case covers gets one before the commit.
5. Report what you ran and what you saw. Evidence is a command and its output, or a screenshot path;
   never a sentence that says it works.
