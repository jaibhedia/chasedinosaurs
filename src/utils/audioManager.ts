import { Howl, Howler } from 'howler';

const MUTE_KEY = 'chase-muted';
const MUSIC_KEY = 'chase-music';
const RATE = 22050;

/** One synthesized note: frequency (optionally sweeping to `to`), start and length in seconds. */
interface Note { f: number; to?: number; t: number; d: number; w: 'sine' | 'square' | 'triangle'; g?: number }

/**
 * Render notes to a WAV blob URL. Pure sample math: no AudioContext, of which browsers
 * allow only a handful per page (the old code opened one per sound).
 */
function synth(notes: Note[], noise?: { start: number; dur: number; gain: number }): string {
  const length = Math.max(...notes.map((n) => n.t + n.d), noise ? noise.start + noise.dur : 0);
  const n = Math.ceil(length * RATE);
  const out = new Float32Array(n);
  for (const note of notes) {
    const i0 = Math.floor(note.t * RATE);
    const len = Math.floor(note.d * RATE);
    let phase = 0;
    for (let i = 0; i < len && i0 + i < n; i++) {
      const p = i / len;
      const f = note.to ? note.f + (note.to - note.f) * p : note.f;
      phase += f / RATE;
      const x = phase % 1;
      const v = note.w === 'sine' ? Math.sin(2 * Math.PI * x) : note.w === 'square' ? (x < 0.5 ? 1 : -1) : 4 * Math.abs(x - 0.5) - 1;
      // 5ms attack, then a curved decay: plucky instead of a flat beep.
      const env = Math.min(1, i / (RATE * 0.005)) * Math.pow(1 - p, 1.6);
      out[i0 + i] += v * env * (note.g ?? 0.35);
    }
  }
  if (noise) {
    const i0 = Math.floor(noise.start * RATE);
    const len = Math.floor(noise.dur * RATE);
    for (let i = 0; i < len && i0 + i < n; i++) out[i0 + i] += (Math.random() * 2 - 1) * noise.gain * (1 - i / len);
  }
  return toWavUrl(out);
}

function toWavUrl(samples: Float32Array): string {
  const buf = new ArrayBuffer(44 + samples.length * 2);
  const v = new DataView(buf);
  const str = (o: number, s: string) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  str(0, 'RIFF'); v.setUint32(4, 36 + samples.length * 2, true); str(8, 'WAVE');
  str(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, RATE, true); v.setUint32(28, RATE * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  str(36, 'data'); v.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) {
    const x = Math.max(-1, Math.min(1, samples[i]));
    v.setInt16(44 + i * 2, x < 0 ? x * 0x8000 : x * 0x7fff, true);
  }
  return URL.createObjectURL(new Blob([buf], { type: 'audio/wav' }));
}

class AudioManager {
  private static instance: AudioManager;
  private sounds: Map<string, Howl> = new Map();
  private musicVolume: number = 0.3;
  private sfxVolume: number = 0.5;
  public isMuted: boolean = false;
  /** Theme on/off toggle (HUD music button) — independent of the global mute. */
  private musicEnabled: boolean = true;
  private initialized: boolean = false;

  private constructor() {
    if (typeof window !== 'undefined') {
      Howler.autoUnlock = true;
      try {
        this.isMuted = localStorage.getItem(MUTE_KEY) === '1';
        this.musicEnabled = localStorage.getItem(MUSIC_KEY) !== '0';
      } catch { /* storage blocked: defaults */ }
      Howler.mute(this.isMuted);
    }
  }

  static getInstance(): AudioManager {
    if (!AudioManager.instance) {
      AudioManager.instance = new AudioManager();
    }
    return AudioManager.instance;
  }

  init() {
    if (typeof window === 'undefined' || this.initialized) return;
    this.initialized = true;

    // Real audio files (under the Vite base so they resolve in every build).
    const base = import.meta.env.BASE_URL;
    this.sounds.set('bgm-game', new Howl({
      src: [`${base}assets/audio/theme.mp3`],
      format: ['mp3'],
      loop: true,
      html5: true, // stream the theme instead of fully decoding it
      volume: this.musicVolume,
    }));
    this.sounds.set('power-use', new Howl({
      src: [`${base}assets/audio/powerup.mp3`],
      format: ['mp3'],
      volume: this.sfxVolume * 0.7,
    }));
    this.sounds.set('running', new Howl({
      src: [`${base}assets/audio/running.mp3`],
      format: ['mp3'],
      loop: true,
      volume: this.sfxVolume * 0.45,
    }));

    // Synthesized effects: short, enveloped chip-tune blips.
    const sfx = (name: string, notes: Note[], gain = 1, noise?: { start: number; dur: number; gain: number }) => {
      this.sounds.set(name, new Howl({ src: [synth(notes, noise)], format: ['wav'], volume: this.sfxVolume * gain }));
    };
    sfx('click', [{ f: 800, t: 0, d: 0.05, w: 'square', g: 0.25 }], 0.6);
    sfx('hover', [{ f: 620, t: 0, d: 0.04, w: 'sine', g: 0.3 }], 0.35);
    // You got the egg: a rising three-note flourish.
    sfx('grab', [
      { f: 523, t: 0, d: 0.08, w: 'triangle' },
      { f: 659, t: 0.06, d: 0.08, w: 'triangle' },
      { f: 988, t: 0.12, d: 0.16, w: 'triangle' },
    ], 0.9);
    // You lost it: a falling buzz with a thump.
    sfx('stolen', [{ f: 520, to: 160, t: 0, d: 0.3, w: 'square', g: 0.22 }], 0.9, { start: 0, dur: 0.06, gain: 0.35 });
    // The egg changed hands between others.
    sfx('handoff', [{ f: 660, to: 880, t: 0, d: 0.08, w: 'sine', g: 0.5 }], 0.6);
    sfx('beep', [{ f: 660, t: 0, d: 0.12, w: 'triangle' }], 0.7);
    sfx('go', [{ f: 988, t: 0, d: 0.3, w: 'triangle' }, { f: 1318, t: 0, d: 0.3, w: 'sine', g: 0.4 }], 0.8);
    // Last ten seconds.
    sfx('tick', [{ f: 1400, t: 0, d: 0.035, w: 'square', g: 0.2 }], 0.5);
    sfx('victory', [
      { f: 523, t: 0, d: 0.12, w: 'triangle' },
      { f: 659, t: 0.1, d: 0.12, w: 'triangle' },
      { f: 784, t: 0.2, d: 0.12, w: 'triangle' },
      { f: 1046, t: 0.3, d: 0.5, w: 'triangle' },
      { f: 784, t: 0.3, d: 0.5, w: 'sine', g: 0.4 },
    ], 0.8);
    sfx('defeat', [
      { f: 392, t: 0, d: 0.2, w: 'triangle' },
      { f: 349, t: 0.18, d: 0.2, w: 'triangle' },
      { f: 311, t: 0.36, d: 0.5, w: 'triangle' },
    ], 0.8);
  }

  play(soundName: string) {
    if (this.isMuted) return;
    const sound = this.sounds.get(soundName);
    if (sound) {
      sound.play();
    }
  }

  stop(soundName: string) {
    const sound = this.sounds.get(soundName);
    if (sound) {
      sound.stop();
    }
  }

  setMusicVolume(volume: number) {
    this.musicVolume = Math.max(0, Math.min(1, volume));
    this.sounds.forEach((sound, name) => {
      if (name.startsWith('bgm-')) {
        sound.volume(this.musicVolume * 0.5);
      }
    });
  }

  setSFXVolume(volume: number) {
    this.sfxVolume = Math.max(0, Math.min(1, volume));
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    Howler.mute(this.isMuted);
    try { localStorage.setItem(MUTE_KEY, this.isMuted ? '1' : '0'); } catch { /* not persisted */ }
    return this.isMuted;
  }

  getMuted() {
    return this.isMuted;
  }

  // ── Game theme (chase-8-bit) ──
  playTheme() {
    if (!this.musicEnabled) return;
    const t = this.sounds.get('bgm-game');
    if (t && !t.playing()) t.play();
  }

  stopTheme() {
    this.sounds.get('bgm-game')?.stop();
  }

  /** HUD start/stop button — flips the theme and returns the new on/off state. */
  toggleMusic(): boolean {
    this.musicEnabled = !this.musicEnabled;
    try { localStorage.setItem(MUSIC_KEY, this.musicEnabled ? '1' : '0'); } catch { /* not persisted */ }
    if (this.musicEnabled) this.playTheme();
    else this.stopTheme();
    return this.musicEnabled;
  }

  isMusicOn(): boolean {
    return this.musicEnabled;
  }

  // ── Running-on-grass loop (driven by player movement) ──
  startRunning() {
    const r = this.sounds.get('running');
    if (r && !r.playing()) r.play();
  }

  stopRunning() {
    const r = this.sounds.get('running');
    if (r && r.playing()) r.stop();
  }
}

export const audioManager = AudioManager.getInstance();
