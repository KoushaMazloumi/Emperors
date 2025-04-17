import {
  GRID_SIZE,
  PIECE_SHAPE_SIZE,
  PIECE_COUNT,
  PLAYER_1,
} from "./Constants.mjs";

import {
  TurnManager,
  Logger,
  StrategyDetails,
  GlobalWarmingChanceTracker,
  ScoreTracker // Add ScoreTracker import
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
  ValidateMapPieceRotationStrategy,
  ResourceCounter,
  GlobalWarmingEventFinder,
  GlobalWarmingEventHandlingStrategy,
} from "./BoardManagement.mjs";
import { MapPieceGenerator, MapPieceRotator } from "./MapPieces.mjs";
import {
  RenderManager,
  StatusRenderer,
  BoardRenderer,
  MovePreviewRenderer,
  EventListener,
} from "./UIManagement.mjs";

//Main class that manages the overall game state
export class Game {
  constructor() {
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
    this.mapPieceRotator = new MapPieceRotator();
    this.validateMapPieceRotationStrategy =
      new ValidateMapPieceRotationStrategy();
    this.resourceCounter = new ResourceCounter();
    this.globalWarmingChanceTracker = new GlobalWarmingChanceTracker();
    this.globalWarmingEventFinder = new GlobalWarmingEventFinder(this);
    this.globalWarmingEventHandlingStrategy =
      new GlobalWarmingEventHandlingStrategy();
    this.scoreTracker = new ScoreTracker(); // Initialize ScoreTracker
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
        // Set the move validator strategy to validate stone placement
        this.moveValidator.setStrategy(this.validateStonePlacementStrategy);
        // If the move is valid, set the board editor strategy to add the stone
        if (this.moveValidator.performStrategy(details)) {
          this.gameBoardEditor.setStrategy(this.addStoneStrategy);

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
        this.gameBoardEditor.performStrategy(details);
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
      case "rotate":
        this.moveValidator.setStrategy(this.validateMapPieceRotationStrategy);
        if (this.moveValidator.performStrategy(details)) {
          this.gameBoard.replaceMapPiece(this.mapPieceRotator.rotate(details));
        }
        break;
      default:
        // Throw an error if the action is unknown
        throw new Error(`Unknown action: ${action}`);
    }
  }
  // consolidates the flag routines (emperor, city, trade route, etc.)
  flagRoutine(details) {
    this.gameBoardSearcher.setStrategy(this.peninsulaFinder);

    details.setCurrentPeninsulaState(
      this.gameBoardSearcher.performStrategy(details)
    );

    details.setCurrentGlobalWarmingChance(
      this.globalWarmingChanceTracker.calculateChance(details)
    );

    this.gameBoardSearcher.setStrategy(this.globalWarmingEventFinder);
    details.setRemovalCoordinates(
      this.gameBoardSearcher.performStrategy(details)
    );

    this.gameBoardEditor.setStrategy(this.globalWarmingEventHandlingStrategy);
    this.gameBoardEditor.performStrategy(details);

    this.gameBoardSearcher.setStrategy(this.emperorCounter);

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

    this.gameBoardSearcher.setStrategy(this.populationCounter);

    details.setCurrentPopulationState(
      this.gameBoardSearcher.performStrategy(details)
    );

    this.gameBoardSearcher.setStrategy(this.resourceCounter);

    details.setCurrentResourceState(
      this.gameBoardSearcher.performStrategy(details)
    );    // Calculate scores based on current game state
    const scores = this.scoreTracker.calculateScores(
      details.currentEmperorState,
      details.currentTradeRouteState,
      details.currentCityState,
      details.currentPopulationState,
      details.currentResourceState
    );
    
    // Add scores to details object so StatusRenderer can access them
    details.setCurrentScores(scores);
  }
  renderRoutine(details) {
    this.gameRenderer.setStrategy(this.boardRendererStrategy);
    this.gameRenderer.performStrategy();
   // Apply visual red pulse effect to cells removed by global warming
   this.applyGlobalWarmingPulse(details.removedPeninsulas);

    this.gameRenderer.setStrategy(this.statusRenderStrategy);
    this.gameRenderer.performStrategy(details);
  }

  // Adds a red pulse effect to cells removed by global warming
  applyGlobalWarmingPulse(removedPeninsulas) {
    if (!removedPeninsulas || !Array.isArray(removedPeninsulas)) return;
    removedPeninsulas.forEach(({ x, y, time }) => {
      const selector = `.cell[data-row="${y}"][data-col="${x}"]`;
      const cell = document.querySelector(selector);
      if (cell) {
        cell.classList.add('removed-peninsula');
        const elapsed = Date.now() - time;
        cell.style.setProperty('--time-since-affected', elapsed);
        // Remove the class after animation duration
        setTimeout(() => cell.classList.remove('removed-peninsula'), 2000);
      }
    });
  }

  initialize() {
    let initializationDetails = new StrategyDetails().build();
    //Initilizate the map pieces
    this.gameBoard.setMapPieces(this.mapPieceGenerator.initializeMapPieces());
    this.gameLogger.logGeneratedShapes(this.gameBoard.getAllMapPieces());
    this.executeStrategy("addNaturalResources", initializationDetails);
    this.executeStrategy("renderBoard");
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
