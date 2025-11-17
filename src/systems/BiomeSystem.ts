import { TerrainBiome, type IBiomeColors, type TimeOfDay, type Season } from '@/types';

/**
 * Biome system for managing colors and visual characteristics
 */
export class BiomeSystem {
  /**
   * Get colors for a specific biome, season, and time of day
   */
  public static getColors(
    biome: TerrainBiome,
    season: Season,
    timeOfDay: TimeOfDay
  ): IBiomeColors {
    const biomeColors = this.BIOME_COLORS[biome];
    const seasonColors = biomeColors[season];
    
    const colors = { ...seasonColors };
    
    // Apply day/night tint
    if (timeOfDay === 'night') {
      colors.sky = this.darkenColor(colors.sky, 0.7);
      colors.ground = this.darkenColor(colors.ground, 0.3);
      if (colors.accent) {
        colors.accent = this.darkenColor(colors.accent, 0.3);
      }
    }
    
    return colors;
  }

  /**
   * Check if biome should have snow layer in winter
   */
  public static shouldHaveSnow(biome: TerrainBiome, season: Season): boolean {
    if (season !== 'winter') return false;
    // Desert and volcanic biomes don't get snow
    return biome !== TerrainBiome.DESERT && biome !== TerrainBiome.VOLCANIC;
  }

  /**
   * Get biome display name
   */
  public static getBiomeName(biome: TerrainBiome): string {
    return this.BIOME_NAMES[biome];
  }

  /**
   * Get biome emoji icon
   */
  public static getBiomeIcon(biome: TerrainBiome): string {
    return this.BIOME_ICONS[biome];
  }

  /**
   * Biome color definitions
   */
  private static readonly BIOME_COLORS: Record<TerrainBiome, Record<Season, IBiomeColors>> = {
    [TerrainBiome.TEMPERATE]: {
      summer: {
        sky: 0x87ceeb,      // Sky blue
        ground: 0x8b4513,   // Saddle brown
        accent: 0x228b22,   // Forest green
      },
      winter: {
        sky: 0xb0e0e6,      // Powder blue
        ground: 0xfffafa,   // Snow white
        accent: 0xe0e0e0,   // Light gray
      },
    },
    [TerrainBiome.DESERT]: {
      summer: {
        sky: 0xffd89b,      // Warm orange-yellow
        ground: 0xd2b48c,   // Tan
        accent: 0xf4a460,   // Sandy brown
      },
      winter: {
        sky: 0xffd89b,      // Same (winter doesn't affect desert much)
        ground: 0xd2b48c,
        accent: 0xf4a460,
      },
    },
    [TerrainBiome.ARCTIC]: {
      summer: {
        sky: 0xb0e0e6,      // Powder blue
        ground: 0xe0e0e0,   // Light gray ice
        accent: 0xc8e6f0,   // Light icy blue
      },
      winter: {
        sky: 0xadd8e6,      // Light blue
        ground: 0xfffafa,   // Snow white
        accent: 0xffffff,   // Pure white
      },
    },
    [TerrainBiome.VOLCANIC]: {
      summer: {
        sky: 0x4a4a4a,      // Dark gray ash
        ground: 0x3d0000,   // Dark red lava rock
        accent: 0xff4500,   // Orange-red lava
      },
      winter: {
        sky: 0x4a4a4a,      // Same (volcanic doesn't change)
        ground: 0x3d0000,
        accent: 0xff4500,
      },
    },
  };

  /**
   * Biome display names
   */
  private static readonly BIOME_NAMES: Record<TerrainBiome, string> = {
    [TerrainBiome.TEMPERATE]: 'Temperate',
    [TerrainBiome.DESERT]: 'Desert',
    [TerrainBiome.ARCTIC]: 'Arctic',
    [TerrainBiome.VOLCANIC]: 'Volcanic',
  };

  /**
   * Biome emoji icons
   */
  private static readonly BIOME_ICONS: Record<TerrainBiome, string> = {
    [TerrainBiome.TEMPERATE]: '🏞️',
    [TerrainBiome.DESERT]: '🏜️',
    [TerrainBiome.ARCTIC]: '❄️',
    [TerrainBiome.VOLCANIC]: '🌋',
  };

  /**
   * Darken a color by a factor
   */
  private static darkenColor(color: number, factor: number): number {
    const r = Math.floor(((color >> 16) & 0xff) * (1 - factor));
    const g = Math.floor(((color >> 8) & 0xff) * (1 - factor));
    const b = Math.floor((color & 0xff) * (1 - factor));
    return (r << 16) | (g << 8) | b;
  }
}

