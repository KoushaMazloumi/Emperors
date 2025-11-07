import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../utils/Constants.js';
import GameScene from '../scenes/GameScene.js';

export const gameConfig = {
  type: Phaser.AUTO,
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  parent: 'game-container',
  backgroundColor: '#1a1a1a',
  scene: [GameScene],
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH
  },
  pixelArt: false,
  physics: {
    default: 'arcade',
    arcade: {
      debug: false
    }
  }
};
