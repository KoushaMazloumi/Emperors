/**
 * NetworkManager — PeerJS peer-to-peer connection manager for Emperors multiplayer
 *
 * Host/guest architecture where host runs the authoritative GameEngine.
 *
 * HOST flow:
 *   1. createRoom(roomCode) -> Peer with ID "emperors-{roomCode}"
 *   2. Waits for guest connection via peer.on('connection')
 *   3. On guest connect: sends game-init with serialized state + player assignment
 *   4. Subscribes to GameEngine move-applied/game-updated -> broadcasts game-update to guest
 *   5. On move-request from guest: calls engine action -> engine validates -> state auto-broadcasts
 *   6. Host's own moves go directly through GameEngine (local)
 *
 * GUEST flow:
 *   1. joinRoom(roomCode) -> Peer with auto-ID, connects to "emperors-{roomCode}"
 *   2. On game-init: receives state, calls gameEngine.applyState(state), stores assignedPlayer
 *   3. On game-update: calls gameEngine.applyState(state) to sync
 *   4. On local input (own turn): sends move-request to host
 *   5. On move-ack with valid=false: invokes onMoveRejected callback
 *
 * Network Message Protocol:
 *   Host -> Guest: { type: 'game-init',   state: GameStateSnapshot, assignedPlayer: 'p1'|'p2' }
 *                  { type: 'move-ack',     valid: boolean, reason?: string }
 *                  { type: 'game-update',  state: GameStateSnapshot }
 *   Guest -> Host: { type: 'move-request', action: string, params: { x, y, player, pieceIndex } }
 *
 * Events emitted on the EventEmitter (optional, for decoupled UI updates):
 *   - 'peer-connected': Emitted when PeerJS peer is ready (arg: peerId)
 *   - 'peer-disconnected': Emitted when peer loses signaling connection
 *   - 'connection-established': Emitted when data connection is open (host or guest)
 *   - 'connection-lost': Emitted when data connection closes
 *   - 'game-init': Emitted when guest receives game-init (args: state, assignedPlayer)
 *   - 'game-update': Emitted when guest receives game-update (arg: state)
 *   - 'move-rejected': Emitted when guest's move is rejected (arg: reason)
 *
 * PeerJS is loaded via CDN as window.Peer — do NOT import it.
 */
import EventEmitter from "./EventEmitter.mjs";
import { GRID_SIZE } from "./Constants.mjs";

export default class NetworkManager {
  /**
   * Characters used for room code generation.
   * Excludes ambiguous characters: 0/O, 1/I/l
   * @type {string}
   */
  static #ROOM_CODE_CHARS = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

  /**
   * @param {import('./GameEngine.mjs').default} gameEngine - The game engine instance
   * @param {Object} [options] - Optional callbacks for UI updates (deprecated in favor of EventEmitter)
   * @param {Function} [options.onPeerOpen]         - Called when peer is ready: (peerId) => void
   * @param {Function} [options.onConnection]       - Called when connection established: () => void
   * @param {Function} [options.onDisconnection]    - Called when connection lost: () => void
   * @param {Function} [options.onError]            - Called on error: (error) => void
   * @param {Function} [options.onGameInit]         - Guest: called on game-init: (state, assignedPlayer) => void
   * @param {Function} [options.onStateUpdate]      - Called on game-update: (state) => void
   * @param {Function} [options.onMoveRejected]     - Guest: called on move-ack with valid=false: (reason) => void
   * @param {Function} [options.onGuestConnected]   - Host: called when guest connects: () => void
   * @param {EventEmitter} [options.eventEmitter]   - Optional EventEmitter for event publishing (if not provided, one is created)
   */
  constructor(gameEngine, options = {}) {
    this._gameEngine = gameEngine;
    this._options = options;

    /** @type {EventEmitter} Event emitter for publishing connection/game state events */
    this.emitter = options.eventEmitter || new EventEmitter();

    /** @type {Peer|null} PeerJS Peer instance */
    this._peer = null;

    /** @type {DataConnection|null} Active data connection */
    this._connection = null;

    /** @type {boolean} Whether this peer is the host */
    this._isHost = false;

    /** @type {boolean} Whether this peer is a guest */
    this._isGuest = false;

    /** @type {boolean} Whether the data connection is open */
    this._isConnected = false;

    /** @type {string|null} Which player this peer controls ('p1' or 'p2') */
    this._assignedPlayer = null;

    /** @type {Function|null} Bound handler for engine events (for cleanup) */
    this._engineUpdateHandler = null;

    /** @type {boolean} Flag indicating guest pending reconnection */
    this._pendingReconnect = false;
  }

