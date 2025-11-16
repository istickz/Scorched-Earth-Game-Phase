import Phaser from 'phaser';
import { type ITankConfig } from '@/types';

/**
 * Tank entity with body, turret, and health system
 */
export class Tank extends Phaser.GameObjects.Container {
  private bodyGraphics!: Phaser.GameObjects.Graphics;
  private turretBaseGraphics!: Phaser.GameObjects.Graphics;
  private barrelContainer!: Phaser.GameObjects.Container;
  private barrelGraphics!: Phaser.GameObjects.Graphics;
  private tracksGraphics!: Phaser.GameObjects.Graphics;
  private healthBar!: Phaser.GameObjects.Graphics;
  private healthBarBg!: Phaser.GameObjects.Graphics;
  private config: ITankConfig;
  private turretAngle: number = 0;
  private power: number = 50; // 0-100
  private isRightSideTank: boolean = false;
  private bodyWidth: number = 65; // Longer body to match oval turret
  private bodyHeight: number = 20;
  private turretRadius: number = 10;
  private barrelLength: number = 30;
  private barrelWidth: number = 6;
  private isStatic: boolean = true; // Start as static (standing on ground)

  constructor(scene: Phaser.Scene, config: ITankConfig) {
    super(scene, config.x, config.y);
    this.config = { ...config };

    this.createTank();
    this.createHealthBar();

    // Set initial turret angle
    // For left tank: 0° = pointing right (toward enemy)
    // For right tank: 0° should point left (toward enemy), so we need to handle it differently
    // Actually, for right tank, when turretAngle = 0, it should point left (180° in Phaser)
    // So we set initial angle to 0 for both, but the visual calculation handles right tank differently
    this.setTurretAngle(0);

    scene.add.existing(this);
    this.setDepth(10); // Render above terrain

    // Add physics body so tank can fall when ground is destroyed
    this.setupPhysics();
  }

  /**
   * Set up physics body for tank
   */
  private setupPhysics(): void {
    if (!this.scene.matter) {
      return;
    }

    // Create physics body as rectangle matching tank size
    const physicsWidth = this.bodyWidth;
    const physicsHeight = this.bodyHeight;

    // Add physics to the container
    this.scene.matter.add.gameObject(this, {
      shape: {
        type: 'rectangle',
        width: physicsWidth,
        height: physicsHeight,
      },
    });

    // Set physics properties through body
    const body = (this as any).body;
    if (body && this.scene.matter) {
      // Start as static (standing on ground)
      // Access Matter.js API through Phaser
      const Matter = (this.scene.matter.world as any).engine?.Matter || (window as any).Matter;
      if (Matter && Matter.Body) {
        Matter.Body.setStatic(body, true); // Static by default
        Matter.Body.setMass(body, 10); // Heavier than projectiles
        Matter.Body.setInertia(body, Infinity); // Prevent rotation
        body.frictionAir = 0.1; // Some air resistance
        body.friction = 0.8; // High friction with ground
      } else {
        // Fallback: set properties directly
        body.isStatic = true;
        body.mass = 10;
        body.inertia = Infinity;
        body.frictionAir = 0.1;
        body.friction = 0.8;
      }
    }
  }

  /**
   * Create tank body and turret
   */
  private createTank(): void {
    // Determine if tank is on the right side (should face left)
    const screenCenter = this.scene.cameras.main.width / 2;
    this.isRightSideTank = this.config.x > screenCenter;

    // Create tank body (trapezoid shape like Scorched Earth)
    this.bodyGraphics = this.scene.add.graphics();
    this.drawTankBody();

    // Create tracks/wheels at bottom
    this.tracksGraphics = this.scene.add.graphics();
    this.drawTracks();

    // Create turret base (circular)
    this.turretBaseGraphics = this.scene.add.graphics();
    this.drawTurretBase();

    // Create barrel (rotates with turret) - use Container for rotation
    const turretY = -this.bodyHeight / 2;
    this.barrelContainer = this.scene.add.container(0, turretY);
    this.barrelGraphics = this.scene.add.graphics();
    this.drawBarrel();
    this.barrelContainer.add(this.barrelGraphics);

    // Add all graphics in correct order (body -> tracks -> turret -> barrel)
    this.add([this.bodyGraphics, this.tracksGraphics, this.turretBaseGraphics, this.barrelContainer]);
  }

