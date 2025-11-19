import Phaser from 'phaser';

/**
 * Audio system for procedural sound generation
 * Uses Web Audio API to generate sounds without requiring audio files
 */
export class AudioSystem {
  private audioContext: AudioContext | null = null;
  private masterVolume: number = 0.3;
  private menuMusic: Phaser.Sound.BaseSound | null = null;

  constructor() {
    // Initialize audio context (lazy initialization)
    try {
      this.audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    } catch (error) {
      console.warn('Web Audio API not supported:', error);
    }
  }

  /**
   * Play fire sound (MS-DOS style - short beep)
   */
  public playFire(): void {
    // MS-DOS style: short high-pitched beep
    this.playTone(800, 0.05, 'square', 0.3);
    // Quick second beep for "click" effect
    setTimeout(() => {
      this.playTone(600, 0.03, 'square', 0.2);
    }, 30);
  }

  /**
   * Play explosion sound (MS-DOS style - low rumble)
   * Generic method - calls weapon-specific explosion
   */
  public playExplosion(weaponType: string = 'standard'): void {
    switch (weaponType) {
      case 'salvo':
        this.playSalvoExplosion();
        break;
      case 'hazelnut':
        this.playHazelnutExplosion();
        break;
      default:
        this.playStandardExplosion();
        break;
    }
  }

  /**
   * Standard explosion - balanced rumble
   */
  private playStandardExplosion(): void {
    // MS-DOS style: low frequency rumble with descending tones
    this.playTone(100, 0.2, 'square', 0.5);
    setTimeout(() => {
      this.playTone(80, 0.15, 'square', 0.4);
    }, 50);
    setTimeout(() => {
      this.playTone(60, 0.1, 'square', 0.3);
    }, 100);
    // High frequency "pop" at the end
    setTimeout(() => {
      this.playTone(200, 0.05, 'square', 0.2);
    }, 150);
  }

  /**
   * Salvo explosion - sharp, quick blast
   */
  private playSalvoExplosion(): void {
    // Sharper, faster explosion with higher frequencies
    this.playTone(150, 0.12, 'sawtooth', 0.5);
    setTimeout(() => {
      this.playTone(120, 0.1, 'sawtooth', 0.45);
    }, 30);
    setTimeout(() => {
      this.playTone(90, 0.08, 'sawtooth', 0.35);
    }, 60);
    // Sharp crack at the end
    setTimeout(() => {
      this.playTone(300, 0.04, 'square', 0.3);
    }, 90);
  }

  /**
   * Hazelnut explosion - deep kinetic impact
   */
  private playHazelnutExplosion(): void {
    // Deep impact with penetration sound
    // Initial heavy thud
    this.playTone(70, 0.25, 'triangle', 0.6);
    setTimeout(() => {
      this.playTone(50, 0.2, 'triangle', 0.5);
    }, 60);
    // Penetration "crack"
    setTimeout(() => {
      this.playTone(250, 0.08, 'square', 0.4);
    }, 120);
    // Deep rumble
    setTimeout(() => {
      this.playTone(40, 0.15, 'triangle', 0.4);
    }, 180);
  }

  /**
   * Play impact sound (MS-DOS style - short click)
   */
  public playImpact(): void {
    // MS-DOS style: short click sound
    this.playTone(300, 0.08, 'square', 0.25);
    setTimeout(() => {
      this.playTone(200, 0.05, 'square', 0.15);
    }, 40);
  }

