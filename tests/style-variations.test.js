import test from 'node:test';
import assert from 'node:assert/strict';
import {STYLE_PATTERNS,STYLE_VARIATIONS,visualProfile} from '../public/visual-styles.js';

test('all 22 styles have distinct bounded rotation, ray and wave variations',()=>{
  assert.deepEqual(Object.keys(STYLE_VARIATIONS).sort(),Object.keys(STYLE_PATTERNS).sort());
  const signatures=new Set();
  for(const [style,variation] of Object.entries(STYLE_VARIATIONS)){
    assert.ok(variation.cadence>=0&&variation.cadence<.5);
    assert.ok(variation.period>=1.7);
    assert.ok(variation.rayTravel>=0&&variation.rayTravel<=.55);
    assert.ok(variation.raySpeed>0&&variation.waveSpeed>0);
    signatures.add(JSON.stringify(variation));
    const tags=style==='drumandbass'?'dnb':style==='talk'?'news':style;
    assert.equal(visualProfile(tags).rayTravel,variation.rayTravel);
  }
  assert.equal(signatures.size,22);
});