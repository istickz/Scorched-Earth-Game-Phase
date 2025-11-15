import Phaser from 'phaser';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: 1024,
  height: 768,
  parent: 'game-container',
  backgroundColor: '#2d2d2d',
  scene: {
    create() {
      this.add.text(512, 384, 'Phaser Works!', {
        fontSize: '32px',
        color: '#ffffff'
      }).setOrigin(0.5);
    }
  }
};

new Phaser.Game(config);