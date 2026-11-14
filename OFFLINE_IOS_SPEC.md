# Pocket Blocks: offline, Home Screen, zoom, and release review

Baseline: `4d78fd72abae997793e9a5a3c5e0303da1a8465e`. Date: 14 November 2026. Implement in `/workspace/tetris`, preserving classic gameplay, speed/scoring, ghost and celebration options, reduced motion, sound, pause behavior, saved scores, and the recently fixed multi-touch/release handling. Continue publishing to `https://derrick-tao.github.io/pocket-blocks/`.

## Delivery workflow

The parent authors this specification and delegates implementation to a subagent. The implementing agent edits and tests but does not commit, push, change repository settings, or publish. The parent independently reviews the final diff, runs acceptance checks, commits/pushes the approved implementation, watches CI, and checks the live Pages app. No public load/stress test.

Integration steering: the user additionally requested the separate `DIRECT_TOUCH_SPEC.md` enhancement. After verifying this PWA foundation, the parent makes a local checkpoint (without publishing), creates a feature branch/worktree from it, delegates direct-touch implementation there, and merges into main. The combined release must pass integration checks before the final commit/push/deployment. Neither delegated agent modifies the other checkout.

## 1. Prevent accidental page zoom during play

- Request a fixed-scale mobile viewport using initial/minimum/maximum scale 1 and user-scalable=no, preserving viewport-fit=cover.
- Disable pinch/double-tap zoom with appropriate touch-action policy on the page/game and controls. Preserve ordinary single-finger scrolling for the page and scrollable help/options/install/privacy content. Do not globally cancel every touchmove.
- Suppress Safari gesturestart/gesturechange zoom gestures when those events are available, using narrowly documented non-passive handlers. Keep existing control touch-action:none, selection/callout prevention, pointer capture and release cleanup. Do not interfere with multi-finger directional holds, keyboard controls, or focus.
- Ensure any text-entry/select controls use at least 16px text where iOS focus auto-zoom would apply. Check narrow widths, landscape, and standalone safe-area padding.
- Tests verify viewport/CSS policy and canceled gesture events, preserved scrolling, and uninterrupted touch controls. Browser/OS accessibility settings and browser UI may override zoom restrictions; do not claim an absolute OS-level zoom lock or that desktop browser chrome can be disabled. A physical iOS gesture check remains distinct from emulation.

## 2. Reliable one-visit offline play

- After one successful HTTPS visit caches the complete playable release, show a truthful “Ready to play offline” status. No account or installation is required. A cold first visit needs internet; browser clearing/eviction/private restrictions can remove downloads.
- Add a scope-limited service worker and manifest. Cache every required HTML/CSS/JS/icon/install/privacy asset, including sound/effects (which remain locally synthesized). Game help, options, landing outline, clear animations, best score and preferences must work offline. In-progress games need not be saved; reopening starts ready with saved preferences/best.
- Use deterministic, automatically generated release IDs covering all production inputs and build logic, plus content-addressed JS/CSS filenames and rewritten imports/references. Build must not modify tracked source. Generate a precache integrity manifest from staged output; do not duplicate root/index downloads. Serve built dist for local/CI checks.
- Verify fetched bytes before declaring a candidate complete. Write the completion marker last. Failed or interrupted installation must not delete or overwrite an existing usable snapshot. Same-ID reuse must preserve a committed cache on mismatching manifests/download failures; uncommitted interrupted candidates can recover. Keep unrelated origin caches and the Confetti Blocks app untouched; use a path-scoped Pocket Blocks cache prefix.
- Updates wait for player choice; confirm before restarting an active game. Preserve scores/options. Retain old assets needed by other open Pocket Blocks tabs and clean superseded app snapshots safely afterward. First-download failure must show a retry path without clearing site data; retries must not accumulate listeners or race readiness state.
- Offline detection, pending updates, and download status must not interrupt keyboard/touch play or promise persistence before cache completion. No periodic API polling or external runtime assets.

## 3. iOS Home Screen icon and install experience

- Create original, crisp opaque PNGs matching Pocket Blocks' existing orange/dark-green block identity: apple-touch-icon at **180×180**, standard manifest icons at **192×192** and **512×512**, and a **512×512 maskable** icon with safe central padding. Do not bake OS rounding into the artwork. Keep favicon SVG. Record simple programmatic icon provenance/generation where useful.
- Add apple-touch-icon, apple-mobile-web-app-capable, apple-mobile-web-app-title, appropriate status-bar/theme metadata, and an installable manifest with relative id/start_url/scope and standalone display. All files must resolve at the repository subpath and cache offline.
- Expose an install/offline help entry with iOS instructions: Safari → Share → Add to Home Screen, with Open as Web App if offered. Use beforeinstallprompt only where supported; do not suggest iOS has a programmatic install prompt. Installation remains optional for offline play.
- Tell iOS users to open the saved Home Screen app once while online and wait for offline readiness there. Safari and installed-app storage may be separate; downloading in Safari must not be represented as proof that a never-opened standalone container is already cached. The one-time download belongs to the browser/app storage context.
- Account for top/bottom safe areas without hiding controls. Verify PNG dimensions/opacity, manifest consistency, browser fetches, and standalone styling. Do not claim a real iOS Home Screen install was tested unless an actual device is available.

## 4. Security review and practical fixes

