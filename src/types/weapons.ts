/**
 * Weapon type definitions
 */

/**
 * Weapon types available in the game
 */
export enum WeaponType {
  STANDARD = 'standard',      // Обычный снаряд
  SALVO = 'salvo',            // Залповая система - несколько снарядов из одного дула
  HAZELNUT = 'hazelnut',      // Орешник - один снаряд разделяется на 6 в середине пути
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
  
  // Hazelnut properties (for splitting projectiles)
  splitCount?: number;               // Количество снарядов после разделения
  splitSpread?: number;              // Разброс угла в градусах для разделенных снарядов
  splitDistance?: number;            // Расстояние в пикселях до разделения (если не указано, используется половина траектории)
  
  // Visual
  color: number;                     // Цвет снаряда
  explosionColor?: number;           // Цвет взрыва
  
  // Sound
  fireSound?: string;
  explosionSound?: string;
}

