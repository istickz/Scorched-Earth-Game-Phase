import Phaser from 'phaser';
import { BootScene } from '@/scenes/BootScene';
import { MenuScene } from '@/scenes/MenuScene';
import { GameScene } from '@/scenes/GameScene';
import { MultiplayerLobbyScene } from '@/scenes/MultiplayerLobbyScene';

/**
 * Get optimal game dimensions based on user's screen/window size
 * Uses full window size to avoid black bars
 */
function getOptimalGameSize(): { width: number; height: number } {
  // Get window dimensions (not screen, as user might have browser not fullscreen)
  const windowWidth = window.innerWidth || 1920;
  const windowHeight = window.innerHeight || 1080;

  // Use full window size with constraints
  const minWidth = 800;
  const minHeight = 600;
  const maxWidth = 3840;
  const maxHeight = 2160;

  // Use actual window size, clamped to min/max
  const gameWidth = Math.max(minWidth, Math.min(maxWidth, windowWidth));
  const gameHeight = Math.max(minHeight, Math.min(maxHeight, windowHeight));

  return { width: gameWidth, height: gameHeight };
}

// Get optimal dimensions
const optimalSize = getOptimalGameSize();

/**
 * Phaser game configuration with Matter.js physics
 * Automatically adapts to user's screen/window size
 */
export const gameConfig: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: optimalSize.width,
  height: optimalSize.height,
  parent: 'game-container',
  backgroundColor: '#000000', // MS-DOS black background
  fps: {
    target: 60,
    forceSetTimeOut: true, // Use setTimeout for better performance
  },
  physics: {
    default: 'matter',
    matter: {
      gravity: {
        x: 0,
        y: 1.0, // Downward gravity
      },
      debug: false, // Set to true for physics debugging
      enableSleeping: false,
    },
  },
  scene: [BootScene, MenuScene, MultiplayerLobbyScene, GameScene],
  scale: {
    mode: Phaser.Scale.RESIZE, // RESIZE fills the entire container without black bars
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: optimalSize.width,
    height: optimalSize.height,
    min: {
      width: 800,
      height: 600,
    },
    max: {
      width: 3840,
      height: 2160,
    },
    fullscreenTarget: 'game-container',
    resizeInterval: 100,
  },
  render: {
    antialias: true,
    // roundPixels: true,
    pixelArt: true,
  },
  dom: {
    createContainer: true,
  },
};

