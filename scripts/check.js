import {readdir} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const root=new URL('../',import.meta.url);
const files=['server.js'];
for(const directory of ['public','scripts','tools','tests']){
  for(const entry of await readdir(new URL(`${directory}/`,root),{withFileTypes:true})){
    if(entry.isFile()&&entry.name.endsWith('.js'))files.push(`${directory}/${entry.name}`);
  }
}
for(const file of files){
  const result=spawnSync(process.execPath,['--check',fileURLToPath(new URL(file,root))],{stdio:'inherit'});
  if(result.error)throw result.error;
  if(result.status!==0)process.exit(result.status||1);
}
console.log(`Syntax checked: ${files.length} JavaScript files.`);