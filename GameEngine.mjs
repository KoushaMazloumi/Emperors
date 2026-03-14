import {
  GRID_SIZE,
  PIECE_SHAPE_SIZE,
  PIECE_COUNT,
  PLAYER_1,
  PLAYER_2,
  MAX_UNDO,
  MAP_PHASE,
  STONE_PHASE,
} from "./Constants.mjs";

import {
  TurnManager,
  StrategyDetails,
  GlobalWarmingChanceTracker,
  ScoreTracker,
} from "./GameManagement.mjs";

import {
  BoardState,
  BoardStateSearcher,
  BoardStateEditor,
  EmperorCounter,
  UpdateEmperorStrategy,
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
  FishingVillageFinder,
  UpdateFishingVillageStrategy,
  ValidateBlockadePlacementStrategy,
  AddBlockadeStrategy,
} from "./BoardManagement.mjs";

import { MapPieceGenerator, MapPieceRotator } from "./MapPieces.mjs";
import EventEmitter from "./EventEmitter.mjs";
import GameState from "./GameState.mjs";

/**
 * GameEngine — Pure, DOM-free game state machine for Emperors
 *
 * Owns all authoritative game state and exposes action methods that:
 *   validate → save snapshot → mutate board → change turn → flag routine → emit events
 *
 * Zero document/window references. Can run headlessly in Node.js.
 * Feature flags are passed as configuration, not read from DOM.
 */
export default class GameEngine {
  /**
   * @param {Object} [options]
   * @param {Object} [options.featureFlags] - Feature toggle configuration
   * @param {boolean} [options.featureFlags.globalWarming=true]
   * @param {boolean} [options.featureFlags.tradeRoutes=true]
   * @param {boolean} [options.featureFlags.cities=true]
   * @param {boolean} [options.featureFlags.fishingVillages=true]
   * @param {boolean} [options.featureFlags.blockades=true]
   */
  constructor(options = {}) {
    // Event emitter for decoupled communication
    this.emitter = new EventEmitter();

    // Feature flags — configuration, not DOM reads
    this.featureFlags = {
      globalWarming: true,
      tradeRoutes: true,
      cities: true,
      fishingVillages: true,
      blockades: true,
      ...options.featureFlags,
    };

    // Core board state
    this.gameBoard = new BoardState(GRID_SIZE);
    this.gameBoardEditor = new BoardStateEditor(this.gameBoard);
    this.gameBoardSearcher = new BoardStateSearcher(this.gameBoard);
    this.moveValidator = new MoveValidator(this.gameBoard);

    // Map piece generation
    this.mapPieceGenerator = new MapPieceGenerator(PIECE_SHAPE_SIZE, PIECE_COUNT);
    this.mapPieceRotator = new MapPieceRotator();

    // Turn and phase management
    this.turnManager = new TurnManager();
    this.currentPlayer = PLAYER_1;
    this.currentMapPieceIndex = 0;

    // Scoring
    this.scoreTracker = new ScoreTracker();

    // Global warming state
    this.globalWarmingChanceTracker = new GlobalWarmingChanceTracker();
    this.globalWarmingEventFinder = new GlobalWarmingEventFinder();

    // Undo stack
    this.undoStack = [];

    // Cached computed state (populated by _flagRoutine, invalidated by applyState)
    this._cachedComputedState = null;

    // Strategy instances (reusable, stateless between calls)
    this._strategies = {
      validateMapPiece: new ValidateMapPiecePlacementStrategy(),
      validateStone: new ValidateStonePlacementStrategy(),
      validateBlockade: new ValidateBlockadePlacementStrategy(),
      validateRotation: new ValidateMapPieceRotationStrategy(),
      addMapPiece: new AddMapPieceStrategy(),
      addStone: new AddStoneStrategy(),
      addBlockade: new AddBlockadeStrategy(),
      addNaturalResource: new AddNaturalResourceStrategy(),
      emperorCounter: new EmperorCounter(),
      updateEmperor: new UpdateEmperorStrategy(),
      tradeRouteCounter: new TradeRouteCounter(),
      updateTradeRoute: new UpdateTradeRouteStrategy(),
      cityFinder: new CityFinder(),
      updateCity: new UpdateCityStrategy(),
      populationCounter: new PopulationCounter(),
      resourceCounter: new ResourceCounter(),
      peninsulaFinder: new PeninsulaFinder(),
      globalWarmingEventFinder: this.globalWarmingEventFinder,
      globalWarmingEventHandling: new GlobalWarmingEventHandlingStrategy(),
      fishingVillageFinder: new FishingVillageFinder(),
      updateFishingVillage: new UpdateFishingVillageStrategy(),
    };
  }

  // ─── Lifecycle ──────────────────────────────────────────────

