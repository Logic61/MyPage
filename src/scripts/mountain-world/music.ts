export const tracks = [
  { file: 'barcarolle', name: '船歌', nameEn: 'Barcarolle', weight: 4 },
  { file: 'pastoral', name: '田园', nameEn: 'Pastoral', weight: 4 },
  { file: 'river-breeze', name: '江上清风游', nameEn: 'River Breeze', weight: 2 },
  { file: 'misty-boat', name: '烟雨行舟', nameEn: 'A Boat in Misty Rain', weight: 2 },
  { file: 'heart-linked', name: 'Heartlinked', nameEn: 'Heartlinked', weight: 1 },
];

export function createMusic(base: string, onFailure: () => void) {
  let player: HTMLAudioElement | null = null;
  let selection = 'shuffle', current = '', audible = false, revision = 0;
  const failed = new Set<string>();

  let gestures: AbortController | undefined;
  function clearGestures() { gestures?.abort(); gestures = undefined; }

  function release() {
    if (!player) return;
    player.onended = player.onerror = null;
    player.pause();
    player.removeAttribute('src');
    player.load();
    player = null;
  }

  function play() {
    if (!audible) return;
    if (!player) {
      const available = tracks.filter(track => !failed.has(track.file) && (selection === 'shuffle' || track.file === selection));
      if (!available.length) {
        audible = false; failed.clear(); onFailure(); return;
      }
      const choices = available.length > 1 ? available.filter(track => track.file !== current) : available;
      let pick = Math.random() * choices.reduce((sum, track) => sum + track.weight, 0);
      const track = choices.find(track => (pick -= track.weight) < 0) ?? choices[choices.length - 1];
      current = track.file;
      const next = new Audio(base + '/world/music/' + current + '.m4a');
      player = next;
      next.volume = .48;
      next.onended = () => { if (player === next) { failed.clear(); release(); play(); } };
      next.onerror = () => { if (player === next) { failed.add(current); release(); play(); } };
    }
    const active = player, request = ++revision;
    void active.play().catch((error: DOMException) => {
      if (request !== revision || active !== player || !audible || error.name === 'AbortError') return;
      if (error.name === 'NotSupportedError') { failed.add(current); release(); play(); }
      else if (error.name === 'NotAllowedError') {
        clearGestures(); gestures = new AbortController();
        const retry = (event: Event) => {
          if (!event.isTrusted || (event.target instanceof Element && event.target.closest('[data-world-action="sound"]'))) return;
          clearGestures(); play();
        };
        for (const type of ['click','keydown']) document.addEventListener(type,retry,{capture:true,signal:gestures.signal});
      }
      else { audible = false; active.pause(); onFailure(); }
    });
  }

  return {
    get selection() { return selection; },
    select(value: string) {
      const next = tracks.some(t => t.file === value) ? value : 'shuffle';
      if (next === selection) return;
      selection = next;
      failed.clear(); clearGestures(); revision++;
      release(); play();
    },
    setAudible(value: boolean) {
      if (value === audible) return;
      clearGestures(); audible = value; revision++;
      if (value) play(); else player?.pause();
    },
    dispose() { clearGestures(); audible = false; revision++; release(); },
  };
}

export function createAmbience(base: string, onFailure: () => void) {
  let context: AudioContext | null = null, master: GainNode | null = null, windGain: GainNode | null = null;
  let enabled = false, hidden = false, footClock = 0;
  const music = createMusic(base, () => {
    enabled = false;
    if (master && context) master.gain.setTargetAtTime(0, context.currentTime, .1);
    onFailure();
  });
  const sources: AudioScheduledSourceNode[] = [];
  function ensure() {
    if (context) return;
    context = new AudioContext();
    master = context.createGain(); master.gain.value = 0; master.connect(context.destination);
    const noise = context.createBuffer(1, context.sampleRate * 4, context.sampleRate);
    const samples = noise.getChannelData(0);
    let previous = 0;
    for (let i = 0; i < samples.length; i++) { previous = (previous + (Math.random() * 2 - 1) * 0.02) / 1.02; samples[i] = previous * 3; }
    const source = context.createBufferSource(); source.buffer = noise; source.loop = true;
    const low = context.createBiquadFilter(); low.type = 'lowpass'; low.frequency.value = 750;
    windGain = context.createGain(); windGain.gain.value = 0.18;
    source.connect(low).connect(windGain).connect(master); source.start(); sources.push(source);
  }
  return {
    get enabled() { return enabled; },
    get selection() { return music.selection; },
    select(value: string) { music.select(value); },
    toggle() {
      enabled = !enabled;
      music.setAudible(enabled && !hidden);
      try { ensure(); void context?.resume().catch(() => {}); master?.gain.setTargetAtTime(enabled && !hidden ? .6 : 0, context!.currentTime, .4); }
      catch { /* Music can play without synthesized footsteps. */ }
      return enabled;
    },
    setHidden(value: boolean) { hidden = value; music.setAudible(enabled && !hidden); if (master && context) master.gain.setTargetAtTime(enabled && !hidden ? 0.6 : 0, context.currentTime, 0.2); },
    update(indoor: boolean, speed: number, delta: number) {
      if (!context || !enabled || hidden) return;
      windGain?.gain.setTargetAtTime(indoor ? .025 : .055, context.currentTime, 1.2);
      footClock += speed * delta;
      if (speed > 0.5 && footClock > 1.1) {
        footClock = 0;
        const tone = context.createOscillator(), gain = context.createGain();
        tone.type = 'sine'; tone.frequency.setValueAtTime(indoor ? 130 : 95, context.currentTime);
        tone.frequency.exponentialRampToValueAtTime(40, context.currentTime + 0.07);
        gain.gain.setValueAtTime(0.035, context.currentTime); gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.09);
        tone.connect(gain).connect(master!); tone.start(); tone.stop(context.currentTime + 0.1);
        tone.onended = () => { tone.disconnect(); gain.disconnect(); };
      }
    },
    dispose() {
      enabled = false; music.dispose();
      for (const source of sources.splice(0)) source.stop();
      if (context) { void context.close().catch(() => {}); context = null; }
    },
  };
}
