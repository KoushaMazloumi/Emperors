import {
  GRID_SIZE,
  PLAYER_1,
  PLAYER_2,
  CITY_LENGTH_THRESHOLD
} from '../../utils/Constants.js';

/**
 * Counts emperors (which player controls each map piece)
 */
export class EmperorCounter {
  performStrategy(boardStateSearcher, details) {
    this.grid = boardStateSearcher.grid;
    return this.countEmperors(this.grid);
  }

  countEmperors(grid) {
    const mapPieces = new Map();

    // Count stones per player on each map piece
    for (let i = 0; i < grid.length; i++) {
      for (let j = 0; j < grid[i].length; j++) {
        const square = grid[i][j];
        if (square && square.type === "mapPiece" && square.stoneCount > 0) {
          if (!mapPieces.has(square.mapPieceID)) {
            mapPieces.set(square.mapPieceID, { p1: 0, p2: 0 });
          }
          const counts = mapPieces.get(square.mapPieceID);
          if (square.stoneOwner === PLAYER_1) {
            counts.p1++;
          } else if (square.stoneOwner === PLAYER_2) {
            counts.p2++;
          }
        }
      }
    }

    // Determine emperor
    const emperors = [];
    for (const [mapPieceID, counts] of mapPieces) {
      let emperor = null;
      if (counts.p1 > counts.p2) {
        emperor = PLAYER_1;
      } else if (counts.p2 > counts.p1) {
        emperor = PLAYER_2;
      }
      emperors.push({ mapPieceID, emperor });
    }

    return emperors;
  }
}

/**
 * Counts population (map piece sizes) controlled by each player
 */
export class PopulationCounter {
  performStrategy(boardStateSearcher, details) {
    this.grid = boardStateSearcher.grid;
    this.currentEmperorState = details.currentEmperorState;
    return this.countPopulation();
  }

  countPopulation() {
    const ruledPopulations = { [PLAYER_1]: 0, [PLAYER_2]: 0 };
    const mapPieceSizes = new Map();

    // Count size of each map piece
    for (let i = 0; i < this.grid.length; i++) {
      for (let j = 0; j < this.grid[i].length; j++) {
        const square = this.grid[i][j];
        if (square && square.type === "mapPiece") {
          if (!mapPieceSizes.has(square.mapPieceID)) {
            mapPieceSizes.set(square.mapPieceID, 0);
          }
          mapPieceSizes.set(square.mapPieceID, mapPieceSizes.get(square.mapPieceID) + 1);
        }
      }
    }

    // Add population for ruled pieces
    for (const emperor of this.currentEmperorState) {
      if (emperor.emperor && mapPieceSizes.has(emperor.mapPieceID)) {
        ruledPopulations[emperor.emperor] += mapPieceSizes.get(emperor.mapPieceID);
      }
    }

    return ruledPopulations;
  }
}

/**
 * Counts trade routes
 */
export class TradeRouteCounter {
  performStrategy(boardStateSearcher, details) {
    this.grid = boardStateSearcher.grid;
    return this.countTradeRoutes();
  }

  countTradeRoutes() {
    let tradeRoutes = {
      [PLAYER_1]: { count: 0, totalLength: 0, coordinates: [] },
      [PLAYER_2]: { count: 0, totalLength: 0, coordinates: [] }
    };

    const visited = Array(GRID_SIZE).fill(null).map(() => Array(GRID_SIZE).fill(false));

    for (let i = 0; i < this.grid.length; i++) {
      for (let j = 0; j < this.grid[i].length; j++) {
        const square = this.grid[i][j];
        if (square && square.type === "mapPiece" && square.stoneCount > 0 && !visited[i][j]) {
          const player = square.stoneOwner;
          const result = this.findTradeRoute(i, j, player, visited);

          if (result.isTradeRoute) {
            tradeRoutes[player].count++;
            tradeRoutes[player].totalLength += result.oceanLength;
            tradeRoutes[player].coordinates.push(...result.coordinates);
          }
        }
      }
    }

    return tradeRoutes;
  }

  findTradeRoute(startY, startX, player, visited) {
    const directions = [
      { dx: -1, dy: 0 },
      { dx: 1, dy: 0 },
      { dx: 0, dy: -1 },
      { dx: 0, dy: 1 }
    ];

    for (const dir of directions) {
      let oceanLength = 0;
      let x = startX + dir.dx;
      let y = startY + dir.dy;
      const routeCoords = [{ x: startX, y: startY }];

      // Count ocean cells
      while (
        x >= 0 && x < GRID_SIZE &&
        y >= 0 && y < GRID_SIZE &&
        this.grid[y][x] === null
      ) {
        oceanLength++;
        x += dir.dx;
        y += dir.dy;
      }

      // Check if we found another stone of the same player
      if (
        oceanLength > 0 &&
        x >= 0 && x < GRID_SIZE &&
        y >= 0 && y < GRID_SIZE &&
        this.grid[y][x] &&
        this.grid[y][x].type === "mapPiece" &&
        this.grid[y][x].stoneOwner === player
      ) {
        routeCoords.push({ x, y });
        visited[startY][startX] = true;
        visited[y][x] = true;

        return {
          isTradeRoute: true,
          oceanLength,
          coordinates: routeCoords
        };
      }
    }

    return { isTradeRoute: false, oceanLength: 0, coordinates: [] };
  }
}

/**
 * Finds cities (3+ consecutive stones in a row/column)
 */
export class CityFinder {
  performStrategy(boardStateSearcher, details) {
    this.grid = boardStateSearcher.grid;
    return this.findCities();
  }

