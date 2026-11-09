// Offline artist placement: Jamendo coordinates first, then a GeoNames city lookup in the artist's country, then a point inside the border (seeded by artist id, so reruns are stable).
import { inflateRawSync } from 'node:zlib';

const strip = text => String(text ?? '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[’'`]/g, '').replace(/\s+/g, ' ').trim();

export function seededRandom(seed) {
  let state = 2166136261;
  for (const char of String(seed)) state = Math.imul(state ^ char.charCodeAt(0), 16777619) >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    state ^= state >>> 15;
    return (state >>> 0) / 4294967296;
  };
}

function inRing(lon, lat, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > lat) !== (yj > lat) && lon < (xj - xi) * (lat - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
function inPolygon(lon, lat, polygon) {
  if (!inRing(lon, lat, polygon[0])) return false;
  for (let i = 1; i < polygon.length; i++) if (inRing(lon, lat, polygon[i])) return false;
  return true;
}
function polygonsOf(geometry) {
  if (geometry.type === 'Polygon') return [geometry.coordinates];
  if (geometry.type === 'MultiPolygon') return geometry.coordinates;
  return [];
}
function boundsOf(polygon) {
  let west = 180, east = -180, south = 90, north = -90;
  for (const [lon, lat] of polygon[0]) { west = Math.min(west, lon); east = Math.max(east, lon); south = Math.min(south, lat); north = Math.max(north, lat); }
  return { west, east, south, north, area: Math.max(1e-6, (east - west) * (north - south)) };
}

// Builds ISO-3 -> border lookup from a Natural Earth style FeatureCollection.
export function buildBorders(geojson) {
  const borders = new Map();
  for (const feature of geojson.features) {
    const properties = feature.properties || {};
    const polygons = polygonsOf(feature.geometry).map(polygon => ({ polygon, bounds: boundsOf(polygon) }));
    if (!polygons.length) continue;
    for (const key of ['ADM0_A3', 'ISO_A3', 'ISO_A3_EH', 'SOV_A3']) {
      const code = properties[key];
      if (typeof code === 'string' && /^[A-Z]{3}$/.test(code) && !borders.has(code)) borders.set(code, polygons);
    }
  }
  return borders;
}

export function pointInCountry(polygons, random) {
  const total = polygons.reduce((sum, item) => sum + item.bounds.area, 0);
  for (let attempt = 0; attempt < 80; attempt++) {
    let pick = random() * total, item = polygons[0];
    for (const candidate of polygons) { pick -= candidate.bounds.area; if (pick <= 0) { item = candidate; break; } }
    const { west, east, south, north } = item.bounds;
    const lon = west + random() * (east - west), lat = south + random() * (north - south);
    if (inPolygon(lon, lat, item.polygon)) return { lat, lon };
  }
  const { west, east, south, north } = polygons[0].bounds;
  return { lat: (south + north) / 2, lon: (west + east) / 2 };
}

// places: [{name, alt:[...], cc, lat, lon, pop}] with cc as ISO-2.
export function createGeocoder({ places, iso3to2, borders }) {
  const byCity = new Map(), anchor = new Map();
  const add = (key, place) => { const list = byCity.get(key); if (list) list.push(place); else byCity.set(key, [place]); };
  for (const place of places) {
    for (const name of new Set([place.name, ...(place.alt || [])])) {
      const key = strip(name);
      if (key.length > 1) add(`${place.cc}|${key}`, place);
    }
    const best = anchor.get(place.cc);
    if (!best || place.pop > best.pop) anchor.set(place.cc, place);
  }
  const pickBest = list => list.reduce((best, item) => item.pop > best.pop ? item : best);

  function findCity(cc, rawCity) {
    const text = strip(rawCity);
    if (!text || text.length > 80) return null;
    const tokens = text.split(/\s*(?:,|\/|;|\||\(|\)|\s-\s|\s–\s)\s*/).filter(Boolean);
    for (const token of tokens) {
      for (const candidate of new Set([token, token.replace(/[\d.\s]+$/g, '').trim(), token.replace(/^\d+\s*/, '').trim()])) {
        const found = byCity.get(`${cc}|${candidate}`);
        if (found?.length) return pickBest(found);
      }
    }
    return null;
  }

  const crowd = new Map(); // places that already host artists spread them out a little
  return function place({ id, country, city, latitude, longitude }) {
    const random = seededRandom(id);
    const lat = latitude === null || latitude === '' || latitude === undefined ? NaN : Number(latitude);
    const lon = longitude === null || longitude === '' || longitude === undefined ? NaN : Number(longitude);
    const cc = iso3to2.get(country) || '';
    if (Number.isFinite(lat) && Number.isFinite(lon) && !(lat === 0 && lon === 0) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180) {
      return { lat, lon, level: 0, cc };
    }
    const found = cc ? findCity(cc, city) : null;
    if (found) {
      const key = `${found.cc}|${found.name}`, seen = crowd.get(key) || 0;
      crowd.set(key, seen + 1);
      const radius = Math.min(0.5, 0.04 + 0.018 * Math.sqrt(seen));
      const angle = random() * Math.PI * 2, distance = radius * Math.sqrt(random());
      return { lat: Math.max(-90, Math.min(90, found.lat + Math.sin(angle) * distance)), lon: found.lon + Math.cos(angle) * distance / Math.max(.2, Math.cos(found.lat * Math.PI / 180)), level: 1, cc, place: found.name };
    }
    const border = borders.get(country);
    if (border) return { ...pointInCountry(border, random), level: 2, cc };
    const fallback = cc && anchor.get(cc);
    if (fallback) return { lat: fallback.lat + (random() - .5) * .6, lon: fallback.lon + (random() - .5) * .6, level: 2, cc };
    return null;
  };
}

// Minimal ZIP reader (deflate or stored) so no archive tools are needed.
export function readZipEntry(buffer, wanted) {
  let end = buffer.length - 22;
  while (end >= 0 && buffer.readUInt32LE(end) !== 0x06054b50) end--;
  if (end < 0) throw new Error('Not a ZIP archive');
  let offset = buffer.readUInt32LE(end + 16);
  const count = buffer.readUInt16LE(end + 10);
  for (let i = 0; i < count; i++) {
    if (buffer.readUInt32LE(offset) !== 0x02014b50) throw new Error('Corrupt ZIP directory');
    const method = buffer.readUInt16LE(offset + 10), size = buffer.readUInt32LE(offset + 20);
    const nameLength = buffer.readUInt16LE(offset + 28), extraLength = buffer.readUInt16LE(offset + 30), commentLength = buffer.readUInt16LE(offset + 32);
    const localOffset = buffer.readUInt32LE(offset + 42), name = buffer.toString('utf8', offset + 46, offset + 46 + nameLength);
    if (name === wanted) {
      const dataStart = localOffset + 30 + buffer.readUInt16LE(localOffset + 26) + buffer.readUInt16LE(localOffset + 28);
      const data = buffer.subarray(dataStart, dataStart + size);
      if (method === 0) return data;
      if (method === 8) return inflateRawSync(data);
      throw new Error(`Unsupported ZIP method ${method}`);
    }
    offset += 46 + nameLength + extraLength + commentLength;
  }
  throw new Error(`${wanted} not found in archive`);
}

export function parseCities(text) {
  const places = [];
  for (const line of text.split('\n')) {
    if (!line) continue;
    const field = line.split('\t');
    const lat = Number(field[4]), lon = Number(field[5]);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    places.push({ name: field[1], alt: [field[2], ...field[3].split(',')].filter(Boolean), cc: field[8], lat, lon, pop: Number(field[14]) || 0 });
  }
  return places;
}

export function parseCountryInfo(text) {
  const iso3to2 = new Map(), names = new Map();
  for (const line of text.split('\n')) {
    if (!line || line[0] === '#') continue;
    const field = line.split('\t');
    if (field[0] && field[1]) { iso3to2.set(field[1], field[0]); names.set(field[0], field[4]); }
  }
  return { iso3to2, names };
}
