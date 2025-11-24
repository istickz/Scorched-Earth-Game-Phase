import { type INetworkMessage, type IDamageMessage } from '@/types';
import { WebRTCManager } from './WebRTCManager';

/**
 * Network synchronization system for multiplayer
 */
export class NetworkSync {
  private webrtcManager: WebRTCManager;
  private onAngleChange?: (angle: number) => void;
  private onPowerChange?: (power: number) => void;
  private onFire?: (angle: number, power: number, weaponType: string) => void;
  private onShield?: (shieldType: string) => void;
  private onWeaponChange?: (weaponType: string) => void;
  private onDamage?: (damageData: IDamageMessage) => void;
  private onRestart?: () => void;
  private onReturnToLevelSelect?: () => void;
  private lastSentAngle: number | null = null;
  private lastSentPower: number | null = null;

  constructor(webrtcManager: WebRTCManager) {
    this.webrtcManager = webrtcManager;

    // Set up message handler
    this.webrtcManager.setOnMessage((message) => {
      this.handleMessage(message);
    });
  }

  /**
   * Set callbacks for remote player actions
   */
  public setCallbacks(callbacks: {
    onAngleChange?: (angle: number) => void;
    onPowerChange?: (power: number) => void;
    onFire?: (angle: number, power: number, weaponType: string) => void;
    onShield?: (shieldType: string) => void;
    onWeaponChange?: (weaponType: string) => void;
    onDamage?: (damageData: IDamageMessage) => void;
    onRestart?: () => void;
    onReturnToLevelSelect?: () => void;
  }): void {
    this.onAngleChange = callbacks.onAngleChange;
    this.onPowerChange = callbacks.onPowerChange;
    this.onFire = callbacks.onFire;
    this.onShield = callbacks.onShield;
    this.onWeaponChange = callbacks.onWeaponChange;
    this.onDamage = callbacks.onDamage;
    this.onRestart = callbacks.onRestart;
    this.onReturnToLevelSelect = callbacks.onReturnToLevelSelect;
  }

  /**
   * Send angle change to remote player
   */
  public sendAngle(angle: number): void {
    // Only send if changed significantly (reduce network traffic)
    if (this.lastSentAngle === null || Math.abs(this.lastSentAngle - angle) >= 1) {
      this.webrtcManager.sendMessage({
        type: 'angle',
        data: { angle },
      });
      this.lastSentAngle = angle;
    }
  }

  /**
   * Send power change to remote player
   */
  public sendPower(power: number): void {
    // Only send if changed significantly (reduce network traffic)
    if (this.lastSentPower === null || Math.abs(this.lastSentPower - power) >= 1) {
      this.webrtcManager.sendMessage({
        type: 'power',
        data: { power },
      });
      this.lastSentPower = power;
    }
  }

  /**
   * Send fire command to remote player
   */
  public sendFire(angle: number, power: number, weaponType: string): void {
    this.webrtcManager.sendMessage({
      type: 'fire',
      data: { angle, power, weaponType },
    });
    this.lastSentAngle = angle;
    this.lastSentPower = power;
  }

  /**
   * Send shield activation to remote player
   */
  public sendShield(shieldType: string): void {
    this.webrtcManager.sendMessage({
      type: 'shield',
      data: { shieldType },
    });
  }

  /**
   * Send weapon change to remote player
   */
  public sendWeaponChange(weaponType: string): void {
    this.webrtcManager.sendMessage({
      type: 'weaponChange',
      data: { weaponType },
    });
  }

  /**
   * Send damage message to remote player (host only)
   */
  public sendDamage(damageData: IDamageMessage): void {
    this.webrtcManager.sendMessage({
      type: 'damage',
      data: damageData,
    });
  }

  /**
   * Send restart message to remote player (host only)
   */
  public sendRestart(): void {
    this.webrtcManager.sendMessage({
      type: 'restart',
      data: {},
    });
  }

  /**
   * Send return to level select message to remote player (host only)
   */
  public sendReturnToLevelSelect(): void {
    this.webrtcManager.sendMessage({
      type: 'returnToLevelSelect',
      data: {},
    });
  }

  /**
   * Handle incoming network message
   */
  private handleMessage(message: INetworkMessage): void {
    if (!message.type) {
      return;
    }

    // Some message types don't require data (restart, returnToLevelSelect, ping, pong)
    const requiresData = ['angle', 'power', 'fire', 'shield', 'weaponChange', 'damage'].includes(message.type);
    if (requiresData && !message.data) {
      return;
    }

    switch (message.type) {
      case 'angle':
        if (this.onAngleChange && message.data && typeof message.data === 'object' && 'angle' in message.data) {
          this.onAngleChange(message.data.angle as number);
        }
        break;

      case 'power':
        if (this.onPowerChange && message.data && typeof message.data === 'object' && 'power' in message.data) {
          this.onPowerChange(message.data.power as number);
        }
        break;

      case 'fire':
        if (this.onFire && message.data && typeof message.data === 'object' && 'angle' in message.data && 'power' in message.data && 'weaponType' in message.data) {
          this.onFire(
            message.data.angle as number,
            message.data.power as number,
            message.data.weaponType as string
          );
        }
        break;

      case 'shield':
        if (this.onShield && message.data && typeof message.data === 'object' && 'shieldType' in message.data) {
          this.onShield(message.data.shieldType as string);
        }
        break;

      case 'weaponChange':
        if (this.onWeaponChange && message.data && typeof message.data === 'object' && 'weaponType' in message.data) {
          this.onWeaponChange(message.data.weaponType as string);
        }
        break;

      case 'damage':
        if (this.onDamage && message.data && typeof message.data === 'object' && 'tankIndex' in message.data && 'damage' in message.data) {
          this.onDamage(message.data as IDamageMessage);
        }
        break;

      case 'restart':
        if (this.onRestart) {
          this.onRestart();
        }
        break;

      case 'returnToLevelSelect':
        if (this.onReturnToLevelSelect) {
          this.onReturnToLevelSelect();
        }
        break;

      case 'ping':
        // Respond to ping with pong
        this.webrtcManager.sendMessage({ type: 'pong' });
        break;

      case 'pong':
        // Ping response received (could be used for latency measurement)
        break;

      case 'levelSelected':
      case 'startGame':
      case 'levelConfig':
      case 'ready':
        // These message types are handled by LobbyConnectionManager, not NetworkSync
        // Silently ignore them to avoid warnings
        break;

      default:
        console.warn('Unknown message type:', message.type);
    }
  }

  /**
   * Check if connected
   */
  public isConnected(): boolean {
    return this.webrtcManager.isConnected();
  }
}

