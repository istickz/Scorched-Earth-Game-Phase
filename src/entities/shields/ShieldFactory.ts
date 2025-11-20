import { type ShieldType, ShieldType as ShieldTypeConst } from '@/types/shields';
import { Shield } from './Shield';
import { SingleUseShield } from './SingleUseShield';
import { MultiUseShield } from './MultiUseShield';

/**
 * Factory for creating shield instances
 * Uses singleton pattern to cache shield instances
 */
export class ShieldFactory {
  private static shields: Map<ShieldType, Shield> = new Map();

  /**
   * Get shield instance by type (cached)
   */
  public static getShield(type: ShieldType): Shield {
    if (!this.shields.has(type)) {
      this.shields.set(type, this.createShield(type));
    }
    return this.shields.get(type)!;
  }

  /**
   * Create shield instance
   */
  private static createShield(type: ShieldType): Shield {
    switch (type) {
      case ShieldTypeConst.SINGLE_USE:
        return new SingleUseShield();

      case ShieldTypeConst.MULTI_USE:
        return new MultiUseShield();

      default:
        // Fallback to single use shield
        return new SingleUseShield();
    }
  }
}

