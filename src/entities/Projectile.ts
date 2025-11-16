import Phaser from 'phaser';
import { type IProjectileConfig } from '@/types';

/**
 * Projectile entity with ballistic physics
 */
export class Projectile extends Phaser.Physics.Matter.Sprite {
  private ownerId: string;
  private sceneRef: Phaser.Scene;
  private flightSound?: { stop: () => void };
  private lastX: number = 0;
  private lastY: number = 0;

  constructor(scene: Phaser.Scene, config: IProjectileConfig) {
    // Create sprite
    super(scene.matter.world, config.x, config.y, 'projectile', undefined, {
      shape: { type: 'circle', radius: 4 },
    });

    this.sceneRef = scene;
    this.ownerId = config.ownerId;

    // Set up physics
    const angleRad = Phaser.Math.DegToRad(config.angle);
    // Base velocity multiplier - physics will be accelerated via timeScale instead
    const velocity = (config.power / 100) * 50;
    const velocityX = Math.cos(angleRad) * velocity;
    const velocityY = Math.sin(angleRad) * velocity;

    this.setVelocity(velocityX, velocityY);
    this.setFrictionAir(0.01); // Air resistance
    this.setMass(0.1);

    // Store initial position for trajectory checking
    this.lastX = config.x;
    this.lastY = config.y;

    // Create visual representation
    this.createVisual();

    // Play flight sound if AudioSystem is available
    this.startFlightSound();

    scene.add.existing(this);
    this.setDepth(5); // Render above terrain, below UI
  }

  /**
   * Update last position (call this each frame before checking collisions)
   */
  public updateLastPosition(): void {
    this.lastX = this.x;
    this.lastY = this.y;
  }

  /**
   * Get last position for trajectory checking
   */
  public getLastPosition(): { x: number; y: number } {
    return { x: this.lastX, y: this.lastY };
  }

  /**
   * Start flight sound
   */
  private startFlightSound(): void {
    // Try to get AudioSystem from scene registry or data
    const audioSystem = (this.sceneRef as any).audioSystem;
    if (audioSystem && typeof audioSystem.playProjectileFlight === 'function') {
      this.flightSound = audioSystem.playProjectileFlight();
    }
  }

  /**
   * Create visual representation of projectile
   */
  private createVisual(): void {
    // Check if texture already exists, if not create it
    if (!this.sceneRef.textures.exists('projectile')) {
      const graphics = this.sceneRef.add.graphics();
      graphics.fillStyle(0xffff00); // Yellow
      graphics.fillCircle(4, 4, 4);
      graphics.generateTexture('projectile', 8, 8);
      graphics.destroy();
    }

    this.setTexture('projectile');
    this.setDisplaySize(8, 8);
  }

  /**
   * Get owner ID
   */
  public getOwnerId(): string {
    return this.ownerId;
  }

  /**
   * Clean up resources
   */
  public destroy(): void {
    // Stop flight sound
    if (this.flightSound) {
      this.flightSound.stop();
      this.flightSound = undefined;
    }

    super.destroy();
  }
}

