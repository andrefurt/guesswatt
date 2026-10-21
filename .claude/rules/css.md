---
paths:
  - "css/**/*.css"
---

# CSS

The CSS conventions; `css/tokens.css` owns the values.

1. Values come from the custom properties in `css/tokens.css`; a new value becomes a token first.
   Every `var(--*)` needs a definition: `scripts/rules-check.js` fails the gate on one that has none.
2. Colours in OKLCH.
3. rem for sizes; px only for borders and shadows.
4. `clamp()` for fluid type and spacing.
5. Class names in this shape: `.component`, `.component-element`, `.component--modifier`.
6. Every animation has a `prefers-reduced-motion` path.
