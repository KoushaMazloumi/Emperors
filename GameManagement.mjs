import {
  PLAYER_1,
  PLAYER_2,
  STARTING_PHASE, // Add STARTING_PHASE
  MAP_PHASE_TURNS_THRESHOLD, // Add MAP_PHASE_TURNS_THRESHOLD
  STONE_PHASE, // Add STONE_PHASE
  GLOBAL_WARMING_BASE_CHANCE, // Add GLOBAL_WARMING_BASE_CHANCE
  EMPEROR_POINTS,
  POPULATION_POINTS,
  TRADE_ROUTE_POINTS,
  TRADE_ROUTE_LENGTH_POINTS,
  CITY_POINTS,
  RESOURCE_POINTS,
  FISHING_VILLAGE_POINTS
} from "./Constants.mjs";

/**
 * TurnManager — Turn and phase management
 *
 * Refactored to eliminate Game/GameEngine dependencies. Turn calculation via
 * changeTurn() is stateless (pure function of inputs). Maintains pending skip
 * state for blockade turn-skip mechanics via scheduleSkip().
 *
 * No longer takes Game instance in constructor.
 */
export class TurnManager {
  constructor() {
    // Initialize the current turn to the first player
    this.currentTurn = 0;
    this.gamePhase = STARTING_PHASE;
    this.pendingSkips = { [PLAYER_1]: 0, [PLAYER_2]: 0 };
    this.lastSkippedPlayers = [];
  }

  /**
   * Advance turn to next player, processing any pending skips.
   * Stateless: accepts current state, returns new state without mutations.
   *
   * @param {Object} state - Current state
   * @param {string} state.currentPlayer - Current player ("p1" or "p2")
   * @param {number} state.currentMapPieceIndex - Current map piece index
   * @param {number} state.totalMapPieces - Total map pieces on board
   * @param {Object} state.pendingSkips - Pending skips per player
   * @param {number} state.currentTurn - Current turn number
   * @returns {Object} New state with newPlayer, newMapPieceIndex, newTurn, skippedPlayers, newPendingSkips
   */
  changeTurn(state) {
    const newTurn = state.currentTurn + 1;

    // Switch to the other player
    const newPlayer = state.currentPlayer === PLAYER_1 ? PLAYER_2 : PLAYER_1;

    // Increment the current map piece index but make sure to not go over the length of map pieces
    const newMapPieceIndex = Math.min(
      state.currentMapPieceIndex + 1,
      state.totalMapPieces - 1
    );

    // Consume pending skips for the new player
    const consumeResult = this.consumeSkipIfPending({
      currentPlayer: newPlayer,
      currentTurn: newTurn,
      pendingSkips: { ...state.pendingSkips }
    });

    return {
      newPlayer: consumeResult.finalPlayer,
      newMapPieceIndex: newMapPieceIndex,
      newTurn: consumeResult.finalTurn,
      skippedPlayers: consumeResult.skippedPlayers,
      newPendingSkips: consumeResult.finalPendingSkips
    };
  }

  checkPhase(currentTurn) {
    // If the current turn is the map phase threshold, change the game phase to stone phase
    if (currentTurn >= MAP_PHASE_TURNS_THRESHOLD && this.gamePhase !== STONE_PHASE) {
      return STONE_PHASE;
    }
    return this.gamePhase;
  }

  scheduleSkip(player) {
    this.pendingSkips[player]++;
  }

