/**
 * Audio Engine for Locomotive LISA Experience
 * Uses /Locomotive.mp3 from the public directory
 */

class SoundEngine {
  constructor() {
    this.audio = null;
    this.isPlaying = false;
    this.targetVolume = 0.45;
    this.fadeInterval = null;
    this.ctx = null;
  }

  initAudio() {
    if (!this.audio) {
      this.audio = new Audio('./Locomotive.mp3');
      this.audio.loop = true;
      this.audio.volume = 0;
      this.audio.preload = 'auto';
    }
  }

  toggle() {
    this.initAudio();

    if (!this.isPlaying) {
      this.play();
      return true;
    } else {
      this.pause();
      return false;
    }
  }

  play() {
    this.initAudio();
    clearInterval(this.fadeInterval);

    this.audio.play().then(() => {
      this.isPlaying = true;
      // Smooth fade in
      this.fadeInterval = setInterval(() => {
        if (this.audio.volume < this.targetVolume - 0.04) {
          this.audio.volume = Math.min(this.targetVolume, this.audio.volume + 0.04);
        } else {
          this.audio.volume = this.targetVolume;
          clearInterval(this.fadeInterval);
        }
      }, 40);
    }).catch((err) => {
      console.warn('Audio playback error:', err);
    });
  }

  pause() {
    if (!this.audio) return;
    clearInterval(this.fadeInterval);

    // Smooth fade out
    this.fadeInterval = setInterval(() => {
      if (this.audio.volume > 0.04) {
        this.audio.volume = Math.max(0, this.audio.volume - 0.04);
      } else {
        this.audio.volume = 0;
        this.audio.pause();
        this.isPlaying = false;
        clearInterval(this.fadeInterval);
      }
    }, 35);
  }

  // Micro tactile interaction sounds
  initCtx() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) this.ctx = new AudioCtx();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  playClick() {
    this.initCtx();
    if (!this.ctx) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(280, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(90, this.ctx.currentTime + 0.05);

      gain.gain.setValueAtTime(0.015, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + 0.05);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.055);
    } catch (_) {}
  }

  playChime(freq = 520, volume = 0.025, duration = 0.3) {
    this.initCtx();
    if (!this.ctx) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(freq * 1.35, this.ctx.currentTime + duration);

      gain.gain.setValueAtTime(volume, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + duration);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + duration);
    } catch (_) {}
  }
}

export const sound = new SoundEngine();
