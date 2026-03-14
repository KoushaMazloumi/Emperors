/**
 * main.mjs — Application Wiring (Composition Root)
 *
 * Assembles all architectural components:
 * - GameEngine: Pure, DOM-free game state machine
 * - RendererAdapter: Bridges engine events to DOM rendering
 * - InputHandler: Captures user input and routes to engine
 * - NetworkManager: PeerJS multiplayer connectivity
 * - MultiplayerUI: Controls for creating/joining rooms (if implemented)
 *
 * Entry point: runs on DOMContentLoaded
 */

import GameEngine from "./GameEngine.mjs";
import RendererAdapter from "./RendererAdapter.mjs";
import InputHandler from "./InputHandler.mjs";
import NetworkManager from "./NetworkManager.mjs";
import MultiplayerUI from "./MultiplayerUI.mjs";
import { initFlagSelectors, MovePreviewRenderer, RenderManager } from "./UIManagement.mjs";

document.addEventListener("DOMContentLoaded", () => {
  // ─── 1. Create GameEngine with default feature flags ──────────────
  const gameEngine = new GameEngine({
    featureFlags: {
      globalWarming: true,
      tradeRoutes: true,
      cities: true,
      fishingVillages: true,
      blockades: true,
    },
  });

  // ─── 2. Get DOM references ────────────────────────────────────────
  const gridContainer = document.getElementById("game-board");
  if (!gridContainer) {
    console.error("main.mjs: game-board container not found in DOM");
    return;
  }

  // Button references
  const buttons = {
    rotateButton: document.getElementById("rotate-button"),
    undoButton: document.getElementById("undo-button"),
    autoplaceButton: document.getElementById("autoplace-button"),
    autoplaceAllButton: document.getElementById("autoplace-all-button"),
  };

  // Feature flag checkboxes
  const checkboxes = {
    checkGlobalWarming: document.getElementById("checkGlobalWarming"),
    checkTradeRoutes: document.getElementById("checkTradeRoutes"),
    checkCities: document.getElementById("checkCities"),
    checkFishingVillages: document.getElementById("checkFishingVillages"),
    checkBlockades: document.getElementById("checkBlockades"),
  };

  // ─── 3. Create RendererAdapter (connects engine events to DOM) ─────
  const rendererAdapter = new RendererAdapter(gameEngine, gridContainer);

  // ─── 4. Create InputHandler (routes user input to engine) ─────────
  /**
   * Move preview callback: when user hovers over a cell,
   * InputHandler calls this to show a preview.
   * Uses MovePreviewRenderer to display piece placement previews during hover.
   */
  const movePreviewRenderer = new MovePreviewRenderer();
  const previewRenderManager = new RenderManager(gameEngine.getGameBoard());
  previewRenderManager.gridContainer = gridContainer;

  const onMovePreview = (details) => {
    // Build StrategyDetails for the preview renderer
    const { cellElement, row, col, preview, gameEngine: engine } = details;

    // Get the current map piece (if in map phase) for piece information
    const mapPiece = engine.getGameBoard().getSingleMapPiece(engine.getCurrentMapPieceIndex());

    // Build preview details for MovePreviewRenderer
    const previewDetails = {
      cellElement,
      piece: mapPiece,
      toggleFlag: preview,
      gamePhase: engine.getGamePhase(),
      currentPlayer: engine.getCurrentPlayer(),
    };

    // Render the preview using the strategy pattern
    movePreviewRenderer.performStrategy(previewRenderManager, previewDetails);
  };

  const inputHandler = new InputHandler(
    gameEngine,
    gridContainer,
    buttons,
    checkboxes,
    onMovePreview
  );

  // ─── 5. Create NetworkManager (multiplayer via PeerJS) ────────────
  const networkManager = new NetworkManager(gameEngine, {
    onPeerOpen: (peerId) => {
      console.log("Peer opened:", peerId);
    },
    onConnection: () => {
      console.log("Connected to peer");
    },
    onDisconnection: () => {
      console.log("Disconnected from peer");
    },
    onError: (error) => {
      console.error("Network error:", error);
    },
    onGameInit: (state, assignedPlayer) => {
      console.log("Game initialized, assigned player:", assignedPlayer);
    },
    onStateUpdate: (state) => {
      console.log("State updated from peer");
    },
    onMoveRejected: (reason) => {
      console.error("Move rejected:", reason);
    },
    onGuestConnected: () => {
      console.log("Guest connected");
    },
  });

  // ─── 6. Initialize flag selectors ────────────────────────────────
  /**
   * initFlagSelectors expects an object with a refreshDisplay() method.
   * Create a wrapper that refreshes the display when flags change.
   */
  const flagDisplayWrapper = {
    refreshDisplay: () => {
      // Trigger a re-render of the current game state
      // The engine state hasn't changed, but the displayed player names have
      const state = gameEngine.getState();
      const details = rendererAdapter.buildStrategyDetails(state);
      rendererAdapter.renderFull(details);
    },
  };

  initFlagSelectors(flagDisplayWrapper);

  // ─── 7. Feature flag checkboxes handled by InputHandler ──────────────
  // InputHandler attaches 'change' listeners to checkboxes and calls
  // this.syncFeatureFlagsToEngine() to update the engine.
  // Initial flags are set in GameEngine constructor above.

  // ─── 8. Create and initialize MultiplayerUI ──────────────────────
  const multiplayerUI = new MultiplayerUI(
    networkManager,
    inputHandler,
    gameEngine,
    {
      createRoomButton: document.getElementById("create-room-button"),
      joinRoomInput: document.getElementById("join-room-input"),
      joinRoomButton: document.getElementById("join-room-button"),
      roomCodeDisplay: document.getElementById("room-code-display"),
      roomCodeValue: document.getElementById("room-code-value"),
      connectionStatus: document.getElementById("connection-status"),
      connectionStatusText: document.getElementById("connection-status-text"),
      playerRoleDisplay: document.getElementById("player-role-display"),
      disconnectButton: document.getElementById("disconnect-button"),
    }
  );

  multiplayerUI.initialize();

  // ─── 9. Initialize and start the game ────────────────────────────
  gameEngine.initialize();
});
