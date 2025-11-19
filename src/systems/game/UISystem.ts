import Phaser from 'phaser';
import { GameMode, type AIDifficulty } from '@/types';
import { createTextWithShadow } from '@/utils/NESUI';
import { Tank } from '@/entities/Tank';
import { SINGLEPLAYER_LEVELS } from '@/config/levels';

/**
 * UI System for game HUD (only for GameScene, not for menus)
 */
export class UISystem {
  private scene: Phaser.Scene;
  private uiText!: Phaser.GameObjects.BitmapText;
  private uiTextShadow!: Phaser.GameObjects.BitmapText;
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
    const controlsTextStr = 'Controls: ← → (Angle) | ↑ ↓ (Power) | SPACE (Fire)';
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

