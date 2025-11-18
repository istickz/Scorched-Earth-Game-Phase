import Phaser from 'phaser';
import { GameMode, type ITankConfig, type AIDifficulty, type ILevelConfig, TerrainBiome, TerrainShape, type IEnvironmentEffects } from '@/types';
import { createTextWithShadow } from '@/utils/NESUI';
import { TerrainSystem } from '@/systems/TerrainSystem';
import { Tank } from '@/entities/Tank';
import { Projectile } from '@/entities/Projectile';
import { ExplosionSystem } from '@/systems/ExplosionSystem';
import { AISystem } from '@/systems/AISystem';
import { WebRTCManager } from '@/network/WebRTCManager';
import { NetworkSync } from '@/network/NetworkSync';
import { AudioSystem } from '@/systems/AudioSystem';
import { BiomeSystem } from '@/systems/BiomeSystem';
import { WeatherSystem } from '@/systems/WeatherSystem';
import { EnvironmentSystem } from '@/systems/EnvironmentSystem';
import { SINGLEPLAYER_LEVELS } from '@/config/levels';
import { ProgressManager } from '@/utils/ProgressManager';
import { calculateTrajectoryPoint } from '@/utils/physicsUtils';

/**
 * Main game scene
 */
export class GameScene extends Phaser.Scene {
  private gameMode!: GameMode;
  private terrainSystem!: TerrainSystem;
  private tanks: Tank[] = [];
  private activeProjectiles: Projectile[] = [];
  private explosionSystem!: ExplosionSystem;
  private currentPlayerIndex: number = 0;
  private uiText!: Phaser.GameObjects.BitmapText;
  private uiTextShadow!: Phaser.GameObjects.BitmapText;
  private trajectoryPreview!: Phaser.GameObjects.Graphics;
  private canFire: boolean = true;
  private waitingForProjectile: boolean = false;
  private isSwitchingTurn: boolean = false;
  private gameOver: boolean = false;
  private aiSystem!: AISystem;
  private lastExplosionHit: { x: number; y: number } | null = null;
  private lastShotData: Map<string, { angle: number; power: number; ownerId: string }> = new Map();
  private webrtcManager?: WebRTCManager;
  private networkSync?: NetworkSync;
  private audioSystem!: AudioSystem;
  private environmentEffects!: IEnvironmentEffects;
  // Trajectory tracking system
  private activeTrajectories: Map<Projectile, { x: number; y: number }[]> = new Map();
  private completedTrajectories: { x: number; y: number }[][] = [];
  private trajectoryGraphics!: Phaser.GameObjects.Graphics;
  private readonly MAX_TRAJECTORIES = 5;
  private trajectoriesDirty: boolean = false; // Track if trajectories need redrawing

  constructor() {
    super({ key: 'GameScene' });
  }

  private aiDifficulty: AIDifficulty = 'medium';
  private levelConfig?: ILevelConfig;
  private currentLevelIndex: number = 0;

  init(data: { 
    gameMode?: GameMode; 
    webrtcManager?: WebRTCManager; 
    aiDifficulty?: AIDifficulty;
    levelConfig?: ILevelConfig;
    levelIndex?: number;
  }): void {
    this.gameMode = data?.gameMode || GameMode.Solo;
    this.webrtcManager = data?.webrtcManager;
    this.aiDifficulty = data?.aiDifficulty || 'medium';
    
    // Сохраняем конфигурацию уровня для использования в create()
    this.levelConfig = data?.levelConfig;
    
    // Сохраняем индекс уровня для singleplayer режима
    this.currentLevelIndex = data?.levelIndex ?? 0;
    
    // Сбрасываем все игровые состояния при инициализации/перезапуске
    this.gameOver = false;
    this.tanks = [];
    this.activeProjectiles = [];
    this.activeTrajectories = new Map();
    this.completedTrajectories = [];
    this.currentPlayerIndex = 0;
    this.canFire = true;
    this.waitingForProjectile = false;
    this.isSwitchingTurn = false;
    this.lastExplosionHit = null;
    this.lastShotData = new Map();
  }

