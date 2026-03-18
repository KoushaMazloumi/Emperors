import { MAP_PHASE, STONE_PHASE } from "./Constants.mjs";

/**
 * InputHandler — Captures and routes all user input to GameEngine
 *
 * Responsibilities:
 *   - Captures grid clicks, hover, and button clicks
 *   - Extracts coordinates from DOM dataset
 *   - Routes to appropriate GameEngine action methods
 *   - Reads feature flag checkboxes and applies configuration
 *   - Implements blockade vs stone decision routing based on DOM state
 *   - Maintains processing lock to prevent double-clicks
 *   - Communicates move previews to renderer (via callback)
 *
 * What it does NOT do:
 *   - Game logic validation (GameEngine handles)
 *   - DOM rendering (RendererAdapter handles)
 *   - StrategyDetails construction (done internally or by GameEngine)
 */
export default class InputHandler {
  /**
   * @param {GameEngine} gameEngine - The game engine instance
   * @param {HTMLElement} gridContainer - The grid container element
   * @param {Object} buttons - Button element references
   * @param {HTMLElement} buttons.rotateButton - Rotate button element
   * @param {HTMLElement} buttons.undoButton - Undo button element
   * @param {HTMLElement} buttons.autoplaceButton - Autoplace button element
   * @param {HTMLElement} buttons.autoplaceAllButton - Autoplace all button element
   * @param {Object} checkboxes - Feature flag checkbox references
   * @param {HTMLElement} checkboxes.checkGlobalWarming - Global warming checkbox
   * @param {HTMLElement} checkboxes.checkTradeRoutes - Trade routes checkbox
   * @param {HTMLElement} checkboxes.checkCities - Cities checkbox
   * @param {HTMLElement} checkboxes.checkFishingVillages - Fishing villages checkbox
   * @param {HTMLElement} checkboxes.checkBlockades - Blockades checkbox
   * @param {Function} [onMovePreview] - Optional callback for move preview updates
   */
  constructor(
    gameEngine,
    gridContainer,
    buttons = {},
    checkboxes = {},
    onMovePreview = null
  ) {
    this.gameEngine = gameEngine;
    this.gridContainer = gridContainer;
    this.rotateButton = buttons.rotateButton;
    this.undoButton = buttons.undoButton;
    this.autoplaceButton = buttons.autoplaceButton;
    this.autoplaceAllButton = buttons.autoplaceAllButton;

    this.checkGlobalWarming = checkboxes.checkGlobalWarming;
    this.checkTradeRoutes = checkboxes.checkTradeRoutes;
    this.checkCities = checkboxes.checkCities;
    this.checkFishingVillages = checkboxes.checkFishingVillages;
    this.checkBlockades = checkboxes.checkBlockades;

    this.onMovePreview = onMovePreview;

    // Processing lock to prevent double-clicks and concurrent mutations
    this.isProcessing = false;

    // Disabled state for multiplayer (when it's not your turn)
    this.isDisabled = false;

    // Multiplayer state: set via setMultiplayerRole()
    this.multiplayerRole = null; // 'host', 'guest', or null
    this.networkManager = null;

    // Bound handler for game-updated events (for cleanup if needed)
    this._gameUpdatedHandler = null;

    // Attach all event listeners
    this.attachEventListeners();

    // Initialize button states
    this.updateButtonStates();

    // Subscribe to engine's game-updated event to sync button states and checkboxes
    this._subscribeToEngineEvents();
  }

  // ─── Multiplayer Role Management ────────────────────────────

  /**
   * Set the multiplayer role and network manager reference.
   * Called by main.mjs when multiplayer is initialized.
   * @param {string|null} role - 'host', 'guest', or null for local-only
   * @param {NetworkManager|null} networkManager - NetworkManager instance (required if role is 'host' or 'guest')
   */
  setMultiplayerRole(role, networkManager) {
    this.multiplayerRole = role; // 'host', 'guest', or null
    this.networkManager = networkManager;
  }

  // ─── Engine Event Subscription ──────────────────────────────

