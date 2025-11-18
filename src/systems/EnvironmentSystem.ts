import { TerrainBiome, type IEnvironmentEffects, type WeatherType, type TimeOfDay } from '@/types';

/**
 * System for managing environmental physical effects
 * Controls wind, gravity, and air density based on biome, weather, and time
 */
export class EnvironmentSystem {
  /**
   * Get physical effects for current environment
   */
  static getEffects(
    biome: TerrainBiome,
    weather: WeatherType,
    timeOfDay: TimeOfDay
  ): IEnvironmentEffects {
    const effects: IEnvironmentEffects = {
      windX: 0,
      windY: 0,
      gravity: 1.0,
      airDensity: 1.0,
    };

    // BIOME affects gravity and air density
    switch (biome) {
      case TerrainBiome.ARCTIC:
        effects.airDensity = 1.2; // cold air is denser
        effects.windX = 0.5; // strong arctic winds
        break;

      case TerrainBiome.DESERT:
        effects.airDensity = 0.8; // hot air is less dense
        effects.windY = -0.2; // updrafts from hot ground!
        break;

      case TerrainBiome.VOLCANIC:
        effects.gravity = 1.2; // increased gravity (heavy planet?)
        effects.airDensity = 0.6; // thin air from heat
        break;

      case TerrainBiome.TEMPERATE:
        // Normal conditions
        break;
    }

    // WEATHER affects wind
    switch (weather) {
      case 'rain':
        effects.windX += 0.3;
        effects.airDensity += 0.1; // humid air is denser
        break;

      case 'snow':
        effects.windX += 0.4;
        effects.airDensity += 0.15;
        break;

      case 'none':
        // No additional effects
        break;
    }

    // TIME OF DAY can affect wind
    if (timeOfDay === 'night') {
      effects.windX *= 0.7; // wind is weaker at night
    }

    return effects;
  }

  /**
   * Get random wind variation (changes each round)
   */
  static getWindVariation(): { windX: number; windY: number } {
    return {
      windX: (Math.random() - 0.5) * 0.5,
      windY: (Math.random() - 0.5) * 0.2,
    };
  }

  /**
   * Get descriptive text for current environment
   */
  static getEnvironmentDescription(effects: IEnvironmentEffects): string {
    const parts: string[] = [];

    if (Math.abs(effects.windX) > 0.3) {
      parts.push(effects.windX > 0 ? 'Strong Wind →' : 'Strong Wind ←');
    } else if (Math.abs(effects.windX) > 0.1) {
      parts.push(effects.windX > 0 ? 'Wind →' : 'Wind ←');
    }

    if (effects.windY < -0.1) {
      parts.push('Updrafts ↑');
    } else if (effects.windY > 0.1) {
      parts.push('Downdrafts ↓');
    }

    if (effects.gravity > 1.1) {
      parts.push('High Gravity');
    } else if (effects.gravity < 0.9) {
      parts.push('Low Gravity');
    }

    return parts.length > 0 ? parts.join(' | ') : 'Normal Conditions';
  }
}

