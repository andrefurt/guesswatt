# LessWatt v2

Compare electricity tariffs in Portugal. Find out if you're overpaying.

## Quick Links

| Document | Description | Auto-Apply |
|----------|-------------|------------|
| [TECH_STACK.mdc](./TECH_STACK.mdc) | Technology decisions and constraints | ✅ Always |
| [DECISIONS.mdc](./DECISIONS.mdc) | Architecture Decision Records (ADRs) | ✅ Always |
| [CONCEPT.mdc](./CONCEPT.mdc) | Product vision, user flow, design principles | When relevant |
| [IMPLEMENTATION.mdc](./IMPLEMENTATION.mdc) | Phase-by-phase implementation plan | When relevant |
| [COPY.mdc](./COPY.mdc) | Tone of voice, all copy, glossary | When relevant |
| [DATA_MODEL.mdc](./DATA_MODEL.mdc) | CSV schema, formulas, data relationships | When relevant |
| [CURSOR_RULES.mdc](./CURSOR_RULES.mdc) | AI assistant behaviour and project context | ✅ Always |

## Core Idea

One input: "How much do you pay per month?"

One output: "You're losing €X/year. Here's the best tariff and how to switch."

## What's New in v2

### Simpler Entry
- Single € input (was: power + consumption + tariff)
- Optional PDF upload for precision (subtle icon, not a distraction)
- Estimate → Refine flow

### Better Output
- Loss framing: "You're losing €288/year"
- Offer card with expandable details
- Tooltips for technical terms (ⓘ)
- Real provider contacts from ERSE data

### Actionable
- Step-by-step switching script with actual phone numbers
- "What you DON'T need to do" section
- Calendar reminder (2 months default)
- Social proof from ERSE statistics

## Data Sources

| Source | What | Update |
|--------|------|--------|
| ERSE CSVs | Tariff prices, commercial conditions | Monthly (automated) |
| ERSE Reports | Market statistics, social proof | Every 4 months (automated) |

## Tech Stack

- **Vanilla JS** — No framework, no build step
- **Modern CSS** — OKLCH colors, clamp(), custom properties
- **Static hosting** — GitHub Pages
- **Automated data** — GitHub Actions for CSV + insights updates

## Project Structure

```
lesswatt/
├── index.html
├── css/
│   ├── tokens.css      # Design tokens
│   ├── reset.css       # CSS reset
│   ├── base.css        # Typography
│   ├── components.css  # UI components
│   └── main.css        # Imports
├── js/
│   ├── app.js          # Entry point
│   ├── calculator.js   # Price calculations
│   ├── data.js         # CSV loading
│   └── components/     # UI components
├── data/
│   ├── Precos_ELEGN.csv
│   ├── CondComerciais.csv
│   ├── erse-insights.json
│   └── providers.json
├── docs/
│   └── v2/             # This documentation
└── scripts/
    ├── download-erse.js
    └── fetch-erse-insights.js
```

## Implementation Phases

| Phase | Focus | Status |
|-------|-------|--------|
| 0 | Foundation (tokens, reset, base) | ⬜ |
| 1.1 | Input with PDF option | ⬜ |
| 1.2 | Result with offer card | ⬜ |
| 1.3 | Switching guide | ⬜ |
| 1.4 | Tooltips & modals | ⬜ |
| 2.1 | Refine flow (manual input) | ⬜ |
| 2.2 | Calendar reminder | ⬜ |
| 2.3 | Share functionality | ⬜ |
| 3 | All offers list | ⬜ |
| 4 | PDF parsing | ⬜ |
| 5 | ERSE insights integration | ⬜ |
| 6 | Polish & testing | ⬜ |

## Accessibility Requirements

- WCAG 2.1 AA compliance
- Keyboard navigation throughout
- Screen reader tested (VoiceOver, NVDA)
- Reduced motion support
- Touch targets ≥44px
- Color contrast ≥4.5:1

## Performance Targets

- First Contentful Paint: <1.5s
- Time to Interactive: <3s
- Lighthouse Performance: >90
- Lighthouse Accessibility: 100
- No external dependencies (except PDF.js for Phase 4)

## Commands

```bash
# Development (local server)
pnpm dev

# Update ERSE data manually
pnpm update-erse

# Update ERSE insights manually
pnpm update-insights
```

## License

MIT
