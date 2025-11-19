/**
 * Core type definitions for the Artillery Game
 */

/**
 * Game mode type
 */
export type GameMode = 'solo' | 'multiplayer' | 'local';

/**
 * Game mode constants
 */
export const GameMode = {
  Solo: 'solo' as const,
  Multiplayer: 'multiplayer' as const,
  Local: 'local' as const,
} as const;

/**
 * Tank configuration interface
 */
export interface ITankConfig {
  x: number;
  y: number;
  health: number;
  maxHealth: number;
  angle: number;
  power: number;
  color: number;
  isPlayer: boolean;
}

/**
 * Environment physical effects
 */
export interface IEnvironmentEffects {
  windX: number;           // horizontal wind force
  windY: number;           // vertical wind force (updrafts/downdrafts)
  gravity: number;         // gravity strength (may vary by biome)
  airDensity: number;      // air density (affects drag)
}

/**
 * Projectile configuration interface
 */
export interface IProjectileConfig {
  x: number;
  y: number;
  angle: number;
  power: number;
  ownerId: string;
  environmentEffects?: IEnvironmentEffects;
  weaponType?: string; // Weapon type (from WeaponType enum)
}

/**
 * Terrain biome types
 */
export const TerrainBiome = {
  TEMPERATE: 'temperate',
  DESERT: 'desert',
  ARCTIC: 'arctic',
  VOLCANIC: 'volcanic',
} as const;

export type TerrainBiome = typeof TerrainBiome[keyof typeof TerrainBiome];

/**
 * Terrain shape types
 */
export const TerrainShape = {
  HILLS: 'hills',
  MOUNTAINS: 'mountains',
} as const;

export type TerrainShape = typeof TerrainShape[keyof typeof TerrainShape];

/**
 * Weather types
 */
export type WeatherType = 'none' | 'rain' | 'snow';

/**
 * Time of day
 */
export type TimeOfDay = 'day' | 'night';

/**
 * Season
 */
export type Season = 'summer' | 'winter';

/**
 * Level configuration with modular system
 */
export interface ILevelConfig {
  biome: TerrainBiome;
  shape: TerrainShape;
  weather: WeatherType;
  timeOfDay: TimeOfDay;
  season: Season;
  seed?: number; // Optional seed for terrain generation
  environmentEffects?: Partial<IEnvironmentEffects>; // Optional custom environment effects (overrides biome defaults, partial allows overriding only specific properties)
  terrainMinHeight?: number; // Optional minimum terrain height as percentage (0.0-1.0), defaults to 0.1 (10% of screen height)
  terrainMaxHeight?: number; // Optional maximum terrain height as percentage (0.0-1.0), defaults to 0.85 (85% of screen height)
}

/**
 * Terrain configuration interface
 */
export interface ITerrainConfig {
  width: number;
  height: number;
  seed?: number;
  terrainMinHeight?: number;
  terrainMaxHeight?: number;
  shape?: TerrainShape;
}

/**
 * Biome color scheme
 */
export interface IBiomeColors {
  sky: number;
  ground: number;
  accent?: number;
}

/**
 * AI difficulty level
 */
export type AIDifficulty = 'easy' | 'medium' | 'hard';

/**
 * AI shot result for learning
 */
export interface IAIShotResult {
  angle: number;
  power: number;
  hitX: number;
  hitY: number;
  targetX: number;
  targetY: number;
  distance: number;
}

/**
 * Network message types
 */
export type NetworkMessageType = 'angle' | 'power' | 'fire' | 'ping' | 'pong';

/**
 * Network message interface
 */
export interface INetworkMessage {
  type: NetworkMessageType;
  data?: unknown;
  timestamp?: number;
  version?: string;
}

/**
 * Connection state
 */
export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error';

