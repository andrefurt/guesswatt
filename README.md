# GuessWatts

> Compare electricity tariffs in Portugal. Discover if you're overpaying.

**GuessWatts** is a free, open-source tool that helps Portuguese consumers find better electricity tariffs. It compares all available offers from the Portuguese energy market regulator (ERSE) and shows you exactly how much you could save by switching.

## 🎯 What It Does

- **Quick estimate**: Enter your monthly bill amount (€) and get instant results
- **Precise calculation**: Upload your PDF invoice or enter detailed consumption data
- **Best offer discovery**: Finds the cheapest tariff for your profile
- **Actionable guidance**: Step-by-step instructions on how to switch providers
- **Zero backend**: Everything runs in your browser—your data never leaves your device

## ✨ Key Features

- **Two input modes**:
  - **Estimate**: Single €/month input for instant results
  - **Precise**: PDF upload or manual entry for accurate calculations
  
- **Loss framing**: Shows "You're losing €X/year" instead of generic savings
- **Real provider contacts**: Phone numbers and links from official ERSE data
- **No lock-in filtering**: Excludes offers with mandatory contract periods by default
- **Accessible**: WCAG 2.1 AA compliant, keyboard navigable, screen reader friendly
- **Privacy-first**: All processing happens client-side; no data collection

## 🚀 Quick Start

### For Users

Simply visit the website. No installation needed—it's a static site that works in any modern browser.

### For Developers

```bash
# Clone the repository
git clone https://github.com/andrefurt/guesswatt.git
cd guesswatt

# Once per clone: run the repo's git hooks (commit message format, tests before commit)
git config core.hooksPath .githooks

# Serve locally (no build step required)
python3 -m http.server 8000
# or
npx serve .

# Open http://localhost:8000
```

## 📁 Project Structure