  /**
   * Initialize a new game: generate map pieces, place natural resources.
   * Emits 'game-initialized' when complete.
   */
  initialize() {
    // Generate and set map pieces
    this.gameBoard.setMapPieces(this.mapPieceGenerator.initializeMapPieces());

    // Add natural resources via strategy
    const details = new StrategyDetails().build();
    this.gameBoardEditor.setStrategy(this._strategies.addNaturalResource);
    this.gameBoardEditor.performStrategy(details);

    this.emitter.emit("game-initialized", { state: this.getState() });
  }

  // ─── Action Methods ─────────────────────────────────────────

  /**
   * Place a map piece at the given coordinates.
   * @param {Object} params
   * @param {number} params.x - Column coordinate (click position)
   * @param {number} params.y - Row coordinate (click position)
   * @returns {boolean} Whether placement succeeded
   */
  placeMapPiece({ x, y }) {
    const piece = this.gameBoard.getSingleMapPiece(this.currentMapPieceIndex);
    const details = new StrategyDetails()
      .setPiece(piece)
      .setX(x)
      .setY(y)
      .setCurrentMapPieceIndex(this.currentMapPieceIndex)
      .setGamePhase(this.turnManager.gamePhase)
      .setTurn(this.turnManager.currentTurn)
      .setCurrentPlayer(this.currentPlayer)
      .build();

    // Validate
    this.moveValidator.setStrategy(this._strategies.validateMapPiece);
    if (!this.moveValidator.performStrategy(details)) {
      this.emitter.emit("move-rejected", {
        action: "placeMapPiece",
        reason: "Invalid map piece placement",
      });
      return false;
    }

    // Save snapshot for undo
    this._saveSnapshot();

    // Mutate board
    this.gameBoardEditor.setStrategy(this._strategies.addMapPiece);
    this.gameBoardEditor.performStrategy(details);

    // Change turn
    const turnResult = this._changeTurn();
    this._applyTurnChanges(turnResult, details);

    // Check phase transition
    const phaseChanged = this._checkPhaseTransition(details);

    // Render-layer events
    if (phaseChanged) {
      this.emitter.emit("phase-changed", {
        newPhase: this.turnManager.gamePhase,
        state: this.getState(),
      });
    }

    this.emitter.emit("move-applied", {
      action: "placeMapPiece",
      state: this.getState(),
      skippedPlayers: turnResult.skippedPlayers,
    });

    return true;
  }

  /**
   * Place a stone at the given coordinates.
   * @param {Object} params
   * @param {number} params.x - Column coordinate
   * @param {number} params.y - Row coordinate
   * @returns {boolean} Whether placement succeeded
   */
  placeStone({ x, y }) {
    const details = new StrategyDetails()
      .setX(x)
      .setY(y)
      .setGamePhase(this.turnManager.gamePhase)
      .setTurn(this.turnManager.currentTurn)
      .setCurrentPlayer(this.currentPlayer)
      .setCurrentMapPieceIndex(this.currentMapPieceIndex)
      .build();

    // Validate
    this.moveValidator.setStrategy(this._strategies.validateStone);
    if (!this.moveValidator.performStrategy(details)) {
      this.emitter.emit("move-rejected", {
        action: "placeStone",
        reason: "Invalid stone placement",
      });
      return false;
    }

    // Save snapshot for undo
    this._saveSnapshot();

    // Mutate board
    this.gameBoardEditor.setStrategy(this._strategies.addStone);
    this.gameBoardEditor.performStrategy(details);

    // Change turn
    const turnResult = this._changeTurn();
    this._applyTurnChanges(turnResult, details);

    // Flag routine (scoring, emperors, trade routes, etc.)
    this._flagRoutine(details);

    this.emitter.emit("move-applied", {
      action: "placeStone",
      state: this.getState(),
      skippedPlayers: turnResult.skippedPlayers,
    });

    return true;
  }

  /**
   * Place a blockade at the given coordinates.
   * @param {Object} params
   * @param {number} params.x - Column coordinate
   * @param {number} params.y - Row coordinate
   * @returns {boolean} Whether placement succeeded
   */
  placeBlockade({ x, y }) {
    if (!this.featureFlags.blockades) {
      this.emitter.emit("move-rejected", {
        action: "placeBlockade",
        reason: "Blockades feature is disabled",
      });
      return false;
    }

    const details = new StrategyDetails()
      .setX(x)
      .setY(y)
      .setGamePhase(this.turnManager.gamePhase)
      .setTurn(this.turnManager.currentTurn)
      .setCurrentPlayer(this.currentPlayer)
      .setCurrentMapPieceIndex(this.currentMapPieceIndex)
      .build();

    // Validate
    this.moveValidator.setStrategy(this._strategies.validateBlockade);
    if (!this.moveValidator.performStrategy(details)) {
      this.emitter.emit("move-rejected", {
        action: "placeBlockade",
        reason: "Invalid blockade placement",
      });
      return false;
    }

    // Save snapshot for undo
    this._saveSnapshot();

    // Mutate board
    this.gameBoardEditor.setStrategy(this._strategies.addBlockade);
    this.gameBoardEditor.performStrategy(details);

    // Schedule skip BEFORE changeTurn — changeTurn swaps player, then consumeSkipIfPending auto-fires
    this.turnManager.scheduleSkip(this.currentPlayer);

    // Change turn
    const turnResult = this._changeTurn();
    this._applyTurnChanges(turnResult, details);

    // Flag routine
    this._flagRoutine(details);

    this.emitter.emit("move-applied", {
      action: "placeBlockade",
      state: this.getState(),
      skippedPlayers: turnResult.skippedPlayers,
    });

    return true;
  }

