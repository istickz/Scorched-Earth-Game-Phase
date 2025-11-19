import Phaser from 'phaser';
import { GameMode, type ITankConfig, type AIDifficulty, type ILevelConfig, type IEnvironmentEffects } from '@/types';
import { TerrainSystem } from '@/systems/TerrainSystem';
import { SkyRenderer } from '@/systems/SkyRenderer';
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
import { ProjectileCollisionSystem } from '@/systems/game/ProjectileCollisionSystem';
import { getWeaponConfig } from '@/config/weapons';
import { WeaponType } from '@/types/weapons';

/**
 * Main game scene
 */
export class GameScene extends Phaser.Scene {
  private gameMode!: GameMode;
  private terrainSystem!: TerrainSystem;
  private skyRenderer!: SkyRenderer;
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
    const isNight = levelConfig.timeOfDay === 'night';
    
    // Create sky renderer first (renders behind everything)
    this.skyRenderer = new SkyRenderer(this, width, height, skyColor, isNight);
    
    // Create terrain system (only handles terrain logic and rendering)
    this.terrainSystem = new TerrainSystem(
      this,
      {
        width,
        height,
        terrainMinHeight: (levelConfig.terrainMinHeight ?? 0.1) * height,
        terrainMaxHeight: (levelConfig.terrainMaxHeight ?? 0.85) * height,
        seed: terrainSeed,
        shape: levelConfig.shape,
      },
      colors.ground,
      skyColor
    );

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
      onTurnChanged: (_newIndex: number) => {
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
    
    this.trajectorySystem = new TrajectorySystem(this, this.tanks, this.terrainSystem, levelConfig.timeOfDay, levelConfig.biome);
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

    const weapon1Handler = () => this.switchWeapon(WeaponType.STANDARD);
    const weapon2Handler = () => this.switchWeapon(WeaponType.SALVO);
    const weapon3Handler = () => this.switchWeapon(WeaponType.HAZELNUT);
    
    this.input.keyboard?.on('keydown-LEFT', leftHandler);
    this.input.keyboard?.on('keydown-RIGHT', rightHandler);
    this.input.keyboard?.on('keydown-UP', upHandler);
    this.input.keyboard?.on('keydown-DOWN', downHandler);
    this.input.keyboard?.on('keydown-SPACE', spaceHandler);
    this.input.keyboard?.on('keydown-ONE', weapon1Handler);
    this.input.keyboard?.on('keydown-TWO', weapon2Handler);
    this.input.keyboard?.on('keydown-THREE', weapon3Handler);
    
    this.inputHandlers.push(
      { event: 'keydown-LEFT', callback: leftHandler },
      { event: 'keydown-RIGHT', callback: rightHandler },
      { event: 'keydown-UP', callback: upHandler },
      { event: 'keydown-DOWN', callback: downHandler },
      { event: 'keydown-SPACE', callback: spaceHandler },
      { event: 'keydown-ONE', callback: weapon1Handler },
      { event: 'keydown-TWO', callback: weapon2Handler },
      { event: 'keydown-THREE', callback: weapon3Handler }
    );
  }

