/**
 * Shield type constants (enum-like pattern)
 */
export const ShieldType = {
  SINGLE_USE: 'shield_single_use',
  MULTI_USE: 'shield_multi_use',
} as const;

export type ShieldType = typeof ShieldType[keyof typeof ShieldType];

/**
 * Shield configuration interface
 */
export interface IShieldConfig {
  maxHP: number;
  color: number;
  explosionColor?: number;
  radius: number; // Protection radius (in pixels)
  name: string;
  description: string;
}

/**
 * Shield state interface (for active shield)
 */
export interface IShieldState {
  type: ShieldType;
  currentHP: number;
  maxHP: number;
  isActive: boolean;
}

