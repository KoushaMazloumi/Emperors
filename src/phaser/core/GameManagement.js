import {
  PLAYER_1,
  PLAYER_2,
  STARTING_PHASE,
  MAP_PHASE_TURNS_THRESHOLD,
  STONE_PHASE,
  GLOBAL_WARMING_BASE_CHANCE,
  CITY_POINTS
} from '../utils/Constants.js';

/**
 * Manages turn switches and phase switches
 */
export class TurnManager {
  constructor(game) {
    this.game = game;
    this.currentTurn = 0;
    this.gamePhase = STARTING_PHASE;
  }

  changeTurn(details) {
    this.currentTurn++;
    details.setTurn(this.currentTurn);

    // Switch to the other player
    this.game.currentPlayer =
      this.game.currentPlayer === PLAYER_1 ? PLAYER_2 : PLAYER_1;

    // Increment the current map piece index
    this.game.currentMapPieceIndex = Math.min(
      this.game.currentMapPieceIndex + 1,
      this.game.gameBoard.getAllMapPieces().length - 1
    );
  }

  checkPhase(details) {
    if (this.currentTurn === MAP_PHASE_TURNS_THRESHOLD) {
      this.gamePhase = STONE_PHASE;
      details.setGamePhase(STONE_PHASE);
    }
  }
}

/**
 * Manages game state history for undo functionality
 */
export class HistoryManager {
  constructor() {
    this.history = [];
  }

  addState(state) {
    this.history.push(state);
    let lastTwoStatesComparison = this.compareLastTwoStates();
    if (lastTwoStatesComparison === false) {
      this.undo();
    }
  }

  undo() {
    this.history.pop();
  }

  getLastState() {
    return this.history[this.history.length - 1];
  }

  getHistorySize() {
    return this.history.length;
  }

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

/**
 * Tracks global warming chance and removed peninsulas
 */
export class GlobalWarmingChanceTracker {
  constructor() {
    this.globalWarmingChance = null;
    this.removedPeninsulas = [];
  }

  calculateChance(details) {
    this.turn = details.currentTurn;
    if (details.removedPeninsulas) {
      this.removedPeninsulas = details.removedPeninsulas;
    }

    const baseChance = GLOBAL_WARMING_BASE_CHANCE;
    const turnsFactor = Math.pow(2, (this.turn - 10) / 10);
    const removedPeninsulasFactor =
      this.removedPeninsulas.length > 0
        ? Math.pow(3, this.removedPeninsulas.length - 1) / 25
        : 0;
    this.globalWarmingChance = Math.max(
      0,
      baseChance * turnsFactor - removedPeninsulasFactor
    );
    return this.globalWarmingChance;
  }
}

/**
 * Calculates and tracks player scores
 */
export class ScoreTracker {
  constructor() {
    this.scores = {
      [PLAYER_1]: 0,
      [PLAYER_2]: 0
    };
  }

  calculateScores(emperorState, tradeRouteState, cityState, populationState, resourceState) {
    this.scores = {
      [PLAYER_1]: 0,
      [PLAYER_2]: 0
    };

    // Add emperor points (1 point per emperor)
    if (emperorState) {
      if (Array.isArray(emperorState)) {
        for (const emperor of emperorState) {
          if (emperor.emperor === PLAYER_1) {
            this.scores[PLAYER_1] += 1;
          } else if (emperor.emperor === PLAYER_2) {
            this.scores[PLAYER_2] += 1;
          }
        }
      } else {
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
      this.scores[PLAYER_1] += populationState[PLAYER_1] || 0;
      this.scores[PLAYER_2] += populationState[PLAYER_2] || 0;
    }

    // Add trade route points (1 point per route plus points for gaps)
    if (tradeRouteState) {
      if (tradeRouteState[PLAYER_1]) {
        this.scores[PLAYER_1] += tradeRouteState[PLAYER_1].count;
        this.scores[PLAYER_1] += tradeRouteState[PLAYER_1].totalLength;
      }

      if (tradeRouteState[PLAYER_2]) {
        this.scores[PLAYER_2] += tradeRouteState[PLAYER_2].count;
        this.scores[PLAYER_2] += tradeRouteState[PLAYER_2].totalLength;
      }
    }

    // Add city points (2 points per city)
    if (cityState) {
      if (cityState[PLAYER_1]) {
        this.scores[PLAYER_1] += cityState[PLAYER_1].count * CITY_POINTS;
      }
      if (cityState[PLAYER_2]) {
        this.scores[PLAYER_2] += cityState[PLAYER_2].count * CITY_POINTS;
      }
    }

    // Add resource points (1 point per resource)
    if (resourceState) {
      if (resourceState[PLAYER_1]) {
        this.scores[PLAYER_1] += resourceState[PLAYER_1].count;
      }
      if (resourceState[PLAYER_2]) {
        this.scores[PLAYER_2] += resourceState[PLAYER_2].count;
      }
    }

    return this.scores;
  }

  getScores() {
    return this.scores;
  }
}

/**
 * Builder pattern for passing parameters between strategies
 */
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
    this.currentScores = null;
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

  setCurrentScores(scores) {
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

/**
 * Player information
 */
export class Player {
  constructor() {
    this.name = "";
    this.score = 0;
  }
}
