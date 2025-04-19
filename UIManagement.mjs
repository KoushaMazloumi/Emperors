import {
  PIECE_SHAPE_SIZE,
  MAP_PHASE,
  STONE_PHASE,
  PLAYER_1,
  PLAYER_2,
} from "./Constants.mjs";

import { StrategyDetails } from "./GameManagement.mjs";

//A class that manages the different aspects of rendering
export class RenderManager {
  constructor(gameBoard) {
    this.gridContainer = document.getElementById("game-board");

    this.board = gameBoard;
  }

  setStrategy(strategy) {
    // Set the strategy
    this.strategy = strategy;
  }

  performStrategy(details) {
    if (!this.strategy) {
      throw new Error("Strategy is not set");
    }

    this.strategy.performStrategy(this, details);
  }

  getBoard() {
    return this.board;
  }
}

//A strategy for the RenderManager class and renders the Status
export class StatusRenderer {
  constructor() {
    this.boardReference = [];
    this.gridContainer = 0;
  }
  // Method to perform the strategy
  performStrategy(renderer, details) {
    this.boardReference = renderer.getBoard();
    this.renderStatus(this.boardReference, details);
  }

  renderStatus(board, details) {
    // Update turn indicator
    const turnIndicator = document.getElementById("turn-indicator");
    turnIndicator.textContent = `${details.currentTurn + 1}`;

    // Update phase indicator
    const phaseIndicator = document.getElementById("game-phase");
    phaseIndicator.textContent = `${details.gamePhase}`;

    // Update current player indicator
    const currentPlayerIndicator = document.getElementById("current-player");
    if (details.currentPlayer === PLAYER_1) {
      currentPlayerIndicator.textContent = "Black";
    } else if (details.currentPlayer === PLAYER_2) {
      currentPlayerIndicator.textContent = "White";
    }
    // Update player city counts in the UI
    let player1CityCount = 0;
    let player2CityCount = 0;
    const cities = details.currentCityState;
    if (cities !== null) {
      player1CityCount = cities[PLAYER_1].count;

      player2CityCount = cities[PLAYER_2].count;
    }

    const player1CitiesElement = document.getElementById("player1-cities");

    const player2CitiesElement = document.getElementById("player2-cities");

    player1CitiesElement.textContent = `${player1CityCount}`;
    player2CitiesElement.textContent = `${player2CityCount}`;

    // Update player Resource counts in the UI
    let player1ResourceCount = 0;
    let player2ResourceCount = 0;
    const resources = details.currentResourceState;
    if (cities !== null) {
      player1ResourceCount = resources[PLAYER_1].count;

      player2ResourceCount = resources[PLAYER_2].count;
    }

    const player1ResourceElement = document.getElementById("player1-resources");

    const player2ResourceElement = document.getElementById("player2-resources");

    player1ResourceElement.textContent = `${player1ResourceCount}`;
    player2ResourceElement.textContent = `${player2ResourceCount}`;

    // Update player Trade Route counts in the UI
    let player1TradeRoutesCount = 0;
    let player2TradeRoutesCount = 0;

    let player1TradeRoutesLength = 0;
    let player2TradeRoutesLength = 0;

    const tradeRoutes = details.currentTradeRouteState;
    if (tradeRoutes !== null) {
      player1TradeRoutesCount = tradeRoutes[PLAYER_1].count;
      player2TradeRoutesCount = tradeRoutes[PLAYER_2].count;

      player1TradeRoutesLength = tradeRoutes[PLAYER_1].totalLength;
      player2TradeRoutesLength = tradeRoutes[PLAYER_2].totalLength;
    }

    const player1TradeRoutesElement = document.getElementById(
      "player1-trade-routes"
    );
    const player2TradeRoutesElement = document.getElementById(
      "player2-trade-routes"
    );

    player1TradeRoutesElement.textContent = `Count: ${player1TradeRoutesCount}, Length: ${player1TradeRoutesLength}`;
    player2TradeRoutesElement.textContent = `Count: ${player2TradeRoutesCount}, Length: ${player2TradeRoutesLength}`;

    // Update player emperor counts in the UI
    const emperors = details.currentEmperorState;
    let player1EmperorCount = 0;
    let player2EmperorCount = 0;
    for (const key in emperors) {
      if (Object.prototype.hasOwnProperty.call(emperors, key)) {
        if (emperors[key].emperor === PLAYER_1) {
          player1EmperorCount++;
        } else if (emperors[key].emperor === PLAYER_2) {
          player2EmperorCount++;
        }
      }
    }

    const player1EmperorCountElement =
      document.getElementById("player1-emperor");

    const player2EmperorCountElement =
      document.getElementById("player2-emperor");

    player2EmperorCountElement.textContent = `${player2EmperorCount}`;
    player1EmperorCountElement.textContent = `${player1EmperorCount}`;

    // Update player population counts in the UI
    const populations = details.currentPopulationState;
    let player1Population = 0;
    let player2Population = 0;
    if (populations !== null) {
      player1Population = populations[PLAYER_1];
      player2Population = populations[PLAYER_2];
    }
    const player1PopulationElement =
      document.getElementById("player1-population");
    const player2PopulationElement =
      document.getElementById("player2-population");

    player1PopulationElement.textContent = `${player1Population}`;
    player2PopulationElement.textContent = `${player2Population}`;

    // Update score display if scores are available
    if (details.currentScores) {
      const player1ScoreElement = document.getElementById("player1-score");
      const player2ScoreElement = document.getElementById("player2-score");
      
      // Check if elements exist before setting textContent
      if (player1ScoreElement) {
        player1ScoreElement.textContent = `${details.currentScores[PLAYER_1]}`;
      }
      if (player2ScoreElement) {
        player2ScoreElement.textContent = `${details.currentScores[PLAYER_2]}`;
      }
    }
  }
}

