# GuessWatts front-end audit, October 2026

Date: 2026-10-21. Repo `/Users/andrefurt/code/guesswatt` at `466d03d` (main, clean, gate green). Areas: MOT (motion), UI (visual craft), RESP (responsive), PWA (installable app and native feel), CMP (components), DS (design system), ARCH (React and Foundations, a decision case).

This is the second pass after the [October audit](2026-10-audit.md), whose six phases are merged (PR #1 to #17). It goes deeper on the front-end only, and does not repeat what October fixed or what the owner decided there.

Lenses: craft:motion, production-ui, better-typography, better-layout, better-accessibility, mobile-native, craft:components (principles only), Emil Kowalski (emilkowal.ski, the improve-animations skill) and Jakub Krehel ("Details that make interfaces feel better", jakub.kr, fetched 2026-10-21). The repo's docs and ADRs win where a lens disagrees; craft wins over the generic lenses.

The owner added these hypotheses during the audit. Each one is answered in a finding:
- the dark mode is weak, too green, with a light background (D-1);
- components are inconsistent (C-1, C-2, C-3);
- modern standards are missing (DS scorecard in D-9);
- the PWA has problems and the mobile sizes are not right (P-1 to P-6, C-4);
- the site is not fluid (L-3, M-1, M-2);
- the bill field accepts letters (F-1);
- the question of React and Foundations (section 5).

Paths: `$SCRATCH` stands for `/private/tmp/claude-501/-Users-andrefurt-code-guesswatt/d261d2e0-fc1d-441c-a8c7-ac412ed185fe/scratchpad`. The lab (HTTP/2 server, page-state driver, synthetic PDFs) is in `$SCRATCH/lab/`. Each area's full report, scripts and screenshots are in `$SCRATCH/out/<AREA>.md` and `$SCRATCH/out/<AREA>/`. The verifier reports are in `$SCRATCH/verify/`. The scratchpad is temporary, so the evidence that matters is quoted here.

Verification: every high finding went through an independent verifier with its own scripts, in Chromium and WebKit, and Firefox where it mattered. Each one says "confirmed" or "downgraded: reason". **Medium and low findings were not verified.**

---

## 1. Summary

1. **The site works, but the input layer and the component layer are weak.**
   - The bill field refuses cents ("87,50"), accepts letters until submit, and answers in the browser's own words.
   - In Chromium with an English-style UI, "250,5" kWh silently becomes 2505 kWh and a result is shown. "12a" becomes 12 kWh in Chromium and WebKit (F-1).
2. **The answer is hard to find.**
   - The saving is the smallest text in the result.
   - The heading says "Melhor proposta" even when the verdict is "já tens uma boa tarifa", which October UX-6 already named (R-1).
   - Between 769 and about 980 px, the results pill covers the header buttons (L-1).
3. **The owner's hypotheses hold, with numbers.**
   - **Dark mode:** every dark surface carries the light theme's green (chroma 0.015 to 0.02 at hue 145), and the page bg is at L 25%. Common dark UIs sit at L 14 to 24% (D-1).
   - **Buttons:** one button is written five times, and nothing styles `:disabled` (C-1).
   - **Touch targets:** they are 32 px on phones, against 44 px on Apple and 48 px on Material (C-4).
   - **Fluidity:** every `clamp()` stops near 640 px, so above that the page is a fixed 580 px column. The card also snaps 169 to 281 px in one frame when the mode changes (L-3, M-2).
4. **What is already good.**
   - axe reports 0 violations in 13 states and both themes.
   - The page has no horizontal scroll in 143 combinations of state and viewport.
   - 200% and 400% zoom reflow cleanly.
   - Every motion value is a token, and reduced motion holds.
   - The app is installable in Chromium, and offline works after one visit.
5. **Counts after merging:** 0 critical, 4 high, 21 medium and 17 low.
   - ARCH recommends staying vanilla and copying Foundations' design decisions into CSS (section 5).
   - The plan has five phases (section 6).

---

## 2. Findings

Fields: severity, evidence, impact, fix, effort, and verification for the high ones. "Also" lists the area findings merged into one. IDs: F (forms), R (result), L (layout), C (components), D (design system and tokens), M (motion), P (PWA), A (access), X (cleanup and docs).

### High

#### F-1. Numeric fields: cents are blocked, letters are kept, a comma can multiply consumption by ten, and errors come from the browser
Also: CMP-1, PWA-1, PWA-9 (keyboards), UI-9 (field not marked), owner report.

- **Evidence: the bill field.**
  - `#monthly-bill` is `type="text" inputmode="numeric" pattern="[0-9]*" min max`, and its form has no `novalidate` (`index.html:270`, `:275`). `min` and `max` do nothing on a text field.
  - "87,50" and "87.50" fail the pattern in all three engines, even though `js/main.js:166` parses a comma.
  - On iOS, `inputmode="numeric"` gives a keypad with no comma key (not device-tested).
  - "abc" stays in the field and only the browser's bubble answers. Chromium with an English UI says "Please match the requested format.", Chromium with a Portuguese UI says "Faça corresponder o formato pedido." (formal, not "tu", against rule 4 in spirit), and WebKit says "Match the requested format".
  - Our PT-PT line in `#form-status` appears only for out-of-range values.
- **Evidence: the consumption field.**
  - `#consumption` is `type="number"` with no `step` (`index.html:380`).
  - "250,5" becomes 2505 kWh and shows a result only in Chromium with an English-style UI. In a pt-PT UI, and in WebKit and Firefox, it is refused.
  - "12a" becomes 12 kWh with a result in Chromium and WebKit, and "1e2" becomes 100 kWh in all three engines.
- **Evidence: shared.** No field ever gets `aria-invalid` or `aria-describedby` to the status line. Lab files: `$SCRATCH/out/CMP/numeric.json`, `$SCRATCH/verify/A/`.
- **Impact:** most bills have cents, so anyone who types theirs exactly is blocked. A typo or a locale mismatch can show a confident result for the wrong consumption.
- **Fix:** one numeric-field pattern for the whole site:
  - `type="text" inputmode="decimal" enterkeyhint="go"`, no `pattern`, `min` or `max`, and `novalidate` on both forms;
  - one parser in `js/utils.js` that strips "€", spaces and thousands dots, accepts "," or ".", and rejects anything else;
  - PT-PT errors in the status line, with `aria-invalid` and `aria-describedby` on the field, focus on the field, and the error colour on its border;
  - no keystroke filtering, because it breaks paste, IME and autofill.
- **Effort:** S. It removes one of the two parse sites and the browser's validation.
- **Verification:** confirmed, high. The wrong-number cases depend on a typo or on the browser locale, which is why they are not critical.

#### R-1. The answer is the smallest thing in the result, and the heading contradicts the verdict
Also: UI-1, RESP-7, and October UX-6 (left open by task 4.4).

- **Evidence: sizes.** At 1280 px, the heading is 26 px, the assumptions subtitle 22 px over 4 lines, and the provider name 22 px. The savings line is 15 px (14.1 px at 375), the same as the "Potência" row (`css/components-results.css:64-70`, `:305-335`).
- **Evidence: the fold.** At 375x667:
  - Estimado: the cost row is on the first screen, and the verdict line is below it (y 666 to 725).
  - Preciso: both the cost and the saving are below the fold (fold at 687).
  - Above the card sit two header rows, the pill, a 64 px gap (`--space-top-card`) and a 4 to 6 line subtitle.
  - At 390x844 everything fits. With Safari's real visible height (about 664 px) it does not.
- **Evidence: the heading.** It is fixed at "Melhor proposta" (`index.html:425`), and `resultVerdict` (`js/ui-renderer.js:42-53`) never changes it. It stays when the verdict is "já tens uma boa tarifa" (20 € bill; Preciso EDP 250 kWh).
- **Impact:** everyone on the main path. The product promise, "how much you are losing", is read last, and on a phone only after scrolling.
- **Fix:**
  - The verdict (the saving, "já tens uma boa tarifa", or the market figure in Estimado) becomes the largest element of the result, in or under the heading.
  - The assumptions drop to base-size secondary text.
  - The top gap shrinks on short viewports.
  - This is a copy and layout decision (question 1); COPY.mdc rule 9 already asks for the number with the verdict.
- **Effort:** M.
- **Verification:** confirmed, high, with the fold numbers corrected above.

#### A-1. The three selects show no focus ring
Also: UI-3, CMP-2.

- **Evidence:**
  - `.form-select { outline: none }` (`css/components-input-views.css:631`, components layer) beats the global ring (`css/reset.css:107`, base layer).
  - The wrapper ring at `:569` matches only `.form-input`.
  - On a Tab walk, `#current-provider`, `#tariff-type` and `#power` are `:focus-visible` with no outline, shadow or wrapper ring, in Chromium and WebKit. The only cue is the chevron going from 0.44 to 0.7 opacity.
- **Impact:** keyboard users lose their place in 3 of the 5 Preciso fields (WCAG 2.4.7, AA).
- **Fix:** add the select to the wrapper-ring selector at `:569` and remove the opacity cue.
- **Effort:** S.
- **Verification:** confirmed, high. Correction: this is not a regression. `outline: none` dates from 2025-12-07, and task 4.8 never listed the selects. It is a gap in task 4.8's proof ("visible focus at every stop").

#### L-1. Between 769 and about 980 px the results pill covers the header buttons
Also: RESP-1, and part of RESP-6.

- **Evidence:**
  - The pill is absolutely centred (`css/components-header.css:85-89`) and capped at `calc(100vw - 22.5rem)` (`:268-270`), a magic number that does not reserve the real width of the logo and the actions. Below 48rem (`:286`) it drops to its own row.
  - Gap between the pill and the buttons with a typical Preciso pill: -102 px at 769, -77 at 820, -7 at 960, +13 at 1000.
  - At the centre of "Sobre", `elementFromPoint` returns the pill from 769 to about 860 px, so Sobre cannot be clicked or tapped there.
  - In Estimado it only overlaps at about 769 to 790. Screenshot: `$SCRATCH/out/RESP/pill-manual-820-top.png`.
- **Impact:** portrait tablets (iPad at 768 to 834), small laptop windows and large phones in landscape, on every Preciso result.
- **Fix:** put the pill in the header's flow, as a wrapping flex row or a grid with a `minmax(0, 1fr)` middle track, so it drops to its own row when it does not fit. A container query on `.top-bar` is the alternative. This removes both `calc(100vw - ...)` values and most of the 48rem block.
- **Effort:** M.
- **Verification:** confirmed, high. The range was corrected from 1030 to about 980 px for a typical pill; a long PDF pill reaches further.

### Medium

#### D-1. Dark mode puts the light theme's green on every surface, and its background is light and flat
Also: UI-4, DS-1, DS-2, PWA-10 (splash), owner hypothesis 1.

- **Evidence: chroma.**
  - In light, every neutral has chroma 0 (`css/tokens.css:55-62`); only text and accent carry hue.
  - In dark, every neutral has chroma 0.015 to 0.02 at hue 145 (`:250-257`), and text and accent are also green. The result is green on green.
- **Evidence: the ramp.**
  - Page bg is `oklch(24.96% 0.0188 145)`, with 4 decimals only to land on the old theme-color #1C241C.
  - The surfaces step only 2 to 3 points of L (25, 27, 28, 29, 31), so the layers barely separate.
  - The field flips from raised (light) to sunken (dark).
- **Evidence: reference dark backgrounds,** measured with the same converter: GitHub L 17.6, VS Code 23.5, Apple elevated 22.7, Material 18.2, zinc-900 21.0, Linear 13.9. Ours is lighter than all of them except GitHub Dimmed (27.1), and the greenest.
- **Evidence: secondary text.** It sits at hue 0 (`oklch(50% 0.01 0)`, `:48` and `:245`), a mauve grey next to green text.
- **Impact:** every dark-mode user sees a tinted, low-depth page. Contrast itself passes (text 9.8:1 or more, secondary 4.9:1 or more).
- **Fix:**
  - Build the dark ramp as a mirror of light: near-neutral surfaces (chroma 0.004 or less), page bg about L 18 to 20%, and 3 to 4 points of L per elevation.
  - Keep the green on text-strong, links and the accent only.
  - Secondary text at chroma 0 or hue 145.
  - Update the dark theme-color on both pages, and re-run the ADR-034 contrast pass.
- **Effort:** S to M. It changes about 12 values. Question 2.

#### C-1. One button system on paper, five copies in code, with different states
Also: CMP-5, DS-8, UI-5, UI-6 (button part), MOT-8.

- **Evidence: no shared base.**
  - `.interactive-base` (`css/components-buttons.css:15-53`) is used by nothing, but TECH_STACK.mdc:347 says every button shares it.
  - `.btn` (`:73`), `.tab-btn` (`css/components-tabs.css:57`), `.submit-btn` (`:378`) and `.input-pill-delete` (`css/components-header.css:210`) each restate 12 to 17 declarations.
  - Nine override rules patch the copies, and the reset's `button:not(.submit-btn):not(.btn):not(.tab-btn):not(.dropdown-item)` (`css/reset.css:75-83`) knows four component names.
- **Evidence: the states drift.**
  - There is no hover on submit, the tabs, the selects or the copy chevron, while its sibling "Copiar página" has one.
  - Press is `scale(0.97)` everywhere except the chevron (0.94).
  - Nothing styles `:disabled`. `js/main.js:72` disables submit on every comparison, and "A calcular…" only shows after 300 ms, so for 300 ms a click gives no feedback.
  - `--color-accent-hover` is defined and never used.
  - Heights: 35 px bordered, 33 px borderless, 30 px menu items, 25 px delete. Menu text is 13 px while every other label is 15 px.
- **Evidence: the scale of it.** There are 10 button classes and 9 patch rules (`$SCRATCH/out/CMP.md`, "Owner observations").
- **Impact:** this is the "inconsistent components" the owner sees. Some controls react and some do not, and the disabled primary button looks live. Every change to the button look has to be made in four places.
- **Fix:**
  - One `.btn` base with variants on Foundations' axes, `data-variant` (primary, outline, ghost, icon) and `data-size` (sm, md), in one file.
  - Hover, active, focus-visible and `:disabled` / `[aria-disabled]` defined once.
  - Menu items at the button size.
  - Delete `.interactive-base`, the copies and the reset's exclusion list, and correct TECH_STACK.
- **Effort:** M. It touches more than 5 files, so it needs a written plan.

#### C-2. The text button is implemented six times
Also: CMP-6, UI-6 (links).

- **Evidence:** `.drop-area-pick` (500, text colour, underline on hover), `.drop-area-link` (400, secondary, underline), `.form-link` (400, secondary, opacity 0.7), `.market-summary-link` (inherits, no hover), `.form-status-action` (text colour, no hover) and `.about-link` (opacity 0.8). Underline offsets are 2 px or 5 px.
- **Impact:** the same "do this other thing" affordance looks and reacts differently on each screen.
- **Fix:** one `.link-button` with one offset, inherited font and one hover, plus a quiet modifier.
- **Effort:** S.

#### C-3. The selected mode is shown only by a fill at 1.13:1 (light) and 1.01:1 (dark)
Also: CMP-3.

- **Evidence:** the indicator against the track measures 1.13:1 in light and 1.01:1 in dark (`$SCRATCH/out/CMP/tabsc.mjs`). Both labels share colour and weight. `aria-pressed` is right for assistive technology.
- **Impact:** sighted low-vision users, worst in dark (WCAG 1.4.11).
- **Fix:** unselected label in secondary text and selected in text, or an indicator border at 3:1 or more.
- **Effort:** S.

#### C-4. Touch targets are 29 to 34 px on phones, and the fluid tokens make them smaller there
Also: PWA-6, RESP-4, CMP-14.

- **Evidence:** at 375 px in mobile emulation (`$SCRATCH/out/RESP/targets.json`):

  | Control | Size (px) |
  |---|---|
  | Tabs | 97x32, 85x32 |
  | Comparar | 83x32 |
  | Copiar página / chevron | 129x32 / 32x32, 0.5 px apart |
  | Sobre | 76x34 |
  | Menu items | 146x29, 12 px text |
  | `#delete-btn` | 22.4x22.4 |

  All of them pass WCAG 2.5.8 (24 px, or its spacing exception) and fail Apple's 44 and Material's 48. There is no `(pointer: coarse)` rule anywhere, and the `--space-*` clamps make controls 31.6 px at 320 and 33 px from 640.
- **Impact:** the main actions sit a third below the platform guideline, and mis-taps between Copiar and its chevron are likely.
- **Fix:** one `@media (pointer: coarse)` block with a 44 px minimum block size on the button family. Icon-only controls get a hit-area pseudo-element, so desktop density is unchanged. Question 4.
- **Effort:** S.

#### C-5. sobre.html has its own copy of the header, which has drifted
Also: CMP-7.

- **Evidence:** `sobre.html:114` says "Copy as markdown" (index says "Ver em markdown"), so task 4.10 was proved on index.html only. sobre.html has no skip link.
- **Impact:** an English string in a PT-PT product, and no skip for keyboard users on the second page.
- **Fix:** align the strings and add the skip link. Add a rules-check guard over both pages: the header markup matches, and the known English strings are absent.
- **Effort:** S.

#### C-6. In forced colours, "Comparar" has no boundary and the split-button divider disappears
Also: CMP-9.

- **Evidence:** in Chromium's forced-colors emulation, `#submit-btn` has no border on a Canvas background and renders as bare text, and `.segmented-divider` is drawn with `background` (`css/components-buttons.css:172-176`). Screenshot: `$SCRATCH/out/CMP/shots/fc-landing.png`.
- **Impact:** in a Windows contrast theme, the main action does not read as a button.
- **Fix:** `border: 1px solid transparent` on the filled buttons, and draw the divider with `border-inline-start`.
- **Effort:** S.

#### A-2. Focus falls to `<body>` after a copy-menu item, and after a failed submit in Chromium
Also: CMP-4.

- **Evidence:**
  - Enter on "Ver em markdown" leaves focus on BODY (`js/page-actions.js:197-200` hides the item without returning focus).
  - `js/main.js:72` disables the focused submit. In Chromium focus drops to BODY, and on a load error "Tentar novamente" is not focused.
- **Impact:** keyboard and screen-reader users start again from the top (WCAG 2.4.3).
- **Fix:**
  - Close the menu and focus the trigger.
  - Keep the submit focusable (`aria-disabled` plus ignoring repeats), styled per C-1.
  - On error, focus the action, or the field when the error is about input.
- **Effort:** S.

#### A-3. The whole result card is a polite live region, filled while hidden, on top of the focus move
Also: CMP-8.

- **Evidence:** `<div id="result" role="status" aria-live="polite">` (`index.html:435`) wraps the card and its controls. It is filled while `display:none` (`js/ui-renderer.js:185`), then `h1.results-title` is focused (`js/ui-handlers.js:145`). Inferred from code; no screen reader was run.
- **Impact:** a duplicated, verbose or missing announcement, depending on the reader.
- **Fix:** remove the role and `aria-live` from `#result`. The heading focus (task 4.7) and `#form-status` already carry the announcement.
- **Effort:** S.

#### L-2. With a larger default text size, the column is pushed off the left edge, and the card has no gutter at 320 px
Also: RESP-2, RESP-5, RESP-9 (skip link).

- **Evidence: text size.**
  - `--content-width: clamp(20rem, 90vw, 36.25rem)` (`css/tokens.css:170`) is centred. Its 20rem floor grows with the root font, and the overflow splits to both sides.
  - At 375 px the content starts at -12, -52 and -132 px for root sizes 125%, 150% and 200%, and nothing can scroll to it. This happens below 444, 533 and 711 px wide respectively.
  - At 200% the skip link shows 26 px into the page.
- **Evidence: the gutter.** At 320 px the card touches both screen edges. On all phones the card edge (5vw, about 18 to 21 px) and the text edge (12 px) differ.
- **Impact:** low-vision users with a larger default font (WCAG 1.4.4), and a visible misalignment on every phone.
- **Fix:** one gutter token, the column as `min(100% - 2 * gutter, 36.25rem)`, wrapping header actions, the skip link hidden with a transform, and offsets that respect the safe areas.
- **Effort:** S.
- **Verification:** confirmed mechanism, downgraded to medium. It is narrow-viewport only, and it is not verified whether the iOS or Android text-size settings change this page's root size. If they do, it goes back to high.

#### L-3. "Fluid" is nominal: every clamp stops near 640 px, and the visible changes are steps
Also: RESP-6, DS-12, owner hypothesis on fluidity.

- **Evidence:** width sweep from 320 to 1920 px (`$SCRATCH/out/RESP/fluid.json`):

  | Metric | 320 | 640 | 768 | 769 | 1920 |
  |---|---|---|---|---|---|
  | h1 (px) | 24 | 26 | 26 | 26 | 26 |
  | Body (px) | 14 | 15 | 15 | 15 | 15 |
  | Column (px) | 320 | 576 | 580 | 580 | 580 |
  | Header padding (px) | 12 | 12.8 | 13 | **18** | 18 |
  | Pill width (px) | 296 | 614 | 742 | **399** | 401 |

  - Type ramps over 1 to 2 px. That produces fractional sizes (14.1125, 16.275), and it doubles the distinct values (13 line-heights and 9 tracking values per viewport).
  - The only breakpoints are two identical `@media (max-width: 48rem)` blocks.
  - There are no container queries and no grid.
- **Impact:** the 768 to 1024 range is a squeezed desktop header (L-1), and above 640 px nothing responds. This is what reads as "not fluid".
- **Fix:**
  - Fluid where it is visible: headings and vertical rhythm on a clamp that spans 320 to 1280.
  - Static rem steps for UI text and control padding.
  - A header that wraps on content (L-1) instead of the 48rem blocks.
  - Question 3.
- **Effort:** M. Most of it is the L-1 header rewrite.

#### D-2. Derived colours are hard-coded rgba of a colour no longer in the palette
Also: DS-3, DS-4.

- **Evidence:**
  - tokens.css holds 57 `rgba()` values. Its own comments say "OKLCH only" (`:41`) and "OKLCH with hex fallback" (`:7`), and neither is true.
  - "accent at 8%" and "accent at 40%" are rgba of #35443D, while the accent is #1C241C (`:83`, `:96`). `--shadow-button` hard-codes `#35443D`.
  - Three tokens use rgba(113,152,131), which is no token.
  - The dark block re-types these by hand.
  - `--color-hover-tint` already uses `oklch(from var(--color-text) l c h / 0.04)` (`:76-77`).
  - The submit button is filled with `--color-text`, not `--color-accent` (`css/components-buttons.css:384`), while the comments and TECH_STACK say the accent fills it.
- **Impact:** retheming the accent leaves its tints, border, ring and the primary button behind. This is the mechanism by which the dark mode drifted (D-1).
- **Fix:** every "X at N%" becomes `oklch(from var(--color-X) l c h / N)`, so the dark block redefines only the base roles (about 15 overrides go). Fill submit with the accent role, and fix the comments.
- **Effort:** S.

#### D-3. Typography: three tracking systems, two leading families, and tight leading on wrapping text
Also: DS-5, DS-6, UI-7, UI-8, UI-11.

- **Evidence: tracking.** A raw `-0.03em` or `calc(size * -0.03)` sits on 14 to 17 px text (`css/components-highlights.css:26`, `css/components-input-views.css:533,584,628`, `css/components-header.css:48`) beside the `-0.005em` token. Nine letter-spacings render.
- **Evidence: leading.**
  - `--leading-normal: 1.2 /* Normal for body text */` and `--text-sm-leading: 1.2` (`css/tokens.css:120`, `:149`). The footer and the switching disclaimer, which carries the fidelização caveat, run 12 px at 1.2 over 4 lines on phones.
  - sobre prose is set at 1.34 and 400 weight, while index paragraphs are 1.4 and 500.
- **Evidence: wrapping and punctuation.**
  - No `text-wrap` anywhere, so headings end on widows ("demais.", "este perfil.").
  - Straight quotes around the offer name (`js/ui-renderer.js:182`).
  - Uppercase chips have no tracking.
- **Impact:** the small print is the hardest text to read, and same-role text differs across pages.
- **Fix:**
  - Keep one leading family (`--text-*-leading`) with sm at 1.45 and long-form at 1.5.
  - Tracking from tokens only, with 0 or slightly negative values on body text.
  - `text-wrap: balance` on headings and `pretty` on paragraphs.
  - Typographic quotes as COPY.mdc decides.
  - 0.05em on the uppercase chips.
- **Effort:** S.

#### D-4. The scale has no 6 px step, so the radius token is used as spacing in 17 places
Also: DS-7, DS-13.

- **Evidence:**
  - `padding: var(--radius-sm) var(--space-2)` and `gap: var(--radius-sm)` appear across 4 files.
  - The 32 px control-height formula is copied 4 times.
  - Magic numbers: `8.6875rem`, `5.125rem`, `calc(100vw - 22.5rem)`, and fixed heights.
  - Text is dimmed with opacity 0.7 to 0.9 next to the secondary token.
  - TECH_STACK says "No magic numbers" (`docs/TECH_STACK.mdc:101`).
- **Impact:** changing the radius changes the padding and the height of buttons.
- **Fix:** add a 6 px space step and a `--control-height` token, replace the 17 uses and 4 formulas, and use the secondary token instead of opacity on text.
- **Effort:** S. It adds 2 tokens, so it needs the owner's yes.

#### M-1. The result entrance is a seven-step blurred stagger that replays on every submit
Also: MOT-3, MOT-4, MOT-5.

- **Evidence:**
  - There are 8 keyframe animations per result, with delays of 0, 30, 75, 105, 135, 165 and 195 ms. The last one ends 395 ms after the view is shown, which is about 485 ms after the click (`$SCRATCH/out/MOT/lab1.json`).
  - The blur is 3 to 4 px on the full-width card. craft:motion asks for 1 to 2 px.
  - The input card transitions border width and box-shadow on every tab switch, while TECH_STACK says transform and opacity only.
  - Frames are fine: 0 frames over 20 ms at 1x CPU, and 2 frames of 34 and 42 ms at 4x.
- **Impact:** people compare several amounts per session, and each answer waits behind half a second of choreography.
- **Fix:**
  - Full entrance on the first result of a visit only, and a 150 ms fade of the card afterwards (question 6).
  - At most four groups at 30 ms.
  - Blur at 2 px.
  - Transition `border-color` only.
- **Effort:** S to M.

#### M-2. Switching mode snaps the card's height in one frame while its contents fade
Also: MOT-2.

- **Evidence:**
  - The incoming view flips from `position:absolute` to `relative` with no height transition (`css/components-input-views.css:203`, `:215`, and `:458`, `:467` for the manual form). The height takes only two values per frame, in both engines.
  - Jumps at 1280 px / 390 px: Estimado to Preciso +182 / +169; PDF to manual +23 / +112; back to Estimado -205 / -281.
- **Impact:** this is the most visible "not fluid" moment. Content below teleports while a soft fade plays above it.
- **Fix:** stack both views in one grid cell, so the box sizes to the tallest and never jumps. This is the cheapest option and animates no layout. Animating the height with a View Transition is the alternative if the owner wants the box to grow.
- **Effort:** M.
- **Verification:** confirmed, downgraded to medium. The person triggers it and nothing breaks; it is motion quality on a common path. The phone numbers were corrected.

#### M-3. Submitting again within 200 ms of deleting a result shows an empty card
Also: MOT-1.

- **Evidence:** `hideResults()` clears `#result` in a 200 ms `setTimeout` that is never cancelled (`js/ui-handlers.js:106-117`), "to allow exit animations", which do not exist. With Enter on delete and a second Enter at 10, 71, 128 or 195 ms, the card is empty in Chromium and WebKit; at 245 ms it is fine. URL restore cannot hit it.
- **Impact:** a fast double Enter gives a blank answer with no error.
- **Fix:** clear the result synchronously, or cancel the timer in `renderResult()`, and delete the comment.
- **Effort:** S.
- **Verification:** confirmed, downgraded to medium. Only a fast double Enter reaches it.

#### P-1. The first visit after a code deploy runs new HTML with the old CSS and JS
Also: PWA-2.

- **Evidence:**
  - Navigations are network first (`sw.js:88-89`), while css/ and js/ are stale-while-revalidate (`sw.js:92-93`, `:120-132`).
  - VERSION changes only with the data date (`sw.js:18`).
  - A simulated deploy gives `{"html":"v2","css":"v1"}` on the first visit and `v2/v2` on the second (`$SCRATCH/out/PWA/update.log`).
- **Impact:** a deploy that renames an id or class ships a broken first visit to every returning user. ADR-023 accepts "shows on the second visit", not a mixed page.
- **Fix:** make our own css/js network first like the HTML (the cache still answers offline), or stamp the commit into VERSION on deploy.
- **Effort:** S.

#### P-2. A PDF cannot be read offline, the weekly refresh deletes PDF.js from the cache, and the error blames the bill
Also: PWA-3.

- **Evidence:**
  - `vendor/pdfjs/*` is not precached; it is cached on first use.
  - The weekly VERSION bump rebuilds the 38-entry cache and drops it, against the comment at `sw.js:8-9`.
  - Offline, the message is "Não conseguimos ler esta fatura…" (`js/main.js:31`).
- **Impact:** offline Preciso users are told their bill is unreadable when the real cause is the network.
- **Fix:** a vendor cache named by the PDF.js version, so the weekly bump leaves it alone, and a "precisa de ligação na primeira vez" message. Question 7.
- **Effort:** S.

#### P-3. The offline notice is only in the footer, below the fold in every state
Also: PWA-4.

- **Evidence:** `#data-offline` is in the footer (`index.html:604-608`). On an offline result at 375x812, its top is at 1238 of 1263 px.
- **Impact:** ADR-023's "never hiding that the prices may be old" holds only for someone who scrolls.
- **Fix:** also show the line beside the result when the data is offline.
- **Effort:** S. It shows on the page, so it needs a plan.

#### P-4. Hover sticks after a tap: 13 `:hover` rules are not gated by `(hover: hover)`
Also: PWA-5, UI-5 (part).

- **Evidence:** 0 uses of `(hover: hover)`. The list is in `$SCRATCH/out/PWA/hover.json`. With touch emulation, a tap on "Copiar página" leaves its hover fill on.
- **Impact:** on phones, the last tapped button looks selected.
- **Fix:** wrap every hover in `@media (hover: hover) and (pointer: fine)`. It is greppable, so it can become a rules-check line.
- **Effort:** S.

### Low

| ID | Finding | Evidence | Fix |
|---|---|---|---|
| L-4 | The copy menu is 4 to 20% translucent; on phones the pill text shows through "Ver em markdown" (UI-2, RESP-3; verified, downgraded from high because it is a secondary path) | `.dropdown-menu` uses the button fill `--color-control` (`css/components-buttons.css:284`); overlap 156x35 px at 375 in both themes | An opaque menu surface token in both themes (question 5) |
| L-5 | `min-height: 100vh` is set on three nested wrappers (RESP-8) | `css/base.css:26`, `css/main.css:23`, `css/components-header.css:15`; nothing is visible today | One `min-height: 100svh` on `.page-wrapper` |
| L-6 | The savings line has no slack at 320 px, and a five-digit yearly figure splits into ragged columns (RESP-10) | `$SCRATCH/out/RESP/crop-5000kwh-320.png` | Let it wrap as inline text |
| C-7 | The select prompts differ ("Selecionar" vs "Selecionar..."), and the Fornecedor prompt renders as a chosen value (CMP-11, UI-10) | `.form-select:valid:not(:placeholder-shown)` always matches (`css/components-input-views.css:637`) | One prompt text; colour by `:has(option:checked[value=""])` |
| C-8 | The ChatGPT and Claude menu items are buttons that call `window.open` (CMP-12) | `js/page-actions.js:238-260` | Real links with `target=_blank rel=noopener` |
| C-9 | Non-interactive chips look like buttons, and the pill reacts to hover although only its × is clickable (CMP-13) | `.tag` shares the button radius and border; `css/components-header.css:123` | Borderless tinted tags; hover on `#delete-btn` only |
| C-10 | The × and the checkbox render pure black or white, while every other icon follows the text colour; the manual form keeps the dashed drop-zone border; info rows use two layouts; Sobre has no current-page style (UI-6) | `css/components-header.css:210-227`, `css/components-input-views.css:96-98`, `sobre.html:76` | `currentColor`, a solid card for the form, one row layout, a style for `aria-current` |
| C-11 | The dark-mode checkbox looked bluish or purple in the owner's screenshot; not reproduced in Chromium, WebKit or Firefox, where it is green when checked and grey when not | `$SCRATCH/out/CMP/shots/cb-*-dark-*.png` | Question 8: which browser; if Safari ignores `accent-color`, draw it with tokens |
| D-5 | Secondary text is 4.34:1 on the drop area while a file is dragged (light), a state the 4.16a pass missed (DS-15) | `$SCRATCH/out/DS/drag.mjs` | Dragging bg at L 90% or above |
| D-6 | Layers: the `utilities` layer holds keyframes while `utilities.css` is unlayered; the reset knows component names (DS-14) | `css/tokens.css:14`, `css/utilities.css:5`, `css/reset.css:78` | Keyframes in base or a `motion` layer; a plain button reset |
| D-7 | Duplicate `@keyframes pillAppear`: the utilities copy wins, so the header copy is dead (DS-10, MOT-6) | `css/animations.css:54`, `css/components-header.css:100`; measured -6 px | Delete the header copy |
| M-4 | The copy-menu trigger presses to 0.94 while every other button uses 0.97, and the chevron runs 200 ms instead of the fast token (MOT-8) | `css/components-buttons.css:266`, `:272` | 0.97 and `--duration-fast` (folds into C-1) |
| P-5 | The service worker stores each result URL as its own page, with the person's numbers in the cache key; `sw.js:11-12` says nothing typed is stored (PWA-7) | `sw.js:100`; the cache holds `/?f=87&d=2026-10` | Cache navigations without the query (the lookup already uses `ignoreSearch`) |
| P-6 | Network first has no timeout, so a hanging connection waits instead of using the saved copy (PWA-8, code reading) | `sw.js:97-108` | Race against a few seconds, then serve the copy marked offline |
| P-7 | Tap flash on links and selects; no `-webkit-text-size-adjust`; opening sobre.html first never installs the worker (PWA-9, PWA-11) | `css/components-buttons.css:31` and others; `js/main.js:242-250` | Tap highlight off once on `html`, `text-size-adjust: 100%`, register from `js/data-date.js` |
| X-1 | About 300 lines of CSS style nothing (all of main.css except the print rules, unused base element styles, animation utilities, `.interactive-base`, `.has-value`, `.pill-separator`); a dead JS `.active` state; the tab-indicator code twice (DS-9, CMP-10, MOT-6) | `$SCRATCH/out/DS/deadclass.mjs`, `$SCRATCH/out/CMP/coupling.json`; `js/ui-components.js:22-33` and `js/ui-handlers.js:95-104` | Delete them (main.css only after the owner's yes, question 9) |

#### X-2. Docs and comments that now mislead
Also: DS-11, DS-16, DS-17, MOT-7, PWA-10 (doc part).

- **Severity:** low.
- **Evidence: TECH_STACK.mdc makes 10 CSS claims the code contradicts.** Among them:
  - "No magic numbers" (`:101`).
  - `.interactive-base` (`:347`).
  - "transform and opacity only" (`:162`); blur is animated.
  - keyframes not copied (`:359`).
  - "OKLCH with fallback" (`:436`).
  - the colour table, which misses 9 tokens.
  - main.css listed as "App-specific".
  - "until dark mode exists" (`:458`).
- **Evidence: comments.**
  - "Pixel-perfect match to design.html" in 7 headers, and the file does not exist.
  - "GuestWatt" (`css/main.css:11`).
  - The stagger comments say 50 to 130 ms, with a `20ms` fallback, while the token is 30 ms (measured 75 to 195).
  - "allow exit animations" (`js/ui-handlers.js:106`), where none exist.
- **Fix:** correct each one in the commit that touches its code. The rest goes in one docs commit at the end.

---

## 3. Already good (do not fix)

- **Access:**
  - axe-core: 0 violations in all 13 states, light and dark.
  - Every focus stop has a 2 px ring in both engines, except the selects (A-1).
  - The copy menu is a correct disclosure (Escape returns focus, and Tab out closes it).
  - `aria-pressed` mode buttons work, the PDF picker is a real button, and hidden views are not focusable.
- **Layout:**
  - No horizontal scroll in 143 combinations of state and viewport (320 to 1920, landscape, short desktop).
  - WCAG 1.4.10 reflow at 200% and 400% zoom in all 13 states.
  - October's chevron-outside-the-box bug is fixed.
  - Long tariff names wrap at 320.
  - Inputs compute to 16 px or more.
- **Motion:**
  - Every duration and easing is a token, with no `transition: all` and no `scale(0)`.
  - Interactions use transitions, which retarget (rapid tab clicks leave no keyframe restarts).
  - The exit pair is real.
  - Under reduced motion, 0 animations run.
  - At 1x CPU, frames are clean.
  - The sparks are gone.
- **Tokens:**
  - 105 tokens, 0 undefined, 0 unused, none defined outside tokens.css.
  - Every colour in the component CSS is a role token.
  - 7 type sizes, all from tokens.
  - Radii, shadows and z-index all come from tokens.
  - Concentric radii are right.
  - Tabular numbers are on prices.
  - Font smoothing is set once.
- **PWA:**
  - Chromium installability has no errors.
  - Icons and the maskable safe zone are right.
  - There is one theme-color meta per scheme.
  - `viewport-fit=cover` with `env()` body padding (with 59/34 px insets nothing sits under the notch).
  - Offline works after one visit in Chromium.
  - A VERSION bump installs cleanly with no waiting worker.
  - No `user-scalable=no`.
- **Craft against the lenses:**
  - Press at `scale(0.97)` (Emil).
  - The origin-aware menu.
  - The blurred crossfade on the copy label.
  - Asymmetric exit timings (Jakub).
  - Paragraph line length about 70 characters.

---

## 4. Questions for the owner

Most important first, each with a recommendation.

1. **Result heading (R-1).** Should the heading carry the verdict (the saving, "já tens uma boa tarifa", or the market figure) instead of a fixed "Melhor proposta"? *Recommendation: yes. The offer becomes the support under it.*
2. **Dark ramp (D-1).** Keep #1C241C as a brand colour, or go near-neutral? *Recommendation: near-neutral surfaces (chroma 0.004 or less on hue 145) with the page bg about L 19%, green only in text-strong, links and accent, and theme-color following the bg.*
3. **Fluidity (L-3).** *Recommendation: fluid where it shows (headings and vertical rhythm on a 320 to 1280 clamp), static rem for UI text and control padding, and a header that wraps on content. Not 1 px ramps everywhere.*
4. **Touch targets (C-4).** A 44 px minimum on touch screens only (`pointer: coarse`), keeping the desktop density? *Recommendation: yes.*
5. **Menu surface (L-4).** A new opaque surface token for the menu in both themes? *Recommendation: yes.*
6. **Result entrance (M-1).** The full entrance on every submit, or on the first result only? *Recommendation: the first result only, then a 150 ms fade.* Related: should the tab indicator move as one piece (its width snaps today, by design)? *Recommendation: yes, with `clip-path` or an inner `scaleX`, both compositor-only, and the TECH_STACK motion rule amended to allow clip-path.*
7. **PDF offline (P-2).** A separate vendor cache plus an honest message, or precache PDF.js (about 378 KB gzip per visitor)? *Recommendation: the separate cache, no precache.*
8. **The bluish checkbox (C-11).** Which browser and OS was the screenshot? *Recommendation: if it is Safari 26, draw the checkbox from tokens (about 15 lines).*
9. **Delete main.css (X-1).** Its only live rules are about 10 lines of print CSS, which move to base.css. *Recommendation: yes.*
10. **Decimals in consumption (F-1).** Bills show whole kWh. *Recommendation: accept them and round, so "250,5" is never an error or 2505.*
11. **Dark splash (P-7 area).** The manifest takes one `background_color`. *Recommendation: keep the light splash, and only correct the TECH_STACK line.*
12. **React and Foundations.** See section 5. *Recommendation: no migration now.*

---

## 5. React with Foundations: the decision case

Full case: `$SCRATCH/out/ARCH.md`, with the Foundations pages fetched on 2026-10-21 in `$SCRATCH/out/ARCH/web/`.

**What Foundations needs.**
- React 19 and Tailwind 4, plus `cva@beta` and `tailwind-merge`, and Phosphor React for icons (foundations.significa.co/llms.txt, /setup/llms.txt).
- It is copy-paste, with no Radix and no Ariakit. Its accessibility comes mostly from native elements this site already uses (`<dialog>`, `<select>`, checkbox).
- Only Menu and Tooltip add `@floating-ui/react`.

**Measured cost.** React 19.3.1 (react, react-dom/client, scheduler, jsx-runtime) is 71.1 KB gzip, minified and gzipped the way `size-check.js` measures. The JS budget is 40 KB, and today's total JS is 33.7 KB. The landing page would go from 118.8 KB to about 180 to 210 KB, against a 150 KB budget; only the React part of that is measured, the rest is estimated. A plain Vite SPA also paints nothing until its JS runs, unless prerendering is added.

**Effort.** About 17 to 25 days:
- matching 3,191 lines of CSS to utilities, pixel for pixel, in both themes: 4 to 6 days;
- adapting the components: 3 to 5 days;
- the rest: the deploy moving to an Actions build, a generated precache list and build-time VERSION, `size-check` and `rules-check` rework, ADRs and docs.

| Option | Effort | Runtime | What it fixes from the owner's list | Risk |
|---|---|---|---|---|
| A. React + Foundations (Vite SPA) | 17 to 25 days | +60 to 90 KB; breaks two budgets and the FCP target | Components, through cva | High: a rewrite of a working site, a new deploy and PWA path, many dependencies |
| **B. Vanilla, Foundations conventions in CSS** | **3 to 5 days** (C-1, C-2, D-1 to D-4) | About 0, or less | Components, standards, dark mode; fluidity via L-3 and M-2 | Low: file by file, gate and smoke unchanged |
| C. Web components | 6 to 10 days | +0 to 3 KB | Partly; Shadow DOM fights the shared tokens | Medium |
| D. Astro, zero JS, React islands | 12 to 18 days | About today's | Components in Astro; Foundations only in islands | Medium to high |

**Recommendation: B.** The owner's complaints are about CSS, not the runtime, and Foundations' value here lies in its decisions, which can be copied as CSS conventions:
- its variant and size axes;
- its role names;
- its radius, ring and shadow scales;
- its three easings.

B supersedes nothing. A would supersede CLAUDE.md rule 1, ADR-002 and ADR-003, and parts of ADR-023, 025 and 032.

**What would change this:**
- the product grows past one flow (accounts, saved comparisons, several screens);
- the UI JS passes about 3,000 lines (1,252 today);
- components are shared with another product;
- a team maintains it.

Even then, D (prerendered Astro with React islands) is a better first step than a full SPA.

**Not checked:** no React prototype was built. The Tailwind output, floating-ui after tree-shaking and Preact were not sized. The CSP behaviour of Vite's output was reasoned, not run. Native `popover` support for the copy menu was not measured.

---

## 6. Execution plan

The plan is shaped like October's section 4. Each task is one commit on its own short-lived branch, merged into a phase branch, with one PR per phase that the owner reviews. Anything that shows on the page, adds a file, a token or a dependency, or touches more than 5 files starts as a short written plan approved by the owner (CLAUDE.md working agreement). Docs land in the same commit as the code they describe. The gate passes on every commit, and the `verify` skill closes every task that changes behaviour. Each phase ends with `/alfred:close` before its PR merges.

The lab in `$SCRATCH/lab/` can be rebuilt from this doc if the scratchpad is gone. The October memory file names the Playwright and axe paths.

### Phase 1: Correctness and access

**Goal:** no input gives a wrong or blocked result, every control has focus and a way back, and the service worker never mixes versions.

**Proved by:** the verifier scripts for F-1, A-1 and M-3 re-run green, plus a keyboard walk of both pages and the smoke test.

| # | What | Why | Files | Branch | Skill | Done when |
|---|---|---|---|---|---|---|
| 1.1 | One numeric field pattern and one parser; PT-PT errors with `aria-invalid`; consumption decimals rounded (question 10) | F-1 | index.html, js/utils.js, js/main.js, js/ui-handlers.js, css/components-input-views.css, docs/COPY.mdc, scripts/selftest.js | fix/numeric-fields | better-accessibility, better-writing, verify | "87,50" gives a result for 87,50 €; "abc", "12a" and "1e2" show our PT-PT line with the field marked; "250,5" gives 251 kWh in Chromium en-US and pt-PT; selftest pins the parser |
| 1.2 | Focus ring on the selects | A-1 | css/components-input-views.css | fix/select-focus | better-accessibility | A Tab walk reports a ring of 3:1 or more on all three selects in Chromium and WebKit |
| 1.3 | Focus after the menu item and after a failed submit; submit stays focusable while loading | A-2 | js/page-actions.js, js/main.js | fix/focus-return | better-accessibility | `activeElement` is the trigger after an item, and the retry action after a load error |
| 1.4 | Remove the live region from `#result` | A-3 | index.html | fix/result-live-region | better-accessibility | No `aria-live` on `#result`; the heading still receives focus |
| 1.5 | Clear the result synchronously | M-3 | js/ui-handlers.js | fix/delete-resubmit | diagnosing-bugs, verify | Enter on delete then Enter at 10 to 195 ms always shows a full card |
| 1.6 | sobre.html header aligned, plus a skip link; a rules-check guard for header parity and the English strings | C-5 | sobre.html, scripts/rules-check.js | fix/sobre-header | better-writing | `grep -n "Copy as" sobre.html` is empty; the guard fails on a planted English string |
| 1.7 | Service worker: own css/js network first; a vendor cache named by version; navigations cached without the query; a timeout on network first; registration from data-date.js (questions 7 and 11) | P-1, P-2, P-5, P-6, P-7 | sw.js, js/main.js, js/data-date.js, docs/TECH_STACK.mdc, docs/DECISIONS.mdc (ADR-023) | fix/sw-consistency | diagnosing-bugs, verify | A simulated deploy shows v2/v2 on the first visit; PDF.js survives a VERSION bump; no cache key contains `?`; offline PDF says it needs a connection |
| 1.8 | Forced colours: filled buttons and the divider keep a boundary | C-6 | css/components-buttons.css, css/components-tabs.css | fix/forced-colors | better-accessibility | Forced-colors screenshots show a boundary on Comparar and the divider |

### Phase 2: Tokens and dark mode

**Goal:** one honest token system, derived colours from roles, a dark theme that mirrors the light one, and readable small print. Written plan first (it adds tokens and shows on the page).

**Proved by:** screenshots of every state in both themes, before and after; the DS contrast matrix; the 0-undefined-`var` check.

| # | What | Why | Files | Branch | Skill | Done when |
|---|---|---|---|---|---|---|
| 2.1 | Derived colours as `oklch(from …)`; submit on the accent role; header comments corrected | D-2 | css/tokens.css, css/components-buttons.css, docs/TECH_STACK.mdc | chore/derived-colours | production-ui | `grep -c "rgba(" css/tokens.css` is under 10; the dark block redefines base roles only |
| 2.2 | Dark ramp (question 2): near-neutral surfaces, bg about L 19%, elevation steps of 3 to 4 L, secondary text without the pink hue; theme-color on both pages | D-1 | css/tokens.css, index.html, sobre.html | feature/dark-ramp | production-ui, better-accessibility, verify | Surface chroma 0.004 or less; text 4.5:1 or more and rings 3:1 or more in both themes (the DS matrix); the owner approves the screenshots |
| 2.3 | Typography: one leading family, tracking from tokens, `text-wrap`, typographic quotes, chip tracking | D-3 | css/tokens.css, css/components-*.css, js/ui-renderer.js, docs/COPY.mdc | chore/type-tokens | better-typography | 3 or fewer letter-spacings render; no wrapping text below 1.4; no straight quotes in rendered copy |
| 2.4 | A 6 px space step and `--control-height`; magic numbers replaced; no opacity on text | D-4 | css/tokens.css, css/components-*.css | chore/space-tokens | production-ui | `grep -c "var(--radius-sm)" css/components-*` counts radii only; the height formula exists once |
| 2.5 | Fluid ranges (question 3): headings and vertical rhythm on a 320 to 1280 clamp; static rem elsewhere | L-3 | css/tokens.css | chore/fluid-ranges | better-layout, better-typography | The width sweep shows headings growing to 1280 and no fractional UI text sizes |
| 2.6 | Drag-state contrast | D-5 | css/tokens.css | fix/drag-contrast | better-accessibility | Secondary text at 4.5:1 or more on the dragging bg |

### Phase 3: Component system

**Goal:** one implementation per pattern, with every state, on Foundations' axes, sized for touch. Written plan first (more than 5 files, shows on the page).

**Proved by:** a component sheet screenshot (every variant and state, both themes), a computed-height table at 375 and 1280, and the hover-gate grep.

| # | What | Why | Files | Branch | Skill | Done when |
|---|---|---|---|---|---|---|
| 3.1 | One `.btn` with `data-variant` and `data-size`; hover, active, focus and disabled once; `.interactive-base`, the copies and the reset exclusion deleted | C-1, M-4 | css/components-buttons.css, css/components-tabs.css, css/components-header.css, css/reset.css, index.html, sobre.html, docs/TECH_STACK.mdc | feature/button-system | craft:components (principles), production-ui, verify | One button base rule in css/; every button shows hover, press and disabled; heights take two values, 32 and 36 |
| 3.2 | One `.link-button` | C-2 | css/components-input-views.css, css/components-results.css, css/components-about.css, index.html | chore/link-button | production-ui | Six classes become one plus a modifier |
| 3.3 | Hover gated by `(hover: hover)`; tap highlight, text-size-adjust; a rules-check line for ungated hover | P-4, P-7 | css/*.css, scripts/rules-check.js | fix/touch-hover | mobile-native | 0 ungated `:hover`; the check fails on a planted one |
| 3.4 | 44 px targets under `pointer: coarse` (question 4); delete × hit area | C-4 | css/components-buttons.css, css/components-header.css | feature/touch-targets | mobile-native, verify | Every control is 44 px or more at 375 in mobile emulation, and unchanged at 1280 |
| 3.5 | The selected mode is visible; opaque menu surface (question 5) | C-3, L-4 | css/components-tabs.css, css/components-buttons.css, css/tokens.css | fix/tabs-and-menu | better-accessibility | Selected and unselected differ at 3:1 or more; no text shows through the menu at 375 |
| 3.6 | Select prompt, menu items as links, borderless tags, icon colours, a solid manual form card, one info-row layout, `aria-current` style; checkbox per question 8 | C-7 to C-11 | css/components-*.css, index.html, js/page-actions.js | chore/component-polish | production-ui, better-accessibility | Each item in the C-7 to C-11 rows shows as fixed in the component sheet |

### Phase 4: Layout, result and motion

**Goal:** the answer is the first thing seen on any phone, the header never collides, and nothing snaps or waits.

**Proved by:** the RESP sweep (overlap and fold) and the MOT frame log, re-run.

| # | What | Why | Files | Branch | Skill | Done when |
|---|---|---|---|---|---|---|
| 4.1 | Header in flow: logo, pill and actions wrap on content; the 48rem blocks and the `100vw` caps removed | L-1, L-3 | css/components-header.css, index.html | feature/header-flow | better-layout, verify | Pill-to-buttons gap of 0 or more at every width from 320 to 1920; Sobre clickable at 820 |
| 4.2 | Column `min(100% - 2 * gutter, …)`, one gutter, skip link and safe areas; one `100svh` | L-2, L-5 | css/tokens.css, css/components-*.css, css/utilities.css, css/base.css | fix/column-gutter | better-layout | No negative left edge at root 125 to 200%; at 320 the card has the gutter |
| 4.3 | The result leads with the verdict (question 1); smaller assumptions; a shorter top gap on short screens; the savings line wraps | R-1, L-6 | index.html, js/ui-renderer.js, css/components-results.css, css/tokens.css, docs/COPY.mdc | feature/verdict-first | better-writing, better-layout, verify | At 375x667 the verdict number is in the first screen in Estimado and Preciso; the heading never contradicts the verdict |
| 4.4 | Both input views in one grid cell, so the card never snaps | M-2 | css/components-input-views.css | fix/view-height | craft:motion, verify | Height per frame is constant across a mode switch |
| 4.5 | Entrance on the first result only, four groups, 2 px blur, border-color transition only; tab indicator as one piece (question 6) | M-1 | css/animations.css, css/components-layout.css, css/components-input-views.css, css/components-tabs.css, js/ui-renderer.js, js/ui-components.js, docs/TECH_STACK.mdc | chore/motion-pass | craft:motion | The second submit ends in 150 ms or less; no blur above 2 px; frames clean at 4x CPU |
| 4.6 | Offline notice beside the result | P-3 | index.html, js/data-date.js, css/components-results.css | feature/offline-inline | better-writing, verify | Offline, the notice is inside the first screen at 375x812 |

### Phase 5: Cleanup and docs

**Goal:** the code says only what is true, and what can be checked is checked.

| # | What | Why | Files | Branch | Skill | Done when |
|---|---|---|---|---|---|---|
| 5.1 | Dead CSS and JS removed; main.css deleted after the owner's yes (question 9), print rules moved | X-1, D-7 | css/*.css, index.html, sobre.html, sw.js, js/ui-handlers.js | chore/dead-css | verify | The dead-class script reports 0; screenshots unchanged |
| 5.2 | Layers tidied | D-6 | css/tokens.css, css/animations.css, css/utilities.css, css/reset.css | chore/layers | production-ui | Every file is in a named layer |
| 5.3 | TECH_STACK, comments and headers corrected; a component conventions section (variants, sizes, states, tokens) | X-2 | docs/TECH_STACK.mdc, css/*.css, js/*.js | chore/frontend-docs | better-writing | Each of the 10 TECH_STACK claims in X-2 is true or gone |
| 5.4 | Promote candidates (owner picks): no raw px or hex outside tokens.css; ungated hover (3.3); header parity (1.6); the dead-class check | | scripts/rules-check.js | chore/css-guards | alfred:promote | Each picked check fails on a planted violation |

### Parallel work and owner gates

- **Order.** Phase 1 can start now. Phases 2 and 3 can run in parallel: 2 owns `tokens.css` and 3 owns the component files, and 3.5 waits for 2.1. Phase 4 needs 2.5 and 3.1. Phase 5 goes last.
- **Owner gates:**
  - questions 1 to 6 before Phases 2 to 4;
  - question 9 before 5.1;
  - the written plans for Phases 2 and 3;
  - the screenshot approval in 2.2.

---

## 7. What was not checked, and why

- **Devices and assistive technology.**
  - No real phone, so these are inferred:
    - the iOS keypad for `inputmode`;
    - sticky hover on device;
    - the status bar and splash;
    - safe areas in standalone;
    - the iOS toolbar;
    - whether OS text-size settings change the root font size (L-2).
  - No screen reader: A-3 is inferred from the code and its timing.
  - Windows High Contrast itself was not run; only Chromium's forced-colors emulation.
- **Engines.**
  - The full sweeps, the frame traces and most screenshots are Chromium only.
  - WebKit ran on the cached 2359 build via `executablePath`. Its offline emulation cuts off the service worker, so offline in WebKit is inconclusive.
  - Firefox was used only for the input and motion checks.
- **Browser UI language.** The headless browsers use an English UI. The Portuguese bubble text comes from the full Chromium on the owner's Mac.
- **CSP.** The lab ran with `bypassCSP` (to inject axe), so the CSP itself was not re-tested. October's 4.17a check stands.
- **Lenses.** Only one Jakub Krehel article and one Emil Kowalski article were read. Emil's design-system page returned 404.
- **ARCH.** No React prototype; see its own "not checked" in section 5.
- **Owner's checkbox.** Not reproduced (C-11).
- **Background process.** The lab server (`$SCRATCH/lab/h2serve.js`, port 8443) was stopped at the end of the session.
