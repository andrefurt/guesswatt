# 🚨 CRITICAL: Design Match + Repo Cleanup — Complete Implementation

## Role

You are a **Senior Frontend Engineer** and **Tech Lead** performing a complete codebase overhaul. Your mission:

1. **Make the UI pixel-perfect match `design.html`** — The reference file with correct visual output
2. **Delete ALL unused/deprecated code and files** — Zero legacy code tolerance
3. **Organize the repo to modern standards** — Clean, professional structure
4. **Preserve ALL functionality** — No regressions allowed

---

## ⚠️ ABSOLUTE CONSTRAINTS — READ BEFORE ANYTHING

### 🚫 FORBIDDEN — Will Break The App
- **DO NOT** modify business logic in `js/calculator.js`
- **DO NOT** change data structures or API calls
- **DO NOT** alter PDF parsing logic in `js/pdf-service.js`
- **DO NOT** remove or rename JavaScript functions that handle calculations
- **DO NOT** change the data flow or state management
- **DO NOT** modify anything in `/data/` folder
- **DO NOT** touch `/scripts/` folder (build scripts)
- **DO NOT** break any existing event listeners or DOM manipulation

### ✅ YOUR SCOPE — Styling, Cleanup & Organization
- Delete deprecated/unused CSS files entirely
- Delete deprecated/unused code from remaining files
- Delete redundant documentation files
- Fix HTML structure to match `design.html`
- Update CSS imports and structure
- Reorganize file structure to modern standards
- Add missing styles from `design.html`

---

## 🔒 PROTECTED FUNCTIONALITY — TEST AFTER EVERY CHANGE

**ALL of these MUST work after your changes:**

- [ ] Estimado: Enter value (e.g., 120) → Click Submit → Results appear
- [ ] Switch tabs: Click "Preciso" → PDF upload area shows
- [ ] Click "Adicionar dados manualmente" → Manual form appears
- [ ] Manual form: Fill fields → Submit → Results show
- [ ] Click X on results pill → Returns to input view
- [ ] Copy page button → Copies markdown to clipboard
- [ ] Dropdown menu → Opens, all options work (markdown, ChatGPT, Claude)
- [ ] Tab switching: Both directions work smoothly
- [ ] All links navigate correctly (Sobre, ERSE, sources)
- [ ] Last update date loads correctly

**⚠️ IF ANY FUNCTIONALITY BREAKS, REVERT IMMEDIATELY**

---

## 🎨 Icon System: Phosphor Icons (Duotone)

**All icons use Phosphor Icons library — Duotone variant**

- **Library**: https://phosphoricons.com/
- **Variant**: Duotone
- **CDN**: Already loaded via `<script src="https://unpkg.com/@phosphor-icons/web"></script>`

**CRITICAL**: Copy exact SVG markup from `design.html` — do not substitute icons.

---

## PHASE 1: Identify Root Cause

### Current Problem
The UI looks broken because:

1. **Legacy CSS file overriding new components**: `css/components.css` (17KB) contains old styles that conflict with `css/components-*.css` files
2. **Duplicate token files**: Both `tokens.css` AND `tokens-design-system.css` exist
3. **CSS import order wrong**: Legacy file imported after component files

### Files to Analyze
```bash
# Check what's importing what
grep -r "components.css" css/
grep -r "@import" css/main.css
```

---

## PHASE 2: Delete Legacy/Unused Files

### 🗑️ CSS Files to DELETE Entirely

```bash
# DELETE these files completely:
rm css/components.css          # 17KB of legacy styles overriding new components
```

### 🗑️ CSS Files to MERGE Then DELETE

```bash
# tokens-design-system.css should be merged INTO tokens.css, then deleted
# 1. Copy unique tokens from tokens-design-system.css to tokens.css
# 2. Delete tokens-design-system.css
rm css/tokens-design-system.css
```

### 🗑️ Documentation Files to DELETE

The `/docs/` folder is cluttered with outdated status files. Delete these:

