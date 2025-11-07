import Phaser from 'phaser';
import { Game } from '../core/Game.js';
import { StrategyDetails } from '../core/GameManagement.js';
import { BoardRenderer } from '../rendering/BoardRenderer.js';
import { HUDRenderer } from '../rendering/HUDRenderer.js';
import {
  GRID_SIZE,
  CELL_SIZE,
  BOARD_OFFSET_X,
  BOARD_OFFSET_Y,
  MAP_PHASE,
  STONE_PHASE,
  PIECE_SHAPE_SIZE
} from '../utils/Constants.js';

/**
 * Main game scene
 */
export default class GameScene extends Phaser.Scene {
  constructor() {
    super({ key: 'GameScene' });
  }

  create() {
    // Initialize game
    this.game = new Game(this);

    // Initialize renderers
    this.boardRenderer = new BoardRenderer(this);
    this.hudRenderer = new HUDRenderer(this);

    // Generate map pieces
    this.game.mapPieces = this.game.mapPieceGenerator.initializeMapPieces();

    // Add natural resources
    const details = new StrategyDetails();
    this.game.executeStrategy("addNaturalResources", details);

    // Set up input
    this.setupInput();

    // Initial render
    this.renderGame();

    // Show global warming animations
    this.globalWarmingGraphics = this.add.graphics();
    this.globalWarmingPulses = [];
  }

  setupInput() {
    // Mouse input
    this.input.on('pointermove', (pointer) => {
      this.handlePointerMove(pointer);
    });

    this.input.on('pointerdown', (pointer) => {
      this.handlePointerDown(pointer);
    });

    // Keyboard input
    this.input.keyboard.on('keydown-R', () => {
      this.rotatePiece();
    });

    this.input.keyboard.on('keydown-A', (event) => {
      if (event.shiftKey) {
        this.autoPlaceAll();
      } else {
        this.autoPlace();
      }
    });
  }

  handlePointerMove(pointer) {
    const gridPos = this.pointerToGrid(pointer.x, pointer.y);

    if (gridPos) {
      if (this.game.turnManager.gamePhase === MAP_PHASE) {
        // Preview map piece
        const piece = this.game.gameBoard.getAllMapPieces()[this.game.currentMapPieceIndex];
        const details = new StrategyDetails()
          .setPiece(piece)
          .setX(gridPos.x)
          .setY(gridPos.y)
          .setCurrentMapPieceIndex(this.game.currentMapPieceIndex)
          .setGamePhase(this.game.turnManager.gamePhase)
          .build();

        this.game.moveValidator.setStrategy(this.game.validateMapPiecePlacementStrategy);
        const isValid = this.game.moveValidator.performStrategy(details);

        this.boardRenderer.drawPreview(gridPos.x, gridPos.y, piece, isValid);
      } else if (this.game.turnManager.gamePhase === STONE_PHASE) {
        // Preview stone
        const details = new StrategyDetails()
          .setX(gridPos.x)
          .setY(gridPos.y)
          .setCurrentTurn(this.game.turnManager.currentTurn)
          .setGamePhase(this.game.turnManager.gamePhase)
          .build();

        this.game.moveValidator.setStrategy(this.game.validateStonePlacementStrategy);
        const isValid = this.game.moveValidator.performStrategy(details);

        this.boardRenderer.drawStonePreview(gridPos.x, gridPos.y, isValid);
      }
    } else {
      this.boardRenderer.clearPreview();
    }
  }

  handlePointerDown(pointer) {
    const gridPos = this.pointerToGrid(pointer.x, pointer.y);

    if (gridPos) {
      if (this.game.turnManager.gamePhase === MAP_PHASE) {
        this.placeMapPiece(gridPos.x, gridPos.y);
      } else if (this.game.turnManager.gamePhase === STONE_PHASE) {
        this.placeStone(gridPos.x, gridPos.y);
      }
    }
  }

  placeMapPiece(x, y) {
    const piece = this.game.gameBoard.getAllMapPieces()[this.game.currentMapPieceIndex];
    const details = new StrategyDetails()
      .setPiece(piece)
      .setX(x)
      .setY(y)
      .setCurrentMapPieceIndex(this.game.currentMapPieceIndex)
      .setGamePhase(this.game.turnManager.gamePhase)
      .setCurrentPlayer(this.game.currentPlayer)
      .setTurn(this.game.turnManager.currentTurn)
      .build();

    const success = this.game.executeStrategy("placeMapPiece", details);

    if (success) {
      this.renderGame();
      this.boardRenderer.clearPreview();
    } else {
      this.hudRenderer.showFeedback("Invalid placement!");
    }
  }

  placeStone(x, y) {
    const details = new StrategyDetails()
      .setX(x)
      .setY(y)
      .setCurrentTurn(this.game.turnManager.currentTurn)
      .setGamePhase(this.game.turnManager.gamePhase)
      .setCurrentPlayer(this.game.currentPlayer)
      .setTurn(this.game.turnManager.currentTurn)
      .build();

    const success = this.game.executeStrategy("placeStone", details);

    if (success) {
      this.renderGame();
      this.boardRenderer.clearPreview();

      // Animate global warming effects
      if (this.game.removedPeninsulasForAnimation.length > 0) {
        this.animateGlobalWarming(this.game.removedPeninsulasForAnimation);
        this.game.removedPeninsulasForAnimation = [];
      }
    } else {
      this.hudRenderer.showFeedback("Invalid placement!");
    }
  }

