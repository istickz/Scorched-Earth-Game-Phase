import { type INetworkMessage, type ConnectionState } from '@/types';

/**
 * WebRTC connection manager for multiplayer
 */
export class WebRTCManager {
  private peerConnection: RTCPeerConnection | null = null;
  private dataChannel: RTCDataChannel | null = null;
  private connectionState: ConnectionState = 'disconnected';
  private onMessageCallback?: (message: INetworkMessage) => void;
  private onStateChangeCallback?: (state: ConnectionState) => void;

  // STUN server configuration
  private readonly rtcConfig: RTCConfiguration = {
    iceServers: [
      {
        urls: 'stun:stun.l.google.com:19302',
      },
    ],
  };

  constructor() {
    // Check if WebRTC is supported
    if (typeof RTCPeerConnection === 'undefined') {
      throw new Error('WebRTC is not supported in this browser');
    }

    try {
      // Initialize peer connection
      this.peerConnection = new RTCPeerConnection(this.rtcConfig);

      // Set up ICE candidate handler
      this.peerConnection.onicecandidate = (event) => {
        if (event.candidate && this.onIceCandidateCallback) {
          this.onIceCandidateCallback(event.candidate);
        }
      };

      // Handle connection state changes
      this.peerConnection.onconnectionstatechange = () => {
        console.log('Peer connection state:', this.peerConnection?.connectionState);
        console.log('ICE connection state:', this.peerConnection?.iceConnectionState);
        console.log('ICE gathering state:', this.peerConnection?.iceGatheringState);
        this.updateConnectionState();
      };

      // Handle ICE gathering state changes
      this.peerConnection.onicegatheringstatechange = () => {
        const state = this.peerConnection?.iceGatheringState;
        console.log('ICE gathering state changed:', state);
        if (state === 'complete' && this.onIceGatheringCompleteCallback) {
          this.onIceGatheringCompleteCallback();
        }
      };

      // Handle errors
      this.peerConnection.oniceconnectionstatechange = () => {
        const state = this.peerConnection?.iceConnectionState;
        if (state === 'failed') {
          console.error('ICE connection failed');
          this.connectionState = 'error';
          if (this.onStateChangeCallback) {
            this.onStateChangeCallback(this.connectionState);
          }
        }
      };
    } catch (error) {
      console.error('Error initializing RTCPeerConnection:', error);
      throw new Error(`Failed to initialize WebRTC: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private onIceCandidateCallback?: (candidate: RTCIceCandidate) => void;
  private onIceGatheringCompleteCallback?: () => void;

  /**
   * Set callback for ICE candidates
   */
  public setOnIceCandidate(callback: (candidate: RTCIceCandidate) => void): void {
    this.onIceCandidateCallback = callback;
  }

  /**
   * Set callback for ICE gathering completion
   */
  public setOnIceGatheringComplete(callback: () => void): void {
    this.onIceGatheringCompleteCallback = callback;
  }

  /**
   * Get current ICE gathering state
   */
  public getIceGatheringState(): RTCIceGatheringState {
    return this.peerConnection?.iceGatheringState || 'new';
  }

  /**
   * Set callback for received messages
   */
  public setOnMessage(callback: (message: INetworkMessage) => void): void {
    this.onMessageCallback = callback;
  }

  /**
   * Set callback for connection state changes
   */
  public setOnStateChange(callback: (state: ConnectionState) => void): void {
    this.onStateChangeCallback = callback;
  }

  /**
   * Initialize as connection initiator (creates offer)
   */
  public async createOffer(): Promise<RTCSessionDescriptionInit> {
    if (!this.peerConnection) {
      throw new Error('Peer connection not initialized');
    }

    try {
      // Create data channel
      this.dataChannel = this.peerConnection.createDataChannel('game', {
        ordered: true,
      });

      this.setupDataChannel();

      // Create offer with options for better compatibility
      const offer = await this.peerConnection.createOffer({
        offerToReceiveAudio: false,
        offerToReceiveVideo: false,
      });
      
      await this.peerConnection.setLocalDescription(offer);

      return offer;
    } catch (error) {
      console.error('Error in createOffer:', error);
      throw new Error(`Failed to create offer: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Initialize as connection receiver (creates answer)
   */
  public async createAnswer(offer: RTCSessionDescriptionInit): Promise<RTCSessionDescriptionInit> {
    if (!this.peerConnection) {
      throw new Error('Peer connection not initialized');
    }

    try {
      // Set up data channel handler (receiver side) BEFORE setting remote description
      // This ensures we catch the data channel event when it's created
      this.peerConnection.ondatachannel = (event) => {
        console.log('Data channel received from remote peer');
        this.dataChannel = event.channel;
        this.setupDataChannel();
      };

      // Set remote description
      await this.peerConnection.setRemoteDescription(offer);

      // Create answer with options for better compatibility
      const answer = await this.peerConnection.createAnswer({
        offerToReceiveAudio: false,
        offerToReceiveVideo: false,
      });
      
      await this.peerConnection.setLocalDescription(answer);

      return answer;
    } catch (error) {
      console.error('Error in createAnswer:', error);
      throw new Error(`Failed to create answer: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Set remote description (for offer/answer exchange)
   */
  public async setRemoteDescription(description: RTCSessionDescriptionInit): Promise<void> {
    if (!this.peerConnection) {
      throw new Error('Peer connection not initialized');
    }

    await this.peerConnection.setRemoteDescription(description);
  }

  /**
   * Add ICE candidate
   */
  public async addIceCandidate(candidate: RTCIceCandidateInit): Promise<void> {
    if (!this.peerConnection) {
      throw new Error('Peer connection not initialized');
    }

    await this.peerConnection.addIceCandidate(candidate);
  }

  /**
   * Set up data channel event handlers
   */
  private setupDataChannel(): void {
    if (!this.dataChannel) {
      return;
    }

    console.log('Setting up data channel, current state:', this.dataChannel.readyState);

    this.dataChannel.onopen = () => {
      console.log('Data channel opened!');
      this.updateConnectionState();
    };

    this.dataChannel.onclose = () => {
      console.log('Data channel closed');
      this.updateConnectionState();
    };

    this.dataChannel.onerror = (error) => {
      console.error('Data channel error:', error);
      this.connectionState = 'error';
      if (this.onStateChangeCallback) {
        this.onStateChangeCallback(this.connectionState);
      }
    };

    this.dataChannel.onmessage = (event) => {
      try {
        const message: INetworkMessage = JSON.parse(event.data);
        if (this.onMessageCallback) {
          this.onMessageCallback(message);
        }
      } catch (error) {
        console.error('Error parsing message:', error);
      }
    };
  }

  /**
   * Send message through data channel
   */
  public sendMessage(message: INetworkMessage): void {
    if (!this.dataChannel || this.dataChannel.readyState !== 'open') {
      console.warn('Data channel not ready, message not sent');
      return;
    }

    const messageWithMetadata: INetworkMessage = {
      ...message,
      timestamp: Date.now(),
      version: '1.0',
    };

    this.dataChannel.send(JSON.stringify(messageWithMetadata));
  }

  /**
   * Update connection state based on peer connection state
   */
  private updateConnectionState(): void {
    if (!this.peerConnection) {
      this.connectionState = 'disconnected';
      return;
    }

    const state = this.peerConnection.connectionState;
    const dataChannelState = this.dataChannel?.readyState;

    console.log(`Updating connection state: peer=${state}, dataChannel=${dataChannelState}`);

    switch (state) {
      case 'new':
      case 'connecting':
        this.connectionState = 'connecting';
        break;
      case 'connected':
        if (this.dataChannel && this.dataChannel.readyState === 'open') {
          console.log('Connection fully established!');
          this.connectionState = 'connected';
        } else {
          console.log('Peer connected but data channel not open yet');
          this.connectionState = 'connecting';
        }
        break;
      case 'disconnected':
      case 'closed':
      case 'failed':
        this.connectionState = 'disconnected';
        break;
      default:
        this.connectionState = 'error';
    }

    if (this.onStateChangeCallback) {
      this.onStateChangeCallback(this.connectionState);
    }
  }

  /**
   * Get current connection state
   */
  public getConnectionState(): ConnectionState {
    return this.connectionState;
  }

  /**
   * Check if connected
   */
  public isConnected(): boolean {
    return this.connectionState === 'connected';
  }

  /**
   * Close connection
   */
  public close(): void {
    if (this.dataChannel) {
      this.dataChannel.close();
      this.dataChannel = null;
    }

    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }

    this.connectionState = 'disconnected';
    if (this.onStateChangeCallback) {
      this.onStateChangeCallback(this.connectionState);
    }
  }

  /**
   * Disconnect and cleanup WebRTC resources
   * This stops ICE gathering and closes all connections
   */
  public disconnect(): void {
    console.log('WebRTCManager: Disconnecting...');

    // Close data channel first
    if (this.dataChannel) {
      console.log('Closing data channel...');
      this.dataChannel.onopen = null;
      this.dataChannel.onclose = null;
      this.dataChannel.onerror = null;
      this.dataChannel.onmessage = null;
      this.dataChannel.close();
      this.dataChannel = null;
    }

    // Close peer connection (this stops ICE gathering)
    if (this.peerConnection) {
      console.log('Closing peer connection...');
      this.peerConnection.onicecandidate = null;
      this.peerConnection.onconnectionstatechange = null;
      this.peerConnection.onicegatheringstatechange = null;
      this.peerConnection.oniceconnectionstatechange = null;
      this.peerConnection.ondatachannel = null;
      this.peerConnection.close();
      this.peerConnection = null;
    }

    // Clear callbacks
    this.onIceCandidateCallback = undefined;
    this.onIceGatheringCompleteCallback = undefined;
    this.onMessageCallback = undefined;
    this.onStateChangeCallback = undefined;

    // Update state
    this.connectionState = 'disconnected';
    console.log('WebRTCManager: Disconnected successfully');
  }
}

