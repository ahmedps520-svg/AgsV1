/**
 * A short two-note chime played when a new student appears on the board.
 * Synthesised with the Web Audio API so the board ships with no audio assets
 * and no network request at the moment it matters.
 */
let context: AudioContext | null = null;

export function unlockAudio(): boolean {
  try {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return false;

    context ??= new Ctor();
    void context.resume();
    return true;
  } catch {
    return false;
  }
}

export function playChime() {
  if (!context || context.state !== "running") return;

  const now = context.currentTime;
  const master = context.createGain();
  master.gain.setValueAtTime(0.0001, now);
  master.connect(context.destination);

  // A perfect fifth: friendly, cuts through hallway noise, never alarming.
  [
    { frequency: 784, start: 0 },
    { frequency: 1175, start: 0.14 },
  ].forEach(({ frequency, start }) => {
    const oscillator = context!.createOscillator();
    const gain = context!.createGain();

    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(frequency, now + start);

    gain.gain.setValueAtTime(0.0001, now + start);
    gain.gain.exponentialRampToValueAtTime(0.22, now + start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + start + 0.85);

    oscillator.connect(gain);
    gain.connect(master);
    oscillator.start(now + start);
    oscillator.stop(now + start + 0.9);
  });

  master.gain.setValueAtTime(1, now);
}
