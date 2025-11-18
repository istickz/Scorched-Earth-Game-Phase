import { type ILevelConfig, TerrainBiome, TerrainShape } from '@/types';

/**
 * Predefined levels for singleplayer mode
 * Levels progressively increase in difficulty through terrain roughness and environmental effects
 * 
 * Levels 1-10: Basic progression with increasing roughness, no custom wind
 * Levels 11+: Advanced levels with strong wind effects
 */
export const SINGLEPLAYER_LEVELS: ILevelConfig[] = [
  // Level 1: Ознакомительный (Tutorial)
  {
    biome: TerrainBiome.TEMPERATE,
    shape: TerrainShape.HILLS,
    weather: 'none',
    roughness: 0.10,
    timeOfDay: 'day',
    season: 'summer',
    seed: 12345,
  },

  // Level 2: Night (обязательно ночь)
  {
    biome: TerrainBiome.TEMPERATE,
    shape: TerrainShape.HILLS,
    weather: 'none',
    roughness: 0.12,
    timeOfDay: 'night',
    season: 'summer',
    seed: 23456,
  },

  // Level 3: Desert biome introduction
  {
    biome: TerrainBiome.DESERT,
    shape: TerrainShape.HILLS,
    weather: 'none',
    roughness: 0.15,
    timeOfDay: 'day',
    season: 'summer',
    seed: 34567,
  },

  // Level 4: Arctic biome introduction
  {
    biome: TerrainBiome.ARCTIC,
    shape: TerrainShape.HILLS,
    weather: 'snow',
    roughness: 0.17,
    timeOfDay: 'day',
    season: 'winter',
    seed: 45678,
  },

  // Level 5: Rain weather introduction
  {
    biome: TerrainBiome.TEMPERATE,
    shape: TerrainShape.MOUNTAINS,
    weather: 'rain',
    roughness: 0.19,
    timeOfDay: 'day',
    season: 'summer',
    seed: 56789,
  },

  // Level 6: Volcanic biome introduction
  {
    biome: TerrainBiome.VOLCANIC,
    shape: TerrainShape.HILLS,
    weather: 'none',
    roughness: 0.21,
    timeOfDay: 'night',
    season: 'summer',
    seed: 67890,
  },

  // Level 7: Night with snow
  {
    biome: TerrainBiome.ARCTIC,
    shape: TerrainShape.MOUNTAINS,
    weather: 'snow',
    roughness: 0.23,
    timeOfDay: 'night',
    season: 'winter',
    seed: 78901,
  },

  // Level 8: Desert night
  {
    biome: TerrainBiome.DESERT,
    shape: TerrainShape.HILLS,
    weather: 'none',
    roughness: 0.25,
    timeOfDay: 'night',
    season: 'summer',
    seed: 89012,
  },

  // Level 9: Volcanic with rain
  {
    biome: TerrainBiome.VOLCANIC,
    shape: TerrainShape.MOUNTAINS,
    weather: 'rain',
    roughness: 0.27,
    timeOfDay: 'day',
    season: 'summer',
    seed: 90123,
  },

  // Level 10: Mixed challenge
  {
    biome: TerrainBiome.TEMPERATE,
    shape: TerrainShape.MOUNTAINS,
    weather: 'snow',
    roughness: 0.30,
    timeOfDay: 'night',
    season: 'winter',
    seed: 101234,
  },

  // Level 11: First level with strong wind (rain)
  {
    biome: TerrainBiome.TEMPERATE,
    shape: TerrainShape.HILLS,
    weather: 'rain',
    roughness: 0.30,
    timeOfDay: 'day',
    season: 'summer',
    seed: 111234,
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
    roughness: 0.32,
    timeOfDay: 'day',
    season: 'winter',
    seed: 121234,
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
    roughness: 0.34,
    timeOfDay: 'night',
    season: 'summer',
    seed: 131234,
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
    roughness: 0.36,
    timeOfDay: 'day',
    season: 'summer',
    seed: 141234,
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
    roughness: 0.38,
    timeOfDay: 'night',
    season: 'winter',
    seed: 151234,
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
    roughness: 0.40,
    timeOfDay: 'day',
    season: 'winter',
    seed: 161234,
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
    roughness: 0.42,
    timeOfDay: 'night',
    season: 'summer',
    seed: 171234,
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
    roughness: 0.43,
    timeOfDay: 'day',
    season: 'summer',
    seed: 181234,
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
    roughness: 0.44,
    timeOfDay: 'night',
    season: 'winter',
    seed: 191234,
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
    roughness: 0.45,
    timeOfDay: 'day',
    season: 'winter',
    seed: 201234,
    environmentEffects: {
      windX: -1.5,
      // Other effects will use defaults from EnvironmentSystem
    },
  },
];

