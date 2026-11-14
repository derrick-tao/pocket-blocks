import test from 'node:test';
import assert from 'node:assert/strict';
import {Game, SHAPES} from '../engine.js';
const fresh=()=>{const g=new Game(()=>0);g.reset();return g;};
test('seven tetrominoes, four cells each; stable four-rotation cycle',()=>{
  assert.equal(Object.keys(SHAPES).length,7);
  for(const [type,cells] of Object.entries(SHAPES)) {
    assert.equal(cells.flat().reduce((a,b)=>a+b),4);
    const g=fresh();g.piece={type,cells:structuredClone(cells),x:3,y:3};
    for(let n=0;n<4;n++)g.rotate();
    assert.deepEqual(g.piece.cells,cells);
    g.rotate();g.rotate(-1);assert.deepEqual(g.piece.cells,cells);
  }
});
test('collision respects walls, floor, and stacked blocks',()=>{
  const g=fresh();
  while(g.move(-1)){}
  assert.equal(g.piece.x,0);assert.equal(g.move(-1),false);
  while(g.move(1)){}
  assert.equal(g.piece.x,6);assert.equal(g.move(1),false);
  g.board[1][6]='T';assert.equal(g.down(),false);assert.equal(g.locks,1);
});
test('rotation is rejected without wall kicks or mutation',()=>{
  const g=fresh();g.piece.y=5;g.rotate();while(g.move(-1)){}
  const before=structuredClone(g.piece);assert.equal(g.rotate(),false);
  assert.deepEqual(g.piece,before);
});
test('hard drop scores only travelled distance and locks once',()=>{
  const g=fresh();g.drop();assert.equal(g.score,38);assert.equal(g.locks,1);
  assert.equal(g.board[19].filter(Boolean).length,4);
});
test('soft drop scores only successful manual steps',()=>{
  const g=fresh();g.down(true);assert.equal(g.score,1);g.down();assert.equal(g.score,1);
});
test('all clear sizes score at previous level and collapse correctly',()=>{
  for(let n=1;n<=4;n++){
    const g=fresh();g.lines=9;g.level=1;
    for(let y=20-n;y<20;y++)g.board[y]=Array(10).fill('T');
    for(let y=20-n;y<20;y++)g.board[y][5]=null;
    g.piece={type:'I',cells:[[0,0,1,0],[0,0,1,0],[0,0,1,0],[0,0,1,0]],x:3,y:16};
    g.lock();assert.equal(g.lastClear,n);assert.equal(g.score,[0,40,100,300,1200][n]);
    assert.equal(g.lines,9+n);assert.equal(g.level,2);assert.equal(g.board.length,20);
    assert.equal(g.board[19][5], n<4?'I':null);
  }
});
test('gravity uses elapsed time; pause freezes all actions',()=>{
  const g=fresh();g.tick(799);assert.equal(g.piece.y,-1);g.tick(1);assert.equal(g.piece.y,0);
  g.pause();const before=JSON.stringify(g);g.tick(5000);g.down(true);g.drop();g.rotate();g.move(1);
  assert.equal(JSON.stringify(g),before);g.resume();g.tick(800);assert.equal(g.piece.y,1);
  g.level=50;assert.equal(g.interval,80);
});
test('blocked spawn and locking above ceiling both end the game',()=>{
  const g=fresh();g.board[0].fill('T');g.spawn();assert.equal(g.state,'over');
  g.reset();g.piece={type:'O',cells:[[1,1],[1,1]],x:4,y:-1};g.board[1][4]='J';
  g.down();assert.equal(g.state,'over');
});
test('restart resets board, points, speed, timing, and state',()=>{
  const g=fresh();g.drop();g.lines=30;g.level=4;g.pause();g.reset();
  assert.equal(g.score,0);assert.equal(g.lines,0);assert.equal(g.level,1);assert.equal(g.elapsed,0);
  assert.equal(g.state,'playing');assert.ok(g.board.flat().every(c=>c===null));
});
test('landing projection matches hard drop on floors, stacks and rotated pieces without mutation',()=>{
  for(const [type,cells] of Object.entries(SHAPES))for(const rotated of [false,true]){
    const g=fresh();g.piece={type,cells:structuredClone(cells),x:3,y:0};
    g.board[19][4]='T';g.board[18][4]='T';if(rotated)g.rotate();
    const before=JSON.stringify(g),landing=g.landingPiece();assert.equal(JSON.stringify(g),before);
    assert.ok(g.fits(landing));assert.equal(g.fits({...landing,y:landing.y+1}),false);
    const expected=landing.cells.flatMap((row,dy)=>row.flatMap((cell,dx)=>cell?[[landing.x+dx,landing.y+dy]]:[]));
    g.drop();for(const [x,y]of expected)assert.equal(g.board[y][x],type);
  }
});
test('clear events record original rows, old-level points, and level transitions',()=>{
  const g=fresh();g.lines=9;g.board[19].fill('T');for(let x=3;x<7;x++)g.board[19][x]=null;
  g.piece={type:'I',cells:structuredClone(SHAPES.I),x:3,y:18};g.lock();
  assert.deepEqual(g.lastClearEvent,{rows:[19],points:40,levelBefore:1,levelAfter:2});
  assert.equal(g.interval,640);const y=g.piece.y;g.tick(639);assert.equal(g.piece.y,y);g.tick(1);assert.equal(g.piece.y,y+1);
  g.drop();assert.equal(g.lastClearEvent,null);assert.equal(g.lastClear,0);
  g.reset();assert.equal(g.lastClearEvent,null);
});
test('gravity accelerates on every level until its lower bound',()=>{
  const g=fresh();let previous=Infinity;
  for(let level=1;level<=20;level++){g.level=level;assert.ok(g.interval<=previous);assert.ok(g.interval>=80);previous=g.interval;}
  g.level=5;assert.ok(Math.abs(g.interval-327.68)<.001);
});
