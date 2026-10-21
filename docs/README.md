# GuessWatts documentation

Each fact has one owner. Other docs link to the owner instead of repeating it, so a change lands in one
place.

| Owner | What it owns |
|---|---|
| [`CLAUDE.md`](../CLAUDE.md) | The rules, the commands, the working agreement and where to look |
| [`.claude/rules/`](../.claude/rules/) | The CSS and copy rules, loaded for the files they cover |
| [`CONCEPT.mdc`](./CONCEPT.mdc) | Product intent and user flows (the original concept; its note says what changed) |
| [`TECH_STACK.mdc`](./TECH_STACK.mdc) | Architecture, the file map, the size budget, the accessibility checklist, browser support |
| [`DATA_MODEL.mdc`](./DATA_MODEL.mdc) | The ERSE columns and the calculation in prose; `js/calculator.js` owns the formulas |
| [`DECISIONS.mdc`](./DECISIONS.mdc) | Every decision (ADR) with its status; the index is at the top |
| [`COPY.mdc`](./COPY.mdc) | The voice and the glossary; the code owns the strings |
| [`DEVELOPMENT.md`](./DEVELOPMENT.md) | Setup, the workflow, the gate, a data refresh by hand, troubleshooting |
| [`css/tokens.css`](../css/tokens.css) | Every token value (colour, type, spacing, motion) |
| [`audit/`](./audit/) | The October 2026 audit: findings, owner decisions and the execution plan |
| [`archive/`](./archive/) | History, not maintained |

When something looks odd, read `DECISIONS.mdc` first: it is probably deliberate.