//A strategy for the RenderManager class and renders the board
export class BoardRenderer {
  constructor() {
    this.boardReference = [];
    this.gridContainer = 0;
  }
  // Method to perform the strategy
  performStrategy(renderer) {
    this.boardReference = renderer.getBoard();
    this.gridContainer = renderer.gridContainer;
    this.renderBoard(this.boardReference);
  }
  // Method to render the board
  renderBoard() {
    if (!this.boardReference) {
      return;
    }
    this.gridContainer.innerHTML = "";
    this.boardReference.getGrid().forEach((row, rowIndex) => {
      const rowElement = document.createElement("div");
      rowElement.classList.add("row");
      row.forEach((cell, cellIndex) => {
        const cellElement = document.createElement("div");
        cellElement.classList.add("cell");
        cellElement.dataset.row = rowIndex;
        cellElement.dataset.col = cellIndex;
        if (cell && cell.type === "mapPiece") {
          const mapPieceColorClass = `map-piece-${cell.color}`;
          cellElement.classList.add("map-piece");
          cellElement.classList.add(mapPieceColorClass);
          cellElement.dataset.id = cell.id;
          const squareElement = document.createElement("div");
          squareElement.classList.add("square");
          squareElement.dataset.row = cell.cellSquareLocation.y;
          squareElement.dataset.col = cell.cellSquareLocation.x;
          cellElement.appendChild(squareElement);
          for (let i = 0; i < cell.stoneCount; i++) {
            const permanentStone = document.createElement("div");
            permanentStone.classList.add("stone-permanent");
            permanentStone.classList.add("stone");
            if (cell.lastPlayed) {
              permanentStone.classList.add("lastPlayed");
            }
            if (cell.isPartOfTradeRoute) {
              permanentStone.classList.add("is-part-of-route");
            }
            if (cell.isPartOfCity) {
              permanentStone.classList.add("is-part-of-city");
            }
            if (cell.stoneOwner === PLAYER_1) {
              permanentStone.classList.add("stone-player1");
            } else if (cell.stoneOwner === PLAYER_2) {
              permanentStone.classList.add("stone-player2");
            }
            cellElement.appendChild(permanentStone);
          }
        } else if (cell && cell.type === "naturalResource") {
          cellElement.classList.add("resource");
        }

        rowElement.appendChild(cellElement);
      });
      this.gridContainer.appendChild(rowElement);
    });
  }
}

