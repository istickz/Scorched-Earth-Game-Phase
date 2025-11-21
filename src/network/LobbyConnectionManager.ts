import Phaser from 'phaser';
import { WebRTCManager } from './WebRTCManager';
import { type ConnectionState, type ILevelConfig, type INetworkMessage } from '@/types';

/**
 * Lobby connection manager for WebRTC connection setup and game synchronization
 * Handles offer/answer creation, ICE candidate management, and game start coordination
 */
export class LobbyConnectionManager extends Phaser.Events.EventEmitter {
  private webrtcManager: WebRTCManager;
  private isHost: boolean = false;
  private iceCandidates: RTCIceCandidateInit[] = [];
  private connectionTimeout?: ReturnType<typeof setTimeout>;
  private gameStartTimer?: ReturnType<typeof setTimeout>;
  private waitingForReady: boolean = false;
  private waitingForStart: boolean = false;
  private levelConfig?: ILevelConfig;

  constructor(webrtcManager: WebRTCManager) {
    super();
    this.webrtcManager = webrtcManager;

    // Set up WebRTC manager callbacks
    this.webrtcManager.setOnStateChange((state) => {
      this.handleConnectionStateChange(state);
    });

    this.webrtcManager.setOnIceCandidate((candidate) => {
      const candidateJson = candidate.toJSON();
      this.iceCandidates.push(candidateJson);
      console.log('ICE candidate collected:', candidateJson);
    });

    this.webrtcManager.setOnMessage((message) => {
      this.handleMessage(message);
    });
  }

  /**
   * Initialize as host and create offer with ICE candidates
   */
  public async createOfferWithCandidates(): Promise<string> {
    if (!this.webrtcManager) {
      throw new Error('WebRTC manager not initialized');
    }

    this.isHost = true;
    this.iceCandidates = []; // Clear previous candidates

    if (!window.RTCPeerConnection) {
      throw new Error('WebRTC is not supported in this browser');
    }

    const offer = await this.webrtcManager.createOffer();

    // Wait for ICE gathering to complete
    const gatheringComplete = new Promise<void>((resolve) => {
      let resolved = false;
      const resolveOnce = () => {
        if (!resolved) {
          resolved = true;
          resolve();
        }
      };

      const checkGathering = () => {
        const state = this.webrtcManager.getIceGatheringState();
        console.log('ICE gathering state:', state);
        if (state === 'complete') {
          resolveOnce();
        } else if (state === 'gathering') {
          // Continue checking
          setTimeout(checkGathering, 100);
        }
      };

      // If already complete, resolve immediately
      if (this.webrtcManager.getIceGatheringState() === 'complete') {
        resolveOnce();
      } else {
        // Set callback for completion
        this.webrtcManager.setOnIceGatheringComplete(() => {
          console.log('ICE gathering complete callback fired');
          resolveOnce();
        });
        // Also check periodically in case callback doesn't fire
        setTimeout(checkGathering, 100);
      }
    });

    // Wait for ICE gathering to complete (max 5 seconds)
    await Promise.race([
      gatheringComplete,
      new Promise<void>((resolve) => {
        setTimeout(() => {
          console.log('ICE gathering timeout - proceeding anyway');
          resolve();
        }, 5000);
      }),
    ]);

    // Create object with offer and candidates
    const offerWithCandidates = {
      sdp: offer,
      candidates: this.iceCandidates,
    };
    const offerString = JSON.stringify(offerWithCandidates);

    // Emit event for UI
    this.emit('offerCreated', offerString);

    return offerString;
  }

  /**
   * Handle answer from client (host side)
   */
  public async handleAnswerFromClient(answerString: string): Promise<void> {
    if (!this.isHost) {
      throw new Error('This method should only be called by host');
    }

    const { sdp, candidates } = this.parseSDP(answerString);

    console.log('Host: Setting remote description (answer)');
    await this.webrtcManager.setRemoteDescription(sdp);

    // Add ICE candidates from answer
    console.log(`Host: Adding ${candidates.length} ICE candidates from answer`);
    for (const candidate of candidates) {
      try {
        await this.webrtcManager.addIceCandidate(candidate);
      } catch (error) {
        console.warn('Error adding ICE candidate:', error);
      }
    }

    // Also add collected local ICE candidates
    console.log(`Host: Adding ${this.iceCandidates.length} local ICE candidates`);
    for (const candidate of this.iceCandidates) {
      try {
        await this.webrtcManager.addIceCandidate(candidate);
      } catch (error) {
        console.warn('Error adding local ICE candidate:', error);
      }
    }

    // Set connection timeout for diagnostics
    this.setConnectionTimeout();
  }

