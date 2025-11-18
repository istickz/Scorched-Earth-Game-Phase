import Phaser from 'phaser';
import type { WeatherType, TimeOfDay, IEnvironmentEffects } from '@/types';

/**
 * Weather system for rain and snow effects
 */
export class WeatherSystem {
  private scene: Phaser.Scene;
  private weatherType: WeatherType;
  private timeOfDay: TimeOfDay;
  private particleEmitter?: Phaser.GameObjects.Particles.ParticleEmitter;
  private environmentEffects?: IEnvironmentEffects;

  constructor(
    scene: Phaser.Scene, 
    weatherType: WeatherType, 
    timeOfDay: TimeOfDay = 'day',
    environmentEffects?: IEnvironmentEffects
  ) {
    this.scene = scene;
    this.weatherType = weatherType;
    this.timeOfDay = timeOfDay;
    this.environmentEffects = environmentEffects;
    
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
  private createRain(width: number, _height: number): void {
    // Choose color based on time of day
    // Darker for day (more visible on light sky), lighter for night (more visible on dark sky)
    const rainColor = this.timeOfDay === 'day' ? 0x4477aa : 0xaaccff;
    
    // Calculate wind-based horizontal speed
    const windX = this.environmentEffects?.windX || 0;
    const baseSpeedY = 3000; // Base vertical falling speed
    const windSpeedMultiplier = 800; // How much wind affects horizontal speed
    const speedX = windX * windSpeedMultiplier;
    
    // Calculate rotation angle for rain drops based on wind
    // angle = atan2(speedX, speedY) converted to degrees
    // Phaser rotation is in degrees, 0° = right, 90° = down
    const angleRad = Math.atan2(speedX, baseSpeedY);
    const angleDeg = Phaser.Math.RadToDeg(angleRad);
    
    this.particleEmitter = this.scene.add.particles(0, -10, 'rain-drop', {
      x: { min: 0, max: width },
      y: 0,
      lifespan: 800, // Shorter lifespan for fast rain
      speedY: { min: baseSpeedY * 0.8, max: baseSpeedY * 1.2 }, // Vertical speed with variation
      speedX: { min: speedX * 0.8, max: speedX * 1.2 }, // Horizontal speed based on wind
      scale: { start: 0.6, end: 0.5 }, // Very thin width
      scaleY: { start: 1.0, end: 0.9 }, // Use base texture size (already long)
      alpha: { start: 1.0, end: 0.9 }, // More opaque for better visibility
      tint: rainColor, // Color based on time of day
      frequency: 20, // Less frequent particles for lighter rain
      quantity: 3, // Particles per emission
      blendMode: this.timeOfDay === 'day' ? 'NORMAL' : 'SCREEN', // Different blend for day/night
      gravityY: 1600, // Fast gravity for natural acceleration (8x faster)
      angle: angleDeg + 90, // Rotate sprite to match wind direction (+90 because sprite is vertical by default)
    });

    this.particleEmitter.setDepth(100); // Above everything
  }

  /**
   * Create snow effect
   */
  private createSnow(width: number, _height: number): void {
    // Calculate wind-based horizontal drift for snow
    const windX = this.environmentEffects?.windX || 0;
    const snowWindMultiplier = 200; // Snow is lighter, so wind affects it more than rain
    const driftX = windX * snowWindMultiplier;
    
    this.particleEmitter = this.scene.add.particles(0, -10, 'weather-particle', {
      x: { min: 0, max: width },
      y: 0,
      lifespan: 3000,
      speedY: { min: 240, max: 480 }, // Faster falling (8x faster to compensate for removed timeScale)
      speedX: { min: driftX * 0.7, max: driftX * 1.3 }, // Drift based on wind direction
      scale: { start: 1.5, end: 0.8 }, // Larger particles for better visibility
      alpha: { start: 1.0, end: 0.7 }, // More opaque for better visibility
      tint: 0xffffff, // White
      frequency: 15, // More frequent particles
      quantity: 2, // More particles per emission
      blendMode: 'ADD',
      gravityY: 160, // Faster falling (8x faster)
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