  create(): void {
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;

    // Matter.js is now only used for tanks, not for projectiles
    // Projectiles use manual physics simulation with EnvironmentSystem

    // Use provided config, predefined level for singleplayer, or create random one
    let levelConfig: ILevelConfig;
    if (this.levelConfig) {
      // Explicitly provided config (from LevelEditorScene for local multiplayer)
      levelConfig = this.levelConfig;
    } else if (this.gameMode === GameMode.Solo) {
      // Singleplayer mode: use predefined levels
      const levelIndex = Math.min(this.currentLevelIndex, SINGLEPLAYER_LEVELS.length - 1);
      levelConfig = SINGLEPLAYER_LEVELS[levelIndex];
    } else {
      // Multiplayer or other modes: use random generation
      levelConfig = this.createRandomLevelConfig();
    }
    
    // Use seed from config if provided, otherwise generate random
    const terrainSeed = levelConfig.seed !== undefined ? levelConfig.seed : Math.random() * 1000000;
    
    // Initialize environment effects based on biome, weather, and time
    // Use custom values from levelConfig if provided, otherwise use defaults
    const defaultEffects = EnvironmentSystem.getEffects(
      levelConfig.biome,
      levelConfig.weather,
      levelConfig.timeOfDay
    );
    // Merge defaults with custom effects (custom effects override defaults)
    // This allows levels 11+ to override windX while keeping biome/weather effects
    this.environmentEffects = levelConfig.environmentEffects
      ? { ...defaultEffects, ...levelConfig.environmentEffects }
      : { ...defaultEffects };

    // Add random wind variation for each game
    const windVar = EnvironmentSystem.getWindVariation();
    this.environmentEffects.windX += windVar.windX;
    this.environmentEffects.windY += windVar.windY;

    // Log level configuration
    console.log('🎨 Level Configuration:', JSON.stringify(levelConfig, null, 2));
    
    // Get colors for biome
    const colors = BiomeSystem.getColors(levelConfig.biome, levelConfig.season, levelConfig.timeOfDay);
    
    // Apply weather tint to sky
    const skyColor = WeatherSystem.applySkyWeatherTint(colors.sky, levelConfig.weather);
    
    this.terrainSystem = new TerrainSystem(this, {
      width,
      height,
      minHeight: height * 0.45,
      maxHeight: height * 0.85,
      roughness: levelConfig.roughness,
      seed: terrainSeed,
      skyColor: skyColor,
      groundColor: colors.ground,
      isNight: levelConfig.timeOfDay === 'night',
      shape: levelConfig.shape,
    });

    this.explosionSystem = new ExplosionSystem(this, this.terrainSystem);

    this.audioSystem = new AudioSystem();
    this.audioSystem.resume();

    // Create weather effects (system manages itself, no need to store reference)
    if (levelConfig.weather !== 'none') {
      new WeatherSystem(this, levelConfig.weather, levelConfig.timeOfDay, this.environmentEffects, this.terrainSystem);
    }

    if (this.gameMode === GameMode.Solo) {
      this.aiSystem = new AISystem(this, this.terrainSystem, this.aiDifficulty);
    }

    if (this.gameMode === GameMode.Multiplayer && this.webrtcManager) {
      this.networkSync = new NetworkSync(this.webrtcManager);
      this.setupNetworkSync();
    }

    this.createTanks();
    this.setupUI();
    this.setupInput();
    
    // Убираем setupCollisions - больше не нужна Matter.js коллизия
    // this.setupCollisions();

    this.events.on('explosion', this.handleExplosion, this);
  }

  private createTanks(): void {
    const width = this.cameras.main.width;
    const tank1X = width * 0.2;
    const tank2X = width * 0.8;

    const tank1Y = this.terrainSystem.getHeightAt(tank1X);
    const tank2Y = this.terrainSystem.getHeightAt(tank2X);

    const tank1Config: ITankConfig = {
      x: tank1X,
      y: tank1Y,
      health: 100,
      maxHealth: 100,
      angle: 0,
      power: 50,
      color: 0x556b2f,
      isPlayer: true,
    };

    const tank2Config: ITankConfig = {
      x: tank2X,
      y: tank2Y,
      health: 100,
      maxHealth: 100,
      angle: 180,
      power: 50,
      color: 0x654321,
      isPlayer: this.gameMode === GameMode.Multiplayer || this.gameMode === GameMode.Local,
    };

    const tank1 = new Tank(this, tank1Config);
    tank1.positionOnTerrain(tank1Y);
    this.tanks.push(tank1);

    const tank2 = new Tank(this, tank2Config);
    tank2.positionOnTerrain(tank2Y);
    this.tanks.push(tank2);
  }

  private setupUI(): void {
    // Create UI container for HUD elements
    const uiContainer = this.add.container(0, 0);
    
    // UI text with shadow (bitmap font)
    const { shadow: uiTextShadow, text: uiText } = createTextWithShadow(
      this,
      uiContainer,
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
      this,
      uiContainer,
      20,
      60,
      controlsTextStr,
      14,
      0xaaaaaa,
      0,
      0
    );

    // Создаем графику для предпросмотра траектории
    this.trajectoryPreview = this.add.graphics();
    this.trajectoryPreview.setDepth(1);
    this.trajectoryPreview.clear(); // Очищаем при создании

    // Создаем графику для отображения траекторий выстрелов
    this.trajectoryGraphics = this.add.graphics();
    this.trajectoryGraphics.setDepth(4);
    this.trajectoryGraphics.clear(); // Очищаем при создании

    this.updateUI();
  }

