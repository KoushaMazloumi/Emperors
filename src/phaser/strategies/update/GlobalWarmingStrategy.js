/**
 * Handles global warming events by removing peninsula cells
 */
export class GlobalWarmingEventHandlingStrategy {
  performStrategy(details) {
    this.gridCOPY = details.currentGridCopyState;
    this.removalCoordinates = details.removalCoordinates;

    if (this.removalCoordinates === null || this.removalCoordinates.length === 0) {
      return;
    }

    for (let i = 0; i < this.removalCoordinates.length; i++) {
      const removalCoordinate = this.removalCoordinates[i];
      this.removeGrids(removalCoordinate.x, removalCoordinate.y);
    }
  }

  removeGrids(x, y) {
    const square = this.gridCOPY[y][x];
    if (square && square.type === "mapPiece") {
      const squareIndex = square.pieceSquareIndex;

      // 1. Remove from map piece's shape arrays
      square.mapPiece.shapeRelativeSquareLocations =
        square.mapPiece.shapeRelativeSquareLocations
          .filter((loc) => loc.index !== squareIndex)
          .map((loc, index) => ({ ...loc, index })); // Re-index

      square.mapPiece.shapeRelativeStoneFlags =
        square.mapPiece.shapeRelativeStoneFlags.filter(
          (player, index) => index !== squareIndex
        );

      square.mapPiece.boardRelativeSquareLocations =
        square.mapPiece.boardRelativeSquareLocations
          .filter((loc, index) => index !== squareIndex)
          .map((loc, index) => ({ ...loc, index })); // Re-index

      // 2. Update pieceSquareIndex for all remaining cells
      for (let i = 0; i < this.gridCOPY.length; i++) {
        for (let j = 0; j < this.gridCOPY[i].length; j++) {
          const cell = this.gridCOPY[i][j];
          if (cell && cell.type === "mapPiece" && cell.mapPieceID === square.mapPieceID) {
            cell.pieceSquareIndex =
              cell.mapPiece.boardRelativeSquareLocations.findIndex(
                (loc) =>
                  loc.x === cell.cellSquareLocation.x &&
                  loc.y === cell.cellSquareLocation.y
              );
          }
        }
      }

      // 3. Recreate the shape array (7x7)
      square.mapPiece.shape = this.recreateShape(
        square.mapPiece.shapeRelativeSquareLocations
      );

      // 4. Update stone count
      square.mapPiece.stoneCount =
        square.mapPiece.shapeRelativeStoneFlags.filter(
          (player) => player !== false
        ).length;

      // 5. Remove from grid
      this.gridCOPY[y][x] = null;
    }
  }

  recreateShape(shapeRelativeSquareLocations) {
    let shape = Array(7).fill().map(() => Array(7).fill(0));
    shapeRelativeSquareLocations.forEach((location) => {
      shape[location.y][location.x] = 1;
    });
    return shape;
  }

  giveUpdatedGrid() {
    return this.gridCOPY;
  }
}