//A strategy for the RenderManager class and renders the Move Previews
export class MovePreviewRenderer {
  constructor() {
    this.boardReference = [];
    this.gridContainer = 0;
  }
  performStrategy(renderer, details) {
    this.cellElement = details.cellElement;
    this.piece = details.piece;
    this.preview = details.toggleFlag;
    this.gamePhase = details.gamePhase;
    this.boardReference = renderer.getBoard();
    // Get the grid from the board reference
    this.gridCOPY = this.boardReference.getGrid();

    // Get the grid container from the renderer
    this.gridContainer = renderer.gridContainer;
    // Render the map preview or stone preview based on the game phase
    if (this.gamePhase === MAP_PHASE) {
      this.renderMapPreview(this.cellElement, this.piece, this.preview);
    } else if (this.gamePhase === STONE_PHASE) {
      this.renderStonePreview(this.cellElement, this.preview);
    }
  }

  // Render the map preview
  renderMapPreview(cellElement, piece, preview) {
    if (this.gamePhase === MAP_PHASE) {
      // Calculate the starting position of the piece
      const x =
        parseInt(cellElement.dataset.col) - Math.floor(PIECE_SHAPE_SIZE / 2);
      const y =
        parseInt(cellElement.dataset.row) - Math.floor(PIECE_SHAPE_SIZE / 2);

      // Get the width and height of the piece
      const pieceWidth = this.piece.shape[0].length;
      const pieceHeight = this.piece.shape.length;

      // Loop through each cell in the piece
      for (let i = 0; i < pieceHeight; i++) {
        for (let j = 0; j < pieceWidth; j++) {
          if (this.piece.shape[i][j] === 1) {
            // Get the row and cell of the current cell in the piece
            const row = this.gridContainer.children[y + i];
            if (row) {
              const cell = row.children[x + j];
              if (cell) {
                // Add or remove the preview class based on the preview flag
                if (preview) {
                  cell.classList.add("preview");
                } else {
                  cell.classList.remove("preview");
                }
              }
            }
          }
        }
      }
    }
  }

  // Render the stone preview
  renderStonePreview(cellElement, preview) {
    if (typeof cellElement.stonePreviewActive === "undefined") {
      cellElement.stonePreviewActive = false;
    }
    if (this.gamePhase === STONE_PHASE) {
      // Get the existing stone preview element
      const existingStonePreview = cellElement.querySelector(".stone-preview");

      // Get the square from the grid
      const square =
        this.gridCOPY[cellElement.dataset.row][cellElement.dataset.col];

      // Add or remove the stone preview based on the preview flag and the square's state
      if (
        preview &&
        !cellElement.stonePreviewActive &&
        square &&
        square.stoneCount === 0
      ) {
        // Only add the stone preview if it's not already active and the square is not occupied
        const stonePreview = document.createElement("div");
        stonePreview.classList.add("stone-preview");
        stonePreview.classList.add("stone");
        cellElement.appendChild(stonePreview);
        cellElement.stonePreviewActive = true;
      } else if (!preview && cellElement.stonePreviewActive) {
        // Only remove the stone preview if it's currently active
        if (existingStonePreview) {
          cellElement.removeChild(existingStonePreview);
        }
        cellElement.stonePreviewActive = false;
      }
    }
  }
}

