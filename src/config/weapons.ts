import { type IWeaponsConfig } from '@/types';

/**
 * Default weapons configuration
 * Used when level doesn't specify custom weapons config
 */
export const DEFAULT_WEAPONS_CONFIG: IWeaponsConfig = {
  ammunition: {
    standard: -1,  // -1 means infinite
    salvo: 3,      // 3 salvos
    hazelnut: 3,   // 3 hazelnuts
    bouncing: 3,   // 3 bouncing shells
    shield_single_use: 2,  // 2 single-use shields
    shield_multi_use: 1,  // 1 multi-use shield
  },
};

