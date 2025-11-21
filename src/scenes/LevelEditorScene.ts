import Phaser from 'phaser';
import { GameMode, TerrainBiome, TerrainShape, type ILevelConfig, type WeatherType, type TimeOfDay, type Season, type IEnvironmentEffects } from '@/types';
import { BiomeSystem } from '@/systems/BiomeSystem';
import { EnvironmentSystem } from '@/systems/EnvironmentSystem';
import { PreviewRenderer } from '@/systems/PreviewRenderer';
import { PixelIconGenerator } from '@/utils/PixelIconGenerator';
import {
  createNESContainer,
  createTextWithShadow,
  createSectionTitle,
  createNESButton,
  createNESRadioGroup,
  createNESSlider,
  createNESMenuButton,
  createNESPanel,
  createNESBackground,
  NESColors,
  NESTheme,
} from '@/utils/NESUI';
import { AudioSystem } from '@/systems/AudioSystem';

/**
 * Level configuration scene with modular biome/terrain system
 */
export class LevelEditorScene extends Phaser.Scene {
  private levelConfig: ILevelConfig = {
    biome: TerrainBiome.TEMPERATE,
    shape: TerrainShape.HILLS,
    weather: 'none',
    timeOfDay: 'day',
    season: 'summer',
  };

  private previewRenderer!: PreviewRenderer;
  private previewSeed: number = Math.random() * 1000000;
  private seedValueText!: Phaser.GameObjects.BitmapText;
  private seedValueShadow!: Phaser.GameObjects.BitmapText;
  private audioSystem!: AudioSystem;
  private contentContainer!: Phaser.GameObjects.Container;
  private environmentSliders: {
    windX?: { thumb: Phaser.GameObjects.Arc; valueText: Phaser.GameObjects.BitmapText };
    windY?: { thumb: Phaser.GameObjects.Arc; valueText: Phaser.GameObjects.BitmapText };
    gravity?: { thumb: Phaser.GameObjects.Arc; valueText: Phaser.GameObjects.BitmapText };
    airDensity?: { thumb: Phaser.GameObjects.Arc; valueText: Phaser.GameObjects.BitmapText };
  } = {};

  constructor() {
    super({ key: 'LevelEditorScene' });
  }

