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
  }): void {
    this.onAngleChange = callbacks.onAngleChange;
    this.onPowerChange = callbacks.onPowerChange;
    this.onFire = callbacks.onFire;
    this.onShield = callbacks.onShield;
    this.onWeaponChange = callbacks.onWeaponChange;
    this.onDamage = callbacks.onDamage;
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
   * Handle incoming network message
   */
  private handleMessage(message: INetworkMessage): void {
    if (!message.type || !message.data) {
      return;
    }

    switch (message.type) {
      case 'angle':
        if (this.onAngleChange && typeof message.data === 'object' && 'angle' in message.data) {
          this.onAngleChange(message.data.angle as number);
        }
        break;

      case 'power':
        if (this.onPowerChange && typeof message.data === 'object' && 'power' in message.data) {
          this.onPowerChange(message.data.power as number);
        }
        break;

      case 'fire':
        if (this.onFire && typeof message.data === 'object' && 'angle' in message.data && 'power' in message.data && 'weaponType' in message.data) {
          this.onFire(
            message.data.angle as number,
            message.data.power as number,
            message.data.weaponType as string
          );
        }
        break;

      case 'shield':
        if (this.onShield && typeof message.data === 'object' && 'shieldType' in message.data) {
          this.onShield(message.data.shieldType as string);
        }
        break;

      case 'weaponChange':
        if (this.onWeaponChange && typeof message.data === 'object' && 'weaponType' in message.data) {
          this.onWeaponChange(message.data.weaponType as string);
        }
        break;

      case 'damage':
        if (this.onDamage && typeof message.data === 'object' && 'tankIndex' in message.data && 'damage' in message.data) {
          this.onDamage(message.data as IDamageMessage);
        }
        break;

      case 'ping':
        // Respond to ping with pong
        this.webrtcManager.sendMessage({ type: 'pong' });
        break;

      case 'pong':
        // Ping response received (could be used for latency measurement)
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

