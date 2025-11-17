import Phaser from 'phaser';
import { type AIDifficulty, type IAIShotResult } from '@/types';
import { Tank } from '@/entities/Tank';
import { TerrainSystem } from './TerrainSystem';

/**
 * AI system for bot opponents
 */
export class AISystem {
  private difficulty: AIDifficulty;
  private previousShots: IAIShotResult[] = [];
  private maxShotsMemory: number = 5;
  private terrainSystem: TerrainSystem;
  private scene: Phaser.Scene;
  private lastSuccessfulShot: { angle: number; power: number } | null = null;
  private readonly HIT_THRESHOLD = 50; // Distance in pixels to consider a hit

  // Adaptive search ranges - сужаются после каждого промаха
  private angleSearchRange: { min: number; max: number } | null = null;
  private powerSearchRange: { min: number; max: number } | null = null;

  // Difficulty-based deviation ranges (in degrees and power percentage)
  private readonly difficultySettings = {
    easy: { angleDeviation: 15, powerDeviation: 20 },
    medium: { angleDeviation: 8, powerDeviation: 10 },
    hard: { angleDeviation: 3, powerDeviation: 5 },
  };

  // Difficulty-based learning accuracy multipliers
  // Влияет на точность корректировок при обучении
  private readonly difficultyAccuracyMultiplier = {
    easy: 0.7,    // На easy - менее точные корректировки (70% от базовых)
    medium: 1.0,   // На medium - нормальные корректировки
    hard: 1.3,     // На hard - более точные корректировки (130% от базовых)
  };

  // Difficulty-based range narrowing factors
  // Влияет на скорость сужения диапазона поиска
  private readonly difficultyNarrowingFactor = {
    easy: 0.7,     // Медленнее сужение на easy (сужаем на 30% вместо 40%)
    medium: 0.6,   // Нормальное сужение (сужаем на 40%)
    hard: 0.5,     // Быстрее сужение на hard (сужаем на 50%)
  };

  constructor(scene: Phaser.Scene, terrainSystem: TerrainSystem, difficulty: AIDifficulty = 'medium') {
    this.scene = scene;
    this.terrainSystem = terrainSystem;
    this.difficulty = difficulty;
  }

  /**
   * Calculate optimal angle and power to hit target
   */
  public calculateShot(
    tankX: number,
    tankY: number,
    targetX: number,
    targetY: number
  ): { angle: number; power: number } {
    // If we have a successful shot and target hasn't moved significantly, repeat it
    if (this.lastSuccessfulShot) {
      // Check if target position is similar to when we last hit
      const lastShot = this.previousShots[this.previousShots.length - 1];
      if (lastShot) {
        const targetMovement = Phaser.Math.Distance.Between(
          lastShot.targetX,
          lastShot.targetY,
          targetX,
          targetY
        );
        
        // If target hasn't moved much (< 30 pixels), repeat successful shot exactly
        // No learning, no deviation - just repeat what worked
        if (targetMovement < 30) {
          return { ...this.lastSuccessfulShot };
        }
      }
    }

    // Calculate base trajectory (first shot or if target moved significantly)
    const baseShot = this.calculateTrajectory(tankX, tankY, targetX, targetY);

    // Initialize or update search ranges
    if (!this.angleSearchRange || !this.powerSearchRange) {
      // First shot or reset - initialize wide ranges
      this.angleSearchRange = {
        min: baseShot.angle - 20,
        max: baseShot.angle + 20,
      };
      this.powerSearchRange = {
        min: Math.max(20, baseShot.power - 25),
        max: Math.min(100, baseShot.power + 25),
      };
    }

    // Apply learning with proportional adjustments and range narrowing
    const adjustedShot = this.applyLearning(baseShot);

    // Add random deviation based on difficulty
    // Note: deviation is only added for new shots, not for repeated successful ones
    const finalShot = this.addDeviation(adjustedShot);

    return finalShot;
  }

