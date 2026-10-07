// Independent streams feed analysers through a zero-gain output: never audible.
export class StationRhythm {
  constructor() { this.enabled = false; this.context = null; this.entries = new Map(); this.failed = new Set(); }
  async enable() {
    const Context = window.AudioContext || window.webkitAudioContext;
    if (!Context) throw new Error('Audio analysis unavailable');
    this.context = new Context();
    await this.context.resume();
    this.enabled = true;
  }
  remove(id) {
    const entry = this.entries.get(id);
    if (!entry) return;
    clearTimeout(entry.timer); entry.audio.pause(); entry.audio.removeAttribute('src'); entry.audio.load();
    entry.source.disconnect(); entry.analyser.disconnect(); entry.gain.disconnect(); this.entries.delete(id);
  }
  sync(stations) {
    if (!this.enabled) return;
    const wanted = new Set(stations.slice(0, 6).map(s => s.id));
    for (const id of this.entries.keys()) if (!wanted.has(id)) this.remove(id);
    for (const station of stations.slice(0, 6)) {
      if(station.hls)continue; // Only the selected HLS stream is decoded; avoid background decoders.
      if (this.entries.has(station.id) || this.failed.has(station.id)) continue;
      const audio = new Audio(); audio.crossOrigin = 'anonymous'; audio.preload = 'none'; audio.src = station.url;
      const source = this.context.createMediaElementSource(audio), analyser = this.context.createAnalyser(), gain = this.context.createGain();
      analyser.fftSize = 128; analyser.smoothingTimeConstant = .7; gain.gain.value = 0;
      source.connect(analyser); analyser.connect(gain); gain.connect(this.context.destination);
      const entry = { audio, source, analyser, gain, bins: new Uint8Array(analyser.frequencyBinCount), timer: null };
      this.entries.set(station.id, entry);
      const fail = () => { if (this.entries.get(station.id) !== entry) return; this.failed.add(station.id); this.remove(station.id); };
      audio.addEventListener('error', fail, { once: true });
      entry.timer = setTimeout(() => { if (audio.readyState < 3) fail(); }, 15000);
      audio.play().catch(fail);
    }
  }
  levels() {
    const levels = new Map();
    for (const [id, entry] of this.entries) {
      if (entry.audio.paused || entry.audio.readyState < 3) continue;
      entry.analyser.getByteFrequencyData(entry.bins);
      levels.set(id, entry.bins.reduce((sum, n) => sum + n, 0) / entry.bins.length / 255);
    }
    return levels;
  }
  disable() {
    this.enabled = false;
    for (const id of this.entries.keys()) this.remove(id);
    this.context?.close().catch(() => {}); this.context = null; this.failed.clear();
  }
}