import Phaser from 'phaser';
import { gameConfig } from './phaser/config/GameConfig.js';

// Initialize Phaser game when DOM is loaded
window.addEventListener('load', () => {
  new Phaser.Game(gameConfig);
});
