import {
  PLAYER_1,
  PLAYER_2,
  STARTING_PHASE, // Add STARTING_PHASE
  MAP_PHASE_TURNS_THRESHOLD, // Add MAP_PHASE_TURNS_THRESHOLD
  STONE_PHASE, // Add STONE_PHASE
  GLOBAL_WARMING_BASE_CHANCE // Add GLOBAL_WARMING_BASE_CHANCE
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
export class HistoryManager {
  constructor() {
    this.history = [];
  }
  //Method to add a state to the history
  addState(state) {
    this.history.push(state);

    let lastTwoStatesComparisson = this.compareLastTwoStates();
    if (lastTwoStatesComparisson === false) {
      this.undo();
    }
  }
  //Method to undo the last state
  undo() {
    this.history.pop();
  }
  //Method to get the last state
  getLastState() {
    return this.history[this.history.length - 1];
  }
  //Method to get the size of the history
  getHistorySize() {
    return this.history.length;
  }
  //Method to clear the history
  clearHistory() {
    this.history = [];
  }

  compareLastTwoStates() {
    if (this.history.length < 2) {
      return true;
    }
    const lastState = this.history[this.history.length - 1];
    const secondLastState = this.history[this.history.length - 2];
    if (!lastState || !secondLastState) {
      return false;
    }

    let differences = [];
    for (let i = 0; i < lastState.length; i++) {
      for (let j = 0; j < lastState[i].length; j++) {
        let diff = this.deepEqual(lastState[i][j], secondLastState[i][j]);
        if (diff !== true) {
          differences.push({ row: i, col: j, differences: diff });
        }
      }
    }

    return differences.length > 0 ? differences : false;
  }

  deepEqual(a, b, path = "") {
    if (a === b) {
      return true;
    }

    if (
      typeof a !== "object" ||
      a === null ||
      typeof b !== "object" ||
      b === null
    ) {
      return [{ path, newValue: a, oldValue: b }];
    }

    let newKeys = Object.keys(a),
      oldKeys = Object.keys(b);

    if (newKeys.length !== oldKeys.length) {
      return [{ path, newKeys, oldKeys }];
    }

    let diffs = [];
    for (let key of newKeys) {
      if (!oldKeys.includes(key)) {
        diffs.push({
          path: `${path}.${key}`,
          newValue: a[key],
          oldValue: undefined,
        });
      } else {
        let diff = this.deepEqual(a[key], b[key], `${path}.${key}`);
        if (diff !== true) {
          diffs = diffs.concat(diff);
        }
      }
    }

    return diffs.length > 0 ? diffs : true;
  }
}

export class GlobalWarmingChanceTracker {
  constructor() {
    this.globalWarmingChance = null;
    this.removedPeninsulas = [];
  }

  // Method to calculate the chance of global warming
  calculateChance(details) {
    this.turn = details.currentTurn;
    if (details.removedPeninsulas) {
      this.removedPeninsulas = details.removedPeninsulas;
    }

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
    return this.globalWarmingChance;
  }
}

//Tracks score
export class ScoreTracker {
  constructor() {
    this.scores = {
      [PLAYER_1]: 0,
      [PLAYER_2]: 0
    };
  }
  
  calculateScores(emperorState, tradeRouteState, cityState, populationState) {
    // Reset scores
    this.scores = {
      [PLAYER_1]: 0,
      [PLAYER_2]: 0
    };
    
    // Add emperor points (1 point per emperor)
    if (emperorState) {
      // Check if emperorState is an array before iterating
      if (Array.isArray(emperorState)) {
        for (const emperor of emperorState) {
          if (emperor.emperor === PLAYER_1) {
            this.scores[PLAYER_1] += 1;
          } else if (emperor.emperor === PLAYER_2) {
            this.scores[PLAYER_2] += 1;
          }
        }
      } else {
        // Handle the case where emperorState is an object (as seen in UIManagement.mjs)
        for (const key in emperorState) {
          if (Object.prototype.hasOwnProperty.call(emperorState, key)) {
            if (emperorState[key].emperor === PLAYER_1) {
              this.scores[PLAYER_1] += 1;
            } else if (emperorState[key].emperor === PLAYER_2) {
              this.scores[PLAYER_2] += 1;
            }
          }
        }
      }
    }
    
    // Add population points (1 point per square in ruled map pieces)
    if (populationState) {
      this.scores[PLAYER_1] += populationState[PLAYER_1] || 0; // Add || 0 for safety
      this.scores[PLAYER_2] += populationState[PLAYER_2] || 0; // Add || 0 for safety
    }
    
    // Add trade route points (1 point per route plus points for gaps)
    if (tradeRouteState && tradeRouteState[PLAYER_1] && tradeRouteState[PLAYER_2]) {
      this.scores[PLAYER_1] += tradeRouteState[PLAYER_1].count;
      this.scores[PLAYER_1] += tradeRouteState[PLAYER_1].totalLength;
      
      this.scores[PLAYER_2] += tradeRouteState[PLAYER_2].count;
      this.scores[PLAYER_2] += tradeRouteState[PLAYER_2].totalLength;
    }
    
    // Add city points (1 point per city)
    if (cityState && cityState[PLAYER_1] && cityState[PLAYER_2]) {
      this.scores[PLAYER_1] += cityState[PLAYER_1].count;
      this.scores[PLAYER_2] += cityState[PLAYER_2].count;
    }
    
    return this.scores;
  }
  
  getScores() {
    return this.scores;
  }
}

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
    this.removedPeninsulas = null;
    this.currentGlobalWarmingChance = null;
    this.removalCoordinates = null;
    this.currentScores = null; // Add currentScores property
  }
  setCurrentPeninsulaState(currentPeninsulaState) {
    this.currentPeninsulaState = currentPeninsulaState;
    return this;
  }

  setRemovalCoordinates(removalCoordinates) {
    this.removalCoordinates = removalCoordinates;
    return this;
  }

  setRemovedPeninsulas(removedPeninsulas) {
    this.removedPeninsulas = removedPeninsulas;
    return this;
  }

  setCurrentGlobalWarmingChance(currentGlobalWarmingChance) {
    this.currentGlobalWarmingChance = currentGlobalWarmingChance;
    return this;
  }

  setCurrentScores(scores) { // Add setCurrentScores method
    this.currentScores = scores;
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
