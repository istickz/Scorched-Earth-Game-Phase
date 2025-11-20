import { Shield } from './Shield';
import { ShieldType } from '@/types/shields';

/**
 * Multi-use shield - has HP and can absorb multiple hits
 */
export class MultiUseShield extends Shield {
  constructor() {
    super(ShieldType.MULTI_USE, {
      maxHP: 75, // Balanced HP (can be adjusted after testing)
      color: 0x00ff88, // Green color
      explosionColor: 0x00cc66,
      radius: 100,
      name: 'Multi Use Shield',
      description: 'Многоразовый щит - имеет HP и может выдержать несколько попаданий',
    });
  }
}

