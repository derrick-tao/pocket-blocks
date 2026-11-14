> Historical specification: tap, double-tap and upward swipe mappings are superseded by SCORE_LED_CONTROLS_SPEC.md.

# Pocket Blocks: direct-touch playfield controls

Date: 14 November 2026. This enhancement layers onto the completed `OFFLINE_IOS_SPEC.md` release. It changes input and presentation, not the classic game engine, scoring, speed, rotation collision rules, ghost, celebrations, sound, or pause semantics.

## Delivery and isolation

1. This document is the spec-only handoff. The parent reviews it before implementation.
2. The parent finishes and locally checkpoints the concurrent offline/iOS work, then creates a dedicated branch and worktree from that checkpoint. Do not implement against a partial PWA working tree or copy the old baseline over it.
3. The implementing agent works only in that worktree after explicit handoff. It must not edit the parent's main checkout, publish, change repository settings, or push. Local branch commits occur only when the parent authorizes them.
4. The parent reviews the branch, merges it into the parent main branch, runs the combined engine/build/options/input/PWA/security/performance suite, commits the integration, pushes, watches Pages CI, and verifies the live game. Preserve unrelated changes and the Confetti Blocks repository.

## Product behavior

Touch-capable devices use the matrix itself as the default controller. Remove visible directional/rotation/drop buttons from the normal mobile layout so the playfield has no button overlay or gesture pad. Keep desktop keyboard controls unchanged. Retain the existing semantic buttons as an explicit Game options fallback, so the feature does not remove alternative input or the regression-tested held-button behavior.

Add a **Touch controls** setting with two values:

- **Playfield gestures** — the default for touch-capable devices. Hide the old button strip from layout and the accessibility tree. Touch/pen input inside the matrix controls the active piece.
- **Visible buttons** — shows the existing button strip and disables matrix gestures. Existing pointer capture, independent multi-touch, release/cancel/blur/native-end safeguards, and keyboard operation remain intact.

Persist this enum with the existing `pocket-blocks-options` preferences without losing `ghost` or `celebrations`. Validate the enum explicitly; malformed or unavailable storage falls back safely. An existing user with only the two old booleans receives the new default. Do not overwrite a deliberate saved choice when media/device characteristics change. Show the setting on desktop too, without forcing the button strip into ordinary desktop layout unless that choice requires it.

Default touch capability is `navigator.maxTouchPoints > 0` or a coarse-pointer media match. Direct gestures accept touch and pen pointer types; ordinary mouse clicks still focus the game and desktop keyboard still works. Both modes keep the matrix visually unobstructed.

## Coordinate system and common thresholds

Use CSS pixels, never canvas backing-store/device pixels. On pointer-down, snapshot the board rectangle and active piece pose. Let `C = board CSS width / 10`, the visual cell width. Cache geometry for the gesture; resize, relevant scrolling, orientation change, or a second pointer cancels it rather than using stale bounds.

All constants below must live together in the input recognizer and be covered by deterministic tests:

| Quantity | Value |
| --- | --- |
| Tap/slop dead zone `D` | `max(8px, 0.35 × C)` |
| Maximum tap duration | 250 ms |
| Double-tap window, first release to second press | 240 ms |
| Double-tap spatial radius | `max(18px, 0.9 × C)` |
| Axis dominance to latch a swipe | dominant displacement ≥ `1.35 ×` perpendicular displacement, and travel ≥ `D` |
| Horizontal movement quantum | `1.0 × C` per column |
| Soft-drop movement quantum | `1.0 × C` per manually descended row |
| Up-swipe rotation distance | `max(24px, 1.25 × C)` |
| Flick maximum duration | 180 ms from pointer-down to release |
| Flick minimum downward distance | `2.5 × C` |
| Flick minimum average downward speed | `0.025 × C` per ms |
| Flick dominance | downward displacement ≥ `2 × abs(horizontal displacement)` |

Use monotonic pointer/clock timestamps in the same time domain. Do not mix `Date.now()` with event-relative timestamps. Clamp/validate non-finite or non-monotonic synthetic samples in the pure recognizer. These are initial product constants, not claims of universal device ergonomics; changes must update tests and help where relevant.

## Gesture mapping

### A. Side taps: immediate one-column movement

A tap has duration ≤250 ms, total travel ≤D, begins and ends inside the matrix, and belongs to the same active piece/run. Classify against the visible active piece pose captured at pointer-down, so ordinary gravity during a tap does not move its hit target out from under the thumb.

1. A tap on an occupied **active-piece cell** is a rotation candidate (section B). Do not treat its empty matrix-padding cells or the landing outline as the active piece.
2. Otherwise compare x with the center of the occupied active-piece bounding box. A point left of `centerX − 0.25C` shifts one column left; a point right of `centerX + 0.25C` shifts one column right, on release.
3. A point in the center dead band that does not hit an occupied active cell does nothing. This prevents tapping the landing outline beneath the piece from being mistaken for rotation.