  /**
   * Handle offer from host and create answer (client side)
   */
  public async handleOfferFromHost(offerString: string): Promise<string> {
    if (this.isHost) {
      throw new Error('This method should only be called by client');
    }

    this.isHost = false;
    this.iceCandidates = []; // Clear previous candidates

    const { sdp, candidates } = this.parseSDP(offerString);

    // First add ICE candidates from offer
    console.log(`Client: Adding ${candidates.length} ICE candidates from offer`);
    for (const candidate of candidates) {
      try {
        await this.webrtcManager.addIceCandidate(candidate);
      } catch (error) {
        console.warn('Error adding ICE candidate from offer:', error);
      }
    }

    console.log('Client: Creating answer from offer');
    const answer = await this.webrtcManager.createAnswer(sdp);

    // Wait for ICE gathering to complete for answer
    const gatheringComplete = new Promise<void>((resolve) => {
      let resolved = false;
      const resolveOnce = () => {
        if (!resolved) {
          resolved = true;
          resolve();
        }
      };

      const checkGathering = () => {
        const state = this.webrtcManager.getIceGatheringState();
        console.log('ICE gathering state (client):', state);
        if (state === 'complete') {
          resolveOnce();
        } else if (state === 'gathering') {
          // Continue checking
          setTimeout(checkGathering, 100);
        }
      };

      // If already complete, resolve immediately
      if (this.webrtcManager.getIceGatheringState() === 'complete') {
        resolveOnce();
      } else {
        // Set callback for completion
        this.webrtcManager.setOnIceGatheringComplete(() => {
          console.log('ICE gathering complete callback fired (client)');
          resolveOnce();
        });
        // Also check periodically in case callback doesn't fire
        setTimeout(checkGathering, 100);
      }
    });

    // Wait for ICE gathering to complete (max 5 seconds)
    await Promise.race([
      gatheringComplete,
      new Promise<void>((resolve) => {
        setTimeout(() => {
          console.log('ICE gathering timeout (client) - proceeding anyway');
          resolve();
        }, 5000);
      }),
    ]);

    // Create object with answer and candidates
    const answerWithCandidates = {
      sdp: answer,
      candidates: this.iceCandidates,
    };
    const answerString = JSON.stringify(answerWithCandidates);

    // Emit event for UI
    this.emit('answerCreated', answerString);

    return answerString;
  }

  /**
   * Parse SDP string (supports both old and new format with candidates)
   */
  private parseSDP(sdpString: string): {
    sdp: RTCSessionDescriptionInit;
    candidates: RTCIceCandidateInit[];
  } {
    const parsed = JSON.parse(sdpString);
    console.log('Parsed SDP input:', {
      hasCandidates: 'candidates' in parsed,
      hasSdp: 'sdp' in parsed,
      hasType: 'type' in parsed,
      type: parsed.type || parsed.sdp?.type,
      candidatesCount: parsed.candidates?.length || 0,
    });

    let sdp: RTCSessionDescriptionInit;
    let candidates: RTCIceCandidateInit[] = [];

    // Check if candidates field exists - this means new format
    if ('candidates' in parsed && Array.isArray(parsed.candidates)) {
      // New format: { sdp: {...}, candidates: [...] }
      if (!parsed.sdp || !parsed.sdp.type) {
        throw new Error('Invalid SDP format: missing sdp object');
      }
      sdp = parsed.sdp;
      candidates = parsed.candidates;
      console.log(`Using new format: ${candidates.length} candidates`);
    } else if (parsed.type && (parsed.type === 'offer' || parsed.type === 'answer')) {
      // Old format: only SDP (object with type and sdp)
      sdp = parsed;
      candidates = [];
      console.log('Using old format (no candidates)');
    } else {
      console.error('Invalid SDP format. Parsed object keys:', Object.keys(parsed));
      console.error('Parsed object:', parsed);
      throw new Error(
        'Invalid SDP format: expected {sdp: {...}, candidates: [...]} or {type: "...", sdp: "..."}'
      );
    }

    return { sdp, candidates };
  }

  /**
   * Set connection timeout to detect stuck connections
   */
  private setConnectionTimeout(): void {
    // Clear previous timeout if exists
    if (this.connectionTimeout) {
      clearTimeout(this.connectionTimeout);
    }

    // Set timeout for 30 seconds
    this.connectionTimeout = setTimeout(() => {
      const currentState = this.webrtcManager.getConnectionState();
      if (currentState === 'connecting') {
        console.warn('Connection timeout - still in connecting state');
        const timeoutMsg =
          'Connection timeout. Please check:\n1. Both players are on the same network\n2. Firewall is not blocking WebRTC\n3. Try refreshing and reconnecting';
        this.emit('error', timeoutMsg);
      }
    }, 30000);
  }

