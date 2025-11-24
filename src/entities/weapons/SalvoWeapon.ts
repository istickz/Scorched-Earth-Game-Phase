import { Weapon } from './Weapon';
import { type IFirePlan, type IFireData, WeaponType } from '@/types/weapons';
import { type IProjectileConfig } from '@/types';

/**
 * Salvo weapon - fires multiple projectiles with spread and delay
 */
export class SalvoWeapon extends Weapon {
  private readonly salvoCount: number = 16;      // 6 ракет в залпе
  private readonly salvoSpread: number = 18;    // Разброс 18 градусов для разлета по площади
  private readonly salvoDelay: number = 50;      // 50мс между выстрелами

  constructor() {
    super({
      type: WeaponType.SALVO,
      name: 'Salvo',
      description: 'Залповая система (6 снарядов) - много мелких взрывов',
      speedMultiplier: 1.1,
      airResistanceMultiplier: 1.0,
      explosionRadius: 22,        // Маленький радиус (компенсируется количеством)
      explosionDamage: 35,        // Меньше урона за снаряд
      explosionShape: 'circle',   // Круглые кратеры
      color: 0xff6600,            // Оранжево-красный
      explosionColor: 0xff4400,
    });
  }

  public createFirePlan(fireData: IFireData, ownerId: string): IFirePlan {
    const projectiles: Array<{ config: IProjectileConfig; delay?: number }> = [];
    
    // Calculate angle spread
    const startAngle = fireData.angle - (this.salvoSpread / 2);
    const angleStep = this.salvoSpread / (this.salvoCount - 1);
    
    for (let i = 0; i < this.salvoCount; i++) {
      const delay = i * this.salvoDelay;
      const angle = startAngle + (angleStep * i);
      
      const projectileConfig: IProjectileConfig = {
        x: fireData.x,
        y: fireData.y,
        angle: angle,
        power: fireData.power,
        ownerId: ownerId,
        weaponType: fireData.weaponType,
      };

      projectiles.push({
        config: projectileConfig,
        delay: delay,
      });
    }

    return {
      projectiles: projectiles,
      shotData: {
        angle: fireData.angle,
        power: fireData.power,
        ownerId: ownerId,
      },
      playSound: true, // Only first projectile will trigger sound
      clearPreview: true,
    };
  }
}

