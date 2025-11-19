import { WeaponType, type IWeaponConfig } from '@/types/weapons';

/**
 * Weapon configurations
 */
export const WEAPON_CONFIGS: Record<WeaponType, IWeaponConfig> = {
  [WeaponType.STANDARD]: {
    type: WeaponType.STANDARD,
    name: 'Standard Shell',
    description: 'Basic projectile',
    speedMultiplier: 1.0,
    airResistanceMultiplier: 1.0,
    explosionRadius: 30,
    explosionDamage: 50,
    color: 0xffff00, // Yellow
  },
  
  [WeaponType.ORESHNIK]: {
    type: WeaponType.ORESHNIK,
    name: 'Орешник',
    description: 'Залповая реактивная система (6 ракет)',
    speedMultiplier: 1.1,
    airResistanceMultiplier: 1.0,
    explosionRadius: 25,
    explosionDamage: 40,
    salvoCount: 6,              // 6 ракет в залпе
    salvoSpread: 8,             // Разброс 8 градусов
    salvoDelay: 50,             // 50мс между выстрелами
    color: 0xff6600,            // Оранжево-красный
    explosionColor: 0xff4400,
  },
};

/**
 * Get weapon config by type
 */
export function getWeaponConfig(type: WeaponType): IWeaponConfig {
  return WEAPON_CONFIGS[type] || WEAPON_CONFIGS[WeaponType.STANDARD];
}

