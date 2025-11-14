/**
 * SoundSystem - Audio management for Phase 3
 * Handles combat sounds, UI feedback, and ambient audio
 */

import { Audio } from 'expo-av';
import { logger } from '../utils/Logger';

interface SoundEffect {
  id: string;
  sound: Audio.Sound | null;
  volume: number;
  duration: number;
  isLoaded: boolean;
  isPlaying: boolean;
}

interface MusicTrack {
  id: string;
  sound: Audio.Sound | null;
  volume: number;
  isLoaded: boolean;
  isPlaying: boolean;
  shouldLoop: boolean;
}

export type SoundType = 
  | 'laser_fire'
  | 'explosion_small'
  | 'explosion_large'
  | 'ship_move'
  | 'ship_select'
  | 'mothership_dock'
  | 'mothership_undock'
  | 'ui_tap'
  | 'ui_error'
  | 'ui_success'
  | 'combat_hit'
  | 'debris_impact';

export type MusicType = 
  | 'main_theme'
  | 'combat_music'
  | 'ambient_space';

export class SoundSystem {
  private soundEffects: Map<SoundType, SoundEffect> = new Map();
  private musicTracks: Map<MusicType, MusicTrack> = new Map();
  private masterVolume: number = 1.0;
  private effectsVolume: number = 0.8;
  private musicVolume: number = 0.6;
  private isEnabled: boolean = true;
  private currentMusic: MusicType | null = null;

  // Sound file paths (would be actual audio files in production)
  private soundPaths: Record<SoundType, string> = {
    laser_fire: 'assets/sounds/laser_fire.mp3',
    explosion_small: 'assets/sounds/explosion_small.mp3',
    explosion_large: 'assets/sounds/explosion_large.mp3',
    ship_move: 'assets/sounds/ship_move.mp3',
    ship_select: 'assets/sounds/ship_select.mp3',
    mothership_dock: 'assets/sounds/mothership_dock.mp3',
    mothership_undock: 'assets/sounds/mothership_undock.mp3',
    ui_tap: 'assets/sounds/ui_tap.mp3',
    ui_error: 'assets/sounds/ui_error.mp3',
    ui_success: 'assets/sounds/ui_success.mp3',
    combat_hit: 'assets/sounds/combat_hit.mp3',
    debris_impact: 'assets/sounds/debris_impact.mp3'
  };

  private musicPaths: Record<MusicType, string> = {
    main_theme: 'assets/music/main_theme.mp3',
    combat_music: 'assets/music/combat_music.mp3',
    ambient_space: 'assets/music/ambient_space.mp3'
  };

  /**
   * Initialize the sound system
   */
  async initialize(): Promise<void> {
    try {
      // Set audio mode for games
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        interruptionModeIOS: Audio.INTERRUPTION_MODE_IOS_DO_NOT_MIX,
        shouldDuckAndroid: true,
        interruptionModeAndroid: Audio.INTERRUPTION_MODE_ANDROID_DO_NOT_MIX,
        playThroughEarpieceAndroid: false
      });

      // Load essential sound effects
      await this.loadEssentialSounds();

