import Phaser from 'phaser';
import { GameMode, type ITankConfig } from '@/types';
import { TerrainSystem } from '@/systems/TerrainSystem';
import { Tank } from '@/entities/Tank';
import { Projectile } from '@/entities/Projectile';
import { ExplosionSystem } from '@/systems/ExplosionSystem';
import { AISystem } from '@/systems/AISystem';
import { WebRTCManager } from '@/network/WebRTCManager';
import { NetworkSync } from '@/network/NetworkSync';
import { AudioSystem } from '@/systems/AudioSystem';

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
  private uiText!: Phaser.GameObjects.Text;
  private trajectoryPreview!: Phaser.GameObjects.Graphics;
  private canFire: boolean = true;
  private waitingForProjectile: boolean = false;
  private isSwitchingTurn: boolean = false;
  private aiSystem!: AISystem;
  private lastExplosionHit: { x: number; y: number } | null = null;
  private lastShotData: Map<string, { angle: number; power: number; ownerId: string }> = new Map();
  private webrtcManager?: WebRTCManager;
  private networkSync?: NetworkSync;
  private audioSystem!: AudioSystem;
  // Trajectory tracking system
  private activeTrajectories: Map<Projectile, { x: number; y: number }[]> = new Map();
  private completedTrajectories: { x: number; y: number }[][] = [];
  private trajectoryGraphics!: Phaser.GameObjects.Graphics;
  private readonly MAX_TRAJECTORIES = 5;

  constructor() {
    super({ key: 'GameScene' });
  }

  init(data: { gameMode?: GameMode; webrtcManager?: WebRTCManager }): void {
    this.gameMode = data?.gameMode || GameMode.Solo;
    this.webrtcManager = data?.webrtcManager;
  }

  create(): void {
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;

    if (this.matter) {
      this.matter.world.setBounds(0, 0, width, height);
      if (this.matter.world.engine) {
        this.matter.world.engine.timing.timeScale = 12.0;
      }
    }

    const terrainSeed = Math.random() * 1000000;
    
    this.terrainSystem = new TerrainSystem(this, {
      width,
      height,
      minHeight: height * 0.45,
      maxHeight: height * 0.85,
      roughness: 0.2,
      seed: terrainSeed,
    });

    this.explosionSystem = new ExplosionSystem(this, this.terrainSystem);

    this.audioSystem = new AudioSystem();
    this.audioSystem.resume();
    (this as any).audioSystem = this.audioSystem;

    if (this.gameMode === GameMode.Solo) {
      this.aiSystem = new AISystem(this, this.terrainSystem);
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
      isPlayer: this.gameMode === GameMode.Multiplayer,
    };

    const tank1 = new Tank(this, tank1Config);
    tank1.positionOnTerrain(tank1Y);
    this.tanks.push(tank1);

    const tank2 = new Tank(this, tank2Config);
    tank2.positionOnTerrain(tank2Y);
    this.tanks.push(tank2);
  }

  private setupUI(): void {
    this.uiText = this.add.text(20, 20, '', {
      fontSize: '18px',
      color: '#ffffff',
      backgroundColor: '#000000',
      padding: { x: 10, y: 5 },
    });

    this.add.text(20, 60, 'Controls: ← → (Angle) | ↑ ↓ (Power) | SPACE (Fire)', {
      fontSize: '14px',
      color: '#aaaaaa',
      backgroundColor: '#000000',
      padding: { x: 10, y: 5 },
    });

    this.trajectoryPreview = this.add.graphics();
    this.trajectoryPreview.setDepth(1);

    this.trajectoryGraphics = this.add.graphics();
    this.trajectoryGraphics.setDepth(4);

    this.updateUI();
  }

  private updateUI(): void {
    const currentTank = this.tanks[this.currentPlayerIndex];
    if (!currentTank || !currentTank.isAlive()) {
      return;
    }

    const modeText = this.gameMode === GameMode.Solo ? 'Singleplayer' : 'P2P Multiplayer';
    const isAITurn = this.gameMode === GameMode.Solo && this.currentPlayerIndex === 1;
    const playerText = isAITurn ? 'AI Thinking...' : `Player ${this.currentPlayerIndex + 1}`;
    const angleText = `Angle: ${currentTank.getTurretAngle().toFixed(0)}°`;
    const powerText = `Power: ${currentTank.getPower().toFixed(0)}%`;

    this.uiText.setText(`${modeText} | ${playerText} | ${angleText} | ${powerText}`);
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

    this.add.text(width / 2, height / 2, 'Connection Lost', {
      fontSize: '32px',
      color: '#ff0000',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    this.add.text(width / 2, height / 2 + 50, 'Press R to return to menu', {
      fontSize: '20px',
      color: '#ffffff',
    }).setOrigin(0.5);

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

  private updateTrajectoryPreview(): void {
    const currentTank = this.tanks[this.currentPlayerIndex];
    if (!currentTank || !currentTank.isAlive()) {
      return;
    }

    this.trajectoryPreview.clear();
    this.trajectoryPreview.lineStyle(2, 0xffffff, 0.5);

    const fireData = currentTank.fire();
    const points: Phaser.Math.Vector2[] = [];

    for (let t = 0; t < 5; t += 0.1) {
      const angleRad = Phaser.Math.DegToRad(fireData.angle);
      const velocity = (fireData.power / 100) * 50;
      const velocityX = Math.cos(angleRad) * velocity;
      const velocityY = Math.sin(angleRad) * velocity;

      const x = fireData.x + velocityX * t;
      const y = fireData.y + velocityY * t + 0.5 * 1.0 * t * t;

      if (x >= 0 && x < this.cameras.main.width && y >= 0 && y < this.cameras.main.height) {
        points.push(new Phaser.Math.Vector2(x, y));
      }
    }

    if (points.length > 1) {
      this.trajectoryPreview.strokePoints(points, false);
    }
  }

  private fireProjectile(): void {
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

    if (this.gameMode === GameMode.Solo && this.aiSystem && this.lastExplosionHit && data.ownerId === 'tank-1') {
      const shotData = this.lastShotData.get(data.ownerId);
      
      if (shotData) {
        const aiTank = this.tanks[1];
        const playerTank = this.tanks[0];
        if (aiTank && playerTank) {
          const distance = Phaser.Math.Distance.Between(
            this.lastExplosionHit.x,
            this.lastExplosionHit.y,
            playerTank.x,
            playerTank.y
          );

          this.aiSystem.recordShotResult({
            angle: shotData.angle,
            power: shotData.power,
            hitX: this.lastExplosionHit.x,
            hitY: this.lastExplosionHit.y,
            targetX: playerTank.x,
            targetY: playerTank.y,
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

    if (this.gameMode === GameMode.Solo && this.currentPlayerIndex === 1 && this.aiSystem) {
      this.handleAITurn();
    }
  }

  private handleAITurn(): void {
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
    const aliveTanks = this.tanks.filter((tank) => tank.isAlive());

    if (aliveTanks.length === 1) {
      const winnerIndex = this.tanks.findIndex((tank) => tank.isAlive());
      this.showGameOver(`Player ${winnerIndex + 1} Wins!`);
    } else if (aliveTanks.length === 0) {
      this.showGameOver('Draw!');
    }
  }

  private showGameOver(message: string): void {
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;

    this.add.text(width / 2, height / 2, message, {
      fontSize: '48px',
      color: '#ffffff',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    this.add.text(width / 2, height / 2 + 60, 'Press R to restart', {
      fontSize: '24px',
      color: '#ffffff',
    }).setOrigin(0.5);

    this.input.keyboard?.once('keydown-R', () => {
      this.scene.restart();
    });
  }

  update(): void {
    this.tanks.forEach((tank) => {
      if (tank.isAlive()) {
        tank.checkGroundSupport(this.terrainSystem);
      }
    });

    if (this.tanks[this.currentPlayerIndex]?.isAlive() && this.canFire && !this.waitingForProjectile) {
      this.updateTrajectoryPreview();
    }

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

    // Обновляем траектории
    this.activeProjectiles.forEach((projectile) => {
      const trajectory = this.activeTrajectories.get(projectile);
      if (trajectory) {
        trajectory.push({ x: projectile.x, y: projectile.y });
      }
      projectile.updateLastPosition();
    });

    this.drawTrajectories();
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
    }
  }

  private drawTrajectories(): void {
    this.trajectoryGraphics.clear();

    this.completedTrajectories.forEach((trajectory, index) => {
      if (trajectory.length < 2) return;
      
      const colors = [0xffffff, 0xffff00, 0xffaa00, 0xff8800, 0xff6600];
      const color = colors[Math.min(index, colors.length - 1)];
      
      this.trajectoryGraphics.lineStyle(1.5, color, 0.6);
      this.drawSmoothTrajectory(trajectory);
    });

    this.activeTrajectories.forEach((trajectory) => {
      if (trajectory.length < 2) return;
      
      this.trajectoryGraphics.lineStyle(2, 0xffff00, 0.9);
      this.drawSmoothTrajectory(trajectory);
    });
  }

  private drawSmoothTrajectory(points: { x: number; y: number }[]): void {
    if (points.length < 2) return;

    if (points.length === 2) {
      this.trajectoryGraphics.beginPath();
      this.trajectoryGraphics.moveTo(points[0].x, points[0].y);
      this.trajectoryGraphics.lineTo(points[1].x, points[1].y);
      this.trajectoryGraphics.strokePath();
      return;
    }

    this.trajectoryGraphics.beginPath();
    this.trajectoryGraphics.moveTo(points[0].x, points[0].y);

    for (let i = 0; i < points.length - 1; i++) {
      const p0 = i > 0 ? points[i - 1] : points[i];
      const p1 = points[i];
      const p2 = points[i + 1];
      const p3 = i < points.length - 2 ? points[i + 2] : points[i + 1];

      const segments = 8;
      for (let j = 1; j <= segments; j++) {
        const t = j / segments;
        
        const t2 = t * t;
        const t3 = t2 * t;
        
        const x = 0.5 * (
          (2 * p1.x) +
          (-p0.x + p2.x) * t +
          (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 +
          (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3
        );
        
        const y = 0.5 * (
          (2 * p1.y) +
          (-p0.y + p2.y) * t +
          (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 +
          (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3
        );
        
        this.trajectoryGraphics.lineTo(x, y);
      }
    }

    this.trajectoryGraphics.strokePath();
  }
}