// EventListener class
export class EventListener {  constructor(game, gameBoard) {
    // Store the game and game board instances
    this.game = game;
    this.gameBoard = gameBoard;
    this.rotateButton = document.getElementById("rotate-button");
    this.autoplaceButton = document.getElementById("autoplace-button");
    this.autoplaceAllButton = document.getElementById("autoplace-all-button");
    // Get the grid container element
    this.gridContainer = document.getElementById("game-board");

    // Attach event listeners to the grid container and undo button
    this.attachEventListeners();
    
    // Initialize button states (after a small delay to ensure game is initialized)
    setTimeout(() => {
      this.updateAutoplaceButtonState();
      this.updateAutoplaceAllButtonState();
    }, 0);
  }

  // Attach event listeners to the grid container and undo button
  attachEventListeners() {
    // Handle mouseover event
    this.gridContainer.addEventListener("mouseover", (event) => {
      const cellElement = event.target.closest(".cell");
      if (cellElement) {
        this.handleHoverEnter(cellElement);
      }
    });

    // Handle mouseout event
    this.gridContainer.addEventListener("mouseout", (event) => {
      const cellElement = event.target.closest(".cell");
      if (cellElement) {
        this.handleHoverLeave(cellElement);
      }
    });

    // Handle click event
    this.gridContainer.addEventListener("click", (event) => {
      const cellElement = event.target.closest(".cell");
      if (cellElement) {
        this.handleClick(cellElement);
        console.log(cellElement);
      }
    });    this.rotateButton.addEventListener("click", () => {
      console.log("rotate");
      this.handleRotate();
    });    // Add autoplace button event listener
    if (this.autoplaceButton) {
      let isProcessing = false;
      this.autoplaceButton.addEventListener("click", () => {
        // Prevent multiple rapid clicks
        if (isProcessing || this.autoplaceButton.disabled) return;
        
        isProcessing = true;
        this.autoplaceButton.disabled = true;
        
        console.log("autoplace clicked");
        this.handleAutoplace()
          .finally(() => {
            isProcessing = false;
            this.updateAutoplaceButtonState();
            this.updateAutoplaceAllButtonState();
          });
      });
    }
    
    // Add autoplace-all button event listener
    if (this.autoplaceAllButton) {
      let isProcessingAll = false;
      this.autoplaceAllButton.addEventListener("click", () => {
        // Prevent multiple rapid clicks
        if (isProcessingAll || this.autoplaceAllButton.disabled) return;
        
        isProcessingAll = true;
        this.autoplaceAllButton.disabled = true;
        
        console.log("autoplace all clicked");
        this.handleAutoplaceAll()
          .finally(() => {
            isProcessingAll = false;
            this.updateAutoplaceButtonState();
            this.updateAutoplaceAllButtonState();
          });
      });
    }
  }
  handleRotate() {
    // Create a new StrategyDetails object with the necessary information
    const piece = this.game.gameBoard.getSingleMapPiece(
      this.game.currentMapPieceIndex
    );
    let details = new StrategyDetails()
      .setPiece(piece)
      .setGamePhase(this.game.turnManager.gamePhase)
      .setCurrentMapPieceIndex(this.game.currentMapPieceIndex)
      .build();

    this.game.executeStrategy("rotate", details);
    
    // NEW: Update button state after rotation
    this.updateAutoplaceButtonState();
  }
  
  /**
   * Handles the autoplace button click.
   * Attempts to automatically place the current map piece.
   * @returns {Promise} Resolves when placement is complete
   */  async handleAutoplace() {
    // Only process if we're in the map phase
    if (this.game.turnManager.gamePhase === MAP_PHASE) {
      try {
        // Get the current map piece
        const piece = this.game.gameBoard.getSingleMapPiece(
          this.game.currentMapPieceIndex
        );
        
        // Create strategy details
        let details = new StrategyDetails()
          .setPiece(piece)
          .setCurrentMapPieceIndex(this.game.currentMapPieceIndex)
          .setGamePhase(this.game.turnManager.gamePhase)
          .setTurn(this.game.turnManager.currentTurn)
          .setCurrentPlayer(this.game.currentPlayer)
          .build();
          
        // Execute the autoplaceMapPiece strategy
        const result = this.game.executeStrategy("autoplaceMapPiece", details);
        
        // Show feedback based on result
        if (result) {
          this.showFeedback("Piece placed successfully", "success");
        } else {
          this.showFeedback("No valid placement found", "error");
        }
        
        return result;
      } catch (error) {
        console.error("Error in autoplace:", error);
        this.showFeedback("Error during placement", "error");
        return false;
      }
    }
    return false;
  }

