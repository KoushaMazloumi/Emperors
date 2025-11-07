import {
  GRID_SIZE,
  PIECE_SHAPE_SIZE,
  STONE_PHASE,
  FIRST_STONE_TURNS_THRESHOLD,
  MAP_PHASE
} from '../../utils/Constants.js';

/**
 * Validates stone placement
 */
export class ValidateStonePlacementStrategy {
  performStrategy(moveValidator, details) {
    this.grid = moveValidator.grid;
    this.x = details.x;
    this.y = details.y;
    this.currentTurn = details.currentTurn;
    this.gamePhase = details.gamePhase;

    return this.validateStonePlacement(this.grid, this.x, this.y);
  }

  validateStonePlacement(grid, x, y) {
    if (this.gamePhase === STONE_PHASE) {
      const square = grid[y][x];
      if (square && square.type === "mapPiece" && square.stoneCount === 0) {
        // After first stone turn, must be adjacent to another stone
        if (this.currentTurn >= FIRST_STONE_TURNS_THRESHOLD) {
          const adjacentCells = [
            grid[y - 1] && grid[y - 1][x],
            grid[y + 1] && grid[y + 1][x],
            grid[y][x - 1],
            grid[y][x + 1],
          ];
          const hasAdjacentStone = adjacentCells.some(
            (cell) => cell && cell.stoneCount > 0
          );
          if (!hasAdjacentStone) return false;
        }
        return true;
      }
      return false;
    }
    return false;
  }
}

/**
 * Validates map piece placement
 */
export class ValidateMapPiecePlacementStrategy {
  performStrategy(moveValidator, details) {
    this.grid = moveValidator.grid;
    this.piece = details.piece;
    this.x = details.x;
    this.y = details.y;
    this.currentMapPieceIndex = details.currentMapPieceIndex;
    this.gamePhase = details.gamePhase;

    return this.validateMapPiecePlacement(
      this.grid,
      this.piece,
      this.x,
      this.y,
      this.currentMapPieceIndex
    );
  }

  validateMapPiecePlacement(grid, piece, x, y, currentPieceIndex) {
    if (this.gamePhase !== MAP_PHASE) return false;

    // Adjust coordinates to center
    x = x - Math.floor(PIECE_SHAPE_SIZE / 2);
    y = y - Math.floor(PIECE_SHAPE_SIZE / 2);

    // Check bounds and overlaps
    for (let i = 0; i < piece.shape.length; i++) {
      for (let j = 0; j < piece.shape[i].length; j++) {
        if (piece.shape[i][j] === 1) {
          const boardY = y + i;
          const boardX = x + j;

          // Check bounds
          if (boardX < 0 || boardX >= GRID_SIZE || boardY < 0 || boardY >= GRID_SIZE) {
            return false;
          }

          // Check for overlaps
          if (grid[boardY][boardX] !== null) {
            return false;
          }
        }
      }
    }

    // Check adjacency (after first piece)
    if (currentPieceIndex > 0) {
      let isAdjacentToExistingPiece = false;
      for (let i = 0; i < piece.shape.length; i++) {
        for (let j = 0; j < piece.shape[i].length; j++) {
          if (piece.shape[i][j] === 1) {
            const boardY = y + i;
            const boardX = x + j;

            // Check adjacent cells (ONLY 4 cardinal directions, not diagonals)
            if (
              (boardY > 0 && grid[boardY - 1][boardX]?.type === "mapPiece") ||
              (boardY < GRID_SIZE - 1 && grid[boardY + 1][boardX]?.type === "mapPiece") ||
              (boardX > 0 && grid[boardY][boardX - 1]?.type === "mapPiece") ||
              (boardX < GRID_SIZE - 1 && grid[boardY][boardX + 1]?.type === "mapPiece")
            ) {
              isAdjacentToExistingPiece = true;
              break;
            }
          }
        }
        if (isAdjacentToExistingPiece) break;
      }
      return isAdjacentToExistingPiece;
    }

    return true;
  }
}

/**
 * Validates map piece rotation
 */
export class ValidateMapPieceRotationStrategy {
  performStrategy(moveValidator, details) {
    this.gamePhase = details.gamePhase;
    return this.gamePhase === MAP_PHASE;
  }
}