  /**
   * Subscribe to GameEngine events to sync UI state.
   * When state changes via network sync (applyState → game-updated event),
   * or after any move (move-applied event), update button states and sync checkboxes.
   * @private
   */
  _subscribeToEngineEvents() {
    if (!this.gameEngine || !this.gameEngine.emitter) return;

    this._gameUpdatedHandler = () => {
      // Update button states to reflect any phase/turn changes
      this.updateButtonStates();
      // Sync checkboxes to reflect feature flags from engine
      this.syncCheckboxesFromEngine();
    };

    this.gameEngine.emitter.on("game-updated", this._gameUpdatedHandler);
    this.gameEngine.emitter.on("move-applied", this._gameUpdatedHandler);
  }

  // ─── Event Attachment ────────────────────────────────────────

  /**
   * Attach all event listeners (grid, buttons, checkboxes)
   */
  attachEventListeners() {
    // Grid click and hover
    if (this.gridContainer) {
      this.gridContainer.addEventListener("click", (event) => {
        const cellElement = event.target.closest(".cell");
        if (cellElement) {
          this.handleGridClick(cellElement);
        }
      });

      this.gridContainer.addEventListener("mouseover", (event) => {
        const cellElement = event.target.closest(".cell");
        if (cellElement) {
          this.handleGridHoverEnter(cellElement);
        }
      });

      this.gridContainer.addEventListener("mouseout", (event) => {
        const cellElement = event.target.closest(".cell");
        if (cellElement) {
          this.handleGridHoverLeave(cellElement);
        }
      });
    }

    // Button clicks
    if (this.rotateButton) {
      this.rotateButton.addEventListener("click", () => {
        this.handleRotate();
      });
    }

    if (this.undoButton) {
      this.undoButton.addEventListener("click", () => {
        this.handleUndo();
      });
    }

    if (this.autoplaceButton) {
      this.autoplaceButton.addEventListener("click", () => {
        this.handleAutoplace();
      });
    }

    if (this.autoplaceAllButton) {
      this.autoplaceAllButton.addEventListener("click", () => {
        this.handleAutoplaceAll();
      });
    }

    // Feature flag checkboxes — update engine config when changed
    const checkboxes = [
      this.checkGlobalWarming,
      this.checkTradeRoutes,
      this.checkCities,
      this.checkFishingVillages,
      this.checkBlockades,
    ];

    checkboxes.forEach((checkbox) => {
      if (checkbox) {
        checkbox.addEventListener("change", () => {
          this.syncFeatureFlagsToEngine();
        });
      }
    });
  }

  // ─── Grid Click Handler ──────────────────────────────────────

  /**
   * Handle grid cell click — extract coordinates and route to appropriate action
   * @param {HTMLElement} cellElement - The clicked cell element
   */
  handleGridClick(cellElement) {
    if (this.isProcessing || this.isDisabled) return;

    // Defense-in-depth: host cannot act during guest's turn
    if (this.multiplayerRole === 'host') {
      const currentPlayer = this.gameEngine.getCurrentPlayer();
      if (currentPlayer !== 'p1') return;
    }

    const row = parseInt(cellElement.dataset.row);
    const col = parseInt(cellElement.dataset.col);

    // Validate coordinates
    if (isNaN(row) || isNaN(col)) {
      console.warn("Invalid cell coordinates:", cellElement.dataset);
      return;
    }

    // Route to action based on current game phase
    const gamePhase = this.gameEngine.getGamePhase();

    if (gamePhase === MAP_PHASE) {
      if (this.multiplayerRole === 'guest') {
        // Guest: send move request to host
        this.networkManager.sendMoveRequest('placeMapPiece', { x: col, y: row });
      } else {
        // Local or host: execute directly
        this.gameEngine.placeMapPiece({ x: col, y: row });
      }
    } else if (gamePhase === STONE_PHASE) {
      if (this.multiplayerRole === 'guest') {
        // Guest: always send placeStone — host routes to blockade if appropriate
        // (host has authoritative featureFlags; guest's local checkbox may be stale)
        this.networkManager.sendMoveRequest('placeStone', { x: col, y: row });
      } else {
        // Local or host: decide blockade vs stone locally
        const blockadeEnabled = this.checkBlockades?.checked ?? false;
        const grid = this.gameEngine.getGrid();
        const cell = grid[row][col];

        if (cell === null && blockadeEnabled) {
          this.gameEngine.placeBlockade({ x: col, y: row });
        } else {
          this.gameEngine.placeStone({ x: col, y: row });
        }
      }
    }

    // Update button states after action
    this.updateButtonStates();
  }

  // ─── Grid Hover Handlers ─────────────────────────────────────