  /**
   * Handles the autoplace-all button click.
   * Attempts to automatically place all remaining map pieces.
   * @returns {Promise} Resolves when all placements are complete
   */
  async handleAutoplaceAll() {
    // Only process if we're in the map phase
    if (this.game.turnManager.gamePhase === MAP_PHASE) {
      try {
        const allMapPieces = this.game.gameBoard.getAllMapPieces();
        const startIndex = this.game.currentMapPieceIndex;
        let placedCount = 0;
        let failedCount = 0;
        
        // Create basic strategy details
        let details = new StrategyDetails()
          .setGamePhase(this.game.turnManager.gamePhase)
          .setTurn(this.game.turnManager.currentTurn)
          .setCurrentPlayer(this.game.currentPlayer)
          .build();
        
        // Try to place all remaining pieces
        const result = this.game.executeStrategy("autoplaceAllMapPieces", details);
        
        // Show feedback based on result
        if (result.success) {
          this.showFeedback(`Successfully placed ${result.placedCount} pieces`, "success");
        } else {
          if (result.placedCount > 0) {
            this.showFeedback(`Placed ${result.placedCount} pieces, ${result.failedCount} couldn't be placed`, "info");
          } else {
            this.showFeedback("Could not place any pieces", "error");
          }
        }
        
        return result.success;
      } catch (error) {
        console.error("Error in autoplace all:", error);
        this.showFeedback("Error during placement", "error");
        return false;
      }
    }
    return false;
  }

  // Handle mouseover event
  handleHoverEnter(cellElement) {
    // Add the hovered class to the cell element
    cellElement.classList.add("hovered");

    // Get the row and column of the cell element
    const row = parseInt(cellElement.dataset.row);
    const col = parseInt(cellElement.dataset.col);

    // Create a new StrategyDetails object with the necessary information
    const piece = this.game.gameBoard.getSingleMapPiece(
      this.game.currentMapPieceIndex
    );
    let details = new StrategyDetails()
      .setPiece(piece)
      .setCellElement(cellElement)
      .setGamePhase(this.game.turnManager.gamePhase)
      .setX(col)
      .setY(row)
      .setToggleFlag(true)
      .setCurrentMapPieceIndex(this.game.currentMapPieceIndex)
      .build();

    // Execute the renderMovePreview strategy with the details object
    this.game.executeStrategy("renderMovePreview", details);
  }

  // Handle mouseout event
  handleHoverLeave(cellElement) {
    // Remove the hovered class from the cell element
    cellElement.classList.remove("hovered");

    // Create a new StrategyDetails object with the necessary information
    const piece = this.game.gameBoard.getSingleMapPiece(
      this.game.currentMapPieceIndex
    );
    const row = parseInt(cellElement.dataset.row);
    const col = parseInt(cellElement.dataset.col);
    let details = new StrategyDetails()
      .setCellElement(cellElement)
      .setCurrentMapPieceIndex(this.game.currentMapPieceIndex)
      .setGamePhase(this.game.turnManager.gamePhase)
      .setPiece(piece)
      .setX(col)
      .setY(row)
      .setToggleFlag(false)
      .build();

    // Execute the renderMovePreview strategy with the details object
    this.game.executeStrategy("renderMovePreview", details);
  }

