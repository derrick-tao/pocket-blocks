import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,readdir,copyFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {build} from '../build.js';
const source=new URL('../',import.meta.url);
export async function fixture(){const root=await mkdtemp(join(tmpdir(),'confetti-build-'));for(const entry of await readdir(source,{withFileTypes:true}))if(entry.isFile())await copyFile(new URL(entry.name,source),join(root,entry.name));return root;}
const snapshot=async directory=>Promise.all((await readdir(directory)).sort().map(async name=>[name,createHash('sha256').update(await readFile(join(directory,name))).digest('hex')]));
test('build is deterministic, source-preserving, integrity-verified and content-addressed',async()=>{
 const root=await fixture();try{
  const original=await readFile(join(root,'app.js')),one=await build({root}),files=await snapshot(one.out),two=await build({root});
  assert.equal(one.release,two.release);assert.deepEqual(await snapshot(two.out),files);assert.deepEqual(await readFile(join(root,'app.js')),original);
  const html=await readFile(join(two.out,'index.html'),'utf8'),app=await readFile(join(two.out,two.names['app.js']),'utf8');
  assert.ok(html.includes(two.names['app.js'])&&html.includes(two.names['style.css']));assert.ok(app.includes(two.names['engine.js'])&&app.includes(two.names['offline.js']));
  assert.ok(!two.manifest.some(e=>e.url==='./'));assert.ok(two.manifest.some(e=>e.url==='privacy.html'));
  for(const entry of two.manifest)assert.equal(createHash('sha256').update(await readFile(join(two.out,entry.url))).digest('hex'),entry.sha256);
  const worker=await readFile(join(two.out,'sw.js'),'utf8');assert.ok(worker.includes(two.release));assert.ok(!worker.includes('__RELEASE_ID__'));
  assert.ok(!(await readdir(two.out)).some(name=>['app.js','engine.js','offline.js','style.css','package.json'].includes(name)));
 }finally{await rm(root,{recursive:true,force:true});}
});
test('script, worker, privacy, and icon-only changes each generate a new release',async()=>{
 const root=await fixture();try{
  let previous=await build({root});
  for(const file of ['app.js','sw.js','privacy.html','icon-192.png']){
   await writeFile(join(root,file),Buffer.concat([await readFile(join(root,file)),Buffer.from('\n')]));const next=await build({root});assert.notEqual(next.release,previous.release,file);previous=next;
  }
  const oldApp=previous.names['app.js'];await writeFile(join(root,'engine.js'),Buffer.concat([await readFile(join(root,'engine.js')),Buffer.from('\n// dependency change\n')]));
  assert.notEqual((await build({root})).names['app.js'],oldApp,'module dependency invalidates importer filename');
 }finally{await rm(root,{recursive:true,force:true});}
});
test('production budget and restrictive policies',async()=>{
 const release=await build();let bytes=0;for(const entry of release.manifest)if(!entry.url.endsWith('.png'))bytes+=(await readFile(join(release.out,entry.url))).length;
 bytes+=(await readFile(join(release.out,'sw.js'))).length;assert.ok(bytes<150000,`${bytes} exceeds production budget`);
 for(const file of ['index.html','privacy.html']){const html=await readFile(join(release.out,file),'utf8');assert.ok(html.includes('Content-Security-Policy'));assert.ok(html.includes("script-src 'self'"));assert.ok(!html.includes('unsafe-inline'));assert.ok(html.includes('name="referrer" content="no-referrer"'));}
});

test('opaque correctly sized install icons, iOS metadata, and standalone manifest',async()=>{
 const release=await build();for(const [file,size]of [['apple-touch-icon.png',180],['icon-192.png',192],['icon-512.png',512],['icon-maskable.png',512]]){const png=await readFile(join(release.out,file));assert.equal(png.subarray(1,4).toString(),'PNG');assert.equal(png.readUInt32BE(16),size);assert.equal(png.readUInt32BE(20),size);assert.equal(png[25],2,'RGB PNG is opaque');}
 const html=await readFile(join(release.out,'index.html'),'utf8'),manifest=JSON.parse(await readFile(join(release.out,'manifest.webmanifest'),'utf8'));assert.ok(html.includes('apple-touch-icon.png'));assert.ok(html.includes('maximum-scale=1'));assert.ok(html.includes('user-scalable=no'));assert.ok(html.includes('apple-mobile-web-app-capable'));assert.equal(manifest.display,'standalone');for(const key of ['id','start_url','scope'])assert.equal(manifest[key],'./');assert.equal(manifest.icons.length,3);
});
test('additional root runtime modules are fingerprinted transitively and external imports are rejected',async()=>{
 const root=await fixture();try{
  const app=await readFile(join(root,'app.js'),'utf8');await writeFile(join(root,'controls.js'),'export const controls = true;\n');await writeFile(join(root,'app.js'),app+"\nimport {controls} from './controls.js';\n");
  const one=await build({root});assert.ok(one.names['controls.js']);assert.ok((await readFile(join(one.out,one.names['app.js']),'utf8')).includes(one.names['controls.js']));
  await writeFile(join(root,'controls.js'),'export const controls = false;\n');const two=await build({root});assert.notEqual(one.names['app.js'],two.names['app.js']);assert.notEqual(one.release,two.release);
  await writeFile(join(root,'controls.js'),"import 'https://example.com/runtime.js';\n");await assert.rejects(()=>build({root}),/Only local root runtime modules/);
 }finally{await rm(root,{recursive:true,force:true});}
});