  // ─── Public Getters ──────────────────────────────────────────

  /** @returns {boolean} Whether this peer is the host */
  get isHost() {
    return this._isHost;
  }

  /** @returns {boolean} Whether this peer is a guest */
  get isGuest() {
    return this._isGuest;
  }

  /** @returns {boolean} Whether the data connection is open */
  get isConnected() {
    return this._isConnected;
  }

  /** @returns {string|null} Which player this peer controls */
  get assignedPlayer() {
    return this._assignedPlayer;
  }

  // ─── Static Helpers ──────────────────────────────────────────

  /**
   * Generate a random 6-character alphanumeric room code.
   * Excludes ambiguous characters: 0/O, 1/I/l
   * Uses rejection sampling to avoid modulo bias.
   * @returns {string} 6-character room code
   */
  static generateRoomCode() {
    const chars = NetworkManager.#ROOM_CODE_CHARS;
    const charsLength = chars.length; // 30
    // We reject bytes >= 240, since 240 is the largest multiple of 30 that fits in 256
    const maxValidByte = Math.floor(256 / charsLength) * charsLength; // 240
    let code = "";

    while (code.length < 6) {
      let byte;
      do {
        // Get random byte and reject if it would cause bias
        byte = crypto.getRandomValues(new Uint8Array(1))[0];
      } while (byte >= maxValidByte);

      code += chars[byte % charsLength];
    }

    return code;
  }

  // ─── Host API ────────────────────────────────────────────────

  /**
   * Create a room as host. Creates a PeerJS Peer with ID "emperors-{roomCode}".
   * Resolves when the peer is open and ready for connections.
   *
   * @param {string} roomCode - The room code for this session
   * @returns {Promise<void>} Resolves when peer is open
   */
  createRoom(roomCode) {
    return new Promise((resolve, reject) => {
      this._isHost = true;
      this._isGuest = false;
      this._assignedPlayer = "p1"; // Host is always player 1

      const peerId = `emperors-${roomCode}`;

      const timeout = setTimeout(() => {
        reject(new Error("Room creation timed out after 15 seconds"));
      }, 15000);

      try {
        this._peer = new window.Peer(peerId);
      } catch (err) {
        clearTimeout(timeout);
        reject(new Error(`Failed to create Peer: ${err.message}`));
        return;
      }

      this._peer.on("open", (id) => {
        clearTimeout(timeout);
        console.log(`[NetworkManager] Host peer open with ID: ${id}`);
        this._invokeCallback("onPeerOpen", id);
        this.emitter.emit("peer-connected", id);

        // Listen for incoming guest connections
        this._peer.on("connection", (conn) => {
          this._handleHostIncomingConnection(conn);
        });

        resolve();
      });

      this._peer.on("error", (err) => {
        clearTimeout(timeout);
        console.error("[NetworkManager] Peer error:", err);
        this._invokeCallback("onError", err);

        // If the peer hasn't opened yet, reject the promise
        if (!this._peer || this._peer.disconnected) {
          if (err.type === "unavailable-id" || err.type === "invalid-id") {
            reject(new Error(`Room code unavailable: ${err.type}`));
          } else {
            reject(err);
          }
        }
      });

      this._peer.on("disconnected", () => {
        console.warn(
          "[NetworkManager] Host lost signaling server connection. Attempting reconnect..."
        );
        if (this._peer && !this._peer.destroyed) {
          this._peer.reconnect();
        }
      });
    });
  }