  // Handle click event
  handleClick(cellElement) {
    // Get the row and column of the cell element
    const row = parseInt(cellElement.dataset.row);
    const col = parseInt(cellElement.dataset.col);

    // Create a new StrategyDetails object with the necessary information
    const piece = this.game.gameBoard.getSingleMapPiece(
      this.game.currentMapPieceIndex
    );
    let details = new StrategyDetails()
      .setPiece(piece)
      .setX(col)
      .setY(row)
      .setCurrentMapPieceIndex(this.game.currentMapPieceIndex)
      .setCellElement(cellElement)
      .setGamePhase(this.game.turnManager.gamePhase)
      .setTurn(this.game.turnManager.currentTurn)
      .setCurrentPlayer(this.game.currentPlayer)
      .build();    // Execute the placeMapPiece or placeStone strategy based on the game phase
    if (this.game.turnManager.gamePhase === MAP_PHASE) {
      this.game.executeStrategy("placeMapPiece", details);
    } else if (this.game.turnManager.gamePhase === STONE_PHASE) {
      this.game.executeStrategy("placeStone", details);
    }
    
    // NEW: Update button state after click action
    this.updateAutoplaceButtonState();
  }
  
  /**
   * Shows a temporary feedback message to the user.
   * @param {string} message - The message to display
   * @param {string} type - The type of message (success/error)
   * @param {number} duration - How long to show the message in ms
   */
  showFeedback(message, type = "info", duration = 3000) {
    // Remove any existing feedback
    const existingFeedback = document.querySelector('.autoplace-feedback');
    if (existingFeedback) {
      document.body.removeChild(existingFeedback);
    }
    
    // Create and add feedback element
    const feedback = document.createElement('div');
    feedback.className = `autoplace-feedback ${type}`;
    feedback.textContent = message;
    document.body.appendChild(feedback);
    
    // Remove after duration
    setTimeout(() => {
      feedback.classList.add('fade');
      setTimeout(() => {
        if (feedback.parentNode) {
          document.body.removeChild(feedback);
        }
      }, 300);
    }, duration);
  }
    /**
   * Updates the enabled/disabled state of the autoplace button
   * based on current game state.
   */
  updateAutoplaceButtonState() {
    if (!this.autoplaceButton) return;
    
    // Disable in Stone phase, enable in Map phase
    const isMapPhase = this.game.turnManager.gamePhase === MAP_PHASE;
    
    // Check if we're still within available map pieces
    const hasMapPiecesLeft = this.game.currentMapPieceIndex < this.game.gameBoard.getAllMapPieces().length;
    
    // Enable only if in map phase and pieces remain
    this.autoplaceButton.disabled = !isMapPhase || !hasMapPiecesLeft;
    
    // Update visual state
    if (this.autoplaceButton.disabled) {
      this.autoplaceButton.classList.add("disabled");
    } else {
      this.autoplaceButton.classList.remove("disabled");
    }
  }
  
  /**
   * Updates the enabled/disabled state of the autoplace-all button
   * based on current game state.
   */
  updateAutoplaceAllButtonState() {
    if (!this.autoplaceAllButton) return;
    
    // Disable in Stone phase, enable in Map phase
    const isMapPhase = this.game.turnManager.gamePhase === MAP_PHASE;
    
    // Check if we have at least two pieces left (otherwise just use regular autoplace)
    const currentIndex = this.game.currentMapPieceIndex;
    const totalPieces = this.game.gameBoard.getAllMapPieces().length;
    const hasMultiplePiecesLeft = currentIndex < totalPieces - 1;
    
    // Enable only if in map phase and multiple pieces remain
    this.autoplaceAllButton.disabled = !isMapPhase || !hasMultiplePiecesLeft;
    
    // Update visual state
    if (this.autoplaceAllButton.disabled) {
      this.autoplaceAllButton.classList.add("disabled");
    } else {
      this.autoplaceAllButton.classList.remove("disabled");
    }
  }
}
