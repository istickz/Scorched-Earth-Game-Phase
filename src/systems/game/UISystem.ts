import Phaser from 'phaser';
import { GameMode } from '@/types';
import { createTextWithShadow, NESColors } from '@/utils/NESUI';
import { Tank } from '@/entities/Tank';
import { SINGLEPLAYER_LEVELS } from '@/config/levels';
import { WeaponFactory } from '@/entities/weapons';
import { WeaponType } from '@/types/weapons';
import { ShieldFactory } from '@/entities/shields';
import { ShieldType } from '@/types/shields';

/**
 * UI System for game HUD (only for GameScene, not for menus)
 */
export class UISystem {
  private scene: Phaser.Scene;
  private uiText!: Phaser.GameObjects.BitmapText;
  private uiTextShadow!: Phaser.GameObjects.BitmapText;
  private weaponTextsLeft: { text: Phaser.GameObjects.BitmapText; shadow: Phaser.GameObjects.BitmapText }[] = [];
  private weaponTextsRight: { text: Phaser.GameObjects.BitmapText; shadow: Phaser.GameObjects.BitmapText }[] = [];
  private uiContainer!: Phaser.GameObjects.Container;
  private infoPanel!: Phaser.GameObjects.Container;
  private weaponsPanelLeft!: Phaser.GameObjects.Container;
  private weaponsPanelRight!: Phaser.GameObjects.Container;
  private availableWeapons: string[] = [];

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  /**
   * Set available weapons list from level config
   */
  public setAvailableWeapons(weapons: string[]): void {
    this.availableWeapons = weapons;
  }

  /**
   * Setup UI elements
   */
  public setup(): void {
    // Create UI container for HUD elements
    this.uiContainer = this.scene.add.container(0, 0);
    
    const screenWidth = this.scene.cameras.main.width;
    
    // Create info panel at the top (game mode, player, angle, power)
    this.infoPanel = this.scene.add.container(screenWidth / 2, 20);
    
    this.uiContainer.add(this.infoPanel);
    
    // UI text with shadow (bitmap font) - inside info panel
    const { shadow: uiTextShadow, text: uiText } = createTextWithShadow(
      this.scene,
      this.infoPanel,
      0,
      0,
      '',
      18,
      NESColors.white,
      0.5,
      0
    );
    this.uiTextShadow = uiTextShadow;
    this.uiText = uiText;

    // Controls text with shadow (bitmap font) - inside info panel
    const controlsTextStr = 'Controls: Arrows (Aim) | SPACE (Fire/Shield) | 1-6 (Weapon/Shield)';
    createTextWithShadow(
      this.scene,
      this.infoPanel,
      0,
      25,
      controlsTextStr,
      14,
      NESColors.lightBlue,
      0.5,
      0
    );

    // Create weapon panels
    const weaponYStart = 80;
    const weaponSpacing = 30;
    
    // Left side weapons panel (player)
    this.weaponsPanelLeft = this.scene.add.container(20, weaponYStart);
    
    this.uiContainer.add(this.weaponsPanelLeft);
    
    // Left side weapons (player) - relative to panel
    for (let i = 0; i < 6; i++) {
      const weaponUI = createTextWithShadow(
        this.scene,
        this.weaponsPanelLeft,
        0,
        i * weaponSpacing,
        '',
        14,
        NESColors.white,
        0,
        0
      );
      this.weaponTextsLeft.push(weaponUI);
    }
    
    // Right side weapons panel (bot/player 2)
    this.weaponsPanelRight = this.scene.add.container(screenWidth - 20, weaponYStart);
    
    this.uiContainer.add(this.weaponsPanelRight);
    
    // Right side weapons (bot/player 2) - relative to panel
    for (let i = 0; i < 6; i++) {
      const weaponUI = createTextWithShadow(
        this.scene,
        this.weaponsPanelRight,
        0,
        i * weaponSpacing,
        '',
        14,
        NESColors.white,
        1,
        0
      );
      this.weaponTextsRight.push(weaponUI);
    }
  }

  /**
   * Update UI with current game state
   */
  public update(
    currentTank: Tank | undefined,
    currentPlayerIndex: number,
    gameMode: GameMode,
    currentLevelIndex: number,
    allTanks?: Tank[]
  ): void {
    if (!currentTank || !currentTank.isAlive()) {
      return;
    }

    let modeText = '1 Player';
    if (gameMode === GameMode.Multiplayer) {
      modeText = 'Multiplayer';
    } else if (gameMode === GameMode.Local) {
      modeText = '2 Players';
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

    // Update weapons list for all tanks
    if (allTanks && allTanks.length >= 2) {
      // Left side: player (tank 0)
      if (allTanks[0] && allTanks[0].isAlive()) {
        this.updateWeaponsList(allTanks[0], this.weaponTextsLeft, false);
      }
      
      // Right side: bot/player 2 (tank 1)
      if (allTanks[1] && allTanks[1].isAlive()) {
        this.updateWeaponsList(allTanks[1], this.weaponTextsRight, true);
      }
    } else {
      // Fallback: only show current tank on left
      this.updateWeaponsList(currentTank, this.weaponTextsLeft, false);
    }
  }

  /**
   * Update weapons list with ammunition counts
   */
  private updateWeaponsList(
    currentTank: Tank,
    weaponTexts: { text: Phaser.GameObjects.BitmapText; shadow: Phaser.GameObjects.BitmapText }[],
    isRightPanel: boolean = false
  ): void {
    const weapons = this.availableWeapons.length > 0 ? this.availableWeapons : [
      'standard', 
      'salvo', 
      'hazelnut', 
      'bouncing',
      'shield_single_use',
      'shield_multi_use'
    ];
    const currentWeapon = currentTank.getWeapon();
    
    // Hide/show weapon panels based on available weapons
    for (let i = 0; i < weaponTexts.length; i++) {
      const weaponUI = weaponTexts[i];
      if (i < weapons.length) {
        weaponUI.text.setVisible(true);
        weaponUI.shadow.setVisible(true);
      } else {
        weaponUI.text.setVisible(false);
        weaponUI.shadow.setVisible(false);
      }
    }
    
    weapons.forEach((weapon, index) => {
      let name: string;
      let ammo: number;
      
      // Get name and ammo based on type
      if (weapon === 'shield_single_use' || weapon === 'shield_multi_use') {
        // For shields, get name from ShieldFactory
        const shield = ShieldFactory.getShield(weapon as ShieldType);
        name = shield.getShieldConfig().name;
        ammo = currentTank.getAmmo(weapon);
      } else {
        // For weapons, get from WeaponFactory
        const weaponInstance = WeaponFactory.getWeapon(weapon as WeaponType);
        name = weaponInstance.name;
        ammo = currentTank.getAmmo(weapon);
      }
      
      const ammoText = ammo === -1 ? 'INF' : `x${ammo}`;
      const isCurrent = weapon === currentWeapon;
      const hasAmmo = ammo === -1 || ammo > 0;
      
      // Check if shield is active
      const activeShield = currentTank.getActiveShield();
      const isShieldActive = activeShield && activeShield.isActive() && activeShield.getType() === weapon;
      const shieldHP = isShieldActive ? ` (HP: ${activeShield.getCurrentHP()}/${activeShield.getMaxHP()})` : '';
      
      // Format text - for right panel, put number at the end
      let text: string;
      if (isRightPanel) {
        text = `${name}: ${ammoText}${shieldHP} [${index + 1}]`;
      } else {
        text = `[${index + 1}] ${name}: ${ammoText}${shieldHP}`;
      }
      
      // Choose color based on state
      let color: number;
      if (!hasAmmo) {
        color = 0x555555; // Dark gray - no ammo
      } else if (isCurrent) {
        color = 0x00ff00; // Bright green - current weapon/shield
      } else if (isShieldActive) {
        color = 0x00aaff; // Blue - active shield
      } else {
        color = 0xffffff; // White - available
      }
      
      // Update text
      const weaponUI = weaponTexts[index];
      weaponUI.text.setText(text);
      weaponUI.shadow.setText(text);
      weaponUI.text.setTintFill(color);
      
      // Make selected weapon/shield bolder by increasing font size slightly
      if (isCurrent) {
        weaponUI.text.setFontSize(15); // Slightly larger for bold effect
        weaponUI.shadow.setFontSize(15);
      } else {
        weaponUI.text.setFontSize(14); // Normal size
        weaponUI.shadow.setFontSize(14);
      }
    });
  }

  /**
   * Clean up Phaser objects
   */
  public destroy(): void {
    if (this.uiContainer) {
      this.uiContainer.destroy(true);
    }
    // BitmapText objects are destroyed with container
  }
}

