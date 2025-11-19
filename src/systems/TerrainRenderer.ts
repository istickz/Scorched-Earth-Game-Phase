import Phaser from 'phaser';

/**
 * Terrain renderer for rendering terrain graphics
 */
export class TerrainRenderer {
  private scene: Phaser.Scene;
  private terrainGraphics!: Phaser.GameObjects.Graphics;
  private width: number;
  private height: number;
  private groundColor: number;
  private skyColor: number; // Needed for clearing columns

  constructor(
    scene: Phaser.Scene,
    width: number,
    height: number,
    groundColor: number,
    skyColor: number
  ) {
    this.scene = scene;
    this.width = width;
    this.height = height;
    this.groundColor = groundColor;
    this.skyColor = skyColor;
  }

  /**
   * Render terrain using Phaser Graphics
   * OPTIMIZED: Uses vertical column rendering instead of pixel-by-pixel
   */
  public render(terrainData: boolean[][]): void {
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
        const isSolid = terrainData[x] && terrainData[x][y];
        
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
   * Render only specific columns (optimized partial redraw)
   * Only redraws terrain, not sky (sky never changes after initial render)
   */
  public renderColumns(columns: Set<number>, terrainData: boolean[][]): void {
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
        const isSolid = terrainData[x] && terrainData[x][y];
        
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
   * Update ground color
   */
  public setGroundColor(color: number): void {
    this.groundColor = color;
  }

  /**
   * Update sky color (needed for clearing columns)
   */
  public setSkyColor(color: number): void {
    this.skyColor = color;
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
  }
}

