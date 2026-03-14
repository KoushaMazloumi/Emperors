import {
  PLAYER_1,
  PLAYER_2,
} from "./Constants.mjs";
import {
  RenderManager,
  BoardRenderer,
  StatusRenderer,
  showSkipNotification,
} from "./UIManagement.mjs";
import { StrategyDetails } from "./GameManagement.mjs";

/**
 * RendererAdapter — Bridges GameEngine events to DOM rendering
 *
 * Subscribes to GameEngine.emitter events and orchestrates all DOM rendering
 * by wrapping existing renderer classes from UIManagement.mjs.
 *
 * Responsibilities:
 *   - Subscribe to gameEngine events: 'game-updated', 'game-initialized', 'move-applied'
 *   - Construct StrategyDetails from GameStateSnapshot
 *   - Call RenderManager with BoardRenderer and StatusRenderer strategies
 *   - Own the applyGlobalWarmingPulse logic (CSS animation for peninsula removal)
 *
 * Zero game logic. Pure rendering orchestration.
 */
export default class RendererAdapter {
  constructor(gameEngine, gridContainer) {
    if (!gameEngine) {
      throw new Error("RendererAdapter: gameEngine is required");
    }
    if (!gridContainer) {
      throw new Error("RendererAdapter: gridContainer element is required");
    }

    this.gameEngine = gameEngine;
    this.gridContainer = gridContainer;

    // Initialize render manager with game board state
    this.renderManager = new RenderManager(gameEngine.gameBoard);
    this.renderManager.gridContainer = gridContainer;

    // Renderer strategies
    this.boardRenderer = new BoardRenderer();
    this.statusRenderer = new StatusRenderer();

    // Active pulse animations tracking for global warming visualization
    this.activePulses = new Map();

    // Subscribe to GameEngine events
    this.gameEngine.emitter.on("game-initialized", (payload) => {
      this._handleGameInitialized(payload);
    });

    this.gameEngine.emitter.on("game-updated", (payload) => {
      this._handleGameUpdated(payload);
    });

    this.gameEngine.emitter.on("move-applied", (payload) => {
      this._handleMoveApplied(payload);
    });

    this.gameEngine.emitter.on("move-rejected", (payload) => {
      this._handleMoveRejected(payload);
    });

    this.gameEngine.emitter.on("phase-changed", (payload) => {
      this._handlePhaseChanged(payload);
    });
  }

  /**
   * Build StrategyDetails from engine state snapshot
   * Maps GameEngine.getState() fields to what BoardRenderer/StatusRenderer expect
   */
  buildStrategyDetails(state) {
    const details = new StrategyDetails()
      .setTurn(state.currentTurn)
      .setCurrentPlayer(state.currentPlayer)
      .setGamePhase(state.gamePhase);

    // Map computed state fields (emperors, trade routes, cities, etc.)
    if (state.computedState) {
      if (state.computedState.emperorState) {
        details.setCurrentEmperorState(state.computedState.emperorState);
      }
      if (state.computedState.tradeRouteState) {
        details.setCurrentTradeRouteState(state.computedState.tradeRouteState);
      }
      if (state.computedState.cityState) {
        details.setCurrentCityState(state.computedState.cityState);
      }
      if (state.computedState.populationState) {
        details.setCurrentPopulationState(state.computedState.populationState);
      }
      if (state.computedState.resourceState) {
        details.setCurrentResourceState(state.computedState.resourceState);
      }
      if (state.computedState.fishingVillageState) {
        details.setCurrentFishingVillageState(
          state.computedState.fishingVillageState
        );
      }
      if (state.computedState.scores) {
        details.setCurrentScores(state.computedState.scores);
      }
    }

    // Map global warming removed peninsulas for pulse effect
    if (state.globalWarming && state.globalWarming.finderRemovedPeninsulas) {
      details.setRemovedPeninsulas(state.globalWarming.finderRemovedPeninsulas);
    }

    return details.build();
  }

  /**
   * Handle game initialization — full render
   */
  _handleGameInitialized(payload) {
    const details = this.buildStrategyDetails(payload.state);
    this.renderFull(details);
  }

  /**
   * Handle game updated — re-render board and status
   */
  _handleGameUpdated(payload) {
    const details = this.buildStrategyDetails(payload.state);
    this.renderFull(details);

    // Show undo notification so both players know a move was reverted
    if (payload.action === "undo" && payload.undoneBy) {
      const playerName = payload.undoneBy === PLAYER_1 ? "Player 1 (White)" : "Player 2 (Black)";
      showSkipNotification([`${playerName} undid a move`]);
    }
  }

