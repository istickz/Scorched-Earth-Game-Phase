/**
 * Audio system for procedural sound generation
 * Uses Web Audio API to generate sounds without requiring audio files
 */
export class AudioSystem {
  private audioContext: AudioContext | null = null;
  private masterVolume: number = 0.3;

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
   */
  public playExplosion(): void {
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
}

