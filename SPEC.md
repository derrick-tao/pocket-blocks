# Pocket Blocks — classic Tetris webapp

## Goal and scope
A lightweight single-player falling-block game, playable with a keyboard or touchscreen, hosted as a static GitHub Pages site. No account, backend, external fonts, analytics, or runtime dependencies. Original visual styling; no official Tetris assets.

## Gameplay contract
- Board: 10 columns × 20 visible rows. Seven standard tetrominoes; each next piece selected independently with equal probability. One-piece preview. No hold, combos, T-spins, or wall kicks. Optional landing outline (ghost piece) is a visual aid.
- Spawn centered at the top, with pieces allowed partly above the visible board. Collision prevents sideways movement, descent, and rotation. A blocked downward step locks immediately. Locking above the ceiling, or an obstructed spawn, ends the game.
- Rotate in either direction around the piece's square matrix; O remains unchanged. Rotation that intersects a wall or occupied cell is rejected without moving the piece.
- Remove all completed rows together and collapse rows above. Award 40 / 100 / 300 / 1200 × current level for 1 / 2 / 3 / 4 lines. Soft drop earns 1 point per manually descended cell; hard drop earns 2. No points for failed movement or gravity.
- Start at level 1; increase every 10 total lines. Gravity interval is max(80, 800 × 0.8^(level − 1)) milliseconds. Score a clear at the level before that clear.
- States: ready, playing, paused, game over. Start/restart clears the board and score. Pause freezes gameplay; leaving the tab/window pauses automatically and requires explicit resume.
- Save the best score locally when possible. Storage failure must never prevent play. No saved in-progress session.

## Controls
| Action | Keyboard | Touch |
| --- | --- | --- |
| Move | Left/right arrows or A/D | Left/right buttons; hold to repeat |
| Soft drop | Down arrow or S; hold to repeat | Down button; hold to repeat |
| Rotate clockwise | Up arrow, W, or X | Clockwise button |
| Rotate counterclockwise | Z | Counterclockwise button |
| Hard drop | Space | Drop button |
| Start / pause / resume | Enter (start/resume), P or Escape (pause/resume) | Start/resume overlay, Pause button |
| Restart | New game button; confirm while playing/paused | Same |

Use a 160ms initial repeat delay and 55ms repeat interval. Rotation and hard drop trigger once per press. Prevent page scrolling for gameplay keys while the game has focus. Touch buttons use pointer capture, support multiple fingers, and clear held inputs on cancellation, blur, or pause. Moving outside a held button cancels its repeat.

## Visual game options and input reliability — 14 November 2026
- Add an accessible Game options dialog with independent landing-outline and line-clear-celebration checkboxes, both enabled by default. Save only valid boolean preferences under `pocket-blocks-options`; blocked/corrupt storage falls back to defaults. Opening options pauses play and clears held inputs; closing requires explicit resume.
- The outline projects the active piece against the real walls/stack using the same collision rules as hard drop. It updates with movement, rotation, and locking and never changes board, score, or timing. Render beneath the active piece; omit a duplicate outline at the active piece's own position.
- Clearing 1–4 lines triggers corresponding friendly messages, a points label, a level-up label when relevant, bounded sparkles (at most 80), and soft row highlights at the cleared rows' original locations. Effects use the existing render loop, expire within one second, and clear on pause, restart, or disabling. No extra persistent animation loop, timers, or full-screen flashing. Reduced motion retains a brief static message without particles or moving highlights.
- Expose clear metadata from the engine without changing classic scoring, gravity, or collapse rules. Non-clearing locks and top-out must clear previous metadata to avoid phantom celebrations.
- Fix stuck left/right/down controls: release handling at window capture level, cancellation when leaving the button or losing capture/focus, context-menu/long-press cleanup, page-hide/resize/scroll cleanup, and no-repeat fallback if capture fails. Explicit pressed highlights must track actual pointer holds and clear alongside repeats; suppress mobile text selection/callout and sticky hover feedback. Preserve valid continuous holds and multi-touch independence.
- Verify landing against empty floors, stacks, rotations and hard drop, option persistence and storage failure, single/four-line celebrations, reduced motion, faster gravity after crossing ten lines, and real touch release/cancel/outside/context-menu paths. Use a controlled test fixture without exposing production debug globals.

