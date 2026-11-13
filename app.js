import {Game, SHAPES} from './engine.js';
const $ = id => document.getElementById(id);
const game = new Game();
const colors = {I:'#7ebcb0',J:'#7c9cce',L:'#e5a169',O:'#d6c56e',S:'#9bb773',T:'#ad94b9',Z:'#cd7d6f'};
const board = $('board'), next = $('next'), area = $('game-area');
let best = 0, sound = false, audio, last = performance.now(), priorState, priorLocks = 0;
try { best = Math.max(0, Number(localStorage.getItem('pocket-blocks-best')) || 0); } catch {}
const held = new Map();
function announce(message) { $('announcement').textContent = message; }
function beep(frequency = 330) {
  if (!sound) return;
  try {
    audio ??= new (window.AudioContext || window.webkitAudioContext)();
    if (audio.state === 'suspended') audio.resume().catch(() => {});
    const oscillator = audio.createOscillator(), gain = audio.createGain();
    oscillator.type = 'triangle'; oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(.045, audio.currentTime);
    gain.gain.exponentialRampToValueAtTime(.001, audio.currentTime+.09);
    oscillator.connect(gain); gain.connect(audio.destination);
    oscillator.start(); oscillator.stop(audio.currentTime+.1);
  } catch {}
}
function clearInputs() { held.clear(); }
function focusGame() { area.focus({preventScroll:true}); }
function start() { clearInputs(); game.reset(); priorLocks=0; last=performance.now(); focusGame(); beep(440); sync(); }
function pause() { clearInputs(); game.pause(); sync(); }
function togglePause() {
  clearInputs();
  if (game.state === 'playing') game.pause();
  else if (game.state === 'paused') { game.resume(); last=performance.now(); }
  focusGame(); sync();
}
function act(action) {
  if (game.state !== 'playing') return;
  if (action === 'left') game.move(-1);
  if (action === 'right') game.move(1);
  if (action === 'down') game.down(true);
  if (action === 'cw' && game.rotate()) beep(310);
  if (action === 'ccw' && game.rotate(-1)) beep(290);
  if (action === 'drop') { game.drop(); beep(170); }
  sync();
}
function press(key, action) {
  act(action);
  if (['left','right','down'].includes(action) && game.state === 'playing') held.set(key,{action,at:performance.now()+160});
}
const keys = {ArrowLeft:'left',KeyA:'left',ArrowRight:'right',KeyD:'right',ArrowDown:'down',KeyS:'down',ArrowUp:'cw',KeyW:'cw',KeyX:'cw',KeyZ:'ccw',Space:'drop'};
document.addEventListener('keydown', event => {
  if ($('instructions').open || (event.target instanceof HTMLButtonElement)) return;
  const focused = document.activeElement === area || document.activeElement === document.body;
  if (!focused) return;
  if (keys[event.code] || ['KeyP','Escape','Enter'].includes(event.code)) event.preventDefault();
  if (event.repeat) return;
  if (event.code === 'Enter') {
    if (game.state === 'ready' || game.state === 'over') start();
    else if (game.state === 'paused') togglePause();
  } else if (['KeyP','Escape'].includes(event.code)) togglePause();
  else if (keys[event.code]) press(event.code,keys[event.code]);
});
document.addEventListener('keyup', event => held.delete(event.code));
document.querySelectorAll('[data-action]').forEach(button => {
  button.addEventListener('pointerdown', event => {
    if (event.button !== 0) return;
    event.preventDefault(); focusGame(); button.setPointerCapture(event.pointerId);
    press(`touch-${event.pointerId}`,button.dataset.action);
  });
  for (const type of ['pointerup','pointercancel','lostpointercapture']) button.addEventListener(type,event => held.delete(`touch-${event.pointerId}`));
  button.addEventListener('pointermove', event => {
    const r=button.getBoundingClientRect();
    if (event.clientX<r.left || event.clientX>r.right || event.clientY<r.top || event.clientY>r.bottom) held.delete(`touch-${event.pointerId}`);
  });
  button.addEventListener('click',event => { if (event.detail === 0) { act(button.dataset.action); focusGame(); } });
});
$('start').onclick = () => game.state === 'paused' ? togglePause() : start();
$('pause').onclick = togglePause;
$('restart').onclick = () => {
  if (['playing','paused'].includes(game.state)) {
    pause();
    if (!window.confirm('Start a new game? Your current game will be cleared.')) return;
  }
  start();
};
$('sound').onclick = () => {
  sound = !sound;
  $('sound').setAttribute('aria-pressed',String(sound));
  $('sound').innerHTML = `<span aria-hidden="true">♫</span> Sound ${sound ? 'on' : 'off'}`;
  beep(440); focusGame();
};
$('help').onclick = () => { pause(); $('instructions').showModal(); };
$('close-help').onclick = () => $('instructions').close();
$('instructions').addEventListener('close',focusGame);
window.addEventListener('blur',pause);
document.addEventListener('visibilitychange',() => { if (document.hidden) pause(); });
function sync() {
  $('score').textContent = String(game.score).padStart(6,'0');
  $('level').textContent = String(game.level).padStart(2,'0');
  $('lines').textContent = String(game.lines).padStart(2,'0');
  if (game.score > best) {
    best = game.score;
    try { localStorage.setItem('pocket-blocks-best',String(best)); } catch {}
  }
  $('best').textContent = best.toLocaleString();
  $('pause').disabled = !['playing','paused'].includes(game.state);
  $('pause').querySelector('.action-label').textContent = game.state === 'paused' ? 'Resume' : 'Pause';
  if (game.locks !== priorLocks) {
    priorLocks = game.locks;
    if (game.lastClear) { announce(`${game.lastClear} ${game.lastClear === 1 ? 'line' : 'lines'} cleared. Score ${game.score}. Level ${game.level}.`); beep(550); }
  }
  if (priorState !== game.state) {
    priorState = game.state;
    clearInputs();
    const state = game.state;
    $('overlay').hidden = state === 'playing';
    $('state-label').textContent = {ready:'READY WHEN YOU ARE',playing:'A LITTLE MORE SPACE',paused:'TAKE YOUR TIME',over:'ANOTHER ROUND?'}[state];
    if (state === 'paused') {
      $('overlay-title').textContent = 'Take a breath.';
      $('overlay-kicker').textContent = 'GAME PAUSED';
      $('overlay-text').textContent = 'Your next move can wait.';
      $('start').innerHTML = 'Resume game <span aria-hidden="true">→</span>';
      $('overlay-hint').textContent = 'or press Enter / P';
    } else if (state === 'over') {
      $('overlay-title').textContent = 'One more?';
      $('overlay-kicker').textContent = 'GAME OVER';
      $('overlay-text').textContent = `You scored ${game.score.toLocaleString()} points and cleared ${game.lines} lines.`;
      $('start').innerHTML = 'Play again <span aria-hidden="true">→</span>';
      $('overlay-hint').textContent = 'or press Enter';
    }
    announce({ready:'Ready. Press Enter or Start game to play.',playing:'Game started. Good luck!',paused:'Game paused.',over:`Game over. Score ${game.score}. Press Enter to play again.`}[state]);
  }
  next.setAttribute('aria-label',`Next piece: ${game.next}`);
  draw();
}
function context(canvas) {
  const r=canvas.getBoundingClientRect(), ratio=Math.min(window.devicePixelRatio || 1,3);
  const width=Math.round(r.width*ratio), height=Math.round(r.height*ratio);
  if (canvas.width !== width || canvas.height !== height) { canvas.width=width; canvas.height=height; }
  const ctx=canvas.getContext('2d'); ctx.setTransform(ratio,0,0,ratio,0,0);
  ctx.clearRect(0,0,r.width,r.height);
  return {ctx,width:r.width,height:r.height};
}
function block(ctx,x,y,size,type) {
  ctx.fillStyle=colors[type]; ctx.fillRect(x+1,y+1,size-2,size-2);
  ctx.fillStyle='#ffffff24'; ctx.fillRect(x+2,y+2,size-4,2);
  ctx.fillStyle='#00000012'; ctx.fillRect(x+2,y+size-4,size-4,2);
}
function draw() {
  const {ctx,width,height}=context(board), size=width/10;
  ctx.strokeStyle='#a7bca00b'; ctx.lineWidth=1;
  for (let x=1;x<10;x++) { ctx.beginPath();ctx.moveTo(x*size,0);ctx.lineTo(x*size,height);ctx.stroke(); }
  for (let y=1;y<20;y++) { ctx.beginPath();ctx.moveTo(0,y*size);ctx.lineTo(width,y*size);ctx.stroke(); }
  game.board.forEach((row,y)=>row.forEach((type,x)=>{ if(type) block(ctx,x*size,y*size,size,type); }));
  if (game.state !== 'ready') game.piece.cells.forEach((row,dy)=>row.forEach((cell,dx)=>{
    if(cell && game.piece.y+dy>=0) block(ctx,(game.piece.x+dx)*size,(game.piece.y+dy)*size,size,game.piece.type);
  }));
  const preview=context(next), cells=[];
  SHAPES[game.next].forEach((row,y)=>row.forEach((cell,x)=>{if(cell)cells.push([x,y]);}));
  const minX=Math.min(...cells.map(c=>c[0])),minY=Math.min(...cells.map(c=>c[1]));
  const cols=Math.max(...cells.map(c=>c[0]))-minX+1,rows=Math.max(...cells.map(c=>c[1]))-minY+1;
  const s=Math.min(23,(preview.width-12)/cols);
  for (const [x,y] of cells) block(preview.ctx,(preview.width-cols*s)/2+(x-minX)*s,(preview.height-rows*s)/2+(y-minY)*s,s,game.next);
}
new ResizeObserver(draw).observe(area);
function frame(now) {
  const dt=Math.min(now-last,100); last=now;
  if (game.state === 'playing') {
    for (const input of held.values()) if (now>=input.at) { input.at=now+55; act(input.action); }
    game.tick(dt); sync();
  }
  requestAnimationFrame(frame);
}
sync(); requestAnimationFrame(frame);