  /**
   * Handle connection state changes
   */
  private handleConnectionStateChange(state: ConnectionState): void {
    console.log('Connection state changed:', state);

    // Clear timeout on successful connection or error
    if (state === 'connected' || state === 'error' || state === 'disconnected') {
      if (this.connectionTimeout) {
        clearTimeout(this.connectionTimeout);
        this.connectionTimeout = undefined;
      }
    }

    // Emit state change event
    this.emit('connectionStateChanged', state);

    if (state === 'connected') {
      if (this.isHost) {
        // Host waits for levelConfig to be sent (by scene) and then waits for "ready" from client
        this.waitingForReady = true;

        // Fallback timer in case "ready" doesn't arrive
        this.gameStartTimer = setTimeout(() => {
          console.warn('Host: Ready timeout, starting game anyway');
          this.waitingForReady = false;
          this.emit('gameReady', this.levelConfig);
        }, 5000);
      } else {
        // Client waits for levelConfig and "start game" signal
        this.waitingForStart = true;

        // Fallback timer in case messages don't arrive
        this.gameStartTimer = setTimeout(() => {
          console.warn('Client: Start game timeout, starting game anyway');
          this.waitingForStart = false;
          this.emit('gameReady', this.levelConfig);
        }, 5000);
      }
    }
  }

  /**
   * Handle network messages for game synchronization
   */
  private handleMessage(message: INetworkMessage): void {
    if (message.type === 'levelConfig' && message.data) {
      console.log('Received levelConfig from host');
      this.levelConfig = message.data as ILevelConfig;

      // Client sends "ready" to host after receiving levelConfig
      if (!this.isHost) {
        console.log('Client: Sending ready to host');
        this.webrtcManager.sendMessage({
          type: 'ready',
          data: {},
        });
        this.waitingForStart = true;
      }
    } else if (message.type === 'ready') {
      // Host receives "ready" from client
      if (this.isHost && this.waitingForReady) {
        console.log('Host: Received ready from client, sending start game signal');
        this.waitingForReady = false;

        // Cancel fallback timer
        if (this.gameStartTimer) {
          clearTimeout(this.gameStartTimer);
          this.gameStartTimer = undefined;
        }

        // Send "start game" signal to client
        this.webrtcManager.sendMessage({
          type: 'startGame',
          data: {},
        });

        // Start game on host
        this.emit('gameReady', this.levelConfig);
      }
    } else if (message.type === 'startGame') {
      // Client receives "start game" signal from host
      if (!this.isHost && this.waitingForStart) {
        console.log('Client: Received start game signal from host');
        this.waitingForStart = false;

        // Cancel fallback timer
        if (this.gameStartTimer) {
          clearTimeout(this.gameStartTimer);
          this.gameStartTimer = undefined;
        }

        // Start game on client
        this.emit('gameReady', this.levelConfig);
      }
    }
  }

  /**
   * Send level config to client (host only)
   */
  public sendLevelConfig(levelConfig: ILevelConfig): void {
    if (!this.isHost) {
      throw new Error('Only host can send level config');
    }

    this.levelConfig = levelConfig;

    console.log('Host: Generated levelConfig with seed:', levelConfig.seed);

    // Send to client
    if (this.webrtcManager && this.webrtcManager.isConnected()) {
      this.webrtcManager.sendMessage({
        type: 'levelConfig',
        data: levelConfig,
      });
      console.log('Host: Sent levelConfig to client');
    } else {
      console.warn('Host: Cannot send levelConfig - not connected yet');
    }
  }

  /**
   * Get WebRTC manager (for passing to GameScene)
   */
  public getWebRTCManager(): WebRTCManager {
    return this.webrtcManager;
  }

  /**
   * Get isHost flag
   */
  public getIsHost(): boolean {
    return this.isHost;
  }

  /**
   * Get level config (for passing to GameScene)
   */
  public getLevelConfig(): ILevelConfig | undefined {
    return this.levelConfig;
  }

  /**
   * Cleanup resources
   */
  public cleanup(): void {
    console.log('Cleaning up LobbyConnectionManager...');

    // Clear timeouts
    if (this.connectionTimeout) {
      clearTimeout(this.connectionTimeout);
      this.connectionTimeout = undefined;
    }

    if (this.gameStartTimer) {
      clearTimeout(this.gameStartTimer);
      this.gameStartTimer = undefined;
    }

    // Reset flags to stop waiting
    this.waitingForReady = false;
    this.waitingForStart = false;

    // КРИТИЧЕСКИ ВАЖНО: остановить WebRTC соединение
    // Это остановит ICE gathering и закроет data channel
    if (this.webrtcManager) {
      this.webrtcManager.disconnect();
    }

    // Remove all event listeners
    this.removeAllListeners();
  }
}

