# Pocket Blocks security and performance review

Date: 14 November 2026. Baseline: `4d78fd72abae997793e9a5a3c5e0303da1a8465e`. Candidate implements OFFLINE_IOS_SPEC.md. Parent owns final independent verification, commit and deployment record.

## Scope and reproduced findings

Reviewed production HTML/CSS/JS, engine rules, storage reads, DOM sinks, Web Audio, held-control lifecycle, render loop, new worker/cache scope, build and CI. Actual Chromium tests exercise the built `/pocket-blocks/` site with offline networking, synthetic native pointer/touch input, CSP enforcement, and forced-GC sampling. No production debug globals, runtime dependencies, external scripts/fonts/assets, analytics, or score API were added.

The baseline continuously scheduled RAF while ready/paused and performed board/next canvas measurements/redraws on every active frame. Parent baseline measurement per 1.2 seconds: ready 73 RAF callbacks, playing 72 callbacks with 72 board and 72 next-canvas measurements/redraws, paused 73 callbacks. This was unnecessary idle/render work, not evidence of a memory leak.

The original best-score parser accepted Infinity from localStorage. Candidate accepts only finite nonnegative scores and retains strict boolean validation for visual preferences. Malformed/unavailable storage is tested. DOM innerHTML uses remain fixed literals/boolean-generated labels, with no storage/URL/user content flowing into HTML. No exploitable remote injection path was found in this source review, which is not a vulnerability-free certification.

## Fixes

- One RAF chain exists only during play. Ready/paused states cancel it; lifecycle/options/restart paths do not multiply loops or reset engine gravity. Model/state changes are diffed before DOM writes and board redraw. Geometry is cached across ordinary frames and invalidated by resize/DPR changes. Next-piece rendering happens only when the piece or geometry changes.
- Bounded celebrations expire and redraw the clean board even if gravity/model movement does not occur; pause/restart/options cancellation clears them. Ghost and clear effects preserve existing behavior and reduced-motion support.
- Held-control, native touch release, multi-touch, capture-loss and cancellation logic is preserved. A fixed-scale viewport, page/dialog pan-only touch policy, and cancellable Safari gesture handlers reduce accidental zoom without globally canceling touchmove scrolling. OS/browser override limits remain explicit.
- Original opaque RGB PNGs (Apple180, standard192/512, padded maskable512), manifest, Apple metadata, safe-area padding and install instructions are provided. Safari and Home Screen containers must each download once online if their storage is separate.
- Deterministic release identities include all production inputs and build logic. Content-addressed runtime module/CSS URLs, integrity verification, committed-cache markers, isolated candidate cleanup, same-ID guards and retry UI prevent failed updates from erasing a good offline snapshot. Pocket/path cache names leave Confetti and unrelated caches intact. Multi-tab snapshots remain retrievable until safe cleanup.
- Restrictive meta CSP blocks inline/eval/remote scripts, with no reporting endpoint. Explicit no-referrer metadata is present on game/privacy pages. Legitimate Canvas/audio/options/PWA flows report no CSP violation; an injected inline script is actually blocked.
- Audio uses one context and stopped oscillators with explicit ended-node disconnection. Backgrounding pauses play/inputs and suspends audio. No unbounded DOM/effect/audio accumulation was demonstrated.
- A cached privacy notice accurately describes local values, no app gameplay uploads, GitHub security/IP logging and a parent/guardian contact path without publishing a new personal email.

## Dependency advisory scan

`npm audit --json --cache /tmp/pocket-npm-cache` was run on 14 November 2026. Result: **zero known vulnerabilities** across the three installed development packages: @playwright/test, playwright, playwright-core 1.65.0. There are zero third-party runtime packages in dist. An advisory database result is separate from code review and does not rule out unknown/supply-chain vulnerabilities. SHA-pinned Actions, npm ci, minimal deploy permissions, disabled checkout credential persistence and weekly dependency updates remain release controls.

