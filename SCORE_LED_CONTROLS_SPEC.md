# Pocket Blocks: score-led layout and mobile controls

Date: 14 November 2026. Status: implemented and locally verified; see design-qa.md and SECURITY_PERFORMANCE_REVIEW.md.
This document supersedes the layout, tap, double-tap and up-swipe mappings in DIRECT_TOUCH_SPEC.md. Preserve its lifecycle, bounded-work, offline, privacy and alternative-input safeguards unless explicitly amended here.

## Sources and scope
- Selected visual: second displayed layout mockup, docs/design/score-led-layout-reference.png (852×1846 raster, equivalent 390×845 CSS; normalize for QA).
- Requested reference: https://playstudios.helpshift.com/hc/en/16-tetris-mobile/faq/2953-tetris-controls/ , read 14 November 2026.
- Guide mapping: horizontal swipe moves; right-side tap rotates CW; left-side tap rotates CCW; downward swipe hard drops; downward drag soft drops; upward swipe holds/swaps. These replace the earlier double-tap/up-rotation design. Tap targets occupy the whole matrix, independent of active-piece location.
- Apply interaction ideas only; keep Pocket Blocks name, original assets, palette, engine and help wording. Do not copy official branding, artwork or claim an authorized/complete Tetris implementation.
- Extend existing static production app, no framework, runtime CDN, telemetry, new server or external runtime assets.

## Layout
Use option 2: centered logo/title; remove marketing intro and sidebar. A centered game column contains a large current score at upper left and NEXT mint/pastel piece preview at upper right; a secondary row contains best score, level and lines. Below, center a true 10×20 square-cell matrix on the viewport centerline, not merely within leftover sidebar space. Board status/frame and landing outline remain.
Use existing cream #f4f1e8, dark green #26332c/#17251f, orange #c94c26, sans-serif UI and monospace digits. No new artwork required; reuse supplied app logo and canvas pieces.
At 390×844, target compact centered brand (~48px header), scoreboard (~130px), matrix around 240–260×480–520px plus narrow frame; Pause and Options row and concise gesture hints follow. Preserve the hierarchy in the selected image; use compact spacing so core controls remain reachable. At 320px and short landscape, adapt dimensions to available width/height, allow normal page scrolling and keep all controls reachable without horizontal overflow. Desktop retains same centered composition with sensible maximum board width; keyboard help accessible through How to play.
Add HOLD preview, necessary for referenced swipe-up gesture, in a small balanced row ABOVE matrix or within the secondary scoreboard without displacing NEXT from upper right. Label empty hold clearly with a dash/Empty; reflect unavailable hold via subdued appearance and accessible text. No preview covers cells; no permanent gesture buttons overlay the matrix.
Pause and Options are primary supporting actions. Preserve New game, sound, How to play, install/offline and privacy as reachable secondary actions; these may sit in a compact utility row or dialogs. All interactive touch targets at least44×44px. Retain existing DOM IDs where practical.

## Gesture contract
Direct touch/pen remains default; mouse focuses only; keyboard and optional Visible buttons remain available. Bind only actual matrix; score, previews, page margins and dialogs never produce game actions.
- Short stationary tap (<=250ms, total travel<=max(8px,.35cell)) on LEFT HALF of matrix: exactly one immediate CCW rotation on release.
- Same tap on RIGHT HALF (including centerline): exactly one immediate CW rotation. No active-piece hit-test; no double-tap timer. Two rapid taps give two respective rotations; no delayed speculative action.
- Horizontal swipe: existing distance-coupled reversible one-cell travel per column, no held-repeat while finger is still. Keep bounded/coalesced processing.
- Brisk downward swipe/flick: one immediate hard drop on release when existing deliberate thresholds pass (<=180ms, >=2.5cells, >=.025cells/ms average, vertical dominance>=2). Short/slow/diagonal jitters must never hard drop.
- Slow downward drag: existing one-cell travel per manual row once flick arbitration ends; same manual score. After downward drag commits, allow horizontal steering of this SAME piece as the reference describes. Do not reinterpret a committed drag as a hard drop or rotation. Keep bounded per-frame work and allow lateral movement at the floor until next blocked downward step/gravity lock; do not add or imply a modern lock-delay system. Page help must state lock timing truthfully.
- Upward swipe >=max(24px,1.25cells), vertical dominant, release inside matrix: HOLD exactly once, not rotation.
- No circular recognition. Existing diagonal/up/outside-release cancellation protects accidental hold/drop. Stop on piece replacement, lock, restart, pause, modal, second pointer, resize/scroll/blur/hide/cancel/lost capture; never affect subsequent piece.
All thresholds centralized, deterministic tests. No unbounded sample arrays/timers/queues or new RAF idle loops. Keep existing stuck-button and multi-pointer safety in alternative mode.