The game follows the traditional falling-block structure, but is not an exact historical or modern official ruleset. It retains simple no-kick rotation, independent random selection, immediate locking, and classic-style scoring; it does not implement modern seven-bag, hold, SRS, lock delay, or T-spin scoring. Disable visual options for the original presentation.

Verification: all 12 engine tests passed, including projection/hard-drop agreement for every shape and both rotations, clear-event metadata, and the speed curve. Built-site Chromium checks passed saved options, single/four-line celebrations, level-up, reduced motion, storage failure, mobile layout, normal/outside/cancelled releases, lost capture, context-menu cleanup, native release fallbacks, and independent multi-touch. The original desktop/mobile keyboard, pause, game-over, restart, and score-persistence smoke suite also passed. Physical iOS/Android devices remain separately unverified.

## Interface and accessibility
Warm paper background, orange accent, dark playfield, crisp colored blocks, readable score/level/lines/best, next preview, visible controls, optional synthesized sound off by default, instructions dialog, and state overlays. Responsive two-column desktop layout becomes a compact mobile layout. Touch targets at least 44px; visible keyboard focus, semantic buttons, labelled canvases, polite state/clear announcements, reduced-motion support. Canvas gameplay requires visual perception; screen-reader-complete gameplay is outside this release.

## Architecture and performance
Plain HTML/CSS/JavaScript ES modules. Pure game engine separated from canvas rendering and input. requestAnimationFrame rendering; scale canvas backing resolution for device pixel ratio. Target latest Chrome, Edge, Firefox, and Safari, including Android Chrome and iOS Safari. No network access after loading local assets. Aim for <100KB uncompressed production assets and smooth interaction on ordinary phones.

## Verification and delivery
Node tests cover piece geometry, collision, rotation, locking, line clears and scoring, speed, top-out, drops, and pause. Automated Chromium checks cover startup, keyboard/touch interaction, restart, focus pause, settings, narrow-screen layout, and deployment under a repository subpath. Test storage failure. Manually inspect desktop/mobile screenshots. Mobile Safari/Firefox remain unverified unless those browsers are available.

GitHub Actions runs tests, stages static assets, and deploys to Pages on main pushes or manual dispatch. Paths must be relative for project Pages URLs. Publishing requires a chosen repository, working GitHub authentication, and Pages configured to use GitHub Actions. Publication is complete only when the deployment succeeds and the public URL responds.

## Offline, iOS, zoom and audit release

See OFFLINE_IOS_SPEC.md and SECURITY_PERFORMANCE_REVIEW.md for the full acceptance and measured review. After a completed first HTTPS download, the generated service worker caches every game/install/privacy asset and permits offline reopening. Updates wait for player choice and preserve scores/options. Home Screen installation is optional; iOS users must open the installed app once online and await its own offline-ready status because Safari/standalone storage may differ. Icons use original opaque Pocket Blocks artwork at Apple180, manifest192/512 and maskable512.

The game requests mobile scale1 and suppresses accidental pinch/double-tap gestures while preserving page/dialog scrolling and multi-touch buttons. Browser/OS accessibility controls can override this; physical iOS installation and gesture verification is distinct from Chromium emulation. Privacy is documented in privacy.html, including browser storage and GitHub hosting security/IP logs. No app-level gameplay uploads or external runtime assets were introduced.

Production is generated into dist with fingerprinted modules/CSS, integrity manifests and deterministic release identities. Source worker is a template. CI runs engine/build, browser, options/native input, offline/PWA, and bounded memory/render regression gates sequentially before deployment. Ready/paused RAF work stops; active play reuses canvas geometry/next previews and diffed DOM state without altering rules, speed, scoring or input timing.