  /**
   * Get preview terrain height at given X coordinate
   */
  create(): void {
    console.log('[LevelEditorScene] create() called - Scene is being created/restarted');
    const screenWidth = this.cameras.main.width;
    const screenHeight = this.cameras.main.height;

    // Register shutdown handler
    this.events.once('shutdown', this.shutdown, this);

    // NES-style colors
    const nesRed = '#e74c3c';
    const nesYellow = '#f1c40f';
    const nesWhite = '#ffffff';

    // Create NES-style background
    createNESBackground(this, screenWidth, screenHeight);

    // Create NES-style title
    this.createNESTitle(screenWidth, screenHeight, nesRed, nesYellow, nesWhite);

    // Add spacing after title
    const titleBottomY = 100 + 55 + 20; // titleY (100) + subtitle height (55) + spacing (20)
    const containerTopY = titleBottomY + 40; // Additional spacing before container (increased to lower container)

    // Adaptive layout with max width for large screens
    const MAX_CONTENT_WIDTH = 1600;
    const contentWidth = Math.min(screenWidth * 0.90, MAX_CONTENT_WIDTH);

    // Calculate container dimensions
    const containerPadding = 60; // Increased padding for better visual spacing
    
    // Calculate available width inside container (accounting for padding)
    const availableWidth = contentWidth - containerPadding * 2;
    
    // First, calculate all element positions relative to container top
    // This helps us determine the required container height
    const previewWidth = availableWidth * 0.55;
    const controlsWidth = availableWidth * 0.40;
    const gap = availableWidth * 0.05;
    
    // Calculate positions relative to container top (starting from padding)
    const titleOffsetY = 30; // Space for section titles
    const contentStartY = containerPadding + titleOffsetY;
    const previewHeight = 420;
    const environmentBoxHeight = 200;
    const environmentBottomY = contentStartY + previewHeight + 30 + environmentBoxHeight; // Environment section bottom
    const modifiersStartY = contentStartY + 250;
    const buttonsStartY = modifiersStartY + 400; // Start button (increased due to added terrain height sliders)
    const backButtonY = buttonsStartY + 60;
    
    // Calculate required container height based on bottom-most element
    // Consider both Environment section (left) and buttons (right)
    // Container height = max(environmentBottomY, backButtonY) + bottom padding
    const bottomMostElement = Math.max(environmentBottomY, backButtonY);
    const requiredContainerHeight = bottomMostElement + containerPadding + 20; // Extra 20px padding at bottom
    const maxAvailableHeight = screenHeight - containerTopY - 50;
    const containerHeight = Math.min(requiredContainerHeight, maxAvailableHeight + containerPadding * 2);
    
    // ABSOLUTE coordinates: Root container position on scene
    const containerX = screenWidth / 2;
    const containerY = containerTopY + containerHeight / 2;

    // Create content container with NES-style border (ABSOLUTE position on scene)
    this.createContentContainer(containerX, containerY, contentWidth, containerHeight);

    // RELATIVE coordinates: All positions below are relative to contentContainer center (0, 0)
    // Container center is at (0, 0) in local coordinates
    const previewX = -contentWidth / 2 + containerPadding;
    const controlsX = previewX + previewWidth + gap;
    
    // Ensure controls don't exceed container width
    const maxControlsX = contentWidth / 2 - containerPadding;
    const actualControlsX = Math.min(controlsX, maxControlsX - controlsWidth);
    
    // Title height offset (both titles should be at same height) - already defined above
    const contentStartYRelative = -containerHeight / 2 + containerPadding + titleOffsetY;
    const modifiersStartYRelative = contentStartYRelative + 250;
    const buttonsStartYRelative = modifiersStartYRelative + 400; // Start button (increased due to added terrain height sliders)
    const backButtonYRelative = buttonsStartYRelative + 60;

    // Create "Random All" button attached to right edge of container
    const randomButtonHeight = 45;
    const randomButtonWidth = 180;
    // Position so right edge aligns with container right edge
    // Container center is at 0, right edge is at contentWidth/2
    // Button center should be at: rightEdge - buttonWidth/2 = contentWidth/2 - buttonWidth/2
    const randomButtonX = contentWidth / 2 - randomButtonWidth / 2;
    const randomButtonY = -containerHeight / 2 + randomButtonHeight / 2; // Top edge, no padding
    this.createRandomAllButton(randomButtonX, randomButtonY, randomButtonWidth, randomButtonHeight);

    // Create preview on the left (y position includes space for title)
    this.createPreview(previewX, contentStartYRelative, previewWidth, previewHeight, titleOffsetY);
    
    // Create environment info below preview (with bottom padding)
    this.createEnvironmentInfo(previewX, contentStartYRelative + previewHeight + 30, previewWidth);

    // Create biome selection buttons on the right (2 rows, 2 columns)
    this.createBiomeButtons(actualControlsX, contentStartYRelative, controlsWidth, titleOffsetY);

    // Create modifiers section on the right below biomes
    this.createModifiersSection(actualControlsX, modifiersStartYRelative, controlsWidth);

    // Calculate buttons position
    const buttonsCenterX = actualControlsX + controlsWidth / 2;
    
    // Start and Back buttons
    this.createStartButton(buttonsCenterX, buttonsStartYRelative);
    this.createBackButton(buttonsCenterX, backButtonYRelative);

    // Initialize audio system
    this.audioSystem = new AudioSystem();

    // Initial preview
    this.updatePreview();

    // Play menu music (if loaded)
    this.audioSystem.playMenuMusic(this);
  }

  /**
   * Create content container with NES-style border
   */
  private createContentContainer(x: number, y: number, width: number, height: number): void {
    this.contentContainer = createNESContainer(this, x, y, width, height);
  }

  /**
   * Create NES-style title
   */
  private createNESTitle(width: number, _height: number, _red: string, _yellow: string, _white: string): void {
    const titleY = 100; // Lowered title position further
    const nesRed = 0xe74c3c;
    
    // Create root container for title elements (positioned at 0,0 on scene)
    const titleContainer = this.add.container(0, 0);
    
    // Main title with shadow effect (NES style) - using bitmap font
    createTextWithShadow(
      this,
      titleContainer,
      width / 2,
      titleY,
      'SELECT TERRAIN',
      32,
      nesRed,
      0.5,
      0.5
    );

    // Subtitle with NES colors
    createTextWithShadow(
      this,
      titleContainer,
      width / 2,
      titleY + 55,
      'Level Editor - Configure Battle',
      14,
      NESColors.yellow,
      0.5,
      0.5
    );
  }