  /**
   * Draw tank body as trapezoid (wider at bottom, narrower at top)
   */
  private drawTankBody(): void {
    this.bodyGraphics.clear();
    
    const topWidth = this.bodyWidth * 0.7; // Narrower at top
    const bottomWidth = this.bodyWidth;
    const halfTop = topWidth / 2;
    const halfBottom = bottomWidth / 2;
    const halfHeight = this.bodyHeight / 2;

    // Main body (trapezoid)
    this.bodyGraphics.fillStyle(this.config.color);
    this.bodyGraphics.beginPath();
    this.bodyGraphics.moveTo(-halfTop, -halfHeight);
    this.bodyGraphics.lineTo(halfTop, -halfHeight);
    this.bodyGraphics.lineTo(halfBottom, halfHeight);
    this.bodyGraphics.lineTo(-halfBottom, halfHeight);
    this.bodyGraphics.closePath();
    this.bodyGraphics.fillPath();

    // Add darker outline for depth
    this.bodyGraphics.lineStyle(2, this.darkenColor(this.config.color, 0.3));
    this.bodyGraphics.strokePath();

    // Add highlight on top
    const highlightColor = this.lightenColor(this.config.color, 0.2);
    this.bodyGraphics.fillStyle(highlightColor);
    this.bodyGraphics.fillRect(-halfTop * 0.8, -halfHeight, topWidth * 0.6, 3);
  }

  /**
   * Draw tracks/wheels at bottom of tank
   */
  private drawTracks(): void {
    this.tracksGraphics.clear();
    
    const halfHeight = this.bodyHeight / 2;
    const trackY = halfHeight - 2; // Just above bottom edge
    const trackHeight = 4;
    const wheelRadius = 3;
    const wheelSpacing = 8;

    // Draw tracks (rectangles)
    this.tracksGraphics.fillStyle(0x333333); // Dark gray
    const trackWidth = this.bodyWidth * 0.9;
    this.tracksGraphics.fillRect(-trackWidth / 2, trackY, trackWidth, trackHeight);

    // Draw wheels (small circles)
    this.tracksGraphics.fillStyle(0x222222); // Darker gray
    const numWheels = 3;
    const startX = -trackWidth / 2 + wheelSpacing;
    for (let i = 0; i < numWheels; i++) {
      const wheelX = startX + i * wheelSpacing;
      this.tracksGraphics.fillCircle(wheelX, trackY + trackHeight / 2, wheelRadius);
    }
  }

  /**
   * Draw elliptical turret base
   */
  private drawTurretBase(): void {
    this.turretBaseGraphics.clear();
    
    const turretY = -this.bodyHeight / 2; // Top of tank body
    const turretWidth = this.turretRadius * 2.6; // Ellipse width (more oval, wider)
    const turretHeight = this.turretRadius * 1.6; // Ellipse height (more oval, shorter)

    // Turret base (ellipse)
    this.turretBaseGraphics.fillStyle(this.config.color);
    this.turretBaseGraphics.fillEllipse(0, turretY, turretWidth, turretHeight);

    // Turret outline
    this.turretBaseGraphics.lineStyle(2, this.darkenColor(this.config.color, 0.3));
    this.turretBaseGraphics.strokeEllipse(0, turretY, turretWidth, turretHeight);

    // Turret highlight
    const highlightColor = this.lightenColor(this.config.color, 0.2);
    this.turretBaseGraphics.fillStyle(highlightColor);
    this.turretBaseGraphics.fillEllipse(-2, turretY - 2, 7, 3);
  }

  /**
   * Draw barrel (gun barrel that rotates)
   */
  private drawBarrel(): void {
    this.barrelGraphics.clear();
    
    // Barrel is drawn relative to container center (which is at turret center)
    // Draw barrel extending upward from center (negative Y in container coordinates)
    const barrelTopY = -this.barrelLength; // Barrel extends upward

    // Barrel (rectangle)
    this.barrelGraphics.fillStyle(0x444444); // Dark gray barrel
    this.barrelGraphics.fillRect(
      -this.barrelWidth / 2,
      barrelTopY,
      this.barrelWidth,
      this.barrelLength
    );

    // Barrel outline
    this.barrelGraphics.lineStyle(1, 0x222222);
    this.barrelGraphics.strokeRect(
      -this.barrelWidth / 2,
      barrelTopY,
      this.barrelWidth,
      this.barrelLength
    );

    // Barrel tip (muzzle)
    this.barrelGraphics.fillStyle(0x222222);
    this.barrelGraphics.fillRect(
      -this.barrelWidth / 2 - 1,
      barrelTopY - 2,
      this.barrelWidth + 2,
      2
    );
  }

  /**
   * Darken a color by a factor (0-1)
   */
  private darkenColor(color: number, factor: number): number {
    const r = Math.floor(((color >> 16) & 0xff) * (1 - factor));
    const g = Math.floor(((color >> 8) & 0xff) * (1 - factor));
    const b = Math.floor((color & 0xff) * (1 - factor));
    return (r << 16) | (g << 8) | b;
  }

