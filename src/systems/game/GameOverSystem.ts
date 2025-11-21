import Phaser from 'phaser';
import { GameMode, type AIDifficulty } from '@/types';
import { Tank } from '@/entities/Tank';
import { ProgressManager } from '@/utils/ProgressManager';
import { SINGLEPLAYER_LEVELS } from '@/config/levels';

/**
 * Game Over System for handling game end conditions and UI
 */
export class GameOverSystem {
  private scene: Phaser.Scene;
  private tanks: Tank[];
  private gameMode: GameMode;
  private aiDifficulty: AIDifficulty;
  private currentLevelIndex: number;
  private gameOverShown: boolean = false;
  private waitingForProjectiles: boolean = false;
  
  // UI elements for cleanup
  private gameOverTexts: Phaser.GameObjects.BitmapText[] = [];
  private inputHandlers: Array<{ event: string; callback: () => void }> = [];

  constructor(
    scene: Phaser.Scene,
    tanks: Tank[],
    gameMode: GameMode,
    aiDifficulty: AIDifficulty,
    currentLevelIndex: number
  ) {
    this.scene = scene;
    this.tanks = tanks;
    this.gameMode = gameMode;
    this.aiDifficulty = aiDifficulty;
    this.currentLevelIndex = currentLevelIndex;
  }

  /**
   * Check if game is over and handle accordingly
   * Returns true if game is over, false otherwise
   */
  public checkGameOver(activeProjectileCount: number): boolean {
    if (this.gameOverShown) {
      return true; // Already shown game over screen
    }

    // If we're waiting for projectiles to finish
    if (this.waitingForProjectiles) {
      if (activeProjectileCount === 0) {
        // All projectiles finished, now show game over screen
        this.gameOverShown = true;
        this.showGameOverForWinner();
        return true;
      }
      // Still waiting for projectiles
      return false;
    }

    const aliveTanks = this.tanks.filter((tank) => tank.isAlive());

    // Check for winner (1 tank alive) or draw (0 tanks alive)
    if (aliveTanks.length === 1 || aliveTanks.length === 0) {
      // Game is over, but check if there are projectiles still flying
      if (activeProjectileCount > 0) {
        // Wait for projectiles to finish before showing game over screen
        this.waitingForProjectiles = true;
        return false;
      }
      
      // No projectiles, show game over immediately
      this.gameOverShown = true;
      this.showGameOverForWinner();
      return true;
    }
    
    return false;
  }

  /**
   * Show game over screen for the winner
   * Extracted to avoid duplication in checkGameOver logic
   */
  private showGameOverForWinner(): void {
    const aliveTanks = this.tanks.filter((tank) => tank.isAlive());
    
    if (aliveTanks.length === 1) {
      const winnerIndex = this.tanks.findIndex((tank) => tank.isAlive());
      
      // For singleplayer mode, check if player won and advance to next level
      if (this.gameMode === GameMode.Solo && winnerIndex === 0) {
        // Player won - save progress and advance to next level
        ProgressManager.completeLevel(this.aiDifficulty, this.currentLevelIndex);
        
        const nextLevelIndex = this.currentLevelIndex + 1;
        if (nextLevelIndex < SINGLEPLAYER_LEVELS.length) {
          this.showLevelComplete(nextLevelIndex);
        } else {
          // All levels completed
          this.showGameOver('Congratulations! All Levels Completed!');
        }
      } else if (this.gameMode === GameMode.Local) {
        // For 2 players mode, save progress and advance to next level regardless of winner
        ProgressManager.completeLevelTwoPlayers(this.currentLevelIndex);
        
        const nextLevelIndex = this.currentLevelIndex + 1;
        if (nextLevelIndex < SINGLEPLAYER_LEVELS.length) {
          this.showLevelComplete(nextLevelIndex);
        } else {
          // All levels completed
          this.showGameOver(`Player ${winnerIndex + 1} Wins! All Levels Completed!`);
        }
      } else {
        // AI won or other modes
        this.showGameOver(`Player ${winnerIndex + 1} Wins!`);
      }
    } else {
      // Draw (0 tanks alive)
      this.showGameOver('Draw!');
    }
  }

