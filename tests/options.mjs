import {createServer} from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {existsSync} from 'node:fs';
import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const root=resolve('dist'),mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml'};
const server=createServer(async(req,res)=>{
  const pathname=new URL(req.url,'http://localhost').pathname;
  if(!pathname.startsWith('/pocket-blocks/')){res.writeHead(404).end();return;}
  const path=resolve(root,pathname.slice('/pocket-blocks/'.length)||'index.html');
  if(!path.startsWith(root+'/')){res.writeHead(403).end();return;}
  try{const data=await readFile(path);res.writeHead(200,{'Content-Type':mime[extname(path)]||'text/plain'});res.end(data);}catch{res.writeHead(404).end();}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const base=process.env.TEST_URL||`http://127.0.0.1:${server.address().port}/pocket-blocks/`;
const executablePath=process.env.CHROMIUM_PATH||(!process.env.CI&&existsSync('/usr/bin/chromium')?'/usr/bin/chromium':undefined);
const browser=await chromium.launch({executablePath,args:['--no-sandbox']});
const errors=[];
async function seed(page,count=4){
  await page.evaluate(async count=>{
    const {Game}=await import('./engine.js'),reset=Game.prototype.reset;
    Game.prototype.reset=function(){
      reset.call(this);this.lines=9;this.level=1;
      for(let y=20-count;y<20;y++){this.board[y].fill('T');this.board[y][5]=null;}
      this.piece={type:'I',cells:[[0,0,1,0],[0,0,1,0],[0,0,1,0],[0,0,1,0]],x:3,y:0};
    };
  },count);
}
function observe(page){page.on('pageerror',error=>errors.push(error.message));}
async function openOptions(page){await page.locator('#options').click();await page.locator('#options-dialog').waitFor();}
async function closeOptions(page){await page.locator('#close-options').click();}
try{
  await mkdir('test-results',{recursive:true});
  const ctx=await browser.newContext({viewport:{width:1280,height:900},reducedMotion:'no-preference'});
  await ctx.addInitScript(()=>{
    window.__outlines=0;const stroke=CanvasRenderingContext2D.prototype.strokeRect;
    CanvasRenderingContext2D.prototype.strokeRect=function(...args){if(this.canvas.id==='board')window.__outlines++;return stroke.apply(this,args);};
  });
  const page=await ctx.newPage();observe(page);await page.goto(base);await seed(page);await page.locator('#start').click();
  await page.waitForFunction(()=>window.__outlines>0);await page.screenshot({path:'test-results/landing-outline.png',fullPage:true});
  await page.keyboard.press('Space');assert.equal(await page.locator('#clear-title').innerText(),'Four lines!');
  assert.equal(await page.locator('#lines').innerText(),'13');assert.equal(await page.locator('#level').innerText(),'02');
  assert.equal(await page.locator('#score').innerText(),'001232');
  await page.screenshot({path:'test-results/four-line-celebration.png',fullPage:true});
  await page.locator('#clear-celebration').waitFor({state:'hidden'});
  await openOptions(page);assert.equal(await page.locator('#overlay-title').innerText(),'Take a breath.');
  await page.locator('#ghost-option').uncheck();await page.locator('#celebrations-option').uncheck();await closeOptions(page);
  await page.keyboard.press('Enter');const before=await page.evaluate(()=>window.__outlines);await page.waitForTimeout(70);assert.equal(await page.evaluate(()=>window.__outlines),before);
  await page.reload();await openOptions(page);assert.equal(await page.locator('#ghost-option').isChecked(),false);assert.equal(await page.locator('#celebrations-option').isChecked(),false);await closeOptions(page);
  await seed(page,1);await page.locator('#start').click();await page.keyboard.press('Space');assert.equal(await page.locator('#clear-celebration').isVisible(),false);
  await openOptions(page);await page.locator('#celebrations-option').check();await closeOptions(page);
  page.once('dialog',dialog=>dialog.accept());await page.locator('#restart').click();await page.keyboard.press('Space');assert.equal(await page.locator('#clear-title').innerText(),'Nice clear!');
  await page.locator('#pause').click();assert.equal(await page.locator('#clear-celebration').isVisible(),false);await ctx.close();
  const reduced=await browser.newContext({reducedMotion:'reduce'}),rp=await reduced.newPage();observe(rp);await rp.goto(base);await seed(rp);await rp.locator('#start').click();await rp.keyboard.press('Space');
  assert.equal(await rp.locator('#clear-celebration').isVisible(),true);assert.equal(await rp.locator('#clear-celebration').evaluate(node=>getComputedStyle(node).animationName),'none');await reduced.close();
  // Real touch events: releasing, moving away, cancellation, capture loss, and long-press menus.
  const mobile=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  const phone=await mobile.newPage();observe(phone);await phone.goto(base);
  await phone.evaluate(async()=>{
    const {Game}=await import('./engine.js');window.__positions=[];
    document.addEventListener('pointerdown',event=>window.__pointerId=event.pointerId,true);
    const move=Game.prototype.move;Game.prototype.move=function(...args){const ok=move.apply(this,args);window.__positions.push(this.piece.x);return ok;};
  });
  await phone.locator('#start').tap();const cdp=await mobile.newCDPSession(phone);
  const press=async(action,id=1)=>{const r=await phone.locator(`[data-action="${action}"]`).boundingBox();await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:r.x+r.width/2,y:r.y+r.height/2,id}]});};
  const end=()=>cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  const stopped=async()=>{const n=await phone.evaluate(()=>window.__positions.length);await phone.waitForTimeout(260);assert.equal(await phone.evaluate(()=>window.__positions.length),n);assert.equal(await phone.locator('.is-held').count(),0);};
  await press('left');assert.equal(await phone.locator('[data-action="left"]').evaluate(node=>node.classList.contains('is-held')),true);await phone.waitForTimeout(230);await end();await stopped();
  await press('right');await phone.waitForTimeout(230);await end();await stopped();
  await press('left');await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:2,y:10,id:1}]});await end();await stopped();
  await press('right');await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});await stopped();
  await press('left');await phone.evaluate(()=>document.querySelector('[data-action="left"]').releasePointerCapture(window.__pointerId));await end();await stopped();
  await press('left');await phone.locator('[data-action="left"]').dispatchEvent('contextmenu');await end();await stopped();
  await press('left');await phone.evaluate(()=>window.dispatchEvent(new TouchEvent('touchend',{touches:[],changedTouches:[]})));await stopped();await end();
  const leftBox=await phone.locator('[data-action="left"]').boundingBox(),rightBox=await phone.locator('[data-action="right"]').boundingBox();
  const fingerLeft={x:leftBox.x+leftBox.width/2,y:leftBox.y+leftBox.height/2,id:11},fingerRight={x:rightBox.x+rightBox.width/2,y:rightBox.y+rightBox.height/2,id:12};
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[fingerLeft]});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[fingerLeft,fingerRight]});assert.equal(await phone.locator('.is-held').count(),2);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[fingerLeft]});assert.equal(await phone.locator('[data-action="left"]').evaluate(node=>node.classList.contains('is-held')),false);assert.equal(await phone.locator('[data-action="right"]').evaluate(node=>node.classList.contains('is-held')),true);
  await end();await stopped();
  await press('right');await phone.evaluate(()=>window.dispatchEvent(new Event('blur')));await end();await stopped();
  await phone.locator('#start').tap();
  const right=await phone.locator('[data-action="right"]').boundingBox();await phone.mouse.move(right.x+right.width/2,right.y+right.height/2);await phone.mouse.down();
  await phone.evaluate(()=>window.dispatchEvent(new PointerEvent('pointerup',{pointerId:1,bubbles:true})));await phone.mouse.up();await stopped();
  await phone.mouse.down();await phone.evaluate(()=>window.dispatchEvent(new MouseEvent('mouseup',{bubbles:true})));await stopped();await phone.mouse.up();
  await openOptions(phone);await phone.locator('#ghost-option').uncheck();await closeOptions(phone);await phone.setViewportSize({width:320,height:640});assert.ok(await phone.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await mobile.close();
  const unavailable=await browser.newContext();await unavailable.addInitScript(()=>Object.defineProperty(window,'localStorage',{get(){throw new Error('Storage disabled');}}));
  const up=await unavailable.newPage();observe(up);await up.goto(base);await openOptions(up);await up.locator('#ghost-option').uncheck();await closeOptions(up);await up.locator('#start').click();await up.keyboard.press('Space');await unavailable.close();
  assert.deepEqual(errors,[]);console.log('Options/effects/input checks passed: landing outline, persistence, single/four-line clears, level-up, reduced motion, release/outside/cancel/context menu/blur, mobile layout and storage failure.');
}finally{await browser.close();await new Promise(r=>server.close(r));}
