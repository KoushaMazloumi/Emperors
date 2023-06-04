import {
  GRID_SIZE,
  GRID_OFFSET,
  TOTAL_RESOURCES,
  STARTING_PHASE,
  PIECE_SHAPE_SIZE,
  PIECE_COUNT,
  INITIAL_SHAPE_VALUE,
  FORCED_PIECE_SHAPE_THRESHOLD,
  ADJACENT_OFFSETS,
  MAP_PHASE_TURNS_THRESHOLD,
  STONE_PHASE,
  PLAYER_1,
} from "./Constants.mjs";

import {
  TurnManager,
  HistoryManager,
  HistoryTracker,
  ScoreTracker,
  Player,
  GlobalWarming,
  Logger,
  InfoAlert,
  StrategyDetails,
} from "./GameManagement.mjs";
import {
  BoardState,
  BoardStateSearcher,
  BoardStateEditor,
  EmperorCounter,
  UpdateEmeperorStrategy,
  MoveValidator,
  ValidateMapPiecePlacementStrategy,
  ValidateStonePlacementStrategy,
  AddStoneStrategy,
  AddMapPieceStrategy,
  AddNaturalResourceStrategy,
  TradeRouteCounter,
  PeninsulaFinder,
  CityFinder,
  UpdateTradeRouteStrategy,
  UpdateCityStrategy,
  PopulationCounter,
} from "./BoardManagement.mjs";
import { MapPieceGenerator, MapPiece } from "./MapPieces.mjs";
import {
  RenderManager,
  StatusRenderer,
  BoardRenderer,
  MovePreviewRenderer,
  EventListener,
} from "./UIManagement.mjs";

//Main class that manages the overall game state
export class Game {
  constructor(STARTING_PHASE) {
    this.strategy = null;
    this.gameBoard = new BoardState(GRID_SIZE);
    this.gameBoardEditor = new BoardStateEditor(this.gameBoard);
    this.gameBoardSearcher = new BoardStateSearcher(this.gameBoard);
    this.eventListener = new EventListener(this, this.gameBoard); // Pass the board instance to the EventListener
    this.gameRenderer = new RenderManager(this.gameBoard);

    this.currentPlayer = PLAYER_1;
    this.mapPieceGenerator = new MapPieceGenerator(
      PIECE_SHAPE_SIZE,
      PIECE_COUNT
    );
    this.gameLogger = new Logger();
    this.mapPieces = [];
    this.currentMapPieceIndex = 0;

    this.moveValidator = new MoveValidator(this.gameBoard);
    this.addNaturalResourceStrategy = new AddNaturalResourceStrategy();
    this.boardRendererStrategy = new BoardRenderer();
    this.movePreviewRendererStrategy = new MovePreviewRenderer();
    this.validateMapPiecePlacementStrategy =
      new ValidateMapPiecePlacementStrategy();
    this.validateStonePlacementStrategy = new ValidateStonePlacementStrategy();
    this.addMapPieceStrategy = new AddMapPieceStrategy();
    this.addStoneStrategy = new AddStoneStrategy();
    this.emperorCounter = new EmperorCounter();
    this.updateEmeperorStrategy = new UpdateEmeperorStrategy();
    this.updateTradeRouteStrategy = new UpdateTradeRouteStrategy();
    this.turnManager = new TurnManager(this);
    this.tradeRouteCounter = new TradeRouteCounter();
    this.peninsulaFinder = new PeninsulaFinder();
    this.cityFinder = new CityFinder();
    this.updateCityStrategy = new UpdateCityStrategy();
    this.statusRenderStrategy = new StatusRenderer();
    this.populationCounter = new PopulationCounter();
  }

  // Method to execute a strategy based on the given action and details
  executeStrategy(action, details) {
    switch (action) {
      case "placeMapPiece":
        // Set the move validator strategy to validate map piece placement
        this.moveValidator.setStrategy(this.validateMapPiecePlacementStrategy);
        // If the move is valid, set the board editor strategy to add the map piece
        if (this.moveValidator.performStrategy(details)) {
          this.gameBoardEditor.setStrategy(this.addMapPieceStrategy);
          console.log("details", details);
          this.gameBoardEditor.performStrategy(details);
          // Change the turn and render the board
          this.turnManager.changeTurn(details);

          // If the current turn is the map phase threshold, change the game phase to stone phase
          this.turnManager.checkPhase(details);
          //Render various parts of the game
          this.renderRoutine(details);
        }
        break;

      case "placeStone":
        console.log("placeStone");
        // Set the move validator strategy to validate stone placement
        this.moveValidator.setStrategy(this.validateStonePlacementStrategy);
        // If the move is valid, set the board editor strategy to add the stone
        if (this.moveValidator.performStrategy(details)) {
          this.gameBoardEditor.setStrategy(this.addStoneStrategy);
          console.log("details", details);
          this.gameBoardEditor.performStrategy(details);

          // Change the turn
          this.turnManager.changeTurn(details);

          //Update counts for various flags
          this.flagRoutine(details);

          //Render various parts of the game
          this.renderRoutine(details);
        }
        break;

      case "addNaturalResources":
        // Set the board editor strategy to add natural resources
        this.gameBoardEditor.setStrategy(this.addNaturalResourceStrategy);
        this.gameBoardEditor.performStrategy();
        break;

      case "renderBoard":
        // Set the game renderer strategy to render the board
        this.gameRenderer.setStrategy(this.boardRendererStrategy);
        this.gameRenderer.performStrategy();
        break;

      case "renderMovePreview":
        // Set the game renderer strategy to render the move preview
        this.gameRenderer.setStrategy(this.movePreviewRendererStrategy);
        this.gameRenderer.performStrategy(details);
        break;

      default:
        // Throw an error if the action is unknown
        throw new Error(`Unknown action: ${action}`);
    }
  }
  // consolidates the flag routines (emperor, city, trade route, etc.)
  flagRoutine(details) {
    this.gameBoardSearcher.setStrategy(this.emperorCounter);
    //Update the emperor count for the entire board
    details.setCurrentEmperorState(this.gameBoardSearcher.performStrategy());

    this.gameBoardEditor.setStrategy(this.updateEmeperorStrategy);
    this.gameBoardEditor.performStrategy(details);

    this.gameBoardSearcher.setStrategy(this.tradeRouteCounter);
    details.setCurrentTradeRouteState(this.gameBoardSearcher.performStrategy());

    this.gameBoardEditor.setStrategy(this.updateTradeRouteStrategy);
    this.gameBoardEditor.performStrategy(details);

    this.gameBoardSearcher.setStrategy(this.cityFinder);
    details.setCurrentCityState(this.gameBoardSearcher.performStrategy());

    this.gameBoardEditor.setStrategy(this.updateCityStrategy);
    this.gameBoardEditor.performStrategy(details);

    details.setMapPiecesReference(this.mapPieces);
    this.gameBoardSearcher.setStrategy(this.populationCounter);

    details.setCurrentPopulationState(
      this.gameBoardSearcher.performStrategy(details)
    );
  }
  renderRoutine(details) {
    this.gameRenderer.setStrategy(this.boardRendererStrategy);
    this.gameRenderer.performStrategy();

    this.gameRenderer.setStrategy(this.statusRenderStrategy);
    this.gameRenderer.performStrategy(details);
  }

  initialize() {
    //Initilizate the map pieces
    this.mapPieces = this.mapPieceGenerator.initializeMapPieces();
    this.gameLogger.logGeneratedShapes(this.mapPieces);
    this.executeStrategy("addNaturalResources");
    this.executeStrategy("renderBoard");
  }
  getCurrentPiece() {
    return this.mapPieces[this.currentMapPieceIndex];
  }
  // Method to start the game
  start() {
    // Implementation here...
  }

  // Method to end the game
  end() {
    // Implementation here...
  }
}
