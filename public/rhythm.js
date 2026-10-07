// A stylistic animation, not a measurement of the station's actual music.
export function rhythmProfile(tags, id) {
  let seed = 2166136261;
  for (const char of id) seed = Math.imul(seed ^ char.charCodeAt(0), 16777619) >>> 0;
  const bpm = /techno|trance|dance|house/.test(tags) ? 128 : /synth/.test(tags) ? 104 : /jazz|blues/.test(tags) ? 92 : /chill|ambient|lo[ -]?fi/.test(tags) ? 72 : /rock|metal/.test(tags) ? 140 : /classical/.test(tags) ? 66 : 112;
  return { bpm: bpm + seed % 13 - 6, phase: (seed % 1000) / 1000, soft: /ambient|classical|chill/.test(tags) };
}
export function syntheticLevel(profile, seconds) {
  const beat = seconds * profile.bpm / 60 + profile.phase;
  const kick = Math.exp(-(beat % 1) * (profile.soft ? 4 : 10));
  const accent = (Math.sin(beat * Math.PI * 4) + 1) * .09;
  const phrase = .7 + .3 * Math.sin(beat * Math.PI / 8 + profile.phase * 6);
  return Math.min(1, .08 + kick * phrase * .72 + accent);
}

// Continuous, slower visual rhythm for rays (not measured audio).
export function rayLevel(profile, seconds) {
  const beat=seconds*profile.bpm/120+profile.phase;
  const wave=.5+.5*Math.cos(beat*Math.PI*2);
  const envelope=wave**(profile.soft?2:3);
  const phrase=.7+.3*Math.sin(beat*Math.PI/8+profile.phase*6);
  const accent=(Math.sin(beat*Math.PI*2)+1)*.06;
  return Math.min(1,.08+envelope*phrase*.72+accent);
}