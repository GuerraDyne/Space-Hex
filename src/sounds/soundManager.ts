// Sound effect manager with placeholder support

export type SoundEffect =
  | 'thruster'
  | 'laser'
  | 'explosion'
  | 'ship_destroyed'
  | 'turn'
  | 'deploy'
  | 'dice_roll'
  | 'button_click'
  | 'victory'
  | 'defeat'
  | 'debris_enter'
  | 'turn_start'
  | 'countdown';

interface SoundConfig {
  volume: number;
  loop: boolean;
}

const SOUND_CONFIGS: Record<SoundEffect, SoundConfig> = {
  thruster: { volume: 0.3, loop: false },
  laser: { volume: 0.5, loop: false },
  explosion: { volume: 0.7, loop: false },
  ship_destroyed: { volume: 0.8, loop: false },
  turn: { volume: 0.2, loop: false },
  deploy: { volume: 0.4, loop: false },
  dice_roll: { volume: 0.5, loop: false },
  button_click: { volume: 0.3, loop: false },
  victory: { volume: 0.8, loop: false },
  defeat: { volume: 0.6, loop: false },
  debris_enter: { volume: 0.4, loop: false },
  turn_start: { volume: 0.5, loop: false },
  countdown: { volume: 0.6, loop: false },
};

class SoundManager {
  private audioContext: AudioContext | null = null;
  private sounds: Map<SoundEffect, AudioBuffer> = new Map();
  private isMuted: boolean = false;
  private masterVolume: number = 1.0;
  private isInitialized: boolean = false;

  async init(): Promise<void> {
    if (this.isInitialized) return;

    try {
      this.audioContext = new AudioContext();

      // Generate placeholder sounds using oscillator
      for (const effect of Object.keys(SOUND_CONFIGS) as SoundEffect[]) {
        const buffer = await this.generatePlaceholderSound(effect);
        this.sounds.set(effect, buffer);
      }

      this.isInitialized = true;
    } catch (error) {
      console.warn('Sound system initialization failed:', error);
    }
  }

  private async generatePlaceholderSound(effect: SoundEffect): Promise<AudioBuffer> {
    if (!this.audioContext) throw new Error('AudioContext not initialized');

    const sampleRate = this.audioContext.sampleRate;
    let duration = 0.3;
    let frequency = 440;
    let waveform: 'sine' | 'square' | 'sawtooth' | 'triangle' = 'sine';

    // Configure based on effect type
    switch (effect) {
      case 'thruster':
        duration = 0.5;
        frequency = 150;
        waveform = 'sawtooth';
        break;
      case 'laser':
        duration = 0.2;
        frequency = 1200;
        waveform = 'square';
        break;
      case 'explosion':
        duration = 0.8;
        frequency = 80;
        waveform = 'sawtooth';
        break;
      case 'ship_destroyed':
        duration = 1.0;
        frequency = 100;
        waveform = 'sawtooth';
        break;
      case 'turn':
        duration = 0.15;
        frequency = 600;
        waveform = 'sine';
        break;
      case 'deploy':
        duration = 0.3;
        frequency = 800;
        waveform = 'sine';
        break;
      case 'dice_roll':
        duration = 0.6;
        frequency = 500;
        waveform = 'triangle';
        break;
      case 'button_click':
        duration = 0.1;
        frequency = 1000;
        waveform = 'sine';
        break;
      case 'victory':
        duration = 1.5;
        frequency = 523; // C5
        waveform = 'sine';
        break;
      case 'defeat':
        duration = 1.0;
        frequency = 220;
        waveform = 'sine';
        break;
      case 'debris_enter':
        duration = 0.4;
        frequency = 200;
        waveform = 'triangle';
        break;
      case 'turn_start':
        duration = 0.3;
        frequency = 700;
        waveform = 'sine';
        break;
      case 'countdown':
        duration = 0.2;
        frequency = 880;
        waveform = 'sine';
        break;
    }

    const numSamples = Math.floor(sampleRate * duration);
    const buffer = this.audioContext.createBuffer(1, numSamples, sampleRate);
    const channelData = buffer.getChannelData(0);

    for (let i = 0; i < numSamples; i++) {
      const t = i / sampleRate;
      const envelope = Math.exp(-3 * t / duration); // Decay envelope

      let sample = 0;
      switch (waveform) {
        case 'sine':
          sample = Math.sin(2 * Math.PI * frequency * t);
          break;
        case 'square':
          sample = Math.sign(Math.sin(2 * Math.PI * frequency * t));
          break;
        case 'sawtooth':
          sample = 2 * ((frequency * t) % 1) - 1;
          break;
        case 'triangle':
          sample = 2 * Math.abs(2 * ((frequency * t) % 1) - 1) - 1;
          break;
      }

      // Add noise for explosion effects
      if (effect === 'explosion' || effect === 'ship_destroyed' || effect === 'debris_enter') {
        sample = sample * 0.3 + (Math.random() * 2 - 1) * 0.7;
      }

      channelData[i] = sample * envelope;
    }

    return buffer;
  }

  play(effect: SoundEffect): void {
    if (this.isMuted || !this.audioContext || !this.isInitialized) return;

    const buffer = this.sounds.get(effect);
    if (!buffer) return;

    const source = this.audioContext.createBufferSource();
    source.buffer = buffer;

    const gainNode = this.audioContext.createGain();
    const config = SOUND_CONFIGS[effect];
    gainNode.gain.value = config.volume * this.masterVolume;

    source.connect(gainNode);
    gainNode.connect(this.audioContext.destination);

    source.start(0);
    if (config.loop) {
      source.loop = true;
    }
  }

  setMuted(muted: boolean): void {
    this.isMuted = muted;
  }

  setVolume(volume: number): void {
    this.masterVolume = Math.max(0, Math.min(1, volume));
  }

  getMuted(): boolean {
    return this.isMuted;
  }

  getVolume(): number {
    return this.masterVolume;
  }
}

export const soundManager = new SoundManager();
