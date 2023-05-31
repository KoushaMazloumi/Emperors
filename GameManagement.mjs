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
  PLAYER_1,
  PLAYER_2,
} from "./Constants.mjs";

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
import {
  RenderManager,
  StatusRenderer,
  BoardRenderer,
  MovePreviewRenderer,
  EventListener,
} from "./UIManagement.mjs";

//Manages turn switches and phase switches

// A class to manage turns in the game
export class TurnManager {
  constructor(game) {
    this.game = game;
    // Initialize the current turn to the first player
    this.currentTurn = 0;
  }

  // Method to change turn
  changeTurn() {
    this.currentTurn++;
    // Switch to the other player
    this.game.currentPlayer =
      this.game.currentPlayer === PLAYER_1 ? PLAYER_2 : PLAYER_1;
    console.log("current player", this.game.currentPlayer);
    // Increment the current map piece index but make sure to not go over the length of this.game.mapPieces
    this.game.currentMapPieceIndex = Math.min(
      this.game.currentMapPieceIndex + 1,
      this.game.mapPieces.length - 1
    );
    return this;
  }
}
//A class to encapsulate our history states
export class HistoryManager {}

//A child of HistoryManager to track our history stack so we can undo and redo later
export class HistoryTracker extends HistoryManager {
  constructor() {
    this.history = [];
  }
}

//Tracks score
export class ScoreTracker {}
//A class that stores the player information
export class Player {
  constructor() {
    this.name = "";
    this.score = 0;
  }
}
//A class to handle global warming mechanism
export class GlobalWarming {
  constructor() {
    this.removedPeninsulas = [];
  }

  calculateChance() {
    const baseChance = GLOBAL_WARMING_BASE_CHANCE; // The base chance of global warming
    const turnsFactor = Math.pow(
      2,
      (this.game.turnManager.currentTurn - 10) / 10
    ); // Exponentially increase chance based on the number of turns
    const removedPeninsulasFactor =
      this.removedPeninsulas.length > 0
        ? Math.pow(3, this.removedPeninsulas.length - 1) / 25
        : 0; // Exponentially decrease chance based on the number of removed peninsulas
    this.globalWarmingChance = Math.max(
      0,
      baseChance * turnsFactor - removedPeninsulasFactor
    );
  }

  handleGlobalWarmingEvent() {}
}

//A class to centralize all console logs
export class Logger {
  logGeneratedShapes(pieces) {
    console.log("Generated Shapes:");
    pieces.forEach((piece, index) => {
      console.log(`Shape ${piece.id}:`); // Log the ID of the map piece
      console.table(piece.shape);
    });
  }
}

//A class that will display info alerts when players try to break rules
export class InfoAlert {
  constructor() {}
  toggleAlert() {}
}

export class StrategyDetails {
  constructor() {
    this.piece = null;
    this.x = null;
    this.y = null;
    this.currentMapPieceIndex = null;
    this.gamePhase = null;
    this.toggleFlag = null;
    this.cellElement = null;
    this.currentTurn = null;
    this.currentPlayer = null;
  }
  setCurrentPlayer(currentPlayer) {
    this.currentPlayer = currentPlayer;
    return this;
  }
  setPiece(piece) {
    this.piece = piece;
    return this;
  }

  setX(x) {
    this.x = x;
    return this;
  }

  setY(y) {
    this.y = y;
    return this;
  }
  setTurn(turn) {
    this.currentTurn = turn;
    return this;
  }

  setCurrentMapPieceIndex(currentMapPieceIndex) {
    this.currentMapPieceIndex = currentMapPieceIndex;
    return this;
  }

  setGamePhase(gamePhase) {
    this.gamePhase = gamePhase;
    return this;
  }

  setToggleFlag(toggleFlag) {
    this.toggleFlag = toggleFlag;
    return this;
  }
  setCellElement(cellElement) {
    this.cellElement = cellElement;
    return this;
  }
  build() {
    return this;
  }
}
