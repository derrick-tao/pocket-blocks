# Pocket Blocks layout verification

Date: 14 November 2026. final result: passed

## Evidence and normalization

Source visual truth: [selected option 2](docs/design/score-led-layout-reference.png), the second displayed generated image selected by the user. Source 852×1846 raster normalized to 390×844 CSS pixels for comparison (less than 0.1% aspect rounding). Implementation: [mobile playing screenshot](docs/design/score-led-mobile.png), Chromium 390×844, deviceScaleFactor 1. Both show playing state, score 012480, best 28640, level 05, lines 47, active T, next I and a partial lower stack. Test-only prototype seeding is confined to the verification runner; no production debug hook exists. Settled-piece pixels are representative rather than a pixel-diff oracle.

Full-view evidence: [normalized source and final implementation together](docs/design/score-led-comparison.png). Focused evidence: [score/title/preview header comparison](docs/design/score-led-header-comparison.png). Both combined inputs were opened and inspected after the final changes. Additional [short-landscape paused view](docs/design/score-led-landscape.png) was captured at 844×390 (full page; it is intentionally scrollable).

## Findings and comparison history

Initial comparison found:
- P2: current score at 40px with -2px tracking looked too small beside the selected large score. Fixed to 44px/-1px at 390px; narrower screens retain 34px. Centered scoreboard now max 328px and primary-action row max 300px. Final focused comparison confirms the intended large-score hierarchy.
- P2: landscape matrix exceeded viewport height and the bordered aspect box produced slightly nonsquare cells. Fixed a viewport-height-derived board width and an inset outline in place of layout-affecting border. Browser assertions prove exact 1:2 canvas geometry, viewport centering, and whole-matrix height below the available viewport at 320×640,390×844,844×390 and1280×900.
- P2: after shrinking the landscape board, paused overlay text and the Resume control overflowed its bounds. Fixed compact overlay spacing/type below 600px viewport height. Recaptured the paused screen and added a permanent browser assertion that every ready-overlay child fits within the matrix; independent parent assertions also cover the paused overlay. Post-fix evidence is the landscape image linked above.
- Review fixes: long hold-status text could change layout midgame; hold accessibility labels could mutate on every movement; soft-drop lateral steering depended on RAF timing. Implementer shortened the visible label, diffed accessibility/disabled writes, and latched soft dragging from sample time. Pure/browser/performance checks pass.

No actionable P0/P1/P2 findings remain after the final recapture.

## Required fidelity surfaces

| Surface | Evaluation |
| --- | --- |
| Fonts/typography | Existing local sans-serif and monospace reproduce centered wordmark, large bold current score and secondary numeral hierarchy. No remote fonts. Display score sizing corrected; compact portrait/landscape text checked for wrapping and truncation. |
| Spacing/layout | Centered board axis verified numerically at all four viewports; score/next are above it, next at right. Square cells, balanced primary buttons, no horizontal overflow, touch targets at least 44px. Short screens scroll normally. |
| Color/tokens | Original cream, forest-green and orange tokens retained, with original pastel pieces and hollow ghost. Mock's brighter grid and pale-green I preview are intentionally represented by the existing game's grid and type colors. |
| Image/assets | Existing original favicon/logo reused sharply as an image; board and previews remain real gameplay canvas renderings. No screenshot-as-UI, replacement stock art, new icon package or external asset. Native colored gear removed from Options. |
| Copy/content | Score/title/next/best/level/lines hierarchy retained. Gesture copy intentionally follows the user's newer linked controls guide rather than obsolete double-tap text in the mock. Current help accurately describes simple locking and once-per-piece hold. |

Intentional product additions: HOLD preview/control and retained New game/Sound/How to play utilities are necessary to expose the new mechanic and preserve existing actions. HOLD shifts the board down relative to the earlier mock; Pause and Options still fit within 390×844. Gesture hints and offline utilities may be below the fold, with ordinary page scrolling. Best score retains locale formatting rather than mock zero padding. Short landscape keeps the matrix narrow enough to see it in full when scrolled into view.

## Browser and regression verification

Parent ran npm run test:all successfully: 32 unit/engine/build/gesture cases plus browser, options/button release, direct touch, PWA/CSP, adversarial offline/update, legacy performance and direct performance gates. After the final short-screen CSS fix, npm test and test:direct passed again; the independent parent browser runner passed all four viewports, paused-overlay containment, blank-area tap rotation, soft-drop lateral steering, once-only hold, held-key clearing, offline hold/help, console and CSP checks.

Independent engine comparison: 3000 seeded legacy actions matched the previous engine when hold was unused. Normal parent browser runs produced no page/console errors or CSP violations.

Implementation checklist: completed spec; reviewed delegated diff; corrected above issues; re-captured both full and focused evidence; passed available local checks. GitHub CI/Pages and live smoke are checked after push.

Follow-up polish: optional further visual tuning of grid contrast and a local monochrome Options icon. These are P3 refinements. Physical iOS/Android, WebKit/Firefox and VoiceOver were not tested; Chromium touch emulation is the evidence here.

final result: passed

