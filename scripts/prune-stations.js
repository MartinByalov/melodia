import {readFile,writeFile} from 'node:fs/promises';
import {stationExcluded} from '../public/station-exclusions.js';

const path=new URL('../public/assets/stations.json',import.meta.url);
const stations=JSON.parse(await readFile(path,'utf8'));
if(!Array.isArray(stations))throw new Error('Invalid bundled station directory');
const remaining=stations.filter(station=>!stationExcluded(station));
const removed=stations.length-remaining.length;
if(removed)await writeFile(path,JSON.stringify(remaining));
console.log(`Removed ${removed} excluded station${removed===1?'':'s'} from the published snapshot.`);