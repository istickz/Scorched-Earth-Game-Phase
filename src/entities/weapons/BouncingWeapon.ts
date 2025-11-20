import Phaser from 'phaser';
import { Weapon } from './Weapon';
import { type IFirePlan, type IFireData, WeaponType } from '@/types/weapons';
import { type IProjectileConfig } from '@/types';
import { type Projectile } from '@/entities/Projectile';

/**
 * Bouncing weapon - projectile bounces off terrain surface multiple times before exploding
 */
export class BouncingWeapon extends Weapon {
  private readonly maxBounces: number = 3;      // Maximum number of bounces
  private readonly bounceSpeedLoss: number = 0.7; // Speed multiplier after each bounce (loses 30% speed)
  private readonly minBounceSpeed: number = 5;   // Minimum speed to bounce (below this, explodes)

  constructor() {
    super({
      type: WeaponType.BOUNCING,
      name: 'Bouncing Shell',
      description: 'Рикошет - отскакивает от поверхности до 3 раз',
      speedMultiplier: 1.2,        // Slightly faster to make bounces more visible
      airResistanceMultiplier: 1.0,
      explosionRadius: 30,         // Medium radius
      explosionDamage: 45,         // Medium damage
      explosionShape: 'circle',
      color: 0x00aaff,             // Blue/cyan color
      explosionColor: 0x0088ff,
    });
  }

  public createFirePlan(fireData: IFireData, ownerId: string): IFirePlan {
    const projectileConfig: IProjectileConfig = {
      x: fireData.x,
      y: fireData.y,
      angle: fireData.angle,
      power: fireData.power,
      ownerId: ownerId,
      weaponType: fireData.weaponType,
    };

    return {
      projectiles: [
        {
          config: projectileConfig,
        },
      ],
      shotData: {
        angle: fireData.angle,
        power: fireData.power,
        ownerId: ownerId,
      },
      playSound: true,
      clearPreview: true,
    };
  }

  /**
   * Check if projectile should bounce
   * Bounces if: hasn't reached max bounces AND speed is above minimum
   */
  public shouldBounce(projectile: Projectile): boolean {
    const bounceCount = projectile.getBounceCount();
    const speed = projectile.getSpeed();
    
    return bounceCount < this.maxBounces && speed >= this.minBounceSpeed;
  }

  /**
   * Calculate bounce velocity based on surface normal
   * Uses simplified reflection: reflects velocity vector about surface normal
   */
  public calculateBounceVelocity(
    projectile: Projectile,
    surfaceNormalAngle: number
  ): { velocityX: number; velocityY: number } {
    const currentVelocity = projectile.getVelocity();
    const speed = projectile.getSpeed();
    
    // Convert surface normal angle to radians
    // Surface normal points upward from terrain (perpendicular to surface)
    const normalAngleRad = Phaser.Math.DegToRad(surfaceNormalAngle);
    const normalX = Math.cos(normalAngleRad);
    const normalY = Math.sin(normalAngleRad);
    
    // Calculate reflection: v' = v - 2(v·n)n
    // Where v is velocity vector, n is normalized normal vector
    const dotProduct = currentVelocity.x * normalX + currentVelocity.y * normalY;
    const reflectedX = currentVelocity.x - 2 * dotProduct * normalX;
    const reflectedY = currentVelocity.y - 2 * dotProduct * normalY;
    
    // Apply speed loss and normalize
    const newSpeed = speed * this.bounceSpeedLoss;
    const reflectedLength = Math.sqrt(reflectedX ** 2 + reflectedY ** 2);
    
    if (reflectedLength > 0) {
      return {
        velocityX: (reflectedX / reflectedLength) * newSpeed,
        velocityY: (reflectedY / reflectedLength) * newSpeed,
      };
    }
    
    // Fallback: reverse Y velocity if reflection calculation fails
    return {
      velocityX: currentVelocity.x * this.bounceSpeedLoss,
      velocityY: -currentVelocity.y * this.bounceSpeedLoss,
    };
  }
}