  /**
   * Calculate trajectory to hit target using iterative method
   */
  private calculateTrajectory(
    startX: number,
    startY: number,
    targetX: number,
    targetY: number
  ): { angle: number; power: number } {
    // Determine direction to target
    const dx = targetX - startX;
    const targetIsLeft = dx < 0; // Target is to the left of shooter
    const horizontalDistance = Math.abs(dx);
    
    // Get screen width for relative distance calculation
    const screenWidth = this.scene.cameras.main.width;
    const relativeDistance = horizontalDistance / screenWidth; // 0.0 to 1.0

    // Try different angles and powers to find best shot
    // Initialize with a reasonable default based on direction and distance
    // Use world firing angles: 0° = right, 90° = down, 180° = left
    // Start with a medium arc angle that should work for most distances
    let bestAngle = targetIsLeft ? 180 : 0; // Start with straight direction
    let bestPower = Math.min(50 + relativeDistance * 40, 90); // Scale power with distance
    let bestDistance = Infinity;

    // In Phaser/artillery games, angles work like this:
    // 0° = right, 90° = down, 180° = left, -90° = up
    // For shooting LEFT: need angles around 180° (or negative angles like -80° to -30°)
    // For shooting RIGHT: need positive angles (like 30° to 80°)
    // But we need to use angles that work for trajectory simulation in world coordinates
    
    // Adjust angle range based on RELATIVE distance (% of screen width)
    // Use world firing angles: 0° = right, 90° = down, 180° = left
    let minAngle: number;
    let maxAngle: number;
    let minPower: number;
    let maxPower: number;
    
    if (targetIsLeft) {
      // Shooting LEFT (target is to the left)
      // In Phaser: 0°=right, 90°=down, 180°=left, 270°/-90°=up
      // For high arc to left: need angles between 180° and 270° (up-left)
      // cos(225°) = -0.707 (left), sin(225°) = -0.707 (up) ✓
      if (relativeDistance < 0.25) {
        // Close range (< 25% of screen): flatter trajectory (more horizontal)
        minAngle = 150; // down-left (cos=-0.866, sin=0.5)
        maxAngle = 180; // straight left (cos=-1, sin=0)
        minPower = 25;
        maxPower = 60;
      } else if (relativeDistance < 0.5) {
        // Medium range (25-50% of screen): medium arc
        minAngle = 165; // slight arc (cos=-0.966, sin=0.259)
        maxAngle = 195; // up-left (cos=-0.966, sin=-0.259)
        minPower = 45;
        maxPower = 80;
      } else if (relativeDistance < 0.75) {
        // Long range (50-75% of screen): high arc
        minAngle = 180; // straight left
        maxAngle = 210; // high arc up-left (cos=-0.866, sin=-0.5)
        minPower = 65;
        maxPower = 95;
      } else {
        // Very long range (>75% of screen): maximum arc and power
        minAngle = 195; // very high arc (cos=-0.966, sin=-0.259)
        maxAngle = 225; // maximum arc (cos=-0.707, sin=-0.707)
        minPower = 80;
        maxPower = 100;
      }
    } else {
      // Shooting RIGHT (target is to the right)
      // For high arc to right: need angles between -90° and 0° (up-right)
      // cos(-45°) = 0.707 (right), sin(-45°) = -0.707 (up) ✓
      if (relativeDistance < 0.25) {
        // Close range: flatter trajectory
        minAngle = 0; // straight right (cos=1, sin=0)
        maxAngle = 30; // down-right (cos=0.866, sin=0.5)
        minPower = 25;
        maxPower = 60;
      } else if (relativeDistance < 0.5) {
        // Medium range: medium arc
        minAngle = -15; // slight arc up-right (cos=0.966, sin=-0.259)
        maxAngle = 45; // down-right
        minPower = 45;
        maxPower = 80;
      } else if (relativeDistance < 0.75) {
        // Long range: high arc
        minAngle = -30; // high arc (cos=0.866, sin=-0.5)
        maxAngle = 30; // down-right
        minPower = 65;
        maxPower = 95;
      } else {
        // Very long range: maximum arc and power
        minAngle = -45; // very high arc (cos=0.707, sin=-0.707)
        maxAngle = 15; // slight down-right
        minPower = 80;
        maxPower = 100;
      }
    }

    // Adjust search granularity - finer for long distances
    const angleStep = relativeDistance > 0.6 ? 2 : 3;
    const powerStep = relativeDistance > 0.6 ? 3 : 5;

    // Search through angle and power ranges
    for (let angle = minAngle; angle <= maxAngle; angle += angleStep) {
      for (let power = minPower; power <= maxPower; power += powerStep) {
        const hitPoint = this.simulateTrajectory(startX, startY, angle, power);
        const hitDistance = Phaser.Math.Distance.Between(
          hitPoint.x,
          hitPoint.y,
          targetX,
          targetY
        );

        if (hitDistance < bestDistance) {
          bestDistance = hitDistance;
          bestAngle = angle;
          bestPower = power;
        }
      }
    }

    // If no good shot found (distance > 50px), try expanded search with full range
    if (bestDistance > 50) {
      // Expand search in world firing angle coordinates
      // For left: 150° to 270° (covering down-left to up-left)
      // For right: -90° to 90° (covering up-right to down-right)
      const expandedMinAngle = targetIsLeft ? 150 : -90;
      const expandedMaxAngle = targetIsLeft ? 270 : 90;
      
      for (let angle = expandedMinAngle; angle <= expandedMaxAngle; angle += 3) {
        for (let power = 30; power <= 100; power += 6) {
          const hitPoint = this.simulateTrajectory(startX, startY, angle, power);
          const hitDistance = Phaser.Math.Distance.Between(
            hitPoint.x,
            hitPoint.y,
            targetX,
            targetY
          );

          if (hitDistance < bestDistance) {
            bestDistance = hitDistance;
            bestAngle = angle;
            bestPower = power;
          }
        }
      }
    }

    return { angle: bestAngle, power: bestPower };
  }

