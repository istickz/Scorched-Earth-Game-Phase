import { type WeaponType, WeaponType as WeaponTypeConst } from '@/types/weapons';
import { Weapon } from './Weapon';
import { StandardWeapon } from './StandardWeapon';
import { SalvoWeapon } from './SalvoWeapon';
import { HazelnutWeapon } from './HazelnutWeapon';
import { BouncingWeapon } from './BouncingWeapon';

/**
 * Factory for creating weapon instances
 * Uses singleton pattern to cache weapon instances
 */
export class WeaponFactory {
  private static weapons: Map<WeaponType, Weapon> = new Map();

  /**
   * Get weapon instance by type (cached)
   */
  public static getWeapon(type: WeaponType): Weapon {
    if (!this.weapons.has(type)) {
      this.weapons.set(type, this.createWeapon(type));
    }
    return this.weapons.get(type)!;
  }

  /**
   * Create weapon instance
   */
  private static createWeapon(type: WeaponType): Weapon {
    switch (type) {
      case WeaponTypeConst.STANDARD:
        return new StandardWeapon();

      case WeaponTypeConst.SALVO:
        return new SalvoWeapon();

      case WeaponTypeConst.HAZELNUT:
        return new HazelnutWeapon();

      case WeaponTypeConst.BOUNCING:
        return new BouncingWeapon();

      default:
        // Fallback to standard weapon
        return new StandardWeapon();
    }
  }
}

