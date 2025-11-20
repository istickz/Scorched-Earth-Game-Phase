import Phaser from 'phaser';
import { Tank } from '@/entities/Tank';
import { Projectile } from '@/entities/Projectile';
import { TerrainSystem } from '@/systems/TerrainSystem';
import { calculateTrajectoryPoint } from '@/utils/physicsUtils';
import { type TerrainBiome, type TimeOfDay } from '@/types';
import { type Weapon } from '@/entities/weapons';

/**
 * Trajectory System for managing projectile trajectories visualization
 */
export class TrajectorySystem {
  private scene: Phaser.Scene;
  private timeOfDay: TimeOfDay;
  private biome: TerrainBiome;
  
  // Trajectory tracking
  private activeTrajectories: Map<Projectile, { x: number; y: number }[]> = new Map();
  // Group trajectories by shot: each shot can have multiple trajectories (e.g., hazelnut split)
  private completedShots: { x: number; y: number }[][][] = [];
  private currentShot: { x: number; y: number }[][] = [];
  private trajectoryGraphics!: Phaser.GameObjects.Graphics;
  private trajectoryPreview!: Phaser.GameObjects.Graphics;
  private readonly MAX_SAVED_SHOTS = 5; // Maximum number of saved shots (each shot can have multiple trajectories)
  private trajectoriesDirty: boolean = false;