  private updateUI(): void {
    const currentTank = this.tanks[this.currentPlayerIndex];
    if (!currentTank || !currentTank.isAlive()) {
      return;
    }

    let modeText = 'Singleplayer';
    if (this.gameMode === GameMode.Multiplayer) {
      modeText = 'P2P Multiplayer';
    } else if (this.gameMode === GameMode.Local) {
      modeText = 'Local Multiplayer';
    }
    
    // Add level number for singleplayer mode
    let levelText = '';
    if (this.gameMode === GameMode.Solo) {
      const levelNumber = this.currentLevelIndex + 1;
      const totalLevels = SINGLEPLAYER_LEVELS.length;
      levelText = ` | Level ${levelNumber}/${totalLevels}`;
    }
    
    const isAITurn = this.gameMode === GameMode.Solo && this.currentPlayerIndex === 1;
    const playerText = isAITurn ? 'AI Thinking...' : `Player ${this.currentPlayerIndex + 1}`;
    const angleText = `Angle: ${currentTank.getTurretAngle().toFixed(0)}°`;
    const powerText = `Power: ${currentTank.getPower().toFixed(0)}%`;

    const uiTextStr = `${modeText}${levelText} | ${playerText} | ${angleText} | ${powerText}`;
    this.uiText.setText(uiTextStr);
    this.uiTextShadow.setText(uiTextStr);
  }

  private setupNetworkSync(): void {
    if (!this.networkSync) {
      return;
    }

    this.networkSync.setCallbacks({
      onAngleChange: (angle: number) => {
        if (this.tanks[1] && this.currentPlayerIndex === 1) {
          this.tanks[1].setTurretAngle(angle);
          this.updateUI();
        }
      },
      onPowerChange: (power: number) => {
        if (this.tanks[1] && this.currentPlayerIndex === 1) {
          this.tanks[1].setPower(power);
          this.updateUI();
        }
      },
      onFire: (angle: number, power: number) => {
        if (this.tanks[1] && this.currentPlayerIndex === 1) {
          this.tanks[1].setTurretAngle(angle);
          this.tanks[1].setPower(power);
          this.fireProjectile();
        }
      },
    });

    if (this.webrtcManager) {
      this.webrtcManager.setOnStateChange((state) => {
        if (state === 'disconnected' || state === 'error') {
          this.showDisconnectionMessage();
        }
      });
    }
  }

  private showDisconnectionMessage(): void {
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;

    // Connection Lost text with shadow (bitmap font)
    const lostShadow = this.add.bitmapText(width / 2 + 2, height / 2 + 2, 'pixel-font', 'Connection Lost', 32);
    lostShadow.setTintFill(0x000000);
    lostShadow.setOrigin(0.5);

    const lostText = this.add.bitmapText(width / 2, height / 2, 'pixel-font', 'Connection Lost', 32);
    lostText.setTintFill(0xff0000);
    lostText.setOrigin(0.5);

    // Press R text with shadow (bitmap font)
    const pressRShadow = this.add.bitmapText(width / 2 + 1, height / 2 + 51, 'pixel-font', 'Press R to return to menu', 20);
    pressRShadow.setTintFill(0x000000);
    pressRShadow.setOrigin(0.5);

    const pressRText = this.add.bitmapText(width / 2, height / 2 + 50, 'pixel-font', 'Press R to return to menu', 20);
    pressRText.setTintFill(0xffffff);
    pressRText.setOrigin(0.5);

    this.input.keyboard?.once('keydown-R', () => {
      this.scene.start('MenuScene');
    });
  }

