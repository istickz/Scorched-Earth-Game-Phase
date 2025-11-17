import Phaser from 'phaser';
import { GameMode, type AIDifficulty } from '@/types';

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
  private menuMusic!: Phaser.Sound.BaseSound | null;
  private isDifficultyMenu: boolean = false;
  private difficultyOptions: MenuOption[] = [];
  private difficultyTexts: Phaser.GameObjects.BitmapText[] = [];
  private difficultyMenuContainer: Phaser.GameObjects.Container | null = null;
  private mainMenuContainer: Phaser.GameObjects.Container | null = null;
  private cursorGraphics?: Phaser.GameObjects.Graphics;

  constructor() {
    super({ key: 'MenuScene' });
  }

  create(): void {
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;

    // Create NES-style background
    this.createNESBackground(width, height);

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
      { text: 'EASY', callback: () => this.startGame(GameMode.Solo, 'easy') },
      { text: 'MEDIUM', callback: () => this.startGame(GameMode.Solo, 'medium') },
      { text: 'HARD', callback: () => this.startGame(GameMode.Solo, 'hard') },
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

    // Update menu display
    this.updateMenuDisplay();

    // Create blinking cursor animation
    this.createCursorAnimation();

    // Play menu music (if loaded)
    this.playMenuMusic();
  }

  /**
   * Play menu music in cracktro/demoscene style
   */
  private playMenuMusic(): void {
    try {
      // Check if music was loaded in cache
      if (this.cache.audio.exists('menu-music')) {
        // If music exists but is stopped, restart it
        if (this.menuMusic) {
          if (this.menuMusic.isPlaying) {
            console.log('Menu music already playing');
            return;
          } else {
            // Music was stopped, restart it
            this.menuMusic.play();
            console.log('Menu music restarted');
            return;
          }
        }
        
        // Create new music instance
        this.menuMusic = this.sound.add('menu-music', {
          volume: 0.5, // Adjust volume (0.0 to 1.0)
          loop: true,  // Loop the music
        });
        
        // Play music
        this.menuMusic.play();
        console.log('Menu music started');
      } else {
        console.warn('Menu music not found in cache. Make sure file is in public/assets/sounds/arcade_puzzler.ogg');
        console.log('Available audio files:', this.cache.audio.getKeys());
      }
    } catch (error) {
      // Music not loaded or error playing
      console.error('Error playing menu music:', error);
    }
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
    
    // Copyright text with shadow (NES style)
    const copyrightShadow = this.add.bitmapText(width / 2 + 1, copyrightY + 1, 'pixel-font', copyrightText, 12);
    copyrightShadow.setTintFill(0x000000);
    copyrightShadow.setOrigin(0.5, 0.5);
    
    const copyright = this.add.bitmapText(width / 2, copyrightY, 'pixel-font', copyrightText, 12);
    copyright.setTintFill(nesGray);
    copyright.setOrigin(0.5, 0.5);
    
    // Website text with shadow (NES style)
    const websiteShadow = this.add.bitmapText(width / 2 + 1, websiteY + 1, 'pixel-font', websiteText, 12);
    websiteShadow.setTintFill(0x000000);
    websiteShadow.setOrigin(0.5, 0.5);
    
    const website = this.add.bitmapText(width / 2, websiteY, 'pixel-font', websiteText, 12);
    website.setTintFill(nesGray);
    website.setOrigin(0.5, 0.5);
  }

  /**
   * Create NES-style background
   */
  private createNESBackground(width: number, height: number): void {
    // Create gradient-like effect with rectangles
    const bgGraphics = this.add.graphics();
    
    // Dark blue base
    bgGraphics.fillStyle(0x2c3e50);
    bgGraphics.fillRect(0, 0, width, height);

    // Add some pattern for NES feel
    for (let y = 0; y < height; y += 4) {
      if (y % 8 === 0) {
        bgGraphics.fillStyle(0x34495e);
        bgGraphics.fillRect(0, y, width, 2);
      }
    }
  }

  /**
   * Create pixelated title in NES style
   */
  private createTitle(width: number, height: number): void {
    const titleY = height / 6;
    const nesRed = 0xe74c3c;
    const nesYellow = 0xf1c40f;
    const nesWhite = 0xffffff;
    
    // Main title with shadow effect (NES style) - using bitmap font
    const titleShadow = this.add.bitmapText(width / 2 + 4, titleY + 4, 'pixel-font', 'ARTILLERY BATTLE', 48);
    titleShadow.setTintFill(0x000000);
    titleShadow.setOrigin(0.5);

    const title = this.add.bitmapText(width / 2, titleY, 'pixel-font', 'ARTILLERY BATTLE', 48);
    title.setTintFill(nesRed);
    title.setOrigin(0.5);

    // Subtitle with NES colors
    const subtitleShadow = this.add.bitmapText(width / 2 + 2, titleY + 60 + 2, 'pixel-font', 'A Scorched Earth Clone', 20);
    subtitleShadow.setTintFill(0x000000);
    subtitleShadow.setOrigin(0.5);

    const subtitle = this.add.bitmapText(width / 2, titleY + 60, 'pixel-font', 'A Scorched Earth Clone', 20);
    subtitle.setTintFill(nesYellow);
    subtitle.setOrigin(0.5);

    // Version badge
    const versionBg = this.add.graphics();
    versionBg.fillStyle(0x34495e);
    versionBg.fillRoundedRect(width / 2 - 50, titleY + 90, 100, 25, 5);
    
    const versionShadow = this.add.bitmapText(width / 2 + 1, titleY + 102 + 1, 'pixel-font', 'v1.0', 14);
    versionShadow.setTintFill(0x000000);
    versionShadow.setOrigin(0.5);
    
    const version = this.add.bitmapText(width / 2, titleY + 102, 'pixel-font', 'v1.0', 14);
    version.setTintFill(nesWhite);
    version.setOrigin(0.5);

    this.add.container(0, 0, [titleShadow, title, subtitleShadow, subtitle, versionBg, versionShadow, version]);
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
    const boxContainer = this.add.container(x, y);
    this.mainMenuContainer = boxContainer; // Save reference to hide/show later

    // Background box
    const bgGraphics = this.add.graphics();
    bgGraphics.fillStyle(0x34495e, 0.8);
    bgGraphics.fillRoundedRect(-boxWidth / 2, -boxHeight / 2, boxWidth, boxHeight, 8);
    bgGraphics.lineStyle(3, 0x3498db);
    bgGraphics.strokeRoundedRect(-boxWidth / 2, -boxHeight / 2, boxWidth, boxHeight, 8);
    
    // Inner border
    bgGraphics.lineStyle(1, 0x5dade2);
    bgGraphics.strokeRoundedRect(-boxWidth / 2 + 4, -boxHeight / 2 + 4, boxWidth - 8, boxHeight - 8, 6);

    boxContainer.add(bgGraphics);

    // Title text with shadow (bitmap font)
    const nesWhite = 0xffffff;
    const titleShadow = this.add.bitmapText(2, -boxHeight / 2 - 30 + 2, 'pixel-font', 'SELECT MODE', 20);
    titleShadow.setTintFill(0x000000);
    titleShadow.setOrigin(0.5, 0.5);
    
    const titleText = this.add.bitmapText(0, -boxHeight / 2 - 30, 'pixel-font', 'SELECT MODE', 20);
    titleText.setTintFill(nesWhite);
    titleText.setOrigin(0.5, 0.5);
    boxContainer.add([titleShadow, titleText]);

    // Create cursor sprite (will be positioned in updateMenuDisplay)
    this.createCursorSprite(0, 0);

    // Create menu option texts (left-aligned)
    const textOffsetX = -boxWidth / 2 + padding + 60; // Position after cursor (20px cursor + 40px spacing)
    
    this.menuOptions.forEach((option, index) => {
      const optionY = -boxHeight / 2 + 50 + index * 50;
      
      // Text shadow for depth (left-aligned) - bitmap font
      const textShadow = this.add.bitmapText(textOffsetX + 2, optionY + 2, 'pixel-font', option.text, 24);
      textShadow.setTintFill(0x000000);
      textShadow.setOrigin(0, 0.5);

      const menuText = this.add.bitmapText(textOffsetX, optionY, 'pixel-font', option.text, 24);
      menuText.setTintFill(nesWhite);
      menuText.setOrigin(0, 0.5);

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

      boxContainer.add([textShadow, menuText]);
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
  }

  /**
   * Update menu display with current selection
   */
  private updateMenuDisplay(): void {
    const nesWhite = 0xffffff;
    const nesYellow = 0xf1c40f;

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
      this.cursorGraphics.setPosition(cursorX, baseCursorY + this.selectedIndex * 50);
      this.cursorGraphics.setVisible(true);
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
    const boxContainer = this.add.container(x, y);
    this.difficultyMenuContainer = boxContainer;

    // Background box
    const bgGraphics = this.add.graphics();
    bgGraphics.fillStyle(0x34495e, 0.8);
    bgGraphics.fillRoundedRect(-boxWidth / 2, -boxHeight / 2, boxWidth, boxHeight, 8);
    bgGraphics.lineStyle(3, 0x3498db);
    bgGraphics.strokeRoundedRect(-boxWidth / 2, -boxHeight / 2, boxWidth, boxHeight, 8);
    
    // Inner border
    bgGraphics.lineStyle(1, 0x5dade2);
    bgGraphics.strokeRoundedRect(-boxWidth / 2 + 4, -boxHeight / 2 + 4, boxWidth - 8, boxHeight - 8, 6);

    boxContainer.add(bgGraphics);

    // Title text with shadow (bitmap font)
    const nesWhite = 0xffffff;
    const titleShadow = this.add.bitmapText(2, -boxHeight / 2 - 30 + 2, 'pixel-font', 'SELECT DIFFICULTY', 20);
    titleShadow.setTintFill(0x000000);
    titleShadow.setOrigin(0.5, 0.5);
    
    const titleText = this.add.bitmapText(0, -boxHeight / 2 - 30, 'pixel-font', 'SELECT DIFFICULTY', 20);
    titleText.setTintFill(nesWhite);
    titleText.setOrigin(0.5, 0.5);
    boxContainer.add([titleShadow, titleText]);

    // Create menu option texts (left-aligned)
    const textOffsetX = -boxWidth / 2 + padding + 60;
    
    this.difficultyOptions.forEach((option, index) => {
      const optionY = -boxHeight / 2 + 50 + index * 50;
      
      // Text shadow for depth (left-aligned) - bitmap font
      const textShadow = this.add.bitmapText(textOffsetX + 2, optionY + 2, 'pixel-font', option.text, 24);
      textShadow.setTintFill(0x000000);
      textShadow.setOrigin(0, 0.5);

      const menuText = this.add.bitmapText(textOffsetX, optionY, 'pixel-font', option.text, 24);
      menuText.setTintFill(nesWhite);
      menuText.setOrigin(0, 0.5);

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

      boxContainer.add([textShadow, menuText]);
      this.difficultyTexts.push(menuText);
    });
  }

  /**
   * Start the game with the selected mode and difficulty
   */
  private startGame(mode: GameMode, difficulty: AIDifficulty = 'medium'): void {
    // Stop menu music before starting game
    this.stopMenuMusic();
    
    // Pass game mode and difficulty to GameScene
    this.scene.start('GameScene', {
      gameMode: mode,
      aiDifficulty: difficulty,
    });
  }

  /**
   * Start multiplayer lobby
   */
  private startMultiplayer(): void {
    // Stop menu music before going to multiplayer
    this.stopMenuMusic();
    
    this.scene.start('MultiplayerLobbyScene');
  }

  /**
   * Start local multiplayer (2 players on same computer)
   */
  private startLocalMultiplayer(): void {
    // Don't stop music - let LevelSelectScene continue playing it
    this.scene.start('LevelSelectScene');
  }

  /**
   * Stop menu music
   */
  private stopMenuMusic(): void {
    if (this.menuMusic) {
      if (this.menuMusic.isPlaying) {
        this.menuMusic.stop();
      }
      // Don't destroy the sound object, just stop it
      // It will be reused when returning to menu
    }
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
    this.stopMenuMusic();
  }
}
