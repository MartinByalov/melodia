import test from 'node:test';
import assert from 'node:assert/strict';
import {stationStyle,visualProfile,STYLE_PATTERNS} from '../public/visual-styles.js';
import {matchesStation} from '../public/music.js';
test('expanded styles distinguish subgenres and match directory filters',()=>{
  for(const [tags,style] of [['classical orchestral','classical'],['deep house electronic','house'],['heavy metal rock','metal'],['drum and bass','drumandbass'],['hip-hop','hiphop'],['ambient chill','ambient']]){
    assert.equal(stationStyle(tags),style);assert.ok(matchesStation({tags,name:'Test',country:''},'',style));
  }
  assert.ok(Object.keys(STYLE_PATTERNS).length>=20);
});
test('quiet styles disable rainbow and reduce pulse while dance styles keep stronger effects',()=>{
  const classical=visualProfile('classical'),techno=visualProfile('techno');
  assert.equal(classical.colors,0);assert.ok(classical.pulse<techno.pulse);assert.ok(classical.ray<techno.ray);
  assert.equal(visualProfile('jazz').colors,0);assert.equal(techno.colors,1);
});
test('planet pulse is stronger for energetic genres and quieter for spoken and ambient streams',()=>{
  for(const style of ['techno','house','trance','drum and bass','metal','electronic']){
    assert.ok(visualProfile(style).pulse>visualProfile('pop').pulse);
  }
  assert.ok(visualProfile('pop').pulse>visualProfile('jazz').pulse);
  assert.ok(visualProfile('jazz').pulse>visualProfile('classical').pulse);
  assert.ok(visualProfile('classical').pulse>visualProfile('ambient').pulse);
  assert.ok(visualProfile('ambient').pulse>visualProfile('talk').pulse);
});
test('genre movement and interior effects remain subdued for quiet stations',()=>{
  const ambient=visualProfile('ambient'),techno=visualProfile('techno'),jazz=visualProfile('jazz');
  assert.equal(ambient.motion,'drift');assert.equal(jazz.motion,'sway');assert.equal(techno.motion,'beat');
  assert.equal(ambient.wave,0);assert.ok(techno.wave>0);
  assert.ok(ambient.rotation<techno.rotation);assert.ok(ambient.interior<techno.interior);
});
test('Jamendo genre vocabulary maps onto the visual styles that drive the animations',async()=>{
  const {styleScores}=await import('../public/visual-styles.js');
  const styleOf=tag=>Object.entries(styleScores(tag)).filter(([,score])=>score>0).map(([style])=>style);
  const expected={alternativerock:'rock',indierock:'rock',poprock:'rock',acidjazz:'jazz',deathmetal:'metal',progressivehouse:'house',filmscore:'classical',soundtrack:'classical',
    singersongwriter:'folk',chansonfrancaise:'folk',world:'folk',afrobeat:'folk',indiepop:'pop',kpop:'pop',trap:'hiphop',experimental:'electronic',triphop:'chill',gospel:'soul',cumbia:'latin',darkambient:'ambient'};
  for(const [tag,style] of Object.entries(expected))assert.ok(styleOf(tag).includes(style),`${tag} should map to ${style}, got ${styleOf(tag)}`);
  for(const mood of ['happy','sad','neutral','energetic','therapeutic','bedroom'])assert.deepEqual(styleOf(mood),[],`${mood} is not a style`);
});

test('quiet styles swell and fade slower than hard styles',()=>{
  const order=['techno','pop','jazz','ambient'].map(tags=>visualProfile(tags));
  for(let i=1;i<order.length;i++){assert.ok(order[i].pulseRise>order[i-1].pulseRise);assert.ok(order[i].pulseFall>order[i-1].pulseFall);}
});
