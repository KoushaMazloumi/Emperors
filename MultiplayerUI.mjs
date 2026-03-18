/**
 * MultiplayerUI — DOM controls and state management for multiplayer
 *
 * Responsibilities:
 *   - Manage room creation and joining (wires to NetworkManager.createRoom/joinRoom)
 *   - Display room code with copy-to-clipboard functionality
 *   - Display connection status with visual indicators (disconnected/connecting/connected)
 *   - Display player role assignment (Host: White / Guest: Black)
 *   - Wire disconnect button to NetworkManager.disconnect()
 *   - Listen to NetworkManager callbacks (onConnection, onDisconnection, onError, onGameInit)
 *   - Track current player and disable InputHandler when not player's turn (guest side only)
 *   - Subscribe to GameEngine events to update whose turn it is
 *
 * Connection Status States:
 *   - "disconnected" (red) — Initial state, or after disconnect/error
 *   - "connecting" (yellow) — During room creation or join attempt
 *   - "connected" (green) — Data connection open and ready
 */
export default class MultiplayerUI {
  /**
   * @param {NetworkManager} networkManager - Network manager instance
   * @param {InputHandler} inputHandler - Input handler instance (for disabling during guest's turn)
   * @param {GameEngine} gameEngine - Game engine instance (to subscribe to turn events)
   * @param {Object} domElements - DOM element references
   * @param {HTMLElement} domElements.createRoomButton - "Create Room" button
   * @param {HTMLElement} domElements.joinRoomInput - "Join Room" input field
   * @param {HTMLElement} domElements.joinRoomButton - "Join Room" button
   * @param {HTMLElement} domElements.roomCodeDisplay - Room code display area
   * @param {HTMLElement} domElements.roomCodeValue - Element where room code text goes
   * @param {HTMLElement} domElements.connectionStatus - Connection status indicator
   * @param {HTMLElement} domElements.connectionStatusText - Status text element
   * @param {HTMLElement} domElements.playerRoleDisplay - Player role display element
   * @param {HTMLElement} domElements.disconnectButton - "Disconnect" button
   */
  constructor(networkManager, inputHandler, gameEngine, domElements = {}) {
    this.networkManager = networkManager;
    this.inputHandler = inputHandler;
    this.gameEngine = gameEngine;

    // DOM references
    this.createRoomButton = domElements.createRoomButton;
    this.joinRoomInput = domElements.joinRoomInput;
    this.joinRoomButton = domElements.joinRoomButton;
    this.roomCodeDisplay = domElements.roomCodeDisplay;
    this.roomCodeValue = domElements.roomCodeValue;
    this.connectionStatus = domElements.connectionStatus;
    this.connectionStatusText = domElements.connectionStatusText;
    this.playerRoleDisplay = domElements.playerRoleDisplay;
    this.disconnectButton = domElements.disconnectButton;

    // Current player tracking
    this._currentPlayer = null;
    this._assignedPlayer = null;

    // Bound handlers for cleanup
    this._gameUpdateHandler = null;
    this._gameMoveAppliedHandler = null;
    this._gamePhaseChangedHandler = null;
    this._connectionHandler = null;
    this._disconnectionHandler = null;
  }

