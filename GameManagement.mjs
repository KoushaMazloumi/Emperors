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
//A class to handle global warming mechanism
export class GlobalWarmingManager {
  constructor() {
    this.removedPeninsulas = [];
    this.gridCOPY = null;
  }

  routine(details) {
    this.calculateChance(details);
    this.handleEvent(details);
    details.setCurrentGridCopyState(this.gridCOPY);
    return this.gridCOPY;
  }

  calculateChance(details) {
    this.turn = details.currentTurn;
    const baseChance = GLOBAL_WARMING_BASE_CHANCE; // The base chance of global warming
    const turnsFactor = Math.pow(2, (this.turn - 10) / 10); // Exponentially increase chance based on the number of turns
    const removedPeninsulasFactor =
      this.removedPeninsulas.length > 0
        ? Math.pow(3, this.removedPeninsulas.length - 1) / 25
        : 0; // Exponentially decrease chance based on the number of removed peninsulas
    this.globalWarmingChance = Math.max(
      0,
      baseChance * turnsFactor - removedPeninsulasFactor
    );
  }

  handleEvent(details) {
    console.log("global warming chance: ", this.globalWarmingChance);
    const peninsulas = details.currentPeninsulaState.peninsulas;
    this.gridCOPY = details.currentGridCopyState;
    const gridsToRemove = peninsulas
      .filter((peninsula) => {
        const roll = Math.random();
        console.log(
          `Roll for peninsula at (${peninsula.x}, ${peninsula.y}): ${roll}`
        );
        if (roll < this.globalWarmingChance) {
          console.log(
            `Peninsula at (${peninsula.x}, ${peninsula.y}) affected by global warming.`
          );
          this.removedPeninsulas.push({
            x: peninsula.x,
            y: peninsula.y,
            time: Date.now(),
          });
          this.calculateChance(details);
          console.log("new chance:", this.globalWarmingChance);
          return true;
        }
        return false;
      })
      .map(({ x, y }) => ({
        x,
        y,
        mapPiece: this.gridCOPY[y][x].mapPiece,
      }));
    gridsToRemove.forEach(({ x, y, mapPiece }) =>
      this.removeGrid(x, y, mapPiece, details)
    );

    console.log("Removed peninsulas:", this.removedPeninsulas);
  }

  removeGrid(x, y, mapPiece) {
    // 1. Update the specific map piece objects
    const square = this.gridCOPY[y][x];
    if (
      square &&
      square.type === "mapPiece" &&
      square.mapPiece.id === mapPiece.id
    ) {
      const squareIndex = square.pieceSquareIndex;
      // Update the shapeRelativeSquareLocations and squareLocationStonePlayer arrays
      mapPiece.shapeRelativeSquareLocations =
        mapPiece.shapeRelativeSquareLocations
          .filter((loc) => loc.index !== squareIndex)
          .map((loc, index) => ({
            ...loc,
            index,
          }));
      mapPiece.shapeRelativeStoneFlags =
        mapPiece.shapeRelativeStoneFlags.filter(
          (player, index) => index !== squareIndex
        );
      mapPiece.boardRelativeSquareLocations =
        mapPiece.boardRelativeSquareLocations
          .filter((loc, index) => index !== squareIndex)
          .map((loc, index) => ({
            ...loc,
            index,
          }));
      // Update the id property of the remaining squares in the map piece
      for (let i = 0; i < this.gridCOPY.length; i++) {
        for (let j = 0; j < this.gridCOPY[i].length; j++) {
          const cell = this.gridCOPY[i][j];
          if (
            cell &&
            cell.type === "mapPiece" &&
            cell.mapPiece.id === mapPiece.id
          ) {
            cell.id = mapPiece.boardRelativeSquareLocations.findIndex(
              (loc) =>
                loc.x === cell.cellSquareLocation.x &&
                loc.y === cell.cellSquareLocation.y
            );
          }
        }
      }
      // Recreate the shape and replace the old shape
      mapPiece.shape = this.recreateShape(
        mapPiece.shapeRelativeSquareLocations
      );
      mapPiece.stones = mapPiece.shapeRelativeStoneFlags.filter(
        (player) => player !== false
      ).length;
      // 2. Update the board grid
      this.gridCOPY[y][x] = null;
      // 3. Update the cell references in the entire grid
      for (let i = 0; i < this.gridCOPY.length; i++) {
        for (let j = 0; j < this.gridCOPY[i].length; j++) {
          const cell = this.gridCOPY[i][j];
          if (
            cell &&
            cell.type === "mapPiece" &&
            cell.mapPiece.id === mapPiece.id
          ) {
            if (i === y && j === x) {
              cell.mapPiece = null;
              cell.stoneOwner = null;
              cell.stoneCount = 0;
              cell.type = null;
            }
          }
        }
      }
    }
  }
  recreateShape(shapeRelativeSquareLocations) {
    // Initialize a 7x7 array with all zeros
    let shape = Array(7)
      .fill()
      .map(() => Array(7).fill(0));
    // For each location in shapeRelativeSquareLocations, set the corresponding position in the shape array to 1
    shapeRelativeSquareLocations.forEach((location) => {
      shape[location.y][location.x] = 1;
    });
    return shape;
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
