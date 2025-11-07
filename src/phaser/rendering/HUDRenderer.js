import {
  BOARD_OFFSET_X,
  BOARD_WIDTH,
  PLAYER_1,
  PLAYER_2,
  MAP_PHASE,
  STONE_PHASE
} from '../utils/Constants.js';

/**
 * Renders the HUD (scores, turn info, game state)
 */
export class HUDRenderer {
  constructor(scene) {
    this.scene = scene;
    this.hudX = BOARD_OFFSET_X + BOARD_WIDTH + 40;
    this.hudY = 100;

    this.createHUD();
  }

  createHUD() {
    // Title
    this.titleText = this.scene.add.text(this.hudX, 20, 'EMPERORS', {
      fontSize: '32px',
      fontStyle: 'bold',
      color: '#ffffff'
    });

    // Phase indicator
    this.phaseText = this.scene.add.text(this.hudX, this.hudY, 'Phase: Map', {
      fontSize: '20px',
      fontStyle: 'bold',
      color: '#ffaa00'
    });

    // Turn indicator
    this.turnText = this.scene.add.text(this.hudX, this.hudY + 35, 'Turn: 0', {
      fontSize: '18px',
      color: '#ffffff'
    });

    // Current player
    this.playerText = this.scene.add.text(this.hudX, this.hudY + 65, 'Player: 1', {
      fontSize: '18px',
      color: '#ffffff'
    });

    // Scores section
    this.scene.add.text(this.hudX, this.hudY + 110, 'SCORES', {
      fontSize: '24px',
      fontStyle: 'bold',
      color: '#ffffff'
    });

    // Player 1 score
    this.p1ScoreText = this.scene.add.text(this.hudX, this.hudY + 150, 'Player 1: 0', {
      fontSize: '18px',
      color: '#ffffff'
    });

    // Player 2 score
    this.p2ScoreText = this.scene.add.text(this.hudX, this.hudY + 180, 'Player 2: 0', {
      fontSize: '18px',
      color: '#ffffff'
    });

    // Detailed scores section
    this.scene.add.text(this.hudX, this.hudY + 225, 'BREAKDOWN', {
      fontSize: '20px',
      fontStyle: 'bold',
      color: '#ffffff'
    });

    // Emperors
    this.emperorsText = this.scene.add.text(this.hudX, this.hudY + 260, 'Emperors: 0 / 0', {
      fontSize: '14px',
      color: '#cccccc'
    });

    // Population
    this.populationText = this.scene.add.text(this.hudX, this.hudY + 285, 'Population: 0 / 0', {
      fontSize: '14px',
      color: '#cccccc'
    });

    // Trade Routes
    this.tradeRoutesText = this.scene.add.text(this.hudX, this.hudY + 310, 'Trade Routes: 0 / 0', {
      fontSize: '14px',
      color: '#cccccc'
    });

    // Cities
    this.citiesText = this.scene.add.text(this.hudX, this.hudY + 335, 'Cities: 0 / 0', {
      fontSize: '14px',
      color: '#cccccc'
    });

    // Resources
    this.resourcesText = this.scene.add.text(this.hudX, this.hudY + 360, 'Resources: 0 / 0', {
      fontSize: '14px',
      color: '#cccccc'
    });

    // Global warming
    this.globalWarmingText = this.scene.add.text(this.hudX, this.hudY + 400, 'Global Warming: 0%', {
      fontSize: '14px',
      color: '#ff6666'
    });

    // Turn history section
    this.scene.add.text(this.hudX, this.hudY + 440, 'RECENT MOVES', {
      fontSize: '16px',
      fontStyle: 'bold',
      color: '#ffffff'
    });

    this.historyTexts = [];
    for (let i = 0; i < 5; i++) {
      const historyText = this.scene.add.text(this.hudX, this.hudY + 470 + i * 20, '', {
        fontSize: '12px',
        color: '#aaaaaa'
      });
      this.historyTexts.push(historyText);
    }

    // Buttons (moved down to make room for history)
    this.createButtons();

    // Feedback message
    this.feedbackText = this.scene.add.text(this.scene.cameras.main.centerX, 50, '', {
      fontSize: '18px',
      color: '#ffff00',
      backgroundColor: '#000000',
      padding: { x: 10, y: 5 }
    });
    this.feedbackText.setOrigin(0.5, 0.5);
    this.feedbackText.setVisible(false);
  }

