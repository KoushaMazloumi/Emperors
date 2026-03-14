import { GRID_SIZE } from "./Constants.mjs";

/**
 * GameState Serializer
 *
 * Encapsulates snapshot creation and restoration for undo stack and network sync.
 * Handles the serialization contract: grid cells reference MapPiece objects in memory,
 * but must serialize to JSON-safe structures (mapPieceID integers) for network transmission.
 *
 * Deserialization reconstructs MapPiece cross-references by matching cell.mapPieceID
 * against the mapPieces array, following the pattern from BoardStateEditor.getGrid
 * (BoardManagement.mjs:147-166).
 */
export default class GameState {
  /**
   * serialize(engineState) - Converts engine state to a JSON-safe snapshot
   *
   * FORMAT: NETWORK SYNC SNAPSHOT
   * This creates a serialized snapshot for network transmission and guest-side restore.
   * All grid cells contain mapPieceID integers instead of live MapPiece object references.
   * globalWarming field consolidates both tracker and finder removed peninsulas.
   *
   * Usage:
   *   - Host → Guest network sync (move-applied events)
   *   - Guest-side state restoration (applyState)
   *   - Not used for undo stack (use _saveSnapshot LOCAL format instead)
   *
   * Field mapping FROM engine state:
   *   - globalWarming.chance ← globalWarmingChanceTracker.globalWarmingChance
   *   - globalWarming.removedPeninsulas ← globalWarmingChanceTracker.removedPeninsulas
   *   - globalWarming.finderRemovedPeninsulas ← globalWarmingEventFinder.removedPeninsulas
   *
   * Deserialization note: See GameState.deserialize for MapPiece reference reconstruction.
   * This differs from LOCAL UNDO format (GameEngine._saveSnapshot) which uses gwTrackerPeninsulas
   * and gwFinderPeninsulas as separate fields.
   *
   * @param {Object} engineState - The game state object containing:
   *   - grid: 2D array of cells (may contain MapPiece object references)
   *   - mapPieces: array of MapPiece objects
   *   - currentTurn: number
   *   - currentPlayer: "p1" or "p2"
   *   - currentMapPieceIndex: number
   *   - gamePhase: "map" or "stone"
   *   - featureFlags: { globalWarming, tradeRoutes, cities, fishingVillages, blockades }
   *   - globalWarming: { chance, removedPeninsulas, finderRemovedPeninsulas }
   *   - pendingSkips: { p1: number, p2: number }
   *   - computedState: { emperorState, tradeRouteState, cityState, ... }
   *
   * @returns {Object} JSON-safe snapshot with grid cells using mapPieceID instead of live MapPiece references
   */
  static serialize(engineState) {
    if (!engineState) {
      throw new Error("serialize: engineState is required");
    }

    // Serialize mapPieces separately
    const mapPiecesCopy = JSON.parse(JSON.stringify(engineState.mapPieces));

    // Serialize grid, replacing MapPiece references with indices
    const gridCopy = [];
    for (let i = 0; i < engineState.grid.length; i++) {
      gridCopy[i] = [];
      for (let j = 0; j < engineState.grid[i].length; j++) {
        const cell = engineState.grid[i][j];

        if (cell === null) {
          gridCopy[i][j] = null;
        } else {
          // Clone the cell as JSON-safe
          const cellCopy = JSON.parse(JSON.stringify(cell));

          // If cell has a mapPiece reference, replace it with mapPieceID
          if (cell.mapPiece && typeof cell.mapPiece === "object") {
            cellCopy.mapPieceID = cell.mapPiece.id;
            // Remove the mapPiece object reference from serialized output
            delete cellCopy.mapPiece;
          }

          gridCopy[i][j] = cellCopy;
        }
      }
    }

    return {
      grid: gridCopy,
      mapPieces: mapPiecesCopy,
      currentTurn: engineState.currentTurn,
      currentPlayer: engineState.currentPlayer,
      currentMapPieceIndex: engineState.currentMapPieceIndex,
      gamePhase: engineState.gamePhase,
      featureFlags: JSON.parse(JSON.stringify(engineState.featureFlags)),
      globalWarming: JSON.parse(JSON.stringify(engineState.globalWarming)),
      pendingSkips: JSON.parse(JSON.stringify(engineState.pendingSkips)),
      computedState: JSON.parse(JSON.stringify(engineState.computedState)),
    };
  }

  /**
   * deserialize(data) - Reconstructs engine state with proper MapPiece cross-references
   *
   * @param {Object} data - JSON snapshot from serialize()
   * @returns {Object} Reconstructed state with cell.mapPiece references rebuilt
   */
  static deserialize(data) {
    if (!data) {
      throw new Error("deserialize: data is required");
    }

    // Deep clone to avoid mutating the input
    const gridCopy = JSON.parse(JSON.stringify(data.grid));
    const mapPiecesCopy = JSON.parse(JSON.stringify(data.mapPieces));

    // Rebuild MapPiece cross-references in grid cells
    // Follow the pattern from BoardStateEditor.getGrid (BoardManagement.mjs:147-166)
    for (let i = 0; i < gridCopy.length; i++) {
      for (let j = 0; j < gridCopy[i].length; j++) {
        const cell = gridCopy[i][j];

        // Only process non-null cells with mapPiece type and mapPieceID
        if (
          cell !== null &&
          cell.type === "mapPiece" &&
          typeof cell.mapPieceID === "number"
        ) {
          // Find the MapPiece object in the deserialized array by ID
          const matchingPiece = mapPiecesCopy.find(
            (piece) => piece.id === cell.mapPieceID
          );

          if (matchingPiece) {
            // Restore the reference
            gridCopy[i][j].mapPiece = matchingPiece;
            // Delete stale mapPieceID—it was only needed for deserialization
            delete gridCopy[i][j].mapPieceID;
          }
        }
      }
    }

    return {
      grid: gridCopy,
      mapPieces: mapPiecesCopy,
      currentTurn: data.currentTurn,
      currentPlayer: data.currentPlayer,
      currentMapPieceIndex: data.currentMapPieceIndex,
      gamePhase: data.gamePhase,
      featureFlags: JSON.parse(JSON.stringify(data.featureFlags)),
      globalWarming: JSON.parse(JSON.stringify(data.globalWarming)),
      pendingSkips: JSON.parse(JSON.stringify(data.pendingSkips)),
      computedState: JSON.parse(JSON.stringify(data.computedState)),
    };
  }

}
