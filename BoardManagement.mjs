import {
  GRID_SIZE,
  GRID_OFFSET,
  TOTAL_RESOURCES,
  PIECE_SHAPE_SIZE,
  ADJACENT_OFFSETS,
  STONE_PHASE,
  FIRST_STONE_TURNS_THRESHOLD,
  PLAYER_1,
  PLAYER_2,
  CITY_LENGTH_THRESHOLD,
  MAP_PHASE,
} from "./Constants.mjs";

// ********************Board state classes********************
// Our actual board state that needs to remain our single source of truth
export class BoardState {
  #grid = [];
  #mapPieces = [];

  constructor(GRID_SIZE) {
    // Initialize an empty game board as a 2D array
    this.#grid = new Array(GRID_SIZE)
      .fill(null)
      .map(() => new Array(GRID_SIZE).fill(null));

    // Populate the grid with null values
    for (let i = 0; i < GRID_SIZE; i++) {
      this.#grid[i] = [];
      for (let j = 0; j < GRID_SIZE; j++) {
        this.#grid[i][j] = null;
      }
      this.mapPieces = [];
    }
  }
  setMapPieces(mapPieces) {
    this.#mapPieces = mapPieces;
  }

  replaceMapPiece(mapPieceIndex, newMapPiece) {
    this.#mapPieces[mapPieceIndex] = newMapPiece;
  }
  uploadGrid(newGrid) {
    // Update the grid with a new grid
    this.#grid = newGrid;
    this.updateMapPiecesArray();
  }

  updateMapPiecesArray() {
    //iterate through the mapPieces array
    for (let i = 0; i < this.#mapPieces.length; i++) {
      for (let row = 0; row < this.#grid.length; row++) {
        for (let col = 0; col < this.#grid[row].length; col++) {
          if (
            this.#grid[row][col] &&
            this.#grid[row][col].mapPieceID === this.#mapPieces[i].id
          ) {
            //once the cell is found, update the this.#mapPieces[i] to match the mapPiece in the grid cell
            this.#mapPieces[i] = this.#grid[row][col].mapPiece;
            break;
          }
        }
      }
    }
  }

  getGrid() {
    return this.#grid;
  }
  getAllMapPieces() {
    return this.#mapPieces;
  }

  getSingleMapPiece(mapPieceIndex) {
    return this.#mapPieces[mapPieceIndex];
  }
}
export class BoardStateEditor {
  #board;

  constructor(board) {
    this.#board = board;
    this.strategy = null;
  }

  // A method to apply the changes made by the strategy
  applyChanges() {
    if (!this.strategy) {
      throw new Error("Strategy is not set");
    }

    // Get the updated grid from the strategy
    const newGrid = this.strategy.giveUpdatedGrid();

    // Update the board with the new grid
    this.#board.uploadGrid(newGrid);
    console.log("updated board, newGrid: ", newGrid);
    // Print the updated board state
  }

  applyGlobalWarming(newGrid) {
    this.#board.uploadGrid(newGrid);
    console.log("updated board due to global warming, newGrid: ", newGrid);
  }

  setStrategy(strategy) {
    // Set the strategy for the editor
    this.strategy = strategy;
  }

  performStrategy(details) {
    if (!this.strategy) {
      throw new Error("Strategy is not set");
    }
    console.log("details:", details);

    details.setCurrentGridCopyState(this.getGrid());
    // Perform the strategy on the editor
    this.strategy.performStrategy(details);
    console.log("applying changes");
    // Apply the changes made by the strategy
    this.applyChanges();
  }

