import { type ILevelConfig, TerrainBiome, TerrainShape } from '@/types';

/**
 * Predefined levels for singleplayer mode
 * Levels progressively increase in difficulty through environmental effects
 * 
 * Levels 1-10: Basic progression, no custom wind
 * Levels 11+: Advanced levels with strong wind effects
 */
export const SINGLEPLAYER_LEVELS: ILevelConfig[] = [
  // Level 1: Ознакомительный (Tutorial)
  {
    biome: TerrainBiome.TEMPERATE,
    shape: TerrainShape.HILLS,
    weather: 'none',
    timeOfDay: 'day',
    season: 'summer',
    seed: 12345,
    terrainMinHeight: 0.1,
    terrainMaxHeight: 0.4,
  },

  // Level 2: Night (обязательно ночь)
  {
    biome: TerrainBiome.TEMPERATE,
    shape: TerrainShape.HILLS,
    weather: 'none',
    timeOfDay: 'night',
    season: 'summer',
    seed: 23456,
    terrainMinHeight: 0.12,
    terrainMaxHeight: 0.78,
  },

  // Level 3: Desert biome introduction
  {
    biome: TerrainBiome.DESERT,
    shape: TerrainShape.HILLS,
    weather: 'none',
    timeOfDay: 'day',
    season: 'summer',
    seed: 34567,
    terrainMinHeight: 0.15,
    terrainMaxHeight: 0.8,
  },

  // Level 4: Arctic biome introduction
  {
    biome: TerrainBiome.ARCTIC,
    shape: TerrainShape.HILLS,
    weather: 'snow',
    timeOfDay: 'day',
    season: 'winter',
    seed: 45678,
    terrainMinHeight: 0.13,
    terrainMaxHeight: 0.82,
  },

  // Level 5: Rain weather introduction
  {
    biome: TerrainBiome.TEMPERATE,
    shape: TerrainShape.MOUNTAINS,
    weather: 'rain',
    timeOfDay: 'day',
    season: 'summer',
    seed: 56789,
    terrainMinHeight: 0.15,
    terrainMaxHeight: 0.85,
  },

  // Level 6: Volcanic biome introduction
  {
    biome: TerrainBiome.VOLCANIC,
    shape: TerrainShape.HILLS,
    weather: 'none',
    timeOfDay: 'night',
    season: 'summer',
    seed: 67890,
    terrainMinHeight: 0.14,
    terrainMaxHeight: 0.83,
  },

  // Level 7: Night with snow
  {
    biome: TerrainBiome.ARCTIC,
    shape: TerrainShape.MOUNTAINS,
    weather: 'snow',
    timeOfDay: 'night',
    season: 'winter',
    seed: 78901,
    terrainMinHeight: 0.16,
    terrainMaxHeight: 0.86,
  },

  // Level 8: Desert night
  {
    biome: TerrainBiome.DESERT,
    shape: TerrainShape.HILLS,
    weather: 'none',
    timeOfDay: 'night',
    season: 'summer',
    seed: 89012,
    terrainMinHeight: 0.15,
    terrainMaxHeight: 0.84,
  },

  // Level 9: Volcanic with rain
  {
    biome: TerrainBiome.VOLCANIC,
    shape: TerrainShape.MOUNTAINS,
    weather: 'rain',
    timeOfDay: 'day',
    season: 'summer',
    seed: 90123,
    terrainMinHeight: 0.17,
    terrainMaxHeight: 0.87,
  },

  // Level 10: Mixed challenge
  {
    biome: TerrainBiome.TEMPERATE,
    shape: TerrainShape.MOUNTAINS,
    weather: 'snow',
    timeOfDay: 'night',
    season: 'winter',
    seed: 101234,
    terrainMinHeight: 0.18,
    terrainMaxHeight: 0.88,
  },

  // Level 11: First level with strong wind (rain)
  {
    biome: TerrainBiome.TEMPERATE,
    shape: TerrainShape.HILLS,
    weather: 'rain',
    timeOfDay: 'day',
    season: 'summer',
    seed: 111234,
    terrainMinHeight: 0.16,
    terrainMaxHeight: 0.86,
    environmentEffects: {
      windX: 1.0,
      // Other effects (windY, gravity, airDensity) will use defaults from EnvironmentSystem
    },
  },

  // Level 12: Wind with snow
  {
    biome: TerrainBiome.ARCTIC,
    shape: TerrainShape.MOUNTAINS,
    weather: 'snow',
    timeOfDay: 'day',
    season: 'winter',
    seed: 121234,
    terrainMinHeight: 0.19,
    terrainMaxHeight: 0.89,
    environmentEffects: {
      windX: -1.2,
      // Other effects will use defaults from EnvironmentSystem
    },
  },

  // Level 13: Strong wind right
  {
    biome: TerrainBiome.DESERT,
    shape: TerrainShape.HILLS,
    weather: 'rain',
    timeOfDay: 'night',
    season: 'summer',
    seed: 131234,
    terrainMinHeight: 0.17,
    terrainMaxHeight: 0.87,
    environmentEffects: {
      windX: 1.5,
      // Other effects will use defaults from EnvironmentSystem
    },
  },

  // Level 14: Strong wind left
  {
    biome: TerrainBiome.VOLCANIC,
    shape: TerrainShape.MOUNTAINS,
    weather: 'snow',
    timeOfDay: 'day',
    season: 'summer',
    seed: 141234,
    terrainMinHeight: 0.2,
    terrainMaxHeight: 0.9,
    environmentEffects: {
      windX: -1.5,
      // Other effects will use defaults from EnvironmentSystem
    },
  },

  // Level 15: Moderate wind with rain
  {
    biome: TerrainBiome.TEMPERATE,
    shape: TerrainShape.MOUNTAINS,
    weather: 'rain',
    timeOfDay: 'night',
    season: 'winter',
    seed: 151234,
    terrainMinHeight: 0.18,
    terrainMaxHeight: 0.88,
    environmentEffects: {
      windX: 0.8,
      // Other effects will use defaults from EnvironmentSystem
    },
  },

  // Level 16: Variable wind
  {
    biome: TerrainBiome.ARCTIC,
    shape: TerrainShape.HILLS,
    weather: 'snow',
    timeOfDay: 'day',
    season: 'winter',
    seed: 161234,
    terrainMinHeight: 0.19,
    terrainMaxHeight: 0.89,
    environmentEffects: {
      windX: -0.9,
      // Other effects will use defaults from EnvironmentSystem
    },
  },

  // Level 17: Extreme wind right
  {
    biome: TerrainBiome.DESERT,
    shape: TerrainShape.MOUNTAINS,
    weather: 'rain',
    timeOfDay: 'night',
    season: 'summer',
    seed: 171234,
    terrainMinHeight: 0.2,
    terrainMaxHeight: 0.9,
    environmentEffects: {
      windX: 1.4,
      // Other effects will use defaults from EnvironmentSystem
    },
  },

  // Level 18: Extreme wind left
  {
    biome: TerrainBiome.VOLCANIC,
    shape: TerrainShape.HILLS,
    weather: 'snow',
    timeOfDay: 'day',
    season: 'summer',
    seed: 181234,
    terrainMinHeight: 0.18,
    terrainMaxHeight: 0.88,
    environmentEffects: {
      windX: -1.3,
      // Other effects will use defaults from EnvironmentSystem
    },
  },

  // Level 19: Maximum challenge
  {
    biome: TerrainBiome.TEMPERATE,
    shape: TerrainShape.MOUNTAINS,
    weather: 'rain',
    timeOfDay: 'night',
    season: 'winter',
    seed: 191234,
    terrainMinHeight: 0.2,
    terrainMaxHeight: 0.92,
    environmentEffects: {
      windX: 1.5,
      // Other effects will use defaults from EnvironmentSystem
    },
  },

  // Level 20: Final challenge
  {
    biome: TerrainBiome.ARCTIC,
    shape: TerrainShape.MOUNTAINS,
    weather: 'snow',
    timeOfDay: 'day',
    season: 'winter',
    seed: 201234,
    terrainMinHeight: 0.2,
    terrainMaxHeight: 0.92,
    environmentEffects: {
      windX: -1.5,
      // Other effects will use defaults from EnvironmentSystem
    },
  },
];

