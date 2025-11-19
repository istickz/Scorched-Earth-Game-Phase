import Phaser from 'phaser';
import { GameMode, type ITankConfig, type AIDifficulty, type ILevelConfig, type IEnvironmentEffects } from '@/types';
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
import { createRandomLevelConfig } from '@/utils/levelUtils';
import { UISystem } from '@/systems/game/UISystem';
import { TurnSystem } from '@/systems/game/TurnSystem';
import { GameOverSystem } from '@/systems/game/GameOverSystem';
import { TrajectorySystem } from '@/systems/game/TrajectorySystem';
import { ProjectileCollisionSystem, type ICollisionResult } from '@/systems/game/ProjectileCollisionSystem';

/**
 * Main game scene
 */
export class GameScene extends Phaser.Scene {
  private gameMode!: GameMode;
  private terrainSystem!: TerrainSystem;
  private tanks: Tank[] = [];
  private activeProjectiles: Projectile[] = [];
  private explosionSystem!: ExplosionSystem;
  private aiSystem?: AISystem;
  private lastExplosionHit: { x: number; y: number } | null = null;
  private lastShotData: Map<string, { angle: number; power: number; ownerId: string }> = new Map();
  private webrtcManager?: WebRTCManager;
  private networkSync?: NetworkSync;
  private audioSystem!: AudioSystem;
  private environmentEffects!: IEnvironmentEffects;
  
  // Game systems
  private uiSystem!: UISystem;
  private turnSystem!: TurnSystem;
  private gameOverSystem!: GameOverSystem;
  private trajectorySystem!: TrajectorySystem;
  private collisionSystem!: ProjectileCollisionSystem;
  
  // Input handlers for cleanup
  private inputHandlers: Array<{ event: string; callback: () => void }> = [];

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
    this.tanks = [];
    this.activeProjectiles = [];
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
      levelConfig = createRandomLevelConfig();
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
      terrainMinHeight: (levelConfig.terrainMinHeight ?? 0.1) * height,
      terrainMaxHeight: (levelConfig.terrainMaxHeight ?? 0.85) * height,
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
    
    // Initialize game systems
    this.uiSystem = new UISystem(this);
    this.uiSystem.setup();
    
    this.turnSystem = new TurnSystem(this, this.tanks, this.gameMode, this.aiSystem);
    this.turnSystem.setCallbacks({
      onTurnChanged: (newIndex: number) => {
        // Turn changed callback
      },
      onFireRequested: () => {
        this.fireProjectile();
      },
      onUIUpdate: () => {
        this.updateUI();
      },
    });
    
    this.gameOverSystem = new GameOverSystem(
      this,
      this.tanks,
      this.gameMode,
      this.aiDifficulty,
      this.currentLevelIndex
    );
    
    this.trajectorySystem = new TrajectorySystem(this, this.tanks, this.terrainSystem);
    this.trajectorySystem.setup();
    
    this.collisionSystem = new ProjectileCollisionSystem(this, this.tanks, this.terrainSystem);
    
    this.setupInput();
    this.updateUI();

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

  private updateUI(): void {
    const currentTank = this.tanks[this.turnSystem.getCurrentPlayerIndex()];
    this.uiSystem.update(
      currentTank,
      this.turnSystem.getCurrentPlayerIndex(),
      this.gameMode,
      this.currentLevelIndex
    );
  }

