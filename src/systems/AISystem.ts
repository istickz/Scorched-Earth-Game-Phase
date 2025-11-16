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

  // Difficulty-based deviation ranges (in degrees and power percentage)
  private readonly difficultySettings = {
    easy: { angleDeviation: 15, powerDeviation: 20 },
    medium: { angleDeviation: 8, powerDeviation: 10 },
    hard: { angleDeviation: 3, powerDeviation: 5 },
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
    // Calculate base trajectory
    const baseShot = this.calculateTrajectory(tankX, tankY, targetX, targetY);

    // Apply learning from previous shots
    const adjustedShot = this.applyLearning(baseShot);

    // Add random deviation based on difficulty
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
    const dy = targetY - startY;
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
   * Apply learning from previous shots
   */
  private applyLearning(
    baseShot: { angle: number; power: number }
  ): { angle: number; power: number } {
    if (this.previousShots.length === 0) {
      return baseShot;
    }

    // Analyze previous shots to adjust
    let angleAdjustment = 0;
    let powerAdjustment = 0;
    let adjustmentCount = 0;

    // Only learn from recent shots (last 2-3)
    const recentShots = this.previousShots.slice(-3);

    for (const shot of recentShots) {
      const distanceX = shot.hitX - shot.targetX;
      const distanceY = shot.hitY - shot.targetY;
      const missDistance = Math.sqrt(distanceX * distanceX + distanceY * distanceY);

      // Only adjust if shot was reasonably close (within 200 pixels)
      if (missDistance < 200) {
        // Adjust angle based on horizontal miss
        if (Math.abs(distanceX) > 20) {
          angleAdjustment += distanceX > 0 ? -3 : 3;
          adjustmentCount++;
        }

        // Adjust power based on distance miss
        if (missDistance > 30) {
          powerAdjustment += missDistance > 100 ? 5 : 2;
          adjustmentCount++;
        }
      }
    }

    // Apply averaged adjustments
    // Note: angle is in world firing coordinates (0-180°), not clamped here
    if (adjustmentCount > 0) {
      const avgAngleAdjustment = angleAdjustment / adjustmentCount;
      const avgPowerAdjustment = powerAdjustment / adjustmentCount;

      return {
        angle: baseShot.angle + avgAngleAdjustment, // Will be converted to turret angle later
        power: Phaser.Math.Clamp(baseShot.power + avgPowerAdjustment, 20, 100),
      };
    }

    return baseShot;
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