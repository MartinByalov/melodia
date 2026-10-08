import {readFile,writeFile,rename,rm,mkdir} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {normalizeStation,SERVERS} from '../public/radio.js';
import {stationExcluded} from '../public/station-exclusions.js';
import {compactStation} from './compact-stations.js';

const root=fileURLToPath(new URL('../',import.meta.url));

export async function collectStations(request,{pageSize=5000,maxPages=100}={}){
  if(!Number.isInteger(pageSize)||pageSize<1||!Number.isInteger(maxPages)||maxPages<1)throw new Error('Invalid pagination settings');
  const seen=new Set(),stations=[];
  const counts={received:0,duplicates:0,excluded:0,invalid:0,unhealthy:0,accepted:0,withCoordinates:0};
  for(let page=0;page<maxPages;page++){
    const rows=await request(`stations/search?hidebroken=true&order=name&limit=${pageSize}&offset=${page*pageSize}`);
    if(!Array.isArray(rows)||rows.length>pageSize)throw new Error('Invalid catalogue response');
    let added=0;
    for(const raw of rows){
      counts.received++;
      if(!raw||typeof raw!=='object'||Array.isArray(raw)||typeof raw.stationuuid!=='string'||!raw.stationuuid.trim())throw new Error('Malformed station record');
      if(seen.has(raw.stationuuid)){counts.duplicates++;continue;}
      seen.add(raw.stationuuid);added++;
      if(stationExcluded(raw)){counts.excluded++;continue;}
      if(Number(raw.lastcheckok)!==1){counts.unhealthy++;continue;}
      if(typeof raw.name!=='string'||(raw.tags!=null&&typeof raw.tags!=='string'))throw new Error('Malformed station fields');
      const station=normalizeStation(raw,false,true);
      if(!station){counts.invalid++;continue;}
      const record=compactStation(raw);
      stations.push(record);counts.accepted++;
      if(station.lat!==null&&station.lon!==null)counts.withCoordinates++;
    }
    if(rows.length&& !added)throw new Error('Catalogue pagination did not advance');
    if(rows.length<pageSize){
      stations.sort((a,b)=>(Number(b.clickcount)||0)-(Number(a.clickcount)||0)||a.stationuuid.localeCompare(b.stationuuid));
      return {stations,counts,pages:page+1};
    }
  }
  throw new Error('Catalogue exceeded pagination safety limit');
}

export async function downloadStations(fetchImpl=fetch){
  const failures=[];
  for(const server of SERVERS){
    try{
      // Restart the entire scan on failover; never mix offsets from different mirrors.
      const result=await collectStations(async path=>{
        const response=await fetchImpl(`${server}/json/${path}`,{signal:AbortSignal.timeout(30000),headers:{'User-Agent':'Melodia catalogue updater/1.0','Accept':'application/json'}});
        if(!response.ok)throw new Error(`HTTP ${response.status}`);
        return response.json();
      });
      return {...result,source:server};
    }catch(error){failures.push(`${server}: ${error.message}`);}
  }
  throw new Error(`All catalogue mirrors failed: ${failures.join('; ')}`);
}

export async function updateStations({cataloguePath=resolve(root,'public/assets/stations.json'),reportPath=resolve(root,'reports/stations-update.json'),dryRun=false,download=downloadStations}={}){
  const report={startedAt:new Date().toISOString(),status:'failed',dryRun};
  const temporary=`${cataloguePath}.${process.pid}.tmp`;
  try{
    const previous=JSON.parse(await readFile(cataloguePath,'utf8'));
    if(!Array.isArray(previous)||!previous.length)throw new Error('Invalid previous catalogue');
    report.previousCount=previous.length;
    const result=await download();
    Object.assign(report,{source:result.source,pages:result.pages,counts:result.counts});
    const {stations}=result;
    if(!Array.isArray(stations)||!stations.length)throw new Error('Refusing to publish an empty catalogue');
    if(stations.length<previous.length*.8)throw new Error('Catalogue shrank by more than 20%; review before publishing');
    const oldIds=new Set(previous.map(s=>s.stationuuid)),newIds=new Set(stations.map(s=>s.stationuuid));
    report.added=stations.filter(s=>!oldIds.has(s.stationuuid)).length;
    report.removed=previous.filter(s=>!newIds.has(s.stationuuid)).length;
    report.status=dryRun?'validated':'ready';
    report.finishedAt=new Date().toISOString();
    // A writable report is required before replacing the catalogue.
    await mkdir(dirname(reportPath),{recursive:true});
    await writeFile(reportPath,JSON.stringify(report,null,2)+'\n');
    if(!dryRun){
      await writeFile(temporary,JSON.stringify(stations),{flag:'wx'});
      await rename(temporary,cataloguePath);
    }
    return report;
  }catch(error){
    report.status='failed';report.error=error.message;report.finishedAt=new Date().toISOString();
    await mkdir(dirname(reportPath),{recursive:true});
    await writeFile(reportPath,JSON.stringify(report,null,2)+'\n');
    throw error;
  }finally{await rm(temporary,{force:true});}
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const args=process.argv.slice(2);
  if(args.some(arg=>arg!=='--dry-run')){console.error('Usage: npm run update:stations -- [--dry-run]');process.exitCode=1;}
  else try{console.log(JSON.stringify(await updateStations({dryRun:args.includes('--dry-run')}),null,2));}
  catch(error){console.error(error.message);process.exitCode=1;}
}