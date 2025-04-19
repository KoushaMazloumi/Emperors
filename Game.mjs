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
        break;      case "rotate":
        this.moveValidator.setStrategy(this.validateMapPieceRotationStrategy);
        if (this.moveValidator.performStrategy(details)) {
          this.gameBoard.replaceMapPiece(this.mapPieceRotator.rotate(details));
        }
        break;
        case "autoplaceMapPiece":
        return this._autoplaceMapPiece(details);
        
      case "autoplaceAllMapPieces":
        return this._autoplaceAllMapPieces(details);
        
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
        // Remove the class after animation duration (3 pulses * 1s = 3s)
        setTimeout(() => cell.classList.remove('removed-peninsula'), 3000);
      }
    });
  }
  /**
   * Attempts to automatically place the current map piece at a valid position.
   * Tries different positions and rotations until a valid placement is found.
   * 
   * @param {StrategyDetails} details - Strategy details with game state
   * @returns {boolean} True if placement was successful, false otherwise
   * @private
   */
  _autoplaceMapPiece(details) {
    console.log(`Attempting to autoplace piece #${this.currentMapPieceIndex}`);
    
    // Get the current map piece
    const piece = this.gameBoard.getSingleMapPiece(this.currentMapPieceIndex);
    details.setPiece(piece);
    
    // Store original piece shape for potential restore if needed
    const originalShape = JSON.parse(JSON.stringify(piece.shape));
    const originalRelativeSquareLocations = JSON.parse(JSON.stringify(piece.shapeRelativeSquareLocations));
    
    // Determine search positions in priority order
    const searchPositions = this._generateOptimizedSearchPositions();
    let success = false;
    
    try {
      // Try each rotation (0°, 90°, 180°, 270°) until a valid position is found
      for (let rotation = 0; rotation < 4; rotation++) {
        if (rotation > 0) {
          // Apply rotation using existing rotator
          const rotateDetails = new StrategyDetails()
            .setPiece(piece)
            .setGamePhase(details.gamePhase)
            .setCurrentMapPieceIndex(this.currentMapPieceIndex)
            .build();
            
          this.mapPieceRotator.rotate(rotateDetails);
          console.log(`Trying rotation ${rotation * 90}°`);
        }
        
        // Try each position with current rotation
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
            console.log(`Found valid position at (${pos.x}, ${pos.y}), rotation: ${rotation * 90}°`);
            
            // Create a complete mock cell element
            const mockCellElement = this._createMockCellElement(pos.y, pos.x);
            
            // Update details for placement
            details.setX(pos.x)
                   .setY(pos.y)
                   .setCellElement(mockCellElement);
            
            // Execute the normal placement flow
            this.gameBoardEditor.setStrategy(this.addMapPieceStrategy);
            this.gameBoardEditor.performStrategy(details);
            this.turnManager.changeTurn(details);
            this.turnManager.checkPhase(details);
            this.renderRoutine(details);
            
            success = true;
            break;
          }
        }
        
        if (success) break;
      }
      
      // If no valid placement found after all rotations, restore original shape
      if (!success) {
        piece.shape = originalShape;
        piece.shapeRelativeSquareLocations = originalRelativeSquareLocations;
        console.log("No valid placement found after trying all rotations");
      }
      
      return success;
    } catch (error) {
      // Error recovery - restore original piece shape
      piece.shape = originalShape;
      piece.shapeRelativeSquareLocations = originalRelativeSquareLocations;      console.error("Error during autoplace:", error);
      return false;
    }
  }
  
  /**
   * Attempts to automatically place all remaining map pieces.
   * Continues placing pieces until all are placed or until placement fails.
   * 
   * @param {StrategyDetails} details - Strategy details with game state
   * @returns {Object} Results object with success status and counts
   * @private
   */
  _autoplaceAllMapPieces(details) {
    console.log("Attempting to autoplace all remaining pieces");
    
    const startIndex = this.currentMapPieceIndex;
    const totalPieces = this.gameBoard.getAllMapPieces().length;
    let placedCount = 0;
    let failedCount = 0;
    
    try {
      // Keep track of the initial player so we can show appropriate feedback
      const initialPlayer = this.currentPlayer;
      const initialPhase = this.turnManager.gamePhase;
      
      // Add a slight delay between placements to allow visual updates
      const attemptNextPiece = () => {
        // Check if we've switched to stone phase or placed all pieces
        if (this.turnManager.gamePhase !== initialPhase || 
            this.currentMapPieceIndex >= totalPieces) {
          return false;
        }
        
        // Create fresh details for current piece
        const piece = this.gameBoard.getSingleMapPiece(this.currentMapPieceIndex);
        const placementDetails = new StrategyDetails()
          .setPiece(piece)
          .setCurrentMapPieceIndex(this.currentMapPieceIndex)
          .setGamePhase(this.turnManager.gamePhase)
          .setTurn(this.turnManager.currentTurn)
          .setCurrentPlayer(this.currentPlayer)
          .build();
          
        // Try to place the current piece
        const placementSuccess = this._autoplaceMapPiece(placementDetails);
        
        if (placementSuccess) {
          placedCount++;
        } else {
          failedCount++;
          return false; // Stop if we can't place a piece
        }
        
        return true;
      };
      
      // Attempt to place all pieces
      while (this.currentMapPieceIndex < totalPieces) {
        if (!attemptNextPiece()) {
          break;
        }
      }
      
      console.log(`Auto-placed ${placedCount} pieces, failed to place ${failedCount} pieces`);
      
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
        failedCount: totalPieces - startIndex - placedCount
      };
    }
  }
  
  /**
   * Generates an optimized list of positions to try for piece placement,
   * prioritizing positions likely to result in valid placements.
   * 
   * @returns {Array<{x: number, y: number}>} Array of positions to try
   * @private
   */
  _generateOptimizedSearchPositions() {
    const grid = this.gameBoard.getGrid();
    const positions = [];
    
    // For the first piece, prioritize center and nearby positions
    if (this.currentMapPieceIndex === 0) {
      const centerX = Math.floor(GRID_SIZE / 2);
      const centerY = Math.floor(GRID_SIZE / 2);
      
      // Start with center and work outward in a spiral pattern
      for (let radius = 0; radius < Math.ceil(GRID_SIZE / 2); radius++) {
        for (let y = Math.max(0, centerY - radius); y <= Math.min(GRID_SIZE - 1, centerY + radius); y++) {
          for (let x = Math.max(0, centerX - radius); x <= Math.min(GRID_SIZE - 1, centerX + radius); x++) {
            // Only add positions at exactly the current radius away from center
            if (Math.max(Math.abs(x - centerX), Math.abs(y - centerY)) === radius) {
              positions.push({ x, y });
            }
          }
        }
      }
    }
    // For subsequent pieces, prioritize positions adjacent to existing pieces
    else {
      const adjacentPositions = new Set(); // Use Set to avoid duplicates
      const allPositions = [];
      
      // First collect all cells adjacent to existing map pieces
      for (let y = 0; y < GRID_SIZE; y++) {
        for (let x = 0; x < GRID_SIZE; x++) {
          if (grid[y][x] !== null && grid[y][x].type === "mapPiece") {
            // Check all 4 adjacent directions
            const adjDirections = [
              { dx: -1, dy: 0 }, // Left
              { dx: 1, dy: 0 },  // Right
              { dx: 0, dy: -1 }, // Up
              { dx: 0, dy: 1 }   // Down
            ];
            
            for (const dir of adjDirections) {
              const adjX = x + dir.dx;
              const adjY = y + dir.dy;
              
              // Only add if within bounds and empty
              if (adjX >= 0 && adjX < GRID_SIZE && adjY >= 0 && adjY < GRID_SIZE && 
                  grid[adjY][adjX] === null) {
                const posKey = `${adjX},${adjY}`;
                if (!adjacentPositions.has(posKey)) {
                  adjacentPositions.add(posKey);
                  positions.push({ x: adjX, y: adjY });
                }
              }
            }
          }
          
          // Also collect all empty positions for fallback
          if (grid[y][x] === null) {
            allPositions.push({ x, y });
          }
        }
      }
      
      // If no adjacent positions found or as fallback, try all empty positions
      if (positions.length === 0) {
        return allPositions;
      }
    }
    
    return positions;
  }
  
  /**
   * Creates a mock cell element that satisfies all properties and methods
   * expected by the existing strategies.
   * 
   * @param {number} row - The row coordinate
   * @param {number} col - The column coordinate
   * @returns {Object} Mock cell element
   * @private
   */
  _createMockCellElement(row, col) {
    return {
      // Dataset for coordinate extraction
      dataset: {
        row: row,
        col: col
      },
      
      // Class manipulation for visual effects
      classList: {
        add: function(className) {},
        remove: function(className) {},
        contains: function(className) { return false; }
      },
      
      // DOM structure for stone previews
      stonePreviewActive: false,
      
      // DOM query methods
      querySelector: function(selector) { return null; },
      
      // DOM mutation methods
      appendChild: function(child) {},
      removeChild: function(child) {},
      
      // Attributes and styles for visual effects
      style: {},
      
      // Additional properties that might be set
      closest: function(selector) { return this; }
    };
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
