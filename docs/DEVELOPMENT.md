# Development Guide

> Complete guide for setting up, developing, and contributing to GuessWatt

## Prerequisites

- **Node.js** 16+ (for running scripts)
- **Modern browser** (Chrome, Firefox, Safari, Edge)
- **Git** (for version control)
- **Text editor** (VS Code recommended)

## Quick Start

### 1. Clone the Repository

```bash
git clone https://github.com/yourusername/guesswatt.git
cd guesswatt
```

### 2. Serve Locally

Since there's no build step, you can serve the files directly:

**Option A: Python HTTP Server**
```bash
python3 -m http.server 8000
# Open http://localhost:8000
```

**Option B: Node.js serve**
```bash
npx serve .
# Open http://localhost:5000
```

**Option C: VS Code Live Server**
- Install "Live Server" extension
- Right-click `index.html` → "Open with Live Server"

### 3. Open in Browser

Navigate to `http://localhost:8000` (or the port shown by your server)

## Project Structure

```
guesswatt/
├── index.html              # Main HTML file
├── components.js           # Component definitions
├── css/                    # Stylesheets
│   ├── tokens.css          # Design tokens
│   ├── reset.css           # CSS reset
│   ├── base.css            # Base styles
│   ├── components-*.css    # Component styles
│   ├── utilities.css       # Utility classes
│   ├── animations.css       # Animations
│   └── main.css            # Main import
├── js/                     # JavaScript modules
│   ├── main.js             # Entry point
│   ├── calculator.js        # Business logic
│   ├── config.js            # Constants
│   ├── pdf-service.js       # PDF parsing (includes cycle detection)
│   ├── ui-components.js     # UI initialization
│   ├── ui-handlers.js       # Event handlers
│   ├── ui-renderer.js       # Result rendering
│   └── utils.js             # Utilities (includes formatTariffName)
├── data/                   # Data files
│   ├── Precos_ELEGN.csv    # Price data
│   ├── CondComerciais.csv  # Conditions data
│   ├── offers.json         # Built offers
│   └── meta.json           # Metadata
├── scripts/                # Build scripts
│   ├── download-erse.js    # Download ERSE data
│   ├── build-offers.js     # Build offers.json
│   └── selftest.js         # Validation tests
└── docs/                   # Documentation
```

## Development Workflow

### Making Changes

1. **Edit files** directly (no build step needed)
2. **Refresh browser** to see changes
3. **Test in multiple browsers** (Chrome, Safari, Firefox)
4. **Test accessibility** (keyboard navigation, screen reader)

### Code Standards

Follow the guidelines in [`docs/CURSOR_RULES.mdc`](./CURSOR_RULES.mdc):

- **JavaScript**: ES6+ modules, JSDoc comments, descriptive names
- **CSS**: BEM-ish naming, custom properties, no magic numbers
- **HTML**: Semantic elements, proper ARIA attributes
- **Comments**: Explain WHY, not WHAT

### File Naming

- `kebab-case.js` → JavaScript modules
- `kebab-case.css` → CSS files
- `camelCase` → Functions, variables
- `SCREAMING_SNAKE` → Constants

### Git Workflow

```bash
# Create feature branch
git checkout -b feature/your-feature-name

# Make changes
# ...

# Commit with conventional format
git commit -m "feat(scope): description"

# Push and create PR
git push origin feature/your-feature-name
```

**Commit types**:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation
- `style`: Formatting
- `refactor`: Code restructuring
- `test`: Tests
- `chore`: Maintenance

## Testing

### Manual Testing Checklist

Before committing, test:

- [ ] **Functionality**: Forms work, calculations are correct
- [ ] **Browser compatibility**: Chrome, Safari, Firefox
- [ ] **Responsive design**: Mobile, tablet, desktop
- [ ] **Keyboard navigation**: Tab through all interactive elements
- [ ] **Screen reader**: Test with VoiceOver (Mac) or NVDA (Windows)
- [ ] **Accessibility**: Check color contrast, focus states
- [ ] **Performance**: Check Network tab, no unnecessary requests

### Automated Testing

Run validation scripts:

```bash
# Validate data integrity
node scripts/selftest.js
```

## Data Updates

### Updating ERSE Data

1. **Download latest data**:
   ```bash
   node scripts/download-erse.js
   ```

2. **Build offers.json**:
   ```bash
   node scripts/build-offers.js
   ```

3. **Validate**:
   ```bash
   node scripts/selftest.js
   ```

4. **Commit changes**:
   ```bash
   git add data/
   git commit -m "chore(data): update ERSE data"
   ```

### Data Pipeline

