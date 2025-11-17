import Phaser from 'phaser';

/**
 * Boot scene for asset preloading
 */
export class BootScene extends Phaser.Scene {
  private loadingText!: Phaser.GameObjects.Text;
  private loadingShadow!: Phaser.GameObjects.Text;
  private progressBar!: Phaser.GameObjects.Graphics;
  private progressBarBg!: Phaser.GameObjects.Graphics;

  constructor() {
    super({ key: 'BootScene' });
  }

  preload(): void {
    // Load bitmap font FIRST - it's used by all scenes
    this.load.bitmapFont('pixel-font', 'assets/fonts/PublicPixel-rv0pA.png', 'assets/fonts/PublicPixel-rv0pA.xml');

    // Create loading UI in Famicom/NES style
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;

    // NES-style background
    const bgGraphics = this.add.graphics();
    bgGraphics.fillStyle(0x2c3e50);
    bgGraphics.fillRect(0, 0, width, height);

    // NES-style loading text (using regular text for loading screen - font not loaded yet)
    // Bitmap font will be used in all other scenes after it's loaded
    this.loadingShadow = this.add.text(width / 2 + 2, height / 2 - 50 + 2, 'LOADING...', {
      fontSize: '32px',
      color: '#000000',
      fontFamily: 'Arial Black, sans-serif',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    this.loadingText = this.add.text(width / 2, height / 2 - 50, 'LOADING...', {
      fontSize: '32px',
      color: '#f1c40f',
      fontFamily: 'Arial Black, sans-serif',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 2,
    }).setOrigin(0.5);

    // Progress bar background (NES style)
    this.progressBarBg = this.add.graphics();
    this.progressBarBg.fillStyle(0x34495e);
    this.progressBarBg.fillRoundedRect(width / 2 - 200, height / 2, 400, 30, 5);
    this.progressBarBg.lineStyle(3, 0x3498db);
    this.progressBarBg.strokeRoundedRect(width / 2 - 200, height / 2, 400, 30, 5);

    // Progress bar
    this.progressBar = this.add.graphics();

    // Update progress bar on file load
    this.load.on('progress', (value: number) => {
      this.progressBar.clear();
      // NES-style gradient effect
      this.progressBar.fillStyle(0xf1c40f); // Yellow
      this.progressBar.fillRoundedRect(width / 2 - 200, height / 2, 400 * value, 30, 5);
      
      // Add red accent at the end
      if (value > 0.1) {
        this.progressBar.fillStyle(0xe74c3c); // Red
        this.progressBar.fillRoundedRect(width / 2 - 200 + 400 * value - 10, height / 2, 10, 30, 5);
      }
      
      // Update percentage text
      const percent = Math.floor(value * 100);
      this.loadingText.setText(`LOADING... ${percent}%`);
      this.loadingShadow.setText(`LOADING... ${percent}%`);
    });

    // Update loading text on file load
    this.load.on('fileprogress', (file: Phaser.Loader.File) => {
      const percent = Math.floor(this.load.progress * 100);
      const text = `LOADING: ${file.key.toUpperCase()}... ${percent}%`;
      this.loadingText.setText(text);
      this.loadingShadow.setText(text);
    });

    // Load placeholder assets
    // For now, we'll create colored rectangles as placeholders
    // In a real game, you'd load actual sprite images here
    this.load.image('tank-body', 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==');
    this.load.image('tank-turret', 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==');
    this.load.image('projectile', 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==');

    // Load menu music (chiptune/cracktro style)
    // Music file should be in: public/assets/sounds/arcade_puzzler.ogg
    // If file is in src/assets/sounds, move it to public/assets/sounds/
    this.load.audio('menu-music', 'assets/sounds/arcade_puzzler.ogg');
    
    // Handle audio load errors
    this.load.on('filecomplete-audio-menu-music', () => {
      console.log('Menu music loaded successfully');
    });
    
    this.load.on('loaderror', (file: Phaser.Loader.File) => {
      if (file.key === 'menu-music') {
        console.error('Failed to load menu music:', file.src);
      }
    });
  }

  create(): void {
    // Clean up loading UI
    this.progressBar.destroy();
    this.progressBarBg.destroy();
    this.loadingText.destroy();
    this.loadingShadow.destroy();

    // Transition to menu scene
    this.scene.start('MenuScene');
  }
}