  // ─── Guest API ───────────────────────────────────────────────

  /**
   * Join a room as guest. Creates a PeerJS Peer with auto-ID, connects to the host.
   * Resolves when the data connection to the host is open.
   * Rejects if connection takes longer than 15 seconds.
   *
   * @param {string} roomCode - The room code to join
   * @returns {Promise<void>} Resolves when connected to host
   */
  joinRoom(roomCode) {
    return new Promise((resolve, reject) => {
      this._isHost = false;
      this._isGuest = true;

      const hostPeerId = `emperors-${roomCode}`;

      const timeout = setTimeout(() => {
        reject(new Error("Room join timed out after 15 seconds"));
        // Clean up peer on timeout
        if (this._peer && !this._peer.destroyed) {
          this._peer.destroy();
          this._peer = null;
        }
      }, 15000);

      try {
        // Auto-generated ID for guest
        this._peer = new window.Peer();
      } catch (err) {
        clearTimeout(timeout);
        reject(new Error(`Failed to create Peer: ${err.message}`));
        return;
      }

      this._peer.on("open", () => {
        console.log(
          `[NetworkManager] Guest peer open. Connecting to host: ${hostPeerId}`
        );
        this._invokeCallback("onPeerOpen", this._peer.id);
        this.emitter.emit("peer-connected", this._peer.id);

        const conn = this._peer.connect(hostPeerId, {
          serialization: "json",
          reliable: true,
        });

        conn.on("open", () => {
          clearTimeout(timeout);
          console.log("[NetworkManager] Guest connected to host.");
          this._connection = conn;
          this._isConnected = true;
          this._setupGuestMessageHandlers(conn);
          this._invokeCallback("onConnection");
          this.emitter.emit("connection-established");
          resolve();
        });

        conn.on("close", () => {
          clearTimeout(timeout);
          console.warn("[NetworkManager] Guest connection closed.");
          this._isConnected = false;
          this._connection = null;
          this._invokeCallback("onDisconnection");
          this.emitter.emit("connection-lost");
        });

        conn.on("error", (err) => {
          clearTimeout(timeout);
          console.error("[NetworkManager] Guest connection error:", err);
          this._invokeCallback("onError", err);
        });
      });

      this._peer.on("error", (err) => {
        clearTimeout(timeout);
        console.error("[NetworkManager] Peer error:", err);
        this._invokeCallback("onError", err);

        if (!this._isConnected) {
          reject(err);
        }
      });

      this._peer.on("disconnected", () => {
        console.warn(
          "[NetworkManager] Guest lost signaling server connection. Attempting reconnect..."
        );
        if (this._peer && !this._peer.destroyed) {
          this._peer.reconnect();
        }
        this.emitter.emit("peer-disconnected");
      });
    });
  }

  // ─── Guest Actions ───────────────────────────────────────────

  /**
   * Send a move request to the host. Only valid for guests.
   *
   * @param {string} action - The action name (e.g., 'placeStone', 'placeMapPiece')
   * @param {Object} params - Action parameters (x, y, player, pieceIndex, etc.)
   */
  sendMoveRequest(action, params) {
    if (!this._isGuest) {
      console.warn(
        "[NetworkManager] sendMoveRequest called on non-guest peer. Ignoring."
      );
      return;
    }

    if (!this._isConnected || !this._connection) {
      console.warn(
        "[NetworkManager] Cannot send move request: not connected."
      );
      return;
    }

    this._connection.send({
      type: "move-request",
      action: action,
      params: params,
    });
  }

  // ─── Lifecycle ───────────────────────────────────────────────

