import Phaser from 'phaser';
import { type AIDifficulty } from '@/types';
import {
  createNESContainer,
  createTextWithShadow,
  createSectionTitle,
  createNESBackground,
  NESColors,
} from '@/utils/NESUI';
import { AudioSystem } from '@/systems/AudioSystem';

interface MenuOption {
  text: string;
  callback: () => void;
}

/**
 * Main menu scene in Famicom/NES style
 */
export class MenuScene extends Phaser.Scene {
  private menuOptions: MenuOption[] = [];
  private selectedIndex: number = 0;
  private menuTexts: Phaser.GameObjects.BitmapText[] = [];
  private cursorSprite!: Phaser.GameObjects.Sprite;
  private blinkTimer: Phaser.Time.TimerEvent | null = null;
  private audioSystem!: AudioSystem;
  private isDifficultyMenu: boolean = false;
  private difficultyOptions: MenuOption[] = [];
  private difficultyTexts: Phaser.GameObjects.BitmapText[] = [];
  private difficultyMenuContainer: Phaser.GameObjects.Container | null = null;
  private mainMenuContainer: Phaser.GameObjects.Container | null = null;
  private cursorGraphics?: Phaser.GameObjects.Graphics;

  constructor() {
    super({ key: 'MenuScene' });
  }

  init(data?: { showDifficultyMenu?: boolean; selectedDifficulty?: AIDifficulty }): void {
    // If returning from LevelSelectScene, show difficulty menu
    if (data?.showDifficultyMenu) {
      this.isDifficultyMenu = true;
      // Set selected index based on difficulty
      const difficultyIndex = data.selectedDifficulty === 'easy' ? 0 : data.selectedDifficulty === 'medium' ? 1 : 2;
      this.selectedIndex = difficultyIndex;
    } else {
      this.isDifficultyMenu = false;
      this.selectedIndex = 0;
    }
  }

  create(): void {
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;

    // Initialize audio system
    this.audioSystem = new AudioSystem();

    // Create NES-style background
    createNESBackground(this, width, height);

    // Create pixelated title
    this.createTitle(width, height);

    // Define menu options
    this.menuOptions = [
      { text: 'SINGLEPLAYER', callback: () => this.showDifficultyMenu() },
      { text: 'LOCAL MULTIPLAYER', callback: () => this.startLocalMultiplayer() },
      { text: 'P2P MULTIPLAYER', callback: () => this.startMultiplayer() },
      { text: 'QUIT', callback: () => this.quitGame() },
    ];

    // Define difficulty options (difficulties first, then BACK at the bottom)
    this.difficultyOptions = [
      { text: 'EASY', callback: () => this.showLevelSelect('easy') },
      { text: 'MEDIUM', callback: () => this.showLevelSelect('medium') },
      { text: 'HARD', callback: () => this.showLevelSelect('hard') },
      { text: 'BACK', callback: () => this.hideDifficultyMenu() },
    ];

    // Create menu with NES style (raised higher on screen)
    this.createNESMenu(width / 2, height / 2 + 40);

    // Add copyright/attribution notice
    this.createCopyrightNotice(width, height);

    // Setup keyboard controls
    this.input.keyboard!.on('keydown-UP', this.moveSelectionUp, this);
    this.input.keyboard!.on('keydown-DOWN', this.moveSelectionDown, this);
    this.input.keyboard!.on('keydown-ENTER', this.selectOption, this);
    this.input.keyboard!.on('keydown-SPACE', this.selectOption, this);

    // If difficulty menu should be shown, create it now
    if (this.isDifficultyMenu) {
      // Hide main menu container
      if (this.mainMenuContainer) {
        this.mainMenuContainer.setVisible(false);
      }
      if (this.cursorGraphics) {
        // Сбрасываем альфу перед скрытием, чтобы при показе курсор был ярким
        this.cursorGraphics.setAlpha(1);
        this.cursorGraphics.setVisible(false);
      }
      
      // Create difficulty menu
      this.createDifficultyMenu(width / 2, height / 2 + 40);
    }

    // Update menu display
    this.updateMenuDisplay();

    // Create blinking cursor animation
    this.createCursorAnimation();

    // Play menu music (if loaded)
    this.audioSystem.playMenuMusic(this);
  }


  /**
   * Create copyright/attribution notice
   */
  private createCopyrightNotice(width: number, height: number): void {
    const nesGray = 0x95a5a6;
    
    // Copyright text at the bottom
    const copyrightText = 'Music: "Arcade Puzzler" by Eric Matyas';
    const websiteText = 'www.soundimage.org';
    
    // Position at bottom with some padding
    const copyrightY = height - 40;
    const websiteY = height - 20;
    
    // Create root container for copyright elements
    const copyrightContainer = this.add.container(0, 0);
    
    // Copyright text with shadow (NES style)
    createTextWithShadow(
      this,
      copyrightContainer,
      width / 2,
      copyrightY,
      copyrightText,
      12,
      nesGray,
      0.5,
      0.5
    );
    
    // Website text with shadow (NES style)
    createTextWithShadow(
      this,
      copyrightContainer,
      width / 2,
      websiteY,
      websiteText,
      12,
      nesGray,
      0.5,
      0.5
    );
  }


  /**
   * Create pixelated title in NES style
   */
  private createTitle(width: number, height: number): void {
    const titleY = height / 6;
    const nesRed = 0xe74c3c;
    const nesYellow = 0xf1c40f;
    const nesWhite = 0xffffff;
    
    // Create root container for title elements
    const titleContainer = this.add.container(0, 0);
    
    // Main title with shadow effect (NES style) - using bitmap font
    createTextWithShadow(
      this,
      titleContainer,
      width / 2,
      titleY,
      'ARTILLERY BATTLE',
      48,
      nesRed,
      0.5,
      0.5
    );

    // Subtitle with NES colors
    createTextWithShadow(
      this,
      titleContainer,
      width / 2,
      titleY + 60,
      'A Scorched Earth Clone',
      20,
      nesYellow,
      0.5,
      0.5
    );

    // Version badge
    // Graphics coordinates inside container are relative to container center (0, 0)
    // Badge center should be at (width/2, titleY + 90) relative to container center
    // fillRoundedRect uses top-left corner, so we need: centerX - width/2, centerY - height/2
    const badgeCenterX = width / 2;
    const badgeCenterY = titleY + 90;
    const badgeWidth = 100;
    const badgeHeight = 25;
    const versionBg = this.add.graphics();
    versionBg.fillStyle(NESColors.gray);
    versionBg.fillRoundedRect(
      badgeCenterX - badgeWidth / 2,  // Relative to container center
      badgeCenterY - badgeHeight / 2, // Relative to container center
      badgeWidth,
      badgeHeight,
      5
    );
    titleContainer.add(versionBg);
    
    createTextWithShadow(
      this,
      titleContainer,
      width / 2,
      titleY + 102,
      'v1.0',
      14,
      nesWhite,
      0.5,
      0.5
    );
  }

  /**
   * Create NES-style menu
   */
  private createNESMenu(x: number, y: number): void {
    // Increased width to accommodate longer text like "LOCAL MULTIPLAYER" and "P2P MULTIPLAYER"
    const boxWidth = 550;
    const boxHeight = this.menuOptions.length * 50 + 40;
    const padding = 40; // Increased padding from edges for better visual spacing

    // Create menu box with NES-style border
    const boxContainer = createNESContainer(this, x, y, boxWidth, boxHeight);
    boxContainer.setDepth(100); // Set depth below cursor (cursor is 1000)
    this.mainMenuContainer = boxContainer; // Save reference to hide/show later

    // Title text with shadow (bitmap font)
    createSectionTitle(this, boxContainer, 0, -boxHeight / 2 - 30, 'SELECT MODE', 20);

    // Create cursor sprite (will be positioned in updateMenuDisplay)
    this.createCursorSprite(0, 0);

    // Create menu option texts (left-aligned)
    const textOffsetX = -boxWidth / 2 + padding + 60; // Position after cursor (20px cursor + 40px spacing)
    const nesWhite = NESColors.white;
    
    this.menuOptions.forEach((option, index) => {
      const optionY = -boxHeight / 2 + 50 + index * 50;
      
      // Text shadow for depth (left-aligned) - bitmap font
      const { text: menuText } = createTextWithShadow(
        this,
        boxContainer,
        textOffsetX,
        optionY,
        option.text,
        24,
        nesWhite,
        0,
        0.5
      );

      // Make text interactive for mouse clicks
      menuText.setInteractive({ useHandCursor: true });
      
      // Handle mouse hover
      menuText.on('pointerover', () => {
        this.selectedIndex = index;
        this.updateMenuDisplay();
        try {
          this.sound.play('menu-move', { volume: 0.3 });
        } catch {
          // Sound not available, ignore
        }
      });
      
      // Handle mouse click
      menuText.on('pointerdown', () => {
        this.selectOption();
      });

      this.menuTexts.push(menuText);
    });
  }

  /**
   * Create cursor sprite (arrow pointing right)
   */
  private createCursorSprite(x: number, y: number): void {
    // Create a simple arrow using graphics
    const cursorGraphics = this.add.graphics();
    cursorGraphics.fillStyle(0xf1c40f); // Yellow
    cursorGraphics.lineStyle(2, 0x000000);
    
    // Draw arrow pointing right (triangle) - centered vertically
    // Arrow is 20px wide and 16px tall, centered at (0, 0)
    cursorGraphics.beginPath();
    cursorGraphics.moveTo(0, -8);  // Top point
    cursorGraphics.lineTo(20, 0);   // Right point (tip)
    cursorGraphics.lineTo(0, 8);     // Bottom point
    cursorGraphics.closePath();
    cursorGraphics.fillPath();
    cursorGraphics.strokePath();

    this.cursorSprite = this.add.sprite(x, y, '__WHITE');
    this.cursorSprite.setVisible(false); // We'll use graphics instead
    
    // Store graphics for cursor
    this.cursorGraphics = cursorGraphics;
    cursorGraphics.setPosition(x, y);
    // Set high depth to ensure cursor is always on top of menu containers
    cursorGraphics.setDepth(1000);
  }

  /**
   * Update menu display with current selection
   */
  private updateMenuDisplay(): void {
    const nesWhite = NESColors.white;
    const nesYellow = NESColors.yellow;

    const currentOptions = this.isDifficultyMenu ? this.difficultyOptions : this.menuOptions;
    const currentTexts = this.isDifficultyMenu ? this.difficultyTexts : this.menuTexts;

    const boxWidth = 550;
    const boxHeight = currentOptions.length * 50 + 40;
    const padding = 40; // Match padding from createNESMenu
    const menuX = this.cameras.main.width / 2;
    // Both menus are positioned at the same height
    const menuY = this.cameras.main.height / 2 + 40;
    const cursorX = menuX - boxWidth / 2 + padding;
    const baseCursorY = menuY - boxHeight / 2 + 50;

    // Update cursor position
    if (this.cursorGraphics) {
      // Сбрасываем альфу курсора при каждом обновлении отображения
      this.cursorGraphics.setAlpha(1);
      this.cursorGraphics.setPosition(cursorX, baseCursorY + this.selectedIndex * 50);
      this.cursorGraphics.setVisible(true);
      // Ensure cursor depth is always on top
      this.cursorGraphics.setDepth(1000);
    }

    // Update text colors (bitmap text uses setTintFill)
    currentTexts.forEach((text, index) => {
      if (index === this.selectedIndex) {
        // Selected option: yellow
        text.setTintFill(nesYellow);
      } else {
        // Unselected option: white
        text.setTintFill(nesWhite);
      }
    });
  }

  /**
   * Create blinking cursor animation
   */
  private createCursorAnimation(): void {
    if (this.cursorGraphics) {
      this.blinkTimer = this.time.addEvent({
        delay: 500,
        callback: () => {
          if (this.cursorGraphics) {
            this.cursorGraphics.setAlpha(this.cursorGraphics.alpha === 1 ? 0.3 : 1);
          }
        },
        loop: true,
      });
    }
  }

  /**
   * Move selection up
   */
  private moveSelectionUp(): void {
    const currentOptions = this.isDifficultyMenu ? this.difficultyOptions : this.menuOptions;
    this.selectedIndex = (this.selectedIndex - 1 + currentOptions.length) % currentOptions.length;
    this.updateMenuDisplay();
    // Play sound effect if available
    try {
      this.sound.play('menu-move', { volume: 0.3 });
    } catch {
      // Sound not available, ignore
    }
  }

  /**
   * Move selection down
   */
  private moveSelectionDown(): void {
    const currentOptions = this.isDifficultyMenu ? this.difficultyOptions : this.menuOptions;
    this.selectedIndex = (this.selectedIndex + 1) % currentOptions.length;
    this.updateMenuDisplay();
    // Play sound effect if available
    try {
      this.sound.play('menu-move', { volume: 0.3 });
    } catch {
      // Sound not available, ignore
    }
  }

  /**
   * Select current option
   */
  private selectOption(): void {
    const currentOptions = this.isDifficultyMenu ? this.difficultyOptions : this.menuOptions;
    
    if (currentOptions[this.selectedIndex]) {
      // Play sound effect if available
      try {
        this.sound.play('menu-select', { volume: 0.5 });
      } catch {
        // Sound not available, ignore
      }
      currentOptions[this.selectedIndex].callback();
    }
  }

  /**
   * Show difficulty selection menu
   */
  private showDifficultyMenu(): void {
    this.isDifficultyMenu = true;
    this.selectedIndex = 1; // Default to MEDIUM (index 1: EASY=0, MEDIUM=1, HARD=2, BACK=3)
    
    // Clean up any existing difficulty menu
    if (this.difficultyMenuContainer) {
      this.difficultyMenuContainer.destroy();
      this.difficultyMenuContainer = null;
    }
    this.difficultyTexts = [];
    
    // Hide main menu container (includes background and all texts)
    if (this.mainMenuContainer) {
      this.mainMenuContainer.setVisible(false);
    }
    if (this.cursorGraphics) {
      // Сбрасываем альфу перед скрытием, чтобы при показе курсор был ярким
      this.cursorGraphics.setAlpha(1);
      this.cursorGraphics.setVisible(false);
    }
    
    // Create difficulty menu
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;
    this.createDifficultyMenu(width / 2, height / 2 + 40);
    
    this.updateMenuDisplay();
  }

  /**
   * Hide difficulty menu and return to main menu
   */
  private hideDifficultyMenu(): void {
    this.isDifficultyMenu = false;
    this.selectedIndex = 0;
    
    // Destroy difficulty menu container (includes all texts and graphics)
    if (this.difficultyMenuContainer) {
      this.difficultyMenuContainer.destroy();
      this.difficultyMenuContainer = null;
    }
    
    // Clear difficulty texts array
    this.difficultyTexts = [];
    
    // Show main menu container (includes background and all texts)
    if (this.mainMenuContainer) {
      this.mainMenuContainer.setVisible(true);
    }
    
    this.updateMenuDisplay();
  }

  /**
   * Create difficulty selection menu
   */
  private createDifficultyMenu(x: number, y: number): void {
    const boxWidth = 550;
    const boxHeight = this.difficultyOptions.length * 50 + 40;
    const padding = 40; // Match padding from createNESMenu

    // Create menu box with NES-style border
    const boxContainer = createNESContainer(this, x, y, boxWidth, boxHeight);
    boxContainer.setDepth(100); // Set depth below cursor (cursor is 1000)
    this.difficultyMenuContainer = boxContainer;

    // Title text with shadow (bitmap font)
    createSectionTitle(this, boxContainer, 0, -boxHeight / 2 - 30, 'SELECT DIFFICULTY', 20);

    // Create menu option texts (left-aligned)
    const textOffsetX = -boxWidth / 2 + padding + 60;
    const nesWhite = NESColors.white;
    
    this.difficultyOptions.forEach((option, index) => {
      const optionY = -boxHeight / 2 + 50 + index * 50;
      
      // Text shadow for depth (left-aligned) - bitmap font
      const { text: menuText } = createTextWithShadow(
        this,
        boxContainer,
        textOffsetX,
        optionY,
        option.text,
        24,
        nesWhite,
        0,
        0.5
      );

      // Make text interactive for mouse clicks
      menuText.setInteractive({ useHandCursor: true });
      
      // Handle mouse hover
      menuText.on('pointerover', () => {
        this.selectedIndex = index;
        this.updateMenuDisplay();
        try {
          this.sound.play('menu-move', { volume: 0.3 });
        } catch {
          // Sound not available, ignore
        }
      });
      
      // Handle mouse click
      menuText.on('pointerdown', () => {
        this.selectOption();
      });

      this.difficultyTexts.push(menuText);
    });
  }

  /**
   * Show level selection screen for singleplayer
   */
  private showLevelSelect(difficulty: AIDifficulty): void {
    // Don't stop music - let LevelSelectScene continue playing it
    this.scene.start('LevelSelectScene', {
      difficulty: difficulty,
    });
  }


  /**
   * Start multiplayer lobby
   */
  private startMultiplayer(): void {
    // Stop menu music before going to multiplayer
    this.audioSystem.stopMenuMusic();
    
    this.scene.start('MultiplayerLobbyScene');
  }

  /**
   * Start local multiplayer (2 players on same computer)
   */
  private startLocalMultiplayer(): void {
    // Don't stop music - let LevelEditorScene continue playing it
    this.scene.start('LevelEditorScene');
  }


  /**
   * Quit game (close window/tab)
   */
  private quitGame(): void {
    // In browser, we can't really "quit", but we can show a message
    if (confirm('Are you sure you want to quit?')) {
      window.close();
    }
  }

  shutdown(): void {
    // Clean up keyboard listeners
    this.input.keyboard?.off('keydown-UP', this.moveSelectionUp, this);
    this.input.keyboard?.off('keydown-DOWN', this.moveSelectionDown, this);
    this.input.keyboard?.off('keydown-ENTER', this.selectOption, this);
    this.input.keyboard?.off('keydown-SPACE', this.selectOption, this);
    
    // Clean up timer
    if (this.blinkTimer) {
      this.blinkTimer.destroy();
    }

    // Stop menu music when leaving menu
    if (this.audioSystem) {
      this.audioSystem.stopMenuMusic();
    }
  }
}
