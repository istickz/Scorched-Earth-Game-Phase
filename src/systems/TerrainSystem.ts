import Phaser from 'phaser';
import { type ITerrainConfig, TerrainShape } from '@/types';
import { NoiseGenerator } from '@/utils/NoiseGenerator';

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

    // Use provided colors or randomly choose day or night
    if (config.skyColor !== undefined && config.groundColor !== undefined) {
      this.skyColor = config.skyColor;
      this.groundColor = config.groundColor;
      this.isNight = config.isNight ?? false;
    } else {
      // Fallback to random if no colors provided
      this.isNight = Math.random() < 0.5;
      this.setTimeOfDay(this.isNight);
    }

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
   * Generate procedural terrain using improved fractal noise
   */
  private generate(config: ITerrainConfig): void {
    const minHeight = config.minHeight || this.height * 0.3;
    const maxHeight = config.maxHeight || this.height * 0.7;
    const roughness = config.roughness || 0.3;
    const shape = config.shape || TerrainShape.HILLS;
    // Generate a random seed if not provided, ensuring different terrain each time
    const seed = config.seed !== undefined ? config.seed : Math.random() * 1000000;

    // Initialize terrain data
    for (let x = 0; x < this.width; x++) {
      this.terrainData[x] = [];
      this.terrainHeight[x] = 0;
    }

    // Generate heightmap using improved fractal noise
    for (let x = 0; x < this.width; x++) {
      // Primary fractal noise (large scale features) - shape-dependent
      const primaryNoise = NoiseGenerator.fractalNoise(x, seed, shape);
      
      // Secondary fractal noise with different seed (medium scale features) - shape-dependent
      const secondaryNoise = NoiseGenerator.fractalNoise(x, seed * 1.37 + 5000, shape, shape === TerrainShape.HILLS ? 2 : 4);
      
      // Tertiary noise (small details)
      const tertiaryNoise = NoiseGenerator.fractalNoise(x, seed * 2.71 + 10000, shape, 2);
      
      // Add some sine waves for smooth hills (but with varying frequencies)
      const sine1 = Math.sin((x + seed) * 0.008) * 0.15;
      const sine2 = Math.sin((x + seed * 1.618) * 0.015) * 0.1;
      const sine3 = Math.sin((x + seed * 2.718) * 0.025) * 0.08;
      
      // Add local variation using seeded random
      const localVariation = (NoiseGenerator.seededRandom(seed + x * 0.05) - 0.5) * 0.3;
      
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
      
      // Apply roughness as amplitude multiplier (same logic as in LevelEditorScene)
      // roughness 0.05-1.0, normalize to range ~0.33-6.67 (0.15 is default = 1.0x)
      const roughnessMultiplier = roughness / 0.15;
      const baseHeight = minHeight + (maxHeight - minHeight) * 0.5;
      const amplitude = (maxHeight - minHeight) * 0.4;
      const terrainY = baseHeight + (normalizedHeight - 0.5) * amplitude * roughnessMultiplier;

      this.terrainHeight[x] = Math.floor(terrainY);

      // Fill terrain data from bottom to terrain height
      for (let y = 0; y < this.height; y++) {
        this.terrainData[x][y] = y >= this.terrainHeight[x];
      }
    }
  }

  /**
   * Render terrain using Phaser Graphics
   * OPTIMIZED: Uses vertical column rendering instead of pixel-by-pixel
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

    // OPTIMIZED: Draw terrain column by column for MASSIVE performance boost
    // Instead of drawing each pixel individually, we draw vertical segments
    this.terrainGraphics.fillStyle(this.groundColor);
    
    for (let x = 0; x < this.width; x++) {
      // Find continuous vertical segments of solid terrain
      let segmentStart = -1;
      
      for (let y = 0; y < this.height; y++) {
        const isSolid = this.terrainData[x] && this.terrainData[x][y];
        
        if (isSolid && segmentStart === -1) {
          // Start of new segment
          segmentStart = y;
        } else if (!isSolid && segmentStart !== -1) {
          // End of segment - draw it
          const segmentHeight = y - segmentStart;
          this.terrainGraphics.fillRect(x, segmentStart, 1, segmentHeight);
          segmentStart = -1;
        }
      }
      
      // If segment extends to bottom of screen
      if (segmentStart !== -1) {
        const segmentHeight = this.height - segmentStart;
        this.terrainGraphics.fillRect(x, segmentStart, 1, segmentHeight);
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
      const x = Math.floor(NoiseGenerator.seededRandom(seed) * this.width);
      const y = Math.floor(NoiseGenerator.seededRandom(seed + 1000) * this.height * 0.6); // Only in upper 60% (sky area)
      
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
   * Render only specific columns (optimized partial redraw)
   * Only redraws terrain, not sky (sky never changes after initial render)
   */
  private renderColumns(columns: Set<number>): void {
    if (columns.size === 0 || !this.terrainGraphics) return;
    
    // First, clear only the affected columns by drawing sky color over them
    // This removes old terrain pixels
    this.terrainGraphics.fillStyle(this.skyColor);
    for (const x of columns) {
      // Clear the entire column height
      this.terrainGraphics.fillRect(x, 0, 1, this.height);
    }
    
    // Now draw terrain for modified columns only
    this.terrainGraphics.fillStyle(this.groundColor);
    
    for (const x of columns) {
      // Find continuous vertical segments of solid terrain
      let segmentStart = -1;
      
      for (let y = 0; y < this.height; y++) {
        const isSolid = this.terrainData[x] && this.terrainData[x][y];
        
        if (isSolid && segmentStart === -1) {
          // Start of new segment
          segmentStart = y;
        } else if (!isSolid && segmentStart !== -1) {
          // End of segment - draw it
          const segmentHeight = y - segmentStart;
          this.terrainGraphics.fillRect(x, segmentStart, 1, segmentHeight);
          segmentStart = -1;
        }
      }
      
      // If segment extends to bottom of screen
      if (segmentStart !== -1) {
        const segmentHeight = this.height - segmentStart;
        this.terrainGraphics.fillRect(x, segmentStart, 1, segmentHeight);
      }
    }
  }

  /**
   * Destroy terrain in a circular crater
   * OPTIMIZED: Only redraws affected columns instead of entire terrain
   */
  public destroyCrater(centerX: number, centerY: number, radius: number): void {
    const radiusSquared = radius * radius;
    const minX = Math.max(0, Math.floor(centerX - radius));
    const maxX = Math.min(this.width - 1, Math.ceil(centerX + radius));
    const minY = Math.max(0, Math.floor(centerY - radius));
    const maxY = Math.min(this.height - 1, Math.ceil(centerY + radius));

    // Track which columns were modified
    const modifiedColumns = new Set<number>();

    for (let x = minX; x <= maxX; x++) {
      let columnModified = false;
      for (let y = minY; y <= maxY; y++) {
        const dx = x - centerX;
        const dy = y - centerY;
        const distSquared = dx * dx + dy * dy;

        if (distSquared <= radiusSquared) {
          // Destroy terrain at this point
          if (this.terrainData[x][y]) {
            this.terrainData[x][y] = false;
            columnModified = true;
          }
        }
      }
      if (columnModified) {
        modifiedColumns.add(x);
      }
    }

    // Recalculate heights for modified columns
    if (modifiedColumns.size > 0) {
      for (const x of modifiedColumns) {
        this.recalculateColumnHeight(x);
      }
      
      // OPTIMIZED: Only redraw affected columns, not entire terrain
      // Sky doesn't need redrawing - it never changes after initial render
      // This provides massive performance improvement on high-resolution displays
      this.renderColumns(modifiedColumns);
    }
  }

  /**
   * Recalculate height for a single column
   */
  private recalculateColumnHeight(x: number): void {
    // Find the highest solid point in this column
    let highestSolid = -1;
    for (let y = this.height - 1; y >= 0; y--) {
      if (this.terrainData[x] && this.terrainData[x][y]) {
        highestSolid = y;
        break;
      }
    }
    this.terrainHeight[x] = highestSolid >= 0 ? highestSolid : this.height;
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

