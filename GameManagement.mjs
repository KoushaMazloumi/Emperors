import {
  STARTING_PHASE,
  PLAYER_1,
  PLAYER_2,
  MAP_PHASE_TURNS_THRESHOLD,
  STONE_PHASE,
  GLOBAL_WARMING_BASE_CHANCE,
} from "./Constants.mjs";

//Manages turn switches and phase switches

// A class to manage turns in the game
export class TurnManager {
  constructor(game) {
    this.game = game;
    // Initialize the current turn to the first player
    this.currentTurn = 0;
    this.gamePhase = STARTING_PHASE;
  }

  // Method to change turn
  changeTurn(details) {
    this.currentTurn++;

    details.setTurn(this.currentTurn);
    // Switch to the other player
    this.game.currentPlayer =
      this.game.currentPlayer === PLAYER_1 ? PLAYER_2 : PLAYER_1;
    console.log("current player", this.game.currentPlayer);
    // Increment the current map piece index but make sure to not go over the length of map pieces
    this.game.currentMapPieceIndex = Math.min(
      this.game.currentMapPieceIndex + 1,
      this.game.gameBoard.getAllMapPieces().length - 1
    );
  }
  checkPhase(details) {
    // If the current turn is the map phase threshold, change the game phase to stone phase
    if (this.currentTurn === MAP_PHASE_TURNS_THRESHOLD) {
      this.gamePhase = STONE_PHASE;
      details.setGamePhase(STONE_PHASE);
    }
  }
}
//A class to encapsulate our history states
export class HistoryManager {}

//Tracks score
export class ScoreTracker {}
//A class that stores the player information
export class Player {
  constructor() {
    this.name = "";
    this.score = 0;
  }
}

//A class to centralize all console logs
export class Logger {
  logGeneratedShapes(pieces) {
    console.log("Generated Shapes:");
    pieces.forEach((piece) => {
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
    this.toggleFlag = null;
    this.cellElement = null;
    this.currentMapPieceIndex = null;
    this.currentEmperorState = null;
    this.currentTradeRouteState = null;
    this.currentPopulationState = null;
    this.currentCityState = null;
    this.gamePhase = null;
    this.currentTurn = null;
    this.currentPlayer = null;
    this.currentGridCopyState = null;
    this.currentResourceState = null;
    this.currentPeninsulaState = null;
  }
  setCurrentPeninsulaState(currentPeninsulaState) {
    this.currentPeninsulaState = currentPeninsulaState;
    return this;
  }

  setCurrentPopulationState(currentPopulationState) {
    this.currentPopulationState = currentPopulationState;
    return this;
  }
  setCurrentResourceState(currentResourceState) {
    this.currentResourceState = currentResourceState;
    return this;
  }

  setCurrentGridCopyState(currentGridState) {
    this.currentGridCopyState = currentGridState;
    return this;
  }

  setCurrentTradeRouteState(currentTradeRouteState) {
    this.currentTradeRouteState = currentTradeRouteState;
    return this;
  }
  setCurrentCityState(currentCityState) {
    this.currentCityState = currentCityState;
    return this;
  }
  setCurrentPlayer(currentPlayer) {
    this.currentPlayer = currentPlayer;
    return this;
  }
  setPiece(piece) {
    this.piece = piece;
    return this;
  }
  setCurrentEmperorState(currentEmperorState) {
    this.currentEmperorState = currentEmperorState;
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
