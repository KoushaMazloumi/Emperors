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

    // Buttons
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
    const buttonY = this.hudY + 450;
    const buttonWidth = 200;
    const buttonHeight = 35;

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

    // Store buttons for state management
    this.buttons = {
      rotate: this.rotateButton,
      autoPlace: this.autoPlaceButton,
      autoPlaceAll: this.autoPlaceAllButton
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
    });

    button.on('pointerout', () => {
      button.setFillStyle(0x333333);
    });

    button.on('pointerdown', callback);

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

  destroy() {
    // Phaser will automatically destroy added objects when scene is destroyed
  }
}
