import Phaser from 'phaser';
import { WebRTCManager } from '@/network/WebRTCManager';
import { type ConnectionState } from '@/types';

/**
 * Multiplayer lobby scene for WebRTC connection setup
 */
export class MultiplayerLobbyScene extends Phaser.Scene {
  private webrtcManager!: WebRTCManager;
  private isHost: boolean = false;
  private statusText!: Phaser.GameObjects.BitmapText;
  private statusTextShadow!: Phaser.GameObjects.BitmapText;
  private offerText!: Phaser.GameObjects.BitmapText;
  private offerTextShadow!: Phaser.GameObjects.BitmapText;
  private answerText!: Phaser.GameObjects.BitmapText;
  private answerTextShadow!: Phaser.GameObjects.BitmapText;
  private offerInput!: Phaser.GameObjects.DOMElement | Phaser.GameObjects.BitmapText;
  private answerInput!: Phaser.GameObjects.DOMElement | { node: HTMLTextAreaElement; destroy: () => void };
  private iceCandidates: RTCIceCandidateInit[] = [];
  private remoteIceCandidates: RTCIceCandidateInit[] = [];

  constructor() {
    super({ key: 'MultiplayerLobbyScene' });
  }

  create(): void {
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;

    // Title with shadow (bitmap font)
    const titleShadow = this.add.bitmapText(width / 2 + 2, 52, 'pixel-font', 'P2P Multiplayer Setup', 32);
    titleShadow.setTintFill(0x000000);
    titleShadow.setOrigin(0.5);

    const title = this.add.bitmapText(width / 2, 50, 'pixel-font', 'P2P Multiplayer Setup', 32);
    title.setTintFill(0xffffff);
    title.setOrigin(0.5);

    // Status text with shadow (bitmap font)
    this.statusTextShadow = this.add.bitmapText(width / 2 + 1, 121, 'pixel-font', 'Choose your role:', 20);
    this.statusTextShadow.setTintFill(0x000000);
    this.statusTextShadow.setOrigin(0.5);

    this.statusText = this.add.bitmapText(width / 2, 120, 'pixel-font', 'Choose your role:', 20);
    this.statusText.setTintFill(0xffffff);
    this.statusText.setOrigin(0.5);

    // Create host/join buttons
    this.createButton(width / 2, 180, 'Create Game (Host)', () => this.startAsHost());
    this.createButton(width / 2, 250, 'Join Game (Client)', () => this.startAsClient());

    // Instructions with shadow (bitmap font)
    const instructionsStr = 'Copy and paste the SDP offer/answer between players';
    const instructionsShadow = this.add.bitmapText(width / 2 + 1, height - 99, 'pixel-font', instructionsStr, 16);
    instructionsShadow.setTintFill(0x000000);
    instructionsShadow.setOrigin(0.5);

    const instructions = this.add.bitmapText(width / 2, height - 100, 'pixel-font', instructionsStr, 16);
    instructions.setTintFill(0xaaaaaa);
    instructions.setOrigin(0.5);

    // Initialize WebRTC manager
    try {
      // Check if WebRTC is supported
      if (typeof RTCPeerConnection === 'undefined') {
        const errorMsg = 'WebRTC is not supported in this browser. Please use a modern browser.';
        this.statusText.setText(errorMsg);
        this.statusTextShadow.setText(errorMsg);
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
      const errorMsg = `Error initializing WebRTC: ${errorMessage}`;
      this.statusText.setText(errorMsg);
      this.statusTextShadow.setText(errorMsg);
    }
  }

  /**
   * Start as host (creates offer)
   */
  private async startAsHost(): Promise<void> {
    if (!this.webrtcManager) {
      const errorMsg = 'WebRTC not initialized. Please refresh the page.';
      this.statusText.setText(errorMsg);
      this.statusTextShadow.setText(errorMsg);
      return;
    }

    this.isHost = true;
    const creatingMsg = 'Creating offer...';
    this.statusText.setText(creatingMsg);
    this.statusTextShadow.setText(creatingMsg);

    try {
      // Check if WebRTC is supported
      if (!window.RTCPeerConnection) {
        throw new Error('WebRTC is not supported in this browser');
      }

      const offer = await this.webrtcManager.createOffer();
      const offerString = JSON.stringify(offer);

      // Display offer
      this.showOfferInput(offerString);
      const successMsg = 'Offer created! Share it with the other player.';
      this.statusText.setText(successMsg);
      this.statusTextShadow.setText(successMsg);
    } catch (error) {
      console.error('Error creating offer:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorMsg = `Error creating offer: ${errorMessage}. Please try again.`;
      this.statusText.setText(errorMsg);
      this.statusTextShadow.setText(errorMsg);
    }
  }

  /**
   * Start as client (waits for offer)
   */
  private startAsClient(): void {
    this.isHost = false;
    this.showAnswerInput();
    const waitingMsg = 'Waiting for offer from host...';
    this.statusText.setText(waitingMsg);
    this.statusTextShadow.setText(waitingMsg);
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
    if (this.offerTextShadow) {
      this.offerTextShadow.destroy();
    }

    // Label with shadow (bitmap font)
    const offerLabelStr = 'Your Offer (copy this):';
    this.offerTextShadow = this.add.bitmapText(width / 2 + 1, 321, 'pixel-font', offerLabelStr, 18);
    this.offerTextShadow.setTintFill(0x000000);
    this.offerTextShadow.setOrigin(0.5);

    this.offerText = this.add.bitmapText(width / 2, 320, 'pixel-font', offerLabelStr, 18);
    this.offerText.setTintFill(0xffffff);
    this.offerText.setOrigin(0.5);

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
      // Fallback: use bitmap text instead
      const textShadow = this.add.bitmapText(width / 2 + 1, 381, 'pixel-font', offerString, 10);
      textShadow.setTintFill(0x000000);
      textShadow.setOrigin(0.5);
      
      const text = this.add.bitmapText(width / 2, 380, 'pixel-font', offerString, 10);
      text.setTintFill(0xffffff);
      text.setOrigin(0.5);
      this.offerInput = text;
    }

    // Copy button
    this.createButton(width / 2, 450, 'Copy Offer', () => {
      offerElement.select();
      document.execCommand('copy');
      const copiedMsg = 'Offer copied to clipboard!';
      this.statusText.setText(copiedMsg);
      this.statusTextShadow.setText(copiedMsg);
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
    if (this.answerTextShadow) {
      this.answerTextShadow.destroy();
    }

    // Label with shadow (bitmap font)
    this.answerTextShadow = this.add.bitmapText(width / 2 + 1, 521, 'pixel-font', labelText, 18);
    this.answerTextShadow.setTintFill(0x000000);
    this.answerTextShadow.setOrigin(0.5);

    this.answerText = this.add.bitmapText(width / 2, 520, 'pixel-font', labelText, 18);
    this.answerText.setTintFill(0xffffff);
    this.answerText.setOrigin(0.5);

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
      this.answerInput = { node: answerElement, destroy: () => container.remove() };
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
        if (this.answerInput && 'node' in this.answerInput && this.answerInput.node) {
          const textarea = this.answerInput.node;
          if (textarea instanceof HTMLTextAreaElement) {
            textarea.value = answerString;
          }
        }
        const answerCreatedMsg = 'Answer created! Share it with the host.';
        this.statusText.setText(answerCreatedMsg);
        this.statusTextShadow.setText(answerCreatedMsg);
      }

      // Add any pending ICE candidates
      for (const candidate of this.remoteIceCandidates) {
        await this.webrtcManager.addIceCandidate(candidate);
      }
      this.remoteIceCandidates = [];
    } catch (error) {
      console.error('Error handling SDP:', error);
      const errorMsg = 'Invalid SDP. Please check and try again.';
      this.statusText.setText(errorMsg);
      this.statusTextShadow.setText(errorMsg);
    }
  }

  /**
   * Update status display
   */
  private updateStatus(state: ConnectionState): void {
    let statusMsg = '';
    switch (state) {
      case 'connecting':
        statusMsg = 'Connecting...';
        break;
      case 'connected':
        statusMsg = 'Connected! Starting game...';
        // Start game after short delay
        this.time.delayedCall(1000, () => {
        this.scene.start('GameScene', {
          gameMode: 'multiplayer',
          webrtcManager: this.webrtcManager,
        });
        });
        break;
      case 'disconnected':
        statusMsg = 'Disconnected';
        break;
      case 'error':
        statusMsg = 'Connection error. Please try again.';
        break;
    }
    if (statusMsg) {
      this.statusText.setText(statusMsg);
      this.statusTextShadow.setText(statusMsg);
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

    // Button text with shadow (bitmap font)
    const buttonTextShadow = this.add.bitmapText(1, 1, 'pixel-font', text, 18);
    buttonTextShadow.setTintFill(0x000000);
    buttonTextShadow.setOrigin(0.5);

    const buttonText = this.add.bitmapText(0, 0, 'pixel-font', text, 18);
    buttonText.setTintFill(0xffffff);
    buttonText.setOrigin(0.5);

    const container = this.add.container(x, y, [bg, buttonTextShadow, buttonText]);
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

