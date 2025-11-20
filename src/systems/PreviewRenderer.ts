import Phaser from 'phaser';
import type { ILevelConfig, IEnvironmentEffects } from '@/types';
import { BiomeSystem } from './BiomeSystem';
import { SkyRenderer } from './SkyRenderer';
import { TerrainSystem } from './TerrainSystem';
import { WeatherSystem } from './WeatherSystem';
import { EnvironmentSystem } from './EnvironmentSystem';

/**
 * Preview renderer that uses game systems to render level preview
 */
export class PreviewRenderer {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private gameWidth: number;
  private gameHeight: number;
  private skyRenderer?: SkyRenderer;
  private terrainSystem?: TerrainSystem;
  private weatherSystem?: WeatherSystem;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    width: number,
    height: number,
    gameWidth: number = 1200,
    gameHeight: number = 800
  ) {
    this.scene = scene;
    this.gameWidth = gameWidth;
    this.gameHeight = gameHeight;

    // Create container for preview rendering
    this.container = this.scene.add.container(x, y);
    
    // Calculate scale to fit game dimensions into preview dimensions
    const scaleX = width / gameWidth;
    const scaleY = height / gameHeight;
    this.container.setScale(scaleX, scaleY);
  }

  /**
   * Update preview with new level configuration
   */
  public update(levelConfig: ILevelConfig, seed: number): void {
    // Clean up existing systems
    this.cleanup();

    // Get colors for biome
    const colors = BiomeSystem.getColors(
      levelConfig.biome,
      levelConfig.season,
      levelConfig.timeOfDay
    );

    // Apply weather tint to sky
    const skyColor = WeatherSystem.applySkyWeatherTint(colors.sky, levelConfig.weather);
    const isNight = levelConfig.timeOfDay === 'night';

    // Create sky renderer (renders at full game dimensions)
    this.skyRenderer = new SkyRenderer(
      this.scene,
      this.gameWidth,
      this.gameHeight,
      skyColor,
      isNight
    );
    this.container.add(this.skyRenderer.getGraphics());

    // Create terrain system (renders at full game dimensions)
    this.terrainSystem = new TerrainSystem(
      this.scene,
      {
        width: this.gameWidth,
        height: this.gameHeight,
        terrainMinHeight: (levelConfig.terrainMinHeight ?? 0.1) * this.gameHeight,
        terrainMaxHeight: (levelConfig.terrainMaxHeight ?? 0.85) * this.gameHeight,
        seed,
        shape: levelConfig.shape,
      },
      colors.ground,
      skyColor
    );
    this.container.add(this.terrainSystem.getRenderer().getGraphics());

    // Add snow layer if needed
    if (BiomeSystem.shouldHaveSnow(levelConfig.biome, levelConfig.season)) {
      const terrainHeight = this.terrainSystem.getTerrainHeightArray();
      this.terrainSystem.getRenderer().renderSnowLayer(terrainHeight);
    }

    // Create weather effects (if weather is not 'none')
    if (levelConfig.weather !== 'none') {
      // Get environment effects
      const defaultEffects = EnvironmentSystem.getEffects(
        levelConfig.biome,
        levelConfig.weather,
        levelConfig.timeOfDay
      );
      // Merge partial effects with defaults to ensure all properties are present
      const effects: IEnvironmentEffects = {
        windX: levelConfig.environmentEffects?.windX ?? defaultEffects.windX,
        windY: levelConfig.environmentEffects?.windY ?? defaultEffects.windY,
        gravity: levelConfig.environmentEffects?.gravity ?? defaultEffects.gravity,
        airDensity: levelConfig.environmentEffects?.airDensity ?? defaultEffects.airDensity,
      };

      // Create weather system with game dimensions
      this.weatherSystem = new WeatherSystem(
        this.scene,
        levelConfig.weather,
        levelConfig.timeOfDay,
        effects,
        this.terrainSystem,
        this.gameWidth,
        this.gameHeight
      );
      
      // Add weather emitter to container (if it exists)
      const emitter = this.weatherSystem.getEmitter();
      if (emitter) {
        this.container.add(emitter);
      }
    }
  }

  /**
   * Clean up existing rendering systems
   */
  private cleanup(): void {
    if (this.skyRenderer) {
      this.skyRenderer.destroy();
      this.skyRenderer = undefined;
    }

    if (this.weatherSystem) {
      this.weatherSystem.destroy();
      this.weatherSystem = undefined;
    }

    if (this.terrainSystem) {
      this.terrainSystem.destroy();
      this.terrainSystem = undefined;
    }

    // Clear container
    this.container.removeAll(true);
  }

  /**
   * Get the container for adding to parent container
   */
  public getContainer(): Phaser.GameObjects.Container {
    return this.container;
  }

  /**
   * Destroy the preview renderer and all its systems
   */
  public destroy(): void {
    this.cleanup();
    this.container.destroy();
  }
}