  private setupInput(): void {
    const currentTank = this.tanks[this.currentPlayerIndex];
    if (!currentTank || !currentTank.isAlive()) {
      return;
    }

    this.input.keyboard?.on('keydown-LEFT', () => {
      if (this.gameOver) {
        return; // Игра окончена, управление заблокировано
      }
      // In P2P multiplayer, only player 1 can control. In local, both players control.
      if (this.gameMode === GameMode.Multiplayer && this.currentPlayerIndex !== 0) {
        return;
      }
      if (this.tanks[this.currentPlayerIndex]?.isAlive()) {
        const newAngle = this.tanks[this.currentPlayerIndex].getTurretAngle() - 5;
        this.tanks[this.currentPlayerIndex].setTurretAngle(newAngle);
        this.updateUI();
        this.updateTrajectoryPreview();
        if (this.networkSync && this.gameMode === GameMode.Multiplayer) {
          this.networkSync.sendAngle(newAngle);
        }
      }
    });

    this.input.keyboard?.on('keydown-RIGHT', () => {
      if (this.gameOver) {
        return; // Игра окончена, управление заблокировано
      }
      // In P2P multiplayer, only player 1 can control. In local, both players control.
      if (this.gameMode === GameMode.Multiplayer && this.currentPlayerIndex !== 0) {
        return;
      }
      if (this.tanks[this.currentPlayerIndex]?.isAlive()) {
        const newAngle = this.tanks[this.currentPlayerIndex].getTurretAngle() + 5;
        this.tanks[this.currentPlayerIndex].setTurretAngle(newAngle);
        this.updateUI();
        this.updateTrajectoryPreview();
        if (this.networkSync && this.gameMode === GameMode.Multiplayer) {
          this.networkSync.sendAngle(newAngle);
        }
      }
    });

    this.input.keyboard?.on('keydown-UP', () => {
      if (this.gameOver) {
        return; // Игра окончена, управление заблокировано
      }
      // In P2P multiplayer, only player 1 can control. In local, both players control.
      if (this.gameMode === GameMode.Multiplayer && this.currentPlayerIndex !== 0) {
        return;
      }
      if (this.tanks[this.currentPlayerIndex]?.isAlive()) {
        const newPower = this.tanks[this.currentPlayerIndex].getPower() + 5;
        this.tanks[this.currentPlayerIndex].setPower(newPower);
        this.updateUI();
        this.updateTrajectoryPreview();
        if (this.networkSync && this.gameMode === GameMode.Multiplayer) {
          this.networkSync.sendPower(newPower);
        }
      }
    });

    this.input.keyboard?.on('keydown-DOWN', () => {
      if (this.gameOver) {
        return; // Игра окончена, управление заблокировано
      }
      // In P2P multiplayer, only player 1 can control. In local, both players control.
      if (this.gameMode === GameMode.Multiplayer && this.currentPlayerIndex !== 0) {
        return;
      }
      if (this.tanks[this.currentPlayerIndex]?.isAlive()) {
        const newPower = this.tanks[this.currentPlayerIndex].getPower() - 5;
        this.tanks[this.currentPlayerIndex].setPower(newPower);
        this.updateUI();
        this.updateTrajectoryPreview();
        if (this.networkSync && this.gameMode === GameMode.Multiplayer) {
          this.networkSync.sendPower(newPower);
        }
      }
    });

    this.input.keyboard?.on('keydown-SPACE', () => {
      if (this.gameOver) {
        return; // Игра окончена, управление заблокировано
      }
      // In P2P multiplayer, only player 1 can control. In local, both players control.
      if (this.gameMode === GameMode.Multiplayer && this.currentPlayerIndex !== 0) {
        return;
      }
      if (this.tanks[this.currentPlayerIndex]?.isAlive()) {
        if (this.networkSync && this.gameMode === GameMode.Multiplayer) {
          const tank = this.tanks[this.currentPlayerIndex];
          this.networkSync.sendFire(tank.getTurretAngle(), tank.getPower());
        }
        this.fireProjectile();
      }
    });
  }

  /**
   * OPTIMIZED: Preview trajectory with minimal allocations
   */
  private updateTrajectoryPreview(): void {
    const currentTank = this.tanks[this.currentPlayerIndex];
    if (!currentTank || !currentTank.isAlive()) {
      return;
    }

    this.trajectoryPreview.clear();
    this.trajectoryPreview.lineStyle(2, 0xffffff, 0.5);

    const fireData = currentTank.fire();
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;

    // OPTIMIZED: Draw directly without creating array of Vector2 objects
    this.trajectoryPreview.beginPath();
    this.trajectoryPreview.moveTo(fireData.x, fireData.y);
    
    let hasPoints = false;
    for (let t = 0.2; t < 5; t += 0.2) { // Reduced iterations from 50 to 25
      const point = calculateTrajectoryPoint(
        fireData.x,
        fireData.y,
        fireData.angle,
        fireData.power,
        t,
        1.0 // gravity
      );

      if (point.x >= 0 && point.x < width && point.y >= 0 && point.y < height) {
        this.trajectoryPreview.lineTo(point.x, point.y);
        hasPoints = true;
      } else if (hasPoints) {
        break; // Stop drawing if we've left the screen
      }
    }

    this.trajectoryPreview.strokePath();
  }