```bash
# DELETE all these outdated/redundant docs:
rm docs/CLEANUP_PLAN.md
rm docs/CONTENT_UPDATE_STATUS.md
rm docs/CURRENT_STATUS.md
rm docs/DESIGN_FIX_PROMPT.md
rm docs/FINAL_SUMMARY.md
rm docs/HTML_CONTENT_UPDATE.md
rm docs/HTML_ID_MAPPING.md
rm docs/HTML_MIGRATION_PLAN.md
rm docs/HTML_UPDATE_PLAN.md
rm docs/HTML_UPDATE_PROGRESS.md
rm docs/IMPLEMENTATION_STATUS.md
rm docs/INTEGRATION_PLAN.md
rm docs/INTEGRATION_STATUS.md
rm docs/NEXT_STEPS.md
rm docs/PROGRESS.md
rm docs/STATUS_SUMMARY.md
rm docs/DESIGN_SYSTEM_IMPLEMENTATION.md

# Also delete misplaced files in docs/:
rm docs/download-erse.js          # Duplicate of scripts/download-erse.js
rm docs/update-erse.yml           # Duplicate of .github/workflows
rm docs/update-erse-insights.yml  # Duplicate
```

### 🗑️ Root Level Files to Move or Delete

```bash
# Move these to js/ folder:
mv app.js js/app.js              # If used, move to js/
mv components.js js/components.js  # If used, move to js/

# OR delete if not used (check imports in index.html first)
```

---

## PHASE 3: Fix CSS Architecture

### Update `css/main.css`

**REMOVE** the legacy import:

```css
/* DELETE THIS LINE: */
@import 'components.css';

/* DELETE THIS LINE: */
@import 'tokens-design-system.css';
```

**Final main.css structure:**

```css
/**
 * GuestWatt - Main CSS Entry Point
 */

@layer base, components, utilities;

/* Design Tokens */
@import 'tokens.css';

/* Base Styles */
@import 'reset.css';
@import 'base.css';

/* Animations */
@import 'animations.css';

/* Components */
@import 'components-layout.css';
@import 'components-header.css';
@import 'components-buttons.css';
@import 'components-tabs.css';
@import 'components-input-views.css';
@import 'components-highlights.css';
@import 'components-results.css';

/* Utilities */
@import 'utilities.css';
```

### Merge Tokens

Take unique tokens from `tokens-design-system.css` and add them to `tokens.css`. Then delete `tokens-design-system.css`.

---

## PHASE 4: Fix Remaining CSS Issues

### Add to `css/reset.css` or `css/base.css`

```css
/* Remove native number input arrows */
input[type="number"] {
  -moz-appearance: textfield;
}

input[type="number"]::-webkit-outer-spin-button,
input[type="number"]::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}
```

### Verify Component CSS Files Match design.html

Compare each component file against `design.html` styles:

- [ ] `components-header.css` — Top bar, logo, buttons
- [ ] `components-tabs.css` — Tab switcher with sliding indicator
- [ ] `components-input-views.css` — Input card, form, Estimado/Preciso views
- [ ] `components-highlights.css` — Social proof section
- [ ] `components-results.css` — Results card and savings bar
- [ ] `components-buttons.css` — All button styles, dropdown

If any styles are missing, copy them from `design.html`.

---

## PHASE 5: Verify HTML Structure

Ensure `index.html` has:

1. **Correct class names** matching component CSS files
2. **SVG icons** (not Unicode symbols) — Copy from `design.html`
3. **Proper ARIA attributes** for accessibility
4. **No inline styles** that override component styles (except functional display toggles)

---

## PHASE 6: Final Repo Structure

After cleanup, the repo should look like:

```
guesswatt/
├── .github/
│   └── workflows/
│       └── update-erse.yml
├── css/
│   ├── animations.css
│   ├── base.css
│   ├── components-buttons.css
│   ├── components-header.css
│   ├── components-highlights.css
│   ├── components-input-views.css
│   ├── components-layout.css
│   ├── components-results.css
│   ├── components-tabs.css
│   ├── main.css              # Entry point, imports all
│   ├── reset.css
│   ├── tokens.css            # All design tokens (merged)
│   └── utilities.css
├── data/
│   ├── CondComerciais.csv
│   ├── Precos_ELEGN.csv
│   ├── last-update.json
│   ├── meta.json
│   └── offers.json
├── docs/
│   ├── CONCEPT.mdc           # Keep - project concept
│   ├── COPY.mdc              # Keep - copy/content guidelines
│   ├── CURSOR_RULES.mdc      # Keep - development rules
│   ├── DATA_MODEL.mdc        # Keep - data documentation
│   ├── DECISIONS.mdc         # Keep - architectural decisions
│   ├── IMPLEMENTATION.mdc    # Keep - implementation guide
│   ├── README.md             # Keep - documentation index
│   └── TECH_STACK.mdc        # Keep - technology documentation
├── js/
│   ├── calculator.js         # DO NOT TOUCH
│   ├── config.js
│   ├── main.js
│   ├── pdf-service.js        # DO NOT TOUCH
│   ├── ui-components.js
│   ├── ui-renderer.js
│   └── utils.js
├── scripts/
│   ├── build-offers.js       # DO NOT TOUCH
│   ├── download-erse.js      # DO NOT TOUCH
│   └── selftest.js           # DO NOT TOUCH
├── .gitignore
├── design.html               # Reference file (keep for comparison)
├── index.html                # Main app
├── index.md                  # Markdown version for copy
├── llms.txt                  # LLM documentation
├── sobre.html                # About page
└── sobre.md                  # About markdown
```

**Files that should NOT exist after cleanup:**
- `css/components.css` ❌
- `css/tokens-design-system.css` ❌
- `app.js` (root level) ❌
- `components.js` (root level) ❌
- All the deleted docs files ❌

---

## PHASE 7: Validation Checklist

### Visual Parity (compare side-by-side with design.html)

- [ ] **Header**: Logo, buttons, dropdown all match
- [ ] **Tab switcher**: Pill background, sliding white indicator, SVG icons
- [ ] **Input card**: Border radius, shadows, inner structure
- [ ] **Form**: € symbol style, input field, /Mês suffix, submit button
- [ ] **Highlights**: Border treatment, text styling, spacing
- [ ] **Footer**: Text, link, last update
- [ ] **Animations**: Tab slide, hover states, button transitions

### Functionality (ALL must pass)

- [ ] Estimado form works end-to-end
- [ ] Preciso PDF upload works
- [ ] Preciso manual form works
- [ ] Tab switching both directions
- [ ] Results display correctly
- [ ] X button returns to input
- [ ] Copy page works
- [ ] Dropdown all options work
- [ ] No console errors
- [ ] No 404 errors for deleted files

### Code Quality

- [ ] No legacy CSS files remain
- [ ] No duplicate token files
- [ ] No outdated documentation
- [ ] All imports resolve correctly
- [ ] No unused code in remaining files

---

## Testing Procedure

```bash
# 1. Start local server
cd /Users/andrefurt/code/guesswatt
python3 -m http.server 8080

# 2. Open in browser
# Tab 1: http://localhost:8080/design.html
# Tab 2: http://localhost:8080/index.html

# 3. Compare visually - every pixel must match

# 4. Test ALL functionality listed above

# 5. Check console for errors

# 6. Verify no 404s in Network tab
```

---

## Summary

**Goal**: Transform this:
- Broken visual output
- Legacy CSS conflicts
- Cluttered repo with outdated docs
- Duplicate files

**Into**: 
- Pixel-perfect match to design.html
- Clean, modern CSS architecture
- Organized, professional repo structure
- All functionality preserved

**Success criteria**:
1. `index.html` looks identical to `design.html`
2. All functionality works
3. No legacy/deprecated files remain
4. Repo is clean and organized
5. No console errors or 404s