Side taps do not wait for the double-tap timer. Two quick side taps move two columns; they are not counter-rotation. A blocked move is a no-op under the existing engine's wall/stack collision rules.

### B. Piece taps: clockwise / counter-clockwise arbitration

A single tap on an active-piece cell rotates clockwise. A double-tap of that piece rotates counter-clockwise **once**. Do not rotate clockwise speculatively and then attempt to undo it: undo can fail near walls/stacks and gives an unintended intermediate action.

- Hold the first rotation candidate for up to 240 ms after its release. If no qualifying second tap begins, perform one clockwise rotation only if the same run/piece is still active and play is unobstructed.
- A qualifying second press begins within 240 ms, lies within the spatial radius of the first tap, and targets the same run/piece token. A natural fall between taps is allowed; the second point need not still overlap the now-descended shape if it is near the first point and the piece has not locked.
- Wait for the second release to confirm its duration/travel also qualify as a tap. Then cancel the pending clockwise action and perform one counter-clockwise rotation.
- If the second press is elsewhere, flush the previous single-tap clockwise action while it remains valid, then classify the new gesture using a fresh pose. If a near second press becomes a swipe, cancel the pending tap rather than letting an old clockwise action fire during a drag/drop.
- A new piece spawn/lock, restart, pause, dialog, gesture cancellation, mode change, blur, hide, scroll, or resize clears pending tap state. No delayed action may rotate a later piece or resume after a modal closes.
- Side movement and downward flick gestures are never promoted into double-tap rotation. Timer completion must not start a persistent render loop when ready/paused.

Single piece taps have a small intentional delay for this arbitration. Upward swipes provide an immediate rotation alternative.

### C. Horizontal swipes: continuous, distance-coupled movement

Once horizontal dominance latches, consume one left/right engine move per full C of horizontal travel, keeping a residual for the next sample. Reversing the thumb reverses movement after crossing the corresponding quantum. This is continuous thumb tracking, not a held-direction auto-repeat: a stationary finger does not keep moving the piece, and release stops movement immediately.

Coalesce raw pointer samples into the existing game frame or at most one bounded input frame. Cap work per frame (for example four move attempts); discard blocked-direction excess rather than queueing an unbounded backlog. On release, process the final coordinates once, with an overall maximum of 10 horizontal attempts for that final flush. Never execute queued movement after release/cancel. If the piece locks/spawns during a stroke, consume/cancel the rest of the stroke rather than carrying it into the next piece.

Do not switch a latched horizontal swipe into a drop or rotation. If perpendicular drift becomes clearly dominant, stop/cancel the gesture; do not turn an accidental diagonal into a hard drop.

### D. Downward swipes: soft drop or deliberate flick

Downward motion latches only after the vertical-dominance and dead-zone rules. Reserve the first 180 ms for flick recognition; do not award soft-drop steps and then retrospectively hard-drop the remainder as a surprise.

- A release qualifies as a hard drop only if all flick duration, distance, speed, and dominance thresholds pass, the pointer ends inside the matrix, no other input mode was committed, and the same piece/run remains active. Perform exactly one `drop()` and consume the gesture until all pointers lift. Never drop the newly spawned piece from the same stroke.
- If the finger remains down beyond 180 ms, latch **soft drop**. Apply the accumulated whole-C downward distance, then one row per further C of downward movement. Use existing manual-drop scoring. Holding still causes no extra soft-drop repeats; gravity still works normally.
- A short release that fails the flick thresholds can apply the whole-C soft-drop distance once. A short, small swipe below one quantum does nothing. Limit a final release flush to 20 attempts and stop immediately if the piece locks or state changes.
- Once soft drop has committed, it cannot promote to hard drop even if the last part accelerates. Upward reversal stops/cancels downward processing and is not reinterpreted as rotation. Releasing outside the matrix cancels any uncommitted flick/tap; no late hard drop occurs.

The threshold combination intentionally requires a brisk, sufficiently long, nearly vertical flick. A rapid tiny jitter is not a hard drop; a long slow swipe is not a hard drop.

### E. Upward swipe: one clockwise rotation

An upward-dominant swipe that reaches the minimum distance rotates clockwise once on release if it ends inside the matrix and the same piece remains active. It does not create horizontal movement, soft drop, or a second rotation from its trailing events. Engine rotation remains no-kick and may be rejected when blocked.