  /**
   * Handle grid cell hover enter — prepare move preview
   * @param {HTMLElement} cellElement - The hovered cell element
   */
  handleGridHoverEnter(cellElement) {
    const row = parseInt(cellElement.dataset.row);
    const col = parseInt(cellElement.dataset.col);

    // Validate coordinates
    if (isNaN(row) || isNaN(col)) {
      return;
    }

    // Visual feedback: add class
    cellElement.classList.add("hovered");

    // Call preview callback if provided
    if (this.onMovePreview) {
      this.onMovePreview({
        cellElement,
        row,
        col,
        preview: true,
        gameEngine: this.gameEngine,
      });
    }
  }

  /**
   * Handle grid cell hover leave — clear move preview
   * @param {HTMLElement} cellElement - The cell leaving hover
   */
  handleGridHoverLeave(cellElement) {
    const row = parseInt(cellElement.dataset.row);
    const col = parseInt(cellElement.dataset.col);

    // Visual feedback: remove class
    cellElement.classList.remove("hovered");

    // Call preview callback if provided
    if (this.onMovePreview) {
      this.onMovePreview({
        cellElement,
        row,
        col,
        preview: false,
        gameEngine: this.gameEngine,
      });
    }
  }

  // ─── Button Handlers ────────────────────────────────────────

  /**
   * Handle rotate button click
   */
  handleRotate() {
    if (this.isProcessing || this.isDisabled || this.rotateButton?.disabled) return;

    if (this.multiplayerRole === 'guest') {
      // Guest: send move request to host
      this.networkManager.sendMoveRequest('rotate', {});
    } else {
      // Local or host: execute directly
      this.gameEngine.rotate();
    }
    this.updateButtonStates();
  }

  /**
   * Handle undo button click
   */
  handleUndo() {
    if (this.isProcessing || this.isDisabled || this.undoButton?.disabled) return;

    if (this.multiplayerRole === 'guest') {
      // Guest: send move request to host
      this.networkManager.sendMoveRequest('undo', {});
    } else {
      // Local or host: execute directly
      this.gameEngine.undo();
    }
    this.updateButtonStates();
  }

  /**
   * Handle autoplace button click
   */
  handleAutoplace() {
    if (this.isProcessing || this.isDisabled || this.autoplaceButton?.disabled) return;

    if (this.multiplayerRole === 'guest') {
      // Guest: send move request to host
      this.networkManager.sendMoveRequest('autoplace', {});
    } else {
      // Local or host: execute directly
      this.isProcessing = true;
      this.autoplaceButton.disabled = true;

      try {
        this.gameEngine.autoplace();
      } catch (error) {
        console.error("Error during autoplace:", error);
      } finally {
        this.isProcessing = false;
        this.updateButtonStates();
      }
    }
  }

  /**
   * Handle autoplace all button click
   */
  handleAutoplaceAll() {
    if (this.isProcessing || this.isDisabled || this.autoplaceAllButton?.disabled) return;

    if (this.multiplayerRole === 'guest') {
      // Guest: send move request to host
      this.networkManager.sendMoveRequest('autoplaceAll', {});
    } else {
      // Local or host: execute directly
      this.isProcessing = true;
      this.autoplaceAllButton.disabled = true;

      try {
        this.gameEngine.autoplaceAll();
      } catch (error) {
        console.error("Error during autoplace all:", error);
      } finally {
        this.isProcessing = false;
        this.updateButtonStates();
      }
    }
  }

  // ─── Button State Management ─────────────────────────────────

  /**
   * Update enabled/disabled state of all buttons based on current game state
   */
  updateButtonStates() {
    this.updateRotateButtonState();
    this.updateAutoplaceButtonState();
    this.updateAutoplaceAllButtonState();
    this.updateUndoButtonState();
  }

  /**
   * Update autoplace button state: enabled only in map phase with pieces left
   */
  updateAutoplaceButtonState() {
    if (!this.autoplaceButton) return;

    const isMapPhase = this.gameEngine.getGamePhase() === MAP_PHASE;
    const hasMapPiecesLeft =
      this.gameEngine.getCurrentMapPieceIndex() <
      this.gameEngine.getAllMapPieces().length;

    const shouldEnable = isMapPhase && hasMapPiecesLeft;
    this.autoplaceButton.disabled = !shouldEnable;

    if (this.autoplaceButton.disabled) {
      this.autoplaceButton.classList.add("disabled");
    } else {
      this.autoplaceButton.classList.remove("disabled");
    }
  }

