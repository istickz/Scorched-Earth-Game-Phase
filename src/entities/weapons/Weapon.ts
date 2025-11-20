import { type WeaponType, type IFirePlan, type IFireData, type IExplosionConfig, type IPhysicsConfig, type IVisualConfig } from '@/types/weapons';
import { type Projectile } from '@/entities/Projectile';

/**
 * Abstract base class for all weapons
 * Implements Template Method pattern - defines structure, subclasses implement specifics
 */
export abstract class Weapon {
  public readonly type: WeaponType;
  public readonly name: string;
  public readonly description: string;
  
  // Physics
  protected readonly speedMultiplier: number;
  protected readonly airResistanceMultiplier: number;
  
  // Explosion
  protected readonly explosionRadius: number;
  protected readonly explosionDamage: number;
  protected readonly explosionShape: 'circle' | 'vertical' | 'horizontal';
  protected readonly explosionShapeRatio: number;
  
  // Visual
  protected readonly color: number;
  protected readonly explosionColor?: number;
  
  // Sound
  protected readonly fireSound?: string;
  protected readonly explosionSound?: string;

  constructor(config: {
    type: WeaponType;
    name: string;
    description: string;
    speedMultiplier: number;
    airResistanceMultiplier: number;
    explosionRadius: number;
    explosionDamage: number;
    explosionShape?: 'circle' | 'vertical' | 'horizontal';
    explosionShapeRatio?: number;
    color: number;
    explosionColor?: number;
    fireSound?: string;
    explosionSound?: string;
  }) {
    this.type = config.type;
    this.name = config.name;
    this.description = config.description;
    this.speedMultiplier = config.speedMultiplier;
    this.airResistanceMultiplier = config.airResistanceMultiplier;
    this.explosionRadius = config.explosionRadius;
    this.explosionDamage = config.explosionDamage;
    this.explosionShape = config.explosionShape || 'circle';
    this.explosionShapeRatio = config.explosionShapeRatio || 1.0;
    this.color = config.color;
    this.explosionColor = config.explosionColor;
    this.fireSound = config.fireSound;
    this.explosionSound = config.explosionSound;
  }

  /**
   * Generate fire plan for this weapon
   * Abstract method - must be implemented by subclasses
   */
  public abstract createFirePlan(fireData: IFireData, ownerId: string): IFirePlan;

  /**
   * Check if projectile should split (optional, for splitting weapons)
   */
  public shouldSplit?(_projectile: Projectile): boolean;

  /**
   * Generate split plan for projectile (optional, for splitting weapons)
   */
  public createSplitPlan?(_projectile: Projectile, _ownerId: string): IFirePlan;

  /**
   * Check if projectile should bounce (optional, for bouncing weapons)
   */
  public shouldBounce?(_projectile: Projectile): boolean;

  /**
   * Calculate bounce velocity (optional, for bouncing weapons)
   */
  public calculateBounceVelocity?(_projectile: Projectile, _surfaceNormalAngle: number): { velocityX: number; velocityY: number };

  /**
   * Get explosion configuration
   */
  public getExplosionConfig(): IExplosionConfig {
    return {
      radius: this.explosionRadius,
      damage: this.explosionDamage,
      shape: this.explosionShape,
      shapeRatio: this.explosionShapeRatio,
      color: this.explosionColor,
    };
  }

  /**
   * Get physics configuration
   */
  public getPhysicsConfig(): IPhysicsConfig {
    return {
      speedMultiplier: this.speedMultiplier,
      airResistanceMultiplier: this.airResistanceMultiplier,
    };
  }

  /**
   * Get visual configuration
   */
  public getVisualConfig(): IVisualConfig {
    return {
      color: this.color,
      explosionColor: this.explosionColor,
    };
  }
}

