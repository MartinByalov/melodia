// The public address and contact of the site. Shared links, embed codes and QR codes always use them, whichever address the page was opened from.
export const SITE_URL = 'https://www.melodia.lol/';
export const CONTACT_EMAIL = 'contact@melodia.lol';

// On melodia.lol and www.melodia.lol links point to the canonical address, while local development keeps its own address.
export function shareBase(location = globalThis.location) {
  return /(^|\.)melodia\.lol$/i.test(location.hostname) ? SITE_URL : location.origin + location.pathname;
}
