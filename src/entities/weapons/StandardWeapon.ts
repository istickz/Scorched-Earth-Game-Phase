import { Weapon } from './Weapon';
import { type IFirePlan, type IFireData, WeaponType } from '@/types/weapons';
import { type IProjectileConfig } from '@/types';

/**
 * Standard weapon - fires single projectile
 */
export class StandardWeapon extends Weapon {
  constructor() {
    super({
      type: WeaponType.STANDARD,
      name: 'Standard Shell',
      description: 'Basic projectile with balanced explosion',
      speedMultiplier: 1.0,
      airResistanceMultiplier: 1.0,
      explosionRadius: 35,        // Средний радиус
      explosionDamage: 50,
      explosionShape: 'circle',   // Классический круглый кратер
      color: 0xffff00,            // Yellow
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
}