  private fireProjectile(): void {
    if (this.gameOver) {
      return; // Игра окончена, стрельба невозможна
    }
    
    if (!this.canFire || this.waitingForProjectile) {
      return;
    }

    const currentTank = this.tanks[this.currentPlayerIndex];
    if (!currentTank || !currentTank.isAlive()) {
      return;
    }

    this.canFire = false;
    this.waitingForProjectile = true;

    const fireData = currentTank.fire();
    const ownerId = `tank-${this.currentPlayerIndex}`;
    const projectile = new Projectile(this, {
      x: fireData.x,
      y: fireData.y,
      angle: fireData.angle,
      power: fireData.power,
      ownerId: ownerId,
      environmentEffects: this.environmentEffects,
    });

    this.lastShotData.set(projectile.getOwnerId(), {
      angle: fireData.angle,
      power: fireData.power,
      ownerId: ownerId,
    });

    this.activeTrajectories.set(projectile, [
      { x: projectile.x, y: projectile.y }
    ]);

    this.activeProjectiles.push(projectile);
    this.trajectoryPreview.clear();

    this.audioSystem.playFire();
  }

  private handleExplosion(data: { x: number; y: number; radius: number; damage: number; ownerId?: string }): void {
    this.lastExplosionHit = { x: data.x, y: data.y };

    // Сохраняем позиции танков ДО нанесения урона (на случай если они будут уничтожены)
    const tankPositions = new Map<Tank, { x: number; y: number; isAlive: boolean }>();
    this.tanks.forEach((tank) => {
      if (tank.isAlive()) {
        tankPositions.set(tank, { x: tank.x, y: tank.y, isAlive: true });
      }
    });

    // Наносим урон танкам
    this.tanks.forEach((tank) => {
      if (!tank.isAlive()) {
        return;
      }

      const tankHitboxRadius = 35;
      const effectiveRadius = data.radius + tankHitboxRadius;
      
      const distance = Phaser.Math.Distance.Between(data.x, data.y, tank.x, tank.y);
      if (distance <= effectiveRadius) {
        const damage = this.explosionSystem.calculateDamage(
          Math.max(0, distance - tankHitboxRadius),
          data.radius, 
          data.damage
        );
        tank.takeDamage(damage);
      }
    });

    // Записываем результат выстрела для AI (используем сохраненные позиции)
    if (this.gameMode === GameMode.Solo && this.aiSystem && this.lastExplosionHit && data.ownerId === 'tank-1') {
      const shotData = this.lastShotData.get(data.ownerId);
      
      if (shotData) {
        const aiTank = this.tanks[1];
        const playerTank = this.tanks[0];
        const playerTankPos = tankPositions.get(playerTank);
        
        if (aiTank && playerTank && playerTankPos) {
          const distance = Phaser.Math.Distance.Between(
            this.lastExplosionHit.x,
            this.lastExplosionHit.y,
            playerTankPos.x,
            playerTankPos.y
          );

          this.aiSystem.recordShotResult({
            angle: shotData.angle,
            power: shotData.power,
            hitX: this.lastExplosionHit.x,
            hitY: this.lastExplosionHit.y,
            targetX: playerTankPos.x,
            targetY: playerTankPos.y,
            distance: distance,
          });
        }
      }
    }

    if (this.waitingForProjectile && !this.isSwitchingTurn) {
      this.isSwitchingTurn = true;
      this.time.delayedCall(50, () => {
        this.switchTurn();
      });
    }

    this.checkGameOver();
  }

  private switchTurn(): void {
    if (this.gameOver) {
      return; // Игра окончена, смена хода невозможна
    }
    
    this.isSwitchingTurn = false;
    this.waitingForProjectile = false;
    this.canFire = true;

    let nextIndex = (this.currentPlayerIndex + 1) % this.tanks.length;
    let attempts = 0;

    while (!this.tanks[nextIndex]?.isAlive() && attempts < this.tanks.length) {
      nextIndex = (nextIndex + 1) % this.tanks.length;
      attempts++;
    }

    this.currentPlayerIndex = nextIndex;
    this.updateUI();

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
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;

    const playerName = `PLAYER ${this.currentPlayerIndex + 1}`;
    const turnTextStr = `${playerName}'S TURN`;
    
    // Turn text with shadow (bitmap font)
    const turnShadow = this.add.bitmapText(width / 2 + 4, height / 2 + 4, 'pixel-font', turnTextStr, 64);
    turnShadow.setTintFill(0x000000);
    turnShadow.setOrigin(0.5);

    const turnText = this.add.bitmapText(width / 2, height / 2, 'pixel-font', turnTextStr, 64);
    turnText.setTintFill(0xffffff);
    turnText.setOrigin(0.5);

    // Fade out animation
    this.tweens.add({
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
  }

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

    this.updateUI();

    this.aiSystem.getAIDecision(aiTank, playerTank, (angle: number, power: number) => {
      if (this.gameOver) {
        return; // Игра окончена в процессе принятия решения AI
      }
      
      if (this.currentPlayerIndex !== 1) {
        this.currentPlayerIndex = 1;
      }

      aiTank.setTurretAngle(angle);
      aiTank.setPower(power);

      this.updateUI();

      if (this.currentPlayerIndex === 1) {
        this.fireProjectile();
      }
    });
  }

  private checkGameOver(): void {
    if (this.gameOver) {
      return; // Уже обработали окончание игры
    }

    const aliveTanks = this.tanks.filter((tank) => tank.isAlive());

    if (aliveTanks.length === 1) {
      this.gameOver = true;
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
      } else {
        // AI won or other modes
      this.showGameOver(`Player ${winnerIndex + 1} Wins!`);
      }
    } else if (aliveTanks.length === 0) {
      this.gameOver = true;
      this.showGameOver('Draw!');
    }
  }