- Review the production source, local-storage input handling, DOM sinks, audio, worker lifecycle/scope/cache isolation, dependency lockfile, and CI. Run a current dependency advisory scan and record its result separately from code-review conclusions.
- Add restrictive meta CSP and explicit no-referrer metadata to HTML pages. Keep local modules, SVG, Canvas, options, sound and offline operation working. Avoid unsafe-inline/unsafe-eval and external reporting/telemetry; DOM/CSS property updates should remain compatible. Verify that an injected inline script is actually blocked and legitimate play causes no CSP violations.
- Treat storage as untrusted: validate finite/nonnegative scores and boolean options; malformed or unavailable storage cannot break play. Do not introduce production debug globals to seed tests.
- Keep runtime dependencies at zero and third-party scripts/assets absent. Preserve SHA-pinned Actions, minimal permissions and credential persistence restrictions. Add dependency maintenance configuration if missing. CI must gate deployment on relevant engine, build/PWA, options/input, offline/update, and bounded perf/memory checks and retain diagnostics on failure.
- Include a short cached privacy notice explaining local values/offline files, no app-level score/account/analytics uploads, and GitHub Pages' security/IP logging. Link an existing public maintainer/repository contact path for parents/guardians, without publishing a new personal email or soliciting children's personal information.
- GitHub Pages cannot set arbitrary anti-framing/nosniff/Permissions-Policy headers. Document recommended host-level headers and shared-origin storage implications as limitations; do not add an ignored _headers file or migrate hosting without a destination. No legal/compliance or vulnerability-free certification.

## 5. Performance and memory review

- Measure the baseline and/or candidate rather than relying on code inspection alone. Record environment, sample count, forced-GC limitations, idle/main-thread activity, active play/input/effect behavior, bundle size, retained heap, DOM/listener counts, and audio-context/voice lifetime where practical.
- Fix material findings in scope: unnecessary DOM writes/layout reads and preview redraws each frame, wasteful ready/paused rendering, redundant frame loops, uncanceled timers/held inputs, unbounded effects/audio or retained DOM, and redundant precache requests. Preserve gravity timing, responsive input and celebration smoothness. Do not reset gravity or create duplicate RAF loops when pausing/resuming/options/restarting.
- In particular, avoid full score/level/lines DOM updates and next-piece canvas layout/redraw at 60Hz when values are unchanged. Cache geometry safely across resize/DPR changes. Stop/suspend unnecessary ready/paused work; effects must remain bounded and expire/cancel on pause/restart/settings changes.
- Use generous reproducible regression budgets: <150 KB production assets excluding PNGs, <2 MiB retained JS heap growth and <16 MiB retained JS heap over at least 1,000 controlled placements/restarts after warmup, and no accumulating listeners/DOM. Interpret results honestly; native/GPU memory, real-device battery, and field latency are separate.
- Thousands of already-loaded players run independently on device. Do not claim GitHub Pages provides a guaranteed concurrency SLA or run burst tests against production. Record hosting/traffic limitations if discussed.

## 6. Acceptance and report

Keep all existing engine and input/options tests. Adapt tests to hashed built modules by discovering the actual engine module URL; do not leave tests importing a stale plain engine.js or expose app internals in production. Make browser executables configurable for local Chromium and CI's matching Playwright browser. Test servers bind 127.0.0.1 and serve only the fixture/dist directory. Use isolated contexts for seeded scenarios.

Required checks:
1. Existing 12 engine rules/projection/speed tests and desktop/mobile keyboard/touch/ghost/animation/options/stuck-control regressions pass.
2. Deterministic build and release invalidation, valid opaque icon dimensions, manifest/Apple metadata, CSP/referrer, scoped core cache and asset budget.
3. Offline reload and closed-tab reopen, standalone-like viewport, help/options/privacy/audio/effects offline, saved values surviving upgrades, and no external runtime requests.
4. Update consent, failed new/same-ID candidates, interrupted install, first-download retry, multi-tab old assets, and unrelated cache preservation (especially confetti-blocks caches).
5. Zoom policy/canceled Safari gesture events, scrollable dialogs/page, 320px/390px/landscape layouts, existing native release/multi-touch behavior, and no console/page/CSP errors during normal use.
6. Repeated play, clears, options/pause/resume/restarts, idle rendering and input performance/memory checks. Verify no duplicate loop after lifecycle changes.
7. Current dependency scan, documented security review, independent parent review, CI through deployment, and live Pages offline/icon smoke checks.

Write `SECURITY_PERFORMANCE_REVIEW.md` with reproduced findings, fixes, measured results, test commands, residual limitations, and audit date. Update README/SPEC with install/offline/zoom behavior and local commands. Record whether Chromium and/or WebKit ran; physical iOS install and gesture testing must be called unverified if unavailable. Parent owns the final verification record, commit and push.

## Parent foundation verification — 14 November 2026

The parent independently ran `npm run test:all`: 17 engine/build tests and all original browser/options, PWA/zoom/security, adversarial offline-update, and performance suites passed. Independent archived-player migration preserved best score and both visual preferences; the Apple icon decoded as opaque 180×180; synthesized pinch retained scale 1 while a real gutter swipe still scrolled the page; offline game/privacy/tab reopening and inline-script blocking passed. A dummy Confetti cache was preserved.

Independent baseline/candidate samples per 1.2 seconds showed ready/paused RAF callbacks drop from 73 to 0 and ordinary active canvas measurements drop from 72 each to 0. The final foundation suite recorded stable 350 DOM nodes / 71 listeners and retained heap 1,744,804 → 1,810,368 bytes across 1,320 placements. Physical iOS installation remains unverified. This is a local foundation checkpoint for the direct-touch worktree, not a separately published release.
