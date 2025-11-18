import Phaser from 'phaser';

/**
 * Utility functions for physics calculations
 */

/**
 * Calculate initial velocity components from power and angle
 * Returns velocityX and velocityY components
 */
export function calculateInitialVelocity(
  angle: number,
  power: number,
  speedMultiplier: number = 50
): { velocityX: number; velocityY: number } {
  const angleRad = Phaser.Math.DegToRad(angle);
  const velocity = (power / 100) * speedMultiplier;
  const velocityX = Math.cos(angleRad) * velocity;
  const velocityY = Math.sin(angleRad) * velocity;
  
  return { velocityX, velocityY };
}

/**
 * Calculate ballistic trajectory point
 */
export function calculateTrajectoryPoint(
  startX: number,
  startY: number,
  angle: number,
  power: number,
  time: number,
  gravity: number = 1.0,
  speedMultiplier: number = 50
): { x: number; y: number } {
  const { velocityX, velocityY } = calculateInitialVelocity(angle, power, speedMultiplier);
  
  const x = startX + velocityX * time;
  const y = startY + velocityY * time + 0.5 * gravity * time * time;

  return { x, y };
}

/**
 * Calculate distance between two points
 */
export function distance(x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  return Math.sqrt(dx * dx + dy * dy);
}