      logger.info('AUDIO', 'SoundSystem initialized');
    } catch (error) {
      logger.error('AUDIO', 'Failed to initialize SoundSystem', error);
    }
  }

  /**
   * Play a sound effect
   */
  async playSound(soundType: SoundType, volume: number = 1.0): Promise<void> {
    if (!this.isEnabled) return;

    try {
      let soundEffect = this.soundEffects.get(soundType);

      if (!soundEffect) {
        // Load sound on demand
        soundEffect = await this.loadSoundEffect(soundType);
        if (!soundEffect) return;
      }

      if (soundEffect.isPlaying) {
        // Stop current instance and restart
        await soundEffect.sound?.stopAsync();
        await soundEffect.sound?.setPositionAsync(0);
      }

      const finalVolume = this.masterVolume * this.effectsVolume * volume * soundEffect.volume;
      await soundEffect.sound?.setVolumeAsync(finalVolume);
      await soundEffect.sound?.playAsync();

      soundEffect.isPlaying = true;

      // Track when sound finishes
      soundEffect.sound?.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && !status.isPlaying) {
          soundEffect!.isPlaying = false;
        }
      });

      logger.debug('AUDIO', 'Sound played', { soundType, volume: finalVolume });
    } catch (error) {
      logger.error('AUDIO', 'Failed to play sound', { soundType, error });
    }
  }

  /**
   * Play background music
   */
  async playMusic(musicType: MusicType, fadeIn: boolean = true): Promise<void> {
    if (!this.isEnabled) return;

    try {
      // Stop current music
      if (this.currentMusic) {
        await this.stopMusic(true);
      }

      let musicTrack = this.musicTracks.get(musicType);

      if (!musicTrack) {
        musicTrack = await this.loadMusicTrack(musicType);
        if (!musicTrack) return;
      }

      const finalVolume = this.masterVolume * this.musicVolume * musicTrack.volume;

      if (fadeIn) {
        await musicTrack.sound?.setVolumeAsync(0);
        await musicTrack.sound?.playAsync();
        
        // Fade in over 2 seconds
        this.fadeVolume(musicTrack.sound, 0, finalVolume, 2000);
      } else {
        await musicTrack.sound?.setVolumeAsync(finalVolume);
        await musicTrack.sound?.playAsync();
      }

      musicTrack.isPlaying = true;
      this.currentMusic = musicType;

      logger.info('AUDIO', 'Music started', { musicType, fadeIn });
    } catch (error) {
      logger.error('AUDIO', 'Failed to play music', { musicType, error });
    }
  }

  /**
   * Stop background music
   */
  async stopMusic(fadeOut: boolean = true): Promise<void> {
    if (!this.currentMusic) return;

    try {
      const musicTrack = this.musicTracks.get(this.currentMusic);
      if (!musicTrack || !musicTrack.sound) return;

      if (fadeOut) {
        const currentStatus = await musicTrack.sound.getStatusAsync();
        if (currentStatus.isLoaded) {
          const currentVolume = currentStatus.volume || 0;
          await this.fadeVolume(musicTrack.sound, currentVolume, 0, 1000);
        }
        await musicTrack.sound.stopAsync();
      } else {
        await musicTrack.sound.stopAsync();
      }

      musicTrack.isPlaying = false;
      this.currentMusic = null;

      logger.info('AUDIO', 'Music stopped', { fadeOut });
    } catch (error) {
      logger.error('AUDIO', 'Failed to stop music', error);
    }
  }

  /**
   * Set master volume (0.0 to 1.0)
   */
  setMasterVolume(volume: number): void {
    this.masterVolume = Math.max(0, Math.min(1, volume));
    
    // Update currently playing sounds
    this.updateAllVolumes();
    
    logger.debug('AUDIO', 'Master volume changed', { volume: this.masterVolume });
  }

  /**
   * Set effects volume (0.0 to 1.0)
   */
  setEffectsVolume(volume: number): void {
    this.effectsVolume = Math.max(0, Math.min(1, volume));
    logger.debug('AUDIO', 'Effects volume changed', { volume: this.effectsVolume });
  }

  /**
   * Set music volume (0.0 to 1.0)
   */
  setMusicVolume(volume: number): void {
    this.musicVolume = Math.max(0, Math.min(1, volume));
    
    // Update current music volume
    if (this.currentMusic) {
      const musicTrack = this.musicTracks.get(this.currentMusic);
      if (musicTrack && musicTrack.sound) {
        const finalVolume = this.masterVolume * this.musicVolume * musicTrack.volume;
        musicTrack.sound.setVolumeAsync(finalVolume);
      }
    }
    
    logger.debug('AUDIO', 'Music volume changed', { volume: this.musicVolume });
  }

  /**
   * Enable or disable all audio
   */
  async setEnabled(enabled: boolean): Promise<void> {
    this.isEnabled = enabled;
    
    if (!enabled) {
      // Stop all playing sounds and music
      for (const [, effect] of this.soundEffects) {
        if (effect.isPlaying) {
          await effect.sound?.stopAsync();
          effect.isPlaying = false;
        }
      }
      
      if (this.currentMusic) {
        await this.stopMusic(false);
      }
    }
    
    logger.info('AUDIO', 'Sound system enabled state changed', { enabled });
  }

  /**
   * Get current audio settings
   */
  getSettings(): {
    masterVolume: number;
    effectsVolume: number;
    musicVolume: number;
    isEnabled: boolean;
    currentMusic: MusicType | null;
  } {
    return {
      masterVolume: this.masterVolume,
      effectsVolume: this.effectsVolume,
      musicVolume: this.musicVolume,
      isEnabled: this.isEnabled,
      currentMusic: this.currentMusic
    };
  }

  /**
   * Preload specific sounds for better performance
   */
  async preloadSounds(soundTypes: SoundType[]): Promise<void> {
    const loadPromises = soundTypes.map(soundType => this.loadSoundEffect(soundType));
    await Promise.all(loadPromises);
    
    logger.info('AUDIO', 'Sounds preloaded', { count: soundTypes.length });
  }

  /**
   * Cleanup and destroy
   */
  async destroy(): Promise<void> {
    // Stop and unload all sounds
    for (const [, effect] of this.soundEffects) {
      if (effect.sound) {
        await effect.sound.unloadAsync();
      }
    }

    // Stop and unload all music
    for (const [, track] of this.musicTracks) {
      if (track.sound) {
        await track.sound.unloadAsync();
      }
    }

    this.soundEffects.clear();
    this.musicTracks.clear();
    this.currentMusic = null;

    logger.info('AUDIO', 'SoundSystem destroyed');
  }

  // Private methods

  private async loadEssentialSounds(): Promise<void> {
    const essentialSounds: SoundType[] = [
      'ui_tap',
      'ship_select',
      'laser_fire',
      'explosion_small'
    ];

    await this.preloadSounds(essentialSounds);
  }

  private async loadSoundEffect(soundType: SoundType): Promise<SoundEffect | null> {
    try {
      // In a real app, this would load actual audio files
      // For now, we'll create placeholder sound objects
      
      const soundEffect: SoundEffect = {
        id: soundType,
        sound: null, // Would be: await Audio.Sound.createAsync({ uri: this.soundPaths[soundType] })
        volume: this.getDefaultVolumeForSound(soundType),
        duration: this.getDefaultDurationForSound(soundType),
        isLoaded: true, // Would be based on actual loading
        isPlaying: false
      };

      this.soundEffects.set(soundType, soundEffect);
      
      logger.debug('AUDIO', 'Sound effect loaded', { soundType });
      return soundEffect;
    } catch (error) {
      logger.error('AUDIO', 'Failed to load sound effect', { soundType, error });
      return null;
    }
  }

  private async loadMusicTrack(musicType: MusicType): Promise<MusicTrack | null> {
    try {
      // In a real app, this would load actual music files
      
      const musicTrack: MusicTrack = {
        id: musicType,
        sound: null, // Would be: await Audio.Sound.createAsync({ uri: this.musicPaths[musicType] })
        volume: 1.0,
        isLoaded: true,
        isPlaying: false,
        shouldLoop: true
      };

      this.musicTracks.set(musicType, musicTrack);
      
      logger.debug('AUDIO', 'Music track loaded', { musicType });
      return musicTrack;
    } catch (error) {
      logger.error('AUDIO', 'Failed to load music track', { musicType, error });
      return null;
    }
  }

  private async fadeVolume(
    sound: Audio.Sound | null,
    fromVolume: number,
    toVolume: number,
    duration: number
  ): Promise<void> {
    if (!sound) return;

    const steps = 20;
    const stepDuration = duration / steps;
    const volumeStep = (toVolume - fromVolume) / steps;

    for (let i = 0; i <= steps; i++) {
      const currentVolume = fromVolume + (volumeStep * i);
      await sound.setVolumeAsync(currentVolume);
      
      if (i < steps) {
        await new Promise(resolve => setTimeout(resolve, stepDuration));
      }
    }
  }

  private async updateAllVolumes(): Promise<void> {
    // Update all playing sound effects
    this.soundEffects.forEach(async (effect) => {
      if (effect.isPlaying && effect.sound) {
        const finalVolume = this.masterVolume * this.effectsVolume * effect.volume;
        await effect.sound.setVolumeAsync(finalVolume);
      }
    });

    // Update current music
    if (this.currentMusic) {
      const musicTrack = this.musicTracks.get(this.currentMusic);
      if (musicTrack && musicTrack.sound && musicTrack.isPlaying) {
        const finalVolume = this.masterVolume * this.musicVolume * musicTrack.volume;
        await musicTrack.sound.setVolumeAsync(finalVolume);
      }
    }
  }

  private getDefaultVolumeForSound(soundType: SoundType): number {
    // Different sounds have different default volumes
    switch (soundType) {
      case 'explosion_large': return 0.9;
      case 'explosion_small': return 0.7;
      case 'laser_fire': return 0.6;
      case 'combat_hit': return 0.8;
      case 'ship_move': return 0.4;
      case 'ui_tap': return 0.5;
      case 'ui_error': return 0.7;
      case 'ui_success': return 0.6;
      default: return 0.5;
    }
  }

  private getDefaultDurationForSound(soundType: SoundType): number {
    // Approximate durations in milliseconds
    switch (soundType) {
      case 'explosion_large': return 2000;
      case 'explosion_small': return 1000;
      case 'laser_fire': return 300;
      case 'combat_hit': return 200;
      case 'ship_move': return 800;
      case 'ui_tap': return 100;
      default: return 500;
    }
  }
}

// Global sound system instance
export const soundSystem = new SoundSystem();