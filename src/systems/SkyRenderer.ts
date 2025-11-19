import Phaser from 'phaser';
import { NoiseGenerator } from '@/utils/NoiseGenerator';

/**
 * Sky renderer for background sky and stars
 */
export class SkyRenderer {
  private scene: Phaser.Scene;
  private skyGraphics!: Phaser.GameObjects.Graphics;
  private width: number;
  private height: number;
  private skyColor: number;
  private isNight: boolean;

  constructor(scene: Phaser.Scene, width: number, height: number, skyColor: number, isNight: boolean) {
    this.scene = scene;
    this.width = width;
    this.height = height;
    this.skyColor = skyColor;
    this.isNight = isNight;

    this.render();
  }

  /**
   * Render sky background
   */
  public render(): void {
    // Create or clear sky graphics object
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
      const y = Math.floor(NoiseGenerator.seededRandom(seed + 1000) * this.height); // Full screen height
      
      // Small star size (1 pixel - minimum visible size)
      // Use fillRect for precise 1x1 pixel stars
      // Stars will be naturally occluded by terrain where it exists
      this.skyGraphics.fillStyle(starColor);
      this.skyGraphics.fillRect(x, y, 1, 1);
    }
  }

  /**
   * Update sky color (for weather effects, etc.)
   */
  public setSkyColor(color: number): void {
    this.skyColor = color;
    this.render();
  }

  /**
   * Get the sky graphics object
   */
  public getGraphics(): Phaser.GameObjects.Graphics {
    return this.skyGraphics;
  }

  /**
   * Clean up resources
   */
  public destroy(): void {
    if (this.skyGraphics) {
      this.skyGraphics.destroy();
    }
  }
}