  /**
   * Lighten a color by a factor (0-1)
   */
  private lightenColor(color: number, factor: number): number {
    const r = Math.min(255, Math.floor(((color >> 16) & 0xff) + (255 - ((color >> 16) & 0xff)) * factor));
    const g = Math.min(255, Math.floor(((color >> 8) & 0xff) + (255 - ((color >> 8) & 0xff)) * factor));
    const b = Math.min(255, Math.floor((color & 0xff) + (255 - (color & 0xff)) * factor));
    return (r << 16) | (g << 8) | b;
  }

  /**
   * Create health bar above tank
   */
  private createHealthBar(): void {
    const barWidth = 50;
    const barHeight = 3; // Even thinner
    const offsetY = -30;

    // Health bar background
    this.healthBarBg = this.scene.add.graphics();
    this.healthBarBg.fillStyle(0x1a1a1a); // Dark gray
    this.healthBarBg.fillRect(-barWidth / 2, offsetY, barWidth, barHeight);

    // Health bar
    this.healthBar = this.scene.add.graphics();
    this.updateHealthBar();

    this.add([this.healthBarBg, this.healthBar]);
  }

  /**
   * Update health bar display
   */
  private updateHealthBar(): void {
    const barWidth = 50;
    const barHeight = 3; // Even thinner
    const offsetY = -30;
    const healthPercent = this.config.health / this.config.maxHealth;

    this.healthBar.clear();
    // Muted colors: dark green for high health, orange-brown for medium, dark red for low
    const healthColor = healthPercent > 0.5 
      ? 0x5d8c52  // Brighter muted green
      : healthPercent > 0.25 
        ? 0x8b6f47  // Muted orange-brown
        : 0x8b3a3a; // Muted dark red
    this.healthBar.fillStyle(healthColor);
    this.healthBar.fillRect(-barWidth / 2, offsetY, barWidth * healthPercent, barHeight);
  }

  /**
   * Set turret angle in degrees (0 = right, 90 = down, -90 = up)
   * For right-side tanks, 0° means pointing left (toward enemy)
   */
  public setTurretAngle(angle: number): void {
    this.turretAngle = Phaser.Math.Clamp(angle, -90, 90);
    
    if (this.isRightSideTank) {
      // Right tank: turretAngle = 0 should point left (toward enemy)
      // Barrel container points up (-90°), to point left we need 180° in world space
      // Formula: 270° - turretAngle
      // When turretAngle = 0: visualAngle = 270° (points left)
      // When turretAngle = 45: visualAngle = 225° (points up-left)
      // When turretAngle = -45: visualAngle = 315° (points down-left)
      const visualAngle = 270 - this.turretAngle;
      this.barrelContainer.setAngle(visualAngle);
    } else {
      // Left tank: turretAngle = 0 should point right (toward enemy)
      // Barrel container points up (-90°), so to point right we need 90° rotation
      // Formula: 90° + turretAngle
      const visualAngle = 90 + this.turretAngle;
      this.barrelContainer.setAngle(visualAngle);
    }
  }

  /**
   * Get current turret angle
   */
  public getTurretAngle(): number {
    return this.turretAngle;
  }

  /**
   * Set power (0-100)
   */
  public setPower(power: number): void {
    this.power = Phaser.Math.Clamp(power, 0, 100);
  }

  /**
   * Get current power
   */
  public getPower(): number {
    return this.power;
  }

  /**
   * Fire a projectile
   */
  public fire(): { x: number; y: number; angle: number; power: number } {
    // Turret base position relative to tank center
    // Turret is positioned at (0, -bodyHeight/2) in container coordinates
    const turretBaseX = 0;
    const turretBaseY = -this.bodyHeight / 2;

    // For right tank, turretAngle = 0 means pointing left (180° in game coordinates)
    // So we need to convert turretAngle to actual firing angle
    // Left tank: turretAngle = 0 means right (0°), so firing angle = turretAngle
    // Right tank: turretAngle = 0 means left (180°), so firing angle = 180° - turretAngle
    const firingAngle = this.isRightSideTank ? 180 - this.turretAngle : this.turretAngle;
    const angleRad = Phaser.Math.DegToRad(firingAngle);

    // Calculate barrel tip position relative to turret base
    // Barrel extends from turret center in the direction of the firing angle
    // Add 5px offset beyond barrel tip to ensure projectile clears the tank body
    const barrelTipOffset = 5;
    const totalBarrelDistance = this.barrelLength + barrelTipOffset;
    const barrelTipX = Math.cos(angleRad) * totalBarrelDistance;
    const barrelTipY = Math.sin(angleRad) * totalBarrelDistance;

    // Calculate world position: tank position + turret base offset + barrel tip offset
    const worldX = this.x + turretBaseX + barrelTipX;
    const worldY = this.y + turretBaseY + barrelTipY;

    return {
      x: worldX,
      y: worldY,
      angle: firingAngle, // Use firing angle, not turretAngle
      power: this.power,
    };
  }

