import { Shield } from './Shield';
import { ShieldType } from '@/types/shields';

/**
 * Single-use shield - absorbs all damage from one hit and disappears
 */
export class SingleUseShield extends Shield {
  constructor() {
    super(ShieldType.SINGLE_USE, {
      maxHP: 1000, // Very high HP to absorb any single hit
      color: 0x0088ff, // Blue color
      explosionColor: 0x0066cc,
      radius: 100, 
      name: 'Single Use Shield',
      description: 'Одноразовый щит - поглощает весь урон от одного попадания',
    });
  }

  /**
   * Override takeDamage - single use shield always absorbs all damage
   */
  public override takeDamage(amount: number): number {
    if (!this.isActiveState) {
      return amount;
    }

    // Always absorb all damage and deactivate
    this.currentHP = 0;
    this.playDestructionEffect();
    this.deactivate();
    return 0; // No damage to tank
  }
}