  /**
   * Simulate projectile trajectory to find hit point
   */
  private simulateTrajectory(
    startX: number,
    startY: number,
    angle: number,
    power: number
  ): { x: number; y: number } {
    const angleRad = Phaser.Math.DegToRad(angle);
    // Match projectile velocity (50 multiplier, same as Projectile class)
    const velocity = (power / 100) * 50;
    const velocityX = Math.cos(angleRad) * velocity;
    const velocityY = Math.sin(angleRad) * velocity;

    let x = startX;
    let y = startY;
    let vx = velocityX;
    let vy = velocityY;
    const gravity = 1.0;
    const airResistance = 0.01;
    const dt = 0.05; // Smaller time step for more accurate simulation

    const maxIterations = 2000;
    let iteration = 0;

    // Simulate until hit terrain or go off screen
    while (iteration < maxIterations) {
      // Store previous position for terrain checking
      const prevX = x;
      const prevY = y;

      // Update position
      x += vx * dt;
      y += vy * dt;
      vy += gravity * dt;

      // Apply air resistance
      vx *= (1 - airResistance);
      vy *= (1 - airResistance);

      // Check if hit terrain (check multiple points along path to prevent tunneling)
      const steps = 5;
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const checkX = prevX + (x - prevX) * t;
        const checkY = prevY + (y - prevY) * t;
        
        if (this.terrainSystem.isSolid(checkX, checkY)) {
          return { x: checkX, y: checkY };
        }
      }

      // Check if off screen
      if (x < -50 || x > this.scene.cameras.main.width + 50 || y > this.scene.cameras.main.height + 50) {
        return { x, y };
      }

      iteration++;
    }

