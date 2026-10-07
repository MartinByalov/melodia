import {styleScores} from './visual-styles.js';

export const DEFAULT_STYLES = ['synthwave', 'lofi', 'techno', 'jazz', 'rock'];
export const STYLE_LABELS = { all: 'All', synthwave: 'Synthwave', lofi: 'Lo-Fi', techno: 'Techno', electronic: 'Electronic', jazz: 'Jazz', rock: 'Rock', pop: 'Pop', classical: 'Classical', chill: 'Chill',ambient:'Ambient',blues:'Blues',metal:'Metal',house:'House',trance:'Trance',drumandbass:'Drum & Bass',hiphop:'Hip-Hop',reggae:'Reggae',soul:'Soul / Funk / R&B',latin:'Latin',country:'Country',folk:'Folk',talk:'Talk / News' };

export function favoriteStyles(stations, favoriteIds) {
  const counts = new Map(), seen = new Set();
  for (const station of stations) {
    if (!favoriteIds.has(station.id) || seen.has(station.id)) continue;
    seen.add(station.id);
    // Count every explicit style once per station, just like the Favorites filter.
    const scores=styleScores(station.tags);
    const styles=Object.keys(scores).filter(style=>scores[style]>0);
    for (const style of styles) counts.set(style, (counts.get(style) || 0) + 1);
  }
  if (!counts.size) return [...DEFAULT_STYLES];
  const preferred = [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([style]) => style);
  // Fill remaining slots from defaults, excluding styles already promoted.
  return [...new Set([...preferred, ...DEFAULT_STYLES])].slice(0, DEFAULT_STYLES.length);
}