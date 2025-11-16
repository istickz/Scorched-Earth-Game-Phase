import Phaser from 'phaser';
import { type ITerrainConfig } from '@/types';

/**
 * Terrain system for procedural generation and destruction
 */
export class TerrainSystem {
  private scene: Phaser.Scene;
  private terrainGraphics!: Phaser.GameObjects.Graphics;
  private skyGraphics!: Phaser.GameObjects.Graphics;
  private terrainData: boolean[][]; // true = solid, false = air
  private width: number;
  private height: number;
  private terrainHeight: number[]; // Height map for each x position
  private skyColor: number = 0x87ceeb; // Sky blue
  private groundColor: number = 0x8b4513; // Brown
  private isNight: boolean = false;

  constructor(scene: Phaser.Scene, config: ITerrainConfig) {
    this.scene = scene;
    this.width = config.width;
    this.height = config.height;
    this.terrainData = [];
    this.terrainHeight = [];

    // Randomly choose day or night
    this.isNight = Math.random() < 0.5;
    this.setTimeOfDay(this.isNight);

    this.generate(config);
    this.render();
  }

  /**
   * Set colors based on time of day
   */
  private setTimeOfDay(isNight: boolean): void {
    if (isNight) {
      // Night colors - deep dark blue sky, slightly darker but pleasant ground
      this.skyColor = 0x0d0d2e; // Deep dark blue night sky (not too black)
      this.groundColor = 0x7a6b5a; // Warmer, more pleasant brown for night
    } else {
      // Day colors
      this.skyColor = 0x87ceeb; // Sky blue
      this.groundColor = 0x8b4513; // Brown
    }
  }

  /**
   * Simple seeded random number generator
   */
  private seededRandom(seed: number): number {
    const x = Math.sin(seed) * 10000;
    return x - Math.floor(x);
  }

  /**
   * Generate smooth noise value using interpolation
   */
  private smoothNoise(x: number, seed: number): number {
    const x1 = Math.floor(x);
    const x2 = x1 + 1;
    const t = x - x1;

    const v1 = this.seededRandom(seed + x1 * 0.01);
    const v2 = this.seededRandom(seed + x2 * 0.01);

    // Smooth interpolation (cosine interpolation for smoother result)
    const smoothT = (1 - Math.cos(t * Math.PI)) * 0.5;
    return v1 * (1 - smoothT) + v2 * smoothT;
  }

  /**
   * Generate fractal noise (multiple octaves)
   */
  private fractalNoise(x: number, seed: number, octaves: number = 6): number {
    let value = 0;
    let amplitude = 1;
    let frequency = 0.005;
    let maxValue = 0;

    for (let i = 0; i < octaves; i++) {
      value += this.smoothNoise(x * frequency, seed + i * 1000) * amplitude;
      maxValue += amplitude;
      amplitude *= 0.5; // Each octave has half the amplitude
      frequency *= 2; // Each octave has double the frequency
    }

    return value / maxValue; // Normalize to 0-1
  }

  /**
   * Generate procedural terrain using improved fractal noise
   */
  private generate(config: ITerrainConfig): void {
    const minHeight = config.minHeight || this.height * 0.3;
    const maxHeight = config.maxHeight || this.height * 0.7;
    const roughness = config.roughness || 0.3;
    // Generate a random seed if not provided, ensuring different terrain each time
    const seed = config.seed !== undefined ? config.seed : Math.random() * 1000000;

    // Initialize terrain data
    for (let x = 0; x < this.width; x++) {
      this.terrainData[x] = [];
      this.terrainHeight[x] = 0;
    }

    // Generate heightmap using improved fractal noise
    for (let x = 0; x < this.width; x++) {
      // Primary fractal noise (large scale features)
      const primaryNoise = this.fractalNoise(x, seed, 6);
      
      // Secondary fractal noise with different seed (medium scale features)
      const secondaryNoise = this.fractalNoise(x, seed * 1.37 + 5000, 4);
      
      // Tertiary noise (small details)
      const tertiaryNoise = this.fractalNoise(x, seed * 2.71 + 10000, 3);
      
      // Add some sine waves for smooth hills (but with varying frequencies)
      const sine1 = Math.sin((x + seed) * 0.008) * 0.15;
      const sine2 = Math.sin((x + seed * 1.618) * 0.015) * 0.1;
      const sine3 = Math.sin((x + seed * 2.718) * 0.025) * 0.08;
      
      // Add local variation using seeded random
      const localVariation = (this.seededRandom(seed + x * 0.05) - 0.5) * roughness * 0.3;
      
      // Combine all noise sources with different weights
      const combinedNoise = 
        primaryNoise * 0.35 +
        secondaryNoise * 0.25 +
        tertiaryNoise * 0.15 +
        sine1 * 0.1 +
        sine2 * 0.08 +
        sine3 * 0.05 +
        localVariation * 0.02;

      // Normalize to 0-1 range
      const normalizedHeight = Phaser.Math.Clamp(combinedNoise, 0, 1);
      const terrainY = minHeight + (maxHeight - minHeight) * normalizedHeight;

      this.terrainHeight[x] = Math.floor(terrainY);

      // Fill terrain data from bottom to terrain height
      for (let y = 0; y < this.height; y++) {
        this.terrainData[x][y] = y >= this.terrainHeight[x];
      }
    }
  }

