import Phaser from 'phaser';
import { GameMode, type AIDifficulty } from '@/types';
import { createTextWithShadow } from '@/utils/NESUI';
import { Tank } from '@/entities/Tank';
import { SINGLEPLAYER_LEVELS } from '@/config/levels';
import { getWeaponConfig } from '@/config/weapons';

/**
 * UI System for game HUD (only for GameScene, not for menus)
 */
export class UISystem {
  private scene: Phaser.Scene;
  private uiText!: Phaser.GameObjects.BitmapText;
  private uiTextShadow!: Phaser.GameObjects.BitmapText;
  private weaponTexts: { text: Phaser.GameObjects.BitmapText; shadow: Phaser.GameObjects.BitmapText }[] = [];
  private uiContainer!: Phaser.GameObjects.Container;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  /**
   * Setup UI elements
   */
  public setup(): void {
    // Create UI container for HUD elements
    this.uiContainer = this.scene.add.container(0, 0);
    
    // UI text with shadow (bitmap font)
    const { shadow: uiTextShadow, text: uiText } = createTextWithShadow(
      this.scene,
      this.uiContainer,
      20,
      20,
      '',
      18,
      0xffffff,
      0,
      0
    );
    this.uiTextShadow = uiTextShadow;
    this.uiText = uiText;

    // Controls text with shadow (bitmap font)
    const controlsTextStr = 'Controls: Arrows (Aim) | SPACE (Fire) | 1-3 (Weapon)';
    createTextWithShadow(
      this.scene,
      this.uiContainer,
      20,
      60,
      controlsTextStr,
      14,
      0xaaaaaa,
      0,
      0
    );

    // Create weapon display elements
    const weaponYStart = 90;
    const weaponSpacing = 30;
    
    for (let i = 0; i < 3; i++) {
      const weaponUI = createTextWithShadow(
        this.scene,
        this.uiContainer,
        20,
        weaponYStart + (i * weaponSpacing),
        '',
        16,
        0xaaaaaa,
        0,
        0
      );
      this.weaponTexts.push(weaponUI);
    }
  }

  /**
   * Update UI with current game state
   */
  public update(
    currentTank: Tank | undefined,
    currentPlayerIndex: number,
    gameMode: GameMode,
    currentLevelIndex: number
  ): void {
    if (!currentTank || !currentTank.isAlive()) {
      return;
    }

    let modeText = 'Singleplayer';
    if (gameMode === GameMode.Multiplayer) {
      modeText = 'P2P Multiplayer';
    } else if (gameMode === GameMode.Local) {
      modeText = 'Local Multiplayer';
    }
    
    // Add level number for singleplayer mode
    let levelText = '';
    if (gameMode === GameMode.Solo) {
      const levelNumber = currentLevelIndex + 1;
      const totalLevels = SINGLEPLAYER_LEVELS.length;
      levelText = ` | Level ${levelNumber}/${totalLevels}`;
    }
    
    const isAITurn = gameMode === GameMode.Solo && currentPlayerIndex === 1;
    const playerText = isAITurn ? 'AI Thinking...' : `Player ${currentPlayerIndex + 1}`;
    const angleText = `Angle: ${currentTank.getTurretAngle().toFixed(0)}°`;
    const powerText = `Power: ${currentTank.getPower().toFixed(0)}%`;

    const uiTextStr = `${modeText}${levelText} | ${playerText} | ${angleText} | ${powerText}`;
    this.uiText.setText(uiTextStr);
    this.uiTextShadow.setText(uiTextStr);

    // Update weapons list
    this.updateWeaponsList(currentTank);
  }

  /**
   * Update weapons list with ammunition counts
   */
  private updateWeaponsList(currentTank: Tank): void {
    const weapons = ['standard', 'salvo', 'hazelnut'];
    const currentWeapon = currentTank.getWeapon();
    
    weapons.forEach((weapon, index) => {
      const config = getWeaponConfig(weapon as any);
      const ammo = currentTank.getAmmo(weapon);
      const ammoText = ammo === -1 ? '∞' : `x${ammo}`;
      const isCurrent = weapon === currentWeapon;
      const hasAmmo = ammo === -1 || ammo > 0;
      
      // Format text
      let text = `[${index + 1}] ${config.name}: ${ammoText}`;
      if (isCurrent) {
        text = `► ${text} ◄`;
      }
      
      // Choose color based on state
      let color: number;
      if (!hasAmmo) {
        color = 0x555555; // Dark gray - no ammo
      } else if (isCurrent) {
        color = 0x00ff00; // Bright green - current weapon
      } else {
        color = 0xffffff; // White - available
      }
      
      // Update text
      const weaponUI = this.weaponTexts[index];
      weaponUI.text.setText(text);
      weaponUI.shadow.setText(text);
      weaponUI.text.setTintFill(color);
    });
  }

  /**
   * Clean up Phaser objects
   */
  public destroy(): void {
    if (this.uiContainer) {
      this.uiContainer.destroy(true);
      this.uiContainer = undefined as any;
    }
    // BitmapText objects are destroyed with container
    this.uiText = undefined as any;
    this.uiTextShadow = undefined as any;
  }
}