  findCities() {
    const cities = {
      [PLAYER_1]: { count: 0, coordinates: [] },
      [PLAYER_2]: { count: 0, coordinates: [] }
    };

    const visitedHorizontal = Array(GRID_SIZE).fill(null).map(() => Array(GRID_SIZE).fill(false));
    const visitedVertical = Array(GRID_SIZE).fill(null).map(() => Array(GRID_SIZE).fill(false));

    // Check horizontal
    for (let i = 0; i < this.grid.length; i++) {
      for (let j = 0; j < this.grid[i].length; j++) {
        if (!visitedHorizontal[i][j]) {
          const result = this.checkDirection(i, j, 0, 1, visitedHorizontal);
          if (result.isCity) {
            cities[result.player].count++;
            cities[result.player].coordinates.push(...result.coordinates);
          }
        }
      }
    }

    // Check vertical
    for (let i = 0; i < this.grid.length; i++) {
      for (let j = 0; j < this.grid[i].length; j++) {
        if (!visitedVertical[i][j]) {
          const result = this.checkDirection(i, j, 1, 0, visitedVertical);
          if (result.isCity) {
            cities[result.player].count++;
            cities[result.player].coordinates.push(...result.coordinates);
          }
        }
      }
    }

    return cities;
  }

  checkDirection(startY, startX, dy, dx, visited) {
    const square = this.grid[startY][startX];
    if (!square || square.type !== "mapPiece" || square.stoneCount === 0) {
      return { isCity: false };
    }

    const player = square.stoneOwner;
    let length = 0;
    let y = startY;
    let x = startX;
    const coordinates = [];

    while (
      y >= 0 && y < GRID_SIZE &&
      x >= 0 && x < GRID_SIZE &&
      this.grid[y][x] &&
      this.grid[y][x].type === "mapPiece" &&
      this.grid[y][x].stoneOwner === player
    ) {
      visited[y][x] = true;
      coordinates.push({ x, y });
      length++;
      x += dx;
      y += dy;
    }

    if (length >= CITY_LENGTH_THRESHOLD) {
      return { isCity: true, player, coordinates };
    }

    return { isCity: false };
  }
}

/**
 * Counts resources adjacent to each player's stones
 */
export class ResourceCounter {
  performStrategy(boardStateSearcher, details) {
    this.grid = boardStateSearcher.grid;
    return this.countResources();
  }

  countResources() {
    let resourceCount = {
      [PLAYER_1]: { count: 0 },
      [PLAYER_2]: { count: 0 }
    };

    for (let i = 0; i < this.grid.length; i++) {
      for (let j = 0; j < this.grid[i].length; j++) {
        const square = this.grid[i][j];
        if (square && square.type === "naturalResource") {
          const adjacentCells = [
            this.grid[i - 1] && this.grid[i - 1][j],
            this.grid[i + 1] && this.grid[i + 1][j],
            this.grid[i][j - 1],
            this.grid[i][j + 1]
          ];

          // Match original behavior: count each adjacent stone separately
          // (can result in multiple points per resource if multiple stones adjacent)
          adjacentCells.forEach((adjacentCell) => {
            if (adjacentCell !== null && adjacentCell.stoneOwner === PLAYER_1) {
              resourceCount[PLAYER_1].count++;
            } else if (adjacentCell !== null && adjacentCell.stoneOwner === PLAYER_2) {
              resourceCount[PLAYER_2].count++;
            }
          });
        }
      }
    }

    return resourceCount;
  }
}

/**
 * Finds peninsulas (3 sides touching ocean)
 */
export class PeninsulaFinder {
  performStrategy(boardStateSearcher, details) {
    this.grid = boardStateSearcher.grid;
    return this.findPeninsulas();
  }

  findPeninsulas() {
    const peninsulas = [];
    const affectedMapPieces = new Set();

    for (let i = 1; i < this.grid.length - 1; i++) {
      for (let j = 1; j < this.grid.length - 1; j++) {
        if (this.grid[i][j] !== null && this.grid[i][j].type === "mapPiece") {
          const adjacentCells = [
            this.grid[i - 1][j],
            this.grid[i + 1][j],
            this.grid[i][j - 1],
            this.grid[i][j + 1]
          ];
          const oceanCells = adjacentCells.filter((cell) => cell === null);
          if (oceanCells.length === 3) {
            peninsulas.push({ x: j, y: i });
            affectedMapPieces.add(this.grid[i][j].mapPieceID);
          }
        }
      }
    }

    return { peninsulas, affectedMapPieces: Array.from(affectedMapPieces) };
  }
}

/**
 * Finds peninsulas affected by global warming
 */
export class GlobalWarmingEventFinder {
  constructor() {
    this.removedPeninsulas = [];
  }

  performStrategy(boardStateSearcher, details) {
    this.grid = boardStateSearcher.grid;
    this.gridCOPY = details.currentGridCopyState;
    this.peninsulas = details.currentPeninsulaState.peninsulas;
    this.globalWarmingChance = details.currentGlobalWarmingChance;

    const gridsToRemove = this.peninsulas
      .filter((peninsula) => {
        const roll = Math.random();
        if (roll < this.globalWarmingChance) {
          this.removedPeninsulas.push({
            x: peninsula.x,
            y: peninsula.y,
            time: Date.now()
          });
          return true;
        }
        return false;
      })
      .map(({ x, y }) => ({
        x,
        y,
        mapPiece: this.gridCOPY[y][x].mapPiece
      }));

    return gridsToRemove;
  }
}
