import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {launchBrowser,serve} from './helpers.mjs';
const local=await serve(),browser=await launchBrowser({args:['--js-flags=--expose-gc']}),report={date:new Date().toISOString(),engine:'Chromium'};
try{
 const ctx=await browser.newContext({viewport:{width:1280,height:900}});await ctx.addInitScript(()=>{
  Math.random=()=>0;window.confirm=()=>true;window.__raf=0;window.__boardReads=0;window.__nextReads=0;window.__boardDraws=0;window.__nextDraws=0;
  const raf=window.requestAnimationFrame;window.requestAnimationFrame=callback=>raf.call(window,time=>{window.__raf++;callback(time);});
  const rect=HTMLCanvasElement.prototype.getBoundingClientRect;HTMLCanvasElement.prototype.getBoundingClientRect=function(...args){if(this.id==='board')window.__boardReads++;if(this.id==='next')window.__nextReads++;return rect.apply(this,args);};
  const clear=CanvasRenderingContext2D.prototype.clearRect;CanvasRenderingContext2D.prototype.clearRect=function(...args){if(this.canvas.id==='board')window.__boardDraws++;if(this.canvas.id==='next')window.__nextDraws++;return clear.apply(this,args);};
 });
 const page=await ctx.newPage();await page.goto(local.url);await page.waitForTimeout(150);const cdp=await ctx.newCDPSession(page);await cdp.send('Performance.enable');await cdp.send('WebAudio.enable');let created=0,destroyed=0,contexts=0;cdp.on('WebAudio.audioNodeCreated',()=>created++);cdp.on('WebAudio.audioNodeWillBeDestroyed',()=>destroyed++);cdp.on('WebAudio.contextCreated',()=>contexts++);
 const counts=()=>page.evaluate(()=>({raf:window.__raf,boardReads:window.__boardReads,nextReads:window.__nextReads,boardDraws:window.__boardDraws,nextDraws:window.__nextDraws}));
 const measure=async()=>{const before=await counts();await page.waitForTimeout(1200);const after=await counts();return Object.fromEntries(Object.keys(before).map(k=>[k,after[k]-before[k]]));};
 report.ready=await measure();assert.equal(report.ready.raf,0);assert.equal(report.ready.boardDraws,0);
 await page.locator('#start').click();report.playing=await measure();assert.ok(report.playing.raf>10&&report.playing.raf<105);assert.equal(report.playing.boardReads,0);assert.equal(report.playing.nextReads,0);assert.equal(report.playing.nextDraws,0);
 await page.locator('#pause').click();report.paused=await measure();assert.equal(report.paused.raf,0);
 // Repeated pause/resume must leave one loop, not multiply it.
 await page.evaluate(()=>{for(let i=0;i<10;i++){document.querySelector('#pause').click();document.querySelector('#pause').click();}document.querySelector('#start').click();});report.afterLifecycle=await measure();assert.ok(report.afterLifecycle.raf>10&&report.afterLifecycle.raf<105);
 const cycles=count=>page.evaluate(async count=>{for(let n=0;n<count;n++){document.querySelector('#restart').click();for(let move=0;move<4;move++)document.querySelector('[data-action=drop]').click();if(n%10===0){document.querySelector('#options').click();document.querySelector('#close-options').click();document.querySelector('#start').click();await new Promise(r=>setTimeout(r,0));}}},count);
 const sample=async()=>{await page.waitForTimeout(150);await cdp.send('HeapProfiler.collectGarbage');return {...await cdp.send('Memory.getDOMCounters'),heap:(await cdp.send('Runtime.getHeapUsage')).usedSize};};
 await cycles(30);report.memory=[await sample()];for(let n=0;n<3;n++){await cycles(100);report.memory.push(await sample());}
 const first=report.memory[0],last=report.memory.at(-1);assert.ok(last.heap-first.heap<2*1024*1024);assert.ok(last.heap<16*1024*1024);assert.ok(Math.abs(last.nodes-first.nodes)<=12);assert.ok(Math.abs(last.jsEventListeners-first.jsEventListeners)<=2);
 await page.locator('#restart').click();await page.locator('#sound').click();await page.evaluate(()=>{for(let i=0;i<300;i++)document.querySelector('[data-action=cw]').click();});await page.waitForTimeout(500);await cdp.send('HeapProfiler.collectGarbage');report.audio={created,destroyed,contexts,remaining:created-destroyed};assert.equal(contexts,1);assert.ok(created-destroyed<=3);
 await page.locator('#pause').click();const before=(await cdp.send('Performance.getMetrics')).metrics;await page.waitForTimeout(1200);const after=(await cdp.send('Performance.getMetrics')).metrics;const value=(list,key)=>list.find(m=>m.name===key)?.value||0;report.idleTaskMs=(value(after,'TaskDuration')-value(before,'TaskDuration'))*1000;report.placements=1320;
 await mkdir('test-results',{recursive:true});await writeFile('test-results/performance.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}finally{await browser.close();await local.close();}