  /**
   * Rotate the current map piece (map phase only).
   * @returns {boolean} Whether rotation succeeded
   */
  rotate() {
    const piece = this.gameBoard.getSingleMapPiece(this.currentMapPieceIndex);
    const details = new StrategyDetails()
      .setPiece(piece)
      .setGamePhase(this.turnManager.gamePhase)
      .setCurrentMapPieceIndex(this.currentMapPieceIndex)
      .build();

    this.moveValidator.setStrategy(this._strategies.validateRotation);
    if (!this.moveValidator.performStrategy(details)) {
      this.emitter.emit("move-rejected", {
        action: "rotate",
        reason: "Rotation not allowed in current phase",
      });
      return false;
    }

    this._saveSnapshot();
    this.mapPieceRotator.rotate(details);

    this.emitter.emit("game-updated", { state: this.getState() });
    return true;
  }

  /**
   * Undo the last action. Restores game state from the undo stack.
   * @returns {boolean} Whether undo succeeded
   */
  undo() {
    if (this.undoStack.length === 0) {
      return false;
    }

    // Capture who triggered undo before snapshot restore changes currentPlayer
    const undoneBy = this.currentPlayer;

    this._cachedComputedState = null;
    const snapshot = this.undoStack.pop();
    this._restoreSnapshot(snapshot);

    // Recalculate computed state after restore
    const details = new StrategyDetails()
      .setTurn(this.turnManager.currentTurn)
      .setCurrentPlayer(this.currentPlayer)
      .setGamePhase(this.turnManager.gamePhase)
      .setCurrentMapPieceIndex(this.currentMapPieceIndex)
      .build();
    this._recalculateDisplayData(details);

    this.emitter.emit("game-updated", {
      state: this.getState(),
      action: "undo",
      undoneBy,
    });
    return true;
  }

  /**
   * Attempt to automatically place the current map piece at a valid position.
   * Tries different positions and rotations until a valid placement is found.
   * @returns {boolean} Whether placement succeeded
   */
  autoplace() {
    const result = this._autoplaceMapPiece();
    if (result) {
      this.emitter.emit("move-applied", { state: this.getState() });
    }
    return result;
  }

  /**
   * Attempt to automatically place all remaining map pieces.
   * @returns {Object} Results: { success, placedCount, failedCount }
   */
  autoplaceAll() {
    return this._autoplaceAllMapPieces();
  }

  // ─── Configuration ──────────────────────────────────────────

  /**
   * Update feature flags at runtime.
   * @param {Object} flags - Partial feature flag update
   */
  setFeatureFlags(flags) {
    this.featureFlags = { ...this.featureFlags, ...flags };
    // Emit so NetworkManager broadcasts to guest and RendererAdapter re-renders
    this.emitter.emit("game-updated", { state: this.getState() });
  }

  // ─── State Accessors ────────────────────────────────────────

  /**
   * Get the current game phase.
   * @returns {string} "map" or "stone"
   */
  getGamePhase() {
    return this.turnManager.gamePhase;
  }

  /**
   * Get the current player.
   * @returns {string} PLAYER_1 or PLAYER_2
   */
  getCurrentPlayer() {
    return this.currentPlayer;
  }

  /**
   * Get the game board.
   * @returns {BoardState} The board state object
   */
  getGameBoard() {
    return this.gameBoard;
  }

  /**
   * Get the current grid state.
   * @returns {Array<Array>} 2D array of grid cells
   */
  getGrid() {
    return this.gameBoard.getGrid();
  }

  /**
   * Get all map pieces.
   * @returns {Array<MapPiece>} Array of map piece objects
   */
  getAllMapPieces() {
    return this.gameBoard.getAllMapPieces();
  }

  /**
   * Get the current map piece index.
   * @returns {number} Index of the piece being placed (map phase only)
   */
  getCurrentMapPieceIndex() {
    return this.currentMapPieceIndex;
  }

  /**
   * Get the size of the undo stack.
   * @returns {number} Number of snapshots available for undo
   */
  getUndoStackSize() {
    return this.undoStack.length;
  }

