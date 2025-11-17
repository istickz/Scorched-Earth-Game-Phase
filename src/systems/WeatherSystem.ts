import Phaser from 'phaser';
import type { WeatherType, TimeOfDay } from '@/types';

/**
 * Weather system for rain and snow effects
 */
export class WeatherSystem {
  private scene: Phaser.Scene;
  private weatherType: WeatherType;
  private timeOfDay: TimeOfDay;
  private particleEmitter?: Phaser.GameObjects.Particles.ParticleEmitter;

  constructor(scene: Phaser.Scene, weatherType: WeatherType, timeOfDay: TimeOfDay = 'day') {
    this.scene = scene;
    this.weatherType = weatherType;
    this.timeOfDay = timeOfDay;
    
    if (weatherType !== 'none') {
      this.createWeatherParticles();
    }
  }

  /**
   * Create weather particle effects
   */
  private createWeatherParticles(): void {
    const width = this.scene.cameras.main.width;
    const height = this.scene.cameras.main.height;

    // Create simple particle texture for snow if it doesn't exist
    if (!this.scene.textures.exists('weather-particle')) {
      const graphics = this.scene.add.graphics();
      graphics.fillStyle(0xffffff);
      graphics.fillCircle(1, 1, 1);
      graphics.generateTexture('weather-particle', 2, 2);
      graphics.destroy();
    }

    // Create elongated rain drop texture if it doesn't exist
    // Force recreation by removing old texture first
    if (this.weatherType === 'rain') {
      if (this.scene.textures.exists('rain-drop')) {
        this.scene.textures.remove('rain-drop');
      }
      const graphics = this.scene.add.graphics();
      graphics.fillStyle(0xffffff);
      // Draw very thin and elongated drop shape (ultra-thin vertical ellipse, much longer base)
      graphics.fillEllipse(0.5, 0, 0.5, 64);
      graphics.generateTexture('rain-drop', 1, 64);
      graphics.destroy();
    }

    if (this.weatherType === 'rain') {
      this.createRain(width, height);
    } else if (this.weatherType === 'snow') {
      this.createSnow(width, height);
    }
  }

  /**
   * Create rain effect
   */
  private createRain(width: number, height: number): void {
    // Choose color based on time of day
    // Darker for day (more visible on light sky), lighter for night (more visible on dark sky)
    const rainColor = this.timeOfDay === 'day' ? 0x4477aa : 0xaaccff;
    
    this.particleEmitter = this.scene.add.particles(0, -10, 'rain-drop', {
      x: { min: 0, max: width },
      y: 0,
      lifespan: 1500, // Longer lifespan for slower rain
      speedY: { min: 300, max: 450 }, // Moderate falling speed
      speedX: { min: 200, max: 300 }, // More angled rain (stronger wind effect)
      scale: { start: 0.6, end: 0.5 }, // Very thin width
      scaleY: { start: 1.0, end: 0.9 }, // Use base texture size (already long)
      alpha: { start: 1.0, end: 0.9 }, // More opaque for better visibility
      tint: rainColor, // Color based on time of day
      frequency: 20, // Less frequent particles for lighter rain
      quantity: 3, // Particles per emission
      blendMode: this.timeOfDay === 'day' ? 'NORMAL' : 'SCREEN', // Different blend for day/night
      gravityY: 200, // Moderate gravity for natural acceleration
    });

    this.particleEmitter.setDepth(100); // Above everything
  }

  /**
   * Create snow effect
   */
  private createSnow(width: number, height: number): void {
    this.particleEmitter = this.scene.add.particles(0, -10, 'weather-particle', {
      x: { min: 0, max: width },
      y: 0,
      lifespan: 5000,
      speedY: { min: 30, max: 60 },
      speedX: { min: -20, max: 20 }, // Gentle drift
      scale: { start: 1.5, end: 0.8 }, // Larger particles for better visibility
      alpha: { start: 1.0, end: 0.7 }, // More opaque for better visibility
      tint: 0xffffff, // White
      frequency: 15, // More frequent particles
      quantity: 2, // More particles per emission
      blendMode: 'ADD',
      gravityY: 20, // Slow falling
    });

    this.particleEmitter.setDepth(100); // Above everything
  }

  /**
   * Apply weather effects to sky color
   */
  public static applySkyWeatherTint(skyColor: number, weather: WeatherType): number {
    if (weather === 'rain') {
      // Slightly darken sky for rain (very subtle effect)
      return this.darkenColor(skyColor, 0.08);
    } else if (weather === 'snow') {
      // Slightly brighten/desaturate for snow
      return this.lightenColor(skyColor, 0.1);
    }
    return skyColor;
  }

  /**
   * Cleanup weather effects
   */
  public destroy(): void {
    if (this.particleEmitter) {
      this.particleEmitter.destroy();
    }
  }

  /**
   * Darken a color
   */
  private static darkenColor(color: number, factor: number): number {
    const r = Math.floor(((color >> 16) & 0xff) * (1 - factor));
    const g = Math.floor(((color >> 8) & 0xff) * (1 - factor));
    const b = Math.floor((color & 0xff) * (1 - factor));
    return (r << 16) | (g << 8) | b;
  }

  /**
   * Lighten a color
   */
  private static lightenColor(color: number, factor: number): number {
    const r = Math.min(255, Math.floor(((color >> 16) & 0xff) + (255 - ((color >> 16) & 0xff)) * factor));
    const g = Math.min(255, Math.floor(((color >> 8) & 0xff) + (255 - ((color >> 8) & 0xff)) * factor));
    const b = Math.min(255, Math.floor((color & 0xff) + (255 - (color & 0xff)) * factor));
    return (r << 16) | (g << 8) | b;
  }
}

