import { LINK_LIMIT, QR_LIMIT, encodeFavoritesLink, favoritesFromFile, favoritesToFile, mergeFavorites } from './favorites.js';
import { renderQr } from './qr.js';
import { shareBase } from './site.js';

// The "Save your favorites" dialog: download, link, QR code and import. Nothing leaves the browser except the Jamendo lookups for titles.
export function setupFavoritesDialog({ getFavorites, setFavorites, artistName, resolve, openDialog }) {
  const $ = selector => document.querySelector(selector);
  const dialog = $('#favorites-dialog'), status = $('#favorites-status'), incoming = $('#favorites-incoming');
  let pending = null;

  const say = text => { status.textContent = text; };
  const plural = (count, word) => `${count.toLocaleString('en-US')} ${word}${count === 1 ? '' : 's'}`;
  const baseUrl = () => shareBase();

  function refresh() {
    const list = getFavorites(), count = list.length;
    $('#favorites-download').disabled = !count;
    $('#favorites-copy').disabled = !count || count > LINK_LIMIT;
    const qr = $('#favorites-qr'), note = $('#favorites-qr-note');
    qr.hidden = true; qr.replaceChildren();
    if (!count) { note.textContent = 'You have no favorite songs yet. Press the heart while a song plays, then come back here.'; }
    else if (count > QR_LIMIT) { note.textContent = `A QR code holds up to ${QR_LIMIT} songs${count > LINK_LIMIT ? ', and a link up to ' + LINK_LIMIT : ''}. Use the file for longer lists.`; }
    else {
      try { renderQr(qr, encodeFavoritesLink(baseUrl(), list), 'QR code with your favorite songs'); qr.hidden = false; note.textContent = 'Scan with your phone camera to open your favorites on that device.'; }
      catch { note.textContent = 'The QR code could not be created. Use the file or the link.'; }
    }
    incoming.hidden = !pending;
    if (pending) $('#favorites-incoming-text').textContent = `This link has ${plural(pending.length, 'song')}. Add them to your favorites?`;
  }

  async function addSongs(items) {
    say('Adding songs…');
    const needTitle = items.filter(item => !item.n).map(item => item.t);
    let found = new Map();
    if (needTitle.length) { try { found = await resolve(needTitle); } catch { say('Jamendo could not be reached, so songs without a title were skipped.'); } }
    const completed = items.map(item => { const hit = found.get(item.t); return { a: hit ? hit.artistId : item.a, t: item.t, n: item.n || hit?.track.title || '' }; }).filter(item => item.n);
    const { list, added } = mergeFavorites(getFavorites(), completed);
    setFavorites(list);
    say(added ? `Added ${plural(added, 'song')}. You now have ${plural(list.length, 'favorite song')}.` : 'Nothing new to add. Those songs are already in your favorites.');
    refresh();
  }

  $('#favorites-download').addEventListener('click', () => {
    const list = getFavorites();
    if (!list.length) return;
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([favoritesToFile(list, artistName)], { type: 'application/json' }));
    link.download = 'melodia-favorites.json';
    document.body.append(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(link.href), 4000);
    say('The file was downloaded.');
  });
  $('#favorites-copy').addEventListener('click', async () => {
    const list = getFavorites();
    if (!list.length || list.length > LINK_LIMIT) return;
    const url = encodeFavoritesLink(baseUrl(), list), field = $('#favorites-link');
    try { await navigator.clipboard.writeText(url); field.hidden = true; say('Link copied. Open it on another device to import your favorites.'); }
    catch { field.value = url; field.hidden = false; field.focus(); field.select(); say('Select and copy the link below.'); }
  });
  $('#favorites-import').addEventListener('change', async event => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (file.size > 2_000_000) { say('That file is too large to be a favorites file.'); return; }
    try { await addSongs(favoritesFromFile(await file.text())); }
    catch (error) { say(error.message || 'This file could not be read.'); }
  });
  $('#favorites-incoming-add').addEventListener('click', async () => { const items = pending; pending = null; refresh(); if (items) await addSongs(items); });
  $('#favorites-incoming-skip').addEventListener('click', () => { pending = null; say(''); refresh(); });

  return {
    open() { say(''); $('#favorites-link').hidden = true; refresh(); openDialog(dialog); },
    // A shared link was opened: ask before anything is added.
    offer(items) { pending = items; say(''); $('#favorites-link').hidden = true; refresh(); openDialog(dialog); }
  };
}