  /**
   * Check if the game is in the map phase.
   * @returns {boolean} True if current phase is "map", false otherwise
   */
  isMapPhase() {
    return this.turnManager.gamePhase === MAP_PHASE;
  }

  /**
   * Get the current feature flags configuration.
   * @returns {Object} Feature flags object
   */
  getFeatureFlags() {
    return this.featureFlags;
  }

  /**
   * Get a serializable snapshot of the full game state.
   * @returns {Object} GameStateSnapshot
   */
  getState() {
    // Use cached computed state if available (populated by _flagRoutine).
    // Fall back to recalculation only before first move.
    const computedState = this._cachedComputedState || this._recomputeState();

    return GameState.serialize({
      grid: this.gameBoard.getGrid(),
      mapPieces: this.gameBoard.getAllMapPieces(),
      currentTurn: this.turnManager.currentTurn,
      currentPlayer: this.currentPlayer,
      currentMapPieceIndex: this.currentMapPieceIndex,
      gamePhase: this.turnManager.gamePhase,
      featureFlags: this.featureFlags,
      globalWarming: {
        chance: this.globalWarmingChanceTracker.globalWarmingChance,
        removedPeninsulas: this.globalWarmingChanceTracker.removedPeninsulas,
        finderRemovedPeninsulas: this.globalWarmingEventFinder.removedPeninsulas,
      },
      pendingSkips: this.turnManager.pendingSkips,
      computedState: computedState,
    });
  }

  /**
   * Apply a full state snapshot (for guest-side network sync).
   * @param {Object} snapshot - GameStateSnapshot from getState()
   */
  applyState(snapshot) {
    if (!snapshot || typeof snapshot !== "object") {
      throw new Error("applyState: invalid snapshot");
    }
    if (typeof snapshot.currentPlayer !== "string" || ![PLAYER_1, PLAYER_2].includes(snapshot.currentPlayer)) {
      throw new Error("applyState: invalid currentPlayer");
    }
    if (typeof snapshot.gamePhase !== "string" || ![MAP_PHASE, STONE_PHASE].includes(snapshot.gamePhase)) {
      throw new Error("applyState: invalid gamePhase");
    }
    if (typeof snapshot.currentTurn !== "number" || snapshot.currentTurn < 0) {
      throw new Error("applyState: invalid currentTurn");
    }

    const restored = GameState.deserialize(snapshot);

    this.gameBoard.restoreGrid(restored.grid, restored.mapPieces);
    this.turnManager.currentTurn = restored.currentTurn;
    this.currentPlayer = restored.currentPlayer;
    this.currentMapPieceIndex = restored.currentMapPieceIndex;
    this.turnManager.gamePhase = restored.gamePhase;
    this.featureFlags = restored.featureFlags;
    this.turnManager.pendingSkips = restored.pendingSkips;

    if (restored.globalWarming) {
      this.globalWarmingChanceTracker.globalWarmingChance =
        restored.globalWarming.chance;
      this.globalWarmingChanceTracker.removedPeninsulas =
        restored.globalWarming.removedPeninsulas || [];
      this.globalWarmingEventFinder.removedPeninsulas =
        restored.globalWarming.finderRemovedPeninsulas || [];
    }

    // Invalidate cache so next getState() recalculates after state restore
    this._cachedComputedState = null;

    // Clear undo stack on network sync to prevent stale snapshots
    this.undoStack = [];

    // Emit re-serialized state for consistent format with other emitters
    this.emitter.emit("game-updated", { state: this.getState() });
  }

  // ─── Internal: Turn Management ──────────────────────────────

  /**
   * Call TurnManager.changeTurn with current state.
   * @returns {Object} Turn result from TurnManager
   * @private
   */
  _changeTurn() {
    return this.turnManager.changeTurn({
      currentPlayer: this.currentPlayer,
      currentMapPieceIndex: this.currentMapPieceIndex,
      totalMapPieces: this.gameBoard.getAllMapPieces().length,
      pendingSkips: this.turnManager.pendingSkips,
      currentTurn: this.turnManager.currentTurn,
    });
  }

  /**
   * Apply the result of TurnManager.changeTurn to engine state.
   * Pattern from Game.mjs _applyTurnChanges.
   * @param {Object} turnResult
   * @param {StrategyDetails} details
   * @private
   */
  _applyTurnChanges(turnResult, details) {
    this.currentPlayer = turnResult.newPlayer;
    this.currentMapPieceIndex = turnResult.newMapPieceIndex;
    this.turnManager.currentTurn = turnResult.newTurn;
    this.turnManager.pendingSkips = turnResult.newPendingSkips;
    this.turnManager.lastSkippedPlayers = turnResult.skippedPlayers;

    // Update details with new state (for downstream strategy use)
    details.setTurn(turnResult.newTurn);
    details.setCurrentPlayer(turnResult.newPlayer);
    details.setCurrentMapPieceIndex(turnResult.newMapPieceIndex);
  }