**Interpretation of “upward/clockwise”:** upward swipe means a clockwise rotation of the piece. This release does not recognize drawn circular/arc paths. Circular strokes conflict with continuous horizontal movement and are not silently treated as a special extra gesture. Help must say “Swipe up to rotate clockwise,” not promise circle drawing. A future explicit arc gesture would require its own disambiguation design and tests.

The user explicitly confirmed “Upward swipe rotates clockwise” when asked to clarify; this is the approved mapping.

## Input lifecycle and conflict prevention

- Bind direct manipulation only to the actual matrix canvas/board hit area, not the whole page, score panel, next preview, headers, footer, dialogs, or overlay buttons. Matrix gestures are enabled only when the saved mode is direct, game state is playing, and no dialog/overlay blocks play.
- Set matrix `touch-action:none` and prevent selection/callout; pointer-down captures its pointer and focuses the game with preventScroll. Use the existing page zoom policy, but do not globally cancel scrolling outside the matrix or inside scrollable dialogs.
- One pointer owns a direct gesture. A second touch/pen inside the matrix cancels current/pending actions and suppresses direct interpretation until all involved pointers lift. Pinches must not turn into two side taps or a hard drop. This does not remove the independent multi-touch behavior of the optional button mode.
- Capture failure is a safe no-op for direct manipulation; it must not start repeats or leave active state. Pointer-up/cancel/lost capture have global release cleanup as a fallback. A release outside the matrix cancels uncommitted actions; already-applied distance-coupled moves are not rolled back.
- Clear direct state and pending taps on the existing `clearInputs` paths: pause/resume transition, restart, options/help/install opening, mode changes, blur, visibility hide, pagehide, resize/orientation, scrolling, context menu, pointer cancellation/lost capture, and game over. Ensure any queued frame is canceled, no trailing synthetic click repeats an action, and no input reaches a later piece.
- Keep keyboard and fallback button semantics. Starting direct manipulation cancels held movement from other input sources; an explicit keyboard/button action cancels a pending direct gesture/tap. Do not merge contradictory input queues. Modal settings controls retain their native keyboard and touch behavior.
- Use a run/piece identity token (for example run generation + lock count), not just piece type or x/y. Consecutive identical shapes are different pieces. Restart resets the engine's lock counter, so restart cleanup/generation must prevent token reuse from reviving an old gesture.

## Discoverability and layout

- In direct mode, show a concise static hint outside the matrix: **“Tap sides to move · tap piece to turn · swipe to guide.”** Link or point to How to play for drop/rotation details. Do not place permanent arrows, a virtual joystick, or instructional buttons over the playfield.
- Update How to play with the exact mappings, including “double-tap the piece to turn left,” “swipe up to turn right,” “swipe down slowly to soft drop,” and “flick down to hard drop.” Mention the Visible buttons fallback in Game options.
- The ready screen can give one short first-play touch hint; it must not block play behind a mandatory tutorial. Avoid an additional persisted tracking identifier merely for onboarding.
- Preserve board readability and options/pause/install access at 320px, 390px, and landscape widths, including standalone safe areas. Hiding the button strip should reclaim space. Do not disable page/dialog scrolling or require reaching an invisible control to recover.
- Controls setting changes pause play under the existing options behavior. Closing options does not auto-resume. Existing ghost/celebration preferences and high score survive mode changes, reloads, offline reopen, and updates.

## Architecture, security, and performance

Prefer a focused direct-input module with a pure, testable recognizer and a small DOM adapter. Feed it read-only snapshots/callbacks; do not expose the production game instance or debug globals. Input actions go through the existing validated app/engine actions so collision, locking, score, sound, drawing and announcements stay consistent.

Bound storage to one active gesture, one pending tap, a small fixed number of pointer IDs, and only the start/latest/few velocity samples. No unbounded path arrays, per-move DOM construction, new runtime packages, telemetry, or network requests. Reuse the existing active game frame where practical; otherwise allow one scheduled input-coalescing frame only while a gesture is active, canceled on release. Ready/paused state must retain the offline/performance work's no-busy-loop behavior.

Any new module must join deterministic build inputs, content-hash import rewriting, integrity precache, and offline release invalidation. Preserve restrictive CSP/no-referrer, zero external runtime assets, scoped worker caches, install/icon metadata, truthful offline status, safe update consent/retry/multi-tab behavior, and cached privacy/help. Update the privacy description only to include the locally stored input-mode preference; do not add gesture logging.

## Acceptance tests and integration gates

Add pure recognizer tests with explicit monotonic timestamps and CSS-cell geometry, plus deterministic real touch/CDP Chromium scenarios against built `/pocket-blocks/` assets. Seed through isolated test fixtures or imported engine prototypes as existing tests do; never ship a debug hook. Tests must discover hashed module URLs.

Required gesture cases:

1. Default direct mode on a fresh touch-capable device hides the visible button strip; saved Visible buttons shows it and disables direct gestures. Keyboard still works. Choice/ghost/celebrations persist independently with corrupt/unavailable storage fallback.
2. Left/right side taps move exactly one column without the double-tap delay; wall/stack rejection stays a no-op. Occupied active-cell hits rotate; empty padding/ghost hits do not rotate. A naturally falling but un-locked piece keeps its tap intent.
3. Single piece tap yields one CW after the window; near double-tap yields exactly one CCW and no intermediate CW; far taps resolve independently. Swipe after a pending tap cancels it. Lock/spawn of an identical piece, restart, pause/modal and cancellation cannot receive a delayed rotation.
4. Horizontal movement follows full-cell travel, reverses, stops when stationary/released, clamps at walls, and has no queued movement after cancel. Raw high-rate events remain frame-coalesced without layout reads/DOM churn per event.
5. Slow downward movement awards only soft-drop points. A short/slow/diagonal/jitter stroke never hard drops. A qualifying flick hard drops once, records the existing hard-drop score, and never moves/drops the next piece. Soft-drop commitment prevents later hard promotion. Locking during the stroke consumes it.
6. Upward swipe rotates once; subthreshold upward motion and ambiguous diagonals do nothing. Rotation rejection respects the existing no-wall-kick engine.
7. Pointer-up before the queued frame uses final coordinates once; cancellation/lost capture/outside release/blur/hide/scroll/resize/context-menu/mode change leave no pending timer/frame/actions. A second matrix pointer cancels direct input without pinch/drop/tap side effects; fallback buttons retain their independent multi-touch tests.
8. Readiness/paused/game-over/install/help/options overlays prevent gestures. No synthesized click duplicates a touch action. Matrix manipulation does not scroll/zoom the page; page margins and dialogs still scroll under the PWA zoom policy.
9. 320px/390px/landscape and standalone-like views are unobstructed; screenshots show direct mode without visible action buttons and a reachable fallback option/help.

Integration gates: all existing engine/build/PWA/zoom/icon/security/options/stuck-button/offline-update and performance tests pass after merging. Adapt old tests to choose Visible buttons explicitly where they test those buttons; do not delete the old regressions. Add direct-touch tests to CI before artifact upload/deploy. Run repeated gesture/pause/restart/mode-switch cycles with bounded DOM/listeners/heap and no extra idle RAF; retain the PWA memory and asset budgets. Audit the merged generated manifest to ensure the new module is cached and no source/plain import can bypass the coherent release.

Parent verification includes the existing pre-PWA player's settings migration plus the new input-mode preference, cached offline direct play/help, latest Pages CI success, and a normal live-site direct-touch smoke test. No synthetic public load test. Report Chromium/WebKit availability and distinguish emulation from physical iOS/Android gesture verification.

## Decisions requiring explicit visibility in handoff

- Double-tap counter-rotation applies to piece taps, not two side-movement taps.
- A single piece tap waits up to 240 ms; up-swipe is the fast CW alternative.
- “Clockwise swipe” is implemented as **upward swipe → clockwise piece rotation**, not a circle/arc recognizer.
- Continuous movement is distance-coupled, never an autonomous held-direction repeat after a swipe.
- Direct mode is the normal touch layout; semantic visible controls remain an opt-in accessibility alternative.

These decisions are deliberate disambiguation rules for the user's requested interactions and must be reflected in implementation/help/tests rather than hidden assumptions.

## Isolated-worktree verification — 14 November 2026

Implementation in `feat/direct-touch` passed `npm run test:all`: 32 engine/build/gesture tests, the retained keyboard/button/ghost/celebration suite, real-touch direct-input checks, PWA/zoom/CSP/privacy checks, adversarial offline/update tests, and both performance gates. Existing button fixtures select Visible buttons explicitly; separate migration tests prove that old two-boolean options retain their values and receive the direct default.

The direct browser gate includes an explicit post-flick Help-open check. A reproduced Chromium native-touch click-suppression issue was fixed using direct/playing-only canvas `touchstart` cancellation; no global touchmove listener was introduced. Cached recognizer/controller assets and offline direct play/help/privacy pass.

A gesture-specific lifecycle run used 260 real touch taps, repeated options/control-mode changes, pause/resume and restarts. Retained DOM/listener counts stayed 407/96; post-GC heap grew about 139 KB. Across 360 high-rate pointer moves over 60 frames, the gate recorded 0 board layout reads, 0 DOM mutations and 40 board redraws; paused RAF was 0. The separate legacy gate still covers 1,320 controlled placements. These are Chromium laboratory measurements, not physical iOS/Android gesture or battery certification. Parent owns final independent review, merged integration testing, commit, push and Pages verification.