  /**
   * Create biome selection buttons (2 rows, 2 columns)
   */
  private createBiomeButtons(startX: number, startY: number, availableWidth: number, titleOffsetY: number = 30): void {
    const biomes = [
      TerrainBiome.TEMPERATE,
      TerrainBiome.DESERT,
      TerrainBiome.ARCTIC,
      TerrainBiome.VOLCANIC,
    ];

    const buttonWidth = (availableWidth - 20) / 2; // 2 columns, 20px spacing
    const buttonHeight = 100;
    const spacing = 20;
    const cols = 2;

    // Title for biomes section (positioned at same height as Preview title)
    const titleY = startY - titleOffsetY;
    createSectionTitle(this, this.contentContainer, startX + availableWidth / 2, titleY, 'BIOMES', 16);

    // Вычисляем центры кнопок (не левые верхние углы!)
    // startX и startY - это позиция левого верхнего угла первой кнопки
    // Нужно добавить buttonWidth/2 и buttonHeight/2 чтобы получить центр первой кнопки
    const firstButtonCenterX = startX + buttonWidth / 2;
    const firstButtonCenterY = startY + buttonHeight / 2;

    biomes.forEach((biome, index) => {
      const row = Math.floor(index / cols);
      const col = index % cols;
      // Центр кнопки = центр первой кнопки + смещение по сетке
      const x = firstButtonCenterX + col * (buttonWidth + spacing);
      const y = firstButtonCenterY + row * (buttonHeight + spacing);
      this.createBiomeButton(x, y, buttonWidth, buttonHeight, biome);
    });
  }

  /**
   * Create a single biome button
   */
  private createBiomeButton(
    x: number,
    y: number,
    width: number,
    height: number,
    biome: TerrainBiome
  ): void {
    const isSelected = this.levelConfig.biome === biome;

    // Create button container first
    const container = this.add.container(x, y);

    // Pixel art icon - positioned relative to container
    const iconSize = 32;
    const iconX = width / 2;
    const iconY = 30;
    
    const icon = PixelIconGenerator.createBiomeIcon(this, biome, iconX, iconY, iconSize);

    // Create button using NESUI component
    createNESButton(
      this,
      container,
      {
      x: 0, // Position relative to container
      y: 0,
      width,
      height,
      text: BiomeSystem.getBiomeName(biome),
      icon: icon,
      selected: isSelected,
      onClick: () => {
      console.log(`[LevelEditorScene] Biome button clicked: ${biome}`);
      this.levelConfig.biome = biome;
      // Reset environment effects to defaults for new biome
      // User can then edit them if they want
      this.levelConfig.environmentEffects = undefined;
      console.log('[LevelEditorScene] Calling scene.restart() due to biome change');
      this.scene.restart(); // Restart scene to refresh selection
      },
      }
    );

    this.contentContainer.add(container);
  }

