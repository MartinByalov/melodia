import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir,stat} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {once} from 'node:events';

const root=new URL('../',import.meta.url),publicRoot=new URL('public/',root);
async function walk(directory){
  const result=[];
  for(const entry of await readdir(directory,{withFileTypes:true})){
    const file=new URL(entry.name+(entry.isDirectory()?'/':''),directory);
    if(entry.isDirectory())result.push(...await walk(file));else result.push(file);
  }
  return result;
}

test('Pages publishes only public with no development or secret files',async()=>{
  const workflow=await readFile(new URL('.github/workflows/pages.yml',root),'utf8');
  assert.match(workflow,/path: public/);
  for(const file of await walk(publicRoot)){
    const name=file.href.slice(publicRoot.href.length);
    assert.doesNotMatch(name,/(^|\/)(tests|tools|scripts|node_modules|\.env[^/]*|server\.js|package\.json|README\.md)(\/|$)|\.log$|browser-profile|preview.*\.png$/);
  }
  await stat(new URL('index.html',publicRoot));
  await stat(new URL('.nojekyll',publicRoot));
});

test('static local modules, workers, assets and HTML references resolve inside public',async()=>{
  for(const file of await walk(publicRoot)){
    if(!/\.(js|mjs|html|css)$/.test(file.pathname))continue;
    const source=await readFile(file,'utf8'),references=[];
    for(const match of source.matchAll(/(?:\bfrom\s*|\bimport\s*\(|\bnew URL\s*\(|\bfetch\s*\()\s*['"]([^'"]+)['"]/g))references.push(match[1]);
    if(file.pathname.endsWith('.html')){
      for(const match of source.matchAll(/(?:src|href)="([^"#]+)"/g))references.push(match[1]);
      for(const match of source.matchAll(/"three":"([^"]+)"/g))references.push(match[1]);
    }
    for(const reference of references){
      if(/^(?:https?:|data:|blob:)/.test(reference)||reference==='three')continue;
      if(!reference.startsWith('.')&&!reference.startsWith('/')&&!/\.(?:js|mjs|css|svg|png|json|geojson|txt|md|html)$/.test(reference))continue;
      assert.ok(!reference.startsWith('/'),`Root-absolute path breaks project Pages: ${reference}`);
      if(reference.endsWith('/'))continue;
      const target=new URL(reference,file);
      assert.ok(target.href.startsWith(publicRoot.href),`Reference escapes public: ${reference}`);
      assert.ok((await stat(target)).isFile(),`Missing ${reference} in ${file.pathname}`);
    }
  }
});

test('server serves the site but never exposes repository files or tools by default',async()=>{
  const child=spawn(process.execPath,['server.js'],{cwd:root,env:{...process.env,PORT:'0',DEV_TOOLS:'0'},stdio:['ignore','pipe','pipe']});
  try{
    let output='';
    const base=await new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>reject(new Error('Server startup timeout')),10000);
      child.once('error',error=>{clearTimeout(timer);reject(error);});
      child.once('exit',code=>{clearTimeout(timer);reject(new Error(`Server exited: ${code}`));});
      child.stdout.on('data',chunk=>{
        output+=chunk.toString();const match=output.match(/http:\/\/localhost:(\d+)/);
        if(match){clearTimeout(timer);resolve(`http://127.0.0.1:${match[1]}`);}
      });
    });
    for(const resource of ['/','/app.js','/map-worker.js','/vendor/hls.mjs','/assets/favicon.svg']){
      const response=await fetch(base+resource);assert.equal(response.status,200,resource);
      await response.arrayBuffer();
    }
    for(const resource of ['/server.js','/package.json','/README.md','/tests/pages.test.js','/tools/performance-scene.html','/.env','/.github/workflows/pages.yml']){
      const response=await fetch(base+resource);assert.ok([403,404].includes(response.status),resource);
      await response.arrayBuffer();
    }
  }finally{
    if(child.exitCode===null){const closed=once(child,'exit');child.kill();await closed;}
  }
});