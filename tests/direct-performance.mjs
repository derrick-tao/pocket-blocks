import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {launchBrowser,serve,engineUrl} from './helpers.mjs';
const local=await serve(),browser=await launchBrowser({args:['--js-flags=--expose-gc']}),report={date:new Date().toISOString(),engine:'Chromium'};
try{
  const ctx=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  await ctx.addInitScript(()=>{
    window.confirm=()=>true;window.__raf=0;window.__boardReads=0;window.__boardDraws=0;
    const raf=window.requestAnimationFrame;window.requestAnimationFrame=cb=>raf.call(window,time=>{window.__raf++;cb(time);});
    const rect=HTMLCanvasElement.prototype.getBoundingClientRect;HTMLCanvasElement.prototype.getBoundingClientRect=function(...args){if(this.id==='board')window.__boardReads++;return rect.apply(this,args);};
    const clear=CanvasRenderingContext2D.prototype.clearRect;CanvasRenderingContext2D.prototype.clearRect=function(...args){if(this.canvas.id==='board')window.__boardDraws++;return clear.apply(this,args);};
    document.addEventListener('pointerdown',event=>window.__pointerId=event.pointerId,true);
  });
  const page=await ctx.newPage();await page.goto(local.url);
  await page.evaluate(async url=>{const {Game,SHAPES}=await import(url),reset=Game.prototype.reset;Game.prototype.reset=function(){reset.call(this);this.piece={type:'T',cells:structuredClone(SHAPES.T),x:3,y:5};};Game.prototype.tick=function(){};},await engineUrl(page));
  await page.locator('#start').tap();const cdp=await ctx.newCDPSession(page);
  const gesture=async right=>{
    const r=await page.locator('#board').boundingBox(),c=r.width/10;
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:r.x+(right?8:1)*c,y:r.y+10*c,id:1}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  };
  const cycles=async count=>{for(let i=0;i<count;i++){
    await gesture(i%2===1);
    if(i%20===0){await page.locator('#options').tap();await page.locator('#touch-mode-option').selectOption('buttons');await page.locator('#touch-mode-option').selectOption('direct');await page.locator('#close-options').tap();await page.locator('#start').tap();}
    if(i%40===0)await page.locator('#restart').tap();
  }};
  const sample=async()=>{await page.waitForTimeout(80);await cdp.send('HeapProfiler.collectGarbage');return {...await cdp.send('Memory.getDOMCounters'),heap:(await cdp.send('Runtime.getHeapUsage')).usedSize};};
  await cycles(20);report.memory=[await sample()];for(let batch=0;batch<3;batch++){await cycles(80);report.memory.push(await sample());}
  const first=report.memory[0],last=report.memory.at(-1);assert.ok(last.heap-first.heap<2*1024*1024);assert.ok(last.heap<16*1024*1024);assert.ok(Math.abs(last.nodes-first.nodes)<=12);assert.ok(Math.abs(last.jsEventListeners-first.jsEventListeners)<=2);
  await page.locator('#restart').tap();const r=await page.locator('#board').boundingBox(),c=r.width/10;
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:r.x+5*c,y:r.y+10*c,id:1}]});
  report.coalescing=await page.evaluate(async({left,top,c})=>{
    const board=document.querySelector('#board');let mutations=0;const observer=new MutationObserver(list=>mutations+=list.length);observer.observe(document.body,{subtree:true,childList:true,characterData:true,attributes:true});
    window.__boardReads=0;const before=window.__boardDraws;
    for(let frame=0;frame<60;frame++){
      await new Promise(resolve=>requestAnimationFrame(resolve));
      for(let i=0;i<6;i++)board.dispatchEvent(new PointerEvent('pointermove',{pointerId:window.__pointerId,pointerType:'touch',buttons:1,isPrimary:true,clientX:left+(2+(frame%6)*.8+i*.02)*c,clientY:top+10*c,bubbles:true}));
    }
    await new Promise(resolve=>requestAnimationFrame(resolve));observer.disconnect();return{events:360,frames:60,layoutReads:window.__boardReads,boardDraws:window.__boardDraws-before,domMutations:mutations};
  },{left:r.x,top:r.y,c});
  assert.equal(report.coalescing.layoutReads,0);assert.equal(report.coalescing.domMutations,0);assert.ok(report.coalescing.boardDraws<=65,JSON.stringify(report.coalescing));
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await page.locator('#pause').tap();await page.waitForTimeout(50);const idle=await page.evaluate(()=>window.__raf);await page.waitForTimeout(300);report.pausedRaf=await page.evaluate(before=>window.__raf-before,idle);assert.equal(report.pausedRaf,0);
  report.gestures=260;report.lifecycle='repeated direct taps, options/mode switches, pause/resume and restart';await mkdir('test-results',{recursive:true});await writeFile('test-results/direct-performance.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}finally{await browser.close();await local.close();}
