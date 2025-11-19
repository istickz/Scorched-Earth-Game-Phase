import { type ILevelConfig, TerrainBiome, TerrainShape } from '@/types';

/**
 * Create random level configuration for solo and P2P modes
 */
export function createRandomLevelConfig(): ILevelConfig {
  const biomes = [TerrainBiome.TEMPERATE, TerrainBiome.DESERT, TerrainBiome.ARCTIC, TerrainBiome.VOLCANIC];
  const shapes = [TerrainShape.HILLS, TerrainShape.MOUNTAINS];
  const weathers: Array<'none' | 'rain' | 'snow'> = ['none', 'rain', 'snow'];
  const times: Array<'day' | 'night'> = ['day', 'night'];
  const seasons: Array<'summer' | 'winter'> = ['summer', 'winter'];

  return {
    biome: biomes[Math.floor(Math.random() * biomes.length)],
    shape: shapes[Math.floor(Math.random() * shapes.length)],
    weather: weathers[Math.floor(Math.random() * weathers.length)],
    timeOfDay: times[Math.floor(Math.random() * times.length)],
    season: seasons[Math.floor(Math.random() * seasons.length)],
  };
}

