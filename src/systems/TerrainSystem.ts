import Phaser from 'phaser';
import { type ITerrainConfig, TerrainShape } from '@/types';
import { NoiseGenerator } from '@/utils/NoiseGenerator';
import { TerrainRenderer } from './TerrainRenderer';

/**
 * Terrain system for procedural generation and destruction
 */
export class TerrainSystem {
  private terrainRenderer!: TerrainRenderer;
  private terrainData: boolean[][]; // true = solid, false = air
  private width: number;
  private height: number;
  private terrainHeight: number[]; // Height map for each x position

  constructor(scene: Phaser.Scene, config: ITerrainConfig, groundColor: number, skyColor: number) {
    this.width = config.width;
    this.height = config.height;
    this.terrainData = [];
    this.terrainHeight = [];

    // Create terrain renderer
    this.terrainRenderer = new TerrainRenderer(scene, this.width, this.height, groundColor, skyColor);

    this.generate(config);
    this.render();
  }

  /**
   * Generate procedural terrain using improved fractal noise
   */
  private generate(config: ITerrainConfig): void {
    const terrainMinHeight = config.terrainMinHeight || this.height * 0.2;
    const terrainMaxHeight = config.terrainMaxHeight || this.height * 0.7;
    const shape = config.shape || TerrainShape.HILLS;
    // Generate a random seed if not provided, ensuring different terrain each time
    const seed = config.seed !== undefined ? config.seed : Math.random() * 1000000;

    // Initialize terrain data
    for (let x = 0; x < this.width; x++) {
      this.terrainData[x] = [];
      this.terrainHeight[x] = 0;
    }

    // Generate heightmap using smooth fractal noise (no small details)
    // Use modulo to prevent precision loss with large sine arguments
    const TWO_PI = 2 * Math.PI;
    const normalizeAngle = (angle: number): number => {
      // Normalize angle to [0, 2π) range to maintain precision
      angle = angle % TWO_PI;
      return angle < 0 ? angle + TWO_PI : angle;
    };
    
    for (let x = 0; x < this.width; x++) {
      // Primary fractal noise (large scale features) - shape-dependent
      const primaryNoise = NoiseGenerator.fractalNoise(x, seed, shape);
      
      // Add smooth sine waves for smooth hills (normalized to prevent precision loss)
      const sine1 = Math.sin(normalizeAngle((x + seed) * 0.008)) * 0.15;
      const sine2 = Math.sin(normalizeAngle((x + seed * 1.618) * 0.015)) * 0.1;
      const sine3 = Math.sin(normalizeAngle((x + seed * 2.718) * 0.025)) * 0.08;
      
      // Combine noise sources with weights (only smooth components, no small details)
      const combinedNoise = 
        primaryNoise * 0.5 +
        sine1 * 0.2 +
        sine2 * 0.15 +
        sine3 * 0.15;

      // Normalize to 0-1 range
      const normalizedHeight = Phaser.Math.Clamp(combinedNoise, 0, 1);
      
      const terrainY = terrainMinHeight + (terrainMaxHeight - terrainMinHeight) * normalizedHeight;

      this.terrainHeight[x] = this.height - Math.floor(terrainY); 

      // Fill terrain data from bottom to terrain height
      for (let y = 0; y < this.height; y++) {
        this.terrainData[x][y] = y >= this.terrainHeight[x];
      }
    }
  }

  /**
   * Render terrain using TerrainRenderer
   */
  private render(): void {
    this.terrainRenderer.render(this.terrainData);
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
    this.terrainRenderer.renderColumns(columns, this.terrainData);
  }

  /**
   * Destroy terrain in a crater with specified shape
   * OPTIMIZED: Only redraws affected columns instead of entire terrain
   */
  public destroyCrater(
    centerX: number, 
    centerY: number, 
    radius: number,
    shape: 'circle' | 'vertical' | 'horizontal' = 'circle',
    shapeRatio: number = 1.0
  ): void {
    // Calculate radii for ellipse based on shape
    let radiusX: number;
    let radiusY: number;
    
    if (shape === 'vertical') {
      // Vertical oval: narrow width, tall height
      radiusX = radius;
      radiusY = radius * shapeRatio;
    } else if (shape === 'horizontal') {
      // Horizontal oval: wide width, short height
      radiusX = radius * shapeRatio;
      radiusY = radius;
    } else {
      // Circle: equal radii
      radiusX = radius;
      radiusY = radius;
    }

    // Calculate bounds based on the actual shape
    const minX = Math.max(0, Math.floor(centerX - radiusX));
    const maxX = Math.min(this.width - 1, Math.ceil(centerX + radiusX));
    const minY = Math.max(0, Math.floor(centerY - radiusY));
    const maxY = Math.min(this.height - 1, Math.ceil(centerY + radiusY));

    // Track which columns were modified
    const modifiedColumns = new Set<number>();

    for (let x = minX; x <= maxX; x++) {
      let columnModified = false;
      for (let y = minY; y <= maxY; y++) {
        const dx = x - centerX;
        const dy = y - centerY;
        
        // Check if point is inside ellipse using formula: (dx/radiusX)² + (dy/radiusY)² <= 1
        const normalizedDistSquared = (dx * dx) / (radiusX * radiusX) + (dy * dy) / (radiusY * radiusY);

        if (normalizedDistSquared <= 1.0) {
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
    return this.terrainRenderer.getGraphics();
  }

  /**
   * Get the terrain renderer
   */
  public getRenderer(): TerrainRenderer {
    return this.terrainRenderer;
  }

  /**
   * Get the terrain height array
   */
  public getTerrainHeightArray(): number[] {
    return this.terrainHeight;
  }

  /**
   * Update sky color (needed for clearing columns during destruction)
   */
  public setSkyColor(color: number): void {
    this.terrainRenderer.setSkyColor(color);
  }

  /**
   * Update ground color
   */
  public setGroundColor(color: number): void {
    this.terrainRenderer.setGroundColor(color);
    // Re-render terrain with new color
    this.render();
  }

  /**
   * Clean up resources
   */
  public destroy(): void {
    if (this.terrainRenderer) {
      this.terrainRenderer.destroy();
    }
  }
}

