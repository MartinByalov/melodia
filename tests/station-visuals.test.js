import test from 'node:test';
import assert from 'node:assert/strict';
import { stationColorHSL } from '../public/radio.js';
import { rayLevel, rhythmProfile } from '../public/rhythm.js';
import { readFile } from 'node:fs/promises';

test('station colors are stable and span the whole hue spectrum rather than six themes',()=>{
  const bins=new Set();
  for(let i=0;i<2000;i++){
    const id=`station-${i}`,color=stationColorHSL(id);
    assert.deepEqual(color,stationColorHSL(id));
    assert.ok(color.h>=0&&color.h<1&&color.s>=.72&&color.s<=1&&color.l>=.46&&color.l<=.64);
    bins.add(Math.floor(color.h*24));
  }
  assert.equal(bins.size,24);
});

test('palette emphasizes saturated non-pink colors and uses explicit display color space',async()=>{
  let pink=0;const bins=Array(10).fill(0);
  for(let i=0;i<20000;i++){
    const color=stationColorHSL(`station-${i}`);
    if(color.h>=5/6)pink++;else bins[Math.min(9,Math.floor(color.h/(5/6)*10))]++;
  }
  assert.ok(pink/20000>.08&&pink/20000<.12);
  assert.ok(bins.every(count=>count>1500&&count<2100));
  const source=await readFile(new URL('../public/globe.js',import.meta.url),'utf8');
  assert.match(source,/setHSL\(hsl\.h,hsl\.s,hsl\.l,THREE\.SRGBColorSpace\)/);
});

test('ray rhythm remains continuous at beat boundaries and has bounded frame-to-frame changes',()=>{
  for(const genre of ['techno','jazz','ambient','rock','classical']){
    const profile=rhythmProfile(genre,'sample');let previous=rayLevel(profile,0),min=1,max=0;
    for(let i=1;i<3000;i++){
      const value=rayLevel(profile,i/120);
      assert.ok(value>=0&&value<=1);
      assert.ok(Math.abs(value-previous)<.04);
      previous=value;min=Math.min(min,value);max=Math.max(max,value);
    }
    assert.ok(max-min>.3);
  }
});