  /**
   * Update autoplace all button state: enabled only in map phase with 2+ pieces left
   */
  updateAutoplaceAllButtonState() {
    if (!this.autoplaceAllButton) return;

    const isMapPhase = this.gameEngine.getGamePhase() === MAP_PHASE;
    const currentIndex = this.gameEngine.getCurrentMapPieceIndex();
    const totalPieces = this.gameEngine.getAllMapPieces().length;
    const hasMultiplePiecesLeft = currentIndex < totalPieces - 1;

    const shouldEnable = isMapPhase && hasMultiplePiecesLeft;
    this.autoplaceAllButton.disabled = !shouldEnable;

    if (this.autoplaceAllButton.disabled) {
      this.autoplaceAllButton.classList.add("disabled");
    } else {
      this.autoplaceAllButton.classList.remove("disabled");
    }
  }

  /**
   * Update rotate button state: enabled only during map phase
   */
  updateRotateButtonState() {
    if (!this.rotateButton) return;

    const isMapPhase = this.gameEngine.getGamePhase() === MAP_PHASE;
    this.rotateButton.disabled = !isMapPhase;

    if (this.rotateButton.disabled) {
      this.rotateButton.classList.add("disabled");
    } else {
      this.rotateButton.classList.remove("disabled");
    }
  }

  /**
   * Update undo button state: enabled if undo stack is not empty
   */
  updateUndoButtonState() {
    if (!this.undoButton) return;

    const hasUndo = this.gameEngine.getUndoStackSize() > 0;
    this.undoButton.disabled = !hasUndo;

    if (this.undoButton.disabled) {
      this.undoButton.classList.add("disabled");
    } else {
      this.undoButton.classList.remove("disabled");
    }
  }

  // ─── Feature Flag Synchronization ────────────────────────────

  /**
   * Read feature flag checkboxes from DOM and apply to GameEngine
   */
  syncFeatureFlagsToEngine() {
    const flags = {
      globalWarming: this.checkGlobalWarming?.checked ?? true,
      tradeRoutes: this.checkTradeRoutes?.checked ?? true,
      cities: this.checkCities?.checked ?? true,
      fishingVillages: this.checkFishingVillages?.checked ?? true,
      blockades: this.checkBlockades?.checked ?? true,
    };

    this.gameEngine.setFeatureFlags(flags);
  }

  /**
   * Read feature flags from GameEngine and update DOM checkboxes.
   * Called when state changes via network sync to reflect remote feature flag state.
   */
  syncCheckboxesFromEngine() {
    const flags = this.gameEngine.getFeatureFlags();

    if (this.checkGlobalWarming) {
      this.checkGlobalWarming.checked = flags.globalWarming ?? true;
    }
    if (this.checkTradeRoutes) {
      this.checkTradeRoutes.checked = flags.tradeRoutes ?? true;
    }
    if (this.checkCities) {
      this.checkCities.checked = flags.cities ?? true;
    }
    if (this.checkFishingVillages) {
      this.checkFishingVillages.checked = flags.fishingVillages ?? true;
    }
    if (this.checkBlockades) {
      this.checkBlockades.checked = flags.blockades ?? true;
    }
  }

  // ─── Enable/Disable Input (for Multiplayer) ──────────────────

  /**
   * Enable all input handlers (grid clicks, buttons, etc.)
   */
  enable() {
    this.isDisabled = false;
    // Re-enable grid event listeners if they were attached
    if (this.gridContainer) {
      this.gridContainer.style.pointerEvents = "auto";
      this.gridContainer.style.opacity = "1";
    }
    // Update button states based on game state (respects game phase constraints)
    this.updateButtonStates();
  }

  /**
   * Disable all input handlers (grid clicks, buttons, etc.)
   * Used on guest side when it's not the guest's turn
   */
  disable() {
    this.isDisabled = true;
    // Disable grid clicks
    if (this.gridContainer) {
      this.gridContainer.style.pointerEvents = "none";
      this.gridContainer.style.opacity = "0.5";
    }
    // Disable buttons
    if (this.rotateButton) this.rotateButton.disabled = true;
    if (this.undoButton) this.undoButton.disabled = true;
    if (this.autoplaceButton) this.autoplaceButton.disabled = true;
    if (this.autoplaceAllButton) this.autoplaceAllButton.disabled = true;
  }
}