See [`docs/DATA_MODEL.mdc`](./DATA_MODEL.mdc) for detailed information about:
- CSV schemas
- Data relationships
- Calculation formulas
- Validation rules

## Debugging

### Browser DevTools

- **Console**: Check for JavaScript errors
- **Network**: Monitor data loading (CSV/JSON)
- **Elements**: Inspect DOM structure
- **Performance**: Profile rendering and calculations

### Common Issues

**Issue**: Data not loading
- **Check**: Network tab for failed requests
- **Solution**: Ensure `data/` directory has required files

**Issue**: Calculations incorrect
- **Check**: Console for errors in `calculator.js`
- **Solution**: Verify input values, check formula in `DATA_MODEL.mdc`

**Issue**: Styles not applying
- **Check**: CSS file imports in `main.css`
- **Solution**: Verify file paths, check browser cache

**Issue**: PDF parsing fails
- **Check**: Console for PDF.js errors
- **Solution**: Verify PDF format, check `pdf-service.js` patterns

## Adding Features

### Step-by-Step Process

1. **Plan**: Review [`docs/IMPLEMENTATION.mdc`](./IMPLEMENTATION.mdc) for phase structure
2. **Document**: Create ADR in [`docs/DECISIONS.mdc`](./DECISIONS.mdc) if architectural decision needed
3. **Implement**: Write code following standards in [`docs/CURSOR_RULES.mdc`](./CURSOR_RULES.mdc)
4. **Test**: Manual testing + validation scripts
5. **Document**: Update relevant docs (TECH_STACK, DATA_MODEL, COPY, etc.)
6. **Review**: Self-review before PR

### Feature Checklist

- [ ] Code follows standards
- [ ] Accessibility requirements met
- [ ] Documentation updated
- [ ] Tested in multiple browsers
- [ ] No console errors
- [ ] Performance acceptable

## Performance Optimization

### Current Targets

- **HTML**: <10KB
- **CSS**: <15KB
- **JS**: <30KB
- **Data**: ~300KB (cached after first load)
- **Total**: <400KB

### Optimization Tips

- **Minimize DOM manipulation**: Batch updates
- **Use CSS for animations**: Avoid JavaScript animations
- **Lazy load data**: Only load when needed
- **Cache results**: Avoid recalculation
- **Optimize images**: Use SVG, compress if needed

## Accessibility

### Requirements

- **WCAG 2.1 AA** compliance
- **Keyboard navigation** throughout
- **Screen reader** support
- **Focus visible** at all times
- **Color contrast** ≥4.5:1

### Testing Accessibility

1. **Keyboard only**: Tab through entire interface
2. **Screen reader**: Test with VoiceOver or NVDA
3. **Color contrast**: Use browser extension or online tool
4. **Focus indicators**: Ensure all interactive elements have visible focus

See [`docs/TECH_STACK.mdc`](./TECH_STACK.mdc) for detailed accessibility checklist.

## Browser Support

### Supported Browsers

- Chrome (latest)
- Safari (latest)
- Firefox (latest)
- Edge (latest)

### Feature Support

- CSS Custom Properties: 95%+
- CSS clamp(): 93%+
- OKLCH: 90%+ (with fallback)
- ES6 Modules: 95%+
- Fetch API: 97%+

## Troubleshooting

### Development Server Issues

**Problem**: Port already in use
```bash
# Use different port
python3 -m http.server 8001
```

**Problem**: CORS errors
- **Solution**: Use proper HTTP server (not `file://` protocol)

### Module Import Issues

**Problem**: `Failed to load module`
- **Check**: File paths are correct
- **Check**: Server is running (not `file://`)
- **Check**: File extensions match (`import './file.js'`)

### Data Loading Issues

**Problem**: CSV/JSON not loading
- **Check**: Files exist in `data/` directory
- **Check**: Network tab for 404 errors
- **Check**: File encoding (should be UTF-8)

## Getting Help

1. **Check documentation**: Start with [`docs/README.md`](./README.md)
2. **Review code**: Check similar implementations
3. **Search issues**: Check GitHub issues for similar problems
4. **Ask**: Create issue with detailed description

## Resources

- **Documentation**: [`docs/`](./README.md)
- **Architecture**: [`docs/TECH_STACK.mdc`](./TECH_STACK.mdc)
- **Data Model**: [`docs/DATA_MODEL.mdc`](./DATA_MODEL.mdc)
- **Decisions**: [`docs/DECISIONS.mdc`](./DECISIONS.mdc)
- **Copy Guidelines**: [`docs/COPY.mdc`](./COPY.mdc)

---

**Happy coding!** 🚀

