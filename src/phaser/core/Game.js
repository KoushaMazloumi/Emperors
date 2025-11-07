import {
  GRID_SIZE,
  PIECE_SHAPE_SIZE,
  PIECE_COUNT,
  PLAYER_1,
  PLAYER_2
} from '../utils/Constants.js';
import {
  TurnManager,
  StrategyDetails,
  GlobalWarmingChanceTracker,
  ScoreTracker
} from './GameManagement.js';
import {
  BoardState,
  BoardStateSearcher,
  BoardStateEditor,
  MoveValidator
} from './BoardManagement.js';
import {
  EmperorCounter,
  PopulationCounter,
  TradeRouteCounter,
  CityFinder,
  ResourceCounter,
  PeninsulaFinder,
  GlobalWarmingEventFinder
} from '../strategies/search/SearchStrategies.js';
import {
  ValidateMapPiecePlacementStrategy,
  ValidateStonePlacementStrategy,
  ValidateMapPieceRotationStrategy
} from '../strategies/validation/ValidationStrategies.js';
import {
  AddStoneStrategy,
  AddMapPieceStrategy,
  AddNaturalResourceStrategy,
  UpdateEmperorStrategy,
  UpdateTradeRouteStrategy,
  UpdateCityStrategy
} from '../strategies/update/UpdateStrategies.js';
import { GlobalWarmingEventHandlingStrategy } from '../strategies/update/GlobalWarmingStrategy.js';
import { MapPieceGenerator, MapPieceRotator } from './MapPieces.js';

/**
 * Main game orchestrator class
 */
export class Game {
  constructor(scene) {
    this.scene = scene;
    this.strategy = null;

    // Core systems
    this.gameBoard = new BoardState();
    this.gameBoardEditor = new BoardStateEditor(this.gameBoard);
    this.gameBoardSearcher = new BoardStateSearcher(this.gameBoard);
    this.moveValidator = new MoveValidator(this.gameBoard);

    // Game state
    this.currentPlayer = PLAYER_1;
    this.mapPieceGenerator = new MapPieceGenerator(PIECE_SHAPE_SIZE, PIECE_COUNT);
    this.mapPieces = [];
    this.currentMapPieceIndex = 0;

    // Managers
    this.turnManager = new TurnManager(this);
    this.scoreTracker = new ScoreTracker();
    this.globalWarmingChanceTracker = new GlobalWarmingChanceTracker();

    // Strategies
    this.validateMapPiecePlacementStrategy = new ValidateMapPiecePlacementStrategy();
    this.validateStonePlacementStrategy = new ValidateStonePlacementStrategy();
    this.validateMapPieceRotationStrategy = new ValidateMapPieceRotationStrategy();
    this.addMapPieceStrategy = new AddMapPieceStrategy();
    this.addStoneStrategy = new AddStoneStrategy();
    this.addNaturalResourceStrategy = new AddNaturalResourceStrategy();
    this.updateEmperorStrategy = new UpdateEmperorStrategy();
    this.updateTradeRouteStrategy = new UpdateTradeRouteStrategy();
    this.updateCityStrategy = new UpdateCityStrategy();
    this.globalWarmingEventHandlingStrategy = new GlobalWarmingEventHandlingStrategy();

    // Search strategies
    this.emperorCounter = new EmperorCounter();
    this.tradeRouteCounter = new TradeRouteCounter();
    this.cityFinder = new CityFinder();
    this.populationCounter = new PopulationCounter();
    this.resourceCounter = new ResourceCounter();
    this.peninsulaFinder = new PeninsulaFinder();
    this.globalWarmingEventFinder = new GlobalWarmingEventFinder();

    // Utilities
    this.mapPieceRotator = new MapPieceRotator();

    // Track global warming pulses
    this.removedPeninsulasForAnimation = [];
  }