  getGrid() {
    this.gridCopy = JSON.parse(JSON.stringify(this.#board.getGrid()));

    this.mapPiecesCopy = JSON.parse(
      JSON.stringify(this.#board.getAllMapPieces())
    );

    for (let i = 0; i < this.gridCopy.length; i++) {
      for (let j = 0; j < this.gridCopy[i].length; j++) {
        if (
          this.gridCopy[i][j] !== null &&
          this.gridCopy[i][j].type === "mapPiece"
        ) {
          const index = this.mapPiecesCopy.findIndex(
            (mapPiece) => mapPiece.id === this.gridCopy[i][j].mapPieceID
          );
          this.gridCopy[i][j].mapPiece = this.mapPiecesCopy[index];
        }
      }
    }
    return this.gridCopy;
  }
}

//Helper class for Board State that traverses the grid searches for specific patterns of stones, map pieces or natural resources
export class BoardStateSearcher {
  constructor(gameBoard) {
    this.gameBoard = gameBoard;
    this.grid = [];
  }
  setStrategy(strategy) {
    // Set the strategy
    this.strategy = strategy;
  }
  performStrategy(details) {
    if (!this.strategy) {
      throw new Error("Strategy is not set");
    }
    this.grid = this.gameBoard.getGrid();

    // Perform the strategy

    return this.strategy.performStrategy(this, details);
  }
}
// ********************Board Search Strategies********************

export class PeninsulaFinder {
  constructor() {
    this.grid = null;
  }

  performStrategy(boardStateSearcher) {
    this.grid = boardStateSearcher.grid;

    // Call the countEmperors method and return its result
    let peninsulas = this.findPeninsulas(this.grid);
    console.log("peninsulas: ", peninsulas);
    return peninsulas;
  }

  findPeninsulas() {
    const peninsulas = [];
    const affectedMapPieces = [];

    for (let i = 1; i < this.grid.length - 1; i++) {
      for (let j = 1; j < this.grid.length - 1; j++) {
        if (this.grid[i][j] !== null && this.grid[i][j].type === "mapPiece") {
          // If the cell is not an ocean or natural resource cell
          const adjacentCells = [
            this.grid[i - 1][j],
            this.grid[i + 1][j],
            this.grid[i][j - 1],
            this.grid[i][j + 1],
          ];
          const oceanCells = adjacentCells.filter((cell) => cell === null);
          if (oceanCells.length === 3) {
            // If the cell is surrounded by ocean cells on three sides
            peninsulas.push({
              x: j,
              y: i,
            });
            const mapPiece = this.grid[i][j].mapPiece; // Get the map piece at the coordinates
            const deepCopy = JSON.parse(JSON.stringify(mapPiece)); // Create a deep copy of the map piece
            affectedMapPieces.push(deepCopy); // Add the deep copy to the array
          }
        }
      }
    }
    return {
      peninsulas,
      affectedMapPieces,
    };
  }
}
export class CityFinder {
  constructor() {
    this.grid = null;
  }

  performStrategy(boardStateSearcher) {
    this.grid = boardStateSearcher.grid;

    // Call the find cities method and return its result
    let cities = this.findCities(this.grid);

    return cities;
  }

  findCities() {
    const cities = {
      [PLAYER_1]: {
        count: 0,
        coordinates: [],
      },
      [PLAYER_2]: {
        count: 0,
        coordinates: [],
      },
    };
    const visitedHorizontal = this.grid.map((row) => row.map(() => false));
    const visitedVertical = this.grid.map((row) => row.map(() => false));
    for (let i = 0; i < this.grid.length; i++) {
      for (let j = 0; j < this.grid[i].length; j++) {
        if (
          this.grid[i][j] !== null &&
          (this.grid[i][j].stoneOwner === PLAYER_1 ||
            this.grid[i][j].stoneOwner === PLAYER_2)
        ) {
          let player = this.grid[i][j].stoneOwner;
          let cityLength = 1; // Start with 1 to include the current cell
          // Check down direction
          if (!visitedVertical[i][j]) {
            visitedVertical[i][j] = true; // Mark the current cell as visited
            for (let k = i + 1; k < this.grid.length; k++) {
              if (
                this.grid[k][j] !== null &&
                this.grid[k][j].stoneOwner === player
              ) {
                cityLength++;
                visitedVertical[k][j] = true;
              } else {
                break;
              }
            }
            if (cityLength >= CITY_LENGTH_THRESHOLD) {
              cities[player].count++;
              for (let k = i; k < i + cityLength; k++) {
                cities[player].coordinates.push([k, j]);
              }
            }
          }
          // Reset cityLength for horizontal check
          cityLength = 1; // Reset to 1 to include the current cell
          // Check right direction
          if (!visitedHorizontal[i][j]) {
            visitedHorizontal[i][j] = true; // Mark the current cell as visited
            for (let k = j + 1; k < this.grid[i].length; k++) {
              if (
                this.grid[i][k] !== null &&
                this.grid[i][k].stoneOwner === player
              ) {
                cityLength++;
                visitedHorizontal[i][k] = true;
              } else {
                break;
              }
            }
            if (cityLength >= CITY_LENGTH_THRESHOLD) {
              cities[player].count++;
              for (let k = j; k < j + cityLength; k++) {
                cities[player].coordinates.push([i, k]);
              }
            }
          }
        }
      }
    }
    console.log(
      "🚀 ~ file: BoardManagement.mjs:244 ~ CityFinder ~ findCities ~ cities:",
      cities
    );
    return cities;
  }
}

export class ResourceCounter {
  constructor() {
    this.grid = null;
  }

  performStrategy(boardStateSearcher) {
    this.grid = boardStateSearcher.grid;

    // Call the countEmperors method and return its result
    let resourceCount = this.countResources();

    return resourceCount;
  }

  countResources() {
    let resourceCount = {
      [PLAYER_1]: {
        count: 0,
      },
      [PLAYER_2]: {
        count: 0,
      },
    };

    for (let i = 0; i < this.grid.length; i++) {
      for (let j = 0; j < this.grid[i].length; j++) {
        if (
          this.grid[i][j] !== null &&
          this.grid[i][j].type === "naturalResource"
        ) {
          const adjacentCells = [
            this.grid[i - 1] && this.grid[i - 1][j],
            this.grid[i + 1] && this.grid[i + 1][j],
            this.grid[i][j - 1],
            this.grid[i][j + 1],
          ];
          adjacentCells.forEach((adjacentCell) => {
            if (adjacentCell !== null && adjacentCell.stoneOwner === PLAYER_1) {
              resourceCount[PLAYER_1].count++;
            } else if (
              adjacentCell !== null &&
              adjacentCell.stoneOwner === PLAYER_2
            ) {
              resourceCount[PLAYER_2].count++;
            }
          });
        }
      }
    }

    return resourceCount;
  }
}
export class TradeRouteCounter {
  constructor() {
    this.grid = null;
  }

  // Method to perform the strategy
  performStrategy(boardStateSearcher) {
    this.grid = boardStateSearcher.grid;

    // Call the countEmperors method and return its result
    let tradeRouteCount = this.countTradeRoutes(this.grid);

    return tradeRouteCount;
  }

  countTradeRoutes() {
    //create an object tradeRoutes that will store the trade routes and their lengths per player
    let tradeRoutes = {
      [PLAYER_1]: {
        count: 0,
        totalLength: 0,
        coordinates: [],
      },
      [PLAYER_2]: {
        count: 0,
        totalLength: 0,
        coordinates: [],
      },
    };
    for (let i = 0; i < this.grid.length; i++) {
      for (let j = 0; j < this.grid[i].length; j++) {
        if (
          this.grid[i][j] !== null &&
          (this.grid[i][j].stoneOwner === PLAYER_1 ||
            this.grid[i][j].stoneOwner === PLAYER_2)
        ) {
          let player = this.grid[i][j].stoneOwner;
          let routeLength = 0; // start with 0
          // Check down direction
          for (let k = i + 1; k < this.grid.length; k++) {
            if (this.grid[k][j] === null) {
              routeLength++;
            } else if (
              this.grid[k][j].stoneOwner === player &&
              routeLength > 0
            ) {
              // check if routeLength > 0
              tradeRoutes[player].count++;
              tradeRoutes[player].totalLength += routeLength;
              for (let l = i; l <= k; l++) {
                if (this.grid[l][j]) {
                  this.grid[l][j].isPartOfTradeRoute = true;
                  tradeRoutes[player].coordinates.push([l, j]);
                }
              }
              break;
            } else {
              break;
            }
          }
          // Reset routeLength for horizontal check
          routeLength = 0; // reset to 0
          // Check right direction
          for (let k = j + 1; k < this.grid[i].length; k++) {
            if (this.grid[i][k] === null) {
              routeLength++;
            } else if (
              this.grid[i][k].stoneOwner === player &&
              routeLength > 0
            ) {
              // check if routeLength > 0
              tradeRoutes[player].count++;
              tradeRoutes[player].totalLength += routeLength;
              for (let l = j; l <= k; l++) {
                if (this.grid[i][l]) {
                  this.grid[i][l].isPartOfTradeRoute = true;
                  tradeRoutes[player].coordinates.push([i, l]);
                }
              }
              break;
            } else {
              break;
            }
          }
        }
      }
    }
    console.log(
      "🚀 ~ file: BoardManagement.mjs:225 ~ TradeRouteCounter ~ countTradeRoutes ~ tradeRoutes:",
      tradeRoutes
    );
    return tradeRoutes;
  }
}
export class EmperorCounter {
  constructor() {
    this.grid = null;
  }

  // Method to perform the strategy
  performStrategy(boardStateSearcher) {
    this.grid = boardStateSearcher.grid;

    // Call the countEmperors method and return its result
    let emperorCount = this.countEmperors(this.grid);

    return emperorCount;
  }

  // Method to count the number of emperors on the board
  countEmperors(grid) {
    // Create a map of all the unique map pieces on the board based on their mapPieceID
    const mapPieces = new Map();
    for (let i = 0; i < grid.length; i++) {
      for (let j = 0; j < grid[i].length; j++) {
        const cell = grid[i][j];
        if (cell && cell.mapPieceID !== undefined) {
          if (!mapPieces.has(cell.mapPieceID)) {
            mapPieces.set(cell.mapPieceID, { p1: 0, p2: 0 });
          }
          if (cell.stoneOwner === "p1") {
            mapPieces.get(cell.mapPieceID).p1 += 1;
          } else if (cell.stoneOwner === PLAYER_2) {
            mapPieces.get(cell.mapPieceID).p2 += 1;
          }
        }
      }
    }

    // Determine the emperor of each map piece
    const emperors = [];
    for (const [mapPieceID, counts] of mapPieces.entries()) {
      let emperor = null;
      if (counts.p1 > counts.p2) {
        emperor = PLAYER_1;
      } else if (counts.p2 > counts.p1) {
        emperor = PLAYER_2;
      }
      emperors.push({ mapPieceID, emperor });
    }
    console.log(
      "🚀 ~ file: BoardManagement.mjs:393 ~ EmperorCounter ~ countEmperors ~ emperors:",
      emperors
    );
    return emperors;
  }
}

export class PopulationCounter {
  constructor() {
    this.grid = null;
    this.mapPieces = null;
  }

  // Method to perform the strategy
  performStrategy(boardStateSearcher, details) {
    this.grid = boardStateSearcher.grid;
    this.mapPieces = boardStateSearcher.gameBoard.getAllMapPieces();
    this.currentEmperorState = details.currentEmperorState;

    // Call the countEmperors method and return its result
    let populationCount = this.countPopulation(this.grid);

    return populationCount;
  }
  findEmperorByMapPieceID(array, id) {
    for (let i = 0; i < array.length; i++) {
      if (array[i].mapPieceID === id) {
        return array[i].emperor;
      }
    }
    return null; // return null if no matching mapPieceID is found
  }

  countPopulation() {
    let mapPieceSizes = [];
    for (let i = 0; i < this.mapPieces.length; i++) {
      let mapPieceSize = this.mapPieces[i].shapeRelativeSquareLocations.length;
      let mapPieceId = this.mapPieces[i].id;
      //emperor needs to be grabbed from the this.currentEmperorState via the mapPieceId
      let mapPieceEmperor = this.findEmperorByMapPieceID(
        this.currentEmperorState,
        mapPieceId
      );

      mapPieceSizes.push({
        mapPieceSize: mapPieceSize,
        mapPieceId: mapPieceId,
        mapPieceEmperor: mapPieceEmperor,
      });
    }

    const ruledPopulations = {
      [PLAYER_1]: 0,
      [PLAYER_2]: 0,
    };
    for (let i = 0; i < mapPieceSizes.length; i++) {
      if (mapPieceSizes[i].mapPieceEmperor != null) {
        let mapPieceEmperor = mapPieceSizes[i].mapPieceEmperor;
        ruledPopulations[mapPieceEmperor] += mapPieceSizes[i].mapPieceSize;
      }
    }

    return ruledPopulations;
  }
}
// ********************Move Validation Classes********************
//Validates moves as allowed or not
export class MoveValidator {
  constructor(gameBoard) {
    this.gameBoard = gameBoard;
    this.grid = [];
  }
  setStrategy(strategy) {
    // Set the strategy
    this.strategy = strategy;
  }
  performStrategy(details) {
    if (!this.strategy) {
      throw new Error("Strategy is not set");
    }
    this.grid = this.gameBoard.getGrid();

    // Perform the strategy
    console.log(this.grid);

    return this.strategy.performStrategy(this, details);
  }
}
export class ValidateStonePlacementStrategy {
  constructor() {
    this.grid = null;
    this.x = null;
    this.y = null;
    this.piece = null;
    this.currentTurn = null;
    this.gamePhase = null;
  }

  // Method to perform the strategy
  performStrategy(moveValidator, details) {
    this.grid = moveValidator.grid;
    this.x = details.x;
    this.y = details.y;
    this.currentTurn = details.currentTurn;
    this.gamePhase = details.gamePhase;

    // Call the validateStonePlacement method and return its result
    return this.validateStonePlacement(this.grid, this.x, this.y);
  }

  // Method to validate stone placement
  validateStonePlacement(grid, x, y) {
    // Check if the game phase is stone phase
    if (this.gamePhase === STONE_PHASE) {
      // Get the square at the specified coordinates
      const square = grid[y][x];
      // Check if the square exists
      if (square) {
        // Check if the square is a map piece and has no stones on it
        if (square && square.type === "mapPiece" && square.stoneCount === 0) {
          // Check if the stone is adjacent to another stone
          if (this.currentTurn >= FIRST_STONE_TURNS_THRESHOLD) {
            // Get the adjacent cells
            const adjacentCells = [
              grid[y - 1] && grid[y - 1][x],
              grid[y + 1] && grid[y + 1][x],
              grid[y][x - 1],
              grid[y][x + 1],
            ];
            // Check if any of the adjacent cells have stones on them
            const hasAdjacentStone = adjacentCells.some(
              (cell) => cell && cell.stoneCount > 0
            );
            // If there are no adjacent stones, return false
            if (!hasAdjacentStone) {
              return false;
            }
          }
          // Update the board state and return true
          return true;
        }
        // If the square is not a map piece or has stones on it, return false
        return false;
      }
    }
  }
}
export class ValidateMapPiecePlacementStrategy {
  constructor() {
    this.grid = null;
    this.piece = null;
    this.x = null;
    this.y = null;
    this.currentMapPieceIndex = null;
  }

  performStrategy(moveValidator, details) {
    this.grid = moveValidator.grid;

    this.piece = details.piece;
    this.x = details.x;
    this.y = details.y;
    this.currentMapPieceIndex = details.currentMapPieceIndex;
    return this.validateMapPiecePlacement(
      this.grid,
      this.piece,
      this.x,
      this.y,
      this.currentMapPieceIndex
    );
  }
  // Validates the placement of a map piece on the game board
  validateMapPiecePlacement(grid, piece, x, y, currentPieceIndex) {
    const pieceWidth = piece.shape[0].length;
    const pieceHeight = piece.shape.length;

    // Adjust the placement coordinates to align with the center of the piece
    x = x - Math.floor(PIECE_SHAPE_SIZE / 2);
    y = y - Math.floor(PIECE_SHAPE_SIZE / 2);

    // Check if the active cells of the piece fit on the board
    for (let i = 0; i < pieceHeight; i++) {
      for (let j = 0; j < pieceWidth; j++) {
        if (piece.shape[i][j] === 1) {
          if (
            x + j >= GRID_SIZE ||
            y + i >= GRID_SIZE ||
            x + j < 0 ||
            y + i < 0
          ) {
            // The placement is out of bounds
            console.log("Invalid placement out of bounds");
            return false;
          }
        }
      }
    }

    // Check if the cells that would be occupied by placing the map piece are empty
    for (let i = 0; i < pieceHeight; i++) {
      for (let j = 0; j < pieceWidth; j++) {
        if (piece.shape[i][j] === 1 && grid[y + i][x + j] !== null) {
          // The placement overlaps with an existing piece
          console.log("Invalid placement overlap");
          return false;
        }
      }
    }

    // Additional check for the second map piece onwards
    if (currentPieceIndex > 0) {
      console.log(
        "checking adjacency for",
        grid,
        piece,
        x,
        y,
        currentPieceIndex
      );
      let isAdjacentToExistingPiece = false;
      for (let i = 0; i < pieceHeight; i++) {
        for (let j = 0; j < pieceWidth; j++) {
          if (piece.shape[i][j] === 1) {
            // Check if any adjacent cells contain an existing map piece
            if (
              (y + i > 0 && grid[y + i - 1][x + j]?.type === "mapPiece") ||
              (y + i < GRID_SIZE - 1 &&
                grid[y + i + 1][x + j]?.type === "mapPiece") ||
              (x + j > 0 && grid[y + i][x + j - 1]?.type === "mapPiece") ||
              (x + j < GRID_SIZE - 1 &&
                grid[y + i][x + j + 1]?.type === "mapPiece")
            ) {
              isAdjacentToExistingPiece = true;
            }
          }
        }
      }

      // Return if the piece is not adjacent to any existing piece
      if (!isAdjacentToExistingPiece) {
        // The placement is not adjacent to any existing piece
        console.log("Invalid placement non adjacent");
        return false;
      }
    }

    // The placement is valid
    console.log("Valid placement");
    return true;
  }
}

export class ValidateMapPieceRotationStrategy {
  constructor() {
    this.gamePhase = null;
  }

  performStrategy(moveValidator, details) {
    this.gamePhase = details.gamePhase;

    return this.gamePhase === MAP_PHASE;
  }
}

// ********************Board Meta Update Strategies********************
export class UpdateEmeperorStrategy {
  constructor() {
    // Initialize properties
    this.gridCOPY = [];
    this.currentEmperorState = [];
  }

  // Method to perform the strategy
  performStrategy(details) {
    // Store the current state of the grid
    this.gridCOPY = details.currentGridCopyState;
    this.currentEmperorState = details.currentEmperorState;
    this.updateEmperors();
  }
  updateEmperors() {
    // Update the emperor states
    for (let i = 0; i < GRID_SIZE; i++) {
      for (let j = 0; j < GRID_SIZE; j++) {
        const square = this.gridCOPY[i][j];

        if (square && square.type === "mapPiece") {
          // Check if the square is a map piece
          // Find the corresponding object in currentEmperorState
          const currentEmperor = this.currentEmperorState.find(
            (emperor) => emperor.mapPieceID === square.mapPieceID
          );
          // Check if the emperor state of the square is different from the current emperor state
          if (
            currentEmperor &&
            square.mapPiece.emperor !== currentEmperor.emperor
          ) {
            // Update the emperor state of the square
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
export class UpdateTradeRouteStrategy {
  constructor() {
    // Initialize properties
    this.gridCOPY = [];
    this.currentTradeRouteState = [];
  }

  // Method to perform the strategy
  performStrategy(details) {
    // Store the current state of the grid
    this.gridCOPY = details.currentGridCopyState;
    this.currentTradeRouteState = details.currentTradeRouteState;
    this.tradeRouteCoordinates = [];

    for (
      let i = 0;
      i < this.currentTradeRouteState[PLAYER_1].coordinates.length;
      i++
    ) {
      this.tradeRouteCoordinates.push(
        this.currentTradeRouteState[PLAYER_1].coordinates[i]
      );
    }
    for (
      let i = 0;
      i < this.currentTradeRouteState[PLAYER_2].coordinates.length;
      i++
    ) {
      this.tradeRouteCoordinates.push(
        this.currentTradeRouteState[PLAYER_2].coordinates[i]
      );
    }

    this.UpdateTradeRoutes();
  }
  UpdateTradeRoutes() {
    for (let i = 0; i < this.tradeRouteCoordinates.length; i++) {
      const tradeRouteCoordinatePair = this.tradeRouteCoordinates[i];
      const square =
        this.gridCOPY[tradeRouteCoordinatePair[0]][tradeRouteCoordinatePair[1]];

      square.isPartOfTradeRoute = true;
    }
  }
  giveUpdatedGrid() {
    return this.gridCOPY;
  }
}
export class UpdateCityStrategy {
  constructor() {
    // Initialize properties
    this.gridCOPY = [];
    this.currentCityState = [];
  }

  // Method to perform the strategy
  performStrategy(details) {
    // Store the current state of the grid
    this.gridCOPY = details.currentGridCopyState;
    this.currentCityState = details.currentCityState;
    this.cityCoordinates = [];

    for (
      let i = 0;
      i < this.currentCityState[PLAYER_1].coordinates.length;
      i++
    ) {
      this.cityCoordinates.push(this.currentCityState[PLAYER_1].coordinates[i]);
    }
    for (
      let i = 0;
      i < this.currentCityState[PLAYER_2].coordinates.length;
      i++
    ) {
      this.cityCoordinates.push(this.currentCityState[PLAYER_2].coordinates[i]);
    }

    this.updateCities();
  }
  updateCities() {
    for (let i = 0; i < this.cityCoordinates.length; i++) {
      const cityCoordinatePair = this.cityCoordinates[i];
      const square =
        this.gridCOPY[cityCoordinatePair[0]][cityCoordinatePair[1]];

      square.isPartOfCity = true;
    }
  }
  giveUpdatedGrid() {
    return this.gridCOPY;
  }
}

// ********************Board Injection Update Strategies********************
export class AddStoneStrategy {
  constructor() {
    // Initialize properties
    this.gridCOPY = []; // A copy of the current game board
    this.shape = null;
    this.x = null; // The x-coordinate of the stone
    this.y = null; // The y-coordinate of the stone
    this.player = null; // The player who is adding the stone
  }

  // Method to perform the strategy
  performStrategy(details) {
    // Store the current state of the grid
    this.gridCOPY = details.currentGridCopyState;

    // Set the player and the coordinates of the stone
    this.player = details.currentPlayer;
    this.x = details.x;
    this.y = details.y;

    // Add the stone to the game board
    this.addStone();
  }

  // Method to return the updated game board
  giveUpdatedGrid() {
    return this.gridCOPY;
  }
  clearFlags() {
    for (let i = 0; i < this.gridCOPY.length; i++) {
      for (let j = 0; j < this.gridCOPY[i].length; j++) {
        if (this.gridCOPY[i][j] !== null) {
          this.gridCOPY[i][j].lastPlayed = false;
          this.gridCOPY[i][j].isPartOfTradeRoute = false; // Reset the trade route flag of the square
          this.gridCOPY[i][j].isPartOfCity = false;
        }
      }
    }
  }

  // Method to add the stone to the game board
  addStone() {
    this.clearFlags();
    const square = this.gridCOPY[this.y][this.x]; // Get the square where the stone is being added

    if (square && square.type === "mapPiece") {
      // Check if the square is a map piece
      // Inject the stone into the map piece and board
      square.stoneCount++; // Increment the stone count of the square
      square.stoneOwner = this.player; // Set the owner of the stone
      square.mapPiece.shapeRelativeStoneFlags[square.pieceSquareIndex] =
        this.player; // Set the owner of the stone in the map piece
      square.mapPiece.stoneCount++; // Increment the stone count of the map piece
      square.lastPlayed = true; // Set the last played flag of the square
    }
  }
}
export class AddMapPieceStrategy {
  constructor() {
    // Initialize properties
    this.gridCOPY = [];
    this.shape = null;
    this.x = null;
    this.y = null;
  }

  // Method to perform the strategy
  performStrategy(details) {
    // Store the current state of the grid
    this.gridCOPY = details.currentGridCopyState;
    // Set the piece and its placement coordinates
    this.piece = details.piece;
    this.x = details.x - Math.floor(PIECE_SHAPE_SIZE / 2);
    this.y = details.y - Math.floor(PIECE_SHAPE_SIZE / 2);

    // Add the map piece to the game board
    this.addMapPiece();
  }

  // Method to return the updated game board
  giveUpdatedGrid() {
    return this.gridCOPY;
  }

  // Method to add the map piece to the game board
  addMapPiece() {
    // Get the dimensions of the map piece
    const pieceWidth = this.piece.shape[0].length;
    const pieceHeight = this.piece.shape.length;

    // Adjust the placement coordinates to align with the center of the piece
    const x = this.x;
    const y = this.y;

    // Loop through each square of the map piece
    for (let i = 0; i < pieceHeight; i++) {
      for (let j = 0; j < pieceWidth; j++) {
        // If the square is part of the map piece
        if (this.piece.shape[i][j] === 1) {
          // Calculate the absolute position of the square on the game board
          const squareX = x + j;
          const squareY = y + i;

          // Find the index of the square within the map piece
          const squareIndex = this.piece.shapeRelativeSquareLocations.find(
            (loc) => loc.x === j && loc.y === i
          ).index;

          // Add the square to the game board
          this.gridCOPY[squareY][squareX] = {
            type: "mapPiece",
            lastPlayed: false,
            isPartOfTradeRoute: false,
            isPartOfCity: false,
            color: this.piece.color,
            mapPiece: this.piece, // Store a reference to the MapPiece
            pieceSquareIndex: squareIndex, // Set id to the index of the square within the map piece
            mapPieceID: this.piece.id,
            stoneCount: 0,
            stoneOwner: null,
            cellSquareLocation: {
              x: squareX,
              y: squareY,
            },
          };

          // Update the absolute position of the square within the map piece
          this.piece.boardRelativeSquareLocations[squareIndex] = {
            x: squareX,
            y: squareY,
          };
        }
      }
    }
  }
}
export class AddNaturalResourceStrategy {
  constructor() {
    // Initialize properties
    this.quadrantSize = 0;
    this.gridSize = 0;
    this.quadrants = [];

    this.gridCOPY = [];
  }

  // Method to perform the strategy
  performStrategy(details) {
    // Store the current state of the grid
    this.gridCOPY = details.currentGridCopyState;

    // Calculate the size of the grid and the quadrants
    this.gridSize = this.gridCOPY.length;
    this.quadrantSize = Math.floor(this.gridSize / GRID_OFFSET);

    // Define the quadrants
    this.quadrants = this.defineQuadrants(this.quadrantSize);

    // Add natural resources to the game board
    for (let i = 0; i < TOTAL_RESOURCES; i++) {
      let resourcePosition;
      do {
        // Generate a random position for the resource
        resourcePosition = this.generateRandomPosition(
          i,
          this.quadrants,
          this.quadrantSize
        );
      } while (!this.isValidResourcePosition(resourcePosition));

      // Add the resource to the game board
      this.gridCOPY[resourcePosition.y][resourcePosition.x] = {
        type: "naturalResource",
        stones: 0,
        stoneOwner: null,
      };
    }
  }

  // Method to generate random position in a given quadrant.
  generateRandomPosition(i, quadrants, quadrantSize) {
    // Choose the quadrant based on the index 'i'.
    const quadrant = quadrants[i];

    // Compute a random offset within the quadrant, making sure to stay within the grid.
    const offset = Math.floor(Math.random() * (quadrantSize - GRID_OFFSET));

    // Return an object containing 'x' and 'y' coordinates of the random position.
    return {
      // Adjust 'x' coordinate based on quadrant's 'dx' direction and quadrantSize.
      x:
        quadrant.x +
        quadrant.dx * offset +
        (quadrant.dx > 0 ? 0 : quadrantSize - GRID_OFFSET),
      // Adjust 'y' coordinate based on quadrant's 'dy' direction and quadrantSize.
      y:
        quadrant.y +
        quadrant.dy * offset +
        (quadrant.dy > 0 ? 0 : quadrantSize - GRID_OFFSET),
    };
  }

  // Method to define quadrants based on quadrantSize as to avoid the edges of the board.
  defineQuadrants(quadrantSize) {
    return [
      { x: 1, y: 1, dx: 1, dy: 1 }, // Top-left quadrant
      { x: quadrantSize, y: 1, dx: -1, dy: 1 }, // Top-right quadrant
      { x: 1, y: quadrantSize, dx: 1, dy: -1 }, // Bottom-left quadrant
      { x: quadrantSize, y: quadrantSize, dx: -1, dy: -1 }, // Bottom-right quadrant
    ];
  }

  // Method to check if a resource position is valid (not adjacent to existing resources)
  isValidResourcePosition({ x, y }) {
    return ADJACENT_OFFSETS.every((offset) => {
      const newX = x + offset.dx;
      const newY = y + offset.dy;
      return (
        !this.isWithinGrid(newX, newY) || this.gridCOPY[newY][newX] === null
      );
    });
  }

  // Method to check if a position is within the game board grid
  isWithinGrid(x, y) {
    return x >= 0 && x < this.gridSize && y >= 0 && y < this.gridSize;
  }

  // Method to return the updated grid after the strategy is applied
  giveUpdatedGrid() {
    return this.gridCOPY;
  }
}
