# Pocket Blocks

A lightweight classic Tetris webapp for desktop and mobile. Built with vanilla JavaScript and Canvas; no runtime dependencies, account, or backend.

See [SPEC.md](SPEC.md) for the full gameplay, accessibility, and delivery contract.

## Run locally
Requires Python 3 to serve and Node.js 22+ for tests/build.

```sh
npm start
# Open http://localhost:4173
npm test
npm run build
npm run test:options
```

Production files are staged in `dist/`. Static hosting must serve ES modules over HTTP(S). All assets use relative paths, including on GitHub Pages project URLs.

## Controls
Arrow keys or A/D/S move and soft drop. Up/W/X rotates clockwise; Z rotates counterclockwise. Space hard drops. P/Escape pauses/resumes. Enter starts/resumes. Touch buttons support held movement and release safely when interrupted or moved off the button. How to play includes the scoring rules. Sound starts off. Best score is stored locally if browser storage is available.

**Game options** independently toggles the landing outline and line-clear celebrations. Preferences save locally; opening options pauses the game. Celebrations respect reduced motion. Level increases every ten cleared lines; gravity starts at 800 ms per row, multiplies its interval by 0.8 per level, and stops accelerating at 80 ms. This is classic-inspired, not an exact historical or modern Tetris ruleset: there is no seven-bag, hold, wall kicks, lock delay, or T-spin scoring.

## GitHub Pages
In repository Settings → Pages, select **GitHub Actions** as the build source. Push to `main` or run the **Test and deploy to GitHub Pages** workflow. It runs engine tests, builds the static files, and deploys the artifact with the official Pages actions.

## Validation
`npm test` covers engine rules, landing projection, clear metadata, speed, and state transitions. `npm run test:options` starts its own localhost server and checks the built site's visual options, clearing effects, level-up, reduced motion, and stuck-control release paths, including real multi-touch. Browser smoke checks and screenshots are in `tests/browser.mjs`; run `npm start` first, then `node tests/browser.mjs`. Browser tests require `npm ci` and Playwright Chromium (`npx playwright install chromium`); local Linux can use `/usr/bin/chromium` or set `CHROMIUM_PATH`. CI uses matching Playwright Chromium and gates deployment on engine and options/input regressions. No browser tooling ships in production.

Classic-inspired rules are specified explicitly rather than claiming exact emulation of a particular historical release. Canvas gameplay requires visual perception. Latest Chromium is tested here; physical mobile devices, Firefox, and Safari need separate verification.