  executeStrategy(action, details) {
    switch (action) {
      case "placeMapPiece":
        this.moveValidator.setStrategy(this.validateMapPiecePlacementStrategy);
        if (this.moveValidator.performStrategy(details)) {
          this.gameBoardEditor.setStrategy(this.addMapPieceStrategy);
          this.gameBoardEditor.performStrategy(details);
          this.turnManager.changeTurn(details);
          this.turnManager.checkPhase(details);
          return true;
        }
        return false;

      case "placeStone":
        this.moveValidator.setStrategy(this.validateStonePlacementStrategy);
        if (this.moveValidator.performStrategy(details)) {
          this.gameBoardEditor.setStrategy(this.addStoneStrategy);
          this.gameBoardEditor.performStrategy(details);
          this.turnManager.changeTurn(details);
          this.flagRoutine(details);
          return true;
        }
        return false;

      case "addNaturalResources":
        this.gameBoardEditor.setStrategy(this.addNaturalResourceStrategy);
        this.gameBoardEditor.performStrategy(details);
        break;

      case "rotate":
        this.moveValidator.setStrategy(this.validateMapPieceRotationStrategy);
        if (this.moveValidator.performStrategy(details)) {
          const [index, rotatedPiece] = this.mapPieceRotator.rotate(details);
          return true;
        }
        return false;

      case "autoplaceMapPiece":
        return this._autoplaceMapPiece(details);

      case "autoplaceAllMapPieces":
        return this._autoplaceAllMapPieces(details);

      default:
        throw new Error(`Unknown action: ${action}`);
    }
  }

  flagRoutine(details) {
    // Find peninsulas
    this.gameBoardSearcher.setStrategy(this.peninsulaFinder);
    details.setCurrentPeninsulaState(
      this.gameBoardSearcher.performStrategy(details)
    );

    // Calculate global warming chance
    details.setCurrentGlobalWarmingChance(
      this.globalWarmingChanceTracker.calculateChance(details)
    );

    // Find and handle global warming events
    this.gameBoardSearcher.setStrategy(this.globalWarmingEventFinder);
    const removalCoordinates = this.gameBoardSearcher.performStrategy(details);
    details.setRemovalCoordinates(removalCoordinates);

    // Store for animation
    if (removalCoordinates && removalCoordinates.length > 0) {
      this.removedPeninsulasForAnimation = removalCoordinates.map(coord => ({
        x: coord.x,
        y: coord.y,
        time: Date.now()
      }));
    }

    this.gameBoardEditor.setStrategy(this.globalWarmingEventHandlingStrategy);
    this.gameBoardEditor.performStrategy(details);

    // Count emperors
    this.gameBoardSearcher.setStrategy(this.emperorCounter);
    details.setCurrentEmperorState(this.gameBoardSearcher.performStrategy());

    this.gameBoardEditor.setStrategy(this.updateEmperorStrategy);
    this.gameBoardEditor.performStrategy(details);

    // Count trade routes
    this.gameBoardSearcher.setStrategy(this.tradeRouteCounter);
    details.setCurrentTradeRouteState(this.gameBoardSearcher.performStrategy());

    this.gameBoardEditor.setStrategy(this.updateTradeRouteStrategy);
    this.gameBoardEditor.performStrategy(details);

    // Find cities
    this.gameBoardSearcher.setStrategy(this.cityFinder);
    details.setCurrentCityState(this.gameBoardSearcher.performStrategy());

    this.gameBoardEditor.setStrategy(this.updateCityStrategy);
    this.gameBoardEditor.performStrategy(details);

    // Count population
    this.gameBoardSearcher.setStrategy(this.populationCounter);
    details.setCurrentPopulationState(
      this.gameBoardSearcher.performStrategy(details)
    );

    // Count resources
    this.gameBoardSearcher.setStrategy(this.resourceCounter);
    details.setCurrentResourceState(
      this.gameBoardSearcher.performStrategy(details)
    );

    // Calculate scores
    const scores = this.scoreTracker.calculateScores(
      details.currentEmperorState,
      details.currentTradeRouteState,
      details.currentCityState,
      details.currentPopulationState,
      details.currentResourceState
    );

    details.setCurrentScores(scores);
  }

  _autoplaceMapPiece(details) {
    const piece = this.gameBoard.getAllMapPieces()[this.currentMapPieceIndex];
    details.setPiece(piece);

    const originalShape = JSON.parse(JSON.stringify(piece.shape));
    const originalRelativeSquareLocations = JSON.parse(JSON.stringify(piece.shapeRelativeSquareLocations));

    const searchPositions = this._generateOptimizedSearchPositions();
    let success = false;

    try {
      for (let rotation = 0; rotation < 4; rotation++) {
        if (rotation > 0) {
          const rotateDetails = new StrategyDetails()
            .setPiece(piece)
            .setGamePhase(details.gamePhase)
            .setCurrentMapPieceIndex(this.currentMapPieceIndex)
            .build();

          this.mapPieceRotator.rotate(rotateDetails);
        }

        for (const pos of searchPositions) {
          const testDetails = new StrategyDetails()
            .setPiece(piece)
            .setX(pos.x)
            .setY(pos.y)
            .setCurrentMapPieceIndex(this.currentMapPieceIndex)
            .setGamePhase(details.gamePhase)
            .build();

          this.moveValidator.setStrategy(this.validateMapPiecePlacementStrategy);
          if (this.moveValidator.performStrategy(testDetails)) {
            details.setX(pos.x).setY(pos.y);

            this.gameBoardEditor.setStrategy(this.addMapPieceStrategy);
            this.gameBoardEditor.performStrategy(details);
            this.turnManager.changeTurn(details);
            this.turnManager.checkPhase(details);

            success = true;
            break;
          }
        }

        if (success) break;
      }

      if (!success) {
        piece.shape = originalShape;
        piece.shapeRelativeSquareLocations = originalRelativeSquareLocations;
      }

      return success;
    } catch (error) {
      piece.shape = originalShape;
      piece.shapeRelativeSquareLocations = originalRelativeSquareLocations;
      console.error("Error during autoplace:", error);
      return false;
    }
  }

  _autoplaceAllMapPieces(details) {
    const totalPieces = this.gameBoard.getAllMapPieces().length;
    let placedCount = 0;
    let failedCount = 0;

    try {
      const initialPhase = this.turnManager.gamePhase;

      while (this.currentMapPieceIndex < totalPieces) {
        if (this.turnManager.gamePhase !== initialPhase) {
          break;
        }

        const piece = this.gameBoard.getAllMapPieces()[this.currentMapPieceIndex];
        const placementDetails = new StrategyDetails()
          .setPiece(piece)
          .setCurrentMapPieceIndex(this.currentMapPieceIndex)
          .setGamePhase(this.turnManager.gamePhase)
          .setTurn(this.turnManager.currentTurn)
          .setCurrentPlayer(this.currentPlayer)
          .build();

        const placementSuccess = this._autoplaceMapPiece(placementDetails);

        if (placementSuccess) {
          placedCount++;
        } else {
          failedCount++;
          break;
        }
      }

      return {
        success: failedCount === 0 && placedCount > 0,
        placedCount,
        failedCount
      };
    } catch (error) {
      console.error("Error during autoplace all:", error);
      return {
        success: false,
        placedCount,
        failedCount
      };
    }
  }

  _generateOptimizedSearchPositions() {
    const grid = this.gameBoard.getGrid();
    const positions = [];

    if (this.currentMapPieceIndex === 0) {
      const centerX = Math.floor(GRID_SIZE / 2);
      const centerY = Math.floor(GRID_SIZE / 2);

      for (let radius = 0; radius < Math.ceil(GRID_SIZE / 2); radius++) {
        for (let y = Math.max(0, centerY - radius); y <= Math.min(GRID_SIZE - 1, centerY + radius); y++) {
          for (let x = Math.max(0, centerX - radius); x <= Math.min(GRID_SIZE - 1, centerX + radius); x++) {
            if (Math.max(Math.abs(x - centerX), Math.abs(y - centerY)) === radius) {
              positions.push({ x, y });
            }
          }
        }
      }
    } else {
      // Priority to cells adjacent to existing pieces
      const adjacentPositions = [];
      const otherPositions = [];

      for (let y = 0; y < GRID_SIZE; y++) {
        for (let x = 0; x < GRID_SIZE; x++) {
          if (grid[y][x] === null) {
            let isAdjacent = false;
            for (let dy = -1; dy <= 1; dy++) {
              for (let dx = -1; dx <= 1; dx++) {
                const checkY = y + dy;
                const checkX = x + dx;
                if (
                  checkX >= 0 &&
                  checkX < GRID_SIZE &&
                  checkY >= 0 &&
                  checkY < GRID_SIZE &&
                  grid[checkY][checkX] !== null &&
                  grid[checkY][checkX].type === "mapPiece"
                ) {
                  isAdjacent = true;
                  break;
                }
              }
              if (isAdjacent) break;
            }

            if (isAdjacent) {
              adjacentPositions.push({ x, y });
            } else {
              otherPositions.push({ x, y });
            }
          }
        }
      }

      positions.push(...adjacentPositions, ...otherPositions);
    }

    return positions;
  }
}