  /**
   * Initialize: attach event listeners, set up callbacks, initialize UI state.
   */
  initialize() {
    // Set up button event listeners
    if (this.createRoomButton) {
      this.createRoomButton.addEventListener("click", () =>
        this._handleCreateRoom()
      );
    }

    if (this.joinRoomButton) {
      this.joinRoomButton.addEventListener("click", () => this._handleJoinRoom());
    }

    if (this.disconnectButton) {
      this.disconnectButton.addEventListener("click", () =>
        this._handleDisconnect()
      );
    }

    // Allow Enter key to join room
    if (this.joinRoomInput) {
      this.joinRoomInput.addEventListener("keypress", (e) => {
        if (e.key === "Enter") {
          this._handleJoinRoom();
        }
      });
    }

    // Copy-to-clipboard for room code display
    if (this.roomCodeValue) {
      this.roomCodeValue.addEventListener("click", () =>
        this._copyRoomCodeToClipboard()
      );
    }

    // Set initial UI state
    this._updateConnectionStatus("disconnected");
    this._hideDisconnectButton();
    this._hideRoomCodeDisplay();
    this._updatePlayerRoleDisplay(null);

    // Subscribe to GameEngine turn/phase changes to track whose turn it is
    if (this.gameEngine) {
      this._gameUpdateHandler = (event) => {
        const state = event.state;
        if (state && state.currentPlayer) {
          this._currentPlayer = state.currentPlayer;
          this._updateInputHandlerState();
        }
      };
      this.gameEngine.emitter.on("game-updated", this._gameUpdateHandler);

      // Subscribe to move-applied events (placeMapPiece, placeStone, placeBlockade)
      this._gameMoveAppliedHandler = (event) => {
        const state = event.state;
        if (state && state.currentPlayer) {
          this._currentPlayer = state.currentPlayer;
          this._updateInputHandlerState();
        }
      };
      this.gameEngine.emitter.on("move-applied", this._gameMoveAppliedHandler);

      // Also subscribe to phase changes
      this._gamePhaseChangedHandler = (event) => {
        if (event.state && event.state.currentPlayer) {
          this._currentPlayer = event.state.currentPlayer;
          this._updateInputHandlerState();
        }
      };
      this.gameEngine.emitter.on("phase-changed", this._gamePhaseChangedHandler);
    }

    // Subscribe to NetworkManager events via its EventEmitter
    if (this.networkManager && this.networkManager.emitter) {
      // On connection established (for both host and guest)
      this.networkManager.emitter.on("connection-established", () => {
        this._updateConnectionStatus("connected");
        this._showDisconnectButton();
      });

      // On connection lost
      this.networkManager.emitter.on("connection-lost", () => {
        this._updateConnectionStatus("disconnected");
        this._hideDisconnectButton();
        this._hideRoomCodeDisplay();
        this._updatePlayerRoleDisplay(null);
        this._assignedPlayer = null;
        this._currentPlayer = null;
        // Reset InputHandler multiplayer role
        if (this.inputHandler) {
          if (this.networkManager.isHost) {
            // Keep host role — enforce turn restriction even when guest disconnected
            this._currentPlayer = "p1";
            this._updateInputHandlerState();
          } else {
            // Guest: reset to local play
            this.inputHandler.setMultiplayerRole(null, null);
            this.inputHandler.enable();
          }
        }
      });

      // On game init (guest receives initial state and player assignment)
      this.networkManager.emitter.on("game-init", (eventData) => {
        const { state, assignedPlayer } = eventData;
        this._assignedPlayer = assignedPlayer;
        this._updatePlayerRoleDisplay(assignedPlayer);
        // Wire InputHandler to route guest moves through network
        if (this.inputHandler && assignedPlayer === "p2") {
          this.inputHandler.setMultiplayerRole("guest", this.networkManager);
        }
        if (state && state.currentPlayer) {
          this._currentPlayer = state.currentPlayer;
          this._updateInputHandlerState();
        }
      });
    }
  }

  // ─── Button Handlers ──────────────────────────────────────────

  /**
   * Handle "Create Room" button click.
   * Generates a room code, shows it, and initializes as host.
   */
  async _handleCreateRoom() {
    const roomCode = this.networkManager.constructor.generateRoomCode();

    this._updateConnectionStatus("connecting");
    this._disableCreateRoomButton();

    try {
      await this.networkManager.createRoom(roomCode);

      // Show the room code
      this._showRoomCodeDisplay(roomCode);
      this._assignedPlayer = "p1"; // Host is always player 1
      this._updatePlayerRoleDisplay("p1");
      this._currentPlayer = "p1";
      // Wire InputHandler to route guest moves through network
      if (this.inputHandler) {
        this.inputHandler.setMultiplayerRole("host", this.networkManager);
      }
    } catch (err) {
      console.error("[MultiplayerUI] Failed to create room:", err);
      this._updateConnectionStatus("disconnected");
      this._enableCreateRoomButton();
      alert(`Failed to create room: ${err.message}`);
    }
  }

