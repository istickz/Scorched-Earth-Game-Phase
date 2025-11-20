import Phaser from 'phaser';
import { Tank } from '@/entities/Tank';
import { Projectile } from '@/entities/Projectile';
import { TerrainSystem } from '@/systems/TerrainSystem';

/**
 * Collision result interface
 */
export interface ICollisionResult {
  projectile: Projectile;
  hitPoint: { x: number; y: number };
  hitType: 'tank' | 'terrain' | 'outOfBounds' | 'shield';
  hitTank?: Tank;
}

/**
 * Projectile Collision System for detecting collisions
 */
export class ProjectileCollisionSystem {
  private scene: Phaser.Scene;
  private tanks: Tank[];
  private terrainSystem: TerrainSystem;
  private readonly TANK_HITBOX_RADIUS = 40; // Увеличен для лучшего попадания

  constructor(
    scene: Phaser.Scene,
    tanks: Tank[],
    terrainSystem: TerrainSystem
  ) {
    this.scene = scene;
    this.tanks = tanks;
    this.terrainSystem = terrainSystem;
  }

  /**
   * Check collisions for all projectiles
   * Returns array of collision results
   */
  public checkCollisions(projectiles: Projectile[]): ICollisionResult[] {
    const collisions: ICollisionResult[] = [];
    const width = this.scene.cameras.main.width;
    const height = this.scene.cameras.main.height;

    projectiles.forEach((projectile) => {
      const lastPos = projectile.getLastPosition();
      const currentX = projectile.x;
      const currentY = projectile.y;
      
      const dx = currentX - lastPos.x;
      const dy = currentY - lastPos.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      // Проверяем попадание по танкам ПЕРВЫМ (приоритет)
      // Но сначала проверяем столкновение со щитом (если есть)
      let hitTank: Tank | null = null;
      let tankHitPoint: { x: number; y: number } | null = null;
      let shieldHitPoint: { x: number; y: number } | null = null;
      let shieldHitTank: Tank | null = null;
      
      for (const tank of this.tanks) {
        if (!tank.isAlive()) {
          continue;
        }
        
        // Не попадаем в свой танк
        const tankId = `tank-${this.tanks.indexOf(tank)}`;
        if (projectile.getOwnerId() === tankId) {
          continue;
        }
        
        // Проверяем путь снаряда по точкам
        const steps = Math.max(10, Math.ceil(distance / 1)); // Проверка каждого пикселя
        for (let i = 0; i <= steps; i++) {
          const t = i / steps;
          const checkX = lastPos.x + dx * t;
          const checkY = lastPos.y + dy * t;
          
          // First check if projectile hits shield (if active)
          const activeShield = tank.getActiveShield();
          if (activeShield && activeShield.isActive()) {
            const shieldConfig = activeShield.getShieldConfig();
            const shieldRadius = shieldConfig.radius;
            const distToTankCenter = Phaser.Math.Distance.Between(checkX, checkY, tank.x, tank.y);
            
            // Check if projectile hits shield (full circle around tank)
            if (distToTankCenter <= shieldRadius && distToTankCenter > this.TANK_HITBOX_RADIUS) {
              // Projectile hit shield, not tank
              shieldHitPoint = { x: checkX, y: checkY };
              shieldHitTank = tank;
              break;
            }
          }
          
          // Check if projectile hits tank directly (bypasses shield if hit from inside)
          const distToTank = Phaser.Math.Distance.Between(checkX, checkY, tank.x, tank.y);
          if (distToTank <= this.TANK_HITBOX_RADIUS) {
            hitTank = tank;
            tankHitPoint = { x: checkX, y: checkY };
            break;
          }
        }
        
        if (shieldHitPoint && shieldHitTank) {
          // Shield hit takes priority - stop checking other tanks
          break;
        }
        
        if (hitTank) {
          break;
        }
      }
      
      if (shieldHitPoint && shieldHitTank) {
        // Попадание в щит
        collisions.push({
          projectile,
          hitPoint: shieldHitPoint,
          hitType: 'shield',
          hitTank: shieldHitTank,
        });
      } else if (tankHitPoint && hitTank) {
        // Попадание в танк (мимо щита или щита нет)
        collisions.push({
          projectile,
          hitPoint: tankHitPoint,
          hitType: 'tank',
          hitTank,
        });
      } else {
        // Проверяем попадание в землю
        let hitPoint: { x: number; y: number } | null = null;
        const steps = Math.max(10, Math.ceil(distance / 1)); // Проверка каждого пикселя
        
        for (let i = 0; i <= steps; i++) {
          const t = i / steps;
          const checkX = lastPos.x + dx * t;
          const checkY = lastPos.y + dy * t;
          
          if (this.terrainSystem.isSolid(checkX, checkY)) {
            hitPoint = { x: checkX, y: checkY };
            break;
          }
        }

        if (hitPoint) {
          // Попадание в землю
          collisions.push({
            projectile,
            hitPoint,
            hitType: 'terrain',
          });
        } else if (projectile.y > height || projectile.x < 0 || projectile.x > width) {
          // Снаряд улетел за экран
          collisions.push({
            projectile,
            hitPoint: { x: projectile.x, y: projectile.y },
            hitType: 'outOfBounds',
          });
        }
      }
    });

    return collisions;
  }
}

