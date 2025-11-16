import Phaser from 'phaser';
import { gameConfig } from '@/config/gameConfig';

/**
 * Initialize and start the Phaser game
 */
const game = new Phaser.Game(gameConfig);

// Handle window resize for adaptive scaling
let resizeTimeout: number | null = null;
window.addEventListener('resize', () => {
  // Debounce resize events for better performance
  if (resizeTimeout) {
    clearTimeout(resizeTimeout);
  }
  
  resizeTimeout = window.setTimeout(() => {
    if (game.scale) {
      // Update game size to match window dimensions (no black bars)
      const windowWidth = window.innerWidth || 1920;
      const windowHeight = window.innerHeight || 1080;

      // Apply constraints
      const newWidth = Math.max(800, Math.min(3840, windowWidth));
      const newHeight = Math.max(600, Math.min(2160, windowHeight));

      // Update scale manager - RESIZE mode will fill the container
      game.scale.resize(newWidth, newHeight);
    }
  }, 150);
});