  rotatePiece() {
    if (this.game.turnManager.gamePhase !== MAP_PHASE) {
      return;
    }

    const piece = this.game.gameBoard.getAllMapPieces()[this.game.currentMapPieceIndex];
    const details = new StrategyDetails()
      .setPiece(piece)
      .setGamePhase(this.game.turnManager.gamePhase)
      .setCurrentMapPieceIndex(this.game.currentMapPieceIndex)
      .build();

    const success = this.game.executeStrategy("rotate", details);

    if (success) {
      this.hudRenderer.showFeedback("Piece rotated", 500);
    }
  }

  autoPlace() {
    if (this.game.turnManager.gamePhase !== MAP_PHASE) {
      this.hudRenderer.showFeedback("Auto-place only works in map phase");
      return;
    }

    const piece = this.game.gameBoard.getAllMapPieces()[this.game.currentMapPieceIndex];
    const details = new StrategyDetails()
      .setPiece(piece)
      .setCurrentMapPieceIndex(this.game.currentMapPieceIndex)
      .setGamePhase(this.game.turnManager.gamePhase)
      .setCurrentPlayer(this.game.currentPlayer)
      .setTurn(this.game.turnManager.currentTurn)
      .build();

    const success = this.game.executeStrategy("autoplaceMapPiece", details);

    if (success) {
      this.hudRenderer.showFeedback("Piece auto-placed!");
      this.renderGame();
    } else {
      this.hudRenderer.showFeedback("Could not find valid placement");
    }
  }

  autoPlaceAll() {
    if (this.game.turnManager.gamePhase !== MAP_PHASE) {
      this.hudRenderer.showFeedback("Auto-place only works in map phase");
      return;
    }

    const piece = this.game.gameBoard.getAllMapPieces()[this.game.currentMapPieceIndex];
    const details = new StrategyDetails()
      .setPiece(piece)
      .setCurrentMapPieceIndex(this.game.currentMapPieceIndex)
      .setGamePhase(this.game.turnManager.gamePhase)
      .setCurrentPlayer(this.game.currentPlayer)
      .setTurn(this.game.turnManager.currentTurn)
      .build();

    const result = this.game.executeStrategy("autoplaceAllMapPieces", details);

    if (result.success) {
      this.hudRenderer.showFeedback(`Auto-placed ${result.placedCount} pieces!`);
      this.renderGame();
    } else {
      this.hudRenderer.showFeedback(`Placed ${result.placedCount}, failed ${result.failedCount}`);
      this.renderGame();
    }
  }

  animateGlobalWarming(removedPeninsulas) {
    for (const peninsula of removedPeninsulas) {
      const px = BOARD_OFFSET_X + peninsula.x * CELL_SIZE;
      const py = BOARD_OFFSET_Y + peninsula.y * CELL_SIZE;

      // Create a red pulse animation
      const pulse = {
        x: px,
        y: py,
        alpha: 1,
        scale: 1,
        time: 0,
        duration: 3000
      };

      this.globalWarmingPulses.push(pulse);

      // Remove after duration
      this.time.delayedCall(pulse.duration, () => {
        const index = this.globalWarmingPulses.indexOf(pulse);
        if (index > -1) {
          this.globalWarmingPulses.splice(index, 1);
        }
      });
    }
  }

  update(time, delta) {
    // Update global warming pulse animations
    this.globalWarmingGraphics.clear();

    for (const pulse of this.globalWarmingPulses) {
      pulse.time += delta;
      const progress = pulse.time / pulse.duration;

      // Pulse effect (3 iterations)
      const pulsePhase = (progress * 3) % 1;
      const alpha = 0.3 + 0.7 * Math.sin(pulsePhase * Math.PI);
      const scale = 1 + 0.2 * Math.sin(pulsePhase * Math.PI);

      this.globalWarmingGraphics.fillStyle(0xff0000, alpha * (1 - progress));
      this.globalWarmingGraphics.fillRect(
        pulse.x + (1 - scale) * CELL_SIZE / 2,
        pulse.y + (1 - scale) * CELL_SIZE / 2,
        CELL_SIZE * scale,
        CELL_SIZE * scale
      );
    }
  }

  renderGame() {
    // Render board
    this.boardRenderer.clearHighlights();
    this.boardRenderer.renderBoard(this.game.gameBoard.getGrid());

    // Update HUD
    this.hudRenderer.updateGameState(
      this.game.turnManager.currentTurn,
      this.game.turnManager.gamePhase,
      this.game.currentPlayer
    );

    // Get all game state details for HUD
    const details = new StrategyDetails()
      .setTurn(this.game.turnManager.currentTurn)
      .setGamePhase(this.game.turnManager.gamePhase)
      .setCurrentPlayer(this.game.currentPlayer)
      .build();

    // Only calculate detailed scores in stone phase
    if (this.game.turnManager.gamePhase === STONE_PHASE) {
      this.game.flagRoutine(details);
    }

    const scores = this.game.scoreTracker.getScores();

    this.hudRenderer.updateScores(scores, {
      emperorState: details.currentEmperorState || [],
      populationState: details.currentPopulationState || {},
      tradeRouteState: details.currentTradeRouteState || {},
      cityState: details.currentCityState || {},
      resourceState: details.currentResourceState || {},
      globalWarmingChance: details.currentGlobalWarmingChance || 0
    });
  }

  pointerToGrid(px, py) {
    // Convert pointer coordinates to grid coordinates
    const x = Math.floor((px - BOARD_OFFSET_X) / CELL_SIZE);
    const y = Math.floor((py - BOARD_OFFSET_Y) / CELL_SIZE);

    if (x >= 0 && x < GRID_SIZE && y >= 0 && y < GRID_SIZE) {
      return { x, y };
    }

    return null;
  }
}