## Candidate measurements

Chromium in this managed Linux environment; 1280×900 viewport; headless; fixed seeded test scenarios use prototype instrumentation only in isolated test contexts. No comparable physical iOS battery/GPU/latency measurement was performed.

| Measurement | Observed result |
| --- | --- |
| 1.2s ready | 0 RAF, 0 board/next layout reads or redraws |
| 1.2s ordinary active play | 73 RAF, 0 board/next layout reads, 1 board redraw, 0 next redraws |
| 1.2s paused | 0 RAF, 0 board/next reads or redraws |
| After repeated pause/resume lifecycle | 73 RAF/1.2s, no duplicated loop |
| 1,320 controlled drops/restarts including warmup | post-GC JS heap ~1.745 MB → ~1.810 MB (decimal) |
| Retained DOM/listeners | stable 350 nodes / 71 listeners across samples |
| 300 extra rotation sounds | 603 audio nodes created, 602 destroyed, one remaining destination in one context |
| 1.2s paused task-time sample | ~8.1ms total main-thread tasks, no game RAF |

`tests/performance.mjs` records new runs in ignored test-results/performance.json. Bounds are deliberately generous: <150KB production bytes excluding PNGs, <2MiB retained JS heap growth and <16MiB total over >1,000 controlled placements, stable DOM/listener counts, and one active/no idle RAF chain. Forced GC measures retained page objects, not total native/browser/GPU memory. Short synthetic batches are not field INP, hours-long leak proof, or device power measurements.

## Verification gates

- 12 original engine geometry/collision/scoring/projection/clear/speed tests retained.
- Deterministic build, content integrity, source preservation, release invalidation for script/worker/icon/privacy, extra root module inclusion, size budget, PNG RGB opacity/dimensions and manifest/Apple metadata assertions.
- Existing desktop/browser and options/ghost/single/four-clear/reduced-motion tests; native touch release, move-away, cancel, capture loss, context menu, touchend fallback, multi-touch, mouse fallback, blur and narrow layout tests.
- New offline/PWA/zoom/CSP checks: offline reload and closed-tab reopening, saved values, options/help/privacy/audio, scale metadata, cancellable Safari events, scrollable dialogs, 320px/390px/landscape, malformed storage, no normal CSP/page errors, and injected inline-script blocking.
- New worker adversarial checks: declined/accepted update, same-ID manifest mismatch and reuse, failed candidate preservation, interrupted candidate recovery, first-install retry, old-tab assets, unrelated/Confetti cache preservation.
- Browser suites run sequentially. `npm run test:all` is the release gate; browser/offline/performance fixtures bind 127.0.0.1 only. No public load/stress testing.

## Direct-touch enhancement review — 14 November 2026

The isolated direct-touch branch adds a pure gesture recognizer and matrix-only adapter, with no runtime packages, network requests, stored gesture history, production debug globals, separate RAF chain, or tap timer. The recognizer advances within the one existing playing frame loop; its pending tap, pose snapshot and bounded pointer-ID set are cleared at lifecycle boundaries. Actions emitted by it preserve the engine's collision, score, speed and lock behavior. Stable run-generation plus lock-count tokens prevent delayed taps/strokes from reaching a different piece, including identical shapes or a restart.

Reviewed handling includes conservative release-only downward flick thresholds, delayed single-tap vs exactly-one counter-clockwise double-tap, distance-coupled movement without stationary repeat, blocked-direction discard, bounded frame/release action attempts, final-pointer flush, and cancellation for diagonals, capture loss, multiple fingers, outside release, modals, blur/hide/scroll/resize/restart and mode changes. The new mode enum is validated separately from existing ghost/celebration booleans; old stored booleans are preserved. The build fingerprints and precaches the recognizer/adapter transitively under the existing integrity and CSP policy.