  constructor(
    scene: Phaser.Scene,
    _tanks: Tank[],
    _terrainSystem: TerrainSystem,
    timeOfDay: TimeOfDay = 'day',
    biome: TerrainBiome = 'temperate'
  ) {
    this.scene = scene;
    this.timeOfDay = timeOfDay;
    this.biome = biome;
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
   * Get contrast color for trajectory preview based on time of day and biome
   */
  private getTrajectoryColor(): number {
    // For day + light biomes (arctic with snow): use dark color
    // For night + dark biomes: use light color
    const isLightBiome = this.biome === 'arctic';
    const isDay = this.timeOfDay === 'day';
    
    if (isDay && isLightBiome) {
      return 0x000000; // Black for day + arctic
    } else if (!isDay && !isLightBiome) {
      return 0xffffff; // White for night + dark biomes
    } else if (isDay) {
      return 0x333333; // Dark gray for day + dark biomes
    } else {
      return 0xcccccc; // Light gray for night + light biomes
    }
  }

  /**
   * Update trajectory preview for current tank
   */
  public updatePreview(currentTank: Tank | undefined, _currentPlayerIndex: number, weapon?: Weapon): void {
    if (!currentTank || !currentTank.isAlive()) {
      return;
    }

    this.trajectoryPreview.clear();
    const trajectoryColor = this.getTrajectoryColor();
    this.trajectoryPreview.lineStyle(2, trajectoryColor, 0.1); // More transparent

    const fireData = currentTank.fire();
    const width = this.scene.cameras.main.width;
    const height = this.scene.cameras.main.height;

    // Get weapon speed multiplier for accurate preview
    const physicsConfig = weapon?.getPhysicsConfig();
    const speedMultiplier = physicsConfig ? 50 * physicsConfig.speedMultiplier : 50;

    // Collect trajectory points first
    const points: { x: number; y: number }[] = [];
    const margin = 50;
    
    for (let t = 0.2; t < 10; t += 0.15) {
      const point = calculateTrajectoryPoint(
        fireData.x,
        fireData.y,
        fireData.angle,
        fireData.power,
        t,
        1.0, // gravity
        speedMultiplier
      );

      if (point.x >= -margin && point.x < width + margin && point.y >= -margin && point.y < height + margin) {
        points.push(point);
      } else if (points.length > 0) {
        break;
      }
    }

    // Draw dashed line based on pixel distance (works on all screen sizes)
    const dashLength = 12; // pixels
    const gapLength = 8; // pixels
    
    let distanceTraveled = 0;
    let isDrawingDash = true;
    let lastX = fireData.x;
    let lastY = fireData.y;
    let dashStartX = fireData.x;
    let dashStartY = fireData.y;
    
    for (const point of points) {
      const dx = point.x - lastX;
      const dy = point.y - lastY;
      const segmentLength = Math.sqrt(dx * dx + dy * dy);
      
      if (segmentLength === 0) continue;
      
      const currentDashGapLength = isDrawingDash ? dashLength : gapLength;
      const remaining = currentDashGapLength - distanceTraveled;
      
      if (segmentLength <= remaining) {
        // Entire segment fits in current dash/gap
        if (isDrawingDash) {
          this.trajectoryPreview.moveTo(dashStartX, dashStartY);
          this.trajectoryPreview.lineTo(point.x, point.y);
        }
        distanceTraveled += segmentLength;
        
        if (distanceTraveled >= currentDashGapLength) {
          // Switch to next dash/gap
          distanceTraveled = 0;
          isDrawingDash = !isDrawingDash;
          dashStartX = point.x;
          dashStartY = point.y;
        }
      } else {
        // Segment crosses dash/gap boundary
        const ratio = remaining / segmentLength;
        const boundaryX = lastX + dx * ratio;
        const boundaryY = lastY + dy * ratio;
        
        if (isDrawingDash) {
          this.trajectoryPreview.moveTo(dashStartX, dashStartY);
          this.trajectoryPreview.lineTo(boundaryX, boundaryY);
        }
        
        // Switch to next dash/gap
        isDrawingDash = !isDrawingDash;
        distanceTraveled = segmentLength - remaining;
        dashStartX = boundaryX;
        dashStartY = boundaryY;
        
        // Continue drawing if we're in a dash
        if (isDrawingDash && distanceTraveled > 0) {
          const remainingRatio = distanceTraveled / segmentLength;
          const endX = lastX + dx * (ratio + remainingRatio);
          const endY = lastY + dy * (ratio + remainingRatio);
          this.trajectoryPreview.moveTo(dashStartX, dashStartY);
          this.trajectoryPreview.lineTo(endX, endY);
          
          if (distanceTraveled >= dashLength) {
            distanceTraveled = 0;
            isDrawingDash = false;
            dashStartX = endX;
            dashStartY = endY;
          }
        }
      }
      
      lastX = point.x;
      lastY = point.y;
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
   * Save completed trajectory to current shot
   */
  public saveTrajectory(projectile: Projectile, endPoint: { x: number; y: number }): void {
    const trajectory = this.activeTrajectories.get(projectile);
    if (trajectory && trajectory.length > 0) {
      const lastPoint = trajectory[trajectory.length - 1];
      const distance = Phaser.Math.Distance.Between(lastPoint.x, lastPoint.y, endPoint.x, endPoint.y);
      
      if (distance > 0.1) {
        trajectory.push(endPoint);
      }
      
      // Add trajectory to current shot
      this.currentShot.push([...trajectory]);
      
      this.activeTrajectories.delete(projectile);
      this.trajectoriesDirty = true;
    }
  }

  /**
   * Complete current shot and start a new one
   * Call this when all projectiles from a shot have finished
   */
  public completeCurrentShot(): void {
    if (this.currentShot.length > 0) {
      this.completedShots.push([...this.currentShot]);
      
      // Remove oldest shot if we exceeded the limit
      if (this.completedShots.length > this.MAX_SAVED_SHOTS) {
        this.completedShots.shift();
      }
      
      this.currentShot = [];
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

    const colors = [0xffffff, 0xffff00, 0xffaa00, 0xff8800, 0xff6600];

    // Draw completed shots (each shot can have multiple trajectories)
    this.completedShots.forEach((shot, shotIndex) => {
      const color = colors[Math.min(shotIndex, colors.length - 1)];
      
      shot.forEach((trajectory) => {
        if (trajectory.length < 2) return;
        
        this.trajectoryGraphics.lineStyle(1.5, color, 0.6);
        this.drawSimpleTrajectory(trajectory);
      });
    });

    // Draw current shot trajectories (brighter color)
    this.currentShot.forEach((trajectory) => {
      if (trajectory.length < 2) return;
      
      this.trajectoryGraphics.lineStyle(1.8, 0xffff00, 0.75);
      this.drawSimpleTrajectory(trajectory);
    });

    // Draw active trajectories (brightest, most visible)
    this.activeTrajectories.forEach((trajectory) => {
      if (trajectory.length < 2) return;
      
      this.trajectoryGraphics.lineStyle(2, 0xffff00, 0.9);
      this.drawSimpleTrajectory(trajectory);
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
    }
    
    if (this.trajectoryPreview) {
      this.trajectoryPreview.destroy();
    }
    
    this.activeTrajectories.clear();
    this.completedShots = [];
    this.currentShot = [];
  }
}