  createButtons() {
    const buttonY = this.hudY + 580;
    const buttonWidth = 200;
    const buttonHeight = 35;

    // Initialize move history
    this.moveHistory = [];

    // Rotate button
    this.rotateButton = this.createButton(
      this.hudX,
      buttonY,
      buttonWidth,
      buttonHeight,
      'Rotate Piece (R)',
      () => this.scene.rotatePiece()
    );

    // Auto-place button
    this.autoPlaceButton = this.createButton(
      this.hudX,
      buttonY + 45,
      buttonWidth,
      buttonHeight,
      'Auto Place (A)',
      () => this.scene.autoPlace()
    );

    // Auto-place all button
    this.autoPlaceAllButton = this.createButton(
      this.hudX,
      buttonY + 90,
      buttonWidth,
      buttonHeight,
      'Auto Place All (Shift+A)',
      () => this.scene.autoPlaceAll()
    );

    // Undo button
    this.undoButton = this.createButton(
      this.hudX,
      buttonY + 145,
      buttonWidth,
      buttonHeight,
      'Undo (Ctrl+Z)',
      () => this.scene.undoMove()
    );

    // New Game button
    this.newGameButton = this.createButton(
      this.hudX,
      buttonY + 190,
      buttonWidth,
      buttonHeight,
      'New Game (Ctrl+N)',
      () => this.scene.newGame()
    );

    // Store buttons for state management
    this.buttons = {
      rotate: this.rotateButton,
      autoPlace: this.autoPlaceButton,
      autoPlaceAll: this.autoPlaceAllButton,
      undo: this.undoButton,
      newGame: this.newGameButton
    };
  }

  updateButtonStates(phase) {
    // Enable/disable buttons based on game phase
    const isMapPhase = phase === 'map';

    // Rotate button only works in map phase
    if (this.rotateButton) {
      this.rotateButton.rect.setFillStyle(isMapPhase ? 0x333333 : 0x222222);
      this.rotateButton.rect.setAlpha(isMapPhase ? 1 : 0.5);
      this.rotateButton.text.setAlpha(isMapPhase ? 1 : 0.5);
    }

    // Auto-place buttons only work in map phase
    if (this.autoPlaceButton) {
      this.autoPlaceButton.rect.setFillStyle(isMapPhase ? 0x333333 : 0x222222);
      this.autoPlaceButton.rect.setAlpha(isMapPhase ? 1 : 0.5);
      this.autoPlaceButton.text.setAlpha(isMapPhase ? 1 : 0.5);
    }

    if (this.autoPlaceAllButton) {
      this.autoPlaceAllButton.rect.setFillStyle(isMapPhase ? 0x333333 : 0x222222);
      this.autoPlaceAllButton.rect.setAlpha(isMapPhase ? 1 : 0.5);
      this.autoPlaceAllButton.text.setAlpha(isMapPhase ? 1 : 0.5);
    }
  }

  createButton(x, y, width, height, text, callback) {
    const button = this.scene.add.rectangle(x, y, width, height, 0x333333);
    button.setOrigin(0, 0);
    button.setInteractive();
    button.setStrokeStyle(2, 0x666666);

    const buttonText = this.scene.add.text(x + width / 2, y + height / 2, text, {
      fontSize: '14px',
      color: '#ffffff'
    });
    buttonText.setOrigin(0.5, 0.5);

    button.on('pointerover', () => {
      button.setFillStyle(0x555555);
      this.scene.tweens.add({
        targets: button,
        scaleX: 1.02,
        scaleY: 1.02,
        duration: 100,
        ease: 'Power2'
      });
    });

    button.on('pointerout', () => {
      button.setFillStyle(0x333333);
      this.scene.tweens.add({
        targets: button,
        scaleX: 1,
        scaleY: 1,
        duration: 100,
        ease: 'Power2'
      });
    });

    button.on('pointerdown', () => {
      // Quick scale down on click for tactile feedback
      this.scene.tweens.add({
        targets: button,
        scaleX: 0.98,
        scaleY: 0.98,
        duration: 50,
        yoyo: true,
        onComplete: () => {
          callback();
        }
      });
    });

    return { rect: button, text: buttonText };
  }

  updateGameState(turn, phase, currentPlayer) {
    this.turnText.setText(`Turn: ${turn}`);
    this.phaseText.setText(`Phase: ${phase === MAP_PHASE ? 'Map' : 'Stone'}`);
    this.playerText.setText(`Player: ${currentPlayer === PLAYER_1 ? '1 (White)' : '2 (Black)'}`);
  }

  updateScores(scores, details) {
    // Total scores
    this.p1ScoreText.setText(`Player 1: ${scores[PLAYER_1]}`);
    this.p2ScoreText.setText(`Player 2: ${scores[PLAYER_2]}`);

    // Emperors
    const emperors = details.emperorState || [];
    const p1Emperors = emperors.filter(e => e.emperor === PLAYER_1).length;
    const p2Emperors = emperors.filter(e => e.emperor === PLAYER_2).length;
    this.emperorsText.setText(`Emperors: ${p1Emperors} / ${p2Emperors}`);

    // Population
    const population = details.populationState || { p1: 0, p2: 0 };
    this.populationText.setText(`Population: ${population[PLAYER_1] || 0} / ${population[PLAYER_2] || 0}`);

    // Trade Routes
    const tradeRoutes = details.tradeRouteState || {};
    const p1Routes = (tradeRoutes[PLAYER_1]?.count || 0) + (tradeRoutes[PLAYER_1]?.totalLength || 0);
    const p2Routes = (tradeRoutes[PLAYER_2]?.count || 0) + (tradeRoutes[PLAYER_2]?.totalLength || 0);
    this.tradeRoutesText.setText(`Trade Routes: ${p1Routes} / ${p2Routes}`);

    // Cities
    const cities = details.cityState || {};
    const p1Cities = (cities[PLAYER_1]?.count || 0) * 2;
    const p2Cities = (cities[PLAYER_2]?.count || 0) * 2;
    this.citiesText.setText(`Cities: ${p1Cities} / ${p2Cities}`);

    // Resources
    const resources = details.resourceState || {};
    const p1Resources = resources[PLAYER_1]?.count || 0;
    const p2Resources = resources[PLAYER_2]?.count || 0;
    this.resourcesText.setText(`Resources: ${p1Resources} / ${p2Resources}`);

    // Global warming
    const gwChance = details.globalWarmingChance || 0;
    this.globalWarmingText.setText(`Global Warming: ${(gwChance * 100).toFixed(2)}%`);
  }

