import {
  GRID_SIZE,
  PIECE_SHAPE_SIZE,
  TOTAL_RESOURCES
} from '../../utils/Constants.js';

/**
 * Base strategy with clear flags functionality
 */
class BaseUpdateStrategy {
  clearFlags(gridCopy) {
    for (let i = 0; i < gridCopy.length; i++) {
      for (let j = 0; j < gridCopy[i].length; j++) {
        if (gridCopy[i][j] !== null) {
          gridCopy[i][j].lastPlayed = false;
          gridCopy[i][j].isPartOfTradeRoute = false;
          gridCopy[i][j].isPartOfCity = false;
        }
      }
    }
  }
}

/**
 * Adds a stone to the grid
 */
export class AddStoneStrategy extends BaseUpdateStrategy {
  performStrategy(details) {
    this.gridCOPY = details.currentGridCopyState;
    this.player = details.currentPlayer;
    this.x = details.x;
    this.y = details.y;

    this.addStone();
  }

  addStone() {
    this.clearFlags(this.gridCOPY);
    const square = this.gridCOPY[this.y][this.x];

    if (square && square.type === "mapPiece") {
      square.stoneCount++;
      square.stoneOwner = this.player;
      square.mapPiece.shapeRelativeStoneFlags[square.pieceSquareIndex] = this.player;
      square.mapPiece.stoneCount++;
      square.lastPlayed = true;
    }
  }

  giveUpdatedGrid() {
    return this.gridCOPY;
  }
}

/**
 * Adds a map piece to the grid
 */
export class AddMapPieceStrategy extends BaseUpdateStrategy {
  performStrategy(details) {
    this.gridCOPY = details.currentGridCopyState;
    this.piece = details.piece;
    this.x = details.x;
    this.y = details.y;

    this.addMapPiece();
  }

  addMapPiece() {
    this.clearFlags(this.gridCOPY);

    // Adjust coordinates to center
    const startX = this.x - Math.floor(PIECE_SHAPE_SIZE / 2);
    const startY = this.y - Math.floor(PIECE_SHAPE_SIZE / 2);

    for (let i = 0; i < this.piece.shape.length; i++) {
      for (let j = 0; j < this.piece.shape[i].length; j++) {
        if (this.piece.shape[i][j] === 1) {
          const boardY = startY + i;
          const boardX = startX + j;

          if (boardX >= 0 && boardX < GRID_SIZE && boardY >= 0 && boardY < GRID_SIZE) {
            const squareIndex = this.piece.shapeRelativeSquareLocations.findIndex(
              (loc) => loc.x === j && loc.y === i
            );

            this.gridCOPY[boardY][boardX] = {
              type: "mapPiece",
              lastPlayed: false,  // Match original: map pieces not highlighted on placement
              isPartOfTradeRoute: false,
              isPartOfCity: false,
              color: this.piece.color,
              mapPiece: this.piece,
              pieceSquareIndex: squareIndex,
              mapPieceID: this.piece.id,
              stoneCount: 0,
              stoneOwner: null,
              cellSquareLocation: { x: boardX, y: boardY }
            };

            this.piece.boardRelativeSquareLocations[squareIndex] = {
              x: boardX,
              y: boardY  // Match original: no index property
            };
          }
        }
      }
    }
  }

  giveUpdatedGrid() {
    return this.gridCOPY;
  }
}

/**
 * Updates emperor property on map pieces
 */
export class UpdateEmperorStrategy {
  performStrategy(details) {
    this.gridCOPY = details.currentGridCopyState;
    this.currentEmperorState = details.currentEmperorState;
    this.updateEmperors();
  }

  updateEmperors() {
    for (let i = 0; i < GRID_SIZE; i++) {
      for (let j = 0; j < GRID_SIZE; j++) {
        const square = this.gridCOPY[i][j];
        if (square && square.type === "mapPiece") {
          const currentEmperor = this.currentEmperorState.find(
            (emperor) => emperor.mapPieceID === square.mapPieceID
          );
          if (currentEmperor && square.mapPiece.emperor !== currentEmperor.emperor) {
            square.mapPiece.emperor = currentEmperor.emperor;
          }
        }
      }
    }
  }

  giveUpdatedGrid() {
    return this.gridCOPY;
  }
}

/**
 * Updates trade route flags
 */
export class UpdateTradeRouteStrategy {
  performStrategy(details) {
    this.gridCOPY = details.currentGridCopyState;
    this.currentTradeRouteState = details.currentTradeRouteState;
    this.updateTradeRoutes();
  }

  updateTradeRoutes() {
    const players = Object.keys(this.currentTradeRouteState);

    for (const player of players) {
      const tradeRouteCoords = this.currentTradeRouteState[player].coordinates;

      for (const coord of tradeRouteCoords) {
        if (this.gridCOPY[coord.y] && this.gridCOPY[coord.y][coord.x]) {
          this.gridCOPY[coord.y][coord.x].isPartOfTradeRoute = true;
        }
      }
    }
  }

  giveUpdatedGrid() {
    return this.gridCOPY;
  }
}

/**
 * Updates city flags
 */
export class UpdateCityStrategy {
  performStrategy(details) {
    this.gridCOPY = details.currentGridCopyState;
    this.currentCityState = details.currentCityState;
    this.updateCities();
  }

  updateCities() {
    const players = Object.keys(this.currentCityState);

    for (const player of players) {
      const cityCoords = this.currentCityState[player].coordinates;

      for (const coord of cityCoords) {
        if (this.gridCOPY[coord.y] && this.gridCOPY[coord.y][coord.x]) {
          this.gridCOPY[coord.y][coord.x].isPartOfCity = true;
        }
      }
    }
  }

  giveUpdatedGrid() {
    return this.gridCOPY;
  }
}

/**
 * Adds natural resources to the grid
 */
export class AddNaturalResourceStrategy {
  performStrategy(details) {
    this.gridCOPY = details.currentGridCopyState;
    this.addNaturalResources();
  }

  addNaturalResources() {
    const resourceCoordinates = this.generateResourceCoordinates();

    for (const coord of resourceCoordinates) {
      this.gridCOPY[coord.y][coord.x] = {
        type: "naturalResource",
        lastPlayed: false,
        isPartOfTradeRoute: false,
        isPartOfCity: false,
        cellSquareLocation: { x: coord.x, y: coord.y }
      };
    }
  }

  generateResourceCoordinates() {
    const coordinates = [];
    const quadrantSize = GRID_SIZE / 2;

    // Place one resource in each quadrant
    for (let quadrant = 0; quadrant < TOTAL_RESOURCES; quadrant++) {
      const quadrantRow = Math.floor(quadrant / 2);
      const quadrantCol = quadrant % 2;

      const x = Math.floor(Math.random() * quadrantSize) + quadrantCol * quadrantSize;
      const y = Math.floor(Math.random() * quadrantSize) + quadrantRow * quadrantSize;

      coordinates.push({ x, y });
    }

    return coordinates;
  }

  giveUpdatedGrid() {
    return this.gridCOPY;
  }
}
