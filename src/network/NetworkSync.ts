import { type INetworkMessage } from '@/types';
import { WebRTCManager } from './WebRTCManager';

/**
 * Network synchronization system for multiplayer
 */
export class NetworkSync {
  private webrtcManager: WebRTCManager;
  private onAngleChange?: (angle: number) => void;
  private onPowerChange?: (power: number) => void;
  private onFire?: (angle: number, power: number) => void;
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
    onFire?: (angle: number, power: number) => void;
  }): void {
    this.onAngleChange = callbacks.onAngleChange;
    this.onPowerChange = callbacks.onPowerChange;
    this.onFire = callbacks.onFire;
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
  public sendFire(angle: number, power: number): void {
    this.webrtcManager.sendMessage({
      type: 'fire',
      data: { angle, power },
    });
    this.lastSentAngle = angle;
    this.lastSentPower = power;
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
        if (this.onFire && typeof message.data === 'object' && 'angle' in message.data && 'power' in message.data) {
          this.onFire(message.data.angle as number, message.data.power as number);
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

