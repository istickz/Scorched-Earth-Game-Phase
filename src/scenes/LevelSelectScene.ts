import Phaser from 'phaser';
import { GameMode, TerrainBiome, TerrainShape, type ILevelConfig } from '@/types';
import { BiomeSystem } from '@/systems/BiomeSystem';
import { NoiseGenerator } from '@/utils/NoiseGenerator';
import { WeatherSystem } from '@/systems/WeatherSystem';

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
  private roughnessValueText!: Phaser.GameObjects.Text;
  private previewSeed: number = Math.random() * 1000000;
  private seedInputElement!: HTMLInputElement;
  private previewWeatherEmitter?: Phaser.GameObjects.Particles.ParticleEmitter;
  private previewMaskGraphics?: Phaser.GameObjects.Graphics;
  private menuMusic!: Phaser.Sound.BaseSound | null;

  constructor() {
    super({ key: 'LevelSelectScene' });
  }

  create(): void {
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;

    // Register shutdown handler
    this.events.once('shutdown', this.shutdown, this);

    // NES-style colors
    const nesRed = '#e74c3c';
    const nesYellow = '#f1c40f';
    const nesWhite = '#ffffff';

    // Create NES-style background
    this.createNESBackground(width, height);

    // Create NES-style title
    this.createNESTitle(width, height, nesRed, nesYellow, nesWhite);

    // Layout: Preview on left (55%), Controls on right (45%)
    const previewWidth = width * 0.55;
    const leftMargin = width * 0.02;
    const rightMargin = width * 0.02;
    const previewX = leftMargin;
    const controlsX = previewWidth + leftMargin + 20; // 20px gap between sections
    const contentStartY = 140;
    // Calculate available width for controls (accounting for right margin)
    const availableControlsWidth = width - controlsX - rightMargin;

    // Create preview on the left
    this.createPreview(previewX, contentStartY, previewWidth - 40, height - contentStartY - 100);

    // Create biome selection buttons on the right (2 rows, 2 columns)
    this.createBiomeButtons(controlsX, contentStartY, availableControlsWidth);

    // Create modifiers section on the right below biomes
    this.createModifiersSection(controlsX, contentStartY + 240, availableControlsWidth);

    // Calculate buttons position after modifiers (row6Y + spacing)
    // row6Y is at startY + 240, so total modifiers height is 240 + some padding
    const modifiersEndY = contentStartY + 240 + 240 + 20; // modifiers start + row6Y offset + title height
    const buttonsStartY = modifiersEndY + 60; // Add more spacing between modifiers and buttons
    const buttonsCenterX = controlsX + availableControlsWidth / 2;
    
    // Start and Back buttons vertically after modifiers
    this.createStartButton(buttonsCenterX, buttonsStartY);
    this.createBackButton(buttonsCenterX, buttonsStartY + 60);

    // Initial preview
    this.updatePreview();

    // Play menu music (if loaded)
    this.playMenuMusic();
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
  private createNESTitle(width: number, height: number, red: string, yellow: string, white: string): void {
    const titleY = 60;
    
    // Main title with shadow effect (NES style)
    const titleShadow = this.add.text(width / 2 + 4, titleY + 4, 'SELECT TERRAIN', {
      fontSize: '42px',
      color: '#000000',
      fontFamily: 'Arial Black, sans-serif',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    const title = this.add.text(width / 2, titleY, 'SELECT TERRAIN', {
      fontSize: '42px',
      color: red,
      fontFamily: 'Arial Black, sans-serif',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 2,
    }).setOrigin(0.5);

    // Subtitle with NES colors
    const subtitle = this.add.text(width / 2, titleY + 50, 'Local Multiplayer - Configure Your Battle', {
      fontSize: '18px',
      color: yellow,
      fontFamily: 'Arial, sans-serif',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 1,
    }).setOrigin(0.5);
  }

  /**
   * Create biome selection buttons (2 rows, 2 columns)
   */
  private createBiomeButtons(startX: number, startY: number, availableWidth: number): void {
    const biomes = [
      TerrainBiome.TEMPERATE,
      TerrainBiome.DESERT,
      TerrainBiome.ARCTIC,
      TerrainBiome.VOLCANIC,
    ];

    const buttonWidth = (availableWidth - 20) / 2; // 2 columns, 20px spacing
    const buttonHeight = 100;
    const spacing = 20;
    const rows = 2;
    const cols = 2;

    // Title for biomes section
    const titleY = startY - 30;
    const titleShadow = this.add.text(startX + availableWidth / 2 + 2, titleY + 2, 'BIOMES', {
      fontSize: '20px',
      color: '#000000',
      fontFamily: 'Arial Black, sans-serif',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    const title = this.add.text(startX + availableWidth / 2, titleY, 'BIOMES', {
      fontSize: '20px',
      color: '#f1c40f',
      fontFamily: 'Arial Black, sans-serif',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 2,
    }).setOrigin(0.5);

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
    const nesDark = 0x34495e;

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

    bg.setInteractive(new Phaser.Geom.Rectangle(0, 0, width, height), Phaser.Geom.Rectangle.Contains);
    bg.setInteractive({ useHandCursor: true });

    // Icon with shadow (NES style)
    const iconShadow = this.add.text(width / 2 + 2, 32, BiomeSystem.getBiomeIcon(biome), {
      fontSize: '40px',
      color: '#000000',
    }).setOrigin(0.5);

    const icon = this.add.text(width / 2, 30, BiomeSystem.getBiomeIcon(biome), {
      fontSize: '40px',
    }).setOrigin(0.5);

    // Name with shadow (NES style)
    const nameShadow = this.add.text(width / 2 + 2, 77, BiomeSystem.getBiomeName(biome), {
      fontSize: '18px',
      color: '#000000',
      fontFamily: 'Arial Black, sans-serif',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    const name = this.add.text(width / 2, 75, BiomeSystem.getBiomeName(biome), {
      fontSize: '18px',
      color: isSelected ? '#f1c40f' : '#ffffff',
      fontFamily: 'Arial Black, sans-serif',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 1,
    }).setOrigin(0.5);

    container.add([bg, iconShadow, icon, nameShadow, name]);

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
    const nesWhite = '#ffffff';
    const nesYellow = '#f1c40f';
    const nesBlue = 0x3498db;
    const sectionCenterX = startX + availableWidth / 2;

    // Section title with NES style
    const titleShadow = this.add.text(sectionCenterX + 2, startY + 2, 'MODIFIERS', {
      fontSize: '20px',
      color: '#000000',
      fontFamily: 'Arial Black, sans-serif',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    const title = this.add.text(sectionCenterX, startY, 'MODIFIERS', {
      fontSize: '20px',
      color: nesYellow,
      fontFamily: 'Arial Black, sans-serif',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 2,
    }).setOrigin(0.5);

    const row1Y = startY + 40;
    const row2Y = startY + 75;
    const row3Y = startY + 110;
    const row4Y = startY + 145;
    const row5Y = startY + 190;
    const row6Y = startY + 240; // Increased spacing before Seed

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
      this.levelConfig.weather = value as any;
      this.updatePreview();
    });

    // Time of Day
    this.createRadioGroup('Time:', startX, row3Y, [
      { label: 'Day', value: 'day' },
      { label: 'Night', value: 'night' },
    ], this.levelConfig.timeOfDay, (value) => {
      this.levelConfig.timeOfDay = value as any;
      this.updatePreview();
    });

    // Season
    this.createRadioGroup('Season:', startX, row4Y, [
      { label: 'Summer', value: 'summer' },
      { label: 'Winter', value: 'winter' },
    ], this.levelConfig.season, (value) => {
      this.levelConfig.season = value as any;
      this.updatePreview();
    });

    // Roughness slider
    this.createSlider('Roughness:', startX, row5Y);

    // Seed input
    this.createSeedInput(startX, row6Y);
  }

  /**
   * Create a radio button group
   */
  private createRadioGroup(
    label: string,
    x: number,
    y: number,
    options: { label: string; value: any }[],
    currentValue: any,
    onChange: (value: any) => void
  ): void {
    const nesWhite = '#ffffff';
    const nesYellow = '#f1c40f';
    const nesBlue = 0x3498db;

    // Label with shadow (NES style)
    const labelShadow = this.add.text(x + 1, y + 1, label, {
      fontSize: '16px',
      color: '#000000',
      fontFamily: 'Arial Black, sans-serif',
      fontStyle: 'bold',
    });

    const labelText = this.add.text(x, y, label, {
      fontSize: '16px',
      color: nesWhite,
      fontFamily: 'Arial Black, sans-serif',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 1,
    });

    // Radio buttons
    let offsetX = x + 100;
    options.forEach((option) => {
      const isSelected = currentValue === option.value;
      
      // Circle with NES style
      const circle = this.add.circle(offsetX, y + 8, 8, isSelected ? 0xf1c40f : 0x34495e)
        .setStrokeStyle(2, isSelected ? nesBlue : 0x5dade2)
        .setInteractive({ useHandCursor: true });

      // Label with shadow (NES style)
      const textShadow = this.add.text(offsetX + 15 + 1, y + 1, option.label, {
        fontSize: '16px',
        color: '#000000',
        fontFamily: 'Arial Black, sans-serif',
        fontStyle: 'bold',
      });

      const text = this.add.text(offsetX + 15, y, option.label, {
        fontSize: '16px',
        color: isSelected ? nesYellow : nesWhite,
        fontFamily: 'Arial Black, sans-serif',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 1,
      });

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
  }

  /**
   * Create a slider for roughness
   */
  private createSlider(label: string, x: number, y: number): void {
    const nesWhite = '#ffffff';
    const nesYellow = '#f1c40f';
    const nesBlue = 0x3498db;

    // Label with shadow (NES style) - aligned like other labels
    const labelShadow = this.add.text(x + 1, y + 1, label, {
      fontSize: '16px',
      color: '#000000',
      fontFamily: 'Arial Black, sans-serif',
      fontStyle: 'bold',
    }).setOrigin(0, 0.5);

    const labelText = this.add.text(x, y, label, {
      fontSize: '16px',
      color: nesWhite,
      fontFamily: 'Arial Black, sans-serif',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 1,
    }).setOrigin(0, 0.5);

    const sliderX = x + 110; // Increased spacing from label
    const sliderWidth = 200;
    
    // Slider track with NES style - aligned with label center
    const trackBg = this.add.rectangle(sliderX, y, sliderWidth, 6, 0x2c3e50).setOrigin(0, 0.5);
    const trackBorder = this.add.graphics();
    trackBorder.lineStyle(1, nesBlue, 0.5);
    trackBorder.strokeRect(sliderX - 1, y - 3, sliderWidth + 2, 6);

    // Slider thumb with NES style - aligned with label center
    const thumbX = sliderX + (this.levelConfig.roughness / 0.60) * sliderWidth;
    const thumb = this.add.circle(thumbX, y, 10, 0xf1c40f)
      .setStrokeStyle(2, nesBlue)
      .setInteractive({ useHandCursor: true, draggable: true });

    // Value display with shadow (NES style)
    const valueShadow = this.add.text(sliderX + sliderWidth + 20 + 1, y + 1, this.levelConfig.roughness.toFixed(2), {
      fontSize: '16px',
      color: '#000000',
      fontFamily: 'Arial Black, sans-serif',
      fontStyle: 'bold',
    });

    this.roughnessValueText = this.add.text(sliderX + sliderWidth + 20, y, this.levelConfig.roughness.toFixed(2), {
      fontSize: '16px',
      color: nesWhite,
      fontFamily: 'Arial Black, sans-serif',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 1,
    });

    // Drag handler
    thumb.on('drag', (pointer: Phaser.Input.Pointer) => {
      const newX = Phaser.Math.Clamp(pointer.x, sliderX, sliderX + sliderWidth);
      thumb.x = newX;
      
      // Calculate roughness (0.05 to 0.60)
      const percent = (newX - sliderX) / sliderWidth;
      this.levelConfig.roughness = 0.05 + percent * 0.55;
      this.roughnessValueText.setText(this.levelConfig.roughness.toFixed(2));
      
      this.updatePreview();
    });
  }

  /**
   * Create preview window (left side)
   */
  private createPreview(x: number, y: number, width: number, height: number): void {
    // Preview border with NES style
    const previewBorder = this.add.graphics();
    previewBorder.lineStyle(3, 0x3498db, 1);
    previewBorder.strokeRoundedRect(x, y, width, height, 8);
    previewBorder.lineStyle(1, 0x5dade2, 0.8);
    previewBorder.strokeRoundedRect(x + 2, y + 2, width - 4, height - 4, 6);

    // Preview label with NES style
    const labelX = x + width / 2;
    const labelShadow = this.add.text(labelX + 2, y - 20 + 2, 'PREVIEW', {
      fontSize: '20px',
      color: '#000000',
      fontFamily: 'Arial Black, sans-serif',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    const label = this.add.text(labelX, y - 20, 'PREVIEW', {
      fontSize: '20px',
      color: '#f1c40f',
      fontFamily: 'Arial Black, sans-serif',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 2,
    }).setOrigin(0.5);

    // Preview graphics
    this.previewGraphics = this.add.graphics();
    this.previewGraphics.setPosition(x, y);
    
    // Store preview dimensions for updatePreview()
    (this as any).previewX = x;
    (this as any).previewY = y;
    (this as any).previewWidth = width;
    (this as any).previewHeight = height;
  }

  /**
   * Update preview based on current config
   */
  private updatePreview(): void {
    // Use stored preview dimensions
    const previewX = (this as any).previewX || 0;
    const previewY = (this as any).previewY || 0;
    const previewWidth = (this as any).previewWidth || this.cameras.main.width * 0.6;
    const previewHeight = (this as any).previewHeight || this.cameras.main.height * 0.35;

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
      // roughness 0.05-0.60, normalize to range ~0.33-4.0 (0.15 is default = 1.0x)
      const roughnessMultiplier = this.levelConfig.roughness / 0.15;
      const waveHeight = (normalizedHeight - 0.5) * previewHeight * 0.4 * roughnessMultiplier;
      
      const y = terrainStartY + waveHeight;
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
    const nesWhite = '#ffffff';
    
    // Label with shadow (NES style)
    const labelShadow = this.add.text(x + 1, y + 1, 'Seed:', {
      fontSize: '16px',
      color: '#000000',
      fontFamily: 'Arial Black, sans-serif',
      fontStyle: 'bold',
    }).setOrigin(0, 0.5);

    const labelText = this.add.text(x, y, 'Seed:', {
      fontSize: '16px',
      color: nesWhite,
      fontFamily: 'Arial Black, sans-serif',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 1,
    }).setOrigin(0, 0.5);
    
    // Create HTML input element for seed
    this.seedInputElement = document.createElement('input');
    this.seedInputElement.type = 'text';
    this.seedInputElement.value = Math.floor(this.previewSeed).toString();
    
    // Get canvas position for proper positioning
    // Input height is 24px, so center it at y by offsetting by half height
    const canvas = this.game.canvas;
    const canvasRect = canvas.getBoundingClientRect();
    const inputLeft = canvasRect.left + x + 100;
    const inputTop = canvasRect.top + y - 12; // 12 = half of 24px height
    
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
    const nesYellow = 0xf1c40f;
    const nesBlue = 0x3498db;
    
    const randomBtnContainer = this.add.container(btnX, y);
    
    // Background with NES style
    const btnBg = this.add.graphics();
    btnBg.fillStyle(0x34495e, 0.9);
    btnBg.fillRoundedRect(0, -btnHeight / 2, btnWidth, btnHeight, 4);
    btnBg.lineStyle(2, nesBlue, 1);
    btnBg.strokeRoundedRect(0, -btnHeight / 2, btnWidth, btnHeight, 4);
    
    // Emoji text (centered in button)
    const btnText = this.add.text(btnWidth / 2, 0, '🎲', {
      fontSize: '16px',
    })
    .setOrigin(0.5, 0.5);
    
    randomBtnContainer.add([btnBg, btnText]);
    randomBtnContainer.setSize(btnWidth, btnHeight);
    randomBtnContainer.setInteractive({ useHandCursor: true });
    
    randomBtnContainer.on('pointerover', () => {
      btnBg.clear();
      btnBg.fillStyle(0x5dade2, 0.9);
      btnBg.fillRoundedRect(0, -btnHeight / 2, btnWidth, btnHeight, 4);
      btnBg.lineStyle(2, nesYellow, 1);
      btnBg.strokeRoundedRect(0, -btnHeight / 2, btnWidth, btnHeight, 4);
    });
    
    randomBtnContainer.on('pointerout', () => {
      btnBg.clear();
      btnBg.fillStyle(0x34495e, 0.9);
      btnBg.fillRoundedRect(0, -btnHeight / 2, btnWidth, btnHeight, 4);
      btnBg.lineStyle(2, nesBlue, 1);
      btnBg.strokeRoundedRect(0, -btnHeight / 2, btnWidth, btnHeight, 4);
    });
    
    randomBtnContainer.on('pointerdown', () => {
      this.previewSeed = Math.floor(Math.random() * 1000000);
      this.seedInputElement.value = this.previewSeed.toString();
      this.updatePreview();
    });
  }

  /**
   * Create start button in NES style
   */
  private createStartButton(x: number, y: number): void {
    const nesWhite = '#ffffff';
    const nesBlue = 0x3498db;

    // Button background with NES style
    const btnBg = this.add.graphics();
    btnBg.fillStyle(0x27ae60, 0.9);
    btnBg.fillRoundedRect(x - 120, y - 20, 240, 40, 8);
    btnBg.lineStyle(3, nesBlue, 1);
    btnBg.strokeRoundedRect(x - 120, y - 20, 240, 40, 8);

    // Text shadow (NES style)
    const textShadow = this.add.text(x + 2, y + 2, 'START GAME', {
      fontSize: '28px',
      color: '#000000',
      fontFamily: 'Arial Black, sans-serif',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    const button = this.add.text(x, y, 'START GAME', {
      fontSize: '28px',
      color: nesWhite,
      fontFamily: 'Arial Black, sans-serif',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 2,
    }).setOrigin(0.5);

    // Make button interactive
    btnBg.setInteractive(new Phaser.Geom.Rectangle(x - 120, y - 20, 240, 40), Phaser.Geom.Rectangle.Contains);
    btnBg.setInteractive({ useHandCursor: true });

    btnBg.on('pointerover', () => {
      btnBg.clear();
      btnBg.fillStyle(0x2ecc71, 0.9);
      btnBg.fillRoundedRect(x - 120, y - 20, 240, 40, 8);
      btnBg.lineStyle(3, 0xf1c40f, 1);
      btnBg.strokeRoundedRect(x - 120, y - 20, 240, 40, 8);
    });

    btnBg.on('pointerout', () => {
      btnBg.clear();
      btnBg.fillStyle(0x27ae60, 0.9);
      btnBg.fillRoundedRect(x - 120, y - 20, 240, 40, 8);
      btnBg.lineStyle(3, nesBlue, 1);
      btnBg.strokeRoundedRect(x - 120, y - 20, 240, 40, 8);
    });

    btnBg.on('pointerdown', () => this.startGame());
  }

  /**
   * Create back button in NES style
   */
  private createBackButton(x: number, y: number): void {
    const nesWhite = '#ffffff';
    const nesBlue = 0x3498db;
    const buttonWidth = 200;
    const buttonHeight = 36;

    // Button background with NES style
    const btnBg = this.add.graphics();
    btnBg.fillStyle(0x34495e, 0.9);
    btnBg.fillRoundedRect(x - buttonWidth / 2, y - buttonHeight / 2, buttonWidth, buttonHeight, 6);
    btnBg.lineStyle(2, nesBlue, 1);
    btnBg.strokeRoundedRect(x - buttonWidth / 2, y - buttonHeight / 2, buttonWidth, buttonHeight, 6);

    // Text shadow (NES style)
    const textShadow = this.add.text(x + 1, y + 1, '← Back to Menu', {
      fontSize: '20px',
      color: '#000000',
      fontFamily: 'Arial Black, sans-serif',
      fontStyle: 'bold',
    }).setOrigin(0.5, 0.5);

    const button = this.add.text(x, y, '← Back to Menu', {
      fontSize: '20px',
      color: nesWhite,
      fontFamily: 'Arial Black, sans-serif',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 1,
    }).setOrigin(0.5, 0.5);

    // Make button interactive
    btnBg.setInteractive(new Phaser.Geom.Rectangle(x - buttonWidth / 2, y - buttonHeight / 2, buttonWidth, buttonHeight), Phaser.Geom.Rectangle.Contains);
    btnBg.setInteractive({ useHandCursor: true });

    btnBg.on('pointerover', () => {
      btnBg.clear();
      btnBg.fillStyle(0x5dade2, 0.9);
      btnBg.fillRoundedRect(x - buttonWidth / 2, y - buttonHeight / 2, buttonWidth, buttonHeight, 6);
      btnBg.lineStyle(2, 0xf1c40f, 1);
      btnBg.strokeRoundedRect(x - buttonWidth / 2, y - buttonHeight / 2, buttonWidth, buttonHeight, 6);
    });

    btnBg.on('pointerout', () => {
      btnBg.clear();
      btnBg.fillStyle(0x34495e, 0.9);
      btnBg.fillRoundedRect(x - buttonWidth / 2, y - buttonHeight / 2, buttonWidth, buttonHeight, 6);
      btnBg.lineStyle(2, nesBlue, 1);
      btnBg.strokeRoundedRect(x - buttonWidth / 2, y - buttonHeight / 2, buttonWidth, buttonHeight, 6);
    });

    btnBg.on('pointerdown', () => {
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
          const soundManager = this.sound as any;
          if (soundManager.sounds) {
            existingMusic = soundManager.sounds.find((sound: Phaser.Sound.BaseSound) => {
              return sound.key === 'menu-music' && sound.isPlaying;
            }) || null;
          }
        } catch (e) {
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
