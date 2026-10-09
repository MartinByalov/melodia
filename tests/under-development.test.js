import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=name=>readFile(new URL(`../public/${name}`,import.meta.url),'utf8');

test('information links live in the footer next to the copyright line',async()=>{
  const html=await read('index.html');
  const header=html.match(/<header>[\s\S]*?<\/header>/)?.[0];
  const footer=html.match(/<footer>[\s\S]*?<\/footer>/)?.[0];
  assert.ok(header,'header present');
  assert.ok(footer,'footer present');
  assert.ok(!header.includes('footer-links')&&!header.includes('data-reduce-effects'),'links moved out of the header');
  for(const marker of ['data-info="about"','data-info="credits"','data-info="privacy"','href="broadcasters.html"','data-reduce-effects','copyright-year'])
    assert.ok(footer.includes(marker),`footer holds ${marker}`);
  assert.ok(footer.indexOf('data-info="about"')<footer.indexOf('All rights reserved.'),'links sit on the copyright row');
  const css=await read('styles.css');
  assert.match(css,/footer\{justify-content:center;gap:16px\}/);
  assert.doesNotMatch(css,/header \.footer-links\{/);
});

test('start page runs as a disco ball without playback',async()=>{
  const [html,app,css,globe,revealSource]=await Promise.all(['index.html','app.js','styles.css','globe.js','loading-reveal.js'].map(read));
  assert.match(html.match(/<body[^>]*>/)[0],/data-under-development="true"/);
  assert.match(app,/const underDevelopment=document\.body\.dataset\.underDevelopment==='true'/);
  assert.doesNotMatch(app,/text='Under development'/);
  assert.match(app,/if\(underDevelopment\)autoplay=false/);
  assert.match(app,/\$\('#play'\)\.addEventListener\('click', \(\) => \{\r?\n  if\(underDevelopment\)return;/);
  assert.match(app,/globe\?\.setDiscoMode\?\.\(underDevelopment\)/);
  assert.match(css,/body\[data-under-development=true\] header,body\[data-under-development=true\] \.player,body\[data-under-development=true\] footer\{filter:blur\(7px\);pointer-events:none\}/);
  assert.match(css,/body\[data-under-development=true\] #world-status\{display:none\}/);
  assert.match(css,/body\[data-under-development=true\] #globe canvas\{filter:saturate\(1\.6\)/);
  assert.match(css,/disco-ball-hue/);
  assert.match(revealSource,/element\.hidden=!\(loading\|\|persistent\)/);
  assert.match(globe,/setDiscoMode\(value\)\{discoMode=Boolean\(value\)/);
  assert.match(globe,/createLoadingReveal\(container,\{text:'Under development',persistent:true,caution:false\}\)/);
  assert.match(globe,/selected=s\.id;markActive\(\);if\(discoMode\)return;/);
  assert.match(globe,/if\(!discoMode&&camera\.position\.length\(\)<1\.5\)controls\.autoRotate=false;/);
});

test('globe map layers stay hidden and only the disco sphere remains',async()=>{
  const globe=await read('globe.js');
  // Region country fills never reveal under development.
  assert.match(globe,/const showRegions=!loadingWorld&&!discoMode;/);
  // Country/detail borders stay hidden in the overlay pass.
  assert.match(globe,/if\(detailedBorders\)detailedBorders\.visible=!discoMode&&\(closeView\|\|!overviewBorders\);/);
  assert.match(globe,/if\(overviewBorders\)overviewBorders\.visible=!discoMode&&!closeView;/);
  // City labels are suppressed too.
  assert.match(globe,/cityLayer\.hidden=altitude>\.35\|\|discoMode;/);
  // Central gate hides station dots, borders, district lines and map batches under development.
  assert.match(globe,/if\(loadingWorld\|\|discoMode\)\{[\s\S]*?hidden\.push\(detailedBorders,overviewBorders,municipalLines,ring\);[\s\S]*?stationGPU\?\.setDiagnosticHidden\(true\);[\s\S]*?cityLayer\.hidden=true;/);
});

test('globe stays locked to spinning in place under development',async()=>{
  const globe=await read('globe.js');
  // Wheel and pinch zoom share one entry point.
  assert.match(globe,/function zoom\(factor\) \{\r?\n\s*if\(discoMode\)return;/);
  assert.match(globe,/addEventListener\('dblclick',event=>\{if\(discoMode\)return;/);
  assert.match(globe,/&&\(!globeHovered\|\|discoMode\)&&!reducedMotion\)camera\.position\.applyAxisAngle/);
  assert.match(globe,/loadingWorld\|\|reducedMotion\|\|discoMode\|\|globeHovered\|\|!!down/);
  // Station dots cannot be hovered or clicked from the disco sphere.
  assert.match(globe,/pointerup',e=>\{if\(discoMode\)return;/);
  assert.match(globe,/if\(pendingPointer&&!discoMode\)\{hovered=hit\(pendingPointer\)/);
  assert.match(globe,/if\(hovered&&!discoMode\)\{tooltip\.textContent=hovered\.name/);
});
