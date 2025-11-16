import Phaser from 'phaser';

/**
 * Utility functions for physics calculations
 */

/**
 * Calculate ballistic trajectory point
 */
export function calculateTrajectoryPoint(
  startX: number,
  startY: number,
  angle: number,
  power: number,
  time: number,
  gravity: number = 1.0
): { x: number; y: number } {
  const angleRad = Phaser.Math.DegToRad(angle);
  const velocity = (power / 100) * 15;
  const velocityX = Math.cos(angleRad) * velocity;
  const velocityY = Math.sin(angleRad) * velocity;

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

