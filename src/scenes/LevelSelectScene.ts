import Phaser from 'phaser';
import { GameMode, type AIDifficulty } from '@/types';
import { SINGLEPLAYER_LEVELS } from '@/config/levels';
import { ProgressManager } from '@/utils/ProgressManager';
import {
  createNESContainer,
  createTextWithShadow,
  createNESButton,
  createNESMenuButton,
  NESColors,
} from '@/utils/NESUI';

/**
 * Level selection scene - shows grid of levels with locked/unlocked status
 */
export class LevelSelectScene extends Phaser.Scene {
  private difficulty!: AIDifficulty;
  private levelButtons: Phaser.GameObjects.Container[] = [];
  private menuMusic!: Phaser.Sound.BaseSound | null;

  constructor() {
    super({ key: 'LevelSelectScene' });
  }

  init(data: { difficulty: AIDifficulty }): void {
    this.difficulty = data?.difficulty || 'medium';
  }

  create(): void {
    const screenWidth = this.cameras.main.width;
    const screenHeight = this.cameras.main.height;

    // Create NES-style background
    this.createNESBackground(screenWidth, screenHeight);

    // Create title
    this.createTitle(screenWidth);

    // Create level grid
    this.createLevelGrid(screenWidth, screenHeight);

    // Create back button
    this.createBackButton(screenWidth, screenHeight);

    // Play menu music
    this.playMenuMusic();

    // Setup keyboard controls
    this.setupKeyboardControls();
  }