  private showLevelComplete(nextLevelIndex: number): void {
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;

    // Level complete message with shadow (bitmap font)
    const message = 'Level Complete!';
    const messageShadow = this.add.bitmapText(width / 2 + 3, height / 2 - 20 + 3, 'pixel-font', message, 48);
    messageShadow.setTintFill(0x000000);
    messageShadow.setOrigin(0.5);

    const messageText = this.add.bitmapText(width / 2, height / 2 - 20, 'pixel-font', message, 48);
    messageText.setTintFill(0x00ff00); // Green color for success
    messageText.setOrigin(0.5);

    // Next level info
    const nextLevelMsg = `Next: Level ${nextLevelIndex + 1}/${SINGLEPLAYER_LEVELS.length}`;
    const nextLevelShadow = this.add.bitmapText(width / 2 + 2, height / 2 + 30 + 2, 'pixel-font', nextLevelMsg, 24);
    nextLevelShadow.setTintFill(0x000000);
    nextLevelShadow.setOrigin(0.5);

    const nextLevelText = this.add.bitmapText(width / 2, height / 2 + 30, 'pixel-font', nextLevelMsg, 24);
    nextLevelText.setTintFill(0xffffff);
    nextLevelText.setOrigin(0.5);

    // Press SPACE text with shadow (bitmap font)
    const continueShadow = this.add.bitmapText(width / 2 + 2, height / 2 + 62 + 2, 'pixel-font', 'Press SPACE to continue', 24);
    continueShadow.setTintFill(0x000000);
    continueShadow.setOrigin(0.5);

    const continueText = this.add.bitmapText(width / 2, height / 2 + 62, 'pixel-font', 'Press SPACE to continue', 24);
    continueText.setTintFill(0xffff00); // Yellow color
    continueText.setOrigin(0.5);

    // Press R text with shadow (bitmap font)
    const restartShadow = this.add.bitmapText(width / 2 + 2, height / 2 + 92 + 2, 'pixel-font', 'Press R to restart level', 20);
    restartShadow.setTintFill(0x000000);
    restartShadow.setOrigin(0.5);

    const restartText = this.add.bitmapText(width / 2, height / 2 + 92, 'pixel-font', 'Press R to restart level', 20);
    restartText.setTintFill(0xaaaaaa);
    restartText.setOrigin(0.5);

    this.input.keyboard?.once('keydown-SPACE', () => {
      // Advance to next level
      this.scene.start('GameScene', {
        gameMode: this.gameMode,
        aiDifficulty: this.aiDifficulty,
        levelIndex: nextLevelIndex,
      });
    });

    this.input.keyboard?.once('keydown-R', () => {
      // Restart current level
      this.scene.restart();
    });
  }

  private showGameOver(message: string): void {
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;

    // Game over message with shadow (bitmap font)
    const messageShadow = this.add.bitmapText(width / 2 + 3, height / 2 + 3, 'pixel-font', message, 48);
    messageShadow.setTintFill(0x000000);
    messageShadow.setOrigin(0.5);

    const messageText = this.add.bitmapText(width / 2, height / 2, 'pixel-font', message, 48);
    messageText.setTintFill(0xffffff);
    messageText.setOrigin(0.5);

    // Press R text with shadow (bitmap font)
    const restartShadow = this.add.bitmapText(width / 2 + 2, height / 2 + 62, 'pixel-font', 'Press R to restart', 24);
    restartShadow.setTintFill(0x000000);
    restartShadow.setOrigin(0.5);

    const restartText = this.add.bitmapText(width / 2, height / 2 + 60, 'pixel-font', 'Press R to restart', 24);
    restartText.setTintFill(0xffffff);
    restartText.setOrigin(0.5);

    // For singleplayer, also show option to return to menu
    if (this.gameMode === GameMode.Solo) {
      const menuShadow = this.add.bitmapText(width / 2 + 2, height / 2 + 92 + 2, 'pixel-font', 'Press M to return to menu', 20);
      menuShadow.setTintFill(0x000000);
      menuShadow.setOrigin(0.5);

      const menuText = this.add.bitmapText(width / 2, height / 2 + 92, 'pixel-font', 'Press M to return to menu', 20);
      menuText.setTintFill(0xaaaaaa);
      menuText.setOrigin(0.5);

      this.input.keyboard?.once('keydown-M', () => {
        this.scene.start('MenuScene');
      });
    }

    this.input.keyboard?.once('keydown-R', () => {
      this.scene.restart();
    });
  }

  update(_time: number, delta: number): void {
    // Останавливаем обновления после окончания игры
    if (this.gameOver) {
      return;
    }

    this.tanks.forEach((tank) => {
      if (tank.isAlive()) {
        tank.checkGroundSupport(this.terrainSystem);
      }
    });

    if (this.tanks[this.currentPlayerIndex]?.isAlive() && this.canFire && !this.waitingForProjectile) {
      this.updateTrajectoryPreview();
    }

    // Update projectile positions with manual physics (before collision detection)
    this.activeProjectiles.forEach((projectile) => {
      projectile.updatePosition(delta);
    });

    // ЕДИНАЯ система детекции попаданий
    const projectilesToRemove: Projectile[] = [];
    this.activeProjectiles.forEach((projectile) => {
      const lastPos = projectile.getLastPosition();
      const currentX = projectile.x;
      const currentY = projectile.y;
      
      const dx = currentX - lastPos.x;
      const dy = currentY - lastPos.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      // Радиус хитбокса танка
      const tankHitboxRadius = 40; // Увеличен для лучшего попадания
      
      // Проверяем попадание по танкам ПЕРВЫМ (приоритет)
      let hitTank: Tank | null = null;
      let tankHitPoint: { x: number; y: number } | null = null;
      
      for (const tank of this.tanks) {
        if (!tank.isAlive()) {
          continue;
        }
        
        // Не попадаем в свой танк
        const tankId = `tank-${this.tanks.indexOf(tank)}`;
        if (projectile.getOwnerId() === tankId) {
          continue;
        }
        
        // Проверяем путь снаряда по точкам
        const steps = Math.max(10, Math.ceil(distance / 1)); // Проверка каждого пикселя
        for (let i = 0; i <= steps; i++) {
          const t = i / steps;
          const checkX = lastPos.x + dx * t;
          const checkY = lastPos.y + dy * t;
          
          const distToTank = Phaser.Math.Distance.Between(checkX, checkY, tank.x, tank.y);
          if (distToTank <= tankHitboxRadius) {
            hitTank = tank;
            tankHitPoint = { x: checkX, y: checkY };
            break;
          }
        }
        
        if (hitTank) {
          break;
        }
      }
      
      if (tankHitPoint) {
        // Попадание в танк - взрыв!
        // Move projectile sprite to exact hit point for visual consistency
        projectile.x = tankHitPoint.x;
        projectile.y = tankHitPoint.y;
        this.saveTrajectory(projectile, tankHitPoint);
        this.explosionSystem.explode(tankHitPoint.x, tankHitPoint.y, 30, 50, projectile.getOwnerId());
        this.audioSystem.playExplosion();
        projectilesToRemove.push(projectile);
      } else {
        // Проверяем попадание в землю
        let hitPoint: { x: number; y: number } | null = null;
        const steps = Math.max(10, Math.ceil(distance / 1)); // Проверка каждого пикселя
        
        for (let i = 0; i <= steps; i++) {
          const t = i / steps;
          const checkX = lastPos.x + dx * t;
          const checkY = lastPos.y + dy * t;
          
          if (this.terrainSystem.isSolid(checkX, checkY)) {
            hitPoint = { x: checkX, y: checkY };
            break;
          }
        }

        if (hitPoint) {
          // Попадание в землю
          // Move projectile sprite to exact hit point for visual consistency
          projectile.x = hitPoint.x;
          projectile.y = hitPoint.y;
          this.saveTrajectory(projectile, hitPoint);
          this.explosionSystem.explode(hitPoint.x, hitPoint.y, 30, 50, projectile.getOwnerId());
          this.audioSystem.playExplosion();
          projectilesToRemove.push(projectile);
        } else if (projectile.y > this.cameras.main.height || projectile.x < 0 || projectile.x > this.cameras.main.width) {
          // Снаряд улетел за экран
          this.saveTrajectory(projectile, { x: projectile.x, y: projectile.y });
          projectilesToRemove.push(projectile);
        }
      }
    });

    // Удаляем уничтоженные снаряды
    projectilesToRemove.forEach((projectile) => {
      const index = this.activeProjectiles.indexOf(projectile);
      if (index !== -1) {
        projectile.destroy();
        this.activeProjectiles.splice(index, 1);
      }
    });

    // Переключаем ход если все снаряды улетели
    if (projectilesToRemove.length > 0 && this.waitingForProjectile && this.activeProjectiles.length === 0 && !this.isSwitchingTurn) {
      this.isSwitchingTurn = true;
      this.time.delayedCall(50, () => {
        this.switchTurn();
      });
    }

    // Обновляем траектории и последние позиции для следующего кадра
    this.activeProjectiles.forEach((projectile) => {
      const trajectory = this.activeTrajectories.get(projectile);
      if (trajectory) {
        trajectory.push({ x: projectile.x, y: projectile.y });
        this.trajectoriesDirty = true; // Mark as dirty when trajectory updates
      }
      projectile.updateLastPosition();
    });

    // OPTIMIZED: Only redraw trajectories when they actually change
    if (this.trajectoriesDirty) {
    this.drawTrajectories();
      this.trajectoriesDirty = false;
    }
  }

  private saveTrajectory(projectile: Projectile, endPoint: { x: number; y: number }): void {
    const trajectory = this.activeTrajectories.get(projectile);
    if (trajectory && trajectory.length > 0) {
      const lastPoint = trajectory[trajectory.length - 1];
      const distance = Phaser.Math.Distance.Between(lastPoint.x, lastPoint.y, endPoint.x, endPoint.y);
      
      if (distance > 0.1) {
        trajectory.push(endPoint);
      }
      
      this.completedTrajectories.push([...trajectory]);
      
      if (this.completedTrajectories.length > this.MAX_TRAJECTORIES) {
        this.completedTrajectories.shift();
      }
      
      this.activeTrajectories.delete(projectile);
      this.trajectoriesDirty = true; // Mark as dirty when trajectory completes
    }
  }

  private drawTrajectories(): void {
    this.trajectoryGraphics.clear();

    // OPTIMIZED: Draw completed trajectories with simple lines (not smooth splines)
    this.completedTrajectories.forEach((trajectory, index) => {
      if (trajectory.length < 2) return;
      
      const colors = [0xffffff, 0xffff00, 0xffaa00, 0xff8800, 0xff6600];
      const color = colors[Math.min(index, colors.length - 1)];
      
      this.trajectoryGraphics.lineStyle(1.5, color, 0.6);
      this.drawSimpleTrajectory(trajectory);
    });

    // Draw active trajectory with smooth spline (only one at a time)
    this.activeTrajectories.forEach((trajectory) => {
      if (trajectory.length < 2) return;
      
      this.trajectoryGraphics.lineStyle(2, 0xffff00, 0.9);
      this.drawSimpleTrajectory(trajectory); // Use simple lines for performance
    });
  }

  /**
   * OPTIMIZED: Draw trajectory with simple lines (much faster than Catmull-Rom splines)
   * Subsample points to reduce number of line segments while maintaining shape
   */
  private drawSimpleTrajectory(points: { x: number; y: number }[]): void {
    if (points.length < 2) return;

      this.trajectoryGraphics.beginPath();
      this.trajectoryGraphics.moveTo(points[0].x, points[0].y);

    // Subsample: only draw every Nth point for performance (but keep smooth appearance)
    const step = Math.max(1, Math.floor(points.length / 50)); // Max 50 segments per trajectory
    
    for (let i = step; i < points.length; i += step) {
      this.trajectoryGraphics.lineTo(points[i].x, points[i].y);
    }
    
    // Always draw the last point
    if (points.length > 1) {
      const lastPoint = points[points.length - 1];
      this.trajectoryGraphics.lineTo(lastPoint.x, lastPoint.y);
    }

    this.trajectoryGraphics.strokePath();
  }

  /**
   * Create random level configuration for solo and P2P modes
   */
  private createRandomLevelConfig(): ILevelConfig {
    const biomes = [TerrainBiome.TEMPERATE, TerrainBiome.DESERT, TerrainBiome.ARCTIC, TerrainBiome.VOLCANIC];
    const shapes = [TerrainShape.HILLS, TerrainShape.MOUNTAINS];
    const weathers: Array<'none' | 'rain' | 'snow'> = ['none', 'rain', 'snow'];
    const times: Array<'day' | 'night'> = ['day', 'night'];
    const seasons: Array<'summer' | 'winter'> = ['summer', 'winter'];

    return {
      biome: biomes[Math.floor(Math.random() * biomes.length)],
      shape: shapes[Math.floor(Math.random() * shapes.length)],
      weather: weathers[Math.floor(Math.random() * weathers.length)],
      roughness: 0.10 + Math.random() * 0.40, // 0.10 to 0.50
      timeOfDay: times[Math.floor(Math.random() * times.length)],
      season: seasons[Math.floor(Math.random() * seasons.length)],
    };
  }
}