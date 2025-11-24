import Phaser from 'phaser';
import { type ITankConfig } from '@/types';
import { Shield } from './shields/Shield';
import { ShieldFactory } from './shields/ShieldFactory';
import { type ShieldType } from './shields';

/**
 * Matter.js body type (not exported by Phaser types)
 */
type MatterBody = unknown;

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
  private power: number = 50; // 0-200
  private weaponType: string = 'standard'; // Current weapon type
  // Ammunition system: standard is infinite (-1), others are limited
  private ammunition: Map<string, number>;
  
  // Active shield
  private activeShield: Shield | null = null;
  private isRightSideTank: boolean = false;
  private bodyWidth: number = 65; // Longer body to match oval turret
  private bodyHeight: number = 20;
  private turretRadius: number = 10;
  private barrelLength: number = 30;
  private barrelWidth: number = 6;
  private isStatic: boolean = true; // Start as static (standing on ground)

  constructor(scene: Phaser.Scene, config: ITankConfig, ammunitionConfig: Record<string, number>) {
    super(scene, config.x, config.y);
    this.config = { ...config };
    
    // Initialize ammunition from config
    this.ammunition = new Map(Object.entries(ammunitionConfig));

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
    interface ContainerWithBody {
      body?: MatterBody & { isStatic?: boolean; mass?: number; inertia?: number; frictionAir?: number; friction?: number };
    }
    interface MatterBodyAPI {
      Body: {
        setStatic: (body: MatterBody, isStatic: boolean) => void;
        setMass: (body: MatterBody, mass: number) => void;
        setInertia: (body: MatterBody, inertia: number) => void;
        setVelocity: (body: MatterBody, x: number, y: number) => void;
      };
    }
    interface MatterWorldWithEngine {
      engine?: {
        Matter?: MatterBodyAPI;
      };
    }
    interface WindowWithMatter {
      Matter?: MatterBodyAPI;
    }
    const containerWithBody = this as Phaser.GameObjects.Container & ContainerWithBody;
    const body = containerWithBody.body;
    if (body && this.scene.matter) {
      // Start as static (standing on ground)
      // Access Matter.js API through Phaser
      const matterWorld = this.scene.matter.world as Phaser.Physics.Matter.World & MatterWorldWithEngine;
      const windowWithMatter = window as Window & WindowWithMatter;
      const Matter = matterWorld.engine?.Matter || windowWithMatter.Matter;
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
   * Draw tank body in pixel art style (trapezoid shape)
   */
  private drawTankBody(): void {
    this.bodyGraphics.clear();
    
    // Pixel art: use integer coordinates and pixel-by-pixel drawing
    const topWidth = Math.floor(this.bodyWidth * 0.7); // Narrower at top
    const bottomWidth = Math.floor(this.bodyWidth);
    const halfTop = Math.floor(topWidth / 2);
    const halfBottom = Math.floor(bottomWidth / 2);
    const halfHeight = Math.floor(this.bodyHeight / 2);
    
    const darkColor = this.darkenColor(this.config.color, 0.3);
    const lightColor = this.lightenColor(this.config.color, 0.2);

    // Draw pixel-by-pixel trapezoid
    for (let y = -halfHeight; y <= halfHeight; y++) {
      const progress = (y + halfHeight) / (halfHeight * 2); // 0 to 1 from top to bottom
      const currentWidth = Math.floor(topWidth + (bottomWidth - topWidth) * progress);
      const halfCurrentWidth = Math.floor(currentWidth / 2);
      
      for (let x = -halfCurrentWidth; x <= halfCurrentWidth; x++) {
        const pixelX = Math.floor(x);
        const pixelY = Math.floor(y);
        
        // Determine pixel color based on position
        let pixelColor = this.config.color;
        
        // Dark outline
        if (x === -halfCurrentWidth || x === halfCurrentWidth || 
            (y === -halfHeight && Math.abs(x) <= halfTop) ||
            (y === halfHeight && Math.abs(x) <= halfBottom)) {
          pixelColor = darkColor;
        }
        // Light highlight on top
        else if (y === -halfHeight + 1 && Math.abs(x) <= Math.floor(halfTop * 0.8)) {
          pixelColor = lightColor;
        }
        
        this.bodyGraphics.fillStyle(pixelColor);
        this.bodyGraphics.fillRect(pixelX, pixelY, 1, 1);
      }
    }
  }

  /**
   * Draw tracks/wheels in pixel art style
   */
  private drawTracks(): void {
    this.tracksGraphics.clear();
    
    const halfHeight = Math.floor(this.bodyHeight / 2);
    const trackY = halfHeight - 2; // Just above bottom edge
    const trackHeight = 4;
    const wheelSpacing = 8;
    const trackWidth = Math.floor(this.bodyWidth * 0.9);
    const halfTrackWidth = Math.floor(trackWidth / 2);

    // Draw tracks (pixel rectangles)
    this.tracksGraphics.fillStyle(0x333333); // Dark gray
    for (let x = -halfTrackWidth; x < halfTrackWidth; x++) {
      for (let y = 0; y < trackHeight; y++) {
        this.tracksGraphics.fillRect(Math.floor(x), trackY + y, 1, 1);
      }
    }

    // Draw wheels (pixel circles - 3x3 pixels)
    this.tracksGraphics.fillStyle(0x222222); // Darker gray
    const numWheels = 3;
    const startX = -halfTrackWidth + wheelSpacing;
    for (let i = 0; i < numWheels; i++) {
      const wheelX = Math.floor(startX + i * wheelSpacing);
      const wheelY = trackY + Math.floor(trackHeight / 2);
      
      // Draw 3x3 pixel wheel
      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          if (dx * dx + dy * dy <= 1) { // Circle check
            this.tracksGraphics.fillRect(wheelX + dx, wheelY + dy, 1, 1);
          }
        }
      }
    }
  }

  /**
   * Draw turret base in pixel art style (rounded rectangle)
   */
  private drawTurretBase(): void {
    this.turretBaseGraphics.clear();
    
    const turretY = Math.floor(-this.bodyHeight / 2); // Top of tank body
    const turretWidth = Math.floor(this.turretRadius * 2.6); // Ellipse width (more oval, wider)
    const turretHeight = Math.floor(this.turretRadius * 1.6); // Ellipse height (more oval, shorter)
    const halfWidth = Math.floor(turretWidth / 2);
    const halfHeight = Math.floor(turretHeight / 2);
    
    const darkColor = this.darkenColor(this.config.color, 0.3);
    const lightColor = this.lightenColor(this.config.color, 0.2);

    // Draw pixel-by-pixel rounded rectangle (ellipse approximation)
    for (let y = -halfHeight; y <= halfHeight; y++) {
      for (let x = -halfWidth; x <= halfWidth; x++) {
        const pixelX = Math.floor(x);
        const pixelY = Math.floor(turretY + y);
        
        // Check if pixel is inside ellipse: (x/a)^2 + (y/b)^2 <= 1
        const ellipseCheck = (x * x) / (halfWidth * halfWidth) + (y * y) / (halfHeight * halfHeight);
        
        if (ellipseCheck <= 1.0) {
          let pixelColor = this.config.color;
          
          // Dark outline
          if (ellipseCheck > 0.85) {
            pixelColor = darkColor;
          }
          // Light highlight on top-left
          else if (x < 0 && y < -halfHeight + 2 && ellipseCheck < 0.5) {
            pixelColor = lightColor;
          }
          
          this.turretBaseGraphics.fillStyle(pixelColor);
          this.turretBaseGraphics.fillRect(pixelX, pixelY, 1, 1);
        }
      }
    }
  }

  /**
   * Draw barrel in pixel art style (gun barrel that rotates)
   */
  private drawBarrel(): void {
    this.barrelGraphics.clear();
    
    // Barrel is drawn relative to container center (which is at turret center)
    // Draw barrel extending upward from center (negative Y in container coordinates)
    const barrelTopY = Math.floor(-this.barrelLength); // Barrel extends upward
    const barrelWidth = Math.floor(this.barrelWidth);
    const halfWidth = Math.floor(barrelWidth / 2);

    // Barrel (pixel rectangle)
    this.barrelGraphics.fillStyle(0x444444); // Dark gray barrel
    for (let y = barrelTopY; y < 0; y++) {
      for (let x = -halfWidth; x < halfWidth; x++) {
        const pixelX = Math.floor(x);
        const pixelY = Math.floor(y);
        
        let pixelColor = 0x444444;
        
        // Dark outline
        if (x === -halfWidth || x === halfWidth - 1 || y === barrelTopY || y === -1) {
          pixelColor = 0x222222;
        }
        
        this.barrelGraphics.fillStyle(pixelColor);
        this.barrelGraphics.fillRect(pixelX, pixelY, 1, 1);
      }
    }

    // Barrel tip (muzzle) - darker pixels
    this.barrelGraphics.fillStyle(0x222222);
    for (let y = barrelTopY - 2; y < barrelTopY; y++) {
      for (let x = -halfWidth - 1; x <= halfWidth; x++) {
        this.barrelGraphics.fillRect(Math.floor(x), Math.floor(y), 1, 1);
      }
    }
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
   * Set power (0-200)
   */
  public setPower(power: number): void {
    this.power = Phaser.Math.Clamp(power, 0, 200);
  }

  /**
   * Get current power
   */
  public getPower(): number {
    return this.power;
  }

  /**
   * Set weapon type (only if available)
   */
  public setWeapon(weaponType: string): void {
    // Only switch if we have ammunition for this weapon
    if (this.hasAmmo(weaponType)) {
      this.weaponType = weaponType;
    }
  }

  /**
   * Get current weapon type
   */
  public getWeapon(): string {
    return this.weaponType;
  }

  /**
   * Check if tank has ammunition for given weapon type
   */
  public hasAmmo(weaponType: string): boolean {
    const ammo = this.ammunition.get(weaponType);
    return ammo === undefined || ammo === -1 || ammo > 0;
  }

  /**
   * Get ammunition count for weapon type (-1 means infinite)
   */
  public getAmmo(weaponType: string): number {
    return this.ammunition.get(weaponType) ?? 0;
  }

  /**
   * Consume ammunition for current weapon
   */
  public consumeAmmo(): void {
    const currentAmmo = this.ammunition.get(this.weaponType);
    if (currentAmmo !== undefined && currentAmmo > 0) {
      this.ammunition.set(this.weaponType, currentAmmo - 1);
      
      // Auto-switch to standard weapon if current weapon runs out
      if (this.ammunition.get(this.weaponType) === 0) {
        this.weaponType = 'standard';
      }
    }
  }

  /**
   * Activate shield
   */
  public activateShield(shieldType: string): boolean {
    // Check if we have ammo for this shield
    if (!this.hasAmmo(shieldType)) {
      return false;
    }

    // Deactivate previous shield if exists
    if (this.activeShield) {
      this.activeShield.deactivate();
      this.activeShield = null;
    }

    // Create and activate new shield
    const shield = ShieldFactory.getShield(shieldType as ShieldType);
    shield.activate(this.scene, this.x, this.y);
    this.activeShield = shield;

    // Consume ammo
    const currentAmmo = this.ammunition.get(shieldType);
    if (currentAmmo !== undefined && currentAmmo > 0) {
      this.ammunition.set(shieldType, currentAmmo - 1);
    }

    return true;
  }

  /**
   * Check if tank has active shield
   */
  public hasActiveShield(): boolean {
    return this.activeShield !== null && this.activeShield.isActive();
  }

  /**
   * Get active shield
   */
  public getActiveShield(): Shield | null {
    return this.activeShield;
  }

  /**
   * Deactivate shield
   */
  public deactivateShield(): void {
    if (this.activeShield) {
      this.activeShield.deactivate();
      this.activeShield = null;
    }
  }

  /**
   * Fire a projectile
   */
  public fire(): { x: number; y: number; angle: number; power: number; weaponType: string } {
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
      weaponType: this.weaponType,
    };
  }

  /**
   * Apply damage to tank
   */
  public takeDamage(amount: number): void {
    const previousHealth = this.config.health;
    const stackTrace = new Error().stack;
    this.config.health = Math.max(0, this.config.health - amount);
    this.updateHealthBar();

    // Log damage received with detailed info
    console.log(`[Tank Damage] ${this.config.isPlayer ? 'Player' : 'Bot'} tank at (${Math.round(this.x)}, ${Math.round(this.y)}) received ${amount} damage. Health: ${previousHealth} → ${this.config.health}`);
    console.log(`[Tank Damage Stack]`, stackTrace?.split('\n').slice(1, 4).join('\n'));

    if (this.config.health <= 0) {
      console.log(`[Tank Destroyed] ${this.config.isPlayer ? 'Player' : 'Bot'} tank at (${Math.round(this.x)}, ${Math.round(this.y)}) was destroyed`);
      this.destroy();
    }
  }

  /**
   * Update shield position (call when tank position changes)
   */
  public updateShieldPosition(): void {
    if (this.activeShield && this.activeShield.isActive()) {
      this.activeShield.updatePosition(this.x, this.y);
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
    // Update shield position when tank moves
    this.updateShieldPosition();
    
    interface ContainerWithBody {
      body?: MatterBody & { isStatic?: boolean; velocity?: { x: number; y: number } };
    }
    const containerWithBody = this as Phaser.GameObjects.Container & ContainerWithBody;
    const body = containerWithBody.body;
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
    interface MatterBodyAPI {
      Body: {
        setStatic: (body: MatterBody, isStatic: boolean) => void;
        setVelocity: (body: MatterBody, x: number, y: number) => void;
      };
    }
    interface MatterWorldWithEngine {
      engine?: {
        Matter?: MatterBodyAPI;
      };
    }
    interface WindowWithMatter {
      Matter?: MatterBodyAPI;
    }
    const matterWorld = this.scene.matter?.world as (Phaser.Physics.Matter.World & MatterWorldWithEngine) | undefined;
    const windowWithMatter = window as Window & WindowWithMatter;
    const Matter = matterWorld?.engine?.Matter || windowWithMatter.Matter;
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

  /**
   * Clean up resources
   */
  public destroy(): void {
    // Deactivate shield before destroying
    this.deactivateShield();
    super.destroy();
  }
}