  /**
   * Check and apply phase transition (map → stone).
   * @param {StrategyDetails} details
   * @returns {boolean} Whether phase changed
   * @private
   */
  _checkPhaseTransition(details) {
    const newPhase = this.turnManager.checkPhase(this.turnManager.currentTurn);
    if (newPhase !== this.turnManager.gamePhase) {
      this.turnManager.gamePhase = newPhase;
      details.setGamePhase(newPhase);
      return true;
    }
    return false;
  }

  // ─── Internal: Flag/Scoring Routines ────────────────────────

  /**
   * Consolidates flag routines: peninsula, global warming, emperor, trade routes,
   * cities, population, resources, fishing villages, scoring.
   * Pattern from Game.mjs flagRoutine + _updateGameState.
   * @param {StrategyDetails} details
   * @private
   */
  _flagRoutine(details) {
    // Peninsula detection
    this.gameBoardSearcher.setStrategy(this._strategies.peninsulaFinder);
    details.setCurrentPeninsulaState(
      this.gameBoardSearcher.performStrategy(details)
    );

    // Global warming
    if (this.featureFlags.globalWarming) {
      details.setCurrentGlobalWarmingChance(
        this.globalWarmingChanceTracker.calculateChance(details)
      );

      // Pass tracker via details for DI
      details.setGlobalWarmingChanceTracker(this.globalWarmingChanceTracker);

      this.gameBoardSearcher.setStrategy(this._strategies.globalWarmingEventFinder);
      details.setRemovalCoordinates(
        this.gameBoardSearcher.performStrategy(details)
      );

      this.gameBoardEditor.setStrategy(this._strategies.globalWarmingEventHandling);
      this.gameBoardEditor.performStrategy(details);
    }

    // Update all game state (emperors, trade routes, cities, etc.)
    this._updateGameState(details);

    // Cache computed state to avoid re-running searchers in getState()
    this._cachedComputedState = {
      emperorState: details.currentEmperorState,
      tradeRouteState: details.currentTradeRouteState,
      cityState: details.currentCityState,
      populationState: details.currentPopulationState,
      resourceState: details.currentResourceState,
      fishingVillageState: details.currentFishingVillageState,
      scores: details.currentScores,
      peninsulaState: details.currentPeninsulaState,
    };

    // Build StrategyDetails after all setters
    details.build();
  }

  /**
   * Update all computed game state: emperors, trade routes, cities,
   * population, resources, fishing villages, scores.
   * Pattern from Game.mjs _updateGameState.
   * @param {StrategyDetails} details
   * @private
   */
  _updateGameState(details) {
    // Emperor counting and update
    this.gameBoardSearcher.setStrategy(this._strategies.emperorCounter);
    details.setCurrentEmperorState(this.gameBoardSearcher.performStrategy());

    this.gameBoardEditor.setStrategy(this._strategies.updateEmperor);
    this.gameBoardEditor.performStrategy(details);

    // Trade routes
    if (this.featureFlags.tradeRoutes) {
      this.gameBoardSearcher.setStrategy(this._strategies.tradeRouteCounter);
      details.setCurrentTradeRouteState(this.gameBoardSearcher.performStrategy());

      this.gameBoardEditor.setStrategy(this._strategies.updateTradeRoute);
      this.gameBoardEditor.performStrategy(details);
    }

    // Cities
    if (this.featureFlags.cities) {
      this.gameBoardSearcher.setStrategy(this._strategies.cityFinder);
      details.setCurrentCityState(this.gameBoardSearcher.performStrategy());

      this.gameBoardEditor.setStrategy(this._strategies.updateCity);
      this.gameBoardEditor.performStrategy(details);
    }

    // Population
    this.gameBoardSearcher.setStrategy(this._strategies.populationCounter);
    details.setCurrentPopulationState(
      this.gameBoardSearcher.performStrategy(details)
    );

    // Resources
    this.gameBoardSearcher.setStrategy(this._strategies.resourceCounter);
    details.setCurrentResourceState(
      this.gameBoardSearcher.performStrategy(details)
    );

    // Fishing villages
    if (this.featureFlags.fishingVillages) {
      this.gameBoardSearcher.setStrategy(this._strategies.fishingVillageFinder);
      details.setCurrentFishingVillageState(
        this.gameBoardSearcher.performStrategy(details)
      );

      this.gameBoardEditor.setStrategy(this._strategies.updateFishingVillage);
      this.gameBoardEditor.performStrategy(details);
    }

    // Calculate scores
    const scores = this.scoreTracker.calculateScores(
      details.currentEmperorState,
      details.currentTradeRouteState,
      details.currentCityState,
      details.currentPopulationState,
      details.currentResourceState,
      details.currentFishingVillageState
    );
    details.setCurrentScores(scores);
  }