  /**
   * Create modifiers section
   */
  private createModifiersSection(startX: number, startY: number, availableWidth: number): void {
    const sectionCenterX = startX + availableWidth / 2;

    // Section title with NES style
    createSectionTitle(this, this.contentContainer, sectionCenterX, startY, 'MODIFIERS', 16);

    // Одинаковый отступ между всеми строками
    const rowSpacing = 50;
    const row1Y = startY + rowSpacing;
    const row2Y = startY + rowSpacing * 2;
    const row3Y = startY + rowSpacing * 3;
    const row4Y = startY + rowSpacing * 4;
    const row5Y = startY + rowSpacing * 5;
    const row6Y = startY + rowSpacing * 6;
    const row7Y = startY + rowSpacing * 7;

    // Terrain Shape
    createNESRadioGroup(
      this,
      this.contentContainer,
      {
      x: startX,
      y: row1Y,
      label: 'Terrain:',
      options: [
      { label: 'Hills', value: TerrainShape.HILLS },
      { label: 'Mountains', value: TerrainShape.MOUNTAINS },
      ],
      currentValue: this.levelConfig.shape,
      onChange: (value) => {
      console.log(`[LevelEditorScene] Terrain shape changed: ${value}`);
      this.levelConfig.shape = value as TerrainShape;
      this.updatePreview();
      console.log('[LevelEditorScene] Calling scene.restart() due to terrain shape change');
        this.scene.restart();
      },
      }
    );

    // Weather
    createNESRadioGroup(
      this,
      this.contentContainer,
      {
      x: startX,
      y: row2Y,
      label: 'Weather:',
      options: [
      { label: 'Clear', value: 'none' },
      { label: 'Rain', value: 'rain' },
      { label: 'Snow', value: 'snow' },
      ],
      currentValue: this.levelConfig.weather,
      onChange: (value) => {
      console.log(`[LevelEditorScene] Weather changed: ${value}`);
      this.levelConfig.weather = value as WeatherType;
      // Reset environment effects to defaults when weather changes
      // User can then edit them if they want
      this.levelConfig.environmentEffects = undefined;
      this.updatePreview();
      console.log('[LevelEditorScene] Calling scene.restart() due to weather change');
        this.scene.restart();
      },
      }
    );

    // Time of Day
    createNESRadioGroup(
      this,
      this.contentContainer,
      {
      x: startX,
      y: row3Y,
      label: 'Time:',
      options: [
      { label: 'Day', value: 'day' },
      { label: 'Night', value: 'night' },
      ],
      currentValue: this.levelConfig.timeOfDay,
      onChange: (value) => {
      console.log(`[LevelEditorScene] Time of day changed: ${value}`);
      this.levelConfig.timeOfDay = value as TimeOfDay;
      // Reset environment effects to defaults when time changes
      // User can then edit them if they want
      this.levelConfig.environmentEffects = undefined;
      this.updatePreview();
      console.log('[LevelEditorScene] Calling scene.restart() due to time of day change');
        this.scene.restart();
      },
      }
    );

    // Season
    createNESRadioGroup(
      this,
      this.contentContainer,
      {
      x: startX,
      y: row4Y,
      label: 'Season:',
      options: [
      { label: 'Summer', value: 'summer' },
      { label: 'Winter', value: 'winter' },
      ],
      currentValue: this.levelConfig.season,
      onChange: (value) => {
      console.log(`[LevelEditorScene] Season changed: ${value}`);
      this.levelConfig.season = value as Season;
      this.updatePreview();
      console.log('[LevelEditorScene] Calling scene.restart() due to season change');
        this.scene.restart();
      },
      }
    );

    // Terrain Min Height slider
    this.createTerrainHeightSlider('Min Height:', startX, row5Y, availableWidth, 'terrainMinHeight', 0.1);

    // Terrain Max Height slider
    this.createTerrainHeightSlider('Max Height:', startX, row6Y, availableWidth, 'terrainMaxHeight', 0.85);

    // Seed input
    this.createSeedInput(startX, row7Y);
  }

  /**
   * Create a slider for terrain height parameter
   */
  private createTerrainHeightSlider(
    label: string,
    x: number,
    y: number,
    availableWidth: number,
    key: 'terrainMinHeight' | 'terrainMaxHeight',
    defaultValue: number
  ): void {
    // Вычисляем ширину label для правильного отступа
    const tempText = this.add.bitmapText(0, 0, 'pixel-font', label, NESTheme.defaultFontSize);
    const labelWidth = tempText.width;
    tempText.destroy();

    // Отступ 15px после label (как в Environment слайдерах)
    const gapAfterLabel = 15;
    const sliderStartX = x + labelWidth + gapAfterLabel;

    // Вычисляем фиксированную позицию конца слайдера для выравнивания значений справа
    // Используем ту же логику, что и для Environment слайдеров
    // availableWidth - это ширина доступной области для секции Modifiers
    // Вычисляем правую границу: начало секции (x) + доступная ширина минус место для значения
    const valueDisplayWidth = 50; // Ширина для отображения значения
    const gapAfterSlider = 10; // Отступ после слайдера перед значением
    const sliderEndX = x + availableWidth - valueDisplayWidth - gapAfterSlider;

    // Ширина слайдера = фиксированная позиция конца - позиция начала
    const sliderWidth = sliderEndX - sliderStartX;

    // Получаем текущее значение или используем значение по умолчанию
    const currentValue = this.levelConfig[key] ?? defaultValue;

    createNESSlider(
      this,
      this.contentContainer,
      {
        x,
        y,
        label,
        value: currentValue,
        min: 0,
        max: 1,
        sliderStartX,
        sliderWidth,
        onChange: (value) => {
          this.levelConfig[key] = value;
          this.updatePreview();
        },
      }
    );
  }

