import Phaser from 'phaser';
import { type IShieldConfig, type ShieldType } from '@/types/shields';

/**
 * Abstract base class for all shield types
 */
export abstract class Shield {
  protected readonly type: ShieldType;
  protected readonly config: IShieldConfig;
  protected currentHP: number;
  protected isActiveState: boolean = false;
  protected shieldGraphics?: Phaser.GameObjects.Graphics;
  protected shieldHPBar?: Phaser.GameObjects.Graphics;
  protected shieldHPBarBg?: Phaser.GameObjects.Graphics;
  protected scene?: Phaser.Scene;
  protected tankX: number = 0;
  protected tankY: number = 0;

  constructor(type: ShieldType, config: IShieldConfig) {
    this.type = type;
    this.config = config;
    this.currentHP = config.maxHP;
  }

  /**
   * Get shield type
   */
  public getType(): ShieldType {
    return this.type;
  }

  /**
   * Get shield configuration
   */
  public getShieldConfig(): IShieldConfig {
    return this.config;
  }

  /**
   * Get current HP
   */
  public getCurrentHP(): number {
    return this.currentHP;
  }

  /**
   * Get max HP
   */
  public getMaxHP(): number {
    return this.config.maxHP;
  }

  /**
   * Check if shield is active
   */
  public isActive(): boolean {
    return this.isActiveState;
  }

  /**
   * Activate shield
   */
  public activate(scene: Phaser.Scene, tankX: number, tankY: number): void {
    this.isActiveState = true;
    this.currentHP = this.config.maxHP;
    this.scene = scene;
    this.tankX = tankX;
    this.tankY = tankY;
    this.createVisual();
    this.playActivationEffect();
  }

  /**
   * Deactivate shield
   */
  public deactivate(): void {
    this.isActiveState = false;
    this.destroyVisual();
  }

  /**
   * Apply damage to shield
   * Returns remaining damage that should be applied to tank
   */
  public takeDamage(amount: number): number {
    if (!this.isActiveState) {
      return amount; // Shield not active, all damage goes to tank
    }

    if (amount >= this.currentHP) {
      // Shield destroyed
      const remainingDamage = amount - this.currentHP;
      this.currentHP = 0;
      this.playDestructionEffect();
      this.deactivate();
      return remainingDamage;
    } else {
      // Shield absorbs damage
      this.currentHP -= amount;
      this.updateVisual();
      this.playDamageEffect();
      return 0; // No damage to tank
    }
  }

  /**
   * Update shield position (when tank moves)
   */
  public updatePosition(tankX: number, tankY: number): void {
    this.tankX = tankX;
    this.tankY = tankY;
    if (this.isActiveState) {
      this.updateVisual();
    }
  }

  /**
   * Create visual representation of shield
   */
  protected createVisual(): void {
    if (!this.scene) {
      return;
    }

    // Create shield circle
    this.shieldGraphics = this.scene.add.graphics();
    this.shieldGraphics.setDepth(8); // Above terrain, below projectiles
    
    // Create HP bar
    this.createHPBar();
    
    this.updateVisual();
  }

  /**
   * Create HP bar for shield
   */
  protected createHPBar(): void {
    if (!this.scene) {
      return;
    }

    const barWidth = 60;
    const barHeight = 6;
    const offsetY = -this.config.radius - 30; // Below tank HP bar

    // Background
    this.shieldHPBarBg = this.scene.add.graphics();
    this.shieldHPBarBg.fillStyle(0x1a1a1a);
    this.shieldHPBarBg.fillRect(-barWidth / 2, offsetY, barWidth, barHeight);
    this.shieldHPBarBg.setPosition(this.tankX, this.tankY);
    this.shieldHPBarBg.setDepth(9);

    // HP bar
    this.shieldHPBar = this.scene.add.graphics();
    this.shieldHPBar.setPosition(this.tankX, this.tankY);
    this.shieldHPBar.setDepth(9);
  }

  /**
   * Update visual representation
   */
  protected updateVisual(): void {
    if (!this.shieldGraphics || !this.scene) {
      return;
    }

    this.shieldGraphics.clear();
    
    // Draw full circle around tank
    const alpha = 0.4;
    this.shieldGraphics.fillStyle(this.config.color, alpha);
    this.shieldGraphics.fillCircle(0, 0, this.config.radius);
    
    // Set position
    this.shieldGraphics.setPosition(this.tankX, this.tankY);

    // Update HP bar
    this.updateHPBar();
  }

  /**
   * Update HP bar
   */
  protected updateHPBar(): void {
    if (!this.shieldHPBar || !this.shieldHPBarBg) {
      return;
    }

    const barWidth = 60;
    const barHeight = 6;
    const offsetY = -this.config.radius - 30;

    // Update positions
    this.shieldHPBar.setPosition(this.tankX, this.tankY);
    this.shieldHPBarBg.setPosition(this.tankX, this.tankY);

    // Update HP bar fill
    this.shieldHPBar.clear();
    const healthPercent = this.currentHP / this.config.maxHP;
    
    // Color based on HP
    const healthColor = healthPercent > 0.5 
      ? 0x00ff00  // Green
      : healthPercent > 0.25 
      ? 0xffff00  // Yellow
      : 0xff0000; // Red

    this.shieldHPBar.fillStyle(healthColor);
    this.shieldHPBar.fillRect(-barWidth / 2, offsetY, barWidth * healthPercent, barHeight);
  }

  /**
   * Play activation effect
   */
  protected playActivationEffect(): void {
    if (!this.shieldGraphics) {
      return;
    }

    // Flash effect on activation
    this.scene?.tweens.add({
      targets: this.shieldGraphics,
      alpha: { from: 0.8, to: 0.4 },
      duration: 200,
      ease: 'Power2',
    });
  }

  /**
   * Play damage effect
   */
  protected playDamageEffect(): void {
    if (!this.shieldGraphics) {
      return;
    }

    // Flash effect on damage
    this.scene?.tweens.add({
      targets: this.shieldGraphics,
      alpha: { from: 0.5, to: 0.2, yoyo: true },
      duration: 100,
      ease: 'Power2',
    });
  }

  /**
   * Play destruction effect
   */
  protected playDestructionEffect(): void {
    if (!this.shieldGraphics) {
      return;
    }

    // Fade out effect
    this.scene?.tweens.add({
      targets: this.shieldGraphics,
      alpha: { from: 0.4, to: 0 },
      duration: 300,
      ease: 'Power2',
      onComplete: () => {
        this.destroyVisual();
      },
    });
  }

  /**
   * Destroy visual representation
   */
  protected destroyVisual(): void {
    if (this.shieldGraphics) {
      this.shieldGraphics.destroy();
      this.shieldGraphics = undefined;
    }
    if (this.shieldHPBar) {
      this.shieldHPBar.destroy();
      this.shieldHPBar = undefined;
    }
    if (this.shieldHPBarBg) {
      this.shieldHPBarBg.destroy();
      this.shieldHPBarBg = undefined;
    }
  }

  /**
   * Clean up resources
   */
  public destroy(): void {
    this.deactivate();
  }
}