  /**
   * Play projectile flight sound (MS-DOS style - simple tone)
   * Returns an object with stop() method to stop the sound
   */
  public playProjectileFlight(): { stop: () => void } {
    if (!this.audioContext) {
      return { stop: () => {} };
    }

    try {
      const oscillator = this.audioContext.createOscillator();
      const gainNode = this.audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(this.audioContext.destination);

      // MS-DOS style: simple square wave tone - fast whoosh sound
      oscillator.type = 'square';
      oscillator.frequency.value = 800; // higher pitch for faster feeling

      // Low volume continuous sound with simple envelope
      gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.1 * this.masterVolume, this.audioContext.currentTime + 0.01);
      
      // Fast frequency drop for whoosh effect (matches fast projectile)
      oscillator.frequency.setValueAtTime(800, this.audioContext.currentTime);
      oscillator.frequency.linearRampToValueAtTime(400, this.audioContext.currentTime + 0.08); // 0.3 -> 0.08 (much faster)

      oscillator.start(this.audioContext.currentTime);

      return {
        stop: () => {
          try {
            gainNode.gain.linearRampToValueAtTime(0, this.audioContext!.currentTime + 0.05);
            oscillator.stop(this.audioContext!.currentTime + 0.05);
          } catch {
            // Ignore errors when stopping
          }
        },
      };
    } catch (error) {
      console.warn('Error playing projectile flight sound:', error);
      return { stop: () => {} };
    }
  }

  /**
   * Play a tone using Web Audio API (MS-DOS style - sharp, simple)
   */
  private playTone(
    frequency: number,
    duration: number,
    type: OscillatorType = 'square',
    volume: number = 0.3
  ): void {
    if (!this.audioContext) {
      return;
    }

    try {
      const oscillator = this.audioContext.createOscillator();
      const gainNode = this.audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(this.audioContext.destination);

      // MS-DOS style: prefer square waves (like PC speaker)
      oscillator.type = type;
      oscillator.frequency.value = frequency;

      // MS-DOS style: sharp attack, quick decay (less smooth)
      gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
      gainNode.gain.linearRampToValueAtTime(volume * this.masterVolume, this.audioContext.currentTime + 0.005);
      // Quick decay for sharp MS-DOS sound
      gainNode.gain.linearRampToValueAtTime(volume * this.masterVolume * 0.7, this.audioContext.currentTime + duration * 0.7);
      gainNode.gain.linearRampToValueAtTime(0.01, this.audioContext.currentTime + duration);

      oscillator.start(this.audioContext.currentTime);
      oscillator.stop(this.audioContext.currentTime + duration);
    } catch (error) {
      console.warn('Error playing sound:', error);
    }
  }

  /**
   * Set master volume (0.0 to 1.0)
   */
  public setVolume(volume: number): void {
    this.masterVolume = Math.max(0, Math.min(1, volume));
  }

  /**
   * Get master volume
   */
  public getVolume(): number {
    return this.masterVolume;
  }

  /**
   * Resume audio context (required after user interaction)
   */
  public resume(): void {
    if (this.audioContext && this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }
  }

  /**
   * Check if menu music is already playing
   * Uses game.sound instead of scene.sound to persist across scene restarts
   */
  public isMenuMusicPlaying(scene: Phaser.Scene): boolean {
    console.log('[AudioSystem] isMenuMusicPlaying() called');
    try {
      // Check if we have a music instance that's playing
      if (this.menuMusic) {
        console.log(`[AudioSystem] this.menuMusic exists, isPlaying: ${this.menuMusic.isPlaying}`);
        if (this.menuMusic.isPlaying) {
          console.log('[AudioSystem] Music is already playing (from this.menuMusic)');
          return true;
        }
      } else {
        console.log('[AudioSystem] this.menuMusic is null/undefined');
      }

      // Check if music is already playing in game sound manager (persists across scene restarts)
      try {
        interface SoundManagerWithSounds extends Phaser.Sound.BaseSoundManager {
          sounds?: Phaser.Sound.BaseSound[];
        }
        // Use game.sound instead of scene.sound - game object persists across scene restarts
        const soundManager = scene.game.sound as SoundManagerWithSounds;
        console.log(`[AudioSystem] Checking game.sound, sounds array exists: ${!!soundManager.sounds}`);
        if (soundManager.sounds) {
          console.log(`[AudioSystem] game.sound.sounds.length: ${soundManager.sounds.length}`);
          const allMenuMusic = soundManager.sounds.filter((sound: Phaser.Sound.BaseSound) => {
            return sound.key === 'menu-music';
          });
          console.log(`[AudioSystem] Found ${allMenuMusic.length} sound(s) with key 'menu-music'`);
          allMenuMusic.forEach((sound: Phaser.Sound.BaseSound, index: number) => {
            console.log(`[AudioSystem]   menu-music[${index}]: isPlaying=${sound.isPlaying}, isPaused=${sound.isPaused}`);
          });
          
          const existingMusic = soundManager.sounds.find((sound: Phaser.Sound.BaseSound) => {
            return sound.key === 'menu-music' && sound.isPlaying;
          });
          if (existingMusic) {
            console.log('[AudioSystem] Found playing music in game.sound, updating reference');
            // Update our reference to the existing music
            this.menuMusic = existingMusic as Phaser.Sound.BaseSound;
            return true;
          } else {
            console.log('[AudioSystem] No playing music found in game.sound');
          }
        } else {
          console.log('[AudioSystem] game.sound.sounds is undefined');
        }
      } catch (error) {
        console.error('[AudioSystem] Error checking game.sound:', error);
      }

      console.log('[AudioSystem] Music is not playing');
      return false;
    } catch (error) {
      console.error('[AudioSystem] Error in isMenuMusicPlaying:', error);
      return false;
    }
  }

  /**
   * Play menu music (if loaded)
   * Checks for existing music instance and reuses it if available
   * Uses game.sound instead of scene.sound to persist across scene restarts
   */
  public playMenuMusic(scene: Phaser.Scene): void {
    console.log('[AudioSystem] playMenuMusic() called');
    try {
      // Check if music is already playing - if so, don't restart it
      const isPlaying = this.isMenuMusicPlaying(scene);
      console.log(`[AudioSystem] isMenuMusicPlaying() returned: ${isPlaying}`);
      if (isPlaying) {
        console.log('[AudioSystem] Music is already playing, skipping playMenuMusic()');
        return;
      }

      // Check if music was loaded in cache
      const musicInCache = scene.cache.audio.exists('menu-music');
      console.log(`[AudioSystem] Music in cache: ${musicInCache}`);
      if (!musicInCache) {
        console.warn('[AudioSystem] Menu music not found in cache. Make sure file is in public/assets/sounds/arcade_puzzler.ogg');
        return;
      }

      // Check if music exists but is stopped - resume it instead of creating new instance
      // Use game.sound instead of scene.sound - game object persists across scene restarts
      try {
        interface SoundManagerWithSounds extends Phaser.Sound.BaseSoundManager {
          sounds?: Phaser.Sound.BaseSound[];
        }
        const soundManager = scene.game.sound as SoundManagerWithSounds;
        console.log(`[AudioSystem] Checking game.sound for existing stopped music, sounds exists: ${!!soundManager.sounds}`);
        if (soundManager.sounds) {
          const existingMusic = soundManager.sounds.find((sound: Phaser.Sound.BaseSound) => {
            return sound.key === 'menu-music';
          });
          if (existingMusic) {
            console.log(`[AudioSystem] Found existing music in game.sound (isPlaying: ${existingMusic.isPlaying}), resuming it`);
            // Music exists but is stopped - resume it
            this.menuMusic = existingMusic as Phaser.Sound.BaseSound;
            if (!this.menuMusic.isPlaying) {
              console.log('[AudioSystem] Resuming existing music');
              this.menuMusic.play();
            } else {
              console.log('[AudioSystem] Existing music is already playing');
            }
            return;
          } else {
            console.log('[AudioSystem] No existing music found in game.sound');
          }
        }
      } catch (error) {
        console.error('[AudioSystem] Error checking for existing music:', error);
        // Continue to create new instance
      }
      
      // If we have a music instance but it's stopped, restart it
      if (this.menuMusic) {
        console.log(`[AudioSystem] this.menuMusic exists (isPlaying: ${this.menuMusic.isPlaying})`);
        if (this.menuMusic.isPlaying) {
          console.log('[AudioSystem] this.menuMusic is already playing, returning');
          return;
        } else {
          console.log('[AudioSystem] Restarting this.menuMusic');
          // Music was stopped, restart it
          this.menuMusic.play();
          return;
        }
      }
      
      // Create new music instance using game.sound (persists across scene restarts)
      console.log('[AudioSystem] Creating NEW music instance using game.sound');
      this.menuMusic = scene.game.sound.add('menu-music', {
        volume: 0.5, // Adjust volume (0.0 to 1.0)
        loop: true,  // Loop the music
      });
      
      // Play music
      console.log('[AudioSystem] Playing new music instance');
      this.menuMusic.play();
      console.log(`[AudioSystem] Music play() called, isPlaying: ${this.menuMusic.isPlaying}`);
    } catch (error) {
      // Music not loaded or error playing
      console.error('[AudioSystem] Error playing menu music:', error);
    }
  }

  /**
   * Stop menu music
   */
  public stopMenuMusic(): void {
    console.log('[AudioSystem] stopMenuMusic() called');
    if (this.menuMusic) {
      console.log(`[AudioSystem] this.menuMusic exists, isPlaying: ${this.menuMusic.isPlaying}`);
      if (this.menuMusic.isPlaying) {
        console.log('[AudioSystem] Stopping music');
        this.menuMusic.stop();
        console.log(`[AudioSystem] Music stopped, isPlaying: ${this.menuMusic.isPlaying}`);
      } else {
        console.log('[AudioSystem] Music is not playing, nothing to stop');
      }
      // Don't destroy the sound object, just stop it
      // It will be reused when returning to menu
    } else {
      console.log('[AudioSystem] this.menuMusic is null/undefined, nothing to stop');
    }
  }
}

