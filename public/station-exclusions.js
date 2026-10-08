// Reviewed removals. Add the station UUID here before publishing a takedown.
// Block hosts only when ALL streams on that host must be excluded.
export const excludedStationIds = new Set([]);
export const excludedStreamHosts = new Set([]);

export function stationExcluded(station) {
  if (excludedStationIds.has(station?.stationuuid ?? station?.id)) return true;
  for (const address of [station?.url_resolved, station?.url]) {
    if (!address) continue;
    try {
      const host = new URL(address).hostname.toLowerCase();
      if ([...excludedStreamHosts].some(blocked => {
        const domain=blocked.toLowerCase();
        return host === domain || host.endsWith(`.${domain}`);
      })) return true;
    } catch { /* Invalid stream addresses are rejected by normalizeStation. */ }
  }
  return false;
}