  /**
   * Handle "Join Room" button click.
   * Reads the input field, validates, and initiates join.
   */
  async _handleJoinRoom() {
    const roomCode = (this.joinRoomInput.value || "").trim().toUpperCase();

    if (!roomCode) {
      alert("Please enter a room code");
      return;
    }

    this._updateConnectionStatus("connecting");
    this._disableJoinRoomButton();

    try {
      await this.networkManager.joinRoom(roomCode);
      // assignedPlayer will be set when game-init arrives
    } catch (err) {
      console.error("[MultiplayerUI] Failed to join room:", err);
      this._updateConnectionStatus("disconnected");
      this._enableJoinRoomButton();
      alert(`Failed to join room: ${err.message}`);
    }
  }

  /**
   * Handle "Disconnect" button click.
   */
  _handleDisconnect() {
    this.networkManager.disconnect();
    this._updateConnectionStatus("disconnected");
    this._hideDisconnectButton();
    this._hideRoomCodeDisplay();
    this._updatePlayerRoleDisplay(null);
    this._assignedPlayer = null;
    this._currentPlayer = null;
    this._enableCreateRoomButton();
    this._enableJoinRoomButton();
    if (this.inputHandler) {
      this.inputHandler.setMultiplayerRole(null, null);
      this.inputHandler.enable();
    }
  }

  // ─── UI State Updates ─────────────────────────────────────────

  /**
   * Update connection status indicator.
   * @param {string} status - "disconnected" | "connecting" | "connected"
   */
  _updateConnectionStatus(status) {
    if (!this.connectionStatus) return;

    // Remove all status classes
    this.connectionStatus.classList.remove(
      "multiplayer-status-disconnected",
      "multiplayer-status-connecting",
      "multiplayer-status-connected"
    );

    // Add appropriate class
    switch (status) {
      case "connecting":
        this.connectionStatus.classList.add("multiplayer-status-connecting");
        if (this.connectionStatusText)
          this.connectionStatusText.textContent = "Connecting...";
        break;
      case "connected":
        this.connectionStatus.classList.add("multiplayer-status-connected");
        if (this.connectionStatusText)
          this.connectionStatusText.textContent = "Connected";
        break;
      case "disconnected":
      default:
        this.connectionStatus.classList.add("multiplayer-status-disconnected");
        if (this.connectionStatusText)
          this.connectionStatusText.textContent = "Disconnected";
        break;
    }
  }

  /**
   * Show room code display with the given code.
   * @param {string} roomCode - The room code to display
   */
  _showRoomCodeDisplay(roomCode) {
    if (!this.roomCodeDisplay) return;
    this.roomCodeDisplay.style.display = "block";
    if (this.roomCodeValue) {
      this.roomCodeValue.textContent = roomCode;
      this.roomCodeValue.title = "Click to copy";
    }
  }

  /**
   * Hide room code display.
   */
  _hideRoomCodeDisplay() {
    if (!this.roomCodeDisplay) return;
    this.roomCodeDisplay.style.display = "none";
  }

  /**
   * Update player role display.
   * @param {string|null} assignedPlayer - "p1" | "p2" | null
   */
  _updatePlayerRoleDisplay(assignedPlayer) {
    if (!this.playerRoleDisplay) return;

    if (!assignedPlayer) {
      this.playerRoleDisplay.style.display = "none";
      return;
    }

    this.playerRoleDisplay.style.display = "block";

    const isHost = this.networkManager.isHost;
    const isGuest = this.networkManager.isGuest;

    let roleText = "";
    if (isHost && assignedPlayer === "p1") {
      roleText = "Host: White Stones";
    } else if (isGuest && assignedPlayer === "p2") {
      roleText = "Guest: Black Stones";
    } else {
      roleText = assignedPlayer === "p1" ? "White" : "Black";
    }

    this.playerRoleDisplay.textContent = roleText;
  }

