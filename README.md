# Pocket Blocks

A lightweight classic falling-block game for desktop and mobile, with keyboard/touch controls, a landing outline, optional line-clear celebrations, and locally saved best scores/options.

- [Play](https://derrick-tao.github.io/pocket-blocks/)
- [Gameplay spec](SPEC.md)
- [Offline/iOS/security/performance spec](OFFLINE_IOS_SPEC.md)
- [Direct-touch controls spec](DIRECT_TOUCH_SPEC.md)
- [Score-led layout and revised controls spec](SCORE_LED_CONTROLS_SPEC.md)
- [Layout verification](design-qa.md)
- [Security and performance review](SECURITY_PERFORMANCE_REVIEW.md)
- [Privacy and local storage](privacy.html)

## Download once, play offline

Open the game over HTTPS and wait for **Ready to play offline**. The complete game, icons, instructions, options, and privacy notice are cached. You can then reopen it without Wi-Fi; installation is optional. Reopening starts ready, retaining the best score and visual options rather than the in-progress board.

A cold first visit needs internet. Browser/private-mode restrictions, clearing site data, or storage eviction can remove the download. Reconnect and use **Install / offline play → Retry offline download** if the download fails. A completed new release waits for your update choice; active games ask before restarting. Failed candidate downloads preserve the working snapshot.

## Add to the iPhone/iPad Home Screen

In Safari, open the game → **Share → Add to Home Screen** → enable **Open as Web App** if offered → **Add**. Then **open the installed app once online and wait for Ready to play offline there**. Safari and the standalone container may have separate storage, so a Safari download does not prove the Home Screen copy is downloaded. iOS does not expose a programmatic install prompt to this app. Other browsers may offer an Install app prompt/menu item.

Opaque 180px Apple and 192px/512px/maskable manifest icons use Pocket Blocks’ original orange blocks on dark green. They are simple programmatically generated rectangles with no baked OS corner rounding. The manifest and asset paths support GitHub Pages project subpaths.

## Controls and zoom

Arrows or A/D/S move and soft drop; Up/W/X rotates clockwise, Z counterclockwise; Space hard drops; P/Escape pauses/resumes; Enter starts/resumes. Desktop keyboard controls remain unchanged.

Touch devices default to **Playfield gestures**. Tap the left half of the board to rotate counterclockwise or the right half to rotate clockwise; each tap turns once. Swipe horizontally to move, drag down slowly to soft drop while steering sideways, flick down to hard drop, and swipe up to hold or swap once per piece. Holding still does not repeat movement; two fingers cancel matrix gestures. Pieces lock on a blocked downward step; there is no lock delay. C or Shift also holds, and the HOLD control is available outside the board.

Prefer explicit controls? Choose **Game options → Touch controls → Visible buttons**. Those buttons retain held movement, independent multi-touch, and release/cancellation/capture-loss/context-menu/blur/page-hide/scroll/resize safeguards. The control choice saves alongside ghost and celebration options. No gesture path/history is retained or uploaded.

The mobile viewport requests scale 1 with zoom disabled. Page/dialog touch policies preserve normal scrolling while excluding pinch/double-tap zoom; Safari gesture events are prevented without canceling all touchmove events. Touch game controls retain touch-action:none. Browser/OS accessibility settings can override these requests; desktop browser UI zoom cannot be disabled. Physical iOS pinch/Home Screen installation remains unverified here.

## Develop and verify

Node.js 22+; Python 3 only for the optional manual server:

```sh
npm ci
npx playwright install chromium
npm run test:all
npm start
# http://localhost:4173
```

`npm test` runs engine/hold tests, build/PWA assertions, and pure gesture tests, and generates dist. Browser gates run sequentially to avoid focus/auto-pause interference and start isolated localhost-only fixture servers under `/pocket-blocks/`. `npm run test:browser`, `test:options`, `test:direct`, `test:pwa`, `test:offline`, and `test:performance` can be run individually after a build. `TEST_URL` selects a normal live-site smoke check for browser/options/direct/PWA suites. Local Linux can use `/usr/bin/chromium`; override with CHROMIUM_PATH, while CI installs the matching Playwright browser. Screenshots and measurements are ignored in test-results.

The build discovers root `.js` runtime modules excluding build.js/sw.js, rejects external/non-root runtime imports, fingerprints the dependency graph, and rewrites local JS/CSS references. Put test/tooling code in subdirectories. It generates a release ID from production inputs plus build logic, and an integrity manifest embedded in sw.js. Source files are never rewritten by the build. Serve **dist/**, not the source worker template. Runtime dependencies remain zero.

## Release and hosting limits

GitHub Actions runs locked npm install, matching Chromium, engine/build/browser/options/PWA/offline/performance gates before Pages artifact upload and deployment. Actions are SHA-pinned with minimal permissions and credential persistence disabled; Dependabot proposes updates. PRs run gates without deploying.

A candidate cache is marked complete only after verifying every required byte hash. Existing committed same-ID caches are never overwritten on install failure; interrupted uncommitted candidates can recover. Separate Pocket/path cache names preserve unrelated apps, including Confetti Blocks. Old assets are retained for other open Pocket tabs and cleaned when one app tab remains on a subsequent cleanup/visit.

The app ships a restrictive meta CSP and no-referrer metadata. GitHub Pages cannot set arbitrary HTTP headers. Recommended dedicated-origin hosting headers include CSP frame-ancestors 'none', X-Content-Type-Options:nosniff, Referrer-Policy:no-referrer, and Permissions-Policy disabling unused camera/microphone/geolocation. A meta CSP cannot enforce frame-ancestors. No ignored _headers file or unsupported header guarantee is supplied. Same-origin GitHub project sites share browser storage despite worker scopes.

Gameplay runs independently on each player's device, with no score API/backend. This does not establish a GitHub Pages concurrency SLA; cold-download bursts and traffic limits still need a hosting plan. No public stress/load test was performed. Physical iOS/Android devices, Firefox and Safari/WebKit remain separate verification work.
