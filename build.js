import {mkdir, readFile, writeFile, rm, readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
const hash=value=>createHash('sha256').update(value).digest('hex');
export async function build({root=fileURLToPath(new URL('./',import.meta.url)),out=resolve(root,'dist')}={}) {
 const modules=(await readdir(root)).filter(file=>file.endsWith('.js')&&!['build.js','sw.js'].includes(file)).sort();
 const inputs=['index.html','privacy.html','style.css',...modules,'favicon.svg','manifest.webmanifest','sw.js','apple-touch-icon.png','icon-192.png','icon-512.png','icon-maskable.png','.nojekyll'];
 const source=new Map(await Promise.all(inputs.map(async file=>[file,await readFile(resolve(root,file))])));
 const release=hash(Buffer.concat([await readFile(new URL(import.meta.url)),...inputs.flatMap(file=>[Buffer.from(`${file}\0`),source.get(file),Buffer.from('\0')])]));
 const output=new Map(),names={},compiling=new Set();
 function compile(file){
  if(names[file])return names[file];if(compiling.has(file))throw new Error(`Circular production module dependency: ${file}`);if(!modules.includes(file))throw new Error(`Unknown production module: ${file}`);
  compiling.add(file);let text=source.get(file).toString();
  const imports=[...text.matchAll(/(?:from\s*|import\s*\(\s*|import\s*)(['"])([^'"]+)\1/g)].map(match=>match[2]);
  for(const specifier of imports){if(!specifier.startsWith('./')||specifier.slice(2).includes('/')||!specifier.endsWith('.js'))throw new Error(`Only local root runtime modules are allowed: ${specifier}`);const dependency=specifier.slice(2);text=text.replaceAll(specifier,`./${compile(dependency)}`);}
  const name=file.replace(/\.js$/,`.${hash(text).slice(0,16)}.js`);names[file]=name;output.set(name,Buffer.from(text));compiling.delete(file);return name;
 }
 for(const file of modules)compile(file);
 names['style.css']=`style.${hash(source.get('style.css')).slice(0,16)}.css`;output.set(names['style.css'],source.get('style.css'));
 for(const file of inputs.filter(file=>!['sw.js','style.css',...modules].includes(file))){let bytes=source.get(file);if(file.endsWith('.html')){let html=bytes.toString();for(const name of ['app.js','style.css'])html=html.replaceAll(`./${name}`,`./${names[name]}`);bytes=Buffer.from(html);}output.set(file,bytes);}
 const manifest=[...output].filter(([name])=>name!=='.nojekyll').map(([url,bytes])=>({url,sha256:hash(bytes)})).sort((a,b)=>a.url.localeCompare(b.url));
 output.set('sw.js',Buffer.from(source.get('sw.js').toString().replace('__RELEASE_ID__',release).replace('/*__PRECACHE__*/[]',JSON.stringify(manifest))));
 await rm(out,{recursive:true,force:true});await mkdir(out,{recursive:true});await Promise.all([...output].map(([file,bytes])=>writeFile(resolve(out,file),bytes)));return {release,manifest,names,out};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))await build();