  /**
   * Clean shutdown: close connection, destroy peer, remove engine listeners.
   */
  disconnect() {
    // Remove engine event listeners
    if (this._engineUpdateHandler) {
      this._gameEngine.emitter.off("move-applied", this._engineUpdateHandler);
      this._gameEngine.emitter.off("game-updated", this._engineUpdateHandler);
      this._engineUpdateHandler = null;
    }

    // Close data connection
    if (this._connection) {
      this._connection.close();
      this._connection = null;
    }

    // Destroy peer
    if (this._peer) {
      this._peer.destroy();
      this._peer = null;
    }

    this._isConnected = false;
    this._isHost = false;
    this._isGuest = false;
    this._assignedPlayer = null;
  }

  // ─── Private: Host Connection Handling ───────────────────────

  /**
   * Handle an incoming guest connection on the host side.
   * Sets up message handlers and subscribes to engine events for broadcasting.
   *
   * @param {DataConnection} conn - The incoming data connection
   * @private
   */
  _handleHostIncomingConnection(conn) {
    // Only allow one guest connection at a time
    if (this._connection) {
      console.warn(
        "[NetworkManager] Host already has a guest. Rejecting new connection."
      );
      conn.close();
      return;
    }

    conn.on("open", () => {
      console.log("[NetworkManager] Guest connected to host.");
      this._connection = conn;
      this._isConnected = true;

      this._setupHostMessageHandlers(conn);
      this._subscribeToEngineEvents();

      this._invokeCallback("onConnection");
      this._invokeCallback("onGuestConnected");
      this.emitter.emit("connection-established");

      // Send game-init with current state and player assignment
      const initMessage = {
        type: "game-init",
        state: this._gameEngine.getState(),
        assignedPlayer: "p2", // Guest is always player 2
      };
      conn.send(initMessage);
      this._pendingReconnect = false;
    });

    conn.on("close", () => {
      console.warn("[NetworkManager] Guest disconnected from host.");
      this._isConnected = false;
      this._connection = null;
      this._pendingReconnect = true;
      this._unsubscribeFromEngineEvents();
      this._invokeCallback("onDisconnection");
      this.emitter.emit("connection-lost");
    });

    conn.on("error", (err) => {
      console.error(
        "[NetworkManager] Host connection error with guest:",
        err
      );
      this._invokeCallback("onError", err);
    });
  }

  // ─── Private: Message Handlers ───────────────────────────────

  /**
   * Set up host-side message handlers for data from the guest.
   * Handles: move-request
   *
   * @param {DataConnection} conn - The data connection to the guest
   * @private
   */
  _setupHostMessageHandlers(conn) {
    conn.on("data", (message) => {
      if (!message || typeof message !== "object") {
        console.warn("[NetworkManager] Host received invalid message:", message);
        return;
      }

      switch (message.type) {
        case "move-request":
          this._handleMoveRequest(message, conn);
          break;
        default:
          console.warn(
            "[NetworkManager] Host received unknown message type:",
            message.type
          );
      }
    });
  }

  /**
   * Set up guest-side message handlers for data from the host.
   * Handles: game-init, game-update, move-ack
   *
   * @param {DataConnection} conn - The data connection to the host
   * @private
   */
  _setupGuestMessageHandlers(conn) {
    conn.on("data", (message) => {
      if (!message || typeof message !== "object") {
        console.warn(
          "[NetworkManager] Guest received invalid message:",
          message
        );
        return;
      }

      switch (message.type) {
        case "game-init":
          this._handleGameInit(message);
          break;
        case "game-update":
          this._handleGameUpdate(message);
          break;
        case "move-ack":
          this._handleMoveAck(message);
          break;
        default:
          console.warn(
            "[NetworkManager] Guest received unknown message type:",
            message.type
          );
      }
    });
  }

  // ─── Private: Message Processing ─────────────────────────────

