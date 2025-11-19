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
  public explode(
    x: number, 
    y: number, 
    radius: number, 
    damage: number = 50, 
    ownerId?: string, 
    weaponType: string = 'standard',
    explosionColor?: number
  ): void {
    // Create explosion particles FIRST (visual feedback - appears immediately)
    this.createExplosionParticles(x, y, radius, weaponType, explosionColor);

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
  private createExplosionParticles(
    x: number, 
    y: number, 
    radius: number, 
    weaponType: string = 'standard',
    explosionColor?: number
  ): void {
    // Choose particle effect based on weapon type
    switch (weaponType) {
      case 'salvo':
        this.createSalvoExplosion(x, y, radius, explosionColor);
        break;
      case 'hazelnut':
        this.createHazelnutExplosion(x, y, radius, explosionColor);
        break;
      default:
        this.createStandardExplosion(x, y, radius);
        break;
    }
  }

  /**
   * Standard explosion - yellow/orange/red
   */
  private createStandardExplosion(x: number, y: number, radius: number): void {
    const particleCount = Math.floor(radius * 1.2);

    // Central flash
    this.createExplosionFlash(x, y, radius * 0.8, 0xffff00, 300);

    // Visual shockwave ring to show explosion radius
    this.createShockwaveRing(x, y, radius, 0xffff00);

    const circle = new Phaser.Geom.Circle(0, 0, radius * 0.3);
    const emitter = this.scene.add.particles(x, y, 'explosion-particle', {
      speed: { min: radius * 1.5, max: radius * 3 },
      scale: { start: 2, end: 0 },
      lifespan: 500,
      tint: [0xff0000, 0xff8800, 0xffff00], // Red, orange, yellow
      blendMode: 'ADD',
      quantity: particleCount,
      emitZone: {
        type: 'edge',
        source: circle,
        quantity: particleCount,
      },
    });

    this.scene.time.delayedCall(600, () => {
      emitter.destroy();
    });
  }

  /**
   * Salvo explosion - bright orange/red with more particles
   */
  private createSalvoExplosion(x: number, y: number, radius: number, explosionColor?: number): void {
    const particleCount = Math.floor(radius * 1.5); // More particles

    // Intense white-hot flash (brighter and bigger)
    this.createExplosionFlash(x, y, radius * 1.2, 0xffffff, 200);

    // Visual shockwave ring (smaller radius for salvo)
    this.createShockwaveRing(x, y, radius, explosionColor || 0xff4400);

    const circle = new Phaser.Geom.Circle(0, 0, radius * 0.4);
    const emitter = this.scene.add.particles(x, y, 'explosion-particle', {
      speed: { min: radius * 2, max: radius * 4 }, // Faster
      scale: { start: 2.5, end: 0 }, // Bigger particles
      lifespan: 600, // Longer lasting
      tint: explosionColor ? [explosionColor, 0xff6600, 0xff0000] : [0xff4400, 0xff6600, 0xff0000], // Bright orange-red
      blendMode: 'ADD',
      quantity: particleCount,
      emitZone: {
        type: 'edge',
        source: circle,
        quantity: particleCount,
      },
    });

    // Add inner bright flash
    const innerEmitter = this.scene.add.particles(x, y, 'explosion-particle', {
      speed: { min: radius * 0.5, max: radius * 1 },
      scale: { start: 3, end: 0 },
      lifespan: 400,
      tint: [0xffffff, 0xffff00], // White-yellow flash
      blendMode: 'ADD',
      quantity: Math.floor(particleCount * 0.5),
    });

    this.scene.time.delayedCall(700, () => {
      emitter.destroy();
      innerEmitter.destroy();
    });
  }

  /**
   * Hazelnut explosion - brown/orange with vertical spread
   */
  private createHazelnutExplosion(x: number, y: number, radius: number, explosionColor?: number): void {
    const particleCount = Math.floor(radius * 1.3);

    // Concentrated orange flash (smaller but intense)
    this.createExplosionFlash(x, y, radius * 0.6, explosionColor || 0xff8800, 250);

    // Visual shockwave ring (smallest radius for hazelnut - precise strike)
    this.createShockwaveRing(x, y, radius, explosionColor || 0xff8800);

    // Main explosion with brown/orange colors
    const circle = new Phaser.Geom.Circle(0, 0, radius * 0.35);
    const emitter = this.scene.add.particles(x, y, 'explosion-particle', {
      speed: { min: radius * 1.8, max: radius * 3.5 },
      scale: { start: 2.2, end: 0 },
      lifespan: 550,
      tint: explosionColor ? [explosionColor, 0xcc6600, 0x8b4513] : [0xff8800, 0xcc6600, 0x8b4513], // Orange-brown
      blendMode: 'ADD',
      quantity: particleCount,
      emitZone: {
        type: 'edge',
        source: circle,
        quantity: particleCount,
      },
    });

    // Add directional burst (simulating downward strike)
    const downwardEmitter = this.scene.add.particles(x, y, 'explosion-particle', {
      speedY: { min: radius * 2, max: radius * 4 }, // Downward velocity
      speedX: { min: -radius * 0.5, max: radius * 0.5 }, // Slight horizontal spread
      scale: { start: 1.5, end: 0 },
      lifespan: 400,
      tint: [0xffaa00, 0xff8800], // Bright orange
      blendMode: 'ADD',
      quantity: Math.floor(particleCount * 0.4),
    });

    this.scene.time.delayedCall(650, () => {
      emitter.destroy();
      downwardEmitter.destroy();
    });
  }

  /**
   * Create expanding shockwave ring to visualize explosion radius
   */
  private createShockwaveRing(x: number, y: number, radius: number, color: number): void {
    const ring = this.scene.add.graphics();
    ring.setPosition(x, y); // Set graphics position FIRST
    ring.lineStyle(3, color, 0.8);
    ring.strokeCircle(0, 0, 5); // Draw at (0,0) relative to graphics position
    ring.setDepth(3);

    // Animate ring expansion
    this.scene.tweens.add({
      targets: ring,
      scaleX: radius / 5,
      scaleY: radius / 5,
      alpha: 0,
      duration: 400,
      ease: 'Cubic.easeOut',
      onComplete: () => {
        ring.destroy();
      }
    });
  }

  /**
   * Create bright flash at explosion center
   */
  private createExplosionFlash(x: number, y: number, size: number, color: number, duration: number): void {
    const flash = this.scene.add.graphics();
    flash.setPosition(x, y); // Set graphics position FIRST
    flash.fillStyle(color, 0.9);
    flash.fillCircle(0, 0, size); // Draw at (0,0) relative to graphics position
    flash.setDepth(4);
    flash.setBlendMode(Phaser.BlendModes.ADD);

    // Animate flash fade and shrink
    this.scene.tweens.add({
      targets: flash,
      alpha: 0,
      scaleX: 0.3,
      scaleY: 0.3,
      duration: duration,
      ease: 'Cubic.easeOut',
      onComplete: () => {
        flash.destroy();
      }
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

