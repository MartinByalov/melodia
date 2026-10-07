// Preserve OSM member geometry without inventing connections between separate ways.
export function boundaryLines(data) {
  const lines = [], seen = new Set();
  for (const element of data.elements || []) {
    const members = element.type === 'relation' ? element.members || [] : [element];
    for (const member of members) {
      if (member.role && !['outer', 'inner'].includes(member.role)) continue;
      if (!Array.isArray(member.geometry)) continue;
      const key = `${member.type}:${member.ref ?? member.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      let line = [];
      for (const point of member.geometry) {
        if (point && Number.isFinite(point.lat) && Number.isFinite(point.lon)) line.push([point.lon, point.lat]);
        else { if (line.length > 1) lines.push(line); line = []; }
      }
      if (line.length > 1) lines.push(line);
    }
  }
  return lines;
}

export async function fetchCityBoundaries(lat, lon, signal) {
  const box = [Math.max(-90, lat - .2), Math.max(-180, lon - .2), Math.min(90, lat + .2), Math.min(180, lon + .2)].join(',');
  // Municipal boundaries and explicitly tagged city/town areas. No guessed polygons.
  const query = `[out:json][timeout:20];(relation["boundary"="administrative"]["admin_level"="8"](${box});relation["place"~"^(city|town)$"](${box});way["place"~"^(city|town)$"](${box}););out geom(${box});`;
  const response = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST', headers: { Accept: 'application/json' }, body: new URLSearchParams({ data: query }), signal
  });
  if (!response.ok) throw new Error(`City boundaries: HTTP ${response.status}`);
  const data = await response.json();
  if (data.remark) throw new Error(data.remark);
  return boundaryLines(data);
}