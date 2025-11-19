import Phaser from 'phaser';
import { GameMode } from '@/types';
import { Tank } from '@/entities/Tank';
import { AISystem } from '@/systems/AISystem';

/**
 * Turn System for managing player turns and AI turns
 */
export class TurnSystem {
  private scene: Phaser.Scene;
  private tanks: Tank[];
  private gameMode: GameMode;
  private aiSystem?: AISystem;
  
  // Turn state
  private currentPlayerIndex: number = 0;
  private canFireState: boolean = true;
  private waitingForProjectile: boolean = false;
  private isSwitchingTurn: boolean = false;
  private gameOver: boolean = false;
  
  // Active timers and tweens for cleanup
  private activeTimers: Phaser.Time.TimerEvent[] = [];
  private activeTweens: Phaser.Tweens.Tween[] = [];

  // Callbacks
  private onTurnChanged?: (newIndex: number) => void;
  private onFireRequested?: () => void;
  private onUIUpdate?: () => void;

  constructor(
    scene: Phaser.Scene,
    tanks: Tank[],
    gameMode: GameMode,
    aiSystem?: AISystem
  ) {
    this.scene = scene;
    this.tanks = tanks;
    this.gameMode = gameMode;
    this.aiSystem = aiSystem;
  }

  /**
   * Set callbacks for turn system events
   */
  public setCallbacks(callbacks: {
    onTurnChanged?: (newIndex: number) => void;
    onFireRequested?: () => void;
    onUIUpdate?: () => void;
  }): void {
    this.onTurnChanged = callbacks.onTurnChanged;
    this.onFireRequested = callbacks.onFireRequested;
    this.onUIUpdate = callbacks.onUIUpdate;
  }

  /**
   * Get current player index
   */
  public getCurrentPlayerIndex(): number {
    return this.currentPlayerIndex;
  }

  /**
   * Set current player index
   */
  public setCurrentPlayerIndex(index: number): void {
    this.currentPlayerIndex = index;
  }

  /**
   * Check if can fire
   */
  public canFire(): boolean {
    return this.canFireState && !this.waitingForProjectile && !this.gameOver;
  }

  /**
   * Check if waiting for projectile
   */
  public isWaitingForProjectile(): boolean {
    return this.waitingForProjectile;
  }

  /**
   * Set waiting for projectile state
   */
  public setWaitingForProjectile(waiting: boolean): void {
    this.waitingForProjectile = waiting;
  }

  /**
   * Set can fire state
   */
  public setCanFire(canFire: boolean): void {
    this.canFireState = canFire;
  }

  /**
   * Set game over state
   */
  public setGameOver(gameOver: boolean): void {
    this.gameOver = gameOver;
  }

  /**
   * Switch to next player's turn
   */
  public switchTurn(): void {
    if (this.gameOver) {
      return; // Игра окончена, смена хода невозможна
    }
    
    this.isSwitchingTurn = false;
    this.waitingForProjectile = false;
    this.canFireState = true;

    let nextIndex = (this.currentPlayerIndex + 1) % this.tanks.length;
    let attempts = 0;

    while (!this.tanks[nextIndex]?.isAlive() && attempts < this.tanks.length) {
      nextIndex = (nextIndex + 1) % this.tanks.length;
      attempts++;
    }

    this.currentPlayerIndex = nextIndex;
    
    if (this.onUIUpdate) {
      this.onUIUpdate();
    }
    
    if (this.onTurnChanged) {
      this.onTurnChanged(this.currentPlayerIndex);
    }

    // Show player indicator for local multiplayer
    if (this.gameMode === GameMode.Local) {
      this.showPlayerTurnIndicator();
    }

    if (this.gameMode === GameMode.Solo && this.currentPlayerIndex === 1 && this.aiSystem) {
      this.handleAITurn();
    }
  }

  /**
   * Show turn indicator for local multiplayer
   */
  private showPlayerTurnIndicator(): void {
    const width = this.scene.cameras.main.width;
    const height = this.scene.cameras.main.height;

    const playerName = `PLAYER ${this.currentPlayerIndex + 1}`;
    const turnTextStr = `${playerName}'S TURN`;
    
    // Turn text with shadow (bitmap font)
    const turnShadow = this.scene.add.bitmapText(width / 2 + 4, height / 2 + 4, 'pixel-font', turnTextStr, 64);
    turnShadow.setTintFill(0x000000);
    turnShadow.setOrigin(0.5);

    const turnText = this.scene.add.bitmapText(width / 2, height / 2, 'pixel-font', turnTextStr, 64);
    turnText.setTintFill(0xffffff);
    turnText.setOrigin(0.5);

    // Fade out animation
    const tween = this.scene.tweens.add({
      targets: [turnText, turnShadow],
      alpha: 0,
      scale: 1.2,
      duration: 1500,
      ease: 'Power2',
      onComplete: () => {
        turnText.destroy();
        turnShadow.destroy();
      },
    });
    
    this.activeTweens.push(tween);
  }

  /**
   * Handle AI turn
   */
  private handleAITurn(): void {
    if (this.gameOver) {
      return; // Игра окончена, AI не может ходить
    }
    
    const aiTank = this.tanks[1];
    const playerTank = this.tanks[0];

    if (!aiTank?.isAlive() || !playerTank?.isAlive()) {
      return;
    }

    if (this.currentPlayerIndex !== 1) {
      this.currentPlayerIndex = 1;
    }

    if (this.onUIUpdate) {
      this.onUIUpdate();
    }

    if (!this.aiSystem) {
      return;
    }

    this.aiSystem.getAIDecision(aiTank, playerTank, (angle: number, power: number) => {
      if (this.gameOver) {
        return; // Игра окончена в процессе принятия решения AI
      }
      
      if (this.currentPlayerIndex !== 1) {
        this.currentPlayerIndex = 1;
      }

      aiTank.setTurretAngle(angle);
      aiTank.setPower(power);

      if (this.onUIUpdate) {
        this.onUIUpdate();
      }

      if (this.currentPlayerIndex === 1 && this.onFireRequested) {
        this.onFireRequested();
      }
    });
  }

  /**
   * Schedule turn switch after delay
   */
  public scheduleTurnSwitch(delay: number = 50): void {
    if (this.isSwitchingTurn) {
      return;
    }
    
    this.isSwitchingTurn = true;
    const timer = this.scene.time.delayedCall(delay, () => {
      this.switchTurn();
    });
    
    this.activeTimers.push(timer);
  }

  /**
   * Clean up timers and tweens
   */
  public destroy(): void {
    // Clean up timers
    this.activeTimers.forEach((timer) => {
      if (timer && !timer.hasDispatched) {
        timer.destroy();
      }
    });
    this.activeTimers = [];

    // Clean up tweens
    this.activeTweens.forEach((tween) => {
      if (tween && tween.isActive()) {
        tween.destroy();
      }
    });
    this.activeTweens = [];
  }
}

