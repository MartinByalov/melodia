import test from 'node:test';
import assert from 'node:assert/strict';
import {favoriteStyles,STYLE_LABELS} from '../public/favorite-styles.js';
import {matchesStation} from '../public/radio.js';

const aliases={synthwave:'darksynth',lofi:'low-fi',techno:'hardtechno',classical:'chamber music',ambient:'new-age',jazz:'bebop',blues:'delta blues',metal:'metalcore',rock:'rockabilly',house:'deephouse',trance:'psytrance',drumandbass:'d&b',hiphop:'hip hop',reggae:'dancehall',soul:'rhythm and blues',latin:'reguetón',country:'americana',folk:'folklore',chill:'chillout',electronic:'electronica',pop:'top40',talk:'spoken word'};
test('every selectable style counts secondary favorite tags and common aliases consistently',()=>{
  assert.deepEqual(Object.keys(aliases).sort(),Object.keys(STYLE_LABELS).filter(style=>style!=='all').sort());
  for(const [style,alias] of Object.entries(aliases)){
    const other=style==='rock'?'house,deep house,tech house':'rock,classic rock,hard rock';
    const station={id:style,name:'Mixed radio',country:'',tags:`${other},${alias}`};
    assert.equal(matchesStation(station,'',style,true),true,`${style}: ${alias}`);
    const header=favoriteStyles([station],new Set([style]));
    assert.ok(header.includes(style),`${style} missing from favorites header`);
    assert.equal(header.length,5);
  }
});
test('secondary electronic is not discarded when a specific electronic genre exists',()=>{
  const station={id:'a',tags:'synthwave,electronic'};
  const result=favoriteStyles([station],new Set(['a']));
  assert.ok(result.includes('synthwave'));assert.ok(result.includes('electronic'));
});