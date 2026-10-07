import { matchesStyle } from './visual-styles.js';

export function startupStation(stations,favoriteIds){
  const byId=new Map(stations.map(station=>[station.id,station]));
  for(const id of favoriteIds){const station=byId.get(id);if(station)return station;}
  return stations.find(station=>matchesStyle(station.tags,'lofi',true))??null;
}