    return { x, y };
  }

  /**
   * Apply learning from previous shots with proportional adjustments and range narrowing
   */
  private applyLearning(
    baseShot: { angle: number; power: number }
  ): { angle: number; power: number } {
    if (this.previousShots.length === 0 || !this.angleSearchRange || !this.powerSearchRange) {
      return baseShot;
    }

    // Check if last shot was successful - if so, don't adjust
    const lastShot = this.previousShots[this.previousShots.length - 1];
    if (lastShot && lastShot.distance < this.HIT_THRESHOLD) {
      // Reset ranges for next target
      this.angleSearchRange = null;
      this.powerSearchRange = null;
      return baseShot;
    }

    // Get last miss (most recent miss)
    const recentMisses = this.previousShots
      .slice(-3)
      .filter(shot => shot.distance >= this.HIT_THRESHOLD);

    if (recentMisses.length === 0) {
      return baseShot;
    }

    const lastMiss = recentMisses[recentMisses.length - 1];
    const distanceX = lastMiss.hitX - lastMiss.targetX;
    const distanceY = lastMiss.hitY - lastMiss.targetY;
    const missDistance = Math.sqrt(distanceX * distanceX + distanceY * distanceY);

    // АДАПТИВНЫЕ ШАГИ: коэффициент корректировки уменьшается при приближении к цели
    // Чем ближе к цели, тем меньше корректировка (более точные движения)
    // Учитываем сложность: на easy - менее точные корректировки, на hard - более точные
    const accuracyMultiplier = this.difficultyAccuracyMultiplier[this.difficulty];
    const basePowerCoefficient = 0.12 * accuracyMultiplier; // Базовый коэффициент для силы с учетом сложности
    
    // Адаптивный множитель: чем меньше промах, тем меньше корректировка
    // При промахе 200px → множитель 1.0, при промахе 50px → множитель 0.3
    const adaptiveMultiplier = Math.max(0.3, Math.min(1.0, missDistance / 200));
    
    const maxPowerAdjustment = 15 * adaptiveMultiplier * accuracyMultiplier; // Адаптивный максимум с учетом сложности

    // ИСПРАВЛЕННАЯ логика корректировки:
    // В artillery играх горизонтальная дальность зависит в основном от СИЛЫ
    // Поэтому корректируем силу на основе горизонтального промаха (distanceX)
    // А угол используем для более тонкой настройки вертикального положения
    
    // Определяем направление стрельбы (влево или вправо)
    const screenCenter = this.scene.cameras.main.width / 2;
    const shootingLeft = lastMiss.targetX < screenCenter; // Target is on left side
    
    // Вычисляем горизонтальную ошибку дальности (не зависит от направления)
    // Если снаряд перелетел цель - положительное значение
    // Если недолетел - отрицательное значение
    let rangeError: number;
    if (shootingLeft) {
      // Стреляем влево: если hitX < targetX, то перелет (снаряд слева от цели)
      rangeError = lastMiss.targetX - lastMiss.hitX;
    } else {
      // Стреляем вправо: если hitX > targetX, то перелет (снаряд справа от цели)
      rangeError = lastMiss.hitX - lastMiss.targetX;
    }
    
    // Корректируем СИЛУ на основе горизонтальной ошибки дальности
    let powerAdjustment = 0;
    if (Math.abs(rangeError) > 15) {
      // Если перелет (rangeError > 0) - уменьшаем силу
      // Если недолет (rangeError < 0) - увеличиваем силу
      const proportionalPowerAdjustment = Math.min(
        Math.abs(rangeError) * basePowerCoefficient * adaptiveMultiplier,
        maxPowerAdjustment
      );
      powerAdjustment = rangeError > 0 ? -proportionalPowerAdjustment : proportionalPowerAdjustment;
    }
    
    // Корректируем УГОЛ только для тонкой настройки (небольшие корректировки)
    // Используем вертикальную ошибку для понимания, нужна ли более крутая или пологая траектория
    let angleAdjustment = 0;
    if (Math.abs(rangeError) > 15 && Math.abs(distanceY) > 20) {
      // Небольшая корректировка угла только если есть значительные ошибки
      // Если снаряд высоко И далеко - траектория слишком крутая, нужен более пологий угол
      // Для левого танка: уменьшаем угол (более горизонтально)
      // Для правого танка: увеличиваем угол к 180° (более горизонтально)
      const maxAngleCorrection = 5 * adaptiveMultiplier * accuracyMultiplier; // Меньше чем для силы
      
      if (rangeError > 0 && distanceY < 0) {
        // Перелет и снаряд выше цели - траектория слишком крутая
        const correction = Math.min(Math.abs(rangeError) * 0.02 * adaptiveMultiplier, maxAngleCorrection);
        // Для левого танка (угол 0-90): уменьшаем угол
        // Для правого танка (угол 180-270): увеличиваем к 180
        angleAdjustment = shootingLeft ? -correction : correction;
      } else if (rangeError < 0 && distanceY > 0) {
        // Недолет и снаряд ниже цели - траектория слишком пологая
        const correction = Math.min(Math.abs(rangeError) * 0.02 * adaptiveMultiplier, maxAngleCorrection);
        // Для левого танка: увеличиваем угол
        // Для правого танка: уменьшаем от 180
        angleAdjustment = shootingLeft ? correction : -correction;
      }
    }

    // СУЖЕНИЕ ДИАПАЗОНА ПОИСКА
    // После каждого промаха сужаем диапазон вокруг текущего выстрела
    // На easy - медленнее сужение, на hard - быстрее сужение
    const narrowingFactor = this.difficultyNarrowingFactor[this.difficulty];

    // Обновляем значения на основе корректировок
    const newAngle = lastMiss.angle + angleAdjustment;
    const newPower = Phaser.Math.Clamp(lastMiss.power + powerAdjustment, 20, 100);

    // Сужаем диапазон угла вокруг нового значения
    const currentAngleRange = this.angleSearchRange.max - this.angleSearchRange.min;
    const narrowedAngleRange = currentAngleRange * narrowingFactor;
    this.angleSearchRange = {
      min: newAngle - narrowedAngleRange / 2,
      max: newAngle + narrowedAngleRange / 2,
    };

    // Сужаем диапазон силы вокруг нового значения
    const currentPowerRange = this.powerSearchRange.max - this.powerSearchRange.min;
    const narrowedPowerRange = currentPowerRange * narrowingFactor;
    this.powerSearchRange = {
      min: Math.max(20, newPower - narrowedPowerRange / 2),
      max: Math.min(100, newPower + narrowedPowerRange / 2),
    };

    // Выбираем значение из суженного диапазона (ближе к центру для быстрой сходимости)
    // Используем 70% от центра к краю для более агрессивного поиска
    const angleCenter = (this.angleSearchRange.min + this.angleSearchRange.max) / 2;
    const finalAngle = angleCenter + (newAngle - angleCenter) * 0.7;

    const powerCenter = (this.powerSearchRange.min + this.powerSearchRange.max) / 2;
    const finalPower = Phaser.Math.Clamp(
      powerCenter + (newPower - powerCenter) * 0.7,
      this.powerSearchRange.min,
      this.powerSearchRange.max
    );

    return {
      angle: finalAngle,
      power: finalPower,
    };
  }

  /**
   * Add random deviation based on difficulty
   */
  private addDeviation(shot: { angle: number; power: number }): { angle: number; power: number } {
    const settings = this.difficultySettings[this.difficulty];

    const angleDeviation = (Math.random() - 0.5) * 2 * settings.angleDeviation;
    const powerDeviation = (Math.random() - 0.5) * 2 * settings.powerDeviation;

    // Angle is in world firing coordinates (0-180°), don't clamp here
    // It will be converted to turret angle (-90 to 90) in getAIDecision
    return {
      angle: shot.angle + angleDeviation,
      power: Phaser.Math.Clamp(shot.power + powerDeviation, 20, 100),
    };
  }

  /**
   * Record shot result for learning
   */
  public recordShotResult(result: IAIShotResult): void {
    this.previousShots.push(result);

    // If shot was successful (hit the target), save it for repetition
    if (result.distance < this.HIT_THRESHOLD) {
      this.lastSuccessfulShot = {
        angle: result.angle,
        power: result.power,
      };
      // Reset search ranges after successful hit
      this.angleSearchRange = null;
      this.powerSearchRange = null;
    } else {
      // If we missed, clear successful shot if we've missed multiple times
      // This allows AI to adapt if target moves or situation changes
      const recentMisses = this.previousShots
        .slice(-3)
        .filter(shot => shot.distance >= this.HIT_THRESHOLD);
      
      if (recentMisses.length >= 3) {
        // После 3 промахов подряд - сброс диапазонов для нового подхода
        this.lastSuccessfulShot = null;
        this.angleSearchRange = null;
        this.powerSearchRange = null;
      }
    }

    // Keep only recent shots
    if (this.previousShots.length > this.maxShotsMemory) {
      this.previousShots.shift();
    }
  }

  /**
   * Get AI decision with delay (simulates thinking time)
   */
  public async getAIDecision(
    aiTank: Tank,
    targetTank: Tank,
    callback: (angle: number, power: number) => void
  ): Promise<void> {
    // Minimal thinking time - constant for all difficulties
    // Difficulty affects accuracy, not reaction speed
    const thinkTime = 50;

    // Calculate shot in world firing coordinates
    const fireData = aiTank.fire();
    const shot = this.calculateShot(fireData.x, fireData.y, targetTank.x, targetTank.y);

    // Convert world firing angle to turret angle
    // Tank.fire() does: firingAngle = isRightSideTank ? 180 - turretAngle : turretAngle
    // So we reverse it: turretAngle = isRightSideTank ? 180 - firingAngle : firingAngle
    // But turretAngle must be in range -90 to 90
    const screenCenter = this.scene.cameras.main.width / 2;
    const isRightSideTank = aiTank.x > screenCenter;
    
    // Normalize firing angle to 0-360 range first
    let normalizedFiringAngle = shot.angle;
    while (normalizedFiringAngle < 0) normalizedFiringAngle += 360;
    while (normalizedFiringAngle >= 360) normalizedFiringAngle -= 360;
    
    let turretAngle: number;
    if (isRightSideTank) {
      // Right tank: firingAngle = 180 - turretAngle, so turretAngle = 180 - firingAngle
      turretAngle = 180 - normalizedFiringAngle;
      // Normalize to -90 to 90 range
      if (turretAngle > 90) {
        turretAngle -= 180;
      } else if (turretAngle < -90) {
        turretAngle += 180;
      }
    } else {
      // Left tank: firingAngle = turretAngle
      // But we need to handle angles > 180 (which would be negative in turret space)
      if (normalizedFiringAngle > 180) {
        // Angle is on the left side, convert to negative
        turretAngle = normalizedFiringAngle - 360;
      } else {
        turretAngle = normalizedFiringAngle;
      }
      // Normalize to -90 to 90 range
      if (turretAngle > 90) {
        turretAngle = 180 - turretAngle;
      } else if (turretAngle < -90) {
        turretAngle = -180 - turretAngle;
      }
    }
    
    // Clamp to valid turret angle range
    turretAngle = Phaser.Math.Clamp(turretAngle, -90, 90);

    // Wait before making decision
    this.scene.time.delayedCall(thinkTime, () => {
      callback(turretAngle, shot.power);
    });
  }
}