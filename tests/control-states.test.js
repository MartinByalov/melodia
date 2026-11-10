import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const css = (await readFile(new URL('../public/styles.css', import.meta.url), 'utf8')).replace(/\/\*[\s\S]*?\*\//g, '');
const rules = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(match => ({ selector: match[1].trim(), body: match[2] }));
const declarations = body => Object.fromEntries(body.split(';').map(part => part.trim()).filter(Boolean).map(part => { const at = part.indexOf(':'); return [part.slice(0, at).trim(), part.slice(at + 1).trim().replace(/\s+/g, '')]; }));
// The one look of a pressed or open icon button: accent color, accent border and a 15% accent fill.
const ACTIVE = { color: 'var(--accent)', background: 'rgba(var(--accent-rgb),.15)', 'border-color': 'var(--accent)' };

test('every pressed or open control of the player and dialogs has the same active look', () => {
  const families = ['#mobile-info[aria-expanded=true]', '#share[aria-expanded=true]', '#reduce-effects[aria-pressed=true]', '.info-tabs button[aria-pressed=true]'];
  for (const family of families) {
    const found = rules.filter(rule => rule.selector.includes(family) && !rule.selector.includes(':hover'));
    assert.ok(found.length, `${family} has no rule`);
    for (const rule of found) assert.deepEqual(declarations(rule.body), ACTIVE, `${rule.selector} differs from the common active look`);
  }
});

test('the pressed Reduce effects rule is not outranked by the layout rule that styles the button', () => {
  const base = rules.filter(rule => /#reduce-effects$/.test(rule.selector.split(',')[0].trim()) && /border/.test(rule.body));
  assert.ok(base.length);
  for (const rule of base) assert.match(rule.selector, /body\[data-(mobile-player|landscape-phone)=true\]/);
  const pressed = rules.find(rule => rule.selector.includes('#reduce-effects[aria-pressed=true]'));
  assert.match(pressed.selector, /body\[data-mobile-player=true\] #reduce-effects\[aria-pressed=true\]/);
  assert.match(pressed.selector, /body\[data-landscape-phone=true\] #reduce-effects\[aria-pressed=true\]/);
});