  /**
   * Switch weapon for current tank
   */
  private switchWeapon(weaponType: WeaponType): void {
    if (!this.turnSystem.canFire()) {
      return;
    }
    
    const currentIndex = this.turnSystem.getCurrentPlayerIndex();
    if (this.gameMode === GameMode.Multiplayer && currentIndex !== 0) {
      return;
    }
    
    const currentTank = this.tanks[currentIndex];
    if (currentTank && currentTank.isAlive()) {
      // Check if tank has ammunition for this weapon
      if (!currentTank.hasAmmo(weaponType)) {
        console.log('No ammunition for', weaponType);
        // TODO: Show visual feedback (flash text, play sound, etc.)
        return;
      }
      
      currentTank.setWeapon(weaponType);
      this.updateUI();
      this.trajectorySystem.updatePreview(currentTank, currentIndex);
    }
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

    // Check if tank has ammunition for current weapon
    const currentWeapon = currentTank.getWeapon();
    if (!currentTank.hasAmmo(currentWeapon)) {
      console.log('No ammunition for', currentWeapon);
      return;
    }

    this.turnSystem.setCanFire(false);
    this.turnSystem.setWaitingForProjectile(true);

    const fireData = currentTank.fire();
    const ownerId = `tank-${currentIndex}`;
    const weaponType = fireData.weaponType || WeaponType.STANDARD;
    
    // Consume ammunition after successful fire
    currentTank.consumeAmmo();
    
    // Check if weapon is salvo type
    const weaponConfig = getWeaponConfig(weaponType as WeaponType);
    
    if (weaponConfig.salvoCount && weaponConfig.salvoCount > 1) {
      // Fire salvo
      this.fireSalvo(fireData, ownerId, weaponConfig);
    } else {
      // Fire single projectile
      const projectile = new Projectile(this, {
        x: fireData.x,
        y: fireData.y,
        angle: fireData.angle,
        power: fireData.power,
        ownerId: ownerId,
        environmentEffects: this.environmentEffects,
        weaponType: weaponType,
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
  }

  /**
   * Check and split hazelnut projectiles when they reach the peak of trajectory
   * Splits dynamically when projectile starts falling down (velocityY > 0)
   */
  private checkAndSplitHazelnutProjectiles(): void {
    const projectilesToSplit: Projectile[] = [];
    
    this.activeProjectiles.forEach((projectile) => {
      const weaponType = projectile.getWeaponType();
      if (weaponType === WeaponType.HAZELNUT && !projectile.hasAlreadySplit()) {
        // Check if projectile has reached the peak and started falling
        // Split when: velocityY > 0 (falling) AND traveled minimum distance
        const velocity = projectile.getVelocity();
        const distanceTraveled = projectile.getDistanceTraveled();
        const minDistance = 100; // Minimum distance before split (prevents immediate split)
        
        if (velocity.y > 0 && distanceTraveled > minDistance) {
          projectilesToSplit.push(projectile);
        }
      }
    });
    
    // Split projectiles
    projectilesToSplit.forEach((projectile) => {
      this.splitHazelnutProjectile(projectile);
    });
  }
  
  /**
   * Split a hazelnut projectile into multiple projectiles
   */
  private splitHazelnutProjectile(projectile: Projectile): void {
    const weaponConfig = getWeaponConfig(WeaponType.HAZELNUT);
    const splitCount = weaponConfig.splitCount || 6;
    const splitSpread = weaponConfig.splitSpread || 15;
    
    // Get current projectile state
    const currentX = projectile.x;
    const currentY = projectile.y;
    const ownerId = projectile.getOwnerId();
    
    // Get current speed (for maintaining similar drop speed)
    const currentSpeed = projectile.getSpeed();
    
    // Hazelnut projectiles fall vertically down (90 degrees) with slight horizontal spread
    const baseAngle = 90; // Vertical down in Phaser (0=right, 90=down, 180=left, 270=up)
    
    // Calculate horizontal angle spread (small deviation from vertical)
    const startAngle = baseAngle - (splitSpread / 2);
    const angleStep = splitSpread / (splitCount - 1);
    
    // Use moderate power for vertical drop (not too fast, not too slow)
    // Slightly less power than current speed to simulate realistic separation
    const speedMultiplier = 50; // Standard speed multiplier
    const power = Math.max(30, (currentSpeed / speedMultiplier) * 70); // 70% of current speed, minimum 30
    
    // Mark original projectile as split and make it invisible
    projectile.markAsSplit();
    projectile.setVisible(false);
    projectile.stopFlightSound();
    
    // Add current position to trajectory before saving (important!)
    this.trajectorySystem.addTrajectoryPoint(projectile, { x: currentX, y: currentY });
    
    // Save trajectory of the original projectile before splitting
    this.trajectorySystem.saveTrajectory(projectile, { x: currentX, y: currentY });
    
    // Create new projectiles
    for (let i = 0; i < splitCount; i++) {
      const angle = startAngle + (angleStep * i);
      
      const newProjectile = new Projectile(this, {
        x: currentX,
        y: currentY,
        angle: angle,
        power: power,
        ownerId: ownerId,
        environmentEffects: this.environmentEffects,
        weaponType: WeaponType.STANDARD, // Split projectiles are standard type
      });
      
      // Initialize trajectory for new projectile
      this.trajectorySystem.initializeTrajectory(newProjectile);
      this.activeProjectiles.push(newProjectile);
    }
    
    // Remove original projectile from active list immediately (before next update cycle)
    const index = this.activeProjectiles.indexOf(projectile);
    if (index !== -1) {
      this.activeProjectiles.splice(index, 1);
    }
    
    // Destroy visual after a short delay to allow visual effect
    this.time.delayedCall(10, () => {
      projectile.destroy();
    });
  }

  /**
   * Fire a salvo of projectiles (multiple projectiles from one barrel)
   */
  private fireSalvo(
    fireData: { x: number; y: number; angle: number; power: number; weaponType: string },
    ownerId: string,
    weaponConfig: { salvoCount?: number; salvoSpread?: number; salvoDelay?: number }
  ): void {
    const salvoCount = weaponConfig.salvoCount || 6;
    const salvoSpread = weaponConfig.salvoSpread || 8;
    const salvoDelay = weaponConfig.salvoDelay || 50;
    
    // Calculate angle spread
    const startAngle = fireData.angle - (salvoSpread / 2);
    const angleStep = salvoSpread / (salvoCount - 1);
    
    for (let i = 0; i < salvoCount; i++) {
      const delay = i * salvoDelay;
      const angle = startAngle + (angleStep * i);
      
      this.time.delayedCall(delay, () => {
        const projectile = new Projectile(this, {
          x: fireData.x,
          y: fireData.y,
          angle: angle,
          power: fireData.power,
          ownerId: ownerId,
          environmentEffects: this.environmentEffects,
          weaponType: fireData.weaponType,
        });

        if (i === 0) {
          // Only track first projectile for shot data
          this.lastShotData.set(projectile.getOwnerId(), {
            angle: fireData.angle,
            power: fireData.power,
            ownerId: ownerId,
          });
        }

        this.trajectorySystem.initializeTrajectory(projectile);
        this.activeProjectiles.push(projectile);
        
        if (i === 0) {
          this.trajectorySystem.clearPreview();
          this.audioSystem.playFire();
        }
      });
    }
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

    // Наносим урон танкам (используем сохраненные позиции для безопасности)
    this.tanks.forEach((tank) => {
      if (!tank.isAlive()) {
        return;
      }

      const tankPos = tankPositions.get(tank);
      if (!tankPos || !tankPos.isAlive) {
        return; // Танк уже был уничтожен предыдущим взрывом
      }

      const tankHitboxRadius = 35;
      const effectiveRadius = data.radius + tankHitboxRadius;
      
      // Используем сохраненную позицию вместо tank.x/tank.y (танк может быть уничтожен)
      const distance = Phaser.Math.Distance.Between(data.x, data.y, tankPos.x, tankPos.y);
      if (distance <= effectiveRadius) {
        const damage = this.explosionSystem.calculateDamage(
          Math.max(0, distance - tankHitboxRadius),
          data.radius, 
          data.damage
        );
        
        // Проверяем еще раз перед нанесением урона
        if (tank.isAlive()) {
          tank.takeDamage(damage);
          // Обновляем флаг после нанесения урона
          if (!tank.isAlive()) {
            tankPos.isAlive = false;
          }
        }
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
    // Only check once, not for every explosion (prevents multiple turn switches)
    // This check is now handled in update() loop after all collisions are processed
  }


  update(_time: number, delta: number): void {
    // Check if game is over
    const isGameOver = this.gameOverSystem.checkGameOver();
    if (isGameOver) {
      this.turnSystem.setGameOver(true);
      // Stop all projectile flight sounds when game ends
      this.activeProjectiles.forEach((projectile) => {
        projectile.stopFlightSound();
      });
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

    // Check for hazelnut projectiles that need to split
    this.checkAndSplitHazelnutProjectiles();

    // Check collisions using collision system
    const collisions = this.collisionSystem.checkCollisions(this.activeProjectiles);
    const projectilesToRemove: Projectile[] = [];

    let explosionPlayed = false; // Play explosion sound only once per frame
    
    collisions.forEach((collision) => {
      const { projectile, hitPoint, hitType } = collision;
      
      // Move projectile sprite to exact hit point for visual consistency
      projectile.x = hitPoint.x;
      projectile.y = hitPoint.y;

      if (hitType === 'tank' || hitType === 'terrain') {
        this.trajectorySystem.saveTrajectory(projectile, hitPoint);
        
        // Get weapon config for explosion parameters
        const weaponType = projectile.getWeaponType() || WeaponType.STANDARD;
        const weaponConfig = getWeaponConfig(weaponType as WeaponType);
        
        this.explosionSystem.explode(
          hitPoint.x, 
          hitPoint.y, 
          weaponConfig.explosionRadius, 
          weaponConfig.explosionDamage, 
          projectile.getOwnerId(),
          weaponType,
          weaponConfig.explosionColor
        );
        
        // Play explosion sound only once per frame (for salvo weapons)
        if (!explosionPlayed) {
          this.audioSystem.playExplosion(weaponType);
          explosionPlayed = true;
        }
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
      // Complete current shot (save all trajectories as one shot)
      this.trajectorySystem.completeCurrentShot();
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
    if (this.terrainSystem) {
      this.terrainSystem.destroy();
    }
    if (this.skyRenderer) {
      this.skyRenderer.destroy();
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