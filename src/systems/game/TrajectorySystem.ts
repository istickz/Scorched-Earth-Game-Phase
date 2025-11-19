import Phaser from 'phaser';
import { Tank } from '@/entities/Tank';
import { Projectile } from '@/entities/Projectile';
import { TerrainSystem } from '@/systems/TerrainSystem';
import { calculateTrajectoryPoint } from '@/utils/physicsUtils';

/**
 * Trajectory System for managing projectile trajectories visualization
 */
export class TrajectorySystem {
  private scene: Phaser.Scene;
  private tanks: Tank[];
  private terrainSystem: TerrainSystem;
  
  // Trajectory tracking
  private activeTrajectories: Map<Projectile, { x: number; y: number }[]> = new Map();
  private completedTrajectories: { x: number; y: number }[][] = [];
  private trajectoryGraphics!: Phaser.GameObjects.Graphics;
  private trajectoryPreview!: Phaser.GameObjects.Graphics;
  private readonly MAX_TRAJECTORIES = 5;
  private trajectoriesDirty: boolean = false;

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
   * Setup trajectory graphics
   */
  public setup(): void {
    // Create graphics for trajectory preview
    this.trajectoryPreview = this.scene.add.graphics();
    this.trajectoryPreview.setDepth(1);
    this.trajectoryPreview.clear();

    // Create graphics for displaying shot trajectories
    this.trajectoryGraphics = this.scene.add.graphics();
    this.trajectoryGraphics.setDepth(4);
    this.trajectoryGraphics.clear();
  }

  /**
   * Update trajectory preview for current tank
   */
  public updatePreview(currentTank: Tank | undefined, currentPlayerIndex: number): void {
    if (!currentTank || !currentTank.isAlive()) {
      return;
    }

    this.trajectoryPreview.clear();
    this.trajectoryPreview.lineStyle(2, 0xffffff, 0.5);

    const fireData = currentTank.fire();
    const width = this.scene.cameras.main.width;
    const height = this.scene.cameras.main.height;

    // OPTIMIZED: Draw directly without creating array of Vector2 objects
    this.trajectoryPreview.beginPath();
    this.trajectoryPreview.moveTo(fireData.x, fireData.y);
    
    let hasPoints = false;
    for (let t = 0.2; t < 5; t += 0.2) { // Reduced iterations from 50 to 25
      const point = calculateTrajectoryPoint(
        fireData.x,
        fireData.y,
        fireData.angle,
        fireData.power,
        t,
        1.0 // gravity
      );

      if (point.x >= 0 && point.x < width && point.y >= 0 && point.y < height) {
        this.trajectoryPreview.lineTo(point.x, point.y);
        hasPoints = true;
      } else if (hasPoints) {
        break; // Stop drawing if we've left the screen
      }
    }

    this.trajectoryPreview.strokePath();
  }

  /**
   * Clear trajectory preview
   */
  public clearPreview(): void {
    this.trajectoryPreview.clear();
  }

  /**
   * Add trajectory point for active projectile
   */
  public addTrajectoryPoint(projectile: Projectile, point: { x: number; y: number }): void {
    const trajectory = this.activeTrajectories.get(projectile);
    if (trajectory) {
      trajectory.push(point);
      this.trajectoriesDirty = true;
    }
  }

  /**
   * Initialize trajectory for a new projectile
   */
  public initializeTrajectory(projectile: Projectile): void {
    this.activeTrajectories.set(projectile, [
      { x: projectile.x, y: projectile.y }
    ]);
  }

  /**
   * Save completed trajectory
   */
  public saveTrajectory(projectile: Projectile, endPoint: { x: number; y: number }): void {
    const trajectory = this.activeTrajectories.get(projectile);
    if (trajectory && trajectory.length > 0) {
      const lastPoint = trajectory[trajectory.length - 1];
      const distance = Phaser.Math.Distance.Between(lastPoint.x, lastPoint.y, endPoint.x, endPoint.y);
      
      if (distance > 0.1) {
        trajectory.push(endPoint);
      }
      
      this.completedTrajectories.push([...trajectory]);
      
      if (this.completedTrajectories.length > this.MAX_TRAJECTORIES) {
        this.completedTrajectories.shift();
      }
      
      this.activeTrajectories.delete(projectile);
      this.trajectoriesDirty = true;
    }
  }

  /**
   * Draw all trajectories
   */
  public drawTrajectories(): void {
    if (!this.trajectoriesDirty) {
      return;
    }

    this.trajectoryGraphics.clear();

    // OPTIMIZED: Draw completed trajectories with simple lines (not smooth splines)
    this.completedTrajectories.forEach((trajectory, index) => {
      if (trajectory.length < 2) return;
      
      const colors = [0xffffff, 0xffff00, 0xffaa00, 0xff8800, 0xff6600];
      const color = colors[Math.min(index, colors.length - 1)];
      
      this.trajectoryGraphics.lineStyle(1.5, color, 0.6);
      this.drawSimpleTrajectory(trajectory);
    });

    // Draw active trajectory with smooth spline (only one at a time)
    this.activeTrajectories.forEach((trajectory) => {
      if (trajectory.length < 2) return;
      
      this.trajectoryGraphics.lineStyle(2, 0xffff00, 0.9);
      this.drawSimpleTrajectory(trajectory); // Use simple lines for performance
    });

    this.trajectoriesDirty = false;
  }

  /**
   * OPTIMIZED: Draw trajectory with simple lines (much faster than Catmull-Rom splines)
   * Subsample points to reduce number of line segments while maintaining shape
   */
  private drawSimpleTrajectory(points: { x: number; y: number }[]): void {
    if (points.length < 2) return;

    this.trajectoryGraphics.beginPath();
    this.trajectoryGraphics.moveTo(points[0].x, points[0].y);

    // Subsample: only draw every Nth point for performance (but keep smooth appearance)
    const step = Math.max(1, Math.floor(points.length / 50)); // Max 50 segments per trajectory
    
    for (let i = step; i < points.length; i += step) {
      this.trajectoryGraphics.lineTo(points[i].x, points[i].y);
    }
    
    // Always draw the last point
    if (points.length > 1) {
      const lastPoint = points[points.length - 1];
      this.trajectoryGraphics.lineTo(lastPoint.x, lastPoint.y);
    }

    this.trajectoryGraphics.strokePath();
  }

  /**
   * Mark trajectories as dirty (need redrawing)
   */
  public markDirty(): void {
    this.trajectoriesDirty = true;
  }

  /**
   * Remove trajectory for projectile
   */
  public removeTrajectory(projectile: Projectile): void {
    this.activeTrajectories.delete(projectile);
    this.trajectoriesDirty = true;
  }

  /**
   * Clean up Graphics objects
   */
  public destroy(): void {
    if (this.trajectoryGraphics) {
      this.trajectoryGraphics.destroy();
      this.trajectoryGraphics = undefined as any;
    }
    
    if (this.trajectoryPreview) {
      this.trajectoryPreview.destroy();
      this.trajectoryPreview = undefined as any;
    }
    
    this.activeTrajectories.clear();
    this.completedTrajectories = [];
  }
}

