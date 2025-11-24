import Phaser from 'phaser';
import { GameMode, type AIDifficulty, type ILevelConfig, type ConnectionState } from '@/types';
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
import { WebRTCManager } from '@/network/WebRTCManager';
import { LobbyConnectionManager } from '@/network/LobbyConnectionManager';

/**
 * Level selection scene - shows grid of levels with locked/unlocked status
 */
export class LevelSelectScene extends Phaser.Scene {
  private difficulty!: AIDifficulty;
  private gameMode?: GameMode;
  private levelButtons: Phaser.GameObjects.Container[] = [];
  private audioSystem!: AudioSystem;
  
  // Multiplayer fields
  private webrtcManager?: WebRTCManager;
  private isHost: boolean = false;
  private lobbyConnectionManager?: LobbyConnectionManager;
  private levelButtonContainers: Map<number, Phaser.GameObjects.Container> = new Map();
  private waitingStatusText?: Phaser.GameObjects.Container;
  // Store event handlers for proper cleanup
  private levelSelectedHandler?: (levelIndex: number) => void;
  private gameReadyHandler?: (levelConfig?: ILevelConfig) => void;

  constructor() {
    super({ key: 'LevelSelectScene' });
  }

  init(data: { 
    difficulty?: AIDifficulty; 
    gameMode?: GameMode;
    webrtcManager?: WebRTCManager;
    isHost?: boolean;
    lobbyConnectionManager?: LobbyConnectionManager;
  }): void {
    this.difficulty = data?.difficulty || 'medium';
    this.gameMode = data?.gameMode;
    this.webrtcManager = data?.webrtcManager;
    this.isHost = data?.isHost ?? false;
    this.lobbyConnectionManager = data?.lobbyConnectionManager;
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

    // Setup multiplayer sync if in multiplayer mode
    if (this.gameMode === GameMode.Multiplayer && this.lobbyConnectionManager) {
      this.setupMultiplayerSync();
      
      // Create waiting status for client
      if (!this.isHost) {
        this.createWaitingStatus(screenWidth, screenHeight);
      }
    }

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

    // Subtitle - show "2 Players" for local mode, "Multiplayer" for multiplayer, difficulty for singleplayer
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
    } else if (this.gameMode === GameMode.Multiplayer) {
      createTextWithShadow(
        this,
        titleContainer,
        width / 2,
        titleY + 50,
        'Multiplayer',
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

    // Progress info (skip for multiplayer)
    if (this.gameMode !== GameMode.Multiplayer) {
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
      
      // For multiplayer, all levels are unlocked
      const isUnlocked = this.gameMode === GameMode.Multiplayer
        ? true
        : (this.gameMode === GameMode.Local
        ? ProgressManager.isLevelUnlockedTwoPlayers(i)
          : ProgressManager.isLevelUnlocked(this.difficulty, i));
      const isCompleted = this.gameMode === GameMode.Multiplayer
        ? false // Don't show completion status in multiplayer
        : (this.gameMode === GameMode.Local
        ? ProgressManager.isLevelCompletedTwoPlayers(i)
          : ProgressManager.isLevelCompleted(this.difficulty, i));
      
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
            // For multiplayer, use different logic
            if (this.gameMode === GameMode.Multiplayer) {
              if (this.isHost) {
                this.selectLevelForMultiplayer(levelIndex);
              }
              // Client cannot select levels
            } else {
            this.startLevel(levelIndex);
            }
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
    
    // Store button container reference for highlighting
    if (this.gameMode === GameMode.Multiplayer) {
      this.levelButtonContainers.set(levelIndex, buttonResult.container);
    }
    
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
    
    // For multiplayer client, disable clicks on levels
    if (this.gameMode === GameMode.Multiplayer && !this.isHost) {
      buttonResult.bg.removeInteractive();
      buttonResult.bg.setInteractive({
        hitArea: new Phaser.Geom.Rectangle(-width / 2, -height / 2, width, height),
        hitAreaCallback: Phaser.Geom.Rectangle.Contains,
        useHandCursor: false,
      });
      buttonResult.bg.off('pointerover');
      buttonResult.bg.off('pointerout');
      buttonResult.bg.on('pointerdown', () => {
        // Do nothing - client cannot select levels
      });
    }
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
          // Return to multiplayer lobby for multiplayer mode
          if (this.gameMode === GameMode.Multiplayer) {
            this.scene.start('MultiplayerLobbyScene');
          } else if (this.gameMode === GameMode.Local) {
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
      // Return to multiplayer lobby for multiplayer mode
      if (this.gameMode === GameMode.Multiplayer) {
        this.scene.start('MultiplayerLobbyScene');
      } else if (this.gameMode === GameMode.Local) {
        this.scene.start('MenuScene');
      } else {
        this.scene.start('MenuScene', {
          showDifficultyMenu: true,
          selectedDifficulty: this.difficulty,
        });
      }
    });
  }

  /**
   * Setup multiplayer synchronization
   */
  private setupMultiplayerSync(): void {
    if (!this.lobbyConnectionManager) {
      console.warn('LevelSelectScene: Cannot setup multiplayer sync - lobbyConnectionManager is missing');
      return;
    }

    console.log(`LevelSelectScene: Setting up multiplayer sync (isHost: ${this.isHost})`);

    // Re-establish message handler to ensure LobbyConnectionManager receives messages
    // This is important when returning from GameScene where NetworkSync was active
    this.lobbyConnectionManager.reestablishMessageHandler();

    // Clean up old handlers if they exist
    if (this.levelSelectedHandler) {
      this.lobbyConnectionManager.off('levelSelected', this.levelSelectedHandler);
    }
    if (this.gameReadyHandler) {
      this.lobbyConnectionManager.off('gameReady', this.gameReadyHandler);
    }

    // Create new handlers
    this.levelSelectedHandler = (levelIndex: number) => {
      console.log(`LevelSelectScene: Received levelSelected event (isHost: ${this.isHost}, levelIndex: ${levelIndex})`);
      if (!this.isHost) {
        // Client receives level selection
        this.highlightSelectedLevel(levelIndex);
        // Update waiting status
        this.updateWaitingStatus('Host selected level. Starting game...');
      }
    };

    this.gameReadyHandler = (levelConfig?: ILevelConfig) => {
      console.log(`LevelSelectScene: Received gameReady event (isHost: ${this.isHost}, hasLevelConfig: ${!!levelConfig})`);
      if (levelConfig) {
        // Hide waiting status before starting game
        this.hideWaitingStatus();
        this.startMultiplayerGame(levelConfig);
      }
    };

    // Subscribe to events
    this.lobbyConnectionManager.on('levelSelected', this.levelSelectedHandler);
    this.lobbyConnectionManager.on('gameReady', this.gameReadyHandler);

    // Listen for connection state changes
    if (this.webrtcManager) {
      this.webrtcManager.setOnStateChange((state: ConnectionState) => {
        if (state === 'disconnected' || state === 'error') {
          this.showDisconnectionMessage();
        }
      });
    }
  }

  /**
   * Select level for multiplayer (host only) - immediately starts the game
   */
  private selectLevelForMultiplayer(levelIndex: number): void {
    if (!this.isHost || !this.lobbyConnectionManager) {
      return;
    }

    // Validate level index
    if (levelIndex < 0 || levelIndex >= SINGLEPLAYER_LEVELS.length) {
      console.error('Invalid level index:', levelIndex);
      return;
    }

    // Get level config
    const levelConfig = SINGLEPLAYER_LEVELS[levelIndex];
    
    // Send level selection to client (for visual feedback)
    this.lobbyConnectionManager.sendLevelSelected(levelIndex);
    
    // Immediately send start game signal with level config
    this.lobbyConnectionManager.sendStartGame(levelConfig);
    
    // Start game on host
    this.startMultiplayerGame(levelConfig);
  }

  /**
   * Highlight selected level
   */
  private highlightSelectedLevel(levelIndex: number): void {
    const buttonWidth = 180;
    const buttonHeight = 100;
    
    // Reset all buttons to default state
    this.levelButtonContainers.forEach((container) => {
      const buttonBg = container.list.find((child) => 
        child instanceof Phaser.GameObjects.Graphics
      ) as Phaser.GameObjects.Graphics;
      
      if (buttonBg) {
        // Default colors
        const backgroundColor = NESColors.darkGray;
        const borderColor = NESColors.blue;
        
        buttonBg.clear();
        buttonBg.fillStyle(backgroundColor, 1);
        buttonBg.fillRoundedRect(-buttonWidth / 2, -buttonHeight / 2, buttonWidth, buttonHeight, 8);
        buttonBg.lineStyle(2, borderColor, 1);
        buttonBg.strokeRoundedRect(-buttonWidth / 2, -buttonHeight / 2, buttonWidth, buttonHeight, 8);
      }
    });

    // Highlight selected level
    const selectedContainer = this.levelButtonContainers.get(levelIndex);
    if (selectedContainer) {
      const buttonBg = selectedContainer.list.find((child) => 
        child instanceof Phaser.GameObjects.Graphics
      ) as Phaser.GameObjects.Graphics;
      
      if (buttonBg) {
        // Highlight color: yellow for host, blue for client
        const highlightColor = this.isHost ? NESColors.yellow : NESColors.blue;
        const backgroundColor = NESColors.darkGray;
        
        buttonBg.clear();
        buttonBg.fillStyle(backgroundColor, 1);
        buttonBg.fillRoundedRect(-buttonWidth / 2, -buttonHeight / 2, buttonWidth, buttonHeight, 8);
        buttonBg.lineStyle(3, highlightColor, 1);
        buttonBg.strokeRoundedRect(-buttonWidth / 2, -buttonHeight / 2, buttonWidth, buttonHeight, 8);
      }
    }
  }

  /**
   * Create waiting status (client only)
   */
  private createWaitingStatus(screenWidth: number, screenHeight: number): void {
    const statusY = screenHeight - 120;
    
    this.waitingStatusText = this.add.container(0, 0);
    createTextWithShadow(
      this,
      this.waitingStatusText,
      screenWidth / 2,
      statusY,
      'Waiting for host to select level...',
      20,
      NESColors.white,
      0.5,
      0.5
    );
  }

  /**
   * Hide waiting status (client only)
   */
  private hideWaitingStatus(): void {
    if (this.waitingStatusText) {
      this.waitingStatusText.setVisible(false);
    }
  }

  /**
   * Update waiting status text (client only)
   */
  private updateWaitingStatus(text: string): void {
    if (this.waitingStatusText) {
      // Clear existing text and create new
      this.waitingStatusText.removeAll(true);
      const screenWidth = this.cameras.main.width;
      const screenHeight = this.cameras.main.height;
      const statusY = screenHeight - 120;
      createTextWithShadow(
        this,
        this.waitingStatusText,
        screenWidth / 2,
        statusY,
        text,
        20,
        NESColors.white,
        0.5,
        0.5
      );
    }
  }

  /**
   * Start multiplayer game
   */
  private startMultiplayerGame(levelConfig: ILevelConfig): void {
    if (!this.webrtcManager) {
      console.error('WebRTC manager not initialized');
      return;
    }

    // Stop menu music
    this.audioSystem.stopMenuMusic();
    
    // Start game with level config
    this.scene.start('GameScene', {
      gameMode: GameMode.Multiplayer,
      webrtcManager: this.webrtcManager,
      isHost: this.isHost,
      levelConfig: levelConfig,
      lobbyConnectionManager: this.lobbyConnectionManager,
    });
  }

  /**
   * Show disconnection message
   */
  private showDisconnectionMessage(): void {
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;

    // Connection Lost text with shadow
    const lostShadow = this.add.bitmapText(width / 2 + 2, height / 2 + 2, 'pixel-font', 'Connection Lost', 32);
    lostShadow.setTintFill(0x000000);
    lostShadow.setOrigin(0.5);

    const lostText = this.add.bitmapText(width / 2, height / 2, 'pixel-font', 'Connection Lost', 32);
    lostText.setTintFill(0xff0000);
    lostText.setOrigin(0.5);

    // Press R text with shadow
    const pressRShadow = this.add.bitmapText(width / 2 + 1, height / 2 + 51, 'pixel-font', 'Press R to return to lobby', 20);
    pressRShadow.setTintFill(0x000000);
    pressRShadow.setOrigin(0.5);

    const pressRText = this.add.bitmapText(width / 2, height / 2 + 50, 'pixel-font', 'Press R to return to lobby', 20);
    pressRText.setTintFill(0xffffff);
    pressRText.setOrigin(0.5);

    this.input.keyboard?.once('keydown-R', () => {
      this.scene.start('MultiplayerLobbyScene');
    });
  }


  shutdown(): void {
    // Clean up keyboard listeners
    this.input.keyboard?.off('keydown-ESCAPE');
    
    // Clean up multiplayer event listeners
    if (this.lobbyConnectionManager) {
      if (this.levelSelectedHandler) {
        this.lobbyConnectionManager.off('levelSelected', this.levelSelectedHandler);
        this.levelSelectedHandler = undefined;
      }
      if (this.gameReadyHandler) {
        this.lobbyConnectionManager.off('gameReady', this.gameReadyHandler);
        this.gameReadyHandler = undefined;
      }
    }
    
    // Clean up waiting status
    if (this.waitingStatusText) {
      this.waitingStatusText.destroy();
      this.waitingStatusText = undefined;
    }
    
    // Stop menu music when leaving
    if (this.audioSystem) {
      this.audioSystem.stopMenuMusic();
    }
  }
}