  /**
   * Create preview window (left side)
   */
  private createPreview(x: number, y: number, width: number, height: number, titleOffsetY: number = 30): void {
    // Preview label with NES style (positioned above the preview box)
    const labelX = x + width / 2;
    const titleY = y - titleOffsetY;
    createSectionTitle(this, this.contentContainer, labelX, titleY, 'PREVIEW', 16);

    // Preview border with NES style
    const previewBorder = this.add.graphics();
    previewBorder.lineStyle(3, 0x3498db, 1);
    previewBorder.strokeRoundedRect(x, y, width, height, 8);
    previewBorder.lineStyle(1, 0x5dade2, 0.8);
    previewBorder.strokeRoundedRect(x + 2, y + 2, width - 4, height - 4, 6);
    this.contentContainer.add(previewBorder);

    // Create preview renderer using game systems
    // Use standard game dimensions (1200x800) that will be scaled to fit preview
    const gameWidth = 1200;
    const gameHeight = 800;
    this.previewRenderer = new PreviewRenderer(
      this,
      x,
      y,
      width,
      height,
      gameWidth,
      gameHeight
    );
    
    // Add preview renderer container to content container
    this.contentContainer.add(this.previewRenderer.getContainer());
    
    // Initial preview update
    this.updatePreview();
  }

  /**
   * Create environment info display below preview with editable fields and internal padding
   */
  private createEnvironmentInfo(x: number, y: number, width: number): void {
    const boxHeight = 240;
    const padding = 25; // ← Внутренний отступ!

    // Создаём панель с паддингом — она сама нарисует красивый фон и бордер
    // x и y - это левый верхний угол, нужно преобразовать в центр
    const panelCenterX = x + width / 2;
    const panelCenterY = y + boxHeight / 2;
    
    const panel = createNESPanel(this, this.contentContainer, {
      x: panelCenterX,  // центр панели
      y: panelCenterY,  // центр панели
      width,
      height: boxHeight,
      padding,           // ← вот он, твой внутренний отступ!
    });

    // Заголовок — уже внутри панели, с отступом
    // Координаты относительно центра панели (0, 0)
    createSectionTitle(this, panel.container, 0, -boxHeight / 2 + padding, 'ENVIRONMENT', 14);

    // Получаем дефолтные эффекты
    const defaultEffects = EnvironmentSystem.getEffects(
      this.levelConfig.biome,
      this.levelConfig.weather,
      this.levelConfig.timeOfDay
    );
    const currentEffects = this.levelConfig.environmentEffects || defaultEffects;

    // Вычисляем максимальную ширину label для выравнивания слайдеров
    const labels = ['Wind X:', 'Wind Y:', 'Gravity:', 'Air Density:'];
    let maxLabelWidth = 0;
    labels.forEach(label => {
      const tempText = this.add.bitmapText(0, 0, 'pixel-font', label, NESTheme.defaultFontSize);
      maxLabelWidth = Math.max(maxLabelWidth, tempText.width);
      tempText.destroy();
    });

    // Вычисляем фиксированную позицию конца слайдера (правая граница)
    // Все слайдеры должны заканчиваться на одной позиции для выравнивания значений справа
    const valueDisplayWidth = 50; // Примерная ширина для отображения значения
    const gapAfterSlider = 10; // Отступ после слайдера перед значением
    const sliderEndX = width / 2 - padding - valueDisplayWidth - gapAfterSlider;
    
    // Фиксированная ширина слайдера будет вычисляться динамически для каждого слайдера
    // на основе позиции начала (после label) и фиксированной позиции конца

    // Начало контента — с учётом паддинга (относительно центра панели)
    const startY = -boxHeight / 2 + padding + 30;
    const spacing = 32;
    const inputX = -width / 2 + padding;

    // Все слайдеры теперь внутри panel.container
    // Передаем фиксированную позицию конца слайдера для выравнивания значений справа
    this.createEnvironmentSlider(
      'Wind X:',
      inputX,
      startY,
      currentEffects.windX ?? defaultEffects.windX,
      -2,
      2,
      (v) => this.updateEnvironmentEffect('windX', v, defaultEffects),
      'windX',
      panel.container,
      sliderEndX
    );

    this.createEnvironmentSlider(
      'Wind Y:',
      inputX,
      startY + spacing,
      currentEffects.windY ?? defaultEffects.windY,
      -2,
      2,
      (v) => this.updateEnvironmentEffect('windY', v, defaultEffects),
      'windY',
      panel.container,
      sliderEndX
    );

    this.createEnvironmentSlider(
      'Gravity:',
      inputX,
      startY + spacing * 2,
      currentEffects.gravity ?? defaultEffects.gravity,
      0.1,
      2,
      (v) => this.updateEnvironmentEffect('gravity', v, defaultEffects),
      'gravity',
      panel.container,
      sliderEndX
    );

    this.createEnvironmentSlider(
      'Air Density:',
      inputX,
      startY + spacing * 3,
      currentEffects.airDensity ?? defaultEffects.airDensity,
      0.1,
      2,
      (v) => this.updateEnvironmentEffect('airDensity', v, defaultEffects),
      'airDensity',
      panel.container,
      sliderEndX
    );
  }

