export const STYLE_PATTERNS={
  synthwave:/synthwave|synth[ -]?pop|retrowave|darksynth|synth/,lofi:/lo[ -]?fi|low[ -]?fi/,techno:/techno|hardtechno|hypertechno/,
  classical:/classical|classic music|opera|orchestral|baroque|symphonic|chamber music/,ambient:/ambient|meditation|meditative|new[ -]?age|soundscapes/,
  jazz:/jazz|swing|bebop|bossa nova/,blues:/blues|delta blues/,metal:/metal|heavy metal|metalcore|deathcore/,rock:/rock|punk|rockabilly|post[ -]?rock/,
  house:/house|deep[ -]?house|techhouse|deephouse/,trance:/trance|psytrance|psy[ -]?trance/,drumandbass:/drum[ -]?(?:and|&|n)[ -]?bass|drumandbass|dnb|d&b|jungle/,
  hiphop:/hip[ -]?hop|rap/,reggae:/reggae|dub|ska|dancehall/,soul:/soul|funk|r\s*&\s*b|rnb|rhythm and blues/,
  latin:/latin|latino|salsa|bachata|reggaeton|reggaetón|reguet[oó]n|merengue/,country:/country|bluegrass|americana/,folk:/folk|folklore|traditional/,
  chill:/chill|lounge|relax|downtempo/,electronic:/electro|dance|edm/,pop:/pop/,
  talk:/talk|news|speech|sports|spoken word|current affairs/
};
// Match complete genre words, not substrings such as rap in "therapeutic".
const boundedPatterns=Object.fromEntries(Object.entries(STYLE_PATTERNS).map(([style,pattern])=>[style,new RegExp(`(?:^|[^\\p{L}\\p{N}])(?:${pattern.source})(?=$|[^\\p{L}\\p{N}])`,'iu')]));
boundedPatterns.electronic=/(?:^|[^\p{L}\p{N}])(?:electro|electronic|electronica|electropop|dance|edm)(?=$|[^\p{L}\p{N}])/iu;
boundedPatterns.chill=/(?:^|[^\p{L}\p{N}])(?:chill|chillout|lounge|relax|downtempo)(?=$|[^\p{L}\p{N}])/iu;
boundedPatterns.hiphop=/(?:^|[^\p{L}\p{N}])(?:hip[ -]?hop|rap)(?=$|[^\p{L}\p{N}])/iu;
boundedPatterns.pop=/(?:^|[^\p{L}\p{N}])(?:pop|hits|top[ -]?40|top[ -]?100|charts|contemporary hits|chr)(?=$|[^\p{L}\p{N}])/iu;
const scoreCache=new Map();
export function styleScores(tags=''){
  const key=String(tags).toLowerCase();
  if(scoreCache.has(key))return scoreCache.get(key);
  const scores={};
  const tokens=[...new Set(key.split(/[,;|]/).map(tag=>tag.trim()).filter(Boolean))];
  for(const [style,pattern] of Object.entries(boundedPatterns)){
    let score=0;
    for(const tag of tokens)if(pattern.test(tag))score++;
    scores[style]=score;
  }
  if(scoreCache.size>=50000)scoreCache.clear();
  scoreCache.set(key,Object.freeze(scores));return scores;
}
export function matchesStyle(tags,style,includeSecondary=false){
  const scores=styleScores(tags),score=scores[style]||0;
  if(!score)return false;
  if(includeSecondary)return true;
  // Explicit multiple main styles are valid; isolated tags in broad tag lists are not.
  return score>=Math.max(...Object.values(scores));
}
export function stationStyle(tags=''){
  const scores=styleScores(tags);
  let best='pop',maximum=0;
  for(const style of Object.keys(STYLE_PATTERNS))if(scores[style]>maximum){best=style;maximum=scores[style];}
  return best;
}
export function visualProfile(tags){
  const profile=baseProfile(tags);
  const quiet=['classical','ambient','talk'].includes(profile.style);
  return {...profile,rotation:quiet?.28:['jazz','blues','lofi','chill'].includes(profile.style)?.5:1,
    motion:quiet?'drift':['reggae','latin','soul','jazz'].includes(profile.style)?'sway':'beat',
    wave:profile.colors? .65:0,interior:quiet?.025:profile.colors?.12:.06,...STYLE_VARIATIONS[profile.style]};
}
// Rotation cadence, spatial ray envelope and map wave timing: no additional draws.
export const STYLE_VARIATIONS={
  classical:{cadence:.12,period:12,rayTravel:.12,raySpeed:.18,waveSpeed:.5},
  ambient:{cadence:.18,period:18,rayTravel:.2,raySpeed:.12,waveSpeed:.35},
  talk:{cadence:0,period:20,rayTravel:0,raySpeed:.1,waveSpeed:.3},
  jazz:{cadence:.28,period:3.7,rayTravel:.22,raySpeed:.45,waveSpeed:.7},
  blues:{cadence:.22,period:5.3,rayTravel:.25,raySpeed:.32,waveSpeed:.65},
  lofi:{cadence:.16,period:7,rayTravel:.2,raySpeed:.25,waveSpeed:.55},
  chill:{cadence:.2,period:9,rayTravel:.24,raySpeed:.22,waveSpeed:.5},
  folk:{cadence:.18,period:6.5,rayTravel:.18,raySpeed:.35,waveSpeed:.65},
  country:{cadence:.24,period:4.8,rayTravel:.23,raySpeed:.5,waveSpeed:.8},
  soul:{cadence:.32,period:4.2,rayTravel:.3,raySpeed:.55,waveSpeed:.85},
  synthwave:{cadence:.3,period:8,rayTravel:.45,raySpeed:.4,waveSpeed:.75},
  techno:{cadence:.38,period:2.1,rayTravel:.4,raySpeed:1.1,waveSpeed:1.4},
  house:{cadence:.3,period:3.2,rayTravel:.38,raySpeed:.8,waveSpeed:1.1},
  trance:{cadence:.32,period:10,rayTravel:.55,raySpeed:.5,waveSpeed:.65},
  drumandbass:{cadence:.42,period:1.7,rayTravel:.5,raySpeed:1.4,waveSpeed:1.6},
  metal:{cadence:.4,period:2.6,rayTravel:.35,raySpeed:1.3,waveSpeed:1.3},
  rock:{cadence:.34,period:3.1,rayTravel:.32,raySpeed:.9,waveSpeed:1.1},
  hiphop:{cadence:.32,period:4.6,rayTravel:.38,raySpeed:.6,waveSpeed:.9},
  reggae:{cadence:.36,period:5.8,rayTravel:.35,raySpeed:.4,waveSpeed:.7},
  latin:{cadence:.38,period:3.5,rayTravel:.42,raySpeed:.85,waveSpeed:1.2},
  electronic:{cadence:.35,period:4,rayTravel:.45,raySpeed:1,waveSpeed:1.2},
  pop:{cadence:.25,period:5,rayTravel:.3,raySpeed:.65,waveSpeed:1}
};
function baseProfile(tags){
  const style=stationStyle(tags);
  if(['classical','ambient','talk'].includes(style))return {style,pulse:style==='talk'?.08:style==='ambient'?.2:.3,ray:.55,colors:0};
  if(['jazz','blues','lofi','chill','folk','country','soul'].includes(style))return {style,pulse:.5,ray:.75,colors:0};
  if(['techno','house','trance','drumandbass','metal','electronic'].includes(style))return {style,pulse:1.3,ray:1,colors:1};
  return {style,pulse:.85,ray:1,colors:1};
}