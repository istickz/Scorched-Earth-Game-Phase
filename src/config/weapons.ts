import { WeaponType, type IWeaponConfig } from '@/types/weapons';

/**
 * Weapon configurations
 */
export const WEAPON_CONFIGS: Record<WeaponType, IWeaponConfig> = {
  [WeaponType.STANDARD]: {
    type: WeaponType.STANDARD,
    name: 'Standard Shell',
    description: 'Basic projectile with balanced explosion',
    speedMultiplier: 1.0,
    airResistanceMultiplier: 1.0,
    explosionRadius: 35,        // Средний радиус
    explosionDamage: 50,
    color: 0xffff00, // Yellow
  },
  
  [WeaponType.SALVO]: {
    type: WeaponType.SALVO,
    name: 'Salvo',
    description: 'Залповая система (6 снарядов) - много мелких взрывов',
    speedMultiplier: 1.1,
    airResistanceMultiplier: 1.0,
    explosionRadius: 22,        // Маленький радиус (компенсируется количеством)
    explosionDamage: 35,        // Меньше урона за снаряд
    salvoCount: 6,              // 6 ракет в залпе
    salvoSpread: 8,             // Разброс 8 градусов
    salvoDelay: 50,             // 50мс между выстрелами
    color: 0xff6600,            // Оранжево-красный
    explosionColor: 0xff4400,
  },
  
  [WeaponType.HAZELNUT]: {
    type: WeaponType.HAZELNUT,
    name: 'Hazelnut',
    description: 'Орешник - пробивает глубокие узкие кратеры',
    speedMultiplier: 1.0,
    airResistanceMultiplier: 1.0,
    explosionRadius: 18,        // Маленький радиус - точечный удар
    explosionDamage: 40,        // Высокий урон в точке попадания
    splitCount: 6,              // 6 снарядов после разделения
    splitSpread: 15,            // Горизонтальный разброс в градусах (небольшой)
    // splitDistance не используется - разделение происходит динамически на пике траектории
    color: 0x8b4513,            // Коричневый (цвет ореха)
    explosionColor: 0xff8800,
  },
};

/**
 * Get weapon config by type
 */
export function getWeaponConfig(type: WeaponType): IWeaponConfig {
  return WEAPON_CONFIGS[type] || WEAPON_CONFIGS[WeaponType.STANDARD];
}