  /**
   * Show level complete screen
   */
  private showLevelComplete(nextLevelIndex: number): void {
    const width = this.scene.cameras.main.width;
    const height = this.scene.cameras.main.height;

    // Level complete message with shadow (bitmap font)
    const message = 'Level Complete!';
    const messageShadow = this.scene.add.bitmapText(width / 2 + 3, height / 2 - 20 + 3, 'pixel-font', message, 48);
    messageShadow.setTintFill(0x000000);
    messageShadow.setOrigin(0.5);
    this.gameOverTexts.push(messageShadow);

    const messageText = this.scene.add.bitmapText(width / 2, height / 2 - 20, 'pixel-font', message, 48);
    messageText.setTintFill(0x00ff00); // Green color for success
    messageText.setOrigin(0.5);
    this.gameOverTexts.push(messageText);

    // Next level info
    const nextLevelMsg = `Next: Level ${nextLevelIndex + 1}/${SINGLEPLAYER_LEVELS.length}`;
    const nextLevelShadow = this.scene.add.bitmapText(width / 2 + 2, height / 2 + 30 + 2, 'pixel-font', nextLevelMsg, 24);
    nextLevelShadow.setTintFill(0x000000);
    nextLevelShadow.setOrigin(0.5);
    this.gameOverTexts.push(nextLevelShadow);

    const nextLevelText = this.scene.add.bitmapText(width / 2, height / 2 + 30, 'pixel-font', nextLevelMsg, 24);
    nextLevelText.setTintFill(0xffffff);
    nextLevelText.setOrigin(0.5);
    this.gameOverTexts.push(nextLevelText);

    // Press SPACE text with shadow (bitmap font)
    const continueShadow = this.scene.add.bitmapText(width / 2 + 2, height / 2 + 62 + 2, 'pixel-font', 'Press SPACE to continue', 24);
    continueShadow.setTintFill(0x000000);
    continueShadow.setOrigin(0.5);
    this.gameOverTexts.push(continueShadow);

    const continueText = this.scene.add.bitmapText(width / 2, height / 2 + 62, 'pixel-font', 'Press SPACE to continue', 24);
    continueText.setTintFill(0xffff00); // Yellow color
    continueText.setOrigin(0.5);
    this.gameOverTexts.push(continueText);

    // Press R text with shadow (bitmap font)
    const restartShadow = this.scene.add.bitmapText(width / 2 + 2, height / 2 + 92 + 2, 'pixel-font', 'Press R to restart level', 20);
    restartShadow.setTintFill(0x000000);
    restartShadow.setOrigin(0.5);
    this.gameOverTexts.push(restartShadow);

    const restartText = this.scene.add.bitmapText(width / 2, height / 2 + 92, 'pixel-font', 'Press R to restart level', 20);
    restartText.setTintFill(0xaaaaaa);
    restartText.setOrigin(0.5);
    this.gameOverTexts.push(restartText);

    // Input handlers
    const spaceHandler = () => {
      // Advance to next level
      const nextLevelConfig = SINGLEPLAYER_LEVELS[nextLevelIndex];
      this.scene.scene.start('GameScene', {
        gameMode: this.gameMode,
        aiDifficulty: this.aiDifficulty,
        levelConfig: nextLevelConfig,
        levelIndex: nextLevelIndex,
      });
    };
    
    const rHandler = () => {
      // Restart current level
      this.scene.scene.restart();
    };

    this.scene.input.keyboard?.once('keydown-SPACE', spaceHandler);
    this.scene.input.keyboard?.once('keydown-R', rHandler);
    
    this.inputHandlers.push({ event: 'keydown-SPACE', callback: spaceHandler });
    this.inputHandlers.push({ event: 'keydown-R', callback: rHandler });
  }

  /**
   * Show game over screen
   */
  public showGameOver(message: string): void {
    const width = this.scene.cameras.main.width;
    const height = this.scene.cameras.main.height;

    // Game over message with shadow (bitmap font)
    const messageShadow = this.scene.add.bitmapText(width / 2 + 3, height / 2 + 3, 'pixel-font', message, 48);
    messageShadow.setTintFill(0x000000);
    messageShadow.setOrigin(0.5);
    this.gameOverTexts.push(messageShadow);

    const messageText = this.scene.add.bitmapText(width / 2, height / 2, 'pixel-font', message, 48);
    messageText.setTintFill(0xffffff);
    messageText.setOrigin(0.5);
    this.gameOverTexts.push(messageText);

    // Press R text with shadow (bitmap font)
    const restartShadow = this.scene.add.bitmapText(width / 2 + 2, height / 2 + 62, 'pixel-font', 'Press R to restart', 24);
    restartShadow.setTintFill(0x000000);
    restartShadow.setOrigin(0.5);
    this.gameOverTexts.push(restartShadow);

    const restartText = this.scene.add.bitmapText(width / 2, height / 2 + 60, 'pixel-font', 'Press R to restart', 24);
    restartText.setTintFill(0xffffff);
    restartText.setOrigin(0.5);
    this.gameOverTexts.push(restartText);

    // For singleplayer, also show option to return to menu
    if (this.gameMode === GameMode.Solo) {
      const menuShadow = this.scene.add.bitmapText(width / 2 + 2, height / 2 + 92 + 2, 'pixel-font', 'Press M to return to menu', 20);
      menuShadow.setTintFill(0x000000);
      menuShadow.setOrigin(0.5);
      this.gameOverTexts.push(menuShadow);

      const menuText = this.scene.add.bitmapText(width / 2, height / 2 + 92, 'pixel-font', 'Press M to return to menu', 20);
      menuText.setTintFill(0xaaaaaa);
      menuText.setOrigin(0.5);
      this.gameOverTexts.push(menuText);

      const mHandler = () => {
        this.scene.scene.start('MenuScene');
      };
      
      this.scene.input.keyboard?.once('keydown-M', mHandler);
      this.inputHandlers.push({ event: 'keydown-M', callback: mHandler });
    }

    const rHandler = () => {
      this.scene.scene.restart();
    };
    
    this.scene.input.keyboard?.once('keydown-R', rHandler);
    this.inputHandlers.push({ event: 'keydown-R', callback: rHandler });
  }

  /**
   * Clean up BitmapText and input handlers
   */
  public destroy(): void {
    // Clean up text objects
    this.gameOverTexts.forEach((text) => {
      if (text && text.active) {
        text.destroy();
      }
    });
    this.gameOverTexts = [];

    // Clean up input handlers
    this.inputHandlers.forEach((handler) => {
      this.scene.input.keyboard?.off(handler.event, handler.callback);
    });
    this.inputHandlers = [];
  }
}

