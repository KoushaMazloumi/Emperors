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
  MAP_PHASE,
  STONE_PHASE,
  PLAYER_1,
  PLAYER_2,
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
  MoveValidator,
  ValidateMapPiecePlacementStrategy,
  AddStoneStrategy,
  AddMapPieceStrategy,
  AddNaturalResourceStrategy,
} from "./BoardManagement.mjs";
import { MapPieceGenerator, MapPiece } from "./MapPieces.mjs";

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
export class StatusRenderer {}

//A strategy for the RenderManager class and renders the board
export class BoardRenderer {
  constructor() {
    this.boardReference = [];
    this.gridContainer = 0;
  }
  // Method to perform the strategy
  performStrategy(renderer, details) {
    this.boardReference = renderer.getBoard();
    this.gridContainer = renderer.gridContainer;
    this.renderBoard(this.boardReference);
  }
  // Method to render the board
  renderBoard(board) {
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
export class EventListener {
  constructor(game, gameBoard) {
    // Store the game and game board instances
    this.game = game;
    this.gameBoard = gameBoard;

    // Get the grid container element
    this.gridContainer = document.getElementById("game-board");

    // Attach event listeners to the grid container and undo button
    this.attachEventListeners();
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
    });

    // Handle undo button click event
    const undoButton = document.getElementById("undo-button");
    undoButton.addEventListener("click", () => {
      this.game.undo();
    });
  }

  // Handle mouseover event
  handleHoverEnter(cellElement) {
    // Add the hovered class to the cell element
    cellElement.classList.add("hovered");

    // Get the row and column of the cell element
    const row = parseInt(cellElement.dataset.row);
    const col = parseInt(cellElement.dataset.col);

    // Create a new StrategyDetails object with the necessary information
    const piece = this.game.getCurrentPiece();
    let details = new StrategyDetails()
      .setPiece(piece)
      .setCellElement(cellElement)
      .setGamePhase(this.game.gamePhase)
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
    const piece = this.game.getCurrentPiece();
    const row = parseInt(cellElement.dataset.row);
    const col = parseInt(cellElement.dataset.col);
    let details = new StrategyDetails()
      .setCellElement(cellElement)
      .setCurrentMapPieceIndex(this.game.currentMapPieceIndex)
      .setGamePhase(this.game.gamePhase)
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
    const piece = this.game.getCurrentPiece();
    let details = new StrategyDetails()
      .setPiece(piece)
      .setX(col)
      .setY(row)
      .setCurrentMapPieceIndex(this.game.currentMapPieceIndex)
      .setCellElement(cellElement)
      .setGamePhase(this.game.gamePhase)
      .setTurn(this.game.turnManager.currentTurn)
      .setCurrentPlayer(this.game.currentPlayer)
      .build();

    // Execute the placeMapPiece or placeStone strategy based on the game phase
    if (this.game.gamePhase === MAP_PHASE) {
      this.game.executeStrategy("placeMapPiece", details);
    } else if (this.game.gamePhase === STONE_PHASE) {
      this.game.executeStrategy("placeStone", details);
    }
  }
}
