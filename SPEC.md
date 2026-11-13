# Pocket Blocks — classic Tetris webapp

## Goal and scope
A lightweight single-player falling-block game, playable with a keyboard or touchscreen, hosted as a static GitHub Pages site. No account, backend, external fonts, analytics, or runtime dependencies. Original visual styling; no official Tetris assets.

## Gameplay contract
- Board: 10 columns × 20 visible rows. Seven standard tetrominoes; each next piece selected independently with equal probability. One-piece preview. No hold, ghost, combos, T-spins, or wall kicks.
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

## Interface and accessibility
Warm paper background, orange accent, dark playfield, crisp colored blocks, readable score/level/lines/best, next preview, visible controls, optional synthesized sound off by default, instructions dialog, and state overlays. Responsive two-column desktop layout becomes a compact mobile layout. Touch targets at least 44px; visible keyboard focus, semantic buttons, labelled canvases, polite state/clear announcements, reduced-motion support. Canvas gameplay requires visual perception; screen-reader-complete gameplay is outside this release.

## Architecture and performance
Plain HTML/CSS/JavaScript ES modules. Pure game engine separated from canvas rendering and input. requestAnimationFrame rendering; scale canvas backing resolution for device pixel ratio. Target latest Chrome, Edge, Firefox, and Safari, including Android Chrome and iOS Safari. No network access after loading local assets. Aim for <100KB uncompressed production assets and smooth interaction on ordinary phones.

## Verification and delivery
Node tests cover piece geometry, collision, rotation, locking, line clears and scoring, speed, top-out, drops, and pause. Automated Chromium checks cover startup, keyboard/touch interaction, restart, focus pause, settings, narrow-screen layout, and deployment under a repository subpath. Test storage failure. Manually inspect desktop/mobile screenshots. Mobile Safari/Firefox remain unverified unless those browsers are available.

GitHub Actions runs tests, stages static assets, and deploys to Pages on main pushes or manual dispatch. Paths must be relative for project Pages URLs. Publishing requires a chosen repository, working GitHub authentication, and Pages configured to use GitHub Actions. Publication is complete only when the deployment succeeds and the public URL responds.