test('dots use derivative antialiasing and rays ease into playback',async()=>{
  const source=await readFile(new URL('../public/station-gpu.js',import.meta.url),'utf8');
  assert.match(source,/fwidth\(radius\)/);
  assert.match(source,/transparent:!ray/);
  assert.match(source,/smoothstep\(/);
  assert.match(source,/scale\*reveal/);
  assert.doesNotMatch(source,/exp\(-fract\(beat\)/);
});

test('rays have independent phase gates and no permanently tall selected baseline',async()=>{
  const source=await readFile(new URL('../public/station-gpu.js',import.meta.url),'utf8');
  assert.match(source,/rhythm\.y\*6\.2831853/);
  assert.match(source,/amplitude\*1\.25\)\*mix\(\.25,1\.0,gate\):localLevel\*gate/);
  assert.match(source,/height=signal\*\(isSelected\?\.44:\.32\)/);
  assert.match(source,/tint=stationColor/);
  assert.doesNotMatch(source,/\.78\+signal\*\.34/);
});

test('animated background uses small instanced geometry without CSS blur or textures',async()=>{
  const source=await readFile(new URL('../public/globe-background.js',import.meta.url),'utf8');
  assert.match(source,/InstancedBufferGeometry/);
  assert.match(source,/geometry\(420\)/);
  assert.match(source,/geometry\(7\)/);
  assert.match(source,/geometry\(4\)/);
  assert.match(source,/reduced\?0:time/);
  assert.doesNotMatch(source,/Texture|backdrop-filter|requestAnimationFrame/);
});

test('ray length grows smoothly at zoom out while audio still controls height down to zero',async()=>{
  const source=await readFile(new URL('../public/station-gpu.js',import.meta.url),'utf8');
  assert.match(source,/zoomBoost=1\.0\+1\.2\*smoothstep\(1\.6,5\.5,distance-1\.0\)/);
  assert.match(source,/height=signal\*\(isSelected\?\.44:\.32\)\*zoomBoost\*scale\*reveal/);
});

test('ray color waves stay per-instance and honor reduced motion without changing dot colors',async()=>{
  const source=await readFile(new URL('../public/station-gpu.js',import.meta.url),'utf8');
  assert.match(source,/mod\(time\/3\.0,48\.0\)/);
  assert.match(source,/dot\(stationNormal,vec3/);
  assert.match(source,/waveMix\*\(1\.0-reduced\)\*styleEffects\.y/);
  assert.doesNotMatch(source,/themeMix/);
  assert.match(source,/uniforms\.themeColor\.value\.set\(color\)/);
  assert.doesNotMatch(source,/stationColor\.needsUpdate/);
  assert.ok(source.indexOf('float colorTime')>source.indexOf('${ray?`'));
});

test('share without a station uses the player message and clears on station selection',async()=>{
  const source=await readFile(new URL('../public/app.js',import.meta.url),'utf8');
  assert.match(source,/if \(!selected\) return setPlayerMessage\('Choose a station to share\.'\)/);
  assert.doesNotMatch(source,/toast\('Choose a station to share\.'\)/);
  assert.match(source,/if\(\$\('#player-message'\)\.textContent==='Choose a station to share\.'\)setPlayerMessage/);
});

test('shooting stars are depth-tested far-plane geometry and disabled for reduced motion',async()=>{
  const source=await readFile(new URL('../public/globe-background.js',import.meta.url),'utf8');
  assert.match(source,/meteorMaterial=new THREE.ShaderMaterial\(\{uniforms,transparent:true,depthTest:true,depthWrite:false/);
  assert.match(source,/gl_Position=vec4\(head\+pixels\*2\.0\/resolution,1\.0,1\.0\)/);
  assert.match(source,/uniforms\.motion\.value=reduced\?0:1/);
  assert.match(source,/meteorId\*24\.0/);
  assert.match(source,/duration=7\.0\+randomValue\(seed\+2\.0\)\*3\.0/);
  assert.match(source,/side\*position\.y\*halfWidth/);
  assert.match(source,/cycle\*17\.0\+meteorId\*71\.0/);
  assert.match(source,/vec2 origin=vec2\(randomValue/);
});

test('meteors use a rounded bright head, tapered fading trail and aspect-correct movement',async()=>{
  const source=await readFile(new URL('../public/globe-background.js',import.meta.url),'utf8');
  assert.match(source,/headRadius=length\(vec2\(x,y\)\)/);
  assert.match(source,/halo=exp\(-headRadius\*headRadius/);
  assert.match(source,/trail=edge\*pow\(along,2\.2\)/);
  assert.match(source,/direction\*progress\*travel\*2\.0\/resolution/);
  assert.match(source,/tailLength=28\.0\+randomValue/);
  assert.match(source,/step\(0\.0,age\)/);
});

test('background creates three bounded instanced draws and releases scene resources',async()=>{
  const source=await readFile(new URL('../public/globe-background.js',import.meta.url),'utf8');
  const threeUrl=new URL('../public/vendor/three.module.js',import.meta.url).href;
  const THREE=await import(threeUrl);
  const module=await import('data:text/javascript;base64,'+Buffer.from(source.replace("from 'three'",`from '${threeUrl}'`)).toString('base64'));
  const scene=new THREE.Scene(),background=module.createGlobeBackground(scene);
  assert.equal(scene.children.length,3);
  assert.deepEqual(scene.children.map(object=>object.geometry.instanceCount),[7,420,4]);
  for(const object of scene.children){assert.equal(object.material.depthTest,true);assert.equal(object.material.depthWrite,false);}
  background.update(10,1440,1000,true,.4);
  assert.equal(scene.children[2].material.uniforms.motion.value,0);
  assert.equal(scene.children[2].material.uniforms.time.value,0);
  background.update(15,1440,1000,false,.4);
  assert.equal(scene.children[2].material.uniforms.motion.value,1);
  background.setVisible(false);
  assert.ok(scene.children.every(object=>!object.visible));
  background.dispose();assert.equal(scene.children.length,0);
});