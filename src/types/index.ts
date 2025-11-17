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
 * Projectile configuration interface
 */
export interface IProjectileConfig {
  x: number;
  y: number;
  angle: number;
  power: number;
  ownerId: string;
}

/**
 * Terrain biome types
 */
export enum TerrainBiome {
  TEMPERATE = 'temperate',
  DESERT = 'desert',
  ARCTIC = 'arctic',
  VOLCANIC = 'volcanic',
}

/**
 * Terrain shape types
 */
export enum TerrainShape {
  HILLS = 'hills',
  MOUNTAINS = 'mountains',
}

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
  roughness: number;
  timeOfDay: TimeOfDay;
  season: Season;
  seed?: number; // Optional seed for terrain generation
}

/**
 * Terrain configuration interface
 */
export interface ITerrainConfig {
  width: number;
  height: number;
  seed?: number;
  roughness?: number;
  minHeight?: number;
  maxHeight?: number;
  skyColor?: number;
  groundColor?: number;
  isNight?: boolean;
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

