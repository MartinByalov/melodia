import test from 'node:test';
import assert from 'node:assert/strict';
import { Color, SRGBColorSpace } from '../public/vendor/three.module.js';
import { stationColorHSL } from '../public/radio.js';
import { stationTheme } from '../public/station-theme.js';
import { readFile } from 'node:fs/promises';

test('station theme matches GPU marker color and has a dark tinted background',()=>{
  const colors=new Set();
  for(let i=0;i<1000;i++){
    const id=`station-${i}`,hsl=stationColorHSL(id),theme=stationTheme(id);
    assert.equal(theme.color,'#'+new Color().setHSL(hsl.h,hsl.s,hsl.l,SRGBColorSpace).getHexString());
    assert.deepEqual(theme,stationTheme(id));
    assert.deepEqual(theme.rgb.split(',').map(Number),[1,3,5].map(offset=>parseInt(theme.color.slice(offset,offset+2),16)));
    assert.ok([1,3,5].every(offset=>parseInt(theme.bg.slice(offset,offset+2),16)<=18));
    colors.add(theme.color);
  }
  assert.ok(colors.size>990);
});

test('directory markers use station identity colors in both modes and selected state',async()=>{
  const [app,css]=await Promise.all([
    readFile(new URL('../public/app.js',import.meta.url),'utf8'),
    readFile(new URL('../public/styles.css',import.meta.url),'utf8')
  ]);
  assert.match(app,/const palette=stationTheme\(s\.id\)/);
  assert.match(app,/setProperty\('--station-color',palette\.color\)/);
  assert.match(app,/setProperty\('--station-rgb',palette\.rgb\)/);
  assert.doesNotMatch(app,/s\.name\.split\(''\)\.reduce/);
  assert.match(css,/body\[data-mode=day\] \.station-row.active \.station-art\{color:var\(--station-color\);background:rgba\(var\(--station-rgb\),\.12\);border-color:rgba\(var\(--station-rgb\),\.55\)\}/);
});