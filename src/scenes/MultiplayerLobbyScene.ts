import Phaser from 'phaser';
import { WebRTCManager } from '@/network/WebRTCManager';
import { type ConnectionState } from '@/types';

/**
 * Multiplayer lobby scene for WebRTC connection setup
 */
export class MultiplayerLobbyScene extends Phaser.Scene {
  private webrtcManager!: WebRTCManager;
  private isHost: boolean = false;
  private statusText!: Phaser.GameObjects.Text;
  private offerText!: Phaser.GameObjects.Text;
  private answerText!: Phaser.GameObjects.Text;
  private offerInput!: Phaser.GameObjects.DOMElement;
  private answerInput!: Phaser.GameObjects.DOMElement;
  private iceCandidates: RTCIceCandidateInit[] = [];
  private remoteIceCandidates: RTCIceCandidateInit[] = [];

  constructor() {
    super({ key: 'MultiplayerLobbyScene' });
  }

  create(): void {
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;

    // Title
    this.add.text(width / 2, 50, 'P2P Multiplayer Setup', {
      fontSize: '32px',
      color: '#ffffff',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    // Status text
    this.statusText = this.add.text(width / 2, 120, 'Choose your role:', {
      fontSize: '20px',
      color: '#ffffff',
    }).setOrigin(0.5);

    // Create host/join buttons
    this.createButton(width / 2, 180, 'Create Game (Host)', () => this.startAsHost());
    this.createButton(width / 2, 250, 'Join Game (Client)', () => this.startAsClient());

    // Instructions
    this.add.text(width / 2, height - 100, 'Copy and paste the SDP offer/answer between players', {
      fontSize: '16px',
      color: '#aaaaaa',
    }).setOrigin(0.5);

    // Initialize WebRTC manager
    try {
      // Check if WebRTC is supported
      if (typeof RTCPeerConnection === 'undefined') {
        this.statusText.setText('WebRTC is not supported in this browser. Please use a modern browser.');
        return;
      }

      this.webrtcManager = new WebRTCManager();
      this.webrtcManager.setOnStateChange((state) => {
        this.updateStatus(state);
      });

      // Set up ICE candidate handler
      this.webrtcManager.setOnIceCandidate((candidate) => {
        this.iceCandidates.push(candidate.toJSON());
      });
    } catch (error) {
      console.error('Error initializing WebRTC:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.statusText.setText(`Error initializing WebRTC: ${errorMessage}`);
    }
  }

  /**
   * Start as host (creates offer)
   */
  private async startAsHost(): Promise<void> {
    if (!this.webrtcManager) {
      this.statusText.setText('WebRTC not initialized. Please refresh the page.');
      return;
    }

    this.isHost = true;
    this.statusText.setText('Creating offer...');

    try {
      // Check if WebRTC is supported
      if (!window.RTCPeerConnection) {
        throw new Error('WebRTC is not supported in this browser');
      }

      const offer = await this.webrtcManager.createOffer();
      const offerString = JSON.stringify(offer);

      // Display offer
      this.showOfferInput(offerString);
      this.statusText.setText('Offer created! Share it with the other player.');
    } catch (error) {
      console.error('Error creating offer:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.statusText.setText(`Error creating offer: ${errorMessage}. Please try again.`);
    }
  }

  /**
   * Start as client (waits for offer)
   */
  private startAsClient(): void {
    this.isHost = false;
    this.showAnswerInput();
    this.statusText.setText('Waiting for offer from host...');
  }

  /**
   * Show offer input field
   */
  private showOfferInput(offerString: string): void {
    const width = this.cameras.main.width;

    // Remove existing inputs
    if (this.offerInput) {
      this.offerInput.destroy();
    }
    if (this.offerText) {
      this.offerText.destroy();
    }

    // Label
    this.offerText = this.add.text(width / 2, 320, 'Your Offer (copy this):', {
      fontSize: '18px',
      color: '#ffffff',
    }).setOrigin(0.5);

    // Create textarea for offer
    const offerElement = document.createElement('textarea');
    offerElement.value = offerString;
    offerElement.style.width = '600px';
    offerElement.style.height = '100px';
    offerElement.style.fontSize = '12px';
    offerElement.style.padding = '8px';
    offerElement.style.border = '1px solid #666';
    offerElement.style.borderRadius = '4px';
    offerElement.style.backgroundColor = '#2a2a2a';
    offerElement.style.color = '#ffffff';
    offerElement.style.fontFamily = 'monospace';
    offerElement.readOnly = true;

    // Create DOM element (container is created automatically with dom: { createContainer: true })
    try {
      this.offerInput = this.add.dom(width / 2, 380, offerElement);
    } catch (error) {
      console.error('Error creating DOM element:', error);
      // Fallback: use text object instead
      const text = this.add.text(width / 2, 380, offerString, {
        fontSize: '10px',
        color: '#ffffff',
        wordWrap: { width: 600 },
        backgroundColor: '#2a2a2a',
        padding: { x: 8, y: 8 },
      }).setOrigin(0.5);
      this.offerInput = text as any;
    }

    // Copy button
    this.createButton(width / 2, 450, 'Copy Offer', () => {
      offerElement.select();
      document.execCommand('copy');
      this.statusText.setText('Offer copied to clipboard!');
    });

    // Answer input (for host to paste answer)
    this.showAnswerInput();
  }

  /**
   * Show answer input field
   */
  private showAnswerInput(): void {
    const width = this.cameras.main.width;

    // Remove existing answer input
    if (this.answerInput) {
      this.answerInput.destroy();
    }

    const labelText = this.isHost ? 'Paste Answer here:' : 'Paste Offer here:';
    if (this.answerText) {
      this.answerText.destroy();
    }

    this.answerText = this.add.text(width / 2, 520, labelText, {
      fontSize: '18px',
      color: '#ffffff',
    }).setOrigin(0.5);

    // Create textarea for answer/offer
    const answerElement = document.createElement('textarea');
    answerElement.style.width = '600px';
    answerElement.style.height = '100px';
    answerElement.style.fontSize = '12px';
    answerElement.style.padding = '8px';
    answerElement.style.border = '1px solid #666';
    answerElement.style.borderRadius = '4px';
    answerElement.style.backgroundColor = '#2a2a2a';
    answerElement.style.color = '#ffffff';
    answerElement.style.fontFamily = 'monospace';
    answerElement.placeholder = 'Paste SDP here...';

    // Create DOM element (container is created automatically with dom: { createContainer: true })
    try {
      this.answerInput = this.add.dom(width / 2, 580, answerElement);
    } catch (error) {
      console.error('Error creating DOM element:', error);
      // Fallback: use native DOM
      const container = document.createElement('div');
      container.style.position = 'absolute';
      container.style.left = `${width / 2 - 300}px`;
      container.style.top = '580px';
      container.style.width = '600px';
      container.appendChild(answerElement);
      document.body.appendChild(container);
      this.answerInput = { node: answerElement, destroy: () => container.remove() } as any;
    }

    // Submit button
    const buttonText = this.isHost ? 'Submit Answer' : 'Submit Offer';
    this.createButton(width / 2, 650, buttonText, () => {
      const sdpString = answerElement.value.trim();
      if (sdpString) {
        this.handleSDPInput(sdpString);
      }
    });
  }

  /**
   * Handle SDP input (offer or answer)
   */
  private async handleSDPInput(sdpString: string): Promise<void> {
    try {
      const sdp: RTCSessionDescriptionInit = JSON.parse(sdpString);

      if (this.isHost) {
        // Host receives answer
        await this.webrtcManager.setRemoteDescription(sdp);
        this.statusText.setText('Answer received! Connecting...');
      } else {
        // Client receives offer - createAnswer will set remote description
        const answer = await this.webrtcManager.createAnswer(sdp);
        const answerString = JSON.stringify(answer);

        // Show answer to copy
        this.showAnswerInput();
        if (this.answerInput && this.answerInput.node) {
          (this.answerInput.node as HTMLTextAreaElement).value = answerString;
        }
        this.statusText.setText('Answer created! Share it with the host.');
      }

      // Add any pending ICE candidates
      for (const candidate of this.remoteIceCandidates) {
        await this.webrtcManager.addIceCandidate(candidate);
      }
      this.remoteIceCandidates = [];
    } catch (error) {
      console.error('Error handling SDP:', error);
      this.statusText.setText('Invalid SDP. Please check and try again.');
    }
  }

  /**
   * Update status display
   */
  private updateStatus(state: ConnectionState): void {
    switch (state) {
      case 'connecting':
        this.statusText.setText('Connecting...');
        break;
      case 'connected':
        this.statusText.setText('Connected! Starting game...');
        // Start game after short delay
        this.time.delayedCall(1000, () => {
        this.scene.start('GameScene', {
          gameMode: 'multiplayer',
          webrtcManager: this.webrtcManager,
        });
        });
        break;
      case 'disconnected':
        this.statusText.setText('Disconnected');
        break;
      case 'error':
        this.statusText.setText('Connection error. Please try again.');
        break;
    }
  }

  /**
   * Create a button
   */
  private createButton(x: number, y: number, text: string, callback: () => void): Phaser.GameObjects.Container {
    const buttonWidth = 250;
    const buttonHeight = 50;

    const bg = this.add.graphics();
    bg.fillStyle(0x4a4a4a);
    bg.fillRoundedRect(-buttonWidth / 2, -buttonHeight / 2, buttonWidth, buttonHeight, 10);
    bg.lineStyle(2, 0xffffff);
    bg.strokeRoundedRect(-buttonWidth / 2, -buttonHeight / 2, buttonWidth, buttonHeight, 10);

    const buttonText = this.add.text(0, 0, text, {
      fontSize: '18px',
      color: '#ffffff',
    }).setOrigin(0.5);

    const container = this.add.container(x, y, [bg, buttonText]);
    container.setSize(buttonWidth, buttonHeight);
    container.setInteractive({ useHandCursor: true });

    container.on('pointerover', () => {
      bg.clear();
      bg.fillStyle(0x5a5a5a);
      bg.fillRoundedRect(-buttonWidth / 2, -buttonHeight / 2, buttonWidth, buttonHeight, 10);
      bg.lineStyle(2, 0xffffff);
      bg.strokeRoundedRect(-buttonWidth / 2, -buttonHeight / 2, buttonWidth, buttonHeight, 10);
    });

    container.on('pointerout', () => {
      bg.clear();
      bg.fillStyle(0x4a4a4a);
      bg.fillRoundedRect(-buttonWidth / 2, -buttonHeight / 2, buttonWidth, buttonHeight, 10);
      bg.lineStyle(2, 0xffffff);
      bg.strokeRoundedRect(-buttonWidth / 2, -buttonHeight / 2, buttonWidth, buttonHeight, 10);
    });

    container.on('pointerdown', callback);

    return container;
  }

  shutdown(): void {
    // Clean up WebRTC connection if leaving scene
    if (this.webrtcManager) {
      // Don't close here - pass to GameScene
    }
  }
}