  /**
   * Recompute derived state (READ-ONLY).
   * Performs read-only searches to gather computed state. Board mutations (emperor, trade route, city, fishing village markers) must be applied elsewhere (see _updateGameState).
   * @returns {Object} Computed state object
   * @private
   */
  _recomputeState() {
    const details = new StrategyDetails()
      .setTurn(this.turnManager.currentTurn)
      .setCurrentPlayer(this.currentPlayer)
      .setGamePhase(this.turnManager.gamePhase)
      .setCurrentMapPieceIndex(this.currentMapPieceIndex)
      .build();

    // Peninsula
    this.gameBoardSearcher.setStrategy(this._strategies.peninsulaFinder);
    const peninsulaState = this.gameBoardSearcher.performStrategy(details);
    details.setCurrentPeninsulaState(peninsulaState);

    // Emperor counting (read-only)
    this.gameBoardSearcher.setStrategy(this._strategies.emperorCounter);
    const emperorState = this.gameBoardSearcher.performStrategy();
    details.setCurrentEmperorState(emperorState);

    // Trade routes (read-only)
    let tradeRouteState = null;
    if (this.featureFlags.tradeRoutes) {
      this.gameBoardSearcher.setStrategy(this._strategies.tradeRouteCounter);
      tradeRouteState = this.gameBoardSearcher.performStrategy();
      details.setCurrentTradeRouteState(tradeRouteState);
    }

    // Cities (read-only)
    let cityState = null;
    if (this.featureFlags.cities) {
      this.gameBoardSearcher.setStrategy(this._strategies.cityFinder);
      cityState = this.gameBoardSearcher.performStrategy();
      details.setCurrentCityState(cityState);
    }

    // Population
    this.gameBoardSearcher.setStrategy(this._strategies.populationCounter);
    const populationState = this.gameBoardSearcher.performStrategy(details);
    details.setCurrentPopulationState(populationState);

    // Resources
    this.gameBoardSearcher.setStrategy(this._strategies.resourceCounter);
    const resourceState = this.gameBoardSearcher.performStrategy(details);
    details.setCurrentResourceState(resourceState);

    // Fishing villages (read-only)
    let fishingVillageState = null;
    if (this.featureFlags.fishingVillages) {
      this.gameBoardSearcher.setStrategy(this._strategies.fishingVillageFinder);
      fishingVillageState = this.gameBoardSearcher.performStrategy(details);
      details.setCurrentFishingVillageState(fishingVillageState);
    }

    // Scores
    const scores = this.scoreTracker.calculateScores(
      emperorState,
      tradeRouteState,
      cityState,
      populationState,
      resourceState,
      fishingVillageState
    );
    details.setCurrentScores(scores);

    return {
      emperorState,
      tradeRouteState,
      cityState,
      populationState,
      resourceState,
      fishingVillageState,
      scores,
      peninsulaState,
    };
  }

  // ─── Internal: Undo System ──────────────────────────────────

  /**
   * Save a snapshot of the current game state onto the undo stack.
   * Mirrors Game.mjs _saveSnapshot pattern.
   *
   * FORMAT: LOCAL UNDO SNAPSHOT
   * This creates a raw JSON-safe clone of game state for the undo stack.
   * Structure is optimized for quick save/restore without transformation.
   * Field mapping to network format (see GameState.serialize):
   *   - grid → grid (cells with mapPieceID integers)
   *   - mapPieces → mapPieces (raw MapPiece objects)
   *   - featureFlags → featureFlags (scoring toggle state at snapshot time)
   *   - gwTrackerPeninsulas → globalWarming.removedPeninsulas
   *   - gwFinderPeninsulas → globalWarming.finderRemovedPeninsulas
   *   - pendingSkips → pendingSkips
   *
   * NOTE: This format differs from the NETWORK SYNC format (GameState.serialize).
   * See GameState.mjs for the serialization contract used in network sync and guest-side restore.
   *
   * @private
   */
  _saveSnapshot() {
    if (this.undoStack.length >= MAX_UNDO) {
      this.undoStack.shift();
    }
    this.undoStack.push({
      grid: JSON.parse(JSON.stringify(this.gameBoard.getGrid())),
      mapPieces: JSON.parse(JSON.stringify(this.gameBoard.getAllMapPieces())),
      currentTurn: this.turnManager.currentTurn,
      currentPlayer: this.currentPlayer,
      currentMapPieceIndex: this.currentMapPieceIndex,
      gamePhase: this.turnManager.gamePhase,
      featureFlags: JSON.parse(JSON.stringify(this.featureFlags)),
      gwTrackerPeninsulas: JSON.parse(
        JSON.stringify(this.globalWarmingChanceTracker.removedPeninsulas)
      ),
      gwFinderPeninsulas: JSON.parse(
        JSON.stringify(this.globalWarmingEventFinder.removedPeninsulas)
      ),
      globalWarmingChance: this.globalWarmingChanceTracker?.globalWarmingChance ?? 0,
      pendingSkips: JSON.parse(JSON.stringify(this.turnManager.pendingSkips)),
    });
  }

