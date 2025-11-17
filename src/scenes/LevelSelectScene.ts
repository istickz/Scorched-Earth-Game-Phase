import Phaser from 'phaser';
import { GameMode, TerrainBiome, TerrainShape, type ILevelConfig, type WeatherType, type TimeOfDay, type Season } from '@/types';
import { BiomeSystem } from '@/systems/BiomeSystem';
import { NoiseGenerator } from '@/utils/NoiseGenerator';
import { WeatherSystem } from '@/systems/WeatherSystem';
import { PixelIconGenerator } from '@/utils/PixelIconGenerator';

/**
 * Level configuration scene with modular biome/terrain system
 */
export class LevelSelectScene extends Phaser.Scene {
  private levelConfig: ILevelConfig = {
    biome: TerrainBiome.TEMPERATE,
    shape: TerrainShape.HILLS,
    weather: 'none',
    roughness: 0.15,
    timeOfDay: 'day',
    season: 'summer',
  };

  private previewGraphics!: Phaser.GameObjects.Graphics;
  private roughnessValueText!: Phaser.GameObjects.BitmapText;
  private previewSeed: number = Math.random() * 1000000;
  private seedInputElement!: HTMLInputElement;
  private previewWeatherEmitter?: Phaser.GameObjects.Particles.ParticleEmitter;
  private previewMaskGraphics?: Phaser.GameObjects.Graphics;
  private menuMusic!: Phaser.Sound.BaseSound | null;
  private previewX!: number;
  private previewY!: number;
  private previewWidth!: number;
  private previewHeight!: number;
  private contentContainer!: Phaser.GameObjects.Container;

  constructor() {
    super({ key: 'LevelSelectScene' });
  }

  create(): void {
    const screenWidth = this.cameras.main.width;
    const screenHeight = this.cameras.main.height;

    // Register shutdown handler
    this.events.once('shutdown', this.shutdown, this);

    // NES-style colors
    const nesRed = '#e74c3c';
    const nesYellow = '#f1c40f';
    const nesWhite = '#ffffff';

    // Create NES-style background
    this.createNESBackground(screenWidth, screenHeight);

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
    const modifiersStartY = contentStartY + 250;
    const buttonsStartY = modifiersStartY + 380; // Lowered Start button
    const backButtonY = buttonsStartY + 60;
    
    // Calculate required container height based on bottom-most element
    // backButtonY is relative to container top (includes top padding + title offset)
    // Container height = content height (backButtonY - top padding) + top padding + bottom padding
    // Simplified: backButtonY + bottom padding
    const requiredContainerHeight = backButtonY + containerPadding;
    const maxAvailableHeight = screenHeight - containerTopY - 50;
    const containerHeight = Math.min(requiredContainerHeight, maxAvailableHeight + containerPadding * 2);
    
    const containerX = screenWidth / 2;
    const containerY = containerTopY + containerHeight / 2;

    // Create content container with NES-style border
    this.createContentContainer(containerX, containerY, contentWidth, containerHeight);

    // Now calculate positions relative to container center
    const previewX = -contentWidth / 2 + containerPadding;
    const controlsX = previewX + previewWidth + gap;
    
    // Ensure controls don't exceed container width
    const maxControlsX = contentWidth / 2 - containerPadding;
    const actualControlsX = Math.min(controlsX, maxControlsX - controlsWidth);
    
    // Title height offset (both titles should be at same height) - already defined above
    const contentStartYRelative = -containerHeight / 2 + containerPadding + titleOffsetY;
    const modifiersStartYRelative = contentStartYRelative + 250;
    const buttonsStartYRelative = modifiersStartYRelative + 380; // Lowered Start button
    const backButtonYRelative = buttonsStartYRelative + 60;

    // Create preview on the left (y position includes space for title)
    this.createPreview(previewX, contentStartYRelative, previewWidth, previewHeight, titleOffsetY);

    // Create biome selection buttons on the right (2 rows, 2 columns)
    this.createBiomeButtons(actualControlsX, contentStartYRelative, controlsWidth, titleOffsetY);

    // Create modifiers section on the right below biomes
    this.createModifiersSection(actualControlsX, modifiersStartYRelative, controlsWidth);

    // Calculate buttons position
    const buttonsCenterX = actualControlsX + controlsWidth / 2;
    
    // Start and Back buttons
    this.createStartButton(buttonsCenterX, buttonsStartYRelative);
    this.createBackButton(buttonsCenterX, backButtonYRelative);

    // Initial preview
    this.updatePreview();

    // Play menu music (if loaded)
    this.playMenuMusic();
  }

  /**
   * Create content container with NES-style border
   */
  private createContentContainer(x: number, y: number, width: number, height: number): void {
    // Create container
    this.contentContainer = this.add.container(x, y);

    // Background box with NES-style border
    const bgGraphics = this.add.graphics();
    bgGraphics.fillStyle(0x34495e, 0.8);
    bgGraphics.fillRoundedRect(-width / 2, -height / 2, width, height, 8);
    bgGraphics.lineStyle(3, 0x3498db);
    bgGraphics.strokeRoundedRect(-width / 2, -height / 2, width, height, 8);
    
    // Inner border
    bgGraphics.lineStyle(1, 0x5dade2);
    bgGraphics.strokeRoundedRect(-width / 2 + 4, -height / 2 + 4, width - 8, height - 8, 6);

    this.contentContainer.add(bgGraphics);
  }