  showFeedback(message, duration = 2000) {
    this.feedbackText.setText(message);
    this.feedbackText.setVisible(true);

    this.scene.time.delayedCall(duration, () => {
      this.feedbackText.setVisible(false);
    });
  }

  addMoveToHistory(turn, player, type, position) {
    const playerName = player === PLAYER_1 ? 'P1' : 'P2';
    const moveText = type === 'map'
      ? `T${turn}: ${playerName} placed map piece`
      : `T${turn}: ${playerName} placed stone at (${position.x}, ${position.y})`;

    this.moveHistory.push(moveText);

    // Keep only last 5 moves
    if (this.moveHistory.length > 5) {
      this.moveHistory.shift();
    }

    this.updateHistoryDisplay();
  }

  updateHistoryDisplay() {
    for (let i = 0; i < this.historyTexts.length; i++) {
      if (i < this.moveHistory.length) {
        this.historyTexts[i].setText(this.moveHistory[this.moveHistory.length - 1 - i]);
        this.historyTexts[i].setAlpha(1 - i * 0.15); // Fade older moves
      } else {
        this.historyTexts[i].setText('');
      }
    }
  }

  clearHistory() {
    this.moveHistory = [];
    this.updateHistoryDisplay();
  }

  showGameOver(scores) {
    const { p1, p2 } = scores;
    const winner = p1 > p2 ? 'Player 1 (White)' : p2 > p1 ? 'Player 2 (Black)' : 'Tie';
    const winnerColor = p1 > p2 ? '#ffffff' : p2 > p1 ? '#000000' : '#ffaa00';

    // Create semi-transparent overlay
    const overlay = this.scene.add.rectangle(
      this.scene.cameras.main.centerX,
      this.scene.cameras.main.centerY,
      this.scene.cameras.main.width,
      this.scene.cameras.main.height,
      0x000000,
      0.8
    );
    overlay.setDepth(1000);

    // Game Over text
    const gameOverText = this.scene.add.text(
      this.scene.cameras.main.centerX,
      this.scene.cameras.main.centerY - 120,
      'GAME OVER',
      {
        fontSize: '48px',
        fontStyle: 'bold',
        color: '#ffaa00'
      }
    );
    gameOverText.setOrigin(0.5, 0.5);
    gameOverText.setDepth(1001);

    // Winner text
    const winnerText = this.scene.add.text(
      this.scene.cameras.main.centerX,
      this.scene.cameras.main.centerY - 60,
      p1 === p2 ? "It's a Tie!" : `${winner} Wins!`,
      {
        fontSize: '32px',
        fontStyle: 'bold',
        color: winnerColor,
        stroke: winnerColor === '#000000' ? '#ffffff' : '#000000',
        strokeThickness: 2
      }
    );
    winnerText.setOrigin(0.5, 0.5);
    winnerText.setDepth(1001);

    // Final scores
    const scoresText = this.scene.add.text(
      this.scene.cameras.main.centerX,
      this.scene.cameras.main.centerY + 10,
      `Final Scores:\nPlayer 1: ${p1}\nPlayer 2: ${p2}`,
      {
        fontSize: '24px',
        color: '#ffffff',
        align: 'center',
        lineSpacing: 10
      }
    );
    scoresText.setOrigin(0.5, 0.5);
    scoresText.setDepth(1001);

    // Play Again button
    const playAgainButton = this.scene.add.rectangle(
      this.scene.cameras.main.centerX,
      this.scene.cameras.main.centerY + 100,
      200,
      50,
      0x44aa44
    );
    playAgainButton.setInteractive();
    playAgainButton.setDepth(1001);

    const playAgainText = this.scene.add.text(
      this.scene.cameras.main.centerX,
      this.scene.cameras.main.centerY + 100,
      'Play Again',
      {
        fontSize: '20px',
        color: '#ffffff',
        fontStyle: 'bold'
      }
    );
    playAgainText.setOrigin(0.5, 0.5);
    playAgainText.setDepth(1002);

    playAgainButton.on('pointerover', () => {
      playAgainButton.setFillStyle(0x55bb55);
    });

    playAgainButton.on('pointerout', () => {
      playAgainButton.setFillStyle(0x44aa44);
    });

    playAgainButton.on('pointerdown', () => {
      this.scene.newGame();
    });
  }

  destroy() {
    // Phaser will automatically destroy added objects when scene is destroyed
  }
}
