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
```

Production files are staged in `dist/`. Static hosting must serve ES modules over HTTP(S). All assets use relative paths, including on GitHub Pages project URLs.

## Controls
Arrow keys or A/D/S move and soft drop. Up/W/X rotates clockwise; Z rotates counterclockwise. Space hard drops. P/Escape pauses/resumes. Enter starts/resumes. Touch buttons support held movement. How to play includes the scoring rules. Sound starts off. Best score is stored locally if browser storage is available.

## GitHub Pages
In repository Settings → Pages, select **GitHub Actions** as the build source. Push to `main` or run the **Test and deploy to GitHub Pages** workflow. It runs engine tests, builds the static files, and deploys the artifact with the official Pages actions.

## Validation
`npm test` covers engine rules and state transitions. Browser smoke checks and screenshots are described in `tests/browser.mjs` (requires Playwright as a development dependency and Chromium). Run a local server first, then `node tests/browser.mjs`. No browser tooling ships in production.

Classic-inspired rules are specified explicitly rather than claiming exact emulation of a particular historical release. Canvas gameplay requires visual perception. Latest Chromium is tested here; physical mobile devices, Firefox, and Safari need separate verification.