  /**
   * Render terrain using Phaser Graphics
   */
  private render(): void {
    // Create or clear sky graphics object (separate from terrain to avoid depth issues)
    if (this.skyGraphics) {
      this.skyGraphics.clear();
    } else {
      this.skyGraphics = this.scene.add.graphics();
      this.skyGraphics.setDepth(-1); // Render behind everything
    }

    // Draw sky
    this.skyGraphics.fillStyle(this.skyColor);
    this.skyGraphics.fillRect(0, 0, this.width, this.height);

    // Draw stars for night
    if (this.isNight) {
      this.drawStars();
    }

    // Create or clear terrain graphics object
    if (this.terrainGraphics) {
      this.terrainGraphics.clear();
    } else {
      this.terrainGraphics = this.scene.add.graphics();
      this.terrainGraphics.setDepth(0); // Render behind other objects but above sky
    }

    // Draw terrain - use terrainData to draw pixel by pixel for accurate destruction
    this.terrainGraphics.fillStyle(this.groundColor);
    for (let x = 0; x < this.width; x++) {
      for (let y = 0; y < this.height; y++) {
        if (this.terrainData[x] && this.terrainData[x][y]) {
          this.terrainGraphics.fillRect(x, y, 1, 1);
        }
      }
    }
  }

  /**
   * Draw stars on the night sky
   */
  private drawStars(): void {
    // Use a seed based on width/height for consistent star positions
    const starSeed = this.width * 1000 + this.height;
    const numStars = Math.floor((this.width * this.height) / 2500); // Density: ~1 star per 2500 pixels
    
    // Single star color - white
    const starColor = 0xffffff;
    
    for (let i = 0; i < numStars; i++) {
      // Generate star position using seeded random
      const seed = starSeed + i * 137; // Prime number for better distribution
      const x = Math.floor(this.seededRandom(seed) * this.width);
      const y = Math.floor(this.seededRandom(seed + 1000) * this.height * 0.6); // Only in upper 60% (sky area)
      
      // Make sure star is above terrain
      const terrainY = this.getHeightAt(x);
      if (y >= terrainY) {
        continue; // Skip if star would be in terrain
      }
      
      // Small star size (1 pixel - minimum visible size)
      // Use fillRect for precise 1x1 pixel stars
      this.skyGraphics.fillStyle(starColor);
      this.skyGraphics.fillRect(x, y, 1, 1);
    }
  }

  /**
   * Get terrain height at a specific x position
   */
  public getHeightAt(x: number): number {
    const clampedX = Phaser.Math.Clamp(Math.floor(x), 0, this.width - 1);
    return this.terrainHeight[clampedX];
  }

  /**
   * Check if a point is solid terrain
   */
  public isSolid(x: number, y: number): boolean {
    const clampedX = Phaser.Math.Clamp(Math.floor(x), 0, this.width - 1);
    const clampedY = Phaser.Math.Clamp(Math.floor(y), 0, this.height - 1);
    return this.terrainData[clampedX]?.[clampedY] ?? false;
  }

  /**
   * Destroy terrain in a circular crater
   */
  public destroyCrater(centerX: number, centerY: number, radius: number): void {
    const radiusSquared = radius * radius;
    const minX = Math.max(0, Math.floor(centerX - radius));
    const maxX = Math.min(this.width - 1, Math.ceil(centerX + radius));
    const minY = Math.max(0, Math.floor(centerY - radius));
    const maxY = Math.min(this.height - 1, Math.ceil(centerY + radius));

    for (let x = minX; x <= maxX; x++) {
      for (let y = minY; y <= maxY; y++) {
        const dx = x - centerX;
        const dy = y - centerY;
        const distSquared = dx * dx + dy * dy;

        if (distSquared <= radiusSquared) {
          // Destroy terrain at this point
          this.terrainData[x][y] = false;
        }
      }
    }

    // Recalculate height map
    this.recalculateHeights();
    this.render();
  }

  /**
   * Recalculate height map after destruction
   */
  private recalculateHeights(): void {
    for (let x = 0; x < this.width; x++) {
      // Find the highest solid point in this column
      let highestSolid = -1;
      for (let y = this.height - 1; y >= 0; y--) {
        if (this.terrainData[x][y]) {
          highestSolid = y;
          break;
        }
      }
      this.terrainHeight[x] = highestSolid >= 0 ? highestSolid : this.height;
    }
  }

  /**
   * Get the terrain graphics object
   */
  public getGraphics(): Phaser.GameObjects.Graphics {
    return this.terrainGraphics;
  }

  /**
   * Clean up resources
   */
  public destroy(): void {
    if (this.terrainGraphics) {
      this.terrainGraphics.destroy();
    }
    if (this.skyGraphics) {
      this.skyGraphics.destroy();
    }
  }
}