  /**
   * Вспомогательная функция — чтобы не дублировать логику
   */
  private updateEnvironmentEffect(
    key: keyof NonNullable<ILevelConfig['environmentEffects']>,
    value: number,
    defaultEffects: ReturnType<typeof EnvironmentSystem.getEffects>
  ): void {
    if (!this.levelConfig.environmentEffects) {
      this.levelConfig.environmentEffects = { ...defaultEffects };
    }
    this.levelConfig.environmentEffects[key] = value;
    this.updatePreview();
  }

  /**
   * Create a slider for environment parameter (Phaser native, NES style)
   */
  private createEnvironmentSlider(
    label: string,
    x: number,
    y: number,
    initialValue: number,
    min: number,
    max: number,
    onChange: (value: number) => void,
    key: 'windX' | 'windY' | 'gravity' | 'airDensity',
    parentContainer: Phaser.GameObjects.Container,
    sliderEndX?: number
  ): void {
    // Вычисляем ширину label для этого конкретного слайдера
    const tempText = this.add.bitmapText(0, 0, 'pixel-font', label, NESTheme.defaultFontSize);
    const labelWidth = tempText.width;
    tempText.destroy();
    
    // Позиция начала слайдера = позиция контейнера (x) + ширина label + отступ
    const gapAfterLabel = 15; // Увеличенный отступ между label и слайдером
    const sliderStartX = x + labelWidth + gapAfterLabel;
    
    // Ширина слайдера = фиксированная позиция конца - позиция начала
    // sliderEndX задается относительно центра панели, а sliderStartX относительно того же центра
    const sliderWidth = sliderEndX !== undefined ? sliderEndX - sliderStartX : 150;
    
    const slider = createNESSlider(
      this,
      parentContainer,
      {
      x,
      y,
      label,
      value: initialValue,
      min,
      max,
      sliderStartX,
      sliderWidth,
      onChange,
      }
    );

    // Store slider reference
    this.environmentSliders[key] = { thumb: slider.thumb, valueText: slider.valueText };
  }

  /**
   * Update preview based on current config
   */
  private updatePreview(): void {
    if (this.previewRenderer) {
      this.previewRenderer.update(this.levelConfig, this.previewSeed);
    }
    
    // Update environment info
    this.updateEnvironmentInfo();
  }
  
  /**
   * Update environment info sliders based on current config
   */
  private updateEnvironmentInfo(): void {
    // Note: This method is called after scene restart, so sliders are recreated with new values
    // Sliders automatically use currentEffects from createEnvironmentInfo()
  }