  /**
   * Restore game state from a snapshot.
   * Mirrors Game.mjs _restoreSnapshot pattern.
   * @param {Object} snapshot
   * @private
   */
  _restoreSnapshot(snapshot) {
    this.gameBoard.restoreGrid(snapshot.grid, snapshot.mapPieces);
    this.turnManager.currentTurn = snapshot.currentTurn;
    this.currentPlayer = snapshot.currentPlayer;
    this.currentMapPieceIndex = snapshot.currentMapPieceIndex;
    this.turnManager.gamePhase = snapshot.gamePhase;
    if (snapshot.featureFlags) {
      this.featureFlags = snapshot.featureFlags;
    }
    this.globalWarmingChanceTracker.removedPeninsulas =
      snapshot.gwTrackerPeninsulas;
    this.globalWarmingEventFinder.removedPeninsulas =
      snapshot.gwFinderPeninsulas;
    if (snapshot.globalWarmingChance !== undefined) {
      this.globalWarmingChanceTracker.globalWarmingChance = snapshot.globalWarmingChance;
    }
    this.turnManager.pendingSkips = snapshot.pendingSkips || {
      [PLAYER_1]: 0,
      [PLAYER_2]: 0,
    };
    this.turnManager.lastSkippedPlayers = [];
  }

  /**
   * Recalculate display/computed data after state restore (e.g., undo).
   * Mirrors Game.mjs _recalculateDisplayData pattern.
   * @param {StrategyDetails} details
   * @private
   */
  _recalculateDisplayData(details) {
    this.gameBoardSearcher.setStrategy(this._strategies.peninsulaFinder);
    details.setCurrentPeninsulaState(
      this.gameBoardSearcher.performStrategy(details)
    );

    if (this.featureFlags.globalWarming) {
      details.setRemovedPeninsulas(this.globalWarmingEventFinder.removedPeninsulas);
      details.setCurrentGlobalWarmingChance(
        this.globalWarmingChanceTracker.calculateChance(details)
      );
    }

    this._updateGameState(details);
  }

  // ─── Internal: Autoplace ────────────────────────────────────

  /**
   * Auto-place the current map piece by trying positions and rotations.
   * Headless version — no mock DOM elements needed since validators
   * only read x/y from StrategyDetails, not from cellElement.
   * @param {boolean} [skipSnapshot=false] - Skip saving snapshot (used by autoplaceAll)
   * @returns {boolean} Whether placement succeeded
   * @private
   */
  _autoplaceMapPiece(skipSnapshot = false) {
    if (!skipSnapshot) this._saveSnapshot();

    const piece = this.gameBoard.getSingleMapPiece(this.currentMapPieceIndex);

    // Store original piece shape for potential restore
    const originalShape = JSON.parse(JSON.stringify(piece.shape));
    const originalRelativeSquareLocations = JSON.parse(
      JSON.stringify(piece.shapeRelativeSquareLocations)
    );

    const searchPositions = this._generateOptimizedSearchPositions();
    let success = false;

    try {
      // Try each rotation (0, 90, 180, 270)
      for (let rotation = 0; rotation < 4; rotation++) {
        if (rotation > 0) {
          const rotateDetails = new StrategyDetails()
            .setPiece(piece)
            .setGamePhase(this.turnManager.gamePhase)
            .setCurrentMapPieceIndex(this.currentMapPieceIndex)
            .build();
          this.mapPieceRotator.rotate(rotateDetails);
        }

        for (const pos of searchPositions) {
          const testDetails = new StrategyDetails()
            .setPiece(piece)
            .setX(pos.x)
            .setY(pos.y)
            .setCurrentMapPieceIndex(this.currentMapPieceIndex)
            .setGamePhase(this.turnManager.gamePhase)
            .build();

          this.moveValidator.setStrategy(this._strategies.validateMapPiece);
          if (this.moveValidator.performStrategy(testDetails)) {
            // Valid position found — place the piece
            const placeDetails = new StrategyDetails()
              .setPiece(piece)
              .setX(pos.x)
              .setY(pos.y)
              .setCurrentMapPieceIndex(this.currentMapPieceIndex)
              .setGamePhase(this.turnManager.gamePhase)
              .setTurn(this.turnManager.currentTurn)
              .setCurrentPlayer(this.currentPlayer)
              .build();

            this.gameBoardEditor.setStrategy(this._strategies.addMapPiece);
            this.gameBoardEditor.performStrategy(placeDetails);

            const turnResult = this._changeTurn();
            this._applyTurnChanges(turnResult, placeDetails);
            this._checkPhaseTransition(placeDetails);

            success = true;
            break;
          }
        }

        if (success) break;
      }

      if (!success) {
        if (!skipSnapshot) this.undoStack.pop();
        piece.shape = originalShape;
        piece.shapeRelativeSquareLocations = originalRelativeSquareLocations;
      }

      return success;
    } catch (error) {
      if (!skipSnapshot) this.undoStack.pop();
      piece.shape = originalShape;
      piece.shapeRelativeSquareLocations = originalRelativeSquareLocations;
      console.error("Error during autoplace:", error);
      return false;
    }
  }

