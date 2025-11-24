import { Weapon } from './Weapon';
import { type IFirePlan, type IFireData, WeaponType } from '@/types/weapons';
import { type IProjectileConfig } from '@/types';
import { type Projectile } from '@/entities/Projectile';

/**
 * Hazelnut weapon - projectile splits into multiple projectiles at peak of trajectory
 */
export class HazelnutWeapon extends Weapon {
  private readonly splitCount: number = 30;  
  private readonly splitSpread: number = 60; 

  constructor() {
    super({
      type: WeaponType.HAZELNUT,
      name: 'Hazelnut',
      description: 'Орешник - пробивает глубокие узкие кратеры',
      speedMultiplier: 1.0,
      airResistanceMultiplier: 1.0,
      explosionRadius: 18,        // Маленький радиус - точечный удар
      explosionDamage: 40,        // Высокий урон в точке попадания
      explosionShape: 'vertical', // Вертикальный овал - узкий глубокий кратер
      explosionShapeRatio: 2.0,   // В 2 раза глубже чем шире
      color: 0x8b4513,            // Коричневый (цвет ореха)
      explosionColor: 0xff8800,
    });
  }

  public createFirePlan(fireData: IFireData, ownerId: string): IFirePlan {
    // Hazelnut fires as single projectile initially
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
   * Check if projectile should split
   * Splits when projectile has reached peak and started falling
   */
  public shouldSplit(projectile: Projectile): boolean {
    const velocity = projectile.getVelocity();
    const distanceTraveled = projectile.getDistanceTraveled();
    const minDistance = 100; // Minimum distance before split (prevents immediate split)
    
    // Split when: velocityY > 0 (falling) AND traveled minimum distance
    return velocity.y > 0 && distanceTraveled > minDistance;
  }

  /**
   * Generate split plan for hazelnut projectile
   */
  public createSplitPlan(projectile: Projectile, ownerId: string): IFirePlan {
    const currentX = projectile.x;
    const currentY = projectile.y;
    const currentSpeed = projectile.getSpeed();
    
    // Hazelnut projectiles explode in horizontal plane (parallel to ground)
    // Calculate horizontal angle spread - evenly distributed in compact arc
    // Center the spread around 90° (down) for symmetric horizontal spread
    const centerAngle = 90; // Center at down (90°)
    const startAngle = centerAngle - (this.splitSpread / 2); // Start from left side of spread
    const angleStep = this.splitSpread / (this.splitCount - 1);
    
    // Use moderate power for split projectiles
    // Slightly less power than current speed to simulate realistic separation
    const speedMultiplier = 50; // Standard speed multiplier
    const power = Math.max(30, (currentSpeed / speedMultiplier) * 70); // 70% of current speed, minimum 30
    
    const projectiles: Array<{ config: IProjectileConfig; delay?: number }> = [];
    
    // Add small delay between each split projectile for visual effect (купол)
    const splitDelay = 10; // 10ms between each projectile appearance
    
    for (let i = 0; i < this.splitCount; i++) {
      // Calculate angle for each projectile - evenly distributed in horizontal plane (0° to 180°)
      const angle = startAngle + (i * angleStep);
      
      const projectileConfig: IProjectileConfig = {
        x: currentX,
        y: currentY,
        angle: angle,
        power: power,
        ownerId: ownerId,
        weaponType: WeaponType.STANDARD, // Split projectiles are standard type
      };

      projectiles.push({
        config: projectileConfig,
        delay: i * splitDelay, // Stagger appearance of split projectiles
      });
    }

    return {
      projectiles: projectiles,
    };
  }
}