  /**
   * Host processes a move-request from the guest.
   * Dispatches to the appropriate GameEngine action method.
   * Sends move-ack on rejection; state update auto-broadcasts via engine events.
   *
   * @param {Object} message - { type: 'move-request', action: string, params: Object }
   * @param {DataConnection} conn - Connection to send ack back on
   * @private
   */
  _handleMoveRequest(message, conn) {
    const { action, params } = message;

    if (!action || typeof action !== "string") {
      conn.send({ type: "move-ack", valid: false, reason: "Invalid action" });
      return;
    }

    const GUEST_ALLOWED_ACTIONS = new Set(["placeMapPiece", "placeStone", "placeBlockade", "rotate", "undo", "autoplace", "autoplaceAll"]);
    if (!GUEST_ALLOWED_ACTIONS.has(action)) {
      conn.send({ type: "move-ack", valid: false, reason: "Action not permitted for guest" });
      return;
    }
    const currentPlayer = this._gameEngine.currentPlayer;
    if (currentPlayer !== "p2") {
      conn.send({ type: "move-ack", valid: false, reason: "Not your turn" });
      return;
    }

    if (["placeMapPiece", "placeStone", "placeBlockade"].includes(action)) {
      const x = Number(params?.x);
      const y = Number(params?.y);
      if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || x >= GRID_SIZE || y < 0 || y >= GRID_SIZE) {
        conn.send({ type: "move-ack", valid: false, reason: "Coordinates out of bounds" });
        return;
      }
    }

    let result = false;

    try {
      // GameEngine action methods use this.currentPlayer/currentMapPieceIndex
      // internally, so we only pass { x, y } where needed. rotate/undo/autoplace/
      // autoplaceAll take no arguments.
      switch (action) {
        case "placeMapPiece":
          result = this._gameEngine.placeMapPiece({
            x: params.x,
            y: params.y,
          });
          break;
        case "placeStone": {
          // Host-side blockade routing: if blockades enabled and cell is empty,
          // route to placeBlockade. Host's featureFlags are authoritative.
          const grid = this._gameEngine.getGrid();
          const cell = grid[params.y]?.[params.x];
          if (cell === null && this._gameEngine.featureFlags.blockades) {
            result = this._gameEngine.placeBlockade({
              x: params.x,
              y: params.y,
            });
          } else {
            result = this._gameEngine.placeStone({
              x: params.x,
              y: params.y,
            });
          }
          break;
        }
        case "placeBlockade":
          result = this._gameEngine.placeBlockade({
            x: params.x,
            y: params.y,
          });
          break;
        case "rotate":
          result = this._gameEngine.rotate();
          break;
        case "undo":
          // Guest undo operates on the host's shared undo stack.
          // During the guest's turn, the most recent entry is typically the guest's last move.
          // However, multiple consecutive undos may reach past the guest's moves into the host's prior moves.
          // This is intentional — the game uses a shared-history undo model (like hotseat play).
          // If per-player undo isolation is desired in the future, the undo stack would need
          // move ownership tracking.
          result = this._gameEngine.undo();
          break;
        case "autoplace":
          result = this._gameEngine.autoplace();
          break;
        case "autoplaceAll":
          result = this._gameEngine.autoplaceAll();
          break;
        default:
          conn.send({
            type: "move-ack",
            valid: false,
            reason: `Unknown action: ${action}`,
          });
          return;
      }
    } catch (err) {
      console.error(
        `[NetworkManager] Error processing move-request "${action}":`,
        err
      );
      conn.send({
        type: "move-ack",
        valid: false,
        reason: "Internal engine error",
      });
      return;
    }

    // Handle both boolean returns (placeMapPiece, placeStone, rotate, undo, autoplace)
    // and object returns (autoplaceAll returns { success, placedCount, failedCount })
    const isFailure = (typeof result === 'object' && result !== null) ? !result.success : !result;

