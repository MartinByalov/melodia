import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const css = (await readFile(new URL('../public/styles.css', import.meta.url), 'utf8')).replace(/\/\*[\s\S]*?\*\//g, '');
const rules = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(match => ({ selector: match[1].trim(), body: match[2] }));
const declarations = body => Object.fromEntries(body.split(';').map(part => part.trim()).filter(Boolean).map(part => { const at = part.indexOf(':'); return [part.slice(0, at).trim(), part.slice(at + 1).trim().replace(/\s+/g, '')]; }));
// The one look of a pressed or open button is the look of the Play button: accent fill, the Play icon color and its glow.
const ACTIVE = { color: 'var(--on-accent)', background: 'var(--accent)', 'border-color': 'var(--accent)', 'box-shadow': '0 0 24px rgba(var(--accent-rgb),.12)'.replace(/\s+/g, '') };
// Hovered or focused dialog buttons are only tinted.
const HOVER = { color: 'var(--accent)', background: 'rgba(var(--accent-rgb),.15)', 'border-color': 'var(--accent)' };

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

test('player icons have one icon color in day mode', () => {
  assert.doesNotMatch(css, /\.player #(favorite|rotate)\{color:#/);
  const rule = rules.filter(item => item.selector.endsWith('body[data-mode=day] .player #rotate') && 'color' in declarations(item.body)).at(-1);
  assert.equal(declarations(rule.body).color, 'var(--icon-color)');
});

test('dialog action buttons share one look and open or hovered ones use the active look', () => {
  const rest = rules.find(rule => rule.selector.startsWith('body[data-mode] #share-dialog #copy-link,') && !rule.selector.includes(':'));
  assert.ok(rest, 'common rule for dialog buttons');
  assert.deepEqual(declarations(rest.body), { 'min-height': '40px', border: '1pxsolidrgba(var(--accent-rgb),.55)', 'border-radius': '8px', background: 'rgba(255,255,255,.03)', color: '#fff' });
  for (const button of ['#share-dialog #copy-link', '#share-dialog #embed-toggle', '#favorites-dialog .copy-button', '#station-dialog .copy-button']) assert.ok(rest.selector.includes('body[data-mode] ' + button), button);
  const hover = rules.find(rule => rule.selector.includes('body[data-mode] #share-dialog #embed-toggle:hover'));
  assert.ok(hover, 'common hover rule');
  assert.deepEqual(declarations(hover.body), HOVER);
  const open = rules.find(rule => rule.selector === 'body[data-mode] #share-dialog #embed-toggle[aria-expanded=true]');
  assert.ok(open, 'common open rule');
  assert.deepEqual(declarations(open.body), ACTIVE);
});

test('pressed buttons use the same icon color as the Play button in night and day', () => {
  const play = rules.find(rule => rule.selector === '.play-button' && 'color' in declarations(rule.body));
  assert.equal(declarations(play.body).color, '#09231c');
  assert.equal(declarations(rules.find(rule => rule.selector === ':root' && '--on-accent' in declarations(rule.body)).body)['--on-accent'], '#09231c');
  assert.equal(declarations(rules.find(rule => rule.selector === 'body[data-mode=day]' && '--on-accent' in declarations(rule.body)).body)['--on-accent'], '#fff');
});

test('the phone bottom row has one gap between the heart and the tools', () => {
  assert.ok(rules.some(rule => rule.selector === 'body[data-mobile-player=true] .mobile-player-bottom' && declarations(rule.body)['column-gap'] === 'var(--tool-gap)'));
  assert.ok(rules.some(rule => rule.selector === 'body[data-mobile-player=true] .mobile-tools' && declarations(rule.body).gap === 'var(--tool-gap)'));
});
