const tracks = [
  { file: 'barcarolle', weight: 4 },
  { file: 'pastoral', weight: 4 },
  { file: 'river-breeze', weight: 2 },
  { file: 'misty-boat', weight: 2 },
  { file: 'heart-linked', weight: 1 },
];

export function createMusic(base: string, onFailure: () => void) {
  let player: HTMLAudioElement | null = null;
  let current = '', audible = false, revision = 0;
  const failed = new Set<string>();

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
      const available = tracks.filter(track => !failed.has(track.file));
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
      else { audible = false; active.pause(); onFailure(); }
    });
  }

  return {
    setAudible(value: boolean) {
      if (value === audible) return;
      audible = value; revision++;
      if (value) play(); else player?.pause();
    },
    dispose() { audible = false; revision++; release(); },
  };
}