  private setupNetworkSync(): void {
    if (!this.networkSync) {
      return;
    }

    this.networkSync.setCallbacks({
      onAngleChange: (angle: number) => {
        if (this.tanks[1] && this.turnSystem.getCurrentPlayerIndex() === 1) {
          this.tanks[1].setTurretAngle(angle);
          this.updateUI();
        }
      },
      onPowerChange: (power: number) => {
        if (this.tanks[1] && this.turnSystem.getCurrentPlayerIndex() === 1) {
          this.tanks[1].setPower(power);
          this.updateUI();
        }
      },
      onFire: (angle: number, power: number) => {
        if (this.tanks[1] && this.turnSystem.getCurrentPlayerIndex() === 1) {
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
    const leftHandler = () => {
      if (!this.turnSystem.canFire()) {
        return;
      }
      const currentIndex = this.turnSystem.getCurrentPlayerIndex();
      // In P2P multiplayer, only player 1 can control. In local, both players control.
      if (this.gameMode === GameMode.Multiplayer && currentIndex !== 0) {
        return;
      }
      if (this.tanks[currentIndex]?.isAlive()) {
        const newAngle = this.tanks[currentIndex].getTurretAngle() - 5;
        this.tanks[currentIndex].setTurretAngle(newAngle);
        this.updateUI();
        this.trajectorySystem.updatePreview(this.tanks[currentIndex], currentIndex);
        if (this.networkSync && this.gameMode === GameMode.Multiplayer) {
          this.networkSync.sendAngle(newAngle);
        }
      }
    };

    const rightHandler = () => {
      if (!this.turnSystem.canFire()) {
        return;
      }
      const currentIndex = this.turnSystem.getCurrentPlayerIndex();
      if (this.gameMode === GameMode.Multiplayer && currentIndex !== 0) {
        return;
      }
      if (this.tanks[currentIndex]?.isAlive()) {
        const newAngle = this.tanks[currentIndex].getTurretAngle() + 5;
        this.tanks[currentIndex].setTurretAngle(newAngle);
        this.updateUI();
        this.trajectorySystem.updatePreview(this.tanks[currentIndex], currentIndex);
        if (this.networkSync && this.gameMode === GameMode.Multiplayer) {
          this.networkSync.sendAngle(newAngle);
        }
      }
    };

    const upHandler = () => {
      if (!this.turnSystem.canFire()) {
        return;
      }
      const currentIndex = this.turnSystem.getCurrentPlayerIndex();
      if (this.gameMode === GameMode.Multiplayer && currentIndex !== 0) {
        return;
      }
      if (this.tanks[currentIndex]?.isAlive()) {
        const newPower = this.tanks[currentIndex].getPower() + 5;
        this.tanks[currentIndex].setPower(newPower);
        this.updateUI();
        this.trajectorySystem.updatePreview(this.tanks[currentIndex], currentIndex);
        if (this.networkSync && this.gameMode === GameMode.Multiplayer) {
          this.networkSync.sendPower(newPower);
        }
      }
    };

    const downHandler = () => {
      if (!this.turnSystem.canFire()) {
        return;
      }
      const currentIndex = this.turnSystem.getCurrentPlayerIndex();
      if (this.gameMode === GameMode.Multiplayer && currentIndex !== 0) {
        return;
      }
      if (this.tanks[currentIndex]?.isAlive()) {
        const newPower = this.tanks[currentIndex].getPower() - 5;
        this.tanks[currentIndex].setPower(newPower);
        this.updateUI();
        this.trajectorySystem.updatePreview(this.tanks[currentIndex], currentIndex);
        if (this.networkSync && this.gameMode === GameMode.Multiplayer) {
          this.networkSync.sendPower(newPower);
        }
      }
    };

    const spaceHandler = () => {
      if (!this.turnSystem.canFire()) {
        return;
      }
      const currentIndex = this.turnSystem.getCurrentPlayerIndex();
      if (this.gameMode === GameMode.Multiplayer && currentIndex !== 0) {
        return;
      }
      if (this.tanks[currentIndex]?.isAlive()) {
        if (this.networkSync && this.gameMode === GameMode.Multiplayer) {
          const tank = this.tanks[currentIndex];
          this.networkSync.sendFire(tank.getTurretAngle(), tank.getPower());
        }
        this.fireProjectile();
      }
    };

    this.input.keyboard?.on('keydown-LEFT', leftHandler);
    this.input.keyboard?.on('keydown-RIGHT', rightHandler);
    this.input.keyboard?.on('keydown-UP', upHandler);
    this.input.keyboard?.on('keydown-DOWN', downHandler);
    this.input.keyboard?.on('keydown-SPACE', spaceHandler);
    
    this.inputHandlers.push(
      { event: 'keydown-LEFT', callback: leftHandler },
      { event: 'keydown-RIGHT', callback: rightHandler },
      { event: 'keydown-UP', callback: upHandler },
      { event: 'keydown-DOWN', callback: downHandler },
      { event: 'keydown-SPACE', callback: spaceHandler }
    );
  }

  private fireProjectile(): void {
    if (!this.turnSystem.canFire()) {
      return;
    }

    const currentIndex = this.turnSystem.getCurrentPlayerIndex();
    const currentTank = this.tanks[currentIndex];
    if (!currentTank || !currentTank.isAlive()) {
      return;
    }

    this.turnSystem.setCanFire(false);
    this.turnSystem.setWaitingForProjectile(true);

    const fireData = currentTank.fire();
    const ownerId = `tank-${currentIndex}`;
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

    this.trajectorySystem.initializeTrajectory(projectile);
    this.activeProjectiles.push(projectile);
    this.trajectorySystem.clearPreview();

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

    // Schedule turn switch if waiting for projectile and explosion happened
    if (this.turnSystem.isWaitingForProjectile() && this.activeProjectiles.length === 0) {
      this.turnSystem.scheduleTurnSwitch(50);
    }
  }


  update(_time: number, delta: number): void {
    // Check if game is over
    const isGameOver = this.gameOverSystem.checkGameOver();
    if (isGameOver) {
      this.turnSystem.setGameOver(true);
      return;
    }

    this.tanks.forEach((tank) => {
      if (tank.isAlive()) {
        tank.checkGroundSupport(this.terrainSystem);
      }
    });

    // Update trajectory preview if can fire
    const currentIndex = this.turnSystem.getCurrentPlayerIndex();
    if (this.tanks[currentIndex]?.isAlive() && this.turnSystem.canFire()) {
      this.trajectorySystem.updatePreview(this.tanks[currentIndex], currentIndex);
    }

    // Update projectile positions with manual physics (before collision detection)
    this.activeProjectiles.forEach((projectile) => {
      projectile.updatePosition(delta);
    });

    // Check collisions using collision system
    const collisions = this.collisionSystem.checkCollisions(this.activeProjectiles);
    const projectilesToRemove: Projectile[] = [];

    collisions.forEach((collision) => {
      const { projectile, hitPoint, hitType } = collision;
      
      // Move projectile sprite to exact hit point for visual consistency
      projectile.x = hitPoint.x;
      projectile.y = hitPoint.y;

      if (hitType === 'tank' || hitType === 'terrain') {
        this.trajectorySystem.saveTrajectory(projectile, hitPoint);
        this.explosionSystem.explode(hitPoint.x, hitPoint.y, 30, 50, projectile.getOwnerId());
        this.audioSystem.playExplosion();
      } else if (hitType === 'outOfBounds') {
        this.trajectorySystem.saveTrajectory(projectile, hitPoint);
      }
      
      projectilesToRemove.push(projectile);
    });

    // Remove destroyed projectiles
    projectilesToRemove.forEach((projectile) => {
      const index = this.activeProjectiles.indexOf(projectile);
      if (index !== -1) {
        this.trajectorySystem.removeTrajectory(projectile);
        projectile.destroy();
        this.activeProjectiles.splice(index, 1);
      }
    });

    // Switch turn if all projectiles are gone
    if (projectilesToRemove.length > 0 && this.turnSystem.isWaitingForProjectile() && this.activeProjectiles.length === 0) {
      this.turnSystem.scheduleTurnSwitch(50);
    }

    // Update trajectories and last positions for next frame
    this.activeProjectiles.forEach((projectile) => {
      this.trajectorySystem.addTrajectoryPoint(projectile, { x: projectile.x, y: projectile.y });
      projectile.updateLastPosition();
    });

    // Draw trajectories
    this.trajectorySystem.drawTrajectories();
  }

  /**
   * Clean up resources when scene shuts down
   */
  shutdown(): void {
    // Clean up systems
    if (this.uiSystem) {
      this.uiSystem.destroy();
    }
    if (this.turnSystem) {
      this.turnSystem.destroy();
    }
    if (this.gameOverSystem) {
      this.gameOverSystem.destroy();
    }
    if (this.trajectorySystem) {
      this.trajectorySystem.destroy();
    }

    // Clean up input handlers
    this.inputHandlers.forEach((handler) => {
      this.input.keyboard?.off(handler.event, handler.callback);
    });
    this.inputHandlers = [];

    // Clean up event listeners
    this.events.off('explosion', this.handleExplosion, this);
  }
}