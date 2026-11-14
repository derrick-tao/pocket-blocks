import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {launchBrowser,serve,engineUrl} from './helpers.mjs';
const local=process.env.TEST_URL?null:await serve(),base=process.env.TEST_URL||local.url,browser=await launchBrowser();
const errors=[],report={engine:'Chromium',date:new Date().toISOString()};
async function instrument(page){
  await page.evaluate(async url=>{
    const {Game,SHAPES}=await import(url),reset=Game.prototype.reset;
    Game.prototype.reset=function(){reset.call(this);this.piece={type:'T',cells:structuredClone(SHAPES.T),x:3,y:5};this.next='T';window.__game=this;window.__actions=[];};
    Game.prototype.tick=function(){};
    for(const [method,action]of [['move',null],['rotate',null],['down','down'],['drop','drop'],['hold','hold']]){
      const original=Game.prototype[method];Game.prototype[method]=function(...args){window.__actions.push(action||(method==='move'?(args[0]<0?'left':'right'):(args[0]===-1?'ccw':'cw')));return original.apply(this,args);};
    }
  },await engineUrl(page));
}
function observe(page){page.on('pageerror',error=>errors.push(error.message));}
async function actions(page){return page.evaluate(()=>[...window.__actions]);}
async function reset(page){await page.locator('#restart').click();}
async function driver(context,page){
  const cdp=await context.newCDPSession(page);
  const rect=await page.locator('#board').boundingBox(),c=rect.width/10;
  const point=(col,row,id=1)=>({x:rect.x+col*c,y:rect.y+row*c,id});
  const start=p=>cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[p]});
  const move=p=>cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[p]});
  const end=()=>cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  const tap=async p=>{await start(p);await end();};
  const swipe=async(a,b,delay=0)=>{await start(a);if(delay)await page.waitForTimeout(delay);await move(b);await end();};
  return {cdp,point,start,move,end,tap,swipe};
}
try{
  await mkdir('test-results',{recursive:true});
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  await context.addInitScript(()=>{Math.random=()=>0;window.confirm=()=>true;window.__csp=[];document.addEventListener('securitypolicyviolation',event=>window.__csp.push(event.effectiveDirective));document.addEventListener('pointerdown',event=>window.__pointerId=event.pointerId,true);});
  const page=await context.newPage();observe(page);await page.goto(base);
  assert.equal(await page.locator('.touch-controls').isVisible(),false);assert.equal(await page.locator('#touch-hint').isVisible(),true);
  assert.equal(await page.locator('#touch-mode-option').inputValue(),'direct');
  await instrument(page);await page.locator('#start').tap();let d=await driver(context,page);
  await d.tap(d.point(1,10));await d.tap(d.point(8,10));await d.tap(d.point(5,18));assert.deepEqual(await actions(page),['ccw','cw','cw']);
  await reset(page);await d.tap(d.point(4.5,5.5));await d.tap(d.point(4.5,5.5));assert.deepEqual(await actions(page),['ccw','ccw']);
  await reset(page);await d.start(d.point(3.5,10));await d.move(d.point(6.5,10));await page.waitForTimeout(40);assert.equal(await page.evaluate(()=>window.__game.piece.x),6);await d.move(d.point(2.5,10));await page.waitForTimeout(40);await d.end();assert.equal(await page.evaluate(()=>window.__game.piece.x),2);const h=await actions(page);await page.waitForTimeout(250);assert.deepEqual(await actions(page),h);
  await reset(page);await d.swipe(d.point(5,10),d.point(5,13.2),220);assert.equal(await page.locator('#score').innerText(),'000003');assert.ok((await actions(page)).every(action=>action==='down'));
  await reset(page);await d.swipe(d.point(5,10),d.point(5,14));assert.deepEqual(await actions(page),['drop']);assert.equal(await page.evaluate(()=>window.__game.locks),1);assert.equal(await page.locator('#score').innerText(),'000026');await page.waitForTimeout(280);assert.deepEqual(await actions(page),['drop']);
  await reset(page);await d.swipe(d.point(5,13),d.point(5,10));assert.deepEqual(await actions(page),['hold']);assert.equal(await page.locator('#hold-label').innerText(),'T');
  await reset(page);await d.swipe(d.point(5,10),d.point(7,12));await page.waitForTimeout(260);assert.deepEqual(await actions(page),[]);
  await reset(page);await d.start(d.point(2,10,11));await d.cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[d.point(2,10,11),d.point(8,10,12)]});await d.end();await page.waitForTimeout(280);assert.deepEqual(await actions(page),[]);
  await reset(page);await d.start(d.point(5,10));await d.move(d.point(6,10));await d.cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});const canceled=await actions(page);await page.waitForTimeout(280);assert.deepEqual(await actions(page),canceled);
  await reset(page);await d.start(d.point(5,10));await page.evaluate(()=>document.querySelector('#board').releasePointerCapture(window.__pointerId));await d.end();await page.waitForTimeout(280);assert.deepEqual(await actions(page),[]);
  await reset(page);await page.evaluate(()=>{const b=document.querySelector('#board');window.__capture=b.setPointerCapture;b.setPointerCapture=()=>{throw new Error('Capture unavailable');};});await d.tap(d.point(1,10));await page.evaluate(()=>document.querySelector('#board').setPointerCapture=window.__capture);assert.deepEqual(await actions(page),[]);
  for(const type of ['resize','orientationchange','scroll','contextmenu','pagehide','blur']){await reset(page);await d.start(d.point(4.5,5.5));await page.evaluate(type=>window.dispatchEvent(new Event(type,{cancelable:true})),type);await d.end();assert.deepEqual(await actions(page),[],`${type} cancels gesture`);}
  await reset(page);await d.start(d.point(5,10));await page.waitForTimeout(220);await d.move(d.point(5,12));await page.waitForTimeout(40);await d.move(d.point(7,12));await page.waitForTimeout(40);await d.end();assert.deepEqual(await actions(page),['down','down','right','right']);
  await reset(page);await d.start(d.point(5,10));await page.keyboard.press('KeyC');await d.move(d.point(8,10));await d.end();assert.deepEqual(await actions(page),['hold']);
  await reset(page);await d.start(d.point(4.5,5.5));await page.locator('#options').tap();await page.locator('#close-options').tap();await page.locator('#start').tap();await d.end();assert.deepEqual(await actions(page),[]);
  await page.screenshot({path:'test-results/direct-touch-mobile.png',fullPage:true});
  await page.locator('#options').tap();await page.locator('#touch-mode-option').selectOption('buttons');await page.locator('#ghost-option').uncheck();await page.locator('#close-options').tap();await page.locator('#start').tap();assert.equal(await page.locator('.touch-controls').isVisible(),true);assert.equal(await page.locator('#touch-hint').isVisible(),false);
  await reset(page);d=await driver(context,page);await d.tap(d.point(1,10));assert.deepEqual(await actions(page),[]);await page.locator('[data-action=left]').tap();assert.deepEqual(await actions(page),['left']);
  await page.reload();await page.locator('#options').tap();assert.equal(await page.locator('#touch-mode-option').inputValue(),'buttons');assert.equal(await page.locator('#ghost-option').isChecked(),false);assert.equal(await page.locator('#celebrations-option').isChecked(),true);
  await page.locator('#touch-mode-option').selectOption('direct');await page.locator('#close-options').tap();
  await page.waitForFunction(()=>document.querySelector('#offline-status').textContent.includes('Ready to play offline'));
  const cached=await page.evaluate(async()=>{const names=(await caches.keys()).filter(name=>name.startsWith('pocket-blocks-'));return(await(await caches.open(names[0])).keys()).map(req=>req.url);});assert.ok(cached.some(url=>/direct-touch\.[a-f0-9]+\.js$/.test(url)));assert.ok(cached.some(url=>/touch-controller\.[a-f0-9]+\.js$/.test(url)));
  await context.setOffline(true);await page.reload();await instrument(page);await page.locator('#start').tap();d=await driver(context,page);await d.swipe(d.point(5,10),d.point(5,14));assert.deepEqual(await actions(page),['drop']);
  await page.locator('#help').tap();assert.equal(await page.locator('#instructions').evaluate(node=>node.open),true,'Help tap after a flick must open the dialog');assert.match(await page.locator('#instructions').innerText(),/tap the left half/i);assert.match(await page.locator('#instructions').innerText(),/flick/i);await page.locator('#close-help').tap();
  await page.locator('a[href="./privacy.html"]').click();assert.match(await page.locator('body').innerText(),/touch-control choices/);await page.locator('a[href="./"]').first().click();
  await page.setViewportSize({width:320,height:640});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.equal(await page.locator('.touch-controls').isVisible(),false);await page.screenshot({path:'test-results/direct-touch-small.png',fullPage:true});
  await page.setViewportSize({width:844,height:390});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.ok(await page.evaluate(()=>{const r=document.querySelector('#board').getBoundingClientRect();return Math.abs(r.height-2*r.width)<1&&r.height<innerHeight;}));
  assert.ok(await page.locator('#overlay').evaluate(node=>{const r=node.getBoundingClientRect();return [...node.children].every(child=>{const c=child.getBoundingClientRect();return c.top>=r.top&&c.bottom<=r.bottom&&c.left>=r.left&&c.right<=r.right;});}),'Ready overlay content fits the short landscape matrix');
  await page.screenshot({path:'test-results/direct-touch-landscape.png',fullPage:true});
  assert.deepEqual(await page.evaluate(()=>window.__csp),[]);await context.close();
  // Old two-boolean options migrate to direct mode, preserving both choices.
  const old=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});await old.addInitScript(()=>localStorage.setItem('pocket-blocks-options','{"ghost":false,"celebrations":false}'));
  const migrated=await old.newPage();observe(migrated);await migrated.goto(base);assert.equal(await migrated.locator('.touch-controls').isVisible(),false);await migrated.locator('#options').tap();assert.equal(await migrated.locator('#touch-mode-option').inputValue(),'direct');assert.equal(await migrated.locator('#ghost-option').isChecked(),false);assert.equal(await migrated.locator('#celebrations-option').isChecked(),false);await old.close();
  const invalid=await browser.newContext({hasTouch:true});await invalid.addInitScript(()=>localStorage.setItem('pocket-blocks-options','{"touchMode":"anything","ghost":true}'));const invalidPage=await invalid.newPage();await invalidPage.goto(base);assert.equal(await invalidPage.locator('#touch-mode-option').inputValue(),'direct');await invalid.close();
  const unavailable=await browser.newContext({hasTouch:true});await unavailable.addInitScript(()=>Object.defineProperty(window,'localStorage',{get(){throw new Error('Storage unavailable');}}));const bare=await unavailable.newPage();observe(bare);await bare.goto(base);assert.equal(await bare.locator('.touch-controls').isVisible(),false);await bare.locator('#start').click();await bare.keyboard.press('ArrowLeft');await unavailable.close();
  const desktop=await browser.newContext({viewport:{width:1280,height:900}}),keys=await desktop.newPage();observe(keys);await keys.goto(base);assert.equal(await keys.locator('.touch-controls').isVisible(),false);assert.equal(await keys.locator('#touch-hint').isVisible(),false);await keys.keyboard.press('Enter');await keys.keyboard.press('ArrowLeft');await keys.keyboard.press('Space');assert.ok(Number(await keys.locator('#score').innerText())>0);await desktop.close();
  assert.deepEqual(errors,[]);report.scenarios='default/migration/persistence, tap halves and immediate turns, horizontal/reverse/no-repeat, soft/flick/up/diagonal, multi-touch/cancel/capture loss/modal/blur/keyboard, fallback buttons, cached modules/offline help/privacy, 320px/landscape';await writeFile('test-results/direct-touch.json',JSON.stringify(report,null,2));console.log('Direct-touch browser checks passed: '+report.scenarios);
}finally{await browser.close();await local?.close();}