  /**
   * Create seed control with +/- buttons and random button (NES style)
   */
  private createSeedInput(x: number, y: number): void {
    // Label with shadow (NES style)
    createTextWithShadow(
      this,
      this.contentContainer,
      x,
      y,
      'Seed:',
      14,
      NESColors.white,
      0,
      0.5
    );
    
    // Вычисляем ширину label для позиционирования
    const tempText = this.add.bitmapText(0, 0, 'pixel-font', 'Seed:', NESTheme.defaultFontSize);
    const labelWidth = tempText.width;
    tempText.destroy();
    
    const gapAfterLabel = 15; // Отступ после label
    const valueX = x + labelWidth + gapAfterLabel;
    const buttonSpacing = 10; // Отступ между кнопками
    const buttonWidth = 32;
    const buttonHeight = 24;
    
    // Отображение значения seed
    const seedValue = Math.floor(this.previewSeed).toString();
    
    // Вычисляем ширину значения seed ДО создания текста для правильного позиционирования кнопок
    // Используем временный текст для измерения ширины
    const tempSeedText = this.add.bitmapText(0, 0, 'pixel-font', seedValue, 14);
    const seedValueWidth = tempSeedText.width;
    tempSeedText.destroy();
    
    const { shadow: seedShadow, text: seedText } = createTextWithShadow(
      this,
      this.contentContainer,
      valueX,
      y,
      seedValue,
      14,
      NESColors.yellow,
      0,
      0.5
    );
    this.seedValueText = seedText;
    this.seedValueShadow = seedShadow;
    
    // Отступ после значения seed перед кнопками (увеличен для лучшей визуальной разделенности)
    const gapAfterValue = 30;
    
    // Кнопка "-" для уменьшения seed
    // valueX - это левый край текста (origin 0), добавляем ширину текста + отступ
    const minusButtonX = valueX + seedValueWidth + gapAfterValue;
    createNESButton(
      this,
      this.contentContainer,
      {
        x: minusButtonX,
        y,
        width: buttonWidth,
        height: buttonHeight,
        text: '-',
        onClick: () => {
          this.previewSeed = Math.max(0, Math.floor(this.previewSeed) - 1);
          this.updateSeedDisplay();
          this.updatePreview();
        },
      }
    );
    
    // Кнопка "+" для увеличения seed
    const plusButtonX = minusButtonX + buttonWidth + buttonSpacing;
    createNESButton(
      this,
      this.contentContainer,
      {
        x: plusButtonX,
        y,
        width: buttonWidth,
        height: buttonHeight,
        text: '+',
        onClick: () => {
          this.previewSeed = Math.floor(this.previewSeed) + 1;
          this.updateSeedDisplay();
          this.updatePreview();
        },
      }
    );
    
    // Кнопка Random (@)
    const randomButtonX = plusButtonX + buttonWidth + buttonSpacing;
    createNESButton(
      this,
      this.contentContainer,
      {
        x: randomButtonX,
        y,
        width: buttonWidth,
        height: buttonHeight,
        text: '@',
        onClick: () => {
          this.previewSeed = Math.floor(Math.random() * 1000000);
          this.updateSeedDisplay();
          this.updatePreview();
        },
      }
    );
  }
  
  /**
   * Update seed value display
   */
  private updateSeedDisplay(): void {
    if (this.seedValueText && this.seedValueShadow) {
      const seedValue = Math.floor(this.previewSeed).toString();
      this.seedValueText.setText(seedValue);
      this.seedValueShadow.setText(seedValue); // Обновляем и тень тоже
    }
  }

  /**
   * Create "Random All" button to randomize all settings (vertical layout with border like biomes)
   */
  private createRandomAllButton(x: number, y: number, width: number, height: number): void {
    createNESButton(this, this.contentContainer, {
      x,
      y,
      width,
      height,
      text: 'Randomize',
      onClick: () => this.randomizeAll(),
    });
  }

  /**
   * Randomize all level settings
   */
  private randomizeAll(): void {
    // Random biome
    const biomes = [TerrainBiome.TEMPERATE, TerrainBiome.DESERT, TerrainBiome.ARCTIC, TerrainBiome.VOLCANIC];
    this.levelConfig.biome = biomes[Math.floor(Math.random() * biomes.length)];

    // Random terrain shape
    this.levelConfig.shape = Math.random() > 0.5 ? TerrainShape.HILLS : TerrainShape.MOUNTAINS;

    // Random weather
    const weathers: WeatherType[] = ['none', 'rain', 'snow'];
    this.levelConfig.weather = weathers[Math.floor(Math.random() * weathers.length)];

    // Random time of day
    this.levelConfig.timeOfDay = Math.random() > 0.5 ? 'day' : 'night';

    // Random season
    this.levelConfig.season = Math.random() > 0.5 ? 'summer' : 'winter';

    // Random seed
    this.previewSeed = Math.floor(Math.random() * 1000000);

    // Restart scene to apply all changes
    console.log('[LevelEditorScene] Calling scene.restart() due to randomizeAll()');
    this.scene.restart();
  }