  /**
   * Apply damage to tank
   */
  public takeDamage(amount: number): void {
    this.config.health = Math.max(0, this.config.health - amount);
    this.updateHealthBar();

    if (this.config.health <= 0) {
      this.destroy();
    }
  }

  /**
   * Get current health
   */
  public getHealth(): number {
    return this.config.health;
  }

  /**
   * Check if tank is alive
   */
  public isAlive(): boolean {
    return this.config.health > 0;
  }

  /**
   * Get tank configuration
   */
  public getConfig(): ITankConfig {
    return { ...this.config };
  }

  /**
   * Position tank on terrain surface
   */
  public positionOnTerrain(terrainHeight: number): void {
    this.y = terrainHeight - 10; // Position tank 10px above terrain
  }

  /**
   * Check if there's ground under the tank and update physics state
   */
  public checkGroundSupport(terrainSystem: { isSolid: (x: number, y: number) => boolean }): void {
    const body = (this as any).body;
    if (!body) {
      return;
    }

    // Check multiple points under the tank to detect ground
    const checkX = this.x;
    const checkY = this.y + this.bodyHeight / 2 + 2; // Check 2px below tank bottom
    
    // Check center and sides for stability
    const hasGround = terrainSystem.isSolid(checkX, checkY);
    const hasGroundLeft = terrainSystem.isSolid(checkX - this.bodyWidth / 3, checkY);
    const hasGroundRight = terrainSystem.isSolid(checkX + this.bodyWidth / 3, checkY);
    const hasAnyGround = hasGround || hasGroundLeft || hasGroundRight;

    // Also check if tank is falling and about to hit ground (for stopping on crater bottom)
    const checkYBelow = this.y + this.bodyHeight / 2 + 10; // Check further below
    const hasGroundBelow = terrainSystem.isSolid(checkX, checkYBelow) || 
                          terrainSystem.isSolid(checkX - this.bodyWidth / 3, checkYBelow) ||
                          terrainSystem.isSolid(checkX + this.bodyWidth / 3, checkYBelow);

    // Update static/dynamic state
    const Matter = (this.scene.matter?.world as any)?.engine?.Matter || (window as any).Matter;
    if (Matter && Matter.Body) {
      if (hasAnyGround && !this.isStatic) {
        // Ground appeared under tank - make static and stop falling
        Matter.Body.setStatic(body, true);
        Matter.Body.setVelocity(body, 0, 0); // Stop all movement
        this.isStatic = true;
      } else if (hasGroundBelow && !this.isStatic && body.velocity.y > 0) {
        // Tank is falling and about to hit ground - stop it
        Matter.Body.setStatic(body, true);
        Matter.Body.setVelocity(body, 0, 0); // Stop all movement
        // Position tank on top of ground
        const groundY = this.findGroundY(checkX, terrainSystem);
        if (groundY !== null) {
          this.y = groundY - this.bodyHeight / 2 - 2; // Position on top of ground
        }
        this.isStatic = true;
      } else if (!hasAnyGround && !hasGroundBelow && this.isStatic) {
        // Ground disappeared - make dynamic so tank falls
        Matter.Body.setStatic(body, false);
        this.isStatic = false;
      }
    } else {
      // Fallback
      if (hasAnyGround && !this.isStatic) {
        body.isStatic = true;
        body.velocity.x = 0;
        body.velocity.y = 0;
        this.isStatic = true;
      } else if (hasGroundBelow && !this.isStatic && body.velocity && body.velocity.y > 0) {
        body.isStatic = true;
        body.velocity.x = 0;
        body.velocity.y = 0;
        const groundY = this.findGroundY(checkX, terrainSystem);
        if (groundY !== null) {
          this.y = groundY - this.bodyHeight / 2 - 2;
        }
        this.isStatic = true;
      } else if (!hasAnyGround && !hasGroundBelow && this.isStatic) {
        body.isStatic = false;
        this.isStatic = false;
      }
    }
  }

  /**
   * Find the Y coordinate of the ground at a given X position
   */
  private findGroundY(x: number, terrainSystem: { isSolid: (x: number, y: number) => boolean }): number | null {
    // Search downward from current position to find ground
    const startY = this.y + this.bodyHeight / 2;
    const maxSearch = 200; // Maximum search distance
    
    for (let y = startY; y < startY + maxSearch; y++) {
      if (terrainSystem.isSolid(x, y)) {
        return y;
      }
    }
    
    return null; // No ground found
  }
}

