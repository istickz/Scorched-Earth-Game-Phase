/**
 * Weapon type definitions
 */

/**
 * Weapon types available in the game
 */
export enum WeaponType {
  STANDARD = 'standard',      // Обычный снаряд
  ORESHNIK = 'oreshnik',      // Орешник - залповая система
}

/**
 * Weapon configuration interface
 */
export interface IWeaponConfig {
  type: WeaponType;
  name: string;
  description: string;
  
  // Physics
  speedMultiplier: number;           // Множитель скорости (1.0 = стандарт)
  airResistanceMultiplier: number;   // Сопротивление воздуха
  
  // Explosion
  explosionRadius: number;           // Радиус взрыва
  explosionDamage: number;           // Урон
  
  // Salvo properties (for multi-projectile weapons)
  salvoCount?: number;               // Количество снарядов в залпе
  salvoSpread?: number;              // Разброс угла в градусах для залпа
  salvoDelay?: number;               // Задержка между выстрелами в мс
  
  // Visual
  color: number;                     // Цвет снаряда
  explosionColor?: number;           // Цвет взрыва
  
  // Sound
  fireSound?: string;
  explosionSound?: string;
}