## Hold engine
Add one held type, once-per-active-piece availability, and monotonic active-piece identity independent of lock count.
First successful hold stores current type and spawns next (advancing queue once); later eligible hold swaps current/held without consuming next. Incoming piece resets to standard spawn orientation/position and gravity elapsed; board, score, level, lines unchanged. One hold per piece until it locks; pressing hold again is a safe no-op. A blocked incoming spawn ends game using existing top-out rules. Reset clears hold and availability. Only playing state accepts hold.
All spawn/hold replacements increment identity even for identical consecutive types; controller token must include run and active-piece identity so a hold consumes its gesture and any held-input backlog cannot move replacement piece from trailing events.
Add keyboard C and Shift (document both) for hold, retaining existing Up/W/X clockwise and Z counterclockwise. Add semantic Hold in optional visible controls and/or accessible HOLD control outside matrix; do not require gestures to use hold. No custom debug globals.
Render held preview with existing canvas pipeline and cached geometry; include hold type/availability in render signatures, invalidate on resize, avoid per-frame DOM changes when unchanged.

## Compatibility and delivery
Preserve scores/options schema and corrupt-storage fallback, ghost, celebrations/reduced-motion, sound, zoom policy, iOS icons/install and privacy. Help must show exact new mappings and explain tap halves, repeated taps, hold once per piece and original simple rules; remove old side-tap movement/double-tap/up-rotation promises. Keep original-spec history but mark superseded mapping if needed.
Build must include content-hashed new/changed modules and integrity precache. Offline reload, help, options, hold and gestures work after first successful download. No runtime fetch of control reference.
No external dependencies needed beyond existing test tools; preserve CSP, no-referrer, scoped cache cleanup and asset budgets. Thousands of users remain independently simulated clients on static GitHub Pages; no shared backend workload or public load test.

## Acceptance and tests
1. Pure engine: first hold, swap, no repeated hold, reenable after lock, next queue use, reset, orientation/position/gravity reset, unchanged score/board, paused/ready/over rejection, blocked-spawn top-out, monotonic identity.
2. Recognizer: taps in blank cells, on piece, ghost, top/bottom both halves; centerline CW; two taps=>two turns without timer; horizontal tracking/reversal/walls; hard/soft distinction; lateral steering after soft commitment; up=>one hold; canceled/outside/diagonal/multi-pointer/lifecycle actions cannot leak to replacement even if same type.
3. Real browser Chromium touch emulation against hashed production build: layout center/score/next coordinates at320,390,desktop and landscape; full Start/Pause/Resume/Options/Help/new-game/sound reachability, hold preview and keyboard/button parity; no clipped persistent controls or console errors; no synthetic click suppression regression.
4. Existing engine/build/options/button-release/direct/PWA/offline-update/performance suites pass. Update assertions for intentional mappings without deleting unrelated regressions; add new tests to npm test:all/CI.
5. Offline fresh download + reload and play hold/gestures; saved options/high score retained. Security review of changes and generated manifest; no new third-party runtime assets, globals or unsafe HTML.
6. Performance: idle/paused no extra RAF; coalesced high-rate movement bounded, cached geometry, repeated hold/drop/pause/restart cycles with bounded DOM/listeners/heap; retain existing budgets.
7. Visual QA: compare selected mock and current screenshot at390×844 in one normalized side-by-side artifact, inspect typography/layout/color/logo/copy; save design-qa.md with no unresolved P0/P1/P2. Necessary HOLD addition documented as intentional deviation.
8. Parent independently reviews diff, runs integration tests, fixes findings, commits and pushes main. Verify GitHub Actions/Pages deployment and live page. Distinguish emulated Chromium checks from unperformed physical iOS/Android testing.

## Implementation handoff
New GPT-6.1 Terra agent works only in /workspace/pocket-blocks-score-led, branch feat/score-led-controls. Read this spec and source, implement and test. No push or deployment; parent owns final review/integration/push. Preserve other worktrees and repositories. Report exact files, checks and limitations.