The file map lives in [`docs/TECH_STACK.mdc`](docs/TECH_STACK.mdc#file-map) (File Map).

## 🏗️ Architecture

### Technology Stack

- **Frontend**: Vanilla JavaScript (ES6+ modules), no framework
- **Styling**: Modern CSS with OKLCH colors, custom properties, clamp()
- **Hosting**: Static hosting (GitHub Pages compatible)
- **Build**: None—files are served directly
- **Dependencies**: Zero runtime dependencies; PDF.js 3.11.174 is self-hosted in `vendor/pdfjs/` and loads only when a PDF is used

### Design Principles

1. **Simplicity**: No build step, no framework, no abstractions
2. **Performance**: a gzip size budget checked in the gate, first paint about 1.8 s on Slow 4G (see `docs/TECH_STACK.mdc`)
3. **Accessibility**: WCAG 2.1 AA compliant, keyboard-first design
4. **Privacy**: Client-side processing only, no data collection
5. **Maintainability**: Clean, documented code that lasts

### CSS Architecture

Modular CSS with design tokens:

- **Design tokens** (`tokens.css`): Colors (OKLCH), spacing, typography, animations
- **Reset** (`reset.css`): Modern CSS reset
- **Base** (`base.css`): Typography and defaults
- **Components** (`components-*.css`): Component-specific styles
- **Utilities** (`utilities.css`): Helper classes

### JavaScript Architecture

ES6 modules with clear separation of concerns:

- **State management**: URL-based state (no localStorage)
- **Business logic**: Pure functions in `calculator.js`
- **UI logic**: Component initialization and event handling
- **Data loading**: `offers.json` built from the ERSE CSVs at build time (no CSV parsing in the browser)

## 📊 Data Pipeline

### Data Sources

All data comes from **ERSE** (Portuguese Energy Services Regulatory Authority):

1. **Price data** (`Precos_ELEGN.csv`): ~13K rows of tariff prices
2. **Commercial conditions** (`CondComerciais.csv`): ~700 rows of offer metadata

### Update Process

1. **Download** (`scripts/download-erse.js`):
   - Reads the current ZIP from ERSE's `Settings.json` (`csvPath`) with plain `fetch`, no browser
   - Records ERSE's export date from the ZIP name as the price date in `meta.json`
   - Validates both required CSVs

2. **Build** (`scripts/build-offers.js`):
   - Joins CSVs on `COM` + `COD_Proposta`
   - Normalizes numbers (comma → dot)
   - Filters electricity-only offers
   - Outputs optimized `offers.json`

3. **Check the bounds** (`scripts/validate-data.js`):
   - Every CSV column the build reads is present
   - Offer and supplier floors, price and promotion ranges, TAR values
   - No jump against the last commit (offer count, suppliers, median price, price date)

4. **Validate** (`scripts/selftest.js`):
   - Ensures offers exist and have required fields
   - Validates no gas-only offers
   - Tests calculation samples

### Running Data Updates

```bash
# Download latest ERSE data
node scripts/download-erse.js

# Build offers.json from CSVs
node scripts/build-offers.js

# Check the data bounds
node scripts/validate-data.js

# Run validation tests
node scripts/selftest.js

# Or run all four in sequence
node scripts/download-erse.js && node scripts/build-offers.js && node scripts/validate-data.js && node scripts/selftest.js
```

## 🧮 Calculation Logic

### Monthly Cost Formula

```javascript
// Fixed term (daily charge × 30 days)
fixedTerm = TF × 30

// Variable term (depends on tariff type)
// Simple: consumption × TV
// Bi-hourly: consumption × (0.40 × TVV + 0.60 × TVFV), or the split read from a PDF bill
// Tri-hourly: consumption × (0.30 × TVVz + 0.50 × TVC + 0.20 × TVP)

// Taxes: IEC 0.001 €/kWh, DGEG 0.07 €/month, audiovisual 2.85 €/month
// VAT per component (6% or 23%): see "Taxes and VAT" in docs/DATA_MODEL.mdc
```

### Consumption Estimation

When only monthly bill amount is provided:

1. Build a typical offer from the data (median fixed term and median energy price at 4.6 kVA)
2. Find the consumption whose monthly cost on that offer equals the bill (bisection on the cost formula)

### Best Offer Selection

1. Filter valid offers (electricity-only, matching power/tariff, no lock-in)
2. Calculate monthly cost for each offer
3. Calculate annual effective cost (12 × monthly)
4. Sort by annual cost (primary), then monthly cost (tiebreaker)
5. Return best offer

## 🎨 Design System

`css/tokens.css` is the only owner of the token values (colour, type, spacing, motion);
[`docs/TECH_STACK.mdc`](docs/TECH_STACK.mdc) names the tokens and their roles.

- **Font**: Inter, self-hosted in `vendor/fonts/` (latin and latin-ext subsets, SIL OFL 1.1)
- **Colour**: OKLCH, with light and dark values that follow the system setting
- **Reduced motion**: every animation and transition respects `prefers-reduced-motion`

## ♿ Accessibility

### Requirements

- **WCAG 2.1 AA** compliance
- **Keyboard navigation** throughout
- **Screen reader** tested (VoiceOver, NVDA)
- **Focus visible** at all times
- **Color contrast** ≥4.5:1 (text), ≥3:1 (UI)
- **Touch targets** ≥44px

### Implementation

- Semantic HTML (`<button>`, `<dialog>`, `<details>`)
- ARIA labels where needed
- Live regions for dynamic content
- Focus trapping in modals
- Skip links for keyboard users

## 🧪 Development

### Code Standards

- **JavaScript**: ES6+ modules, JSDoc comments, descriptive names
- **CSS**: BEM-ish naming, custom properties, no magic numbers
- **HTML**: Semantic elements, proper ARIA attributes
- **Comments**: Explain WHY, not WHAT

### File Naming

- `kebab-case.js` → JavaScript modules
- `kebab-case.css` → CSS files
- `PascalCase` → Classes (in docs only)
- `camelCase` → Functions, variables
- `SCREAMING_SNAKE` → Constants

### Git Commits

```
type(scope): description

feat(calculator): add bi-hourly tariff support
fix(modal): trap focus correctly
style(tokens): update color palette to OKLCH
docs(readme): add installation instructions
refactor(state): simplify URL encoding
```

## 📚 Documentation

Comprehensive documentation is available in the `docs/` directory:

- **[CONCEPT.mdc](docs/CONCEPT.mdc)**: Product vision, user flows, LOVE framework
- **[TECH_STACK.mdc](docs/TECH_STACK.mdc)**: Technical architecture, CSS/JS patterns
- **[DATA_MODEL.mdc](docs/DATA_MODEL.mdc)**: CSV schemas, calculation formulas
- **[DECISIONS.mdc](docs/DECISIONS.mdc)**: Architecture Decision Records (ADRs)
- **[IMPLEMENTATION.mdc](docs/IMPLEMENTATION.mdc)**: Phase-by-phase implementation plan
- **[COPY.mdc](docs/COPY.mdc)**: Tone of voice, UI copy, glossary
- **[CURSOR_RULES.mdc](docs/CURSOR_RULES.mdc)**: AI assistant behavior rules

## 🤝 Contributing

Contributions are welcome! Please:

1. Read the documentation in `docs/`
2. Follow the code standards outlined in `docs/CURSOR_RULES.mdc`
3. Ensure accessibility requirements are met
4. Test in multiple browsers (Chrome, Safari, Firefox)
5. Test with keyboard navigation and screen readers

## 📄 License

MIT License - see LICENSE file for details

## 🙏 Acknowledgments

- **ERSE** for providing open tariff data
- **Portuguese consumers** for feedback and testing

## 🔗 Links

- **Website**: [guesswatts.com](https://guesswatts.com) (or your domain)
- **Issues**: [GitHub Issues](https://github.com/andrefurt/guesswatt/issues)
- **ERSE Simulator**: [ERSE Website](https://www.erse.pt/)

---

**Made with ❤️ for Portuguese consumers**

