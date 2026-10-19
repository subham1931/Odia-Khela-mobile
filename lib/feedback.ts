// Match web wood/shell clicks. Native uses preloaded WAV + a player pool so
// rapid sow drops (and store drops) stay in time instead of spawning players.

import { Platform } from 'react-native';
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import { Directory, File, Paths } from 'expo-file-system';
import * as Haptics from 'expo-haptics';

// ---------------------------------------------------------------------------
// Web Audio (same algorithm as odiakhela-web/lib/feedback.ts)
// ---------------------------------------------------------------------------

let ctx: AudioContext | null = null;

function webAudio(): AudioContext | null {
  if (Platform.OS !== 'web' || typeof globalThis === 'undefined') return null;
  const g = globalThis as unknown as {
    AudioContext?: typeof AudioContext;
    webkitAudioContext?: typeof AudioContext;
  };
  const Ctor = g.AudioContext ?? g.webkitAudioContext;
  if (!Ctor) return null;
  ctx ??= new Ctor();
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

function webClack(freq: number, gain: number, delay = 0, decay = 0.07) {
  const ac = webAudio();
  if (!ac) return;
  const t = ac.currentTime + delay;

  const osc = ac.createOscillator();
  const og = ac.createGain();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(freq * (0.94 + Math.random() * 0.12), t);
  osc.frequency.exponentialRampToValueAtTime(freq * 0.55, t + decay);
  og.gain.setValueAtTime(gain, t);
  og.gain.exponentialRampToValueAtTime(0.0001, t + decay);
  osc.connect(og).connect(ac.destination);
  osc.start(t);
  osc.stop(t + decay + 0.02);

  const len = Math.floor(ac.sampleRate * 0.03);
  const buf = ac.createBuffer(1, len, ac.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 3;
  const noise = ac.createBufferSource();
  noise.buffer = buf;
  const bp = ac.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = freq * 3;
  bp.Q.value = 2.5;
  const ng = ac.createGain();
  ng.gain.value = gain * 0.9;
  noise.connect(bp).connect(ng).connect(ac.destination);
  noise.start(t);
}

// ---------------------------------------------------------------------------
// Native synthesis + player pool
// ---------------------------------------------------------------------------

const SAMPLE_RATE = 22050;

function encodeWav(samples: Float32Array, sampleRate: number): Uint8Array {
  const n = samples.length;
  const dataSize = n * 2;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);
  const writeStr = (offset: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i));
  };
  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, 'data');
  view.setUint32(40, dataSize, true);
  let o = 44;
  for (let i = 0; i < n; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(o, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    o += 2;
  }
  return new Uint8Array(buffer);
}

/** Deterministic triangle + noise clack (matches web character). */
function synthesizeClack(freq: number, gain: number, decay: number, seed = 1): Uint8Array {
  const duration = decay + 0.03;
  const n = Math.max(1, Math.floor(SAMPLE_RATE * duration));
  const samples = new Float32Array(n);
  const f0 = freq * 1.0;
  const f1 = freq * 0.55;
  let phase = 0;
  let rng = seed >>> 0;
  const rand = () => {
    rng = (rng * 1664525 + 1013904223) >>> 0;
    return rng / 0xffffffff;
  };

  for (let i = 0; i < n; i++) {
    const t = i / SAMPLE_RATE;
    const env = Math.exp((-Math.log(10000) * t) / Math.max(decay, 0.001)) * gain;
    const f = f0 * Math.pow(f1 / f0, Math.min(1, t / Math.max(decay, 0.001)));
    phase += f / SAMPLE_RATE;
    phase -= Math.floor(phase);
    const tri = phase < 0.5 ? phase * 4 - 1 : 3 - phase * 4;
    const noiseEnv = t < 0.03 ? (1 - t / 0.03) ** 3 : 0;
    const noise = (rand() * 2 - 1) * noiseEnv * gain * 0.85;
    samples[i] = tri * env * 1.35 + noise;
  }
  return encodeWav(samples, SAMPLE_RATE);
}

function sfxDir(): Directory {
  const dir = new Directory(Paths.cache, 'odiakhela-sfx-v2');
  if (!dir.exists) dir.create();
  return dir;
}

function writeClack(name: string, freq: number, gain: number, decay: number): string {
  const file = new File(sfxDir(), `${name}.wav`);
  if (!file.exists) {
    file.create();
    file.write(synthesizeClack(freq, gain, decay, name.length * 97 + Math.round(freq)));
  }
  return file.uri;
}

class PlayerPool {
  private players: AudioPlayer[] = [];
  private i = 0;
  private volume = 1;

  constructor(uri: string, size: number, volume: number) {
    this.volume = volume;
    for (let k = 0; k < size; k++) {
      const p = createAudioPlayer({ uri }, { updateInterval: 1000, keepAudioSessionActive: true });
      p.volume = volume;
      this.players.push(p);
    }
  }

  play(volume = this.volume) {
    const p = this.players[this.i % this.players.length];
    this.i += 1;
    try {
      p.volume = volume;
      // Restart from the beginning so overlapping drops work.
      void p.seekTo(0).then(() => {
        try {
          p.play();
        } catch {
          /* ignore */
        }
      });
    } catch {
      try {
        p.play();
      } catch {
        /* ignore */
      }
    }
  }

  dispose() {
    for (const p of this.players) {
      try {
        p.remove();
      } catch {
        /* ignore */
      }
    }
    this.players = [];
  }
}

type Banks = {
  drop: PlayerPool;
  store: PlayerPool;
  scoop: PlayerPool[];
  capture: PlayerPool[];
  turn: PlayerPool;
  win: PlayerPool[];
};

let banks: Banks | null = null;
let ready: Promise<void> | null = null;

async function ensureNative(): Promise<Banks | null> {
  if (webAudio()) return null;
  if (banks) return banks;
  if (!ready) {
    ready = (async () => {
      await setAudioModeAsync({
        playsInSilentMode: true,
        interruptionMode: 'mixWithOthers',
        shouldPlayInBackground: false,
        allowsRecording: false,
        shouldRouteThroughEarpiece: false,
      }).catch(() => undefined);

      // Pit drop: bright click (web drop @ 900Hz)
      const dropUri = writeClack('drop', 900, 0.22, 0.07);
      // Store drop: deeper thud so storing is distinct while sowing
      const storeUri = writeClack('store', 520, 0.26, 0.1);
      const scoopUris = [0, 1, 2, 3].map((i) => writeClack(`scoop${i}`, 520 + i * 55, 0.14, 0.05));
      const captureUris = [0, 1, 2, 3, 4].map((i) => writeClack(`cap${i}`, 1100 - i * 45, 0.2, 0.09));
      const turnUri = writeClack('turn', 420, 0.12, 0.12);
      const winUris = [0, 1, 2, 3].map((i) => writeClack(`win${i}`, 660 + i * 180, 0.24, 0.25));

      banks = {
        drop: new PlayerPool(dropUri, 8, 0.85),
        store: new PlayerPool(storeUri, 4, 0.95),
        scoop: scoopUris.map((u) => new PlayerPool(u, 2, 0.7)),
        capture: captureUris.map((u) => new PlayerPool(u, 2, 0.9)),
        turn: new PlayerPool(turnUri, 2, 0.65),
        win: winUris.map((u) => new PlayerPool(u, 1, 1)),
      };
    })();
  }
  await ready;
  return banks;
}

function nativeClack(
  kind: 'drop' | 'store' | 'scoop' | 'capture' | 'turn' | 'win',
  opts: { index?: number; delay?: number } = {},
) {
  const delay = opts.delay ?? 0;
  const index = opts.index ?? 0;
  const fire = () => {
    void ensureNative().then((b) => {
      if (!b) return;
      if (kind === 'drop') b.drop.play();
      else if (kind === 'store') b.store.play();
      else if (kind === 'scoop') b.scoop[index % b.scoop.length]?.play();
      else if (kind === 'capture') b.capture[index % b.capture.length]?.play();
      else if (kind === 'turn') b.turn.play();
      else if (kind === 'win') b.win[index % b.win.length]?.play();
    });
  };
  if (delay > 0) setTimeout(fire, delay * 1000);
  else fire();
}

function clack(freq: number, gain: number, delay = 0, decay = 0.07) {
  if (webAudio()) {
    webClack(freq, gain, delay, decay);
    return true;
  }
  return false;
}

export const sounds = {
  /** Seed landing in a pit while sowing. */
  drop: () => {
    if (clack(900, 0.18)) return;
    nativeClack('drop');
  },
  /** Seed landing in a store (Kalah / own store). Slightly deeper than a pit drop. */
  store: () => {
    if (clack(560, 0.2, 0, 0.1)) return;
    nativeClack('store');
  },
  /** Scooping counters out of a pit. */
  scoop: (count: number) => {
    const n = Math.min(6, Math.max(2, count));
    for (let i = 0; i < n; i++) {
      if (clack(520 + Math.random() * 200, 0.1, i * 0.022, 0.05)) continue;
      nativeClack('scoop', { index: i, delay: i * 0.022 });
    }
  },
  /** Capture burst. */
  capture: (count: number) => {
    const n = Math.min(10, Math.max(3, count));
    for (let i = 0; i < n; i++) {
      if (clack(1100 - i * 45, 0.16, i * 0.035, 0.09)) continue;
      nativeClack('capture', { index: i, delay: i * 0.035 });
    }
  },
  turn: () => {
    if (clack(420, 0.08, 0, 0.12)) return;
    nativeClack('turn');
  },
  win: () => {
    [0, 0.12, 0.24, 0.42].forEach((d, i) => {
      if (clack(660 + i * 180, 0.2, d, 0.25)) return;
      nativeClack('win', { index: i, delay: d });
    });
  },
};

/** Warm audio session + pools before the first move. */
export function prepareSounds() {
  if (webAudio()) {
    webAudio();
    return;
  }
  void ensureNative();
}

export async function vibrate(pattern: number | number[]) {
  try {
    if (typeof pattern === 'number') {
      await Haptics.impactAsync(
        pattern <= 20 ? Haptics.ImpactFeedbackStyle.Light : Haptics.ImpactFeedbackStyle.Medium,
      );
      return;
    }
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  } catch {
    // Simulator / unsupported devices skip haptics.
  }
}