  /**
   * Show disconnect button.
   */
  _showDisconnectButton() {
    if (!this.disconnectButton) return;
    this.disconnectButton.style.display = "inline-block";
  }

  /**
   * Hide disconnect button.
   */
  _hideDisconnectButton() {
    if (!this.disconnectButton) return;
    this.disconnectButton.style.display = "none";
  }

  /**
   * Disable "Create Room" button.
   */
  _disableCreateRoomButton() {
    if (!this.createRoomButton) return;
    this.createRoomButton.disabled = true;
  }

  /**
   * Enable "Create Room" button.
   */
  _enableCreateRoomButton() {
    if (!this.createRoomButton) return;
    this.createRoomButton.disabled = false;
  }

  /**
   * Disable "Join Room" button and input.
   */
  _disableJoinRoomButton() {
    if (!this.joinRoomButton) return;
    this.joinRoomButton.disabled = true;
    if (this.joinRoomInput) this.joinRoomInput.disabled = true;
  }

  /**
   * Enable "Join Room" button and input.
   */
  _enableJoinRoomButton() {
    if (!this.joinRoomButton) return;
    this.joinRoomButton.disabled = false;
    if (this.joinRoomInput) this.joinRoomInput.disabled = false;
  }

  /**
   * Copy room code to clipboard when clicked.
   */
  _copyRoomCodeToClipboard() {
    if (!this.roomCodeValue) return;

    const roomCode = this.roomCodeValue.textContent;
    if (!roomCode) return;

    navigator.clipboard
      .writeText(roomCode)
      .then(() => {
        // Visual feedback: change text briefly
        const originalText = this.roomCodeValue.textContent;
        this.roomCodeValue.textContent = "Copied!";
        setTimeout(() => {
          this.roomCodeValue.textContent = originalText;
        }, 1500);
      })
      .catch((err) => {
        console.error("[MultiplayerUI] Failed to copy room code:", err);
      });
  }

  // ─── Input Handling State ─────────────────────────────────────

  /**
   * Update InputHandler state based on whose turn it is.
   * On guest side: disable input if not your turn, enable if it is your turn.
   * On host side: always enabled (host controls their own moves).
   */
  _updateInputHandlerState() {
    if (!this.inputHandler) return;

    // Host: only allow input during host's turn
    if (this.networkManager.isHost) {
      if (this._currentPlayer === "p1") {
        this.inputHandler.enable();
        this._updateDisabledIndicator(false);
      } else {
        this.inputHandler.disable();
        this._updateDisabledIndicator(true);
      }
      return;
    }

    // Guest: only allow input during guest's turn
    if (this.networkManager.isGuest && this._assignedPlayer === "p2") {
      if (this._currentPlayer === "p2") {
        this.inputHandler.enable();
        this._updateDisabledIndicator(false);
      } else {
        this.inputHandler.disable();
        this._updateDisabledIndicator(true);
      }
    }
  }

  /**
   * Show/hide a visual indicator when input is disabled.
   * @param {boolean} isDisabled - Whether input is currently disabled
   */
  _updateDisabledIndicator(isDisabled) {
    // This could be implemented as a visual overlay or message
    // For now, we'll just log it
    if (isDisabled) {
      console.log("[MultiplayerUI] Waiting for your turn...");
    }
  }

  /**
   * Cleanup: unsubscribe from all event listeners.
   * Call this before destroying the MultiplayerUI instance.
   */
  destroy() {
    if (this.gameEngine && this.gameEngine.emitter) {
      if (this._gameUpdateHandler) {
        this.gameEngine.emitter.off("game-updated", this._gameUpdateHandler);
      }
      if (this._gameMoveAppliedHandler) {
        this.gameEngine.emitter.off("move-applied", this._gameMoveAppliedHandler);
      }
      if (this._gamePhaseChangedHandler) {
        this.gameEngine.emitter.off("phase-changed", this._gamePhaseChangedHandler);
      }
    }
  }
}