  /**
   * Create NES-style background
   */
  private createNESBackground(width: number, height: number): void {
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
   * Create title
   */
  private createTitle(width: number): void {
    const titleY = 80;
    const nesRed = 0xe74c3c;
    
    const titleContainer = this.add.container(0, 0);
    
    // Main title
    createTextWithShadow(
      this,
      titleContainer,
      width / 2,
      titleY,
      'SELECT LEVEL',
      32,
      nesRed,
      0.5,
      0.5
    );

    // Difficulty subtitle
    const difficultyText = this.difficulty.toUpperCase();
    createTextWithShadow(
      this,
      titleContainer,
      width / 2,
      titleY + 50,
      `Difficulty: ${difficultyText}`,
      18,
      NESColors.yellow,
      0.5,
      0.5
    );

    // Progress info
    const completedCount = ProgressManager.getCompletedLevelsCount(this.difficulty);
    const totalLevels = SINGLEPLAYER_LEVELS.length;
    const progressText = `Progress: ${completedCount}/${totalLevels} levels completed`;
    createTextWithShadow(
      this,
      titleContainer,
      width / 2,
      titleY + 80,
      progressText,
      14,
      NESColors.white,
      0.5,
      0.5
    );
  }

  /**
   * Create level grid
   */
  private createLevelGrid(screenWidth: number, screenHeight: number): void {
    const gridStartY = 200;
    const gridWidth = Math.min(screenWidth * 0.9, 1200);
    const gridHeight = screenHeight - gridStartY - 120;
    
    const containerX = screenWidth / 2;
    const containerY = gridStartY + gridHeight / 2;
    
    const gridContainer = createNESContainer(this, containerX, containerY, gridWidth, gridHeight);
    
    // Calculate grid layout: 5 columns
    const cols = 5;
    const rows = Math.ceil(SINGLEPLAYER_LEVELS.length / cols);
    const buttonWidth = 180;
    const buttonHeight = 100;
    const spacing = 20;
    
    const totalGridWidth = cols * buttonWidth + (cols - 1) * spacing;
    const totalGridHeight = rows * buttonHeight + (rows - 1) * spacing;
    
    const startX = -totalGridWidth / 2 + buttonWidth / 2;
    const startY = -totalGridHeight / 2 + buttonHeight / 2;
    
    // Create level buttons
    for (let i = 0; i < SINGLEPLAYER_LEVELS.length; i++) {
      const row = Math.floor(i / cols);
      const col = i % cols;
      
      const x = startX + col * (buttonWidth + spacing);
      const y = startY + row * (buttonHeight + spacing);
      
      const isUnlocked = ProgressManager.isLevelUnlocked(this.difficulty, i);
      const isCompleted = ProgressManager.isLevelCompleted(this.difficulty, i);
      
      this.createLevelButton(
        gridContainer,
        x,
        y,
        buttonWidth,
        buttonHeight,
        i,
        isUnlocked,
        isCompleted
      );
    }
  }

  /**
   * Create a single level button
   */
  private createLevelButton(
    parent: Phaser.GameObjects.Container,
    x: number,
    y: number,
    width: number,
    height: number,
    levelIndex: number,
    isUnlocked: boolean,
    isCompleted: boolean
  ): void {
    const levelNumber = levelIndex + 1;
    
    // Button text
    let buttonText = `Level ${levelNumber}`;
    if (isCompleted) {
      buttonText += ' ✓';
    }
    
    // Button color based on status
    const backgroundColor = isUnlocked 
      ? (isCompleted ? NESColors.gray : NESColors.darkGray)
      : NESColors.black;
    
    const borderColor = isUnlocked
      ? (isCompleted ? NESColors.yellow : NESColors.blue)
      : NESColors.darkGray;
    
    const textColor = isUnlocked
      ? (isCompleted ? NESColors.yellow : NESColors.white)
      : NESColors.gray;
    
    // Create button
    const buttonResult = createNESButton(
      this,
      parent,
      {
        x,
        y,
        width,
        height,
        text: buttonText,
        onClick: () => {
          if (isUnlocked) {
            this.startLevel(levelIndex);
          } else {
            // Play error sound or show message
            try {
              this.sound.play('menu-move', { volume: 0.3 });
            } catch {
              // Sound not available
            }
          }
        },
        selected: false,
      }
    );
    
    // Override colors and disable hover effects for locked levels
    if (!isUnlocked) {
      // Remove all pointer events to disable hover effects
      buttonResult.bg.removeInteractive();
      
      // Redraw with locked style
      buttonResult.bg.clear();
      buttonResult.bg.fillStyle(backgroundColor, 0.5);
      buttonResult.bg.fillRoundedRect(-width / 2, -height / 2, width, height, 8);
      buttonResult.bg.lineStyle(2, borderColor, 0.5);
      buttonResult.bg.strokeRoundedRect(-width / 2, -height / 2, width, height, 8);
      
      if (buttonResult.textObj) {
        buttonResult.textObj.setTintFill(textColor);
      }
      
      // Re-enable interactive but with custom handler that does nothing
      buttonResult.bg.setInteractive({
        hitArea: new Phaser.Geom.Rectangle(-width / 2, -height / 2, width, height),
        hitAreaCallback: Phaser.Geom.Rectangle.Contains,
        useHandCursor: false, // No hand cursor for locked levels
      });
      
      // Override hover effects to do nothing
      buttonResult.bg.off('pointerover');
      buttonResult.bg.off('pointerout');
      buttonResult.bg.on('pointerdown', () => {
        // Play error sound
        try {
          this.sound.play('menu-move', { volume: 0.3 });
        } catch {
          // Sound not available
        }
      });
    }
    
    this.levelButtons.push(buttonResult.container);
  }

  /**
   * Start selected level
   */
  private startLevel(levelIndex: number): void {
    // Stop menu music
    this.stopMenuMusic();
    
    // Start game with selected level
    this.scene.start('GameScene', {
      gameMode: GameMode.Solo,
      aiDifficulty: this.difficulty,
      levelIndex: levelIndex,
    });
  }

  /**
   * Create back button
   */
  private createBackButton(screenWidth: number, screenHeight: number): void {
    const backButtonY = screenHeight - 60;
    
    const backContainer = this.add.container(0, 0);
    
    createNESMenuButton(
      this,
      backContainer,
      {
        x: screenWidth / 2,
        y: backButtonY,
        text: 'BACK',
        active: false,
        onClick: () => {
          // Return to difficulty selection menu
          this.scene.start('MenuScene', {
            showDifficultyMenu: true,
            selectedDifficulty: this.difficulty,
          });
        },
      }
    );
  }

  /**
   * Setup keyboard controls
   */
  private setupKeyboardControls(): void {
    this.input.keyboard?.on('keydown-ESCAPE', () => {
      // Return to difficulty selection menu
      this.scene.start('MenuScene', {
        showDifficultyMenu: true,
        selectedDifficulty: this.difficulty,
      });
    });
  }

  /**
   * Play menu music
   */
  private playMenuMusic(): void {
    try {
      if (this.cache.audio.exists('menu-music')) {
        // Check if music is already playing (from MenuScene)
        let existingMusic: Phaser.Sound.BaseSound | null = null;
        try {
          interface SoundManagerWithSounds extends Phaser.Sound.BaseSoundManager {
            sounds?: Phaser.Sound.BaseSound[];
          }
          const soundManager = this.sound as SoundManagerWithSounds;
          if (soundManager.sounds) {
            existingMusic = soundManager.sounds.find((sound: Phaser.Sound.BaseSound) => {
              return sound.key === 'menu-music' && sound.isPlaying;
            }) || null;
          }
        } catch {
          // Continue to create new instance
        }
        
        if (existingMusic) {
          this.menuMusic = existingMusic as Phaser.Sound.BaseSound;
          return;
        }
        
        if (this.menuMusic && this.menuMusic.isPlaying) {
          return;
        }
        
        this.menuMusic = this.sound.add('menu-music', {
          volume: 0.5,
          loop: true,
        });
        
        this.menuMusic.play();
      }
    } catch (error) {
      console.error('Error playing menu music:', error);
    }
  }

  /**
   * Stop menu music
   */
  private stopMenuMusic(): void {
    if (this.menuMusic && this.menuMusic.isPlaying) {
      this.menuMusic.stop();
    }
  }

  shutdown(): void {
    // Clean up keyboard listeners
    this.input.keyboard?.off('keydown-ESCAPE');
    
    // Stop menu music when leaving
    this.stopMenuMusic();
  }
}