  // Stateless consume skip - accepts state and returns updated state
  // Input: { currentPlayer, currentTurn, pendingSkips }
  // Output: { skippedPlayers, finalPlayer, finalTurn, finalPendingSkips }
  consumeSkipIfPending(state) {
    const skippedPlayers = [];
    const MAX_SKIP_ITERATIONS = 10; // Safety bound to prevent infinite loop
    let iterations = 0;
    let currentPlayer = state.currentPlayer;
    let currentTurn = state.currentTurn;
    let pendingSkips = { ...state.pendingSkips };

    while (pendingSkips[currentPlayer] > 0 && iterations < MAX_SKIP_ITERATIONS) {
      skippedPlayers.push(currentPlayer);
      pendingSkips[currentPlayer]--;
      currentTurn++;
      currentPlayer = currentPlayer === PLAYER_1 ? PLAYER_2 : PLAYER_1;
      iterations++;
    }

    return {
      skippedPlayers: skippedPlayers,
      finalPlayer: currentPlayer,
      finalTurn: currentTurn,
      finalPendingSkips: pendingSkips
    };
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
  
  calculateScores(emperorState, tradeRouteState, cityState, populationState, resourceState, fishingVillageState) {
    // Reset scores
    this.scores = {
      [PLAYER_1]: 0,
      [PLAYER_2]: 0
    };
    
    // Add emperor points
    if (emperorState) {
      if (Array.isArray(emperorState)) {
        for (const emperor of emperorState) {
          if (emperor.emperor === PLAYER_1) {
            this.scores[PLAYER_1] += EMPEROR_POINTS;
          } else if (emperor.emperor === PLAYER_2) {
            this.scores[PLAYER_2] += EMPEROR_POINTS;
          }
        }
      } else {
        for (const key in emperorState) {
          if (Object.prototype.hasOwnProperty.call(emperorState, key)) {
            if (emperorState[key].emperor === PLAYER_1) {
              this.scores[PLAYER_1] += EMPEROR_POINTS;
            } else if (emperorState[key].emperor === PLAYER_2) {
              this.scores[PLAYER_2] += EMPEROR_POINTS;
            }
          }
        }
      }
    }

    // Add population points
    if (populationState) {
      this.scores[PLAYER_1] += (populationState[PLAYER_1] || 0) * POPULATION_POINTS;
      this.scores[PLAYER_2] += (populationState[PLAYER_2] || 0) * POPULATION_POINTS;
    }

    // Add trade route points
    if (tradeRouteState) {
      if (tradeRouteState[PLAYER_1]) {
        this.scores[PLAYER_1] += tradeRouteState[PLAYER_1].count * TRADE_ROUTE_POINTS;
        this.scores[PLAYER_1] += tradeRouteState[PLAYER_1].totalLength * TRADE_ROUTE_LENGTH_POINTS;
      }

      if (tradeRouteState[PLAYER_2]) {
        this.scores[PLAYER_2] += tradeRouteState[PLAYER_2].count * TRADE_ROUTE_POINTS;
        this.scores[PLAYER_2] += tradeRouteState[PLAYER_2].totalLength * TRADE_ROUTE_LENGTH_POINTS;
      }
    }

    // Add city points
    if (cityState) {
      if (cityState[PLAYER_1]) {
        this.scores[PLAYER_1] += cityState[PLAYER_1].count * CITY_POINTS;
      }
      if (cityState[PLAYER_2]) {
        this.scores[PLAYER_2] += cityState[PLAYER_2].count * CITY_POINTS;
      }
    }

    // Add resource points
    if (resourceState) {
      if (resourceState[PLAYER_1]) {
        this.scores[PLAYER_1] += resourceState[PLAYER_1].count * RESOURCE_POINTS;
      }
      if (resourceState[PLAYER_2]) {
        this.scores[PLAYER_2] += resourceState[PLAYER_2].count * RESOURCE_POINTS;
      }
    }

    // Add fishing village points
    if (fishingVillageState) {
      if (fishingVillageState[PLAYER_1]) {
        this.scores[PLAYER_1] += fishingVillageState[PLAYER_1].totalShoreline * FISHING_VILLAGE_POINTS;
      }
      if (fishingVillageState[PLAYER_2]) {
        this.scores[PLAYER_2] += fishingVillageState[PLAYER_2].totalShoreline * FISHING_VILLAGE_POINTS;
      }
    }

    return this.scores;
  }
  
  getScores() {
    return this.scores;
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
    this.currentFishingVillageState = null;
    this.globalWarmingChanceTracker = null; // Add globalWarmingChanceTracker for DI
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
  setCurrentFishingVillageState(currentFishingVillageState) {
    this.currentFishingVillageState = currentFishingVillageState;
    return this;
  }

  setGlobalWarmingChanceTracker(globalWarmingChanceTracker) {
    this.globalWarmingChanceTracker = globalWarmingChanceTracker;
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
