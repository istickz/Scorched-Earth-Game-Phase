import Phaser from 'phaser';
import { LobbyConnectionManager } from '@/network/LobbyConnectionManager';
import { WebRTCManager } from '@/network/WebRTCManager';
import { type ConnectionState, type ILevelConfig } from '@/types';
import {
  createTextWithShadow,
  createNESButton,
  createNESContainer,
  createNESBackground,
  createNESMenuButton,
  createNESTextareaElement,
  NESColors,
} from '@/utils/NESUI';
import { AudioSystem } from '@/systems/AudioSystem';
import { createRandomLevelConfig } from '@/utils/levelUtils';
import { EnvironmentSystem } from '@/systems/EnvironmentSystem';

/**
 * Multiplayer lobby scene for WebRTC connection setup
 */
export class MultiplayerLobbyScene extends Phaser.Scene {
  private lobbyConnectionManager!: LobbyConnectionManager;
  private statusText!: Phaser.GameObjects.BitmapText;
  private statusTextShadow!: Phaser.GameObjects.BitmapText;
  private offerInput?: Phaser.GameObjects.DOMElement;
  private answerInput?: Phaser.GameObjects.DOMElement;
  private generatedAnswerInput?: Phaser.GameObjects.DOMElement;
  private contentContainer!: Phaser.GameObjects.Container;
  private audioSystem!: AudioSystem;
  private offerShown: boolean = false;
  private roleSelectionContainer?: Phaser.GameObjects.Container;
  private offerContainer?: Phaser.GameObjects.Container;
  private answerContainer?: Phaser.GameObjects.Container;
  private generatedAnswerContainer?: Phaser.GameObjects.Container;
  private loadingSpinner?: Phaser.GameObjects.Container;
  private loadingOverlay?: HTMLDivElement;
  private spinnerAnimationId?: number;

  constructor() {
    super({ key: 'MultiplayerLobbyScene' });
  }

