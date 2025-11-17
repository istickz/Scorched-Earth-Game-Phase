import { TerrainShape } from '@/types';

/**
 * Utility class for procedural noise generation
 */
export class NoiseGenerator {
  /**
   * Simple seeded random number generator
   */
  static seededRandom(seed: number): number {
    const x = Math.sin(seed) * 10000;
    return x - Math.floor(x);
  }

  /**
   * Generate smooth noise value using interpolation
   */
  static smoothNoise(x: number, seed: number): number {
    const x1 = Math.floor(x);
    const x2 = x1 + 1;
    const t = x - x1;

    const v1 = this.seededRandom(seed + x1 * 0.01);
    const v2 = this.seededRandom(seed + x2 * 0.01);

    // Smooth interpolation (cosine interpolation for smoother result)
    const smoothT = (1 - Math.cos(t * Math.PI)) * 0.5;
    return v1 * (1 - smoothT) + v2 * smoothT;
  }

  /**
   * Generate fractal noise (multiple octaves)
   * Hills: fewer octaves, lower frequency = smoother terrain
   * Mountains: more octaves, higher frequency = rougher terrain
   */
  static fractalNoise(x: number, seed: number, shape: TerrainShape, octaves?: number): number {
    let value = 0;
    let amplitude = 1;
    let frequency: number;
    let actualOctaves: number;

    // Configure based on shape
    if (shape === TerrainShape.HILLS) {
      actualOctaves = octaves || 3;
      frequency = 0.003; // Lower frequency = wider features
    } else { // MOUNTAINS
      actualOctaves = octaves || 6;
      frequency = 0.006; // Higher frequency = more detail
    }

    let maxValue = 0;

    for (let i = 0; i < actualOctaves; i++) {
      value += this.smoothNoise(x * frequency, seed + i * 1000) * amplitude;
      maxValue += amplitude;
      amplitude *= 0.5; // Each octave has half the amplitude
      frequency *= 2; // Each octave has double the frequency
    }

    return value / maxValue; // Normalize to 0-1
  }
}

