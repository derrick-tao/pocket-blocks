import test from 'node:test';
import assert from 'node:assert/strict';
import {DirectRecognizer,TOUCH_RULES} from '../direct-touch.js';
import {Game,SHAPES} from '../engine.js';
const rect={left:0,top:0,width:300,height:600};
const onPiece={x:135,y:165};
function setup(){
  const game=new Game(()=>0);game.reset();game.piece={type:'T',cells:structuredClone(SHAPES.T),x:3,y:5};
  const actions=[];let run=0,enabled=true;
  const input=new DirectRecognizer({snapshot:()=>({enabled:enabled&&game.state==='playing',token:`${run}:${game.pieceId}`,piece:game.piece}),emit:action=>{
    actions.push(action);if(action==='left')return game.move(-1);if(action==='right')return game.move(1);if(action==='down')return game.down(true);if(action==='cw')return game.rotate();if(action==='ccw')return game.rotate(-1);if(action==='hold')return game.hold();game.drop();return true;
  }});
  return {game,actions,input,newRun(){run++;game.reset();},disable(){enabled=false;}};
}
const tap=(input,point,start=0,end=start+40)=>{assert.ok(input.begin(point,start,rect));input.end(point,end);};
test('gesture constants use CSS cell units and conservative flick/tap limits',()=>{
  assert.equal(TOUCH_RULES.flickMs,180);assert.equal(TOUCH_RULES.flickCells,2.5);assert.equal(TOUCH_RULES.flickSpeedCells,.025);assert.equal(TOUCH_RULES.frameMoves,4);
});
test('taps anywhere rotate by half immediately, including center and consecutive taps',()=>{
  const s=setup();tap(s.input,{x:30,y:330});tap(s.input,onPiece,70);tap(s.input,{x:150,y:570},140);tap(s.input,{x:270,y:10},210);
  assert.deepEqual(s.actions,['ccw','ccw','cw','cw']);s.input.advance(600);assert.equal(s.actions.length,4);
});
test('replacement, disabled state and cancellation prevent trailing gesture actions',()=>{
  for(const change of [s=>s.game.drop(),s=>s.game.hold(),s=>s.newRun(),s=>s.disable(),s=>s.input.cancel()]){const s=setup();s.input.begin(onPiece,0,rect);change(s);s.input.end(onPiece,40);assert.deepEqual(s.actions,[]);}
});
test('horizontal travel is quantized, reversible, bounded, and does not repeat while still',()=>{
  const s=setup();s.input.begin({x:120,y:350},0,rect);s.input.move({x:210,y:350},50);s.input.advance(60);assert.equal(s.game.piece.x,6);assert.deepEqual(s.actions,['right','right','right']);
  s.input.advance(70);s.input.advance(100);assert.equal(s.actions.length,3);
  s.input.move({x:90,y:350},120);s.input.advance(130);assert.equal(s.game.piece.x,2);s.input.end({x:90,y:350},150);assert.equal(s.actions.length,7);
  const wall=setup();wall.input.begin({x:150,y:350},0,rect);wall.input.move({x:-9000,y:350},50);wall.input.advance(60);assert.equal(wall.game.piece.x,0);assert.ok(wall.actions.length<=4);wall.input.advance(70);assert.ok(wall.actions.length<=4);
});
test('short non-flick down swipe soft-drops only whole rows',()=>{
  const s=setup();s.input.begin({x:150,y:300},0,rect);s.input.end({x:150,y:360},150);assert.deepEqual(s.actions,['down','down']);assert.equal(s.game.score,2);
});
test('slow commitment cannot promote to hard drop and holding still does not repeat',()=>{
  const s=setup();s.input.begin({x:150,y:300},0,rect);s.input.move({x:150,y:390},200);s.input.advance(201);assert.equal(s.game.score,3);s.input.advance(220);assert.equal(s.actions.length,3);
  s.input.end({x:150,y:480},230);assert.equal(s.game.score,6);assert.ok(s.actions.every(a=>a==='down'));assert.equal(s.game.locks,0);
});
test('deliberate downward flick drops once and cannot affect the spawned piece',()=>{
  const s=setup();s.input.begin({x:150,y:300},0,rect);s.input.move({x:150,y:390},40);s.input.advance(45);assert.equal(s.actions.length,0);s.input.end({x:150,y:420},60);
  assert.deepEqual(s.actions,['drop']);assert.equal(s.game.locks,1);const before=JSON.stringify(s.game);s.input.end({x:150,y:500},70);s.input.advance(300);assert.equal(JSON.stringify(s.game),before);
});
test('jitter, ambiguous diagonal, outside release and reversed L strokes do not rotate/drop',()=>{
  for(const points of [ [{x:150,y:300},{x:150,y:320}], [{x:150,y:300},{x:240,y:390}], [{x:150,y:300},{x:150,y:700}] ]){
    const s=setup();s.input.begin(points[0],0,rect);s.input.end(points[1],50);assert.ok(!s.actions.includes('drop'));assert.ok(!s.actions.includes('cw'));
  }
  for(const direction of [-1,1]){const s=setup();s.input.begin({x:60,y:300},0,rect);s.input.move({x:60,y:300+direction*60},30);s.input.move({x:280,y:300+direction*60},60);s.input.end({x:280,y:300+direction*60},80);assert.deepEqual(s.actions,[]);}
});
test('upward swipe holds once and consumes the gesture',()=>{
  const s=setup();s.input.begin({x:150,y:400},0,rect);s.input.end({x:150,y:340},60);assert.deepEqual(s.actions,['hold']);assert.equal(s.game.held,'T');
  s.input.end({x:150,y:300},70);assert.deepEqual(s.actions,['hold']);
});
test('committed soft drag allows lateral steering',()=>{
  const s=setup();s.input.begin({x:150,y:300},0,rect);s.input.move({x:150,y:360},200);s.input.advance(201);s.input.move({x:210,y:360},220);s.input.advance(221);s.input.end({x:210,y:360},230);assert.deepEqual(s.actions,['down','down','right','right']);
});
test('soft commitment latches on samples before a frame',()=>{
  const s=setup();s.input.begin({x:150,y:300},0,rect);s.input.move({x:150,y:360},200);s.input.move({x:270,y:360},210);s.input.advance(211);assert.ok(s.actions.includes('right'));assert.ok(s.actions.includes('down'));
});
test('soft-drop locking consumes the gesture, and final coordinates flush without a frame',()=>{
  const s=setup();s.game.piece.y=18;s.input.begin({x:150,y:300},0,rect);s.input.move({x:150,y:450},200);s.input.advance(210);assert.equal(s.game.locks,1);const before=JSON.stringify(s.game);s.input.end({x:150,y:480},220);assert.equal(JSON.stringify(s.game),before);
  const h=setup();h.input.begin({x:120,y:350},0,rect);h.input.move({x:150,y:350},20);h.input.end({x:210,y:350},30);assert.equal(h.game.piece.x,6);
});
test('invalid coordinates/times cannot create actions or unbounded tracking',()=>{
  const s=setup();assert.equal(s.input.begin({x:NaN,y:20},0,rect),false);assert.equal(s.input.begin(onPiece,Infinity,rect),false);
  s.input.begin(onPiece,10,rect);s.input.move({x:900,y:300},5);s.input.end(onPiece,20);s.input.cancel();assert.equal(s.input.gesture,null);assert.deepEqual(s.actions,['ccw']);
});
