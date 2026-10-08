import {readFile,writeFile,rename,rm} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {normalizeStation} from '../public/radio.js';

const fields=['stationuuid','homepage','name','country','countrycode','state','tags','geo_lat','geo_long','url_resolved','url','clickcount','bitrate','codec','hls','lastcheckok'];
export function compactStation(raw){
  const record=Object.fromEntries(fields.filter(key=>raw[key]!==undefined&&raw[key]!==null&&raw[key]!=='').map(key=>[key,raw[key]]));
  if(record.url===record.url_resolved)delete record.url;
  for(const key of ['clickcount','bitrate','hls'])if(Number(record[key])===0)delete record[key];
  return record;
}

export async function compactCatalogue(path=new URL('../public/assets/stations.json',import.meta.url)){
  const original=await readFile(path,'utf8'),rows=JSON.parse(original);
  if(!Array.isArray(rows)||!rows.length)throw new Error('Invalid catalogue');
  const compact=rows.map(raw=>{
    const record=compactStation(raw);
    for(const allowHLS of [false,true]){
      if(JSON.stringify(normalizeStation(raw,false,allowHLS))!==JSON.stringify(normalizeStation(record,false,allowHLS)))throw new Error(`Compaction changed station ${raw.stationuuid}`);
    }
    return record;
  });
  const output=JSON.stringify(compact),temporary=`${path instanceof URL?fileURLToPath(path):path}.${process.pid}.tmp`;
  try{await writeFile(temporary,output,{flag:'wx'});await rename(temporary,path);}
  finally{await rm(temporary,{force:true});}
  return {stations:rows.length,beforeBytes:Buffer.byteLength(original),afterBytes:Buffer.byteLength(output)};
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{console.log(await compactCatalogue());}catch(error){console.error(error.message);process.exitCode=1;}
}