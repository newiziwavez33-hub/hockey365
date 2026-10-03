/**
 * Hockey365 Web Audio Sound Engine
 * Synthesizes goal horn and whistle tones without external audio file dependencies
 */

import { store } from './store.js';

let sharedAudioCtx = null;

function getAudioContext() {
  if (!sharedAudioCtx && (window.AudioContext || window.webkitAudioContext)) {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    sharedAudioCtx = new AudioCtx();
  }
  if (sharedAudioCtx && sharedAudioCtx.state === 'suspended') {
    sharedAudioCtx.resume().catch(() => {});
  }
  return sharedAudioCtx;
}

/**
 * Play authentic hockey goal siren / horn
 */
export function playGoalHorn() {
  if (!store.isSoundEnabled()) return;

  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const t = ctx.currentTime;

    // Dual-tone layered horn
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const subOsc = ctx.createOscillator();
    const gainNode = ctx.createGain();

    osc1.type = 'sawtooth';
    osc1.frequency.setValueAtTime(220, t);
    osc1.frequency.linearRampToValueAtTime(320, t + 0.12);
    osc1.frequency.setValueAtTime(320, t + 0.5);
    osc1.frequency.exponentialRampToValueAtTime(220, t + 0.75);

    osc2.type = 'sawtooth';
    osc2.frequency.setValueAtTime(330, t);
    osc2.frequency.linearRampToValueAtTime(480, t + 0.12);
    osc2.frequency.setValueAtTime(480, t + 0.5);
    osc2.frequency.exponentialRampToValueAtTime(330, t + 0.75);

    subOsc.type = 'sine';
    subOsc.frequency.setValueAtTime(110, t);

    gainNode.gain.setValueAtTime(0.001, t);
    gainNode.gain.linearRampToValueAtTime(0.2, t + 0.05);
    gainNode.gain.setValueAtTime(0.2, t + 0.55);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, t + 0.8);

    osc1.connect(gainNode);
    osc2.connect(gainNode);
    subOsc.connect(gainNode);
    gainNode.connect(ctx.destination);

    osc1.start(t);
    osc2.start(t);
    subOsc.start(t);

    osc1.stop(t + 0.85);
    osc2.stop(t + 0.85);
    subOsc.stop(t + 0.85);
  } catch (err) {
    // Silently handle autoplay policy
  }
}

/**
 * Play gentle notification chime
 */
export function playChime() {
  if (!store.isSoundEnabled()) return;

  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, t); // D5
    osc.frequency.setValueAtTime(880, t + 0.1); // A5

    gainNode.gain.setValueAtTime(0.12, t);
    gainNode.gain.exponentialRampToValueAtTime(0.001, t + 0.4);

    osc.connect(gainNode);
    gainNode.connect(ctx.destination);

    osc.start(t);
    osc.stop(t + 0.45);
  } catch (err) {}
}
