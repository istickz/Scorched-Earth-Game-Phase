import Phaser from 'phaser';
import { TerrainBiome } from '@/types';

/**
 * Pixel art icon generator for NES-style UI
 */
export class PixelIconGenerator {
  /**
   * Apply tint to a color (darken for shadows)
   */
  private static applyTint(baseColor: number, tintColor?: number): number {
    if (!tintColor) return baseColor;
    
    // Extract RGB components from base color
    const r = (baseColor >> 16) & 0xff;
    const g = (baseColor >> 8) & 0xff;
    const b = baseColor & 0xff;
    
    // Extract RGB components from tint color
    const tr = (tintColor >> 16) & 0xff;
    const tg = (tintColor >> 8) & 0xff;
    const tb = tintColor & 0xff;
    
    // Multiply and normalize (0-255 range)
    const nr = Math.floor((r * tr) / 255);
    const ng = Math.floor((g * tg) / 255);
    const nb = Math.floor((b * tb) / 255);
    
    // Combine back to hex
    return (nr << 16) | (ng << 8) | nb;
  }

  /**
   * Create pixel art icon for biome
   */
  public static createBiomeIcon(
    scene: Phaser.Scene,
    biome: TerrainBiome,
    x: number,
    y: number,
    size: number,
    tintColor?: number
  ): Phaser.GameObjects.Graphics {
    const graphics = scene.add.graphics();
    graphics.setPosition(x, y);
    
    const pixelSize = size / 8; // 8x8 pixel grid
    const offsetX = -size / 2;
    const offsetY = -size / 2;
    
    let pixels: number[][] = [];
    
    switch (biome) {
      case TerrainBiome.TEMPERATE:
        // Mountain with trees (8x8)
        pixels = [
          [0,0,0,1,1,0,0,0],
          [0,0,1,2,2,1,0,0],
          [0,1,2,2,2,2,1,0],
          [1,2,2,2,2,2,2,1],
          [0,0,3,4,4,3,0,0],
          [0,0,3,4,4,3,0,0],
          [0,3,3,4,4,3,3,0],
          [3,3,3,3,3,3,3,3],
        ];
        // Colors: 0=transparent, 1=dark gray (mountain shadow), 2=light gray (mountain), 
        // 3=dark green (tree shadow), 4=green (tree)
        break;
      case TerrainBiome.DESERT:
        // Sand dunes with sun (8x8)
        pixels = [
          [0,0,1,1,1,1,0,0],
          [0,1,2,2,2,2,1,0],
          [0,1,2,2,2,2,1,0],
          [0,0,1,1,1,1,0,0],
          [0,0,0,3,3,0,0,0],
          [0,0,3,4,4,3,0,0],
          [0,3,4,4,4,4,3,0],
          [3,4,4,4,4,4,4,3],
        ];
        // Colors: 0=transparent, 1=orange (sun outline), 2=yellow (sun), 
        // 3=dark sand, 4=light sand
        break;
      case TerrainBiome.ARCTIC:
        // Snowflake (8x8)
        pixels = [
          [0,0,0,1,1,0,0,0],
          [0,0,1,2,2,1,0,0],
          [0,1,2,2,2,2,1,0],
          [1,2,2,2,2,2,2,1],
          [1,2,2,2,2,2,2,1],
          [0,1,2,2,2,2,1,0],
          [0,0,1,2,2,1,0,0],
          [0,0,0,1,1,0,0,0],
        ];
        // Colors: 0=transparent, 1=light blue (snowflake outline), 2=white (snowflake)
        break;
      case TerrainBiome.VOLCANIC:
        // Volcano (8x8)
        pixels = [
          [0,0,0,1,1,0,0,0],
          [0,0,1,3,3,1,0,0],
          [0,1,2,3,3,2,1,0],
          [1,2,2,2,2,2,2,1],
          [1,2,2,3,3,2,2,1],
          [1,2,3,3,3,3,2,1],
          [0,1,2,2,2,2,1,0],
          [0,0,1,1,1,1,0,0],
        ];
        // Colors: 0=transparent, 1=dark gray (rock shadow), 2=gray (rock), 3=orange (lava)
        break;
    }
    
    // Get color palette for biome
    const getColor = (pixelValue: number): number => {
      switch (biome) {
        case TerrainBiome.TEMPERATE:
          switch (pixelValue) {
            case 1: return this.applyTint(0x555555, tintColor); // mountain shadow
            case 2: return this.applyTint(0x888888, tintColor); // mountain
            case 3: return this.applyTint(0x1a6b1a, tintColor); // tree dark green
            case 4: return this.applyTint(0x228b22, tintColor); // tree light green
          }
          break;
        case TerrainBiome.DESERT:
          switch (pixelValue) {
            case 1: return this.applyTint(0xff8c00, tintColor); // sun outline (dark orange)
            case 2: return this.applyTint(0xffd700, tintColor); // sun (gold/yellow)
            case 3: return this.applyTint(0xc19a6b, tintColor); // dark sand (tan)
            case 4: return this.applyTint(0xedc9af, tintColor); // light sand (desert sand)
          }
          break;
        case TerrainBiome.ARCTIC:
          switch (pixelValue) {
            case 1: return this.applyTint(0x87ceeb, tintColor); // ice blue
            case 2: return this.applyTint(0xffffff, tintColor); // snow white
          }
          break;
        case TerrainBiome.VOLCANIC:
          switch (pixelValue) {
            case 1: return this.applyTint(0x333333, tintColor); // rock dark
            case 2: return this.applyTint(0x666666, tintColor); // rock light
            case 3: return this.applyTint(0xff4500, tintColor); // lava
          }
          break;
      }
      return 0xffffff;
    };
    
    // Draw pixels
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const pixelValue = pixels[row][col];
        if (pixelValue !== 0) {
          const color = getColor(pixelValue);
          graphics.fillStyle(color);
          graphics.fillRect(offsetX + col * pixelSize, offsetY + row * pixelSize, pixelSize, pixelSize);
        }
      }
    }
    
    return graphics;
  }

  /**
   * Create pixel art dice icon (showing 5 pips)
   */
  public static createDiceIcon(
    scene: Phaser.Scene,
    x: number,
    y: number,
    size: number,
    tintColor?: number
  ): Phaser.GameObjects.Graphics {
    const graphics = scene.add.graphics();
    graphics.setPosition(x, y);
    
    const pixelSize = size / 8; // 8x8 pixel grid
    const offsetX = -size / 2;
    const offsetY = -size / 2;
    
    // Dice face showing 5 pips (8x8)
    // Colors: 0=transparent, 1=dice edge/shadow, 2=dice face, 3=pip (dot)
    const pixels = [
      [0,0,1,1,1,1,1,0],
      [0,1,2,2,2,2,2,1],
      [1,2,3,0,0,0,3,2],
      [1,2,0,0,3,0,0,2],
      [1,2,0,0,3,0,0,2],
      [1,2,3,0,0,0,3,2],
      [1,2,2,2,2,2,2,1],
      [0,1,1,1,1,1,1,0],
    ];
    
    // Get colors based on tint
    const edgeColor = this.applyTint(0x333333, tintColor);    // dark gray edge
    const faceColor = this.applyTint(0xffffff, tintColor);    // white face
    const pipColor = this.applyTint(0x000000, tintColor);     // black pips
    
    // Draw pixels
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const pixelValue = pixels[row][col];
        if (pixelValue !== 0) {
          let color: number;
          switch (pixelValue) {
            case 1:
              color = edgeColor;
              break;
            case 2:
              color = faceColor;
              break;
            case 3:
              color = pipColor;
              break;
            default:
              color = 0xffffff;
          }
          graphics.fillStyle(color);
          graphics.fillRect(offsetX + col * pixelSize, offsetY + row * pixelSize, pixelSize, pixelSize);
        }
      }
    }
    
    return graphics;
  }
}

