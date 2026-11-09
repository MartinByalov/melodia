// Favorites are songs: each entry is {a: artist id, t: track id, n: title}. Everything here is pure so it can be tested without a browser.
export const FAVORITES_KEY = 'melodia-favorites';
export const MAX_FAVORITES = 2000;
// Longer lists still work as a file, but links and QR codes would be too long to share reliably.
export const LINK_LIMIT = 180;
export const QR_LIMIT = 70;
const ID = /^\d{1,10}$/;

export function normalizeFavorite(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const a = String(raw.a ?? raw.artist ?? ''), t = String(raw.t ?? raw.track ?? '');
  if (!ID.test(a) || !ID.test(t)) return null;
  return { a, t, n: String(raw.n ?? raw.title ?? '').replace(/\s+/g, ' ').trim().slice(0, 120) };
}

export function normalizeFavorites(list) {
  const seen = new Set(), result = [];
  for (const raw of Array.isArray(list) ? list : []) {
    const favorite = normalizeFavorite(raw);
    if (!favorite || seen.has(favorite.t)) continue;
    seen.add(favorite.t); result.push(favorite);
    if (result.length >= MAX_FAVORITES) break;
  }
  return result;
}

export function loadFavorites(storage) {
  try { return normalizeFavorites(JSON.parse(storage.getItem(FAVORITES_KEY) || '[]')); } catch { return []; }
}
export function saveFavorites(storage, list) { storage.setItem(FAVORITES_KEY, JSON.stringify(list)); }

export const hasFavorite = (list, trackId) => list.some(favorite => favorite.t === String(trackId));
export const removeFavorite = (list, trackId) => list.filter(favorite => favorite.t !== String(trackId));
export function toggleFavorite(list, favorite) {
  const entry = normalizeFavorite(favorite);
  if (!entry) return { list, added: false };
  if (hasFavorite(list, entry.t)) return { list: removeFavorite(list, entry.t), added: false };
  return { list: [...list, entry].slice(-MAX_FAVORITES), added: true };
}
// New songs are appended and a known song keeps its place, but gains a title if it had none.
export function mergeFavorites(current, incoming) {
  const list = current.map(favorite => ({ ...favorite })), index = new Map(list.map((favorite, i) => [favorite.t, i]));
  let added = 0;
  for (const raw of normalizeFavorites(incoming)) {
    if (index.has(raw.t)) { const known = list[index.get(raw.t)]; if (!known.n && raw.n) known.n = raw.n; continue; }
    if (list.length >= MAX_FAVORITES) break;
    index.set(raw.t, list.length); list.push(raw); added++;
  }
  return { list, added };
}
// Distinct artists in the order they were first favorited; this drives the header styles.
export const favoriteArtistIds = list => new Set(list.map(favorite => favorite.a));

// ---- link and QR payload: "artist-track" pairs in base 36, joined by dots ----
export function encodeFavoritesLink(base, list) {
  const url = new URL(base);
  url.search = ''; url.hash = '';
  url.searchParams.set('f', list.map(favorite => `${Number(favorite.a).toString(36)}-${Number(favorite.t).toString(36)}`).join('.'));
  return url.href;
}
export function decodeFavoritesPayload(payload) {
  const result = [];
  for (const pair of String(payload ?? '').split('.').slice(0, MAX_FAVORITES)) {
    const [a, t, extra] = pair.split('-');
    if (extra !== undefined || !/^[0-9a-z]{1,8}$/.test(a || '') || !/^[0-9a-z]{1,8}$/.test(t || '')) continue;
    result.push({ a: String(parseInt(a, 36)), t: String(parseInt(t, 36)), n: '' });
  }
  return normalizeFavorites(result);
}

// ---- file export and import ----
export function favoritesToFile(list, artistName = () => '', date = new Date()) {
  return JSON.stringify({
    app: 'melodia', version: 1, exported: date.toISOString().slice(0, 10),
    favorites: list.map(favorite => ({ artist: Number(favorite.a), artistName: artistName(favorite.a) || undefined, track: Number(favorite.t), title: favorite.n, link: `https://www.jamendo.com/track/${favorite.t}` }))
  }, null, 2);
}
export function favoritesFromFile(text) {
  let data;
  try { data = JSON.parse(text); } catch { throw new Error('This file is not a Melodia favorites file.'); }
  if (!data || data.app !== 'melodia' || !Array.isArray(data.favorites)) throw new Error('This file is not a Melodia favorites file.');
  return normalizeFavorites(data.favorites);
}
