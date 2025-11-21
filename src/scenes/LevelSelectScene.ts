import Phaser from 'phaser';
import { GameMode, type AIDifficulty, type ILevelConfig } from '@/types';
import { SINGLEPLAYER_LEVELS } from '@/config/levels';
import { ProgressManager } from '@/utils/ProgressManager';
import {
  createNESContainer,
  createTextWithShadow,
  createNESButton,
  createNESMenuButton,
  createNESBackground,
  NESColors,
} from '@/utils/NESUI';
import { AudioSystem } from '@/systems/AudioSystem';

/**
 * Level selection scene - shows grid of levels with locked/unlocked status
 */
export class LevelSelectScene extends Phaser.Scene {
  private difficulty!: AIDifficulty;
  private gameMode?: GameMode;
  private levelButtons: Phaser.GameObjects.Container[] = [];
  private audioSystem!: AudioSystem;

  constructor() {
    super({ key: 'LevelSelectScene' });
  }

  init(data: { difficulty?: AIDifficulty; gameMode?: GameMode }): void {
    this.difficulty = data?.difficulty || 'medium';
    this.gameMode = data?.gameMode;
  }

  create(): void {
    const screenWidth = this.cameras.main.width;
    const screenHeight = this.cameras.main.height;

    // Initialize audio system
    this.audioSystem = new AudioSystem();

    // Create NES-style background
    createNESBackground(this, screenWidth, screenHeight);

    // Create title
    this.createTitle(screenWidth);

    // Create level grid
    this.createLevelGrid(screenWidth, screenHeight);

    // Create back button
    this.createBackButton(screenWidth, screenHeight);

    // Play menu music
    this.audioSystem.playMenuMusic(this);

    // Setup keyboard controls
    this.setupKeyboardControls();
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

    // Subtitle - show "2 Players" for local mode, difficulty for singleplayer
    if (this.gameMode === GameMode.Local) {
      createTextWithShadow(
        this,
        titleContainer,
        width / 2,
        titleY + 50,
        '2 Players',
        18,
        NESColors.yellow,
        0.5,
        0.5
      );
    } else {
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
    }

    // Progress info
    const completedCount = this.gameMode === GameMode.Local
      ? ProgressManager.getCompletedLevelsCountTwoPlayers()
      : ProgressManager.getCompletedLevelsCount(this.difficulty);
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
      
      const isUnlocked = this.gameMode === GameMode.Local
        ? ProgressManager.isLevelUnlockedTwoPlayers(i)
        : ProgressManager.isLevelUnlocked(this.difficulty, i);
      const isCompleted = this.gameMode === GameMode.Local
        ? ProgressManager.isLevelCompletedTwoPlayers(i)
        : ProgressManager.isLevelCompleted(this.difficulty, i);
      
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
    this.audioSystem.stopMenuMusic();
    
    // Use gameMode from init data, default to Solo if not provided
    const gameMode = this.gameMode || GameMode.Solo;
    
    // Always pass levelConfig - get it from SINGLEPLAYER_LEVELS
    const levelConfig = SINGLEPLAYER_LEVELS[levelIndex];
    
    // Start game with selected level
    const gameData: {
      gameMode: GameMode;
      levelConfig: ILevelConfig;
      levelIndex: number;
      aiDifficulty?: AIDifficulty;
    } = {
      gameMode: gameMode,
      levelConfig: levelConfig,
      levelIndex: levelIndex,
    };
    
    if (gameMode === GameMode.Solo) {
      gameData.aiDifficulty = this.difficulty;
    }
    
    this.scene.start('GameScene', gameData);
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
          // Return to main menu for 2 Players mode, difficulty menu for singleplayer
          if (this.gameMode === GameMode.Local) {
            this.scene.start('MenuScene');
          } else {
            this.scene.start('MenuScene', {
              showDifficultyMenu: true,
              selectedDifficulty: this.difficulty,
            });
          }
        },
      }
    );
  }

  /**
   * Setup keyboard controls
   */
  private setupKeyboardControls(): void {
    this.input.keyboard?.on('keydown-ESCAPE', () => {
      // Return to main menu for 2 Players mode, difficulty menu for singleplayer
      if (this.gameMode === GameMode.Local) {
        this.scene.start('MenuScene');
      } else {
        this.scene.start('MenuScene', {
          showDifficultyMenu: true,
          selectedDifficulty: this.difficulty,
        });
      }
    });
  }


  shutdown(): void {
    // Clean up keyboard listeners
    this.input.keyboard?.off('keydown-ESCAPE');
    
    // Stop menu music when leaving
    if (this.audioSystem) {
      this.audioSystem.stopMenuMusic();
    }
  }
}