  create(): void {
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;

    // Initialize audio system
    this.audioSystem = new AudioSystem();

    // Create NES-style background
    createNESBackground(this, width, height);

    // Create NES-style title
    this.createNESTitle(width);

    // Calculate container dimensions
    const containerPadding = 60;
    const MAX_CONTENT_WIDTH = 1200;
    const contentWidth = Math.min(width * 0.90, MAX_CONTENT_WIDTH);
    const titleBottomY = 100 + 55 + 20;
    const containerTopY = titleBottomY + 40;
    const containerHeight = 750; // Увеличили с 700 до 750
    const containerX = width / 2;
    const containerY = containerTopY + containerHeight / 2;

    // Create content container with NES-style border
    this.contentContainer = createNESContainer(this, containerX, containerY, contentWidth, containerHeight);
    
    // Store container properties
    (this.contentContainer as any).width = contentWidth;
    (this.contentContainer as any).height = containerHeight;

    // RELATIVE coordinates from container center (0, 0)
    const contentStartY = -containerHeight / 2 + containerPadding + 30;
    const buttonsStartY = contentStartY + 60;

    // Status text with shadow
    const { shadow: statusTextShadow, text: statusText } = createTextWithShadow(
      this,
      this.contentContainer,
      0,
      contentStartY,
      'Choose your role:',
      20,
      NESColors.white,
      0.5,
      0.5
    );
    this.statusTextShadow = statusTextShadow;
    this.statusText = statusText;

    // Create role selection container with buttons
    this.roleSelectionContainer = this.add.container(0, 0);
    this.contentContainer.add(this.roleSelectionContainer);
    this.createButton(this.roleSelectionContainer, 0, buttonsStartY, 'Create Game (Host)', () => this.startAsHost());
    this.createButton(this.roleSelectionContainer, 0, buttonsStartY + 70, 'Join Game (Client)', () => this.startAsClient());

    // Create back button
    const backButtonY = containerHeight / 2 - containerPadding - 25;
    this.createBackButton(0, backButtonY);

    // Play menu music
    this.audioSystem.playMenuMusic(this);

    // Initialize lobby connection manager
    try {
      if (typeof RTCPeerConnection === 'undefined') {
        const errorMsg = 'WebRTC is not supported in this browser. Please use a modern browser.';
        this.statusText.setText(errorMsg);
        this.statusTextShadow.setText(errorMsg);
        return;
      }

      const webrtcManager = new WebRTCManager();
      this.lobbyConnectionManager = new LobbyConnectionManager(webrtcManager);

      // Subscribe to events
      this.lobbyConnectionManager.on('offerCreated', (offerString: string) => {
        this.offerShown = true;
        this.showOfferInput(offerString);
        const successMsg = 'Offer created! Share it with the other player.';
        this.statusText.setText(successMsg);
        this.statusTextShadow.setText(successMsg);
        this.hideLoadingSpinner();
      });

      this.lobbyConnectionManager.on('answerCreated', (answerString: string) => {
        this.showGeneratedAnswer(answerString);
        const answerCreatedMsg = 'Answer created! Copy and share it with the host.';
        this.statusText.setText(answerCreatedMsg);
        this.statusTextShadow.setText(answerCreatedMsg);
        this.hideLoadingSpinner();
      });

      this.lobbyConnectionManager.on('connectionStateChanged', (state: ConnectionState) => {
        this.updateStatus(state);
      });

      this.lobbyConnectionManager.on('gameReady', (levelConfig?: ILevelConfig) => {
        this.startGame(levelConfig);
      });

      this.lobbyConnectionManager.on('error', (error: string) => {
        this.statusText.setText(error);
        this.statusTextShadow.setText(error);
        this.hideLoadingSpinner();
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
    if (!this.lobbyConnectionManager) {
      const errorMsg = 'WebRTC not initialized. Please refresh the page.';
      this.statusText.setText(errorMsg);
      this.statusTextShadow.setText(errorMsg);
      return;
    }

    if (this.roleSelectionContainer) {
      this.roleSelectionContainer.setVisible(false);
    }

    const creatingMsg = 'Creating offer...';
    this.statusText.setText(creatingMsg);
    this.statusTextShadow.setText(creatingMsg);

    // Show loading spinner
    this.showLoadingSpinner();

    try {
      await this.lobbyConnectionManager.createOfferWithCandidates();
    } catch (error) {
      console.error('Error creating offer:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorMsg = `Error creating offer: ${errorMessage}. Please try again.`;
      this.statusText.setText(errorMsg);
      this.statusTextShadow.setText(errorMsg);
      this.hideLoadingSpinner();
    }
  }

  /**
   * Start as client (waits for offer)
   */
  private startAsClient(): void {
    if (this.roleSelectionContainer) {
      this.roleSelectionContainer.setVisible(false);
    }

    this.showAnswerInput();
    const waitingMsg = 'Waiting for offer from host...';
    this.statusText.setText(waitingMsg);
    this.statusTextShadow.setText(waitingMsg);
  }

  /**
   * Show offer input field
   */
  private showOfferInput(offerString: string): void {
    const containerWidth = (this.contentContainer as any).width || 1200;
    const containerHeight = (this.contentContainer as any).height || 750; // Обновили с 700 до 750
    const containerPadding = 60;
    const textareaHeight = 100;
    
    // ОТНОСИТЕЛЬНЫЕ координаты от центра контейнера (0, 0)
    const contentStartY = -containerHeight / 2 + containerPadding + 30;
    const buttonsStartY = contentStartY + 60;
    
    // Offer label и textarea
    const offerLabelY = buttonsStartY + 70; // Увеличили с 60 до 70
    const offerTextareaY = offerLabelY + 40; // Увеличили с 35 до 40
    
    // АБСОЛЮТНЫЕ координаты для DOM элемента
    const containerAbsoluteX = this.contentContainer.x;
    const containerAbsoluteY = this.contentContainer.y;
    const offerTextareaCenterAbsoluteY = containerAbsoluteY + offerTextareaY;

    // Очистка предыдущих элементов
    if (this.offerContainer) {
      this.offerContainer.destroy();
    }
    if (this.offerInput) {
      this.offerInput.destroy();
      this.offerInput = undefined;
    }

    // Create offer container
    this.offerContainer = this.add.container(0, 0);
    this.contentContainer.add(this.offerContainer);

    // Label
    createTextWithShadow(
      this,
      this.offerContainer,
      0,
      offerLabelY,
      'Your Offer (copy this):',
      18,
      NESColors.white,
      0.5,
      0.5
    );

    // Create NES-style textarea
    const offerElement = createNESTextareaElement({
      width: containerWidth - containerPadding * 2,
      height: textareaHeight,
      defaultValue: offerString,
      readOnly: true,
    });

    // DOM element с АБСОЛЮТНЫМИ координатами
    try {
      this.offerInput = this.add.dom(containerAbsoluteX, offerTextareaCenterAbsoluteY, offerElement);
    } catch (error) {
      console.error('Error creating DOM element:', error);
    }

    // Copy button
    const copyButtonY = offerTextareaY + textareaHeight / 2 + 45; // Увеличили с 40 до 45
    this.createButton(this.offerContainer, 0, copyButtonY, 'Copy Offer', () => {
      offerElement.select();
      document.execCommand('copy');
      const copiedMsg = 'Offer copied to clipboard!';
      this.statusText.setText(copiedMsg);
      this.statusTextShadow.setText(copiedMsg);
    });

    // Answer input (for host to paste answer) - показываем НИЖЕ offer
    this.showAnswerInput();
  }

  /**
   * Show answer input field
   */
  private showAnswerInput(): void {
    const containerWidth = (this.contentContainer as any).width || 1200;
    const containerHeight = (this.contentContainer as any).height || 750; // Обновили с 700 до 750
    const containerPadding = 60;
    const textareaHeight = 100;
    
    // ОТНОСИТЕЛЬНЫЕ координаты от центра контейнера (0, 0)
    const contentStartY = -containerHeight / 2 + containerPadding + 30;
    const buttonsStartY = contentStartY + 60;
    
    // Расчет позиции answer поля
    let answerLabelY: number;
    if (this.offerShown) {
      // Если offer показан, размещаем answer ниже
      // Используем ТОЧНО ТЕ ЖЕ значения, что в showOfferInput
      const offerLabelY = buttonsStartY + 70;
      const offerTextareaY = offerLabelY + 40;
      const copyButtonY = offerTextareaY + textareaHeight / 2 + 45;
      // Размещаем answer label после кнопки с достаточным отступом
      answerLabelY = copyButtonY + 60;
    } else {
      // Если offer не показан, размещаем на том же месте где был бы offer
      answerLabelY = buttonsStartY + 60;
    }
    const answerTextareaY = answerLabelY + 35; // Уменьшили с 40 до 35
    
    // АБСОЛЮТНЫЕ координаты для DOM элемента
    const containerAbsoluteX = this.contentContainer.x;
    const containerAbsoluteY = this.contentContainer.y;
    const answerTextareaCenterAbsoluteY = containerAbsoluteY + answerTextareaY;

    // Очистка предыдущих элементов
    if (this.answerContainer) {
      this.answerContainer.destroy();
    }
    if (this.answerInput) {
      this.answerInput.destroy();
      this.answerInput = undefined;
    }

    // Create answer container
    this.answerContainer = this.add.container(0, 0);
    this.contentContainer.add(this.answerContainer);

    const isHost = this.lobbyConnectionManager?.getIsHost() ?? false;
    const labelText = isHost ? 'Paste Answer here:' : 'Paste Offer here:';

    // Label
    createTextWithShadow(
      this,
      this.answerContainer,
      0,
      answerLabelY,
      labelText,
      18,
      NESColors.white,
      0.5,
      0.5
    );

    // Create NES-style textarea
    const answerElement = createNESTextareaElement({
      width: containerWidth - containerPadding * 2,
      height: textareaHeight,
      placeholder: 'Paste SDP here...',
    });

    // DOM element с АБСОЛЮТНЫМИ координатами
    try {
      this.answerInput = this.add.dom(containerAbsoluteX, answerTextareaCenterAbsoluteY, answerElement);
    } catch (error) {
      console.error('Error creating DOM element:', error);
    }

    // Submit button
    const submitButtonY = answerTextareaY + textareaHeight / 2 + 45;
    const buttonText = isHost ? 'Submit Answer' : 'Submit Offer';
    this.createButton(this.answerContainer, 0, submitButtonY, buttonText, () => {
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
    if (!this.lobbyConnectionManager) {
      const errorMsg = 'Connection manager not initialized';
      this.statusText.setText(errorMsg);
      this.statusTextShadow.setText(errorMsg);
      return;
    }

    try {
      const isHost = this.lobbyConnectionManager.getIsHost();

      if (isHost) {
        // Host receives answer from client
        await this.lobbyConnectionManager.handleAnswerFromClient(sdpString);
        this.statusText.setText('Answer received! Connecting...');
        this.statusTextShadow.setText('Answer received! Connecting...');
      } else {
        // Client receives offer from host and creates answer
        this.showLoadingSpinner();
        const creatingAnswerMsg = 'Creating answer...';
        this.statusText.setText(creatingAnswerMsg);
        this.statusTextShadow.setText(creatingAnswerMsg);

        await this.lobbyConnectionManager.handleOfferFromHost(sdpString);
        // answerCreated event will be handled by event listener
      }
    } catch (error) {
      console.error('Error handling SDP:', error);
      const errorMsg = 'Invalid SDP. Please check and try again.';
      this.statusText.setText(errorMsg);
      this.statusTextShadow.setText(errorMsg);
      this.hideLoadingSpinner();
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
        if (this.lobbyConnectionManager.getIsHost()) {
          // Host generates levelConfig and sends to client
          this.generateAndSendLevelConfig();
        }
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
   * Start the game (called when ready)
   */
  private startGame(levelConfig?: ILevelConfig): void {
    if (!this.lobbyConnectionManager) {
      console.error('Lobby connection manager not initialized');
      return;
    }

    const isHost = this.lobbyConnectionManager.getIsHost();
    const finalLevelConfig = levelConfig || this.lobbyConnectionManager.getLevelConfig();

    console.log(`${isHost ? 'Host' : 'Client'}: Starting game...`);
    this.scene.start('GameScene', {
      gameMode: 'multiplayer',
      webrtcManager: this.lobbyConnectionManager.getWebRTCManager(),
      isHost,
      levelConfig: finalLevelConfig,
    });
  }

  /**
   * Create NES-style title
   */
  private createNESTitle(width: number): void {
    const titleY = 100;
    const nesRed = 0xe74c3c;
    
    const titleContainer = this.add.container(0, 0);
    
    createTextWithShadow(
      this,
      titleContainer,
      width / 2,
      titleY,
      'MULTIPLAYER SETUP',
      32,
      nesRed,
      0.5,
      0.5
    );

    createTextWithShadow(
      this,
      titleContainer,
      width / 2,
      titleY + 55,
      'WebRTC Connection',
      14,
      NESColors.yellow,
      0.5,
      0.5
    );
  }

  /**
   * Create a button
   */
  private createButton(
    parent: Phaser.GameObjects.Container,
    x: number,
    y: number,
    text: string,
    callback: () => void
  ): Phaser.GameObjects.Container {
    const result = createNESButton(
      this,
      parent,
      {
        x,
        y,
        width: 350, // Увеличили с 300 до 350
        height: 50,
        text,
        onClick: callback,
      }
    );
    return result.container;
  }

  /**
   * Create back button in menu style
   */
  private createBackButton(x: number, y: number): void {
    createNESMenuButton(
      this,
      this.contentContainer,
      {
        x: x - 30,
        y,
        text: 'BACK',
        active: false,
        onClick: () => {
          // КРИТИЧЕСКИ ВАЖНО: остановить все процессы перед сменой сцены
          this.cleanupBeforeExit();

          if (this.audioSystem) {
            this.audioSystem.stopMenuMusic();
          }
          this.scene.start('MenuScene');
        },
      }
    );
  }

  /**
   * Show generated answer (for client after submitting offer)
   * Displays in a separate field below the offer input
   */
  private showGeneratedAnswer(answerString: string): void {
    const containerWidth = (this.contentContainer as any).width || 1200;
    const containerHeight = (this.contentContainer as any).height || 750; // Обновили
    const containerPadding = 60;
    const textareaHeight = 100;
    
    // ОТНОСИТЕЛЬНЫЕ координаты от центра контейнера (0, 0)
    const contentStartY = -containerHeight / 2 + containerPadding + 30;
    const buttonsStartY = contentStartY + 60;
    
    // Размещаем generated answer НИЖЕ offer input
    const offerLabelY = buttonsStartY + 60;
    const offerTextareaY = offerLabelY + 35;
    const submitButtonY = offerTextareaY + textareaHeight / 2 + 30;
    
    // Generated answer идет после submit кнопки
    const answerLabelY = submitButtonY + 75; // Увеличили с 70 до 75
    const answerTextareaY = answerLabelY + 40; // Увеличили с 35 до 40
    
    // АБСОЛЮТНЫЕ координаты для DOM элемента
    const containerAbsoluteX = this.contentContainer.x;
    const containerAbsoluteY = this.contentContainer.y;
    const answerTextareaCenterAbsoluteY = containerAbsoluteY + answerTextareaY;

    // Удаляем предыдущий generated answer если был
    if (this.generatedAnswerContainer) {
      this.generatedAnswerContainer.destroy();
    }
    if (this.generatedAnswerInput) {
      this.generatedAnswerInput.destroy();
      this.generatedAnswerInput = undefined;
    }

    // Create generated answer container
    this.generatedAnswerContainer = this.add.container(0, 0);
    this.contentContainer.add(this.generatedAnswerContainer);

    // Label
    createTextWithShadow(
      this,
      this.generatedAnswerContainer,
      0,
      answerLabelY,
      'Your Answer (copy this):',
      18,
      NESColors.yellow, // Желтый цвет для выделения
      0.5,
      0.5
    );

    // Create NES-style textarea (highlighted in yellow)
    const answerElement = createNESTextareaElement({
      width: containerWidth - containerPadding * 2,
      height: textareaHeight,
      defaultValue: answerString,
      readOnly: true,
      highlightColor: NESColors.yellow,
    });

    // DOM element
    try {
      this.generatedAnswerInput = this.add.dom(containerAbsoluteX, answerTextareaCenterAbsoluteY, answerElement);
    } catch (error) {
      console.error('Error creating DOM element:', error);
    }

    // Copy button
    const copyButtonY = answerTextareaY + textareaHeight / 2 + 45; // Увеличили с 40 до 45
    this.createButton(this.generatedAnswerContainer, 0, copyButtonY, 'Copy Answer', () => {
      answerElement.select();
      document.execCommand('copy');
      const copiedMsg = 'Answer copied to clipboard!';
      this.statusText.setText(copiedMsg);
      this.statusTextShadow.setText(copiedMsg);
    });
  }

  /**
   * Show loading spinner
   */
  private showLoadingSpinner(): void {
    // Удаляем предыдущий spinner если есть
    this.hideLoadingSpinner();

    // Получаем позицию canvas для правильного позиционирования
    const canvas = this.game.canvas;
    const canvasRect = canvas.getBoundingClientRect();
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;
    const centerX = canvasRect.left + width / 2;
    const centerY = canvasRect.top + height / 2 - 150; // Поднимаем спиннер выше центра

    // Создаем DOM overlay с спиннером, который будет поверх всех элементов (включая textarea)
    this.loadingOverlay = document.createElement('div');
    this.loadingOverlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      z-index: 10000;
      pointer-events: none;
      display: flex;
      align-items: center;
      justify-content: center;
    `;

    // Создаем SVG спиннер в NES-стиле
    const spinnerSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    spinnerSvg.setAttribute('width', '60');
    spinnerSvg.setAttribute('height', '60');
    spinnerSvg.setAttribute('viewBox', '0 0 60 60');
    spinnerSvg.style.cssText = `
      position: absolute;
      top: ${centerY - 30}px;
      left: ${centerX - 30}px;
      animation: nes-spinner-rotate 1s linear infinite;
    `;

    // Создаем 8 точек по кругу
    const radius = 20;
    const dotRadius = 3;
    const center = 30;
    
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2 - Math.PI / 2; // Начинаем сверху
      const x = center + Math.cos(angle) * radius;
      const y = center + Math.sin(angle) * radius;
      const opacity = 0.3 + (i * 0.1);
      
      const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      dot.setAttribute('cx', String(x));
      dot.setAttribute('cy', String(y));
      dot.setAttribute('r', String(dotRadius));
      dot.setAttribute('fill', `#${NESColors.white.toString(16).padStart(6, '0')}`);
      dot.setAttribute('opacity', String(opacity));
      dot.style.cssText = `
        animation: nes-spinner-pulse 0.5s ease-in-out infinite;
        animation-delay: ${i * 0.05}s;
      `;
      spinnerSvg.appendChild(dot);
    }

    this.loadingOverlay.appendChild(spinnerSvg);

    // Добавляем CSS анимации если их еще нет
    if (!document.getElementById('nes-spinner-styles')) {
      const style = document.createElement('style');
      style.id = 'nes-spinner-styles';
      style.textContent = `
        @keyframes nes-spinner-rotate {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes nes-spinner-pulse {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 1; }
        }
      `;
      document.head.appendChild(style);
    }

    // Добавляем overlay в DOM
    document.body.appendChild(this.loadingOverlay);
  }

  /**
   * Generate level config and send to client
   */
  private generateAndSendLevelConfig(): void {
    if (!this.lobbyConnectionManager) {
      console.error('Lobby connection manager not initialized');
      return;
    }

    // Generate random levelConfig with seed
    const levelConfig = createRandomLevelConfig();
    const seed = Math.random() * 1000000;
    levelConfig.seed = seed;

    // Generate deterministic wind variation based on seed
    const defaultEffects = EnvironmentSystem.getEffects(
      levelConfig.biome,
      levelConfig.weather,
      levelConfig.timeOfDay
    );
    const windVar = EnvironmentSystem.getWindVariationFromSeed(seed * 0.7);
    levelConfig.environmentEffects = {
      ...defaultEffects,
      windX: defaultEffects.windX + windVar.windX,
      windY: defaultEffects.windY + windVar.windY,
    };

    console.log('Host: Generated levelConfig with seed:', seed);

    // Send to client via manager
    this.lobbyConnectionManager.sendLevelConfig(levelConfig);
  }

  /**
   * Hide loading spinner
   */
  private hideLoadingSpinner(): void {
    // Удаляем DOM overlay
    if (this.loadingOverlay) {
      if (this.loadingOverlay.parentElement) {
        this.loadingOverlay.parentElement.removeChild(this.loadingOverlay);
      }
      this.loadingOverlay = undefined;
    }

    // Останавливаем анимацию если была
    if (this.spinnerAnimationId !== undefined) {
      cancelAnimationFrame(this.spinnerAnimationId);
      this.spinnerAnimationId = undefined;
    }

    // Удаляем Phaser spinner (если был создан)
    if (this.loadingSpinner) {
      this.tweens.killTweensOf(this.loadingSpinner);
      this.loadingSpinner.list.forEach((child) => {
        if (child instanceof Phaser.GameObjects.Graphics) {
          this.tweens.killTweensOf(child);
        }
      });
      this.loadingSpinner.destroy();
      this.loadingSpinner = undefined;
    }
  }

  /**
   * Clean up all resources before exiting scene
   */
  private cleanupBeforeExit(): void {
    console.log('Cleaning up MultiplayerLobbyScene before exit...');

    // 1. Остановить спиннер и удалить DOM overlay
    this.hideLoadingSpinner();

    // 2. Очистить все DOM элементы (textarea)
    if (this.offerInput) {
      this.offerInput.destroy();
      this.offerInput = undefined;
    }
    if (this.answerInput) {
      this.answerInput.destroy();
      this.answerInput = undefined;
    }
    if (this.generatedAnswerInput) {
      this.generatedAnswerInput.destroy();
      this.generatedAnswerInput = undefined;
    }

    // 3. КРИТИЧЕСКИ ВАЖНО: остановить WebRTC процессы и ICE gathering
    if (this.lobbyConnectionManager) {
      // Сначала получаем webrtcManager до cleanup
      const webrtcManager = this.lobbyConnectionManager.getWebRTCManager();

      // Очищаем lobby manager (таймеры и события)
      this.lobbyConnectionManager.cleanup();

      // Затем закрываем WebRTC соединение (останавливает ICE gathering)
      if (webrtcManager) {
        webrtcManager.disconnect();
      }
    }

    // 4. Удалить стили спиннера из DOM
    const spinnerStyles = document.getElementById('nes-spinner-styles');
    if (spinnerStyles && spinnerStyles.parentElement) {
      spinnerStyles.parentElement.removeChild(spinnerStyles);
    }
  }

  shutdown(): void {
    // Используем ту же логику очистки
    this.cleanupBeforeExit();

    if (this.audioSystem) {
      this.audioSystem.stopMenuMusic();
    }
  }
}