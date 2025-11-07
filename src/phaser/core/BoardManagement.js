import { GRID_SIZE } from '../utils/Constants.js';
import { HistoryManager } from './GameManagement.js';

/**
 * Manages the game board state with private grid
 */
export class BoardState {
  #grid = [];
  #mapPieces = [];

  constructor() {
    // Initialize empty grid
    this.#grid = new Array(GRID_SIZE)
      .fill(null)
      .map(() => new Array(GRID_SIZE).fill(null));

    for (let i = 0; i < GRID_SIZE; i++) {
      this.#grid[i] = [];
      for (let j = 0; j < GRID_SIZE; j++) {
        this.#grid[i][j] = null;
      }
    }

    this.historyManager = new HistoryManager();
    this.historyManager.addState(this.#grid);
  }

  getGrid() {
    return this.#grid;
  }

  getAllMapPieces() {
    return this.#mapPieces;
  }

  uploadGrid(newGrid) {
    this.#grid = newGrid;
    this.updateMapPiecesArray();
    this.historyManager.addState(this.#grid);
  }

  updateMapPiecesArray() {
    const mapPiecesSet = new Set();
    for (let i = 0; i < this.#grid.length; i++) {
      for (let j = 0; j < this.#grid[i].length; j++) {
        if (this.#grid[i][j] !== null && this.#grid[i][j].type === "mapPiece") {
          mapPiecesSet.add(this.#grid[i][j].mapPiece);
        }
      }
    }
    this.#mapPieces = Array.from(mapPiecesSet);
  }
}

/**
 * Searches the board for patterns and data
 */
export class BoardStateSearcher {
  constructor(gameBoard) {
    this.gameBoard = gameBoard;
    this.grid = [];
    this.strategy = null;
  }

  setStrategy(strategy) {
    this.strategy = strategy;
  }

  performStrategy(details) {
    if (!this.strategy) {
      throw new Error("Strategy is not set");
    }
    this.grid = this.gameBoard.getGrid();
    return this.strategy.performStrategy(this, details);
  }
}

/**
 * Edits the board state using strategies
 */
export class BoardStateEditor {
  #board;

  constructor(board) {
    this.#board = board;
    this.strategy = null;
    this.gridCopy = null;
    this.mapPiecesCopy = null;
  }

  setStrategy(strategy) {
    this.strategy = strategy;
  }

  performStrategy(details) {
    if (!this.strategy) {
      throw new Error("Strategy is not set");
    }
    details.setCurrentGridCopyState(this.getGrid());
    this.strategy.performStrategy(details);
    this.applyChanges();
  }

  applyChanges() {
    const newGrid = this.strategy.giveUpdatedGrid();
    this.#board.uploadGrid(newGrid);
  }

  getGrid() {
    // Create deep copy
    this.gridCopy = JSON.parse(JSON.stringify(this.#board.getGrid()));
    this.mapPiecesCopy = JSON.parse(JSON.stringify(this.#board.getAllMapPieces()));

    // Restore mapPiece object references
    for (let i = 0; i < this.gridCopy.length; i++) {
      for (let j = 0; j < this.gridCopy[i].length; j++) {
        if (this.gridCopy[i][j] !== null && this.gridCopy[i][j].type === "mapPiece") {
          const index = this.mapPiecesCopy.findIndex(
            (mapPiece) => mapPiece.id === this.gridCopy[i][j].mapPieceID
          );
          this.gridCopy[i][j].mapPiece = this.mapPiecesCopy[index];
        }
      }
    }
    return this.gridCopy;
  }

  applyGlobalWarming(newGrid) {
    this.#board.uploadGrid(newGrid);
  }
}

/**
 * Validates moves
 */
export class MoveValidator {
  constructor(gameBoard) {
    this.gameBoard = gameBoard;
    this.grid = [];
    this.strategy = null;
  }

  setStrategy(strategy) {
    this.strategy = strategy;
  }

  performStrategy(details) {
    if (!this.strategy) {
      throw new Error("Strategy is not set");
    }
    this.grid = this.gameBoard.getGrid();
    return this.strategy.performStrategy(this, details);
  }
}
