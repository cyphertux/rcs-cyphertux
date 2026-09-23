export type AudioCue =
  | "beep"
  | "relay"
  | "print"
  | "error"
  | "key"
  | "confirm"
  | "success"
  | "unlock";

let muted = true;
let ctx: AudioContext | null = null;

export function isMuted(): boolean {
  return muted;
}

export function setAudioMuted(value: boolean): void {
  muted = value;
}

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const AC =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!AC) return null;
  if (!ctx) ctx = new AC();
  return ctx;
}

function tone(
  frequency: number,
  durationMs: number,
  type: OscillatorType,
  gain = 0.04,
  when = 0,
): void {
  const ac = getCtx();
  if (!ac) return;
  void ac.resume();
  const t0 = ac.currentTime + when;
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = type;
  osc.frequency.value = frequency;
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + durationMs / 1000);
  osc.connect(g);
  g.connect(ac.destination);
  osc.start(t0);
  osc.stop(t0 + durationMs / 1000 + 0.02);
}

export function playCue(cue: AudioCue): void {
  if (muted) return;

  switch (cue) {
    case "key":
      tone(880, 28, "square", 0.025);
      break;
    case "beep":
      tone(660, 90, "sine", 0.04);
      break;
    case "confirm":
      tone(520, 70, "triangle", 0.035);
      tone(780, 90, "triangle", 0.03, 0.08);
      break;
    case "success":
      tone(440, 70, "triangle", 0.035);
      tone(660, 80, "triangle", 0.032, 0.09);
      tone(880, 110, "triangle", 0.03, 0.18);
      break;
    case "unlock":
      tone(520, 90, "sine", 0.04);
      tone(780, 140, "sine", 0.035, 0.1);
      break;
    case "relay":
      tone(240, 50, "sawtooth", 0.02);
      tone(360, 60, "sawtooth", 0.018, 0.06);
      tone(480, 70, "sawtooth", 0.015, 0.12);
      break;
    case "print":
      tone(1400, 18, "square", 0.015);
      tone(1100, 18, "square", 0.012, 0.04);
      break;
    case "error":
      tone(180, 160, "sawtooth", 0.05);
      tone(140, 180, "sawtooth", 0.04, 0.1);
      break;
    default:
      tone(600, 60, "sine", 0.03);
  }
}