  /**
   * Create NES-style background
   */
  private createNESBackground(width: number, height: number): void {
    const bgGraphics = this.add.graphics();
    
    // Dark blue base
    bgGraphics.fillStyle(0x2c3e50);
    bgGraphics.fillRect(0, 0, width, height);

    // Add some pattern for NES feel
    for (let y = 0; y < height; y += 4) {
      if (y % 8 === 0) {
        bgGraphics.fillStyle(0x34495e);
        bgGraphics.fillRect(0, y, width, 2);
      }
    }
  }

  /**
   * Create NES-style title
   */
  private createNESTitle(width: number, _height: number, _red: string, _yellow: string, _white: string): void {
    const titleY = 100; // Lowered title position further
    const nesRed = 0xe74c3c;
    const nesYellow = 0xf1c40f;
    
    // Main title with shadow effect (NES style) - using bitmap font
    const titleShadow = this.add.bitmapText(width / 2 + 4, titleY + 4, 'pixel-font', 'SELECT TERRAIN', 32);
    titleShadow.setTintFill(0x000000);
    titleShadow.setOrigin(0.5);

    const title = this.add.bitmapText(width / 2, titleY, 'pixel-font', 'SELECT TERRAIN', 32);
    title.setTintFill(nesRed);
    title.setOrigin(0.5);

    // Subtitle with NES colors
    const subtitleShadow = this.add.bitmapText(width / 2 + 2, titleY + 55 + 2, 'pixel-font', 'Local Multiplayer - Configure Battle', 14);
    subtitleShadow.setTintFill(0x000000);
    subtitleShadow.setOrigin(0.5);
    
    const subtitle = this.add.bitmapText(width / 2, titleY + 55, 'pixel-font', 'Local Multiplayer - Configure Battle', 14);
    subtitle.setTintFill(nesYellow);
    subtitle.setOrigin(0.5);
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
    const titleShadow = this.add.bitmapText(startX + availableWidth / 2 + 2, titleY + 2, 'pixel-font', 'BIOMES', 16);
    titleShadow.setTintFill(0x000000);
    titleShadow.setOrigin(0.5);

    const title = this.add.bitmapText(startX + availableWidth / 2, titleY, 'pixel-font', 'BIOMES', 16);
    title.setTintFill(0xf1c40f);
    title.setOrigin(0.5);
    
    this.contentContainer.add([titleShadow, title]);

    biomes.forEach((biome, index) => {
      const row = Math.floor(index / cols);
      const col = index % cols;
      const x = startX + col * (buttonWidth + spacing);
      const y = startY + row * (buttonHeight + spacing);
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
    const container = this.add.container(x, y);
    const isSelected = this.levelConfig.biome === biome;
    const nesBlue = 0x3498db;
    const nesYellow = 0xf1c40f;

    // Button background with NES style
    const bg = this.add.graphics();
    bg.fillStyle(isSelected ? 0x34495e : 0x2c3e50, 0.9);
    bg.fillRoundedRect(0, 0, width, height, 8);
    bg.lineStyle(isSelected ? 3 : 2, isSelected ? nesYellow : nesBlue, 1);
    bg.strokeRoundedRect(0, 0, width, height, 8);
    
    // Inner border for NES feel
    if (isSelected) {
      bg.lineStyle(1, nesBlue, 0.8);
      bg.strokeRoundedRect(2, 2, width - 4, height - 4, 6);
    }

    bg.setInteractive({
      hitArea: new Phaser.Geom.Rectangle(0, 0, width, height),
      hitAreaCallback: Phaser.Geom.Rectangle.Contains,
      useHandCursor: true,
    });

    // Pixel art icon with shadow (NES style)
    const iconSize = 32;
    const iconX = width / 2;
    const iconY = 30;
    
    const iconShadow = PixelIconGenerator.createBiomeIcon(this, biome, iconX + 2, iconY + 2, iconSize, 0x000000);
    const icon = PixelIconGenerator.createBiomeIcon(this, biome, iconX, iconY, iconSize);

    // Name with shadow (NES style)
    const nameShadow = this.add.bitmapText(width / 2 + 2, 77, 'pixel-font', BiomeSystem.getBiomeName(biome), 14);
    nameShadow.setTintFill(0x000000);
    nameShadow.setOrigin(0.5);

    const name = this.add.bitmapText(width / 2, 75, 'pixel-font', BiomeSystem.getBiomeName(biome), 14);
    name.setTintFill(isSelected ? 0xf1c40f : 0xffffff);
    name.setOrigin(0.5);

    container.add([bg, iconShadow, icon, nameShadow, name]);
    this.contentContainer.add(container);

    // Hover effect
    bg.on('pointerover', () => {
      if (this.levelConfig.biome !== biome) {
        bg.clear();
        bg.fillStyle(0x34495e, 0.9);
        bg.fillRoundedRect(0, 0, width, height, 8);
        bg.lineStyle(2, nesBlue, 1);
        bg.strokeRoundedRect(0, 0, width, height, 8);
      }
    });

    bg.on('pointerout', () => {
      if (this.levelConfig.biome !== biome) {
        bg.clear();
        bg.fillStyle(0x2c3e50, 0.9);
        bg.fillRoundedRect(0, 0, width, height, 8);
        bg.lineStyle(2, nesBlue, 1);
        bg.strokeRoundedRect(0, 0, width, height, 8);
      }
    });

    // Click to select
    bg.on('pointerdown', () => {
      this.levelConfig.biome = biome;
      this.scene.restart(); // Restart scene to refresh selection
    });
  }

  /**
   * Create modifiers section
   */
  private createModifiersSection(startX: number, startY: number, availableWidth: number): void {
    const sectionCenterX = startX + availableWidth / 2;

    // Section title with NES style
    const modifiersTitleShadow = this.add.bitmapText(sectionCenterX + 2, startY + 2, 'pixel-font', 'MODIFIERS', 16);
    modifiersTitleShadow.setTintFill(0x000000);
    modifiersTitleShadow.setOrigin(0.5);

    const modifiersTitle = this.add.bitmapText(sectionCenterX, startY, 'pixel-font', 'MODIFIERS', 16);
    modifiersTitle.setTintFill(0xf1c40f);
    modifiersTitle.setOrigin(0.5);
    
    this.contentContainer.add([modifiersTitleShadow, modifiersTitle]);

    const row1Y = startY + 40;
    const row2Y = startY + 80;
    const row3Y = startY + 120;
    const row4Y = startY + 160;
    const row5Y = startY + 210;
    const row6Y = startY + 260; // Increased spacing before Seed

    // Terrain Shape
    this.createRadioGroup('Terrain:', startX, row1Y, [
      { label: 'Hills', value: TerrainShape.HILLS },
      { label: 'Mountains', value: TerrainShape.MOUNTAINS },
    ], this.levelConfig.shape, (value) => {
      this.levelConfig.shape = value as TerrainShape;
      this.updatePreview();
    });

    // Weather
    this.createRadioGroup('Weather:', startX, row2Y, [
      { label: 'Clear', value: 'none' },
      { label: 'Rain', value: 'rain' },
      { label: 'Snow', value: 'snow' },
    ], this.levelConfig.weather, (value) => {
      this.levelConfig.weather = value as WeatherType;
      this.updatePreview();
    });

    // Time of Day
    this.createRadioGroup('Time:', startX, row3Y, [
      { label: 'Day', value: 'day' },
      { label: 'Night', value: 'night' },
    ], this.levelConfig.timeOfDay, (value) => {
      this.levelConfig.timeOfDay = value as TimeOfDay;
      this.updatePreview();
    });

    // Season
    this.createRadioGroup('Season:', startX, row4Y, [
      { label: 'Summer', value: 'summer' },
      { label: 'Winter', value: 'winter' },
    ], this.levelConfig.season, (value) => {
      this.levelConfig.season = value as Season;
      this.updatePreview();
    });

    // Roughness slider
    this.createSlider('Roughness:', startX, row5Y);

    // Seed input
    this.createSeedInput(startX, row6Y);

    // "Random All" button on the right side (full height of modifiers list)
    const modifiersHeight = row6Y - row1Y; // Height from first to last row
    const buttonWidth = 200;
    this.createRandomAllButton(startX + availableWidth - buttonWidth / 2, row1Y, modifiersHeight);
  }

  /**
   * Create a radio button group
   */
  private createRadioGroup<T extends string>(
    label: string,
    x: number,
    y: number,
    options: { label: string; value: T }[],
    currentValue: T,
    onChange: (value: T) => void
  ): void {
    const nesBlue = 0x3498db;

    // Label with shadow (NES style)
    const labelShadow = this.add.bitmapText(x + 1, y + 1, 'pixel-font', label, 12);
    labelShadow.setTintFill(0x000000);

    const labelText = this.add.bitmapText(x, y, 'pixel-font', label, 12);
    labelText.setTintFill(0xffffff);

    const radioElements: Phaser.GameObjects.GameObject[] = [labelShadow, labelText];

    // Radio buttons
    let offsetX = x + 100;
    options.forEach((option) => {
      const isSelected = currentValue === option.value;
      
      // Circle with NES style
      const circle = this.add.circle(offsetX, y + 8, 8, isSelected ? 0xf1c40f : 0x34495e)
        .setStrokeStyle(2, isSelected ? nesBlue : 0x5dade2)
        .setInteractive({ useHandCursor: true });

      // Label with shadow (NES style)
      const optionLabelShadow = this.add.bitmapText(offsetX + 15 + 1, y + 1, 'pixel-font', option.label, 12);
      optionLabelShadow.setTintFill(0x000000);

      const text = this.add.bitmapText(offsetX + 15, y, 'pixel-font', option.label, 12);
      text.setTintFill(isSelected ? 0xf1c40f : 0xffffff);

      radioElements.push(circle, optionLabelShadow, text);

      // Click handler
      circle.on('pointerdown', () => {
        onChange(option.value);
        this.scene.restart();
      });

      text.setInteractive({ useHandCursor: true });
      text.on('pointerdown', () => {
        onChange(option.value);
        this.scene.restart();
      });

      offsetX += 100;
    });

    this.contentContainer.add(radioElements);
  }

  /**
   * Create a slider for roughness
   */
  private createSlider(label: string, x: number, y: number): void {
    const nesBlue = 0x3498db;

    // Label with shadow (NES style) - aligned like other labels
    const labelShadow = this.add.bitmapText(x + 1, y + 1, 'pixel-font', label, 12);
    labelShadow.setTintFill(0x000000);
    labelShadow.setOrigin(0, 0.5);

    const labelText = this.add.bitmapText(x, y, 'pixel-font', label, 12);
    labelText.setTintFill(0xffffff);
    labelText.setOrigin(0, 0.5);

    const sliderX = x + 110; // Increased spacing from label
    const sliderWidth = 200;
    
    // Slider track with NES style - aligned with label center
    const track = this.add.rectangle(sliderX, y, sliderWidth, 6, 0x2c3e50).setOrigin(0, 0.5);
    const trackBorder = this.add.graphics();
    trackBorder.lineStyle(1, nesBlue, 0.5);
    trackBorder.strokeRect(sliderX - 1, y - 3, sliderWidth + 2, 6);

    // Slider thumb with NES style - aligned with label center
    const maxRoughness = 1.0;
    const thumbX = sliderX + (this.levelConfig.roughness / maxRoughness) * sliderWidth;
    const thumb = this.add.circle(thumbX, y, 10, 0xf1c40f)
      .setStrokeStyle(2, nesBlue)
      .setInteractive({ useHandCursor: true, draggable: true });

    // Value display with shadow (NES style)
    const valueShadow = this.add.bitmapText(sliderX + sliderWidth + 20 + 1, y + 1, 'pixel-font', this.levelConfig.roughness.toFixed(2), 12);
    valueShadow.setTintFill(0x000000);

    this.roughnessValueText = this.add.bitmapText(sliderX + sliderWidth + 20, y, 'pixel-font', this.levelConfig.roughness.toFixed(2), 12);
    this.roughnessValueText.setTintFill(0xffffff);

    this.contentContainer.add([labelShadow, labelText, track, trackBorder, thumb, valueShadow, this.roughnessValueText]);

    // Drag handler - Phaser automatically handles container-local coordinates for interactive objects
    thumb.on('drag', (_pointer: Phaser.Input.Pointer, dragX: number) => {
      // dragX is already in container-local coordinates
      const newX = Phaser.Math.Clamp(dragX, sliderX, sliderX + sliderWidth);
      thumb.x = newX;
      
      // Calculate roughness (0.05 to 1.0)
      const maxRoughness = 1.0;
      const minRoughness = 0.05;
      const percent = (newX - sliderX) / sliderWidth;
      this.levelConfig.roughness = minRoughness + percent * (maxRoughness - minRoughness);
      this.roughnessValueText.setText(this.levelConfig.roughness.toFixed(2));
      
      this.updatePreview();
    });
  }

  /**
   * Create preview window (left side)
   */
  private createPreview(x: number, y: number, width: number, height: number, titleOffsetY: number = 30): void {
    // Preview label with NES style (positioned above the preview box)
    const labelX = x + width / 2;
    const titleY = y - titleOffsetY;
    const labelShadow = this.add.bitmapText(labelX + 2, titleY + 2, 'pixel-font', 'PREVIEW', 16);
    labelShadow.setTintFill(0x000000);
    labelShadow.setOrigin(0.5);

    const label = this.add.bitmapText(labelX, titleY, 'pixel-font', 'PREVIEW', 16);
    label.setTintFill(0xf1c40f);
    label.setOrigin(0.5);
    
    this.contentContainer.add([labelShadow, label]);

    // Preview border with NES style
    const previewBorder = this.add.graphics();
    previewBorder.lineStyle(3, 0x3498db, 1);
    previewBorder.strokeRoundedRect(x, y, width, height, 8);
    previewBorder.lineStyle(1, 0x5dade2, 0.8);
    previewBorder.strokeRoundedRect(x + 2, y + 2, width - 4, height - 4, 6);
    this.contentContainer.add(previewBorder);

    // Preview graphics
    this.previewGraphics = this.add.graphics();
    this.previewGraphics.setPosition(x, y);
    this.contentContainer.add(this.previewGraphics);
    
    // Store preview dimensions for updatePreview() (absolute coordinates)
    const containerX = this.contentContainer.x;
    const containerY = this.contentContainer.y;
    this.previewX = containerX + x;
    this.previewY = containerY + y;
    this.previewWidth = width;
    this.previewHeight = height;
  }

  /**
   * Update preview based on current config
   */
  private updatePreview(): void {
    // Use stored preview dimensions
    const previewX = this.previewX || 0;
    const previewY = this.previewY || 0;
    const previewWidth = this.previewWidth || this.cameras.main.width * 0.6;
    const previewHeight = this.previewHeight || this.cameras.main.height * 0.35;

    this.previewGraphics.clear();

    // Get colors
    const colors = BiomeSystem.getColors(
      this.levelConfig.biome,
      this.levelConfig.season,
      this.levelConfig.timeOfDay
    );

    // Apply weather tint to sky color
    const skyColor = WeatherSystem.applySkyWeatherTint(colors.sky, this.levelConfig.weather);

    // Draw sky (full height of preview)
    this.previewGraphics.fillStyle(skyColor, 1);
    this.previewGraphics.fillRect(0, 0, previewWidth, previewHeight);

    // Draw terrain
    this.previewGraphics.fillStyle(colors.ground, 1);
    
    const terrainStartY = previewHeight * 0.6;
    const points: Phaser.Geom.Point[] = [];
    
    // Generate preview terrain using fractal noise (same as in game)
    for (let x = 0; x <= previewWidth; x += 3) {
      // Primary fractal noise (large scale features)
      const primaryNoise = NoiseGenerator.fractalNoise(x, this.previewSeed, this.levelConfig.shape);
      
      // Secondary fractal noise with different seed (medium scale features)
      const secondaryNoise = NoiseGenerator.fractalNoise(
        x, 
        this.previewSeed * 1.37 + 5000, 
        this.levelConfig.shape,
        this.levelConfig.shape === TerrainShape.HILLS ? 2 : 4
      );
      
      // Tertiary noise (small details)
      const tertiaryNoise = NoiseGenerator.fractalNoise(x, this.previewSeed * 2.71 + 10000, this.levelConfig.shape, 2);
      
      // Add some sine waves for smooth hills
      const sine1 = Math.sin((x + this.previewSeed) * 0.008) * 0.15;
      const sine2 = Math.sin((x + this.previewSeed * 1.618) * 0.015) * 0.1;
      const sine3 = Math.sin((x + this.previewSeed * 2.718) * 0.025) * 0.08;
      
      // Add local variation using seeded random
      const localVariation = (NoiseGenerator.seededRandom(this.previewSeed + x * 0.05) - 0.5) * this.levelConfig.roughness * 0.3;
      
      // Combine all noise sources with different weights
      const combinedNoise = 
        primaryNoise * 0.35 +
        secondaryNoise * 0.25 +
        tertiaryNoise * 0.15 +
        sine1 * 0.1 +
        sine2 * 0.08 +
        sine3 * 0.05 +
        localVariation * 0.02;
      
      // Normalize and scale for preview
      const normalizedHeight = Phaser.Math.Clamp(combinedNoise, 0, 1);
      
      // Apply roughness as amplitude multiplier
      // roughness 0.05-1.0, normalize to range ~0.33-6.67 (0.15 is default = 1.0x)
      const roughnessMultiplier = this.levelConfig.roughness / 0.15;
      const waveHeight = (normalizedHeight - 0.5) * previewHeight * 0.4 * roughnessMultiplier;
      
      // Clamp y position to stay within preview bounds
      // terrainStartY is the base line, waveHeight can go up or down from it
      // But we need to ensure it doesn't go above 0 (top of preview) or below previewHeight (bottom)
      const y = Phaser.Math.Clamp(terrainStartY + waveHeight, 0, previewHeight);
      points.push(new Phaser.Geom.Point(x, y));
    }

    // Draw terrain shape
    this.previewGraphics.beginPath();
    this.previewGraphics.moveTo(0, terrainStartY);
    
    points.forEach(point => {
      this.previewGraphics.lineTo(point.x, point.y);
    });
    
    this.previewGraphics.lineTo(previewWidth, previewHeight);
    this.previewGraphics.lineTo(0, previewHeight);
    this.previewGraphics.closePath();
    this.previewGraphics.fillPath();

    // Draw snow layer if winter
    if (BiomeSystem.shouldHaveSnow(this.levelConfig.biome, this.levelConfig.season)) {
      this.previewGraphics.fillStyle(0xffffff, 0.9);
      this.previewGraphics.beginPath();
      this.previewGraphics.moveTo(0, terrainStartY);
      
      points.forEach(point => {
        this.previewGraphics.lineTo(point.x, point.y - 3);
      });
      
      this.previewGraphics.lineTo(previewWidth, points[points.length - 1].y - 3);
      this.previewGraphics.lineTo(previewWidth, previewHeight);
      this.previewGraphics.lineTo(0, previewHeight);
      this.previewGraphics.closePath();
      this.previewGraphics.fillPath();
    }

    // Create/update weather effects for preview
    if (this.previewWeatherEmitter) {
      this.previewWeatherEmitter.destroy();
      this.previewWeatherEmitter = undefined;
    }
    
    if (this.previewMaskGraphics) {
      this.previewMaskGraphics.destroy();
      this.previewMaskGraphics = undefined;
    }

    if (this.levelConfig.weather !== 'none') {
      // Use stored preview position
      const weatherPreviewX = previewX;
      const weatherPreviewY = previewY;
      
      // Create weather particle textures if needed
      if (!this.textures.exists('weather-particle')) {
        const graphics = this.add.graphics();
        graphics.fillStyle(0xffffff);
        graphics.fillCircle(1, 1, 1);
        graphics.generateTexture('weather-particle', 2, 2);
        graphics.destroy();
      }

      if (this.levelConfig.weather === 'rain' && !this.textures.exists('rain-drop')) {
        const graphics = this.add.graphics();
        graphics.fillStyle(0xffffff);
        graphics.fillEllipse(0.5, 0, 0.5, 64);
        graphics.generateTexture('rain-drop', 1, 64);
        graphics.destroy();
      }

      // Create particles for preview area only
      // Create mask to limit particles to preview area
      this.previewMaskGraphics = this.add.graphics();
      this.previewMaskGraphics.fillStyle(0xffffff);
      this.previewMaskGraphics.fillRect(weatherPreviewX, weatherPreviewY, previewWidth, previewHeight);
      this.previewMaskGraphics.setVisible(false); // Hide mask graphics, but keep it for masking
      const mask = this.previewMaskGraphics.createGeometryMask();
      
      if (this.levelConfig.weather === 'rain') {
        const rainColor = this.levelConfig.timeOfDay === 'day' ? 0x4477aa : 0xaaccff;
        this.previewWeatherEmitter = this.add.particles(weatherPreviewX, weatherPreviewY - 10, 'rain-drop', {
          x: { min: 0, max: previewWidth },
          y: 0,
          lifespan: 1500,
          speedY: { min: 300, max: 450 },
          speedX: { min: 200, max: 300 },
          scale: { start: 0.6, end: 0.5 },
          scaleY: { start: 1.0, end: 0.9 },
          alpha: { start: 1.0, end: 0.9 },
          tint: rainColor,
          frequency: 20,
          quantity: 3,
          blendMode: this.levelConfig.timeOfDay === 'day' ? 'NORMAL' : 'SCREEN',
          gravityY: 200,
        });
        this.previewWeatherEmitter.setMask(mask);
        this.previewWeatherEmitter.setDepth(101);
      } else if (this.levelConfig.weather === 'snow') {
        this.previewWeatherEmitter = this.add.particles(weatherPreviewX, weatherPreviewY - 10, 'weather-particle', {
          x: { min: 0, max: previewWidth },
          y: 0,
          lifespan: 5000,
          speedY: { min: 30, max: 60 },
          speedX: { min: -20, max: 20 },
          scale: { start: 1.5, end: 0.8 },
          alpha: { start: 1.0, end: 0.7 },
          tint: 0xffffff,
          frequency: 15,
          quantity: 2,
          blendMode: 'ADD',
          gravityY: 20,
        });
        this.previewWeatherEmitter.setMask(mask);
        this.previewWeatherEmitter.setDepth(101);
      }
    }
  }

  /**
   * Create seed input with random button
   */
  private createSeedInput(x: number, y: number): void {
    // Label with shadow (NES style)
    const seedLabelShadow = this.add.bitmapText(x + 1, y + 1, 'pixel-font', 'Seed:', 12);
    seedLabelShadow.setTintFill(0x000000);
    seedLabelShadow.setOrigin(0, 0.5);

    const seedLabel = this.add.bitmapText(x, y, 'pixel-font', 'Seed:', 12);
    seedLabel.setTintFill(0xffffff);
    seedLabel.setOrigin(0, 0.5);
    
    this.contentContainer.add([seedLabelShadow, seedLabel]);
    
    // Create HTML input element for seed
    this.seedInputElement = document.createElement('input');
    this.seedInputElement.type = 'text';
    this.seedInputElement.value = Math.floor(this.previewSeed).toString();
    
    // Get canvas position for proper positioning (account for container position)
    // Input height is 24px, so center it at y by offsetting by half height
    const canvas = this.game.canvas;
    const canvasRect = canvas.getBoundingClientRect();
    const containerX = this.contentContainer.x;
    const containerY = this.contentContainer.y;
    const inputLeft = canvasRect.left + containerX + x + 100;
    const inputTop = canvasRect.top + containerY + y - 12; // 12 = half of 24px height
    
    this.seedInputElement.style.cssText = `
      position: absolute;
      left: ${inputLeft}px;
      top: ${inputTop}px;
      width: 120px;
      height: 24px;
      padding: 2px 6px;
      font-size: 14px;
      font-family: Arial, sans-serif;
      background-color: #2a3a4e;
      color: #ffffff;
      border: 1px solid #4a5a6e;
      border-radius: 3px;
      outline: none;
      box-sizing: border-box;
    `;
    
    // Add input to body (not canvas parent)
    document.body.appendChild(this.seedInputElement);
    
    // Input change handler
    this.seedInputElement.addEventListener('input', () => {
      const value = this.seedInputElement.value.replace(/[^0-9]/g, ''); // Only numbers
      this.seedInputElement.value = value;
      
      if (value) {
        this.previewSeed = parseInt(value);
        this.updatePreview();
      }
    });
    
    // Random button (positioned relative to input width, aligned with label) - NES style
    const btnX = x + 100 + 130;
    const btnWidth = 32;
    const btnHeight = 24;
    const btnNesYellow = 0xf1c40f;
    const btnNesBlue = 0x3498db;
    
    const randomBtnContainer = this.add.container(btnX, y);
    
    // Background with NES style
    const btnBg = this.add.graphics();
    btnBg.fillStyle(0x34495e, 0.9);
    btnBg.fillRoundedRect(0, -btnHeight / 2, btnWidth, btnHeight, 4);
    btnBg.lineStyle(2, btnNesBlue, 1);
    btnBg.strokeRoundedRect(0, -btnHeight / 2, btnWidth, btnHeight, 4);
    
    // Make graphics interactive with explicit hit area
    btnBg.setInteractive({
      hitArea: new Phaser.Geom.Rectangle(0, -btnHeight / 2, btnWidth, btnHeight),
      hitAreaCallback: Phaser.Geom.Rectangle.Contains,
      useHandCursor: true,
    });
    
    // Pixel art dice icon (centered in button)
    const diceIcon = PixelIconGenerator.createDiceIcon(this, btnWidth / 2, 0, 16);
    
    randomBtnContainer.add([btnBg, diceIcon]);
    this.contentContainer.add(randomBtnContainer);
    
    btnBg.on('pointerover', () => {
      btnBg.clear();
      btnBg.fillStyle(0x5dade2, 0.9);
      btnBg.fillRoundedRect(0, -btnHeight / 2, btnWidth, btnHeight, 4);
      btnBg.lineStyle(2, btnNesYellow, 1);
      btnBg.strokeRoundedRect(0, -btnHeight / 2, btnWidth, btnHeight, 4);
    });
    
    btnBg.on('pointerout', () => {
      btnBg.clear();
      btnBg.fillStyle(0x34495e, 0.9);
      btnBg.fillRoundedRect(0, -btnHeight / 2, btnWidth, btnHeight, 4);
      btnBg.lineStyle(2, btnNesBlue, 1);
      btnBg.strokeRoundedRect(0, -btnHeight / 2, btnWidth, btnHeight, 4);
    });
    
    btnBg.on('pointerdown', () => {
      this.previewSeed = Math.floor(Math.random() * 1000000);
      this.seedInputElement.value = this.previewSeed.toString();
      this.updatePreview();
    });
  }

  /**
   * Create "Random All" button to randomize all settings (vertical layout with border like biomes)
   */
  private createRandomAllButton(x: number, y: number, height: number): void {
    const nesBlue = 0x3498db;
    const btnWidth = 200;

    // Container for the button
    const container = this.add.container(x, y);

    // Button background with NES style (like biomes)
    const bg = this.add.graphics();
    bg.fillStyle(0x2c3e50, 0.9);
    bg.fillRoundedRect(-btnWidth / 2, 0, btnWidth, height, 8);
    bg.lineStyle(2, nesBlue, 1);
    bg.strokeRoundedRect(-btnWidth / 2, 0, btnWidth, height, 8);

    bg.setInteractive({
      hitArea: new Phaser.Geom.Rectangle(-btnWidth / 2, 0, btnWidth, height),
      hitAreaCallback: Phaser.Geom.Rectangle.Contains,
      useHandCursor: true,
    });

    // Calculate center position for content
    const centerY = height / 2;

    // Pixel art dice icon shadow
    const diceIconShadow = PixelIconGenerator.createDiceIcon(this, 1, centerY - 20 + 1, 48, 0x000000);

    // Pixel art dice icon
    const diceIcon = PixelIconGenerator.createDiceIcon(this, 0, centerY - 20, 48);

    // Text shadow
    const textShadow = this.add.bitmapText(1, centerY + 25 + 1, 'pixel-font', 'Random', 12);
    textShadow.setTintFill(0x000000);
    textShadow.setOrigin(0.5, 0.5);

    // Text
    const text = this.add.bitmapText(0, centerY + 25, 'pixel-font', 'Random', 12);
    text.setTintFill(0xffffff);
    text.setOrigin(0.5, 0.5);

    container.add([bg, diceIconShadow, diceIcon, textShadow, text]);
    this.contentContainer.add(container);

    // Hover effects
    bg.on('pointerover', () => {
      bg.clear();
      bg.fillStyle(0x34495e, 0.9);
      bg.fillRoundedRect(-btnWidth / 2, 0, btnWidth, height, 8);
      bg.lineStyle(2, nesBlue, 1);
      bg.strokeRoundedRect(-btnWidth / 2, 0, btnWidth, height, 8);
      text.setTintFill(0xf1c40f);
    });

    bg.on('pointerout', () => {
      bg.clear();
      bg.fillStyle(0x2c3e50, 0.9);
      bg.fillRoundedRect(-btnWidth / 2, 0, btnWidth, height, 8);
      bg.lineStyle(2, nesBlue, 1);
      bg.strokeRoundedRect(-btnWidth / 2, 0, btnWidth, height, 8);
      text.setTintFill(0xffffff);
    });

    // Click handler - randomize everything
    bg.on('pointerdown', () => {
      this.randomizeAll();
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

    // Random roughness (0.05 to 1.0)
    this.levelConfig.roughness = 0.05 + Math.random() * 0.95;

    // Random seed
    this.previewSeed = Math.floor(Math.random() * 1000000);
    this.seedInputElement.value = this.previewSeed.toString();

    // Restart scene to apply all changes
    this.scene.restart();
  }

  /**
   * Create start button in menu style (text only with arrow)
   */
  private createStartButton(x: number, y: number): void {
    // Calculate left-aligned position (like in main menu)
    const textX = x - 70; // Offset to center the button area

    // Arrow cursor (hidden by default, shown on hover)
    const arrow = this.add.graphics();
    arrow.fillStyle(0xf1c40f);
    arrow.lineStyle(2, 0x000000);
    arrow.beginPath();
    arrow.moveTo(textX - 30, y - 8);
    arrow.lineTo(textX - 10, y);
    arrow.lineTo(textX - 30, y + 8);
    arrow.closePath();
    arrow.fillPath();
    arrow.strokePath();
    arrow.setVisible(false); // Hidden by default, shown on hover

    // Add blinking animation to arrow
    this.time.addEvent({
      delay: 500,
      callback: () => {
        if (arrow.visible) {
          arrow.setAlpha(arrow.alpha === 1 ? 0.3 : 1);
        }
      },
      loop: true,
    });

    // Text shadow (left-aligned like in main menu)
    const startTextShadow = this.add.bitmapText(textX + 2, y + 2, 'pixel-font', 'START GAME', 18);
    startTextShadow.setTintFill(0x000000);
    startTextShadow.setOrigin(0, 0.5);

    // Text in active state (yellow) by default
    const text = this.add.bitmapText(textX, y, 'pixel-font', 'START GAME', 18);
    text.setTintFill(0xf1c40f); // Yellow color (active state)
    text.setOrigin(0, 0.5);

    this.contentContainer.add([arrow, startTextShadow, text]);

    // Make text interactive
    text.setInteractive({ useHandCursor: true });

    text.on('pointerover', () => {
      arrow.setVisible(true);
      arrow.setAlpha(1);
      text.setTintFill(0xf1c40f);
    });

    text.on('pointerout', () => {
      // Hide arrow on pointer out, but keep active color
      arrow.setVisible(false);
      text.setTintFill(0xf1c40f);
    });

    text.on('pointerdown', () => this.startGame());
  }

  /**
   * Create back button in menu style (text only with arrow)
   */
  private createBackButton(x: number, y: number): void {
    // Calculate left-aligned position (like in main menu)
    const textX = x - 30; // Offset to center the button area

    // Arrow cursor (initially hidden)
    const arrow = this.add.graphics();
    arrow.fillStyle(0xf1c40f);
    arrow.lineStyle(2, 0x000000);
    arrow.beginPath();
    arrow.moveTo(textX - 30, y - 8);
    arrow.lineTo(textX - 10, y);
    arrow.lineTo(textX - 30, y + 8);
    arrow.closePath();
    arrow.fillPath();
    arrow.strokePath();
    arrow.setVisible(false);

    // Add blinking animation to arrow
    this.time.addEvent({
      delay: 500,
      callback: () => {
        if (arrow.visible) {
          arrow.setAlpha(arrow.alpha === 1 ? 0.3 : 1);
        }
      },
      loop: true,
    });

    // Text shadow (left-aligned like in main menu)
    const backTextShadow = this.add.bitmapText(textX + 2, y + 2, 'pixel-font', 'BACK', 18);
    backTextShadow.setTintFill(0x000000);
    backTextShadow.setOrigin(0, 0.5);

    const text = this.add.bitmapText(textX, y, 'pixel-font', 'BACK', 18);
    text.setTintFill(0xffffff);
    text.setOrigin(0, 0.5);

    this.contentContainer.add([arrow, backTextShadow, text]);

    // Make text interactive
    text.setInteractive({ useHandCursor: true });

    text.on('pointerover', () => {
      arrow.setVisible(true);
      arrow.setAlpha(1);
      text.setTintFill(0xf1c40f);
    });

    text.on('pointerout', () => {
      arrow.setVisible(false);
      text.setTintFill(0xffffff);
    });

    text.on('pointerdown', () => {
      // Don't stop music when going back to menu - let MenuScene handle it
      this.scene.start('MenuScene');
    });
  }

  /**
   * Start game with configured level
   */
  private startGame(): void {
    // Stop menu music before starting game
    this.stopMenuMusic();
    
    // Add the preview seed to level config so the game uses the same terrain
    const configWithSeed: ILevelConfig = {
      ...this.levelConfig,
      seed: this.previewSeed,
    };

    this.scene.start('GameScene', {
      gameMode: GameMode.Local,
      levelConfig: configWithSeed,
    });
  }

  /**
   * Play menu music in cracktro/demoscene style
   * Reuses existing music instance from MenuScene if it's already playing
   */
  private playMenuMusic(): void {
    try {
      // Check if music was loaded in cache
      if (this.cache.audio.exists('menu-music')) {
        // Check if music is already playing (from MenuScene)
        // Try to get existing sound by key
        let existingMusic: Phaser.Sound.BaseSound | null = null;
        try {
          // Check if sound with this key already exists
          interface SoundManagerWithSounds extends Phaser.Sound.BaseSoundManager {
            sounds?: Phaser.Sound.BaseSound[];
          }
          const soundManager = this.sound as SoundManagerWithSounds;
          if (soundManager.sounds) {
            existingMusic = soundManager.sounds.find((sound: Phaser.Sound.BaseSound) => {
              return sound.key === 'menu-music' && sound.isPlaying;
            }) || null;
          }
        } catch {
          // If we can't access sounds directly, continue to create new instance
        }
        
        if (existingMusic) {
          // Music is already playing from MenuScene, just store reference
          this.menuMusic = existingMusic as Phaser.Sound.BaseSound;
          console.log('Menu music already playing, reusing existing instance');
          return;
        }
        
        // If we have a reference but it's not playing, restart it
        if (this.menuMusic) {
          if (this.menuMusic.isPlaying) {
            console.log('Menu music already playing');
            return;
          } else {
            // Music was stopped, restart it
            this.menuMusic.play();
            console.log('Menu music restarted');
            return;
          }
        }
        
        // No existing music found, create new instance
        this.menuMusic = this.sound.add('menu-music', {
          volume: 0.5, // Adjust volume (0.0 to 1.0)
          loop: true,  // Loop the music
        });
        
        // Play music
        this.menuMusic.play();
        console.log('Menu music started');
      } else {
        console.warn('Menu music not found in cache. Make sure file is in public/assets/sounds/arcade_puzzler.ogg');
        console.log('Available audio files:', this.cache.audio.getKeys());
      }
    } catch (error) {
      // Music not loaded or error playing
      console.error('Error playing menu music:', error);
    }
  }

  /**
   * Stop menu music
   */
  private stopMenuMusic(): void {
    if (this.menuMusic) {
      if (this.menuMusic.isPlaying) {
        this.menuMusic.stop();
      }
      // Don't destroy the sound object, just stop it
      // It will be reused when returning to menu
    }
  }

  /**
   * Clean up HTML elements when scene is shut down
   */
  shutdown(): void {
    if (this.seedInputElement && this.seedInputElement.parentElement) {
      this.seedInputElement.parentElement.removeChild(this.seedInputElement);
    }
    
    // Clean up weather emitter
    if (this.previewWeatherEmitter) {
      this.previewWeatherEmitter.destroy();
      this.previewWeatherEmitter = undefined;
    }
    
    if (this.previewMaskGraphics) {
      this.previewMaskGraphics.destroy();
      this.previewMaskGraphics = undefined;
    }
  }
}
