import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {launchBrowser,serve,engineUrl} from './helpers.mjs';
const local=process.env.TEST_URL?null:await serve(),browser=await launchBrowser(),base=process.env.TEST_URL||local.url;
const errors=[];
try{
 const ctx=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:2});
 await ctx.addInitScript(()=>{localStorage.setItem('pocket-blocks-best','1234');localStorage.setItem('pocket-blocks-options',JSON.stringify({ghost:false,celebrations:true,touchMode:'buttons'}));window.__csp=[];document.addEventListener('securitypolicyviolation',e=>window.__csp.push(e.violatedDirective));});
 const page=await ctx.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto(base);await page.waitForFunction(()=>document.querySelector('#offline-status').textContent.includes('Ready to play offline'));
 assert.equal(await page.locator('#best').innerText(),'1,234');
 const viewport=await page.locator('meta[name=viewport]').getAttribute('content');for(const part of ['maximum-scale=1','minimum-scale=1','user-scalable=no','viewport-fit=cover'])assert.ok(viewport.includes(part));
 assert.equal(await page.locator('body').evaluate(n=>getComputedStyle(n).touchAction),'pan-x pan-y');assert.equal(await page.locator('[data-action=left]').evaluate(n=>getComputedStyle(n).touchAction),'none');
 for(const type of ['gesturestart','gesturechange'])assert.equal(await page.evaluate(type=>document.dispatchEvent(new Event(type,{cancelable:true,bubbles:true})),type),false);
 const metadata=await page.locator('link[rel=apple-touch-icon]').getAttribute('href');assert.equal(metadata,'./apple-touch-icon.png');
 await page.locator('#install').tap();assert.ok((await page.locator('#install-dialog').innerText()).includes('Open as Web App'));assert.ok((await page.locator('#install-dialog').innerText()).includes('Home Screen storage may be separate'));
 await page.locator('#close-install').tap();await page.locator('#start').tap();await page.locator('[data-action=drop]').tap();
 await page.locator('#options').tap();assert.equal(await page.locator('#ghost-option').isChecked(),false);await page.locator('#close-options').tap();
 assert.deepEqual(await page.evaluate(()=>window.__csp),[]);
 // Verify policy enforcement rather than only metadata presence.
 await page.evaluate(()=>{const script=document.createElement('script');script.textContent='window.__inlineExecuted=true';document.body.append(script);script.remove();});
 await page.waitForFunction(()=>window.__csp.includes('script-src-elem'));assert.equal(await page.evaluate(()=>window.__inlineExecuted),undefined);
 await ctx.setOffline(true);await page.reload();await page.locator('#start').tap();await page.locator('[data-action=drop]').tap();assert.ok(Number(await page.locator('#score').innerText())>0);
 await page.locator('#sound').tap();await page.locator('#help').tap();await page.locator('#close-help').tap();await page.locator('#options').tap();await page.locator('#close-options').tap();
 await page.locator('a[href="./privacy.html"]').click();assert.ok((await page.locator('body').innerText()).includes('IP addresses'));await page.locator('a[href="./"]').first().click();await page.locator('#start').waitFor();
 await page.close();const reopened=await ctx.newPage();await reopened.goto(base);await reopened.locator('#start').waitFor();assert.equal(await reopened.locator('#best').innerText(),'1,234');
 await reopened.setViewportSize({width:320,height:480});assert.ok(await reopened.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await reopened.locator('#help').click();
 assert.ok(await reopened.locator('#instructions').evaluate(n=>{n.scrollTop=n.scrollHeight;return n.scrollTop>0;}));await reopened.keyboard.press('Escape');
 await reopened.setViewportSize({width:844,height:390});assert.ok(await reopened.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await mkdir('test-results',{recursive:true});await reopened.screenshot({path:'test-results/pwa-landscape.png',fullPage:true});await ctx.close();
 const invalid=await browser.newContext();await invalid.addInitScript(()=>{localStorage.setItem('pocket-blocks-best','Infinity');localStorage.setItem('pocket-blocks-options','{"ghost":"yes","celebrations":null}');});const bad=await invalid.newPage();await bad.goto(base);assert.equal(await bad.locator('#best').innerText(),'0');await bad.locator('#options').click();assert.equal(await bad.locator('#ghost-option').isChecked(),true);assert.equal(await bad.locator('#celebrations-option').isChecked(),true);await invalid.close();
 assert.deepEqual(errors,[]);console.log('PWA/zoom/security checks passed: cached install/help/options/privacy/audio, tab reopen, saved preferences, viewport/gestures/scrollable dialogs, icons, CSP enforcement, malformed storage, narrow and landscape layouts. Physical iOS Home Screen testing remains unverified.');
}finally{await browser.close();await local?.close();}