A real browser issue was reproduced and fixed: after a matrix flick, Chromium's legacy touch-default path could suppress the next UI tap even though the Help pointer events were not canceled. Matrix-only, enabled-play-only non-passive `touchstart` cancellation prevents that native path. No global `touchmove` cancellation was added; page margins and dialogs keep their existing scrolling policy. The permanent browser gate explicitly checks that Help opens after an offline flick.

The gesture-specific performance gate uses 260 real touch taps with repeated options/mode switches, pause/resume and restart, separately from the retained 1,320 legacy-button placement test. One recorded Chromium run retained 407 DOM nodes and 96 listeners in all samples; post-GC JS heap grew 2,427,344 → 2,566,060 bytes (about139KB). Across360 pointer moves over60 frames it observed zero board layout reads, zero DOM mutations, and40 board redraws. Paused RAF remained zero. These are bounded laboratory checks, not physical-device latency/battery guarantees.

The user confirmed upward swipe rotates clockwise. Drawn circles/arcs are not recognized. Visible semantic controls remain available through Game options as an accessible alternative to the default unobstructed touch layout. Physical iOS/Android gesture feel and VoiceOver usage require device-specific follow-up; Chromium/CDP is not a physical mobile installation test.

## Parent merged-release verification — 14 November 2026

The parent reviewed both delegated implementations, locally checkpointed the offline/iOS foundation at `660bfab`, and created `/workspace/pocket-blocks-direct-touch` on `feat/direct-touch` from that checkpoint. After independent real-touch checks, the feature branch was committed at `8eb0e24` and merged into main with `--no-ff --no-commit`. The parent then ran `npm run test:all` on the merged tree **before** the integration commit: all 32 unit/build/gesture tests and all seven browser/offline/performance gates passed.

The merged legacy gate recorded stable 395 nodes / 82 listeners across 1,320 placements, retained heap 1,788,552 → 1,859,884 bytes, one active RAF chain and zero ready/paused RAF. The direct lifecycle gate recorded stable 407 nodes / 96 listeners across 260 real touches and mode/pause/restart cycles, retained heap 2,427,440 → 2,566,612 bytes, and 40 redraws / zero layout reads / zero DOM mutations for 360 pointer moves. No unbounded growth was demonstrated within these runs.

Independent parent checks additionally passed single/double taps, swipes, deliberate hard flicks, token/lifecycle cancellation, two-finger cancellation, offline direct play and post-flick Help. Migration from the archived pre-PWA app preserved best score and visual preferences; an unrelated Confetti cache remained. The 180×180 Apple icon decoded opaque, manifest icons were valid, synthesized Chromium pinch stayed at scale 1 while a gutter touch swipe still scrolled, offline privacy and closed-tab reopening worked, and an injected inline script was blocked. Normal checks produced no page/CSP errors. Production output totals **73,157 bytes**, including all icons.

Final CI/deployment and normal live-site checks occur after pushing the integrated commit; the repository's Actions history records their authoritative result. This record does not add physical iOS, WebKit, field-latency, or hosting-capacity certification.

## Remaining limitations

Chromium emulation and synthetic Safari gesture events are not a physical iOS test. Real iPhone/iPad Home Screen installation, safe-area appearance, pinch gestures, separate standalone storage behavior, Safari/WebKit, Firefox, low-end Android and long-duration battery/GPU behavior remain unverified unless the parent records additional checks. Browser/OS accessibility controls can override zoom requests; desktop browser chrome cannot be locked.

GitHub Pages cannot provide custom anti-framing/nosniff/Permissions-Policy headers; meta frame-ancestors is not supported and is not claimed. A dedicated origin/host with header controls is recommended for stronger isolation; sibling project sites share origin storage. Offline cache durability depends on browser policy and storage availability. This app has no shared gameplay server bottleneck, but cold download capacity, published traffic limits and availability do not constitute a thousands-user SLA. No legal/privacy compliance certification or trademark clearance is implied.
