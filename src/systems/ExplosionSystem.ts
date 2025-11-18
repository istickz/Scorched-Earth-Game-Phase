import Phaser from 'phaser';
import { TerrainSystem } from './TerrainSystem';

/**
 * Explosion system for visual effects and terrain destruction
 */
export class ExplosionSystem {
  private scene: Phaser.Scene;
  private terrainSystem: TerrainSystem;

  constructor(scene: Phaser.Scene, terrainSystem: TerrainSystem) {
    this.scene = scene;
    this.terrainSystem = terrainSystem;
    this.initializeParticles();
  }

  /**
   * Initialize particle system for explosions
   */
  private initializeParticles(): void {
    // Create a simple particle texture
    const graphics = this.scene.add.graphics();
    graphics.fillStyle(0xffffff);
    graphics.fillCircle(0, 0, 2);
    graphics.generateTexture('explosion-particle', 4, 4);
    graphics.destroy();
  }

  /**
   * Create explosion at specified location
   */
  public explode(x: number, y: number, radius: number, damage: number = 50, ownerId?: string): void {
    // Create explosion particles FIRST (visual feedback - appears immediately)
    this.createExplosionParticles(x, y, radius);

    // Emit explosion event for damage calculation (needed immediately for tank damage)
    this.scene.events.emit('explosion', { x, y, radius, damage, ownerId });

    // With optimized partial redraw, terrain destruction is now fast enough to do synchronously
    // This ensures terrain is destroyed in the same frame as damage is applied, improving synchronization
      this.terrainSystem.destroyCrater(x, y, radius);

    // Screen shake disabled for better performance
  }

  /**
   * Create visual explosion particles (instant animation)
   */
  private createExplosionParticles(x: number, y: number, radius: number): void {
    const particleCount = Math.floor(radius * 1.2);

    // Create single instant particle burst
    const circle = new Phaser.Geom.Circle(0, 0, radius * 0.3);
    const emitter = this.scene.add.particles(x, y, 'explosion-particle', {
      speed: { min: radius * 1.5, max: radius * 3 },
      scale: { start: 2, end: 0 },
      lifespan: 50, // Ultra short lifespan for instant explosion
      tint: [0xff0000, 0xff8800, 0xffff00],
      blendMode: 'ADD',
      quantity: particleCount,
      emitZone: {
        type: 'edge',
        source: circle,
        quantity: particleCount,
      },
    });

    // Clean up emitter instantly after particles die
    this.scene.time.delayedCall(60, () => {
      emitter.destroy();
    });
  }


  /**
   * Calculate damage at a distance from explosion center
   */
  public calculateDamage(distance: number, maxRadius: number, maxDamage: number): number {
    if (distance > maxRadius) {
      return 0;
    }

    // Linear damage falloff
    const damagePercent = 1 - distance / maxRadius;
    return Math.floor(maxDamage * damagePercent);
  }
}

