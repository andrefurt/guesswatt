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
git clone https://github.com/yourusername/guesswatt.git
cd guesswatt

# Serve locally (no build step required)
python3 -m http.server 8000
# or
npx serve .

# Open http://localhost:8000
```

## 📁 Project Structure

```
guesswatt/
├── index.html              # Main HTML file
├── components.js           # Component definitions
├── css/                    # Stylesheets (modular CSS architecture)
│   ├── tokens.css          # Design tokens (colors, spacing, typography)
│   ├── reset.css           # CSS reset
│   ├── base.css            # Base typography and defaults
│   ├── components-*.css    # Component-specific styles
│   ├── utilities.css       # Utility classes
│   └── main.css            # Main import file
├── js/                     # JavaScript modules
│   ├── main.js             # Application entry point
│   ├── calculator.js       # Cost calculation logic
│   ├── config.js           # Configuration constants
│   ├── pdf-service.js      # PDF parsing (client-side)
│   ├── ui-components.js    # UI component initialization
│   ├── ui-handlers.js      # Event handlers
│   ├── ui-renderer.js      # Result rendering
│   └── utils.js            # Utility functions
├── data/                   # Data files
│   ├── Precos_ELEGN.csv    # Price data from ERSE
│   ├── CondComerciais.csv  # Commercial conditions from ERSE
│   ├── offers.json         # Built/optimized offers (preferred)
│   ├── meta.json           # Metadata (update dates, row counts)
│   └── last-update.json    # Legacy format for footer display
├── scripts/                # Build and maintenance scripts
│   ├── download-erse.js    # Download latest ERSE CSVs
│   ├── build-offers.js     # Build offers.json from CSVs
│   └── selftest.js         # Validation tests
└── docs/                   # Documentation
    ├── README.md           # This file
    ├── CONCEPT.mdc         # Product vision and user flows
    ├── TECH_STACK.mdc      # Technical architecture
    ├── DATA_MODEL.mdc      # Data structure and formulas
    ├── DECISIONS.mdc       # Architecture Decision Records (ADRs)
    ├── IMPLEMENTATION.mdc  # Implementation phases
    ├── COPY.mdc            # Tone of voice and copy guidelines
    └── CURSOR_RULES.mdc    # AI assistant rules
```

## 🏗️ Architecture

### Technology Stack

- **Frontend**: Vanilla JavaScript (ES6+ modules), no framework
- **Styling**: Modern CSS with OKLCH colors, custom properties, clamp()
- **Hosting**: Static hosting (GitHub Pages compatible)
- **Build**: None—files are served directly
- **Dependencies**: Zero runtime dependencies (except PDF.js for PDF parsing)

### Design Principles

1. **Simplicity**: No build step, no framework, no abstractions
2. **Performance**: <400KB total, <3s Time to Interactive
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
- **Data loading**: CSV/JSON parsing with fallback support

## 📊 Data Pipeline

### Data Sources

All data comes from **ERSE** (Portuguese Energy Services Regulatory Authority):

1. **Price data** (`Precos_ELEGN.csv`): ~13K rows of tariff prices
2. **Commercial conditions** (`CondComerciais.csv`): ~700 rows of offer metadata

### Update Process

1. **Download** (`scripts/download-erse.js`):
   - Downloads latest CSVs from ERSE simulator
   - Uses Playwright to handle JavaScript-rendered page
   - Validates both required CSVs

2. **Build** (`scripts/build-offers.js`):
   - Joins CSVs on `COM` + `COD_Proposta`
   - Normalizes numbers (comma → dot)
   - Filters electricity-only offers
   - Outputs optimized `offers.json`

3. **Validate** (`scripts/selftest.js`):
   - Ensures offers exist and have required fields
   - Validates no gas-only offers
   - Tests calculation samples

### Running Data Updates

```bash
# Download latest ERSE data
node scripts/download-erse.js

# Build offers.json from CSVs
node scripts/build-offers.js

# Run validation tests
node scripts/selftest.js

# Or run all three in sequence
node scripts/download-erse.js && node scripts/build-offers.js && node scripts/selftest.js
```

## 🧮 Calculation Logic

### Monthly Cost Formula

```javascript
// Fixed term (daily charge × 30 days)
fixedTerm = TF × 30

// Variable term (depends on tariff type)
// Simple: consumption × TV
// Bi-hourly: consumption × (0.35 × TVV + 0.65 × TVFV)
// Tri-hourly: consumption × (0.30 × TVVz + 0.50 × TVC + 0.20 × TVP)

// Taxes
iec = consumption × 0.001
subtotal = fixedTerm + variableTerm + iec + 2.85
total = subtotal × 1.23  // VAT
```

### Consumption Estimation

When only monthly bill amount is provided:

1. Remove VAT (÷ 1.23)
2. Subtract fixed costs (estimated fixed term + audiovisual tax)
3. Divide remainder by average price per kWh (data-driven median)

### Best Offer Selection

1. Filter valid offers (electricity-only, matching power/tariff, no lock-in)
2. Calculate monthly cost for each offer
3. Calculate annual effective cost (12 × monthly)
4. Sort by annual cost (primary), then monthly cost (tiebreaker)
5. Return best offer

## 🎨 Design System

### Colors (OKLCH)

- **Neutral scale**: Gray-0 (background) to Gray-6 (text)
- **Accent**: Green (`oklch(55% 0.18 145)`)
- **Semantic**: Danger (red), Warning (yellow)

### Typography

- **Font**: Inter (via Google Fonts)
- **Scale**: Fluid typography with `clamp()`
- **Base**: 16px at 320px → 18px at 1280px

### Spacing

- **Base unit**: 4px (0.25rem)
- **Scale**: 0, 0.25rem, 0.5rem, 0.75rem, 1rem, 1.25rem, 1.5rem, 2rem, 2.5rem, 3rem, 4rem

### Animations

- **Durations**: 50ms (instant) to 600ms (slower)
- **Easing**: `cubic-bezier(0.16, 1, 0.3, 1)` (ease-out)
- **Reduced motion**: All animations respect `prefers-reduced-motion`

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
- **Issues**: [GitHub Issues](https://github.com/yourusername/guesswatt/issues)
- **ERSE Simulator**: [ERSE Website](https://www.erse.pt/)

---

**Made with ❤️ for Portuguese consumers**