    if (isFailure) {
      conn.send({
        type: "move-ack",
        valid: false,
        reason: `Move rejected by engine: ${action}`,
      });
    }
    // If result is true (or success: true for objects), the engine emitted events and the state update
    // will be broadcast automatically via _subscribeToEngineEvents.
    // We still send an ack so the guest knows the move was accepted.
    else {
      conn.send({ type: "move-ack", valid: true });
    }
  }

  /**
   * Guest processes game-init from host.
   * Applies the initial state and stores assigned player.
   *
   * @param {Object} message - { type: 'game-init', state: GameStateSnapshot, assignedPlayer: string }
   * @private
   */
  _handleGameInit(message) {
    const { state, assignedPlayer } = message;

    if (!state || !assignedPlayer) {
      console.error("[NetworkManager] Invalid game-init message:", message);
      return;
    }

    this._assignedPlayer = assignedPlayer;
    this._gameEngine.applyState(state);

    console.log(
      `[NetworkManager] Game initialized. Assigned player: ${assignedPlayer}`
    );
    this._invokeCallback("onGameInit", state, assignedPlayer);
    this.emitter.emit("game-init", { state, assignedPlayer });
  }

  /**
   * Guest processes game-update from host.
   * Applies the updated state.
   *
   * @param {Object} message - { type: 'game-update', state: GameStateSnapshot }
   * @private
   */
  _handleGameUpdate(message) {
    const { state } = message;

    if (!state) {
      console.error("[NetworkManager] Invalid game-update message:", message);
      return;
    }

    this._gameEngine.applyState(state);
    this._invokeCallback("onStateUpdate", state);
    this.emitter.emit("game-update", state);
  }

  /**
   * Guest processes move-ack from host.
   * If invalid, invokes onMoveRejected callback.
   *
   * @param {Object} message - { type: 'move-ack', valid: boolean, reason?: string }
   * @private
   */
  _handleMoveAck(message) {
    if (!message.valid) {
      console.warn(
        `[NetworkManager] Move rejected by host: ${message.reason || "unknown reason"}`
      );
      this._invokeCallback("onMoveRejected", message.reason);
      this.emitter.emit("move-rejected", message.reason);
    }
  }

  // ─── Private: Engine Event Subscription ──────────────────────

  /**
   * Subscribe to GameEngine events to broadcast state updates to the guest.
   * Only used on the host side.
   * @private
   */
  _subscribeToEngineEvents() {
    // Guard against double-subscription on reconnect
    if (this._engineUpdateHandler) {
      this._unsubscribeFromEngineEvents();
    }

    // Reuse the same handler for both events
    this._engineUpdateHandler = (eventData) => {
      if (this._isConnected && this._connection) {
        this._connection.send({
          type: "game-update",
          state: eventData.state,
        });
      }
    };

    this._gameEngine.emitter.on("move-applied", this._engineUpdateHandler);
    this._gameEngine.emitter.on("game-updated", this._engineUpdateHandler);
  }

  /**
   * Unsubscribe from GameEngine events.
   * @private
   */
  _unsubscribeFromEngineEvents() {
    if (this._engineUpdateHandler) {
      this._gameEngine.emitter.off("move-applied", this._engineUpdateHandler);
      this._gameEngine.emitter.off("game-updated", this._engineUpdateHandler);
      this._engineUpdateHandler = null;
    }
  }

  // ─── Private: Utility ────────────────────────────────────────

  /**
   * Safely invoke an optional callback from the options object.
   * Supports callbacks with variable number of arguments.
   *
   * @param {string} callbackName - The name of the callback in this._options
   * @param  {...any} args - Arguments to pass to the callback
   * @private
   */
  _invokeCallback(callbackName, ...args) {
    if (typeof this._options[callbackName] === "function") {
      try {
        this._options[callbackName](...args);
      } catch (err) {
        console.error(
          `[NetworkManager] Error in ${callbackName} callback:`,
          err
        );
      }
    }
  }
}
