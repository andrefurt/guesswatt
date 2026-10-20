---
paths:
  - "css/**/*.css"
---

# CSS

From `docs/CURSOR_RULES.mdc`, the project's original standards.

1. Values come from the custom properties in `css/tokens.css`; a new value becomes a token first.
2. Colours in OKLCH.
3. rem for sizes; px only for borders and shadows.
4. `clamp()` for fluid type and spacing.
5. Class names in this shape: `.component`, `.component-element`, `.component--modifier`.
6. Every animation has a `prefers-reduced-motion` path.