  /**
   * Auto-place all remaining map pieces.
   * @returns {Object} { success, placedCount, failedCount }
   * @private
   */
  _autoplaceAllMapPieces() {
    // Intentional: single undo snapshot for entire batch autoplace.
    // Undoing will revert ALL auto-placed pieces at once, unlike individual placements.
    this._saveSnapshot();

    const totalPieces = this.gameBoard.getAllMapPieces().length;
    const initialPhase = this.turnManager.gamePhase;
    let placedCount = 0;
    let failedCount = 0;
    const maxIterations = totalPieces * 2; // Safety counter to prevent infinite loops
    let iterations = 0;

    try {
      while (this.currentMapPieceIndex < totalPieces && iterations < maxIterations) {
        iterations++;

        // Stop if phase changed (map → stone)
        if (this.turnManager.gamePhase !== initialPhase) {
          break;
        }

        const placed = this._autoplaceMapPiece(true);
        if (placed) {
          placedCount++;
        } else {
          failedCount++;
          break;
        }
      }

      // Warn if safety counter was exceeded
      if (iterations >= maxIterations) {
        console.warn(
          `autoplaceAllMapPieces: exceeded max iterations (${maxIterations}); ` +
          `piece index: ${this.currentMapPieceIndex}/${totalPieces}`
        );
      }

      if (placedCount === 0) {
        this.undoStack.pop();
      }

      this.emitter.emit("move-applied", { state: this.getState() });

      return { success: failedCount === 0 && placedCount > 0, placedCount, failedCount };
    } catch (error) {
      console.error("Error during autoplace all:", error);
      if (this.undoStack.length > 0) {
        const snapshot = this.undoStack.pop();
        this._restoreSnapshot(snapshot);
      }
      return {
        success: false,
        placedCount: 0,
        failedCount: totalPieces - this.currentMapPieceIndex,
      };
    }
  }

  /**
   * Generate optimized search positions for autoplace.
   * First piece: spiral from center. Subsequent: adjacent to existing pieces first.
   * Mirrors Game.mjs _generateOptimizedSearchPositions.
   * @returns {Array<{x: number, y: number}>}
   * @private
   */
  _generateOptimizedSearchPositions() {
    const grid = this.gameBoard.getGrid();
    const positions = [];

    if (this.currentMapPieceIndex === 0) {
      // First piece: spiral from center
      const centerX = Math.floor(GRID_SIZE / 2);
      const centerY = Math.floor(GRID_SIZE / 2);

      for (let radius = 0; radius < Math.ceil(GRID_SIZE / 2); radius++) {
        for (
          let y = Math.max(0, centerY - radius);
          y <= Math.min(GRID_SIZE - 1, centerY + radius);
          y++
        ) {
          for (
            let x = Math.max(0, centerX - radius);
            x <= Math.min(GRID_SIZE - 1, centerX + radius);
            x++
          ) {
            if (
              Math.max(Math.abs(x - centerX), Math.abs(y - centerY)) === radius
            ) {
              positions.push({ x, y });
            }
          }
        }
      }
    } else {
      // Subsequent pieces: prioritize positions adjacent to existing pieces
      const adjacentPositions = new Set();
      const allPositions = [];

      for (let y = 0; y < GRID_SIZE; y++) {
        for (let x = 0; x < GRID_SIZE; x++) {
          if (grid[y][x] !== null && grid[y][x].type === "mapPiece") {
            const adjDirections = [
              { dx: -1, dy: 0 },
              { dx: 1, dy: 0 },
              { dx: 0, dy: -1 },
              { dx: 0, dy: 1 },
            ];

            for (const dir of adjDirections) {
              const adjX = x + dir.dx;
              const adjY = y + dir.dy;

              if (
                adjX >= 0 &&
                adjX < GRID_SIZE &&
                adjY >= 0 &&
                adjY < GRID_SIZE &&
                grid[adjY][adjX] === null
              ) {
                const posKey = `${adjX},${adjY}`;
                if (!adjacentPositions.has(posKey)) {
                  adjacentPositions.add(posKey);
                  positions.push({ x: adjX, y: adjY });
                }
              }
            }
          }

          if (grid[y][x] === null) {
            allPositions.push({ x, y });
          }
        }
      }

      if (positions.length === 0) {
        return allPositions;
      }
    }

    return positions;
  }
}
