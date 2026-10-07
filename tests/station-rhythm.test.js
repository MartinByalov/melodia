import test from 'node:test';
import assert from 'node:assert/strict';
import { StationRhythm } from '../public/station-rhythm.js';

test('independent analysers are capped at six, silent, and released', async () => {
  const gains = [];
  class Node {
    connect() {} disconnect() {}
    getByteFrequencyData(bins) { bins.fill(128); }
  }
  class Context {
    destination = {}; closed = false;
    async resume() {} async close() { this.closed = true; }
    createMediaElementSource() { return new Node(); }
    createAnalyser() { return Object.assign(new Node(), { frequencyBinCount: 64 }); }
    createGain() { const node = Object.assign(new Node(), { gain: { value: 1 } }); gains.push(node); return node; }
  }
  class Audio {
    paused = true; readyState = 4;
    addEventListener() {} removeAttribute() {} load() {}
    async play() { this.paused = false; } pause() { this.paused = true; }
  }
  const oldWindow = globalThis.window, oldAudio = globalThis.Audio;
  globalThis.window = { AudioContext: Context }; globalThis.Audio = Audio;
  const rhythm = new StationRhythm();
  try {
    await rhythm.enable();
    rhythm.sync(Array.from({ length: 20 }, (_, i) => ({ id: String(i), url: `https://example.com/${i}` })));
    assert.equal(rhythm.entries.size, 6);
    assert.ok(gains.every(node => node.gain.value === 0));
    assert.equal(rhythm.levels().size, 6);
    assert.equal(rhythm.levels().get('0'), 128 / 255);
    rhythm.sync([{ id: '9', url: 'https://example.com/9' }]);
    assert.equal(rhythm.entries.size, 1);
    assert.ok(rhythm.entries.has('9'));
    const context = rhythm.context;
    rhythm.disable();
    assert.equal(rhythm.entries.size, 0);
    assert.equal(rhythm.enabled, false);
    assert.equal(context.closed, true);
  } finally { rhythm.disable(); globalThis.window = oldWindow; globalThis.Audio = oldAudio; }
});