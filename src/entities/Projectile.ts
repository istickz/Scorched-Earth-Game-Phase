import Phaser from 'phaser';
import { type IProjectileConfig, type IEnvironmentEffects } from '@/types';
import { calculateInitialVelocity } from '@/utils/physicsUtils';

/**
 * Projectile entity with manual ballistic physics
 * No longer uses Matter.js - uses custom physics simulation for better control
 */
export class Projectile extends Phaser.GameObjects.Sprite {
  private ownerId: string;
  private sceneRef: Phaser.Scene;
  private flightSound?: { stop: () => void };
  private lastX: number = 0;
  private lastY: number = 0;

  // Physics properties
  private velocityX: number;
  private velocityY: number;
  private readonly SPEED_MULTIPLIER = 50; // simulation speed multiplier (replaces timeScale)
  private environmentEffects: IEnvironmentEffects;

  constructor(scene: Phaser.Scene, config: IProjectileConfig) {
    // Create sprite without Matter.js physics
    super(scene, config.x, config.y, 'projectile');

    this.sceneRef = scene;
    this.ownerId = config.ownerId;
    this.lastX = config.x;
    this.lastY = config.y;

    // Set environment effects (default to normal conditions if not provided)
    this.environmentEffects = config.environmentEffects || {
      windX: 0,
      windY: 0,
      gravity: 1.0,
      airDensity: 1.0,
      turbulence: 0,
    };

    // Calculate initial velocity
    const { velocityX, velocityY } = calculateInitialVelocity(config.angle, config.power);
    this.velocityX = velocityX;
    this.velocityY = velocityY;

    // Create visual representation
    this.createVisual();

    // Play flight sound if AudioSystem is available
    this.startFlightSound();

    scene.add.existing(this);
    this.setDepth(5); // Render above terrain, below UI
  }

  /**
   * Update projectile position with all physical effects
   * This method should be called each frame from GameScene.update()
   */
  public updatePosition(delta: number): void {
    // Convert delta to seconds and apply speed multiplier
    const dt = (delta / 1000) * this.SPEED_MULTIPLIER;

    // 1. GRAVITY (can vary by planet/biome!)
    this.velocityY += this.environmentEffects.gravity * dt;

    // 2. WIND (affects trajectory)
    // Wind affects slower projectiles more
    const speed = Math.sqrt(this.velocityX ** 2 + this.velocityY ** 2);
    const windEffect = 1.0 / (1.0 + Math.abs(this.velocityX) * 0.1);
    this.velocityX += this.environmentEffects.windX * windEffect * dt;
    this.velocityY += this.environmentEffects.windY * windEffect * dt;

    // 3. AIR RESISTANCE (depends on density and speed)
    const dragCoefficient = 0.01 * this.environmentEffects.airDensity;
    const dragForce = dragCoefficient * speed;

    if (speed > 0) {
      this.velocityX -= (this.velocityX / speed) * dragForce * dt;
      this.velocityY -= (this.velocityY / speed) * dragForce * dt;
    }

    // 4. TURBULENCE (random disturbances, like in a storm)
    if (this.environmentEffects.turbulence > 0) {
      const turbulence = this.environmentEffects.turbulence;
      this.velocityX += (Math.random() - 0.5) * turbulence * dt;
      this.velocityY += (Math.random() - 0.5) * turbulence * dt;
    }

    // 5. UPDATE POSITION
    this.x += this.velocityX * dt;
    this.y += this.velocityY * dt;

    // 6. ROTATION (visual effect based on velocity)
    this.rotation += speed * 0.02 * dt;
  }

  /**
   * Get current speed (useful for visual effects like trails)
   */
  public getSpeed(): number {
    return Math.sqrt(this.velocityX ** 2 + this.velocityY ** 2);
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
   * Get owner ID
   */
  public getOwnerId(): string {
    return this.ownerId;
  }

  /**
   * Start flight sound
   */
  private startFlightSound(): void {
    // Try to get AudioSystem from scene registry or data
    const sceneWithAudio = this.sceneRef as Phaser.Scene & { audioSystem?: { playProjectileFlight: () => { stop: () => void } } };
    const audioSystem = sceneWithAudio.audioSystem;
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