  /**
   * Create start button in menu style (text only with arrow)
   */
  private createStartButton(x: number, y: number): void {
    // Calculate left-aligned position (like in main menu)
    const textX = x - 70; // Offset to center the button area

    createNESMenuButton(
      this,
      this.contentContainer,
      {
      x: textX,
      y,
      text: 'START GAME',
      active: true,
      onClick: () => this.startGame(),
      }
    );
  }

  /**
   * Create back button in menu style (text only with arrow)
   */
  private createBackButton(x: number, y: number): void {
    // Calculate left-aligned position (like in main menu)
    const textX = x - 30; // Offset to center the button area

    createNESMenuButton(
      this,
      this.contentContainer,
      {
      x: textX,
      y,
      text: 'BACK',
      active: false,
      onClick: () => {
      // Don't stop music when going back to menu - let MenuScene handle it
      this.scene.start('MenuScene');
      },
      }
    );
  }

  /**
   * Get current values from environment sliders
   */
  private getCurrentEnvironmentEffects(): IEnvironmentEffects {
    // Get default effects as fallback
    const defaultEffects = EnvironmentSystem.getEffects(
      this.levelConfig.biome,
      this.levelConfig.weather,
      this.levelConfig.timeOfDay
    );

    // Get current values from sliders by parsing their valueText
    const effects: IEnvironmentEffects = {
      windX: defaultEffects.windX,
      windY: defaultEffects.windY,
      gravity: defaultEffects.gravity,
      airDensity: defaultEffects.airDensity,
    };

    // Parse values from slider text displays
    if (this.environmentSliders.windX?.valueText) {
      effects.windX = parseFloat(this.environmentSliders.windX.valueText.text) || defaultEffects.windX;
    }
    if (this.environmentSliders.windY?.valueText) {
      effects.windY = parseFloat(this.environmentSliders.windY.valueText.text) || defaultEffects.windY;
    }
    if (this.environmentSliders.gravity?.valueText) {
      effects.gravity = parseFloat(this.environmentSliders.gravity.valueText.text) || defaultEffects.gravity;
    }
    if (this.environmentSliders.airDensity?.valueText) {
      effects.airDensity = parseFloat(this.environmentSliders.airDensity.valueText.text) || defaultEffects.airDensity;
    }

    return effects;
  }

  /**
   * Start game with configured level
   */
  private startGame(): void {
    // Stop menu music before starting game
    this.audioSystem.stopMenuMusic();
    
    // Always get current values from sliders
    const environmentEffects = this.getCurrentEnvironmentEffects();
    
    // Add the preview seed to level config so the game uses the same terrain
    const configWithSeed: ILevelConfig = {
      ...this.levelConfig,
      seed: this.previewSeed,
      environmentEffects, // Always include current slider values
    };

    // Log what we're passing to GameScene
    console.log('🚀 Starting game with config:', {
      gameMode: GameMode.Local,
      levelConfig: {
        ...configWithSeed,
      },
    });
    console.log('📦 Full levelConfig object:', JSON.stringify(configWithSeed, null, 2));

    this.scene.start('GameScene', {
      gameMode: GameMode.Local,
      levelConfig: configWithSeed,
    });
  }

  /**
   * Clean up when scene is shut down
   * 
   * Best Practice: Don't stop music here because shutdown() is called both:
   * 1. On scene.restart() - we stay in the same scene, music should continue
   * 2. On scene transition - music is stopped explicitly before transition
   * 
   * Music management:
   * - Uses game.sound (not scene.sound) to persist across scene restarts
   * - Stopped explicitly in startGame() before transitioning to GameScene
   * - MenuScene manages its own music when returning to menu
   */
  shutdown(): void {
    console.log('[LevelEditorScene] shutdown() called - Scene is being shut down');
    // Don't stop music here - shutdown() is called on scene.restart() too
    // Music is stopped in startGame() when transitioning to GameScene
    // When going back to MenuScene, MenuScene manages its own music
    // This follows Phaser best practices: use game.sound for persistent music
    
    // Clean up environment sliders (Phaser objects are automatically destroyed with scene)
    this.environmentSliders = {};
    
    // Clean up preview renderer
    if (this.previewRenderer) {
      this.previewRenderer.destroy();
    }
  }
}
