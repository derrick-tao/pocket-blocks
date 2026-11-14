import {Game, SHAPES} from './engine.js';
import {initOffline} from './offline.js';
import {initDirectTouch} from './touch-controller.js';
const $ = id => document.getElementById(id);
const game = new Game();
const colors = {I:'#7ebcb0',J:'#7c9cce',L:'#e5a169',O:'#d6c56e',S:'#9bb773',T:'#ad94b9',Z:'#cd7d6f'};
const board = $('board'), next = $('next'), area = $('game-area');
let best = 0, sound = false, audio, last = performance.now(), priorState, priorLocks = 0;
try { const saved=Number(localStorage.getItem('pocket-blocks-best'));if(Number.isFinite(saved)&&saved>=0)best=saved; } catch {}
const touchCapable=navigator.maxTouchPoints>0||matchMedia('(pointer: coarse)').matches;
const options = {ghost:true, celebrations:true,touchMode:'direct'};
try {
  const saved = JSON.parse(localStorage.getItem('pocket-blocks-options'));
  for (const key of ['ghost','celebrations']) if (typeof saved?.[key] === 'boolean') options[key] = saved[key];
  if(['direct','buttons'].includes(saved?.touchMode))options.touchMode=saved.touchMode;
} catch {}
let directInput=null,runGeneration=0;
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
let celebration = null,frameHandle=0,inFrame=false,priorModel='',priorDraw='',priorNext='',geometryEpoch=0;
const canvasGeometry=new Map();
function ensureLoop(){if(game.state==='playing'){if(!frameHandle&&!inFrame){last=performance.now();frameHandle=requestAnimationFrame(frame);}}else if(frameHandle){cancelAnimationFrame(frameHandle);frameHandle=0;}}
function setText(id,text){const node=$(id);if(node.textContent!==text)node.textContent=text;}
function invalidateGeometry(){canvasGeometry.clear();geometryEpoch++;priorDraw='';priorNext='';draw();}
function stopCelebration() { if(celebration)priorDraw='';celebration=null;if(!$('clear-celebration').hidden)$('clear-celebration').hidden=true; }
function celebrate(clear) {
  stopCelebration();
  if (!options.celebrations || !clear) return;
  const count=clear.rows.length, reduced=reducedMotion.matches;
  celebration={age:0,duration:reduced?650:1000,rows:clear.rows,particles:reduced?[]:Array.from({length:Math.min(80,count*20)},()=>({x:Math.random(),y:clear.rows[Math.floor(Math.random()*count)]+.5,vx:(Math.random()-.5)*.0006,vy:-.002-Math.random()*.003,color:colors[Object.keys(colors)[Math.floor(Math.random()*7)]]}))};
  $('clear-title').textContent=['','Nice clear!','Double clear!','Triple clear!','Four lines!'][count];
  $('clear-detail').textContent=`+${clear.points.toLocaleString()}${clear.levelAfter>clear.levelBefore?` · Level ${clear.levelAfter}!`:''}`;
  $('clear-celebration').hidden=false;
}
const held = new Map();
const touchPresses = new Map();
function announce(message) { $('announcement').textContent = message; }
function unlockAudio(){if(!sound)return;try{audio??=new(window.AudioContext||window.webkitAudioContext)();if(audio.state==='suspended')audio.resume().catch(()=>{});}catch{}}
function beep(frequency = 330) {
  if (!sound) return;
  try {
    unlockAudio();if(!audio)return;
    const oscillator = audio.createOscillator(), gain = audio.createGain();
    oscillator.type = 'triangle'; oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(.045, audio.currentTime);
    gain.gain.exponentialRampToValueAtTime(.001, audio.currentTime+.09);
    oscillator.connect(gain); gain.connect(audio.destination);
    oscillator.onended=()=>{oscillator.disconnect();gain.disconnect();};oscillator.start(); oscillator.stop(audio.currentTime+.1);
  } catch {}
}
function releasePointer(pointerId) {
  held.delete(`touch-${pointerId}`);
  const press=touchPresses.get(pointerId);
  touchPresses.delete(pointerId);
  if (press) press.button.classList.toggle('is-held',[...touchPresses.values()].some(other=>other.button===press.button));
}
function clearHeldInputs() {
  held.clear();
  for (const id of [...touchPresses.keys()]) releasePointer(id);
}
function clearInputs(){clearHeldInputs();directInput?.cancel();}
function focusGame() { area.focus({preventScroll:true}); }
function start() { clearInputs(); stopCelebration();runGeneration++; game.reset(); priorLocks=0; last=performance.now(); focusGame(); beep(440); sync(); }
function pause() { clearInputs(); stopCelebration(); game.pause(); sync(); }
function togglePause() {
  clearInputs();
  stopCelebration();
  if (game.state === 'playing') game.pause();
  else if (game.state === 'paused') { game.resume(); last=performance.now(); }
  focusGame(); sync();
}
function act(action,{direct=false}={}) {
  if(!direct)directInput?.cancel();
  if (game.state !== 'playing') return false;
  let accepted=false;
  if (action === 'left') accepted=game.move(-1);
  if (action === 'right') accepted=game.move(1);
  if (action === 'down') accepted=game.down(true);
  if (action === 'cw' && (accepted=game.rotate())) beep(310);
  if (action === 'ccw' && (accepted=game.rotate(-1))) beep(290);
  if (action === 'drop') { game.drop(); beep(170);accepted=true; }
  if(!inFrame)sync();return accepted;
}
function press(key, action) {
  act(action);
  if (['left','right','down'].includes(action) && game.state === 'playing') held.set(key,{action,at:performance.now()+160});
}
const keys = {ArrowLeft:'left',KeyA:'left',ArrowRight:'right',KeyD:'right',ArrowDown:'down',KeyS:'down',ArrowUp:'cw',KeyW:'cw',KeyX:'cw',KeyZ:'ccw',Space:'drop'};
document.addEventListener('keydown', event => {
  if ($('instructions').open || $('options-dialog').open || $('install-dialog').open || (event.target instanceof HTMLButtonElement)) return;
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
window.addEventListener('keyup', event => held.delete(event.code),true);
// A release can arrive outside the original control or after capture is interrupted.
for (const type of ['pointerup','pointercancel','lostpointercapture']) window.addEventListener(type,event=>releasePointer(event.pointerId),true);
for (const type of ['touchend','touchcancel']) window.addEventListener(type,event=>{
  if (event.touches?.length===0) for (const [id,press] of touchPresses) if (press.pointerType==='touch') releasePointer(id);
},{capture:true,passive:true});
window.addEventListener('mouseup',()=>{for (const [id,press] of touchPresses) if (press.pointerType!=='touch') releasePointer(id);},true);
window.addEventListener('pointermove',event=>{
  if (!touchPresses.has(event.pointerId)) return;
  if (event.pointerType!=='touch' && !(event.buttons&1)) { releasePointer(event.pointerId); return; }
  const r=touchPresses.get(event.pointerId).button.getBoundingClientRect();
  if (event.clientX<r.left || event.clientX>r.right || event.clientY<r.top || event.clientY>r.bottom) releasePointer(event.pointerId);
},true);
window.addEventListener('contextmenu',event=>{
  clearInputs();
  if (event.target instanceof Element && (event.target.closest('[data-action]')||(event.target===board&&options.touchMode==='direct'))) event.preventDefault();
},true);
window.addEventListener('pagehide',clearInputs);
window.addEventListener('resize',clearInputs);
window.addEventListener('orientationchange',clearInputs);
window.addEventListener('scroll',clearInputs,true);
window.addEventListener('pointerout',event=>{if(event.pointerType==='mouse'&&!event.relatedTarget)clearInputs();});
document.querySelectorAll('[data-action]').forEach(button => {
  button.addEventListener('pointerdown', event => {
    if (event.button !== 0) return;
    event.preventDefault();directInput?.cancel();focusGame();
    try { button.setPointerCapture(event.pointerId); }
    catch { act(button.dataset.action); return; }
    if (game.state!=='playing') return;
    releasePointer(event.pointerId);
    touchPresses.set(event.pointerId,{button,pointerType:event.pointerType});
    button.classList.add('is-held');
    press(`touch-${event.pointerId}`,button.dataset.action);
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
$('ghost-option').checked=options.ghost;
$('celebrations-option').checked=options.celebrations;
function applyTouchMode(){
  const buttons=document.querySelector('.touch-controls');buttons.hidden=options.touchMode!=='buttons';buttons.classList.toggle('chosen-buttons',options.touchMode==='buttons');
  board.classList.toggle('direct-touch',options.touchMode==='direct');
  $('touch-hint').hidden=options.touchMode!=='direct'||!touchCapable;
  $('touch-mode-option').value=options.touchMode;
  if(game.state==='ready')$('overlay-hint').textContent=options.touchMode==='direct'&&touchCapable?'Tap Start game, then guide the piece.':'or press Enter';
}
applyTouchMode();
$('touch-mode-option').onchange=event=>{
  clearInputs();options.touchMode=event.target.value==='buttons'?'buttons':'direct';
  try{localStorage.setItem('pocket-blocks-options',JSON.stringify(options));}catch{}
  applyTouchMode();
};
for (const [id,key] of [['ghost-option','ghost'],['celebrations-option','celebrations']]) {
  $(id).onchange=event=>{
    options[key]=event.target.checked;
    try { localStorage.setItem('pocket-blocks-options',JSON.stringify(options)); } catch {}
    if (!options.celebrations) stopCelebration();
    draw();
  };
}
$('options').onclick=()=>{
  pause();
  $('options-pause-note').textContent=game.state==='paused'?'Your game is paused. Close options, then choose Resume game.':'Close this dialog to return to your game.';
  $('options-dialog').showModal();
};
$('close-options').onclick=()=>$('options-dialog').close();
$('options-dialog').addEventListener('close',focusGame);
reducedMotion.addEventListener('change',()=>{stopCelebration();draw();});
window.addEventListener('blur',pause);
document.addEventListener('visibilitychange',() => { if (document.hidden) {pause();try{audio?.suspend().catch(()=>{});}catch{}} });
function sync() {
  const model=[game.score,game.lines,game.level,game.state,game.locks,game.piece.x,game.piece.y,game.piece.cells.flat().join(''),game.next].join(':');
  if(model===priorModel){if(celebration||priorDraw==='')draw();ensureLoop();return;}priorModel=model;
  setText('score',String(game.score).padStart(6,'0'));
  setText('level',String(game.level).padStart(2,'0'));
  setText('lines',String(game.lines).padStart(2,'0'));
  if (game.score > best) {
    best = game.score;
    try { localStorage.setItem('pocket-blocks-best',String(best)); } catch {}
  }
  setText('best',best.toLocaleString());
  const disabled=!['playing','paused'].includes(game.state);if($('pause').disabled!==disabled)$('pause').disabled=disabled;
  const label=game.state==='paused'?'Resume':'Pause';if($('pause').querySelector('.action-label').textContent!==label)$('pause').querySelector('.action-label').textContent=label;
  if (game.locks !== priorLocks) {
    priorLocks = game.locks;
    if (game.lastClear) { announce(`${game.lastClear} ${game.lastClear === 1 ? 'line' : 'lines'} cleared. Score ${game.score}. Level ${game.level}.`); beep(550); celebrate(game.lastClearEvent); }
  }
  if (priorState !== game.state) {
    priorState = game.state;
    clearInputs();
    const state = game.state;
    if (state !== 'playing') stopCelebration();
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
  const nextLabel=`Next piece: ${game.next}`;if(next.getAttribute('aria-label')!==nextLabel)next.setAttribute('aria-label',nextLabel);
  draw();ensureLoop();
}
function context(canvas) {
  const ratio=Math.min(window.devicePixelRatio||1,3);let cached=canvasGeometry.get(canvas);
  if(!cached||cached.ratio!==ratio){const r=canvas.getBoundingClientRect();cached={ctx:canvas.getContext('2d'),width:r.width,height:r.height,ratio};canvasGeometry.set(canvas,cached);const width=Math.round(r.width*ratio),height=Math.round(r.height*ratio);if(canvas.width!==width||canvas.height!==height){canvas.width=width;canvas.height=height;}}
  const {ctx,width,height}=cached;ctx.setTransform(ratio,0,0,ratio,0,0);ctx.clearRect(0,0,width,height);return cached;
}
function block(ctx,x,y,size,type) {
  ctx.fillStyle=colors[type]; ctx.fillRect(x+1,y+1,size-2,size-2);
  ctx.fillStyle='#ffffff24'; ctx.fillRect(x+2,y+2,size-4,2);
  ctx.fillStyle='#00000012'; ctx.fillRect(x+2,y+size-4,size-4,2);
}
function draw() {
  const key=[geometryEpoch,window.devicePixelRatio,game.state,game.locks,game.piece.x,game.piece.y,game.piece.cells.flat().join(''),options.ghost,celebration?.age??'none'].join(':');
  if(key===priorDraw)return;priorDraw=key;
  const {ctx,width,height}=context(board), size=width/10;
  ctx.strokeStyle='#a7bca00b'; ctx.lineWidth=1;
  for (let x=1;x<10;x++) { ctx.beginPath();ctx.moveTo(x*size,0);ctx.lineTo(x*size,height);ctx.stroke(); }
  for (let y=1;y<20;y++) { ctx.beginPath();ctx.moveTo(0,y*size);ctx.lineTo(width,y*size);ctx.stroke(); }
  game.board.forEach((row,y)=>row.forEach((type,x)=>{ if(type) block(ctx,x*size,y*size,size,type); }));
  if (options.ghost && game.state === 'playing') {
    const landing=game.landingPiece();
    if (landing && landing.y!==game.piece.y) {
      ctx.save(); ctx.strokeStyle=colors[landing.type]; ctx.lineWidth=2; ctx.globalAlpha=.8;
      landing.cells.forEach((row,dy)=>row.forEach((cell,dx)=>{
        if (cell && landing.y+dy>=0) ctx.strokeRect((landing.x+dx)*size+3,(landing.y+dy)*size+3,size-6,size-6);
      }));
      ctx.restore();
    }
  }
  if (game.state !== 'ready') game.piece.cells.forEach((row,dy)=>row.forEach((cell,dx)=>{
    if(cell && game.piece.y+dy>=0) block(ctx,(game.piece.x+dx)*size,(game.piece.y+dy)*size,size,game.piece.type);
  }));
  if (celebration && game.state==='playing') {
    const life=1-celebration.age/celebration.duration;
    ctx.save();
    if (!reducedMotion.matches) {
      ctx.fillStyle=`rgba(246,214,149,${life*.28})`;
      for (const row of celebration.rows) ctx.fillRect(0,row*size,width,size);
      for (const bit of celebration.particles) {
        const age=celebration.age;
        ctx.globalAlpha=life; ctx.fillStyle=bit.color;
        ctx.fillRect((bit.x+bit.vx*age)*width,(bit.y+bit.vy*age+.000004*age*age)*size,Math.max(2,size*.13),Math.max(2,size*.13));
      }
    }
    ctx.restore();
  }
  const nextKey=[game.next,geometryEpoch,window.devicePixelRatio].join(':');if(nextKey===priorNext)return;priorNext=nextKey;
  const preview=context(next), cells=[];
  SHAPES[game.next].forEach((row,y)=>row.forEach((cell,x)=>{if(cell)cells.push([x,y]);}));
  const minX=Math.min(...cells.map(c=>c[0])),minY=Math.min(...cells.map(c=>c[1]));
  const cols=Math.max(...cells.map(c=>c[0]))-minX+1,rows=Math.max(...cells.map(c=>c[1]))-minY+1;
  const s=Math.min(23,(preview.width-12)/cols);
  for (const [x,y] of cells) block(preview.ctx,(preview.width-cols*s)/2+(x-minX)*s,(preview.height-rows*s)/2+(y-minY)*s,s,game.next);
}
const resizeObserver=new ResizeObserver(invalidateGeometry);resizeObserver.observe(area);resizeObserver.observe(next);
window.addEventListener('resize',invalidateGeometry);
let dprQuery;
function watchDpr(){dprQuery?.removeEventListener('change',dprChanged);dprQuery=matchMedia(`(resolution: ${window.devicePixelRatio||1}dppx)`);dprQuery.addEventListener('change',dprChanged);}
function dprChanged(){invalidateGeometry();watchDpr();}watchDpr();
function frame(now) {
  frameHandle=0;inFrame=true;
  const dt=Math.min(now-last,100);last=now;
  if(game.state==='playing'){
    directInput?.advance(performance.now());
    for(const [id,press]of touchPresses)if(!press.button.hasPointerCapture(id))releasePointer(id);
    if(celebration){celebration.age+=dt;if(celebration.age>=celebration.duration)stopCelebration();}
    for(const input of held.values())if(now>=input.at){input.at=now+55;act(input.action);}
    game.tick(dt);sync();
  }
  inFrame=false;if(game.state==='playing'&&!frameHandle)frameHandle=requestAnimationFrame(frame);
}
directInput=initDirectTouch({board,snapshot:()=>({enabled:options.touchMode==='direct'&&game.state==='playing'&&!document.querySelector('dialog[open]'),token:`${runGeneration}:${game.locks}`,piece:game.piece}),emit:action=>act(action,{direct:true}),beginInput:()=>{clearHeldInputs();focusGame();unlockAudio();}});
sync();initOffline({pause,focusGame,isActive:()=>['playing','paused'].includes(game.state)});