  /**
   * Handle move applied — re-render board and status, apply global warming pulse
   */
  _handleMoveApplied(payload) {
    const details = this.buildStrategyDetails(payload.state);

    // Re-render board and status
    this.renderFull(details);

    // Apply global warming pulse animation if peninsulas were removed
    if (payload.state.globalWarming && payload.state.globalWarming.finderRemovedPeninsulas &&
        payload.state.globalWarming.finderRemovedPeninsulas.length > 0) {
      this.applyGlobalWarmingPulse(payload.state.globalWarming.finderRemovedPeninsulas);
    }

    // Show skip notification if any players were skipped due to blockades
    if (payload.skippedPlayers && payload.skippedPlayers.length > 0) {
      showSkipNotification(payload.skippedPlayers);
    }
  }

  /**
   * Handle move rejected — provide user feedback
   */
  _handleMoveRejected(payload) {
    console.warn("Move rejected:", payload.reason || payload);
  }

  /**
   * Handle phase changed — full render
   */
  _handlePhaseChanged(payload) {
    const details = this.buildStrategyDetails(payload.state);
    this.renderFull(details);
  }

  /**
   * Perform full render: board + status
   */
  renderFull(details) {
    // Render board
    this.renderManager.setStrategy(this.boardRenderer);
    this.renderManager.performStrategy(details);

    // Render status sidebar
    this.renderManager.setStrategy(this.statusRenderer);
    this.renderManager.performStrategy(details);
  }

  /**
   * Apply red pulse effect to cells removed by global warming
   *
   * Extracted from Game.mjs applyGlobalWarmingPulse (lines 370-436).
   * Uses CSS animation with --pulse-iterations and --pulse-delay custom properties.
   * Each pulse runs for 3 seconds (3 iterations × 1s each).
   */
  applyGlobalWarmingPulse(removedPeninsulas) {
    const ANIMATION_DURATION = 3000; // 3 seconds total (3 iterations of 1s each)
    const now = Date.now();

    // Apply new pulses
    if (removedPeninsulas && Array.isArray(removedPeninsulas)) {
      removedPeninsulas.forEach(({ x, y, time }) => {
        const pulseKey = `${x},${y}`;

        // Skip if we've already started a pulse animation for this cell recently
        if (this.activePulses.has(pulseKey)) return;

        // Store the cell coordinates, start time, and end time for tracking
        const startTime = now;
        const endTime = startTime + ANIMATION_DURATION;
        this.activePulses.set(pulseKey, { x, y, startTime, endTime });

        // Apply the animation class with fresh animation
        const selector = `.cell[data-row="${y}"][data-col="${x}"]`;
        const cell = this.gridContainer.querySelector(selector);
        if (cell) {
          cell.classList.add("removed-peninsula");
          cell.style.setProperty("--pulse-iterations", "3");
          cell.style.setProperty("--pulse-delay", "0s");

          // Remove tracking after animation duration
          setTimeout(() => {
            this.activePulses.delete(pulseKey);
          }, ANIMATION_DURATION);
        }
      });
    }

    // Reapply animation to all active pulses with correct timing
    this.activePulses.forEach((pulse, key) => {
      if (now < pulse.endTime) {
        const selector = `.cell[data-row="${pulse.y}"][data-col="${pulse.x}"]`;
        const cell = this.gridContainer.querySelector(selector);
        if (cell) {
          // Calculate remaining time and iterations
          const elapsedMs = now - pulse.startTime;
          const remainingMs = pulse.endTime - now;

          // Each iteration is 1000ms (1s)
          const iterationProgress = (elapsedMs % 1000) / 1000;
          const completedIterations = Math.floor(elapsedMs / 1000);
          const remainingIterations = 3 - completedIterations;

          // Apply the animation with calculated timing
          cell.classList.add("removed-peninsula");
          cell.style.setProperty("--pulse-iterations", remainingIterations);

          // Set delay as negative value to start from the correct point in the animation
          const delayValue = -1 * iterationProgress + "s";
          cell.style.setProperty("--pulse-delay", delayValue);
        }
      } else {
        // Remove expired pulses
        this.activePulses.delete(key);
      }
    });
  }
}
