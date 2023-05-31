const GRID_SIZE = 14;
const PLAYER_ONE = "p1";
const PLAYER_TWO = "p2";
const PIECE_SHAPE_SIZE = 7;
const PIECE_COUNT = 10;
const INITIAL_MAP_PIECE_INDEX = 0;
const FIRST_STONE_TURNS_THRESHOLD = 11;
const MAP_PHASE_TURNS_THRESHOLD = 10;
const CITY_LENGTH_THRESHOLD = 3;
const INITIAL_SHAPE_VALUE = 1;
const FORCED_PIECE_SHAPE_THRESHOLD = 4;
const GLOBAL_WARMING_BASE_CHANCE = 0.003;
const TOTAL_RESOURCES = 4;
const GRID_OFFSET = 2;
const ADJACENT_OFFSETS = [
  {
    dx: -1,
    dy: 0,
  }, // Left
  {
    dx: 1,
    dy: 0,
  }, // Right
  {
    dx: 0,
    dy: -1,
  }, // Up
  {
    dx: 0,
    dy: 1,
  }, // Down
  {
    dx: -1,
    dy: -1,
  }, // Diagonal: Top-left
  {
    dx: 1,
    dy: -1,
  }, // Diagonal: Top-right
  {
    dx: -1,
    dy: 1,
  }, // Diagonal: Bottom-left
  {
    dx: 1,
    dy: 1,
  }, // Diagonal: Bottom-right
];
// Game class to keep track of game logic, initiate the game, and help other classes verify moves
class Game {
  constructor() {
    // Game board size
    this.GRID_SIZE = GRID_SIZE;
    this.turns = 1;
    this.player1 = PLAYER_ONE;
    this.player2 = PLAYER_TWO;
    this.currentPlayer = this.player1;
    this.winner = null;
    this.gamePhase = "map";
    // Number of map pieces and their shape size
    this.PIECE_SHAPE_SIZE = PIECE_SHAPE_SIZE;
    this.PIECE_COUNT = PIECE_COUNT; // Updated piece count to 10
    this.pieceBag = new MapPieceBag(this.PIECE_SHAPE_SIZE, this.PIECE_COUNT);
    // Current index of the active map piece
    this.currentMapPieceIndex = INITIAL_MAP_PIECE_INDEX;
    this.removedPeninsulas = [];
    this.board = new Board(
      this.GRID_SIZE,
      () => this.renderer.rerender(),
      this
    ); // Pass the game instance to the Board
    this.subscribers = [];
    this.renderer = new Renderer(this); // Pass the game instance to the Renderer
    this.renderer.setBoard(this.board);
    this.eventListener = new EventListener(this, this.board); // Pass the board instance to the EventListener
    this.stateStack = [];
    this.globalWarmingChance = 0;
  }
  subscribe(callback) {
    this.subscribers.push(callback);
  }
  //Method to check if all map pieces are fully saturated with stones
  areAllPiecesSaturated() {
    return this.pieceBag.mapPieces.every(
      (piece) => piece.stones === piece.shapeRelativeSquareLocations.length
    );
  }
  findAdjacentResources(boardMatrix) {
    const adjacentResources = {
      p1: 0,
      p2: 0,
    };

    for (let i = 0; i < boardMatrix.length; i++) {
      for (let j = 0; j < boardMatrix[i].length; j++) {
        if (boardMatrix[i][j] === "r") {
          const adjacentCells = [
            boardMatrix[i - 1] && boardMatrix[i - 1][j],
            boardMatrix[i + 1] && boardMatrix[i + 1][j],
            boardMatrix[i][j - 1],
            boardMatrix[i][j + 1],
          ];
          adjacentCells.forEach((adjacentCell) => {
            if (adjacentCell === "p1" || adjacentCell === "p2") {
              adjacentResources[adjacentCell]++;
            }
          });
        }
      }
    }

    return adjacentResources;
  }

  calcGlobalWarmingChance() {
    const baseChance = GLOBAL_WARMING_BASE_CHANCE; // The base chance of global warming
    const turnsFactor = Math.pow(2, (this.turns - 10) / 10); // Exponentially increase chance based on the number of turns
    const removedPeninsulasFactor =
      this.removedPeninsulas.length > 0
        ? Math.pow(3, this.removedPeninsulas.length - 1) / 25
        : 0; // Exponentially decrease chance based on the number of removed peninsulas
    this.globalWarmingChance = Math.max(
      0,
      baseChance * turnsFactor - removedPeninsulasFactor
    );
  }
  handleGlobalWarming() {
    this.calcGlobalWarmingChance();
    console.log("global warming chance: ", this.globalWarmingChance);
    const globalWarmingCheckbox = document.getElementById("checkGlobalWarming");
    if (!globalWarmingCheckbox.checked) {
      return;
    }
    const { peninsulas } = this.findPeninsulas();
    const gridsToRemove = peninsulas
      .filter((peninsula) => {
        const roll = Math.random();
        console.log(
          `Roll for peninsula at (${peninsula.x}, ${peninsula.y}): ${roll}`
        );
        if (roll < this.globalWarmingChance) {
          console.log(
            `Peninsula at (${peninsula.x}, ${peninsula.y}) affected by global warming.`
          );
          this.removedPeninsulas.push({
            x: peninsula.x,
            y: peninsula.y,
            time: Date.now(),
          });
          this.calcGlobalWarmingChance();
          console.log("new chance:", this.globalWarmingChance);
          return true;
        }
        return false;
      })
      .map(({ x, y }) => ({
        x,
        y,
        mapPiece: this.board.grid[y][x].mapPiece,
      }));
    gridsToRemove.forEach(({ x, y, mapPiece }) =>
      this.removeGrid(x, y, mapPiece)
    );
    // Update cities and trade routes
    const matrix = this.board.getBoardMatrix();
    this.findCities(matrix);
    this.findTradeRoutes(matrix);
    // Log removed peninsulas
    console.log("Removed peninsulas:", this.removedPeninsulas);
  }
  removeGrid(x, y, mapPiece) {
    // 1. Update the specific map piece objects
    const square = this.board.grid[y][x];
    if (
      square &&
      square.type === "mapPiece" &&
      square.mapPiece.id === mapPiece.id
    ) {
      const squareIndex = square.id;
      // Update the shapeRelativeSquareLocations and squareLocationStonePlayer arrays
      mapPiece.shapeRelativeSquareLocations =
        mapPiece.shapeRelativeSquareLocations
          .filter((loc) => loc.index !== squareIndex)
          .map((loc, index) => ({
            ...loc,
            index,
          }));
      mapPiece.squareLocationStonePlayer =
        mapPiece.squareLocationStonePlayer.filter(
          (player, index) => index !== squareIndex
        );
      mapPiece.absoluteSquareLocations = mapPiece.absoluteSquareLocations
        .filter((loc, index) => index !== squareIndex)
        .map((loc, index) => ({
          ...loc,
          index,
        }));
      // Update the id property of the remaining squares in the map piece
      for (let i = 0; i < this.board.grid.length; i++) {
        for (let j = 0; j < this.board.grid[i].length; j++) {
          const cell = this.board.grid[i][j];
          if (
            cell &&
            cell.type === "mapPiece" &&
            cell.mapPiece.id === mapPiece.id
          ) {
            cell.id = mapPiece.absoluteSquareLocations.findIndex(
              (loc) =>
                loc.x === cell.cellSquareLocation.x &&
                loc.y === cell.cellSquareLocation.y
            );
          }
        }
      }
      // Recreate the shape and replace the old shape
      mapPiece.shape = this.recreateShape(
        mapPiece.shapeRelativeSquareLocations
      );
      mapPiece.stones = mapPiece.squareLocationStonePlayer.filter(
        (player) => player !== false
      ).length;
      // 2. Update the board grid
      this.board.grid[y][x] = null;
      // 3. Update the cell references in the entire grid
      for (let i = 0; i < this.board.grid.length; i++) {
        for (let j = 0; j < this.board.grid[i].length; j++) {
          const cell = this.board.grid[i][j];
          if (
            cell &&
            cell.type === "mapPiece" &&
            cell.mapPiece.id === mapPiece.id
          ) {
            if (i === y && j === x) {
              cell.mapPiece = null;
              cell.stoneOwner = null;
              cell.stones = 0;
              cell.type = null;
            }
          }
        }
      }
      // 4. Rerender the board
      this.renderer.render();
    }
  }
  recreateShape(shapeRelativeSquareLocations) {
    // Initialize a 7x7 array with all zeros
    let shape = Array(7)
      .fill()
      .map(() => Array(7).fill(0));
    // For each location in shapeRelativeSquareLocations, set the corresponding position in the shape array to 1
    shapeRelativeSquareLocations.forEach((location) => {
      shape[location.y][location.x] = 1;
    });
    return shape;
  }
  checkStateConsistency() {
    const mapPieceStones = new Map(); // Map to store the running sum of stones for each map piece
    for (let i = 0; i < this.GRID_SIZE; i++) {
      for (let j = 0; j < this.GRID_SIZE; j++) {
        const cell = this.board.grid[i][j];
        if (cell && cell.type === "mapPiece") {
          const mapPiece = cell.mapPiece;
          // Check if the cellSquareLocation coordinates exist in the corresponding map piece object's absoluteSquareLocations
          const cellSquareLocation = cell.cellSquareLocation;
          if (
            !mapPiece.absoluteSquareLocations.some(
              (loc) =>
                loc.x === cellSquareLocation.x && loc.y === cellSquareLocation.y
            )
          ) {
            console.error(
              `Inconsistent cellSquareLocation at (${cellSquareLocation.x}, ${cellSquareLocation.y})`
            );
          }
          // Check if the color of the grid position matches the color of the map piece object
          if (cell.color !== mapPiece.color) {
            console.error(
              `Inconsistent color at (${cellSquareLocation.x}, ${cellSquareLocation.y})`
            );
          }
          // Calculate the aggregate sum of the stones for the current map piece (if not already calculated)
          if (!mapPieceStones.has(mapPiece.id)) {
            let mapPieceStonesSum = 0;
            for (const [y, row] of this.board.grid.entries()) {
              for (const [x, gridCell] of row.entries()) {
                if (
                  gridCell &&
                  gridCell.type === "mapPiece" &&
                  gridCell.color === mapPiece.color
                ) {
                  mapPieceStonesSum += gridCell.stones;
                }
              }
            }
            mapPieceStones.set(mapPiece.id, mapPieceStonesSum);
          }
          const gridStonesSum = mapPieceStones.get(mapPiece.id);
          // Check if the aggregate sum of the stones that the grid believes belong to the map piece is consistent with the map piece object's stones value
          if (gridStonesSum !== mapPiece.stones) {
            console.error(
              `Inconsistent stones at (${cellSquareLocation.x}, ${cellSquareLocation.y})`
            );
          }
          // Check if the stoneOwner of each cell is consistent with the squareLocationStonePlayer of the map piece object
          if (
            cell.stoneOwner !== mapPiece.squareLocationStonePlayer[cell.id] &&
            !(
              mapPiece.squareLocationStonePlayer[cell.id] === false ||
              (mapPiece.squareLocationStonePlayer[cell.id] === undefined &&
                cell.stoneOwner === null)
            )
          ) {
            console.error(
              `Inconsistent stoneOwner at (${cellSquareLocation.x}, ${
                cellSquareLocation.y
              }): cell.stoneOwner=${
                cell.stoneOwner
              }, mapPiece.squareLocationStonePlayer[cell.id]=${
                mapPiece.squareLocationStonePlayer[cell.id]
              }`
            );
          }
          // Check if the number of references to the map piece on the grid is in line with the length of the map piece object's absoluteSquareLocations
          const gridReferenceCount = this.board.grid.reduce(
            (count, row) =>
              count +
              row.filter(
                (c) =>
                  c && c.type === "mapPiece" && c.mapPiece.id === mapPiece.id
              ).length,
            0
          );
          if (gridReferenceCount !== mapPiece.absoluteSquareLocations.length) {
            console.error(
              `Inconsistent map piece reference count for map piece ${mapPiece.id}. Grid reference count: ${gridReferenceCount}, absoluteSquareLocations length: ${mapPiece.absoluteSquareLocations.length}`
            );
          }
        }
      }
    }
  }
  arraysEqual(arr1, arr2) {
    if (arr1.length !== arr2.length) {
      return false;
    }
    for (let i = 0; i < arr1.length; i++) {
      if (!arr1[i].every((val, index) => val === arr2[i][index])) {
        return false;
      }
    }
    return true;
  }
  findPeninsulas() {
    const peninsulas = [];
    const affectedMapPieces = [];
    const matrix = this.board.getBoardMatrix();
    for (let i = 1; i < this.GRID_SIZE - 1; i++) {
      for (let j = 1; j < this.GRID_SIZE - 1; j++) {
        if (matrix[i][j] !== "0" && matrix[i][j] !== "r") {
          // If the cell is not an ocean or natural resource cell
          const adjacentCells = [
            matrix[i - 1][j],
            matrix[i + 1][j],
            matrix[i][j - 1],
            matrix[i][j + 1],
          ];
          const oceanCells = adjacentCells.filter((cell) => cell === "0");
          if (oceanCells.length === 3) {
            // If the cell is surrounded by ocean cells on three sides
            peninsulas.push({
              x: j,
              y: i,
            });
            const mapPiece = this.board.grid[i][j].mapPiece; // Get the map piece at the coordinates
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
  calculateScore() {
    let p1Penalty = 0;
    const tradeRoutesCheckbox = document.getElementById("checkTradeRoutes");
    if (tradeRoutesCheckbox.checked) {
      p1Penalty = 2;
    }
    const emperors = this.countEmperors();
    let tradeRoutes = this.findTradeRoutes(this.board.getBoardMatrix());
    const cities = this.findCities(this.board.getBoardMatrix());
    const resources = this.findAdjacentResources(this.board.getBoardMatrix());
    console.log("score method thiks resources are", resources);
    const populations = this.findRuledPopulation();
    const scores = {
      [this.player1]:
        emperors[this.player1] +
        cities["p1"] * 3 +
        tradeRoutes["p1"].count +
        tradeRoutes["p1"].totalLength +
        populations[this.player1] -
        p1Penalty +
        resources["p1"] * 2,
      [this.player2]:
        emperors[this.player2] +
        cities["p2"] * 3 +
        tradeRoutes["p2"].count +
        tradeRoutes["p2"].totalLength +
        populations[this.player2] +
        resources["p2"] * 2,
    };
    return scores;
  }
  nextMapPiece() {
    // Increment the index of the active map piece
    this.currentMapPieceIndex++;
    // Cycle to the first map piece if it exceeds the piece count
    if (this.currentMapPieceIndex >= this.PIECE_COUNT) {
      this.currentMapPieceIndex = 0;
    }
  }
  findTradeRoutes(matrix) {
    // Reset isPartOfTradeRoute flag for all cells
    for (let i = 0; i < this.board.grid.length; i++) {
      for (let j = 0; j < this.board.grid[i].length; j++) {
        if (this.board.grid[i][j]) {
          this.board.grid[i][j].isPartOfTradeRoute = false;
        }
      }
    }
    const tradeRoutesCheckbox = document.getElementById("checkTradeRoutes");
    const tradeRoutes = {
      p1: {
        count: 0,
        totalLength: 0,
      },
      p2: {
        count: 0,
        totalLength: 0,
      },
    };
    if (!tradeRoutesCheckbox.checked) {
      return tradeRoutes;
    }
    for (let i = 0; i < matrix.length; i++) {
      for (let j = 0; j < matrix[i].length; j++) {
        if (matrix[i][j] === "p1" || matrix[i][j] === "p2") {
          let player = matrix[i][j];
          let routeLength = 0; // start with 0
          // Check down direction
          for (let k = i + 1; k < matrix.length; k++) {
            if (matrix[k][j] === "0") {
              routeLength++;
            } else if (matrix[k][j] === player && routeLength > 0) {
              // check if routeLength > 0
              tradeRoutes[player].count++;
              tradeRoutes[player].totalLength += routeLength;
              for (let l = i; l <= k; l++) {
                if (this.board.grid[l][j]) {
                  this.board.grid[l][j].isPartOfTradeRoute = true;
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
          for (let k = j + 1; k < matrix[i].length; k++) {
            if (matrix[i][k] === "0") {
              routeLength++;
            } else if (matrix[i][k] === player && routeLength > 0) {
              // check if routeLength > 0
              tradeRoutes[player].count++;
              tradeRoutes[player].totalLength += routeLength;
              for (let l = j; l <= k; l++) {
                if (this.board.grid[i][l]) {
                  this.board.grid[i][l].isPartOfTradeRoute = true;
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
    return tradeRoutes;
  }
  findRuledPopulation() {
    const ruledPopulation = {
      [this.player1]: 0,
      [this.player2]: 0,
    };
    this.pieceBag.mapPieces.forEach((mapPiece) => {
      if (mapPiece.emperor !== null) {
        const mapPieceLength = mapPiece.shape.reduce(
          (acc, row) => acc + row.filter((cell) => cell === 1).length,
          0
        );
        ruledPopulation[mapPiece.emperor] += mapPieceLength;
      }
    });
    return ruledPopulation;
  }
  findCities(matrix) {
    // Reset isPartOfCity flag for all cells
    for (let i = 0; i < this.board.grid.length; i++) {
      for (let j = 0; j < this.board.grid[i].length; j++) {
        if (this.board.grid[i][j]) {
          this.board.grid[i][j].isPartOfCity = false;
        }
      }
    }
    const CitiesCheckbox = document.getElementById("checkCities");
    const cities = {
      p1: 0,
      p2: 0,
    };
    if (!CitiesCheckbox.checked) {
      return cities;
    }
    const visitedHorizontal = matrix.map((row) => row.map(() => false));
    const visitedVertical = matrix.map((row) => row.map(() => false));
    for (let i = 0; i < matrix.length; i++) {
      for (let j = 0; j < matrix[i].length; j++) {
        if (matrix[i][j] === "p1" || matrix[i][j] === "p2") {
          let player = matrix[i][j];
          let cityLength = 1; // Start with 1 to include the current cell
          // Check down direction
          if (!visitedVertical[i][j]) {
            visitedVertical[i][j] = true; // Mark the current cell as visited
            for (let k = i + 1; k < matrix.length; k++) {
              if (matrix[k][j] === player) {
                cityLength++;
                visitedVertical[k][j] = true;
              } else {
                break;
              }
            }
            if (cityLength >= CITY_LENGTH_THRESHOLD) {
              cities[player]++;
              for (let k = i; k < i + cityLength; k++) {
                this.board.grid[k][j].isPartOfCity = true;
              }
            }
          }
          // Reset cityLength for horizontal check
          cityLength = 1; // Reset to 1 to include the current cell
          // Check right direction
          if (!visitedHorizontal[i][j]) {
            visitedHorizontal[i][j] = true; // Mark the current cell as visited
            for (let k = j + 1; k < matrix[i].length; k++) {
              if (matrix[i][k] === player) {
                cityLength++;
                visitedHorizontal[i][k] = true;
              } else {
                break;
              }
            }
            if (cityLength >= CITY_LENGTH_THRESHOLD) {
              cities[player]++;
              for (let k = j; k < j + cityLength; k++) {
                this.board.grid[i][k].isPartOfCity = true;
              }
            }
          }
        }
      }
    }
    return cities;
  }
  countEmperors() {
    const emperors = {
      [this.player1]: 0,
      [this.player2]: 0,
    };
    const uniqueMapPieces = this.board.logUniqueMapPieces();
    console.log(uniqueMapPieces);
    for (let i = 0; i < uniqueMapPieces.length; i++) {
      const mapPiece = uniqueMapPieces[i];
      const squareLocationStonePlayer = mapPiece.squareLocationStonePlayer;
      let player1Count = 0;
      let player2Count = 0;
      for (let j = 0; j < squareLocationStonePlayer.length; j++) {
        const player = squareLocationStonePlayer[j];
        if (player !== false) {
          if (player === this.player1) {
            player1Count++;
          } else if (player === this.player2) {
            player2Count++;
          }
        }
      }
      if (player1Count > player2Count) {
        emperors[this.player1]++;
        this.updateMapPieceEmperor(mapPiece.id, this.player1);
      } else if (player2Count > player1Count) {
        emperors[this.player2]++;
        this.updateMapPieceEmperor(mapPiece.id, this.player2);
      } else {
        this.updateMapPieceEmperor(mapPiece.id, null);
      }
    }
    return emperors;
  }
  updateMapPieceEmperor(id, player) {
    const mapPiece = this.pieceBag.mapPieces[id - 1]; // Subtract 1 since IDs are 1-based
    mapPiece.emperor = player;
  }
  placeStone(x, y) {
    const currentState = {
      grid: JSON.parse(JSON.stringify(this.board.grid)),
      currentPlayer: this.currentPlayer,
      turns: this.turns,
      currentMapPieceIndex: this.currentMapPieceIndex,
      gamePhase: this.gamePhase,
      lastPlayed: this.board.lastPlayed
        ? {
            ...this.board.lastPlayed,
          }
        : null,
      mapPieces: this.pieceBag.mapPieces.map((piece) => ({
        ...piece,
        squareLocationStonePlayer: [...piece.squareLocationStonePlayer], // Create a copy of the array
      })),
      mapPieceBag: JSON.parse(JSON.stringify(this.pieceBag)), // Add this line
      removedPeninsulas: [...this.removedPeninsulas], // Create a copy of the array
      globalWarmingChance: this.globalWarmingChance,
    };
    if (this.gamePhase === "stone") {
      // Check if the selected square is a valid map piece and is not occupied
      const square = this.board.grid[y][x];
      if (square) {
        console.log("square:", square);
        console.log("square.id:", square.id);
        const piece = this.pieceBag.mapPieces[this.currentMapPieceIndex]; // Get the current map piece
        if (square && square.type === "mapPiece" && square.stones === 0) {
          // Check if the stone is adjacent to another stone
          if (this.turns > FIRST_STONE_TURNS_THRESHOLD) {
            const adjacentCells = [
              this.board.grid[y - 1] && this.board.grid[y - 1][x],
              this.board.grid[y + 1] && this.board.grid[y + 1][x],
              this.board.grid[y][x - 1],
              this.board.grid[y][x + 1],
            ];
            const hasAdjacentStone = adjacentCells.some(
              (cell) => cell && cell.stones > 0
            );
            if (!hasAdjacentStone) {
              return;
            }
          }
          if (this.board.lastPlayed) {
            const lastPlayedSquare =
              this.board.grid[this.board.lastPlayed.y][this.board.lastPlayed.x];
            if (lastPlayedSquare) {
              lastPlayedSquare.lastPlayed = false;
            }
          }
          this.board.lastPlayed = {
            x,
            y,
          };
          // Update the board state
          this.board.addStone(x, y, this.currentPlayer);
          const peninsulas = this.findPeninsulas();
          console.log(peninsulas);
          this.findRuledPopulation();

          // Switch player
          this.stateStack.push(currentState);
          this.switchPlayers();
          this.checkStateConsistency();
        }
      }
    }
  }
  placeMapPiece(piece, x, y) {
    const currentState = {
      grid: JSON.parse(JSON.stringify(this.board.grid)),
      currentPlayer: this.currentPlayer,
      turns: this.turns,
      currentMapPieceIndex: this.currentMapPieceIndex,
      gamePhase: this.gamePhase,
      lastPlayed: this.board.lastPlayed
        ? {
            ...this.board.lastPlayed,
          }
        : null,
      mapPieces: this.pieceBag.mapPieces.map((piece) => ({
        ...piece,
        squareLocationStonePlayer: [...piece.squareLocationStonePlayer], // Create a copy of the array
      })),
      mapPieceBag: JSON.parse(JSON.stringify(this.pieceBag)), // Add this line
      removedPeninsulas: [...this.removedPeninsulas], // Create a copy of the array
      globalWarmingChance: this.globalWarmingChance,
    };
    if (this.gamePhase === "map") {
      const pieceWidth = piece.shape[0].length;
      const pieceHeight = piece.shape.length;
      // Adjust the placement coordinates to align with the center of the piece
      x = x - Math.floor(this.PIECE_SHAPE_SIZE / 2);
      y = y - Math.floor(this.PIECE_SHAPE_SIZE / 2);
      // Check if the active cells of the piece fit on the board
      for (let i = 0; i < pieceHeight; i++) {
        for (let j = 0; j < pieceWidth; j++) {
          if (piece.shape[i][j] === 1) {
            if (
              x + j >= this.GRID_SIZE ||
              y + i >= this.GRID_SIZE ||
              x + j < 0 ||
              y + i < 0
            ) {
              return;
            }
          }
        }
      }
      // Check if the cells that would be occupied by placing the map piece are empty
      for (let i = 0; i < pieceHeight; i++) {
        for (let j = 0; j < pieceWidth; j++) {
          if (
            piece.shape[i][j] === 1 &&
            this.board.grid[y + i][x + j] !== null
          ) {
            return;
          }
        }
      }
      // Additional check for the second map piece onwards
      if (this.currentMapPieceIndex > 0) {
        let isAdjacentToExistingPiece = false;
        for (let i = 0; i < pieceHeight; i++) {
          for (let j = 0; j < pieceWidth; j++) {
            if (piece.shape[i][j] === 1) {
              // Check if any adjacent cells contain an existing map piece
              if (
                (y + i > 0 &&
                  this.board.grid[y + i - 1][x + j]?.type === "mapPiece") ||
                (y + i < this.GRID_SIZE - 1 &&
                  this.board.grid[y + i + 1][x + j]?.type === "mapPiece") ||
                (x + j > 0 &&
                  this.board.grid[y + i][x + j - 1]?.type === "mapPiece") ||
                (x + j < this.GRID_SIZE - 1 &&
                  this.board.grid[y + i][x + j + 1]?.type === "mapPiece")
              ) {
                isAdjacentToExistingPiece = true;
                break;
              }
            }
          }
          if (isAdjacentToExistingPiece) {
            break;
          }
        }
        // Return if the piece is not adjacent to any existing piece
        if (!isAdjacentToExistingPiece) {
          return;
        }
      }
      // Update the board state
      this.board.addMapPiece(piece, x, y);
      this.stateStack.push(currentState);
      // Switch player and cycle to the next available map piece
      this.switchPlayers();
      this.nextMapPiece();
      this.checkStateConsistency();
    }
  }
  undo() {
    if (this.stateStack.length > 0) {
      const previousState = this.stateStack.pop();
      // Restore the game state from the previous state
      this.removedPeninsulas = [...previousState.removedPeninsulas]; // Create a copy of the array
      this.globalWarmingChance = previousState.globalWarmingChance;
      this.board.grid = JSON.parse(JSON.stringify(previousState.grid)); // Deep copy
      this.currentPlayer = previousState.currentPlayer;
      this.turns = previousState.turns;
      this.currentMapPieceIndex = previousState.currentMapPieceIndex;
      this.gamePhase = previousState.gamePhase;
      this.board.lastPlayed = previousState.lastPlayed;
      // Restore the squareLocationStonePlayer array, emperor attribute, shapeRelativeSquareLocations, absoluteSquareLocations, shape, and stones in each map piece
      this.pieceBag.mapPieces.forEach((mapPiece, index) => {
        mapPiece.squareLocationStonePlayer = [
          ...previousState.mapPieces[index].squareLocationStonePlayer,
        ]; // Create a copy of the array
        mapPiece.emperor = previousState.mapPieces[index].emperor;
        mapPiece.shapeRelativeSquareLocations = [
          ...previousState.mapPieces[index].shapeRelativeSquareLocations,
        ]; // Create a copy of the array
        mapPiece.absoluteSquareLocations = [
          ...previousState.mapPieces[index].absoluteSquareLocations,
        ]; // Create a copy of the array
        mapPiece.shape = [...previousState.mapPieces[index].shape]; // Create a copy of the array
        mapPiece.stones = previousState.mapPieces[index].stones;
        // Update the references to the squareLocationStonePlayer array in the squares on the board
        this.board.grid.forEach((row) => {
          row.forEach((cell) => {
            if (
              cell &&
              cell.type === "mapPiece" &&
              cell.mapPiece.id === mapPiece.id
            ) {
              cell.mapPiece.squareLocationStonePlayer =
                mapPiece.squareLocationStonePlayer;
              cell.mapPiece = mapPiece; // Restore the mapPiece reference
              cell.stoneOwner =
                previousState.grid[cell.cellSquareLocation.y][
                  cell.cellSquareLocation.x
                ].stoneOwner; // Restore the stoneOwner
              cell.stones =
                previousState.grid[cell.cellSquareLocation.y][
                  cell.cellSquareLocation.x
                ].stones; // Restore the stones
              cell.type =
                previousState.grid[cell.cellSquareLocation.y][
                  cell.cellSquareLocation.x
                ].type; // Restore the type
            }
          });
        });
      });
      // Restore the isPartOfCity and isPartOfTradeRoute flags in each square
      this.board.grid.forEach((row, rowIndex) => {
        row.forEach((cell, cellIndex) => {
          if (cell && cell.type === "mapPiece") {
            cell.isPartOfCity =
              previousState.grid[rowIndex][cellIndex].isPartOfCity;
            cell.isPartOfTradeRoute =
              previousState.grid[rowIndex][cellIndex].isPartOfTradeRoute;
          }
        });
      });
      // Notify subscribers of game state change
      this.subscribers.forEach((callback) => callback());
    }
  }
  startGame() {
    this.pieceBag.logGeneratedShapes();
  }
  //Method to check if the game is over
  isGameOver() {
    if (this.areAllPiecesSaturated()) {
      console.log("Game over! All map pieces are fully saturated with stones.");
      return true;
    }
    return false;
  }
  //Method to switch players
  switchPlayers() {
    this.currentPlayer =
      this.currentPlayer === this.player1 ? this.player2 : this.player1;
    //increment this.turns
    this.turns++;
    if (this.isGameOver()) {
      console.log("Game over! All map pieces are fully saturated with stones.");
      return;
    }
    this.checkIfMapPhaseIsOver();
    // Notify subscribers of game state change
    this.subscribers.forEach((callback) => callback());
  }
  //check if the number of turns has surpassed the value of the current map index value and change the phase to stone if it has
  checkIfMapPhaseIsOver() {
    if (this.turns > MAP_PHASE_TURNS_THRESHOLD) {
      this.gamePhase = "stone";
      this.handleGlobalWarming();
    }
  }
}

class MapPieceBag {
  static generateRandomColor(colorIndices) {
    const colors = [
      "red",
      "blue",
      "green",
      "yellow",
      "purple",
      "orange",
      "cyan",
      "magenta",
      "brown",
      "lime",
    ];
    return colors[colorIndices.pop()];
  }
  constructor(PIECE_SHAPE_SIZE, PIECE_COUNT) {
    this.PIECE_SHAPE_SIZE = PIECE_SHAPE_SIZE;
    this.PIECE_COUNT = PIECE_COUNT;
    this.mapPieces = new Array(this.PIECE_COUNT);
    this.generatedPieceCount = 0;
    const uniqueColorIndices = [...Array(this.PIECE_COUNT).keys()];
    for (let i = 0; i < this.PIECE_COUNT; i++) {
      const shape = this.createPieceShape();
      const shapeRelativeSquareLocations =
        this.getshapeRelativeSquareLocations(shape);
      this.mapPieces[i] = {
        id: i + 1,
        shape: shape,
        emperor: null,
        stones: 0,
        color: MapPieceBag.generateRandomColor(uniqueColorIndices),
        shapeRelativeSquareLocations: shapeRelativeSquareLocations,
        squareLocationStonePlayer: new Array(
          shapeRelativeSquareLocations.length
        ).fill(false),
        absoluteSquareLocations: new Array(
          shapeRelativeSquareLocations.length
        ).fill({
          x: null,
          y: null,
        }),
      };
    }
  }
  getshapeRelativeSquareLocations(shape) {
    const shapeRelativeSquareLocations = [];
    let index = 0;
    for (let i = 0; i < shape.length; i++) {
      for (let j = 0; j < shape[i].length; j++) {
        if (shape[i][j] === 1) {
          shapeRelativeSquareLocations.push({
            x: j,
            y: i,
            index: index++,
          });
        }
      }
    }
    return shapeRelativeSquareLocations;
  }
  createPieceShape() {
    let shape = Array.from(
      {
        length: this.PIECE_SHAPE_SIZE,
      },
      () => new Array(this.PIECE_SHAPE_SIZE).fill(0)
    );
    const directions = [
      {
        dx: -1,
        dy: 0,
      },
      {
        dx: 1,
        dy: 0,
      },
      {
        dx: 0,
        dy: -1,
      },
      {
        dx: 0,
        dy: 1,
      },
    ];
    const center = Math.floor(this.PIECE_SHAPE_SIZE / 2);
    shape[center][center] = INITIAL_SHAPE_VALUE;
    let x = center;
    let y = center;
    // Determine the number of remaining cells based on the generatedPieceCount
    let remaining =
      this.generatedPieceCount < FORCED_PIECE_SHAPE_THRESHOLD
        ? FORCED_PIECE_SHAPE_THRESHOLD
        : Math.floor(Math.random() * 5) + 2;
    while (remaining > 0) {
      const { dx, dy } =
        directions[Math.floor(Math.random() * directions.length)];
      x += dx;
      y += dy;
      if (
        x >= 0 &&
        y >= 0 &&
        x < this.PIECE_SHAPE_SIZE &&
        y < this.PIECE_SHAPE_SIZE &&
        shape[y][x] === 0
      ) {
        shape[y][x] = INITIAL_SHAPE_VALUE;
        remaining--;
      } else {
        x -= dx;
        y -= dy;
      }
    }
    this.generatedPieceCount++; // Increment the counter after generating a piece
    return shape;
  }
  logGeneratedShapes() {
    console.log("Generated Shapes:");
    this.mapPieces.forEach((piece, index) => {
      console.log(`Shape ${piece.id}:`); // Log the ID of the map piece
      console.table(piece.shape);
    });
  }
}
// board class that will keep track of all the game elements on the board and their location. it should start by creating a board of GRID_SIZE x GRID_SIZE squares.
class Board {
  constructor(GRID_SIZE, onBoardStateChange, game) {
    this.grid = new Array(GRID_SIZE)
      .fill(null)
      .map(() => new Array(GRID_SIZE).fill(null));
    this.onBoardStateChange = onBoardStateChange;
    this.game = game; // Store the game instance
    // Create an empty game board
    for (let i = 0; i < GRID_SIZE; i++) {
      this.grid[i] = [];
      for (let j = 0; j < GRID_SIZE; j++) {
        this.grid[i][j] = null;
      }
    }
    this.initNaturalResourceCells();
  }
  initNaturalResourceCells() {
    const gridSize = this.grid.length;
    const quadrantSize = Math.floor(gridSize / GRID_OFFSET);
    const quadrants = this.defineQuadrants(quadrantSize);
    for (let i = 0; i < TOTAL_RESOURCES; i++) {
      let resourcePosition;
      do {
        resourcePosition = this.generateRandomPosition(
          i,
          quadrants,
          quadrantSize
        );
      } while (!this.isValidResourcePosition(resourcePosition));
      this.grid[resourcePosition.y][resourcePosition.x] = {
        type: "naturalResource",
        stones: 0,
        stoneOwner: null,
      };
    }
  }
  defineQuadrants(quadrantSize) {
    return [
      {
        x: 1,
        y: 1,
        dx: 1,
        dy: 1,
      }, // Top-left quadrant
      {
        x: quadrantSize,
        y: 1,
        dx: -1,
        dy: 1,
      }, // Top-right quadrant
      {
        x: 1,
        y: quadrantSize,
        dx: 1,
        dy: -1,
      }, // Bottom-left quadrant
      {
        x: quadrantSize,
        y: quadrantSize,
        dx: -1,
        dy: -1,
      }, // Bottom-right quadrant
    ];
  }
  generateRandomPosition(i, quadrants, quadrantSize) {
    const quadrant = quadrants[i];
    const offset = Math.floor(Math.random() * (quadrantSize - GRID_OFFSET));
    return {
      x:
        quadrant.x +
        quadrant.dx * offset +
        (quadrant.dx > 0 ? 0 : quadrantSize - GRID_OFFSET),
      y:
        quadrant.y +
        quadrant.dy * offset +
        (quadrant.dy > 0 ? 0 : quadrantSize - GRID_OFFSET),
    };
  }
  isValidResourcePosition({ x, y }) {
    return ADJACENT_OFFSETS.every((offset) => {
      const newX = x + offset.dx;
      const newY = y + offset.dy;
      return !this.isWithinGrid(newX, newY) || this.grid[newY][newX] === null;
    });
  }
  isWithinGrid(x, y) {
    const gridSize = this.grid.length;
    return x >= 0 && x < gridSize && y >= 0 && y < gridSize;
  }
  getBoardMatrix() {
    const matrix = [];
    for (let i = 0; i < this.grid.length; i++) {
      const row = [];
      for (let j = 0; j < this.grid[i].length; j++) {
        const cell = this.grid[i][j];
        if (cell) {
          if (cell.type === "mapPiece") {
            if (cell.stones > 0) {
              if (cell.stoneOwner === this.game.player1) {
                row.push("p1");
              } else if (cell.stoneOwner === this.game.player2) {
                row.push("p2");
              } else {
                row.push("m");
              }
            } else {
              row.push("m");
            }
          } else if (cell.type === "naturalResource") {
            row.push("r");
          } else {
            row.push("0");
          }
        } else {
          row.push("0");
        }
      }
      matrix.push(row);
    }
    console.log(matrix);
    return matrix;
  }
  logUniqueMapPieces() {
    const uniqueMapPieces = [];
    const uniqueMapPieceIds = new Set();
    this.grid.forEach((row) => {
      row.forEach((cell) => {
        if (
          cell &&
          cell.type === "mapPiece" &&
          !uniqueMapPieceIds.has(cell.mapPiece.id)
        ) {
          uniqueMapPieceIds.add(cell.mapPiece.id);
          uniqueMapPieces.push({
            id: cell.mapPiece.id,
            squareLocationStonePlayer: cell.mapPiece.squareLocationStonePlayer,
          });
        }
      });
    });
    return uniqueMapPieces;
  }
  addStone(x, y, player) {
    const square = this.grid[y][x];
    if (square && square.type === "mapPiece") {
      // Inject the stone into the map piece and board
      square.stones++;
      square.stoneOwner = player;
      square.mapPiece.squareLocationStonePlayer[square.id] = player; // Use the reference to the MapPiece
      square.mapPiece.stones++;
      square.isPartOfCity = false;
      if (this.lastPlayed) {
        const lastPlayedSquare =
          this.grid[this.lastPlayed.y][this.lastPlayed.x];
        if (lastPlayedSquare) {
          lastPlayedSquare.lastPlayed = false;
        }
      }
      square.lastPlayed = true;
      // Notify subscribers of board state change
      this.onBoardStateChange();
      // Log unique map pieces and their squareLocationStonePlayer arrays
      this.logUniqueMapPieces();
      this.game.countEmperors();
      console.log(this.getBoardMatrix());
      const boardMatrix = this.getBoardMatrix();
      const tradeRoutes = this.game.findTradeRoutes(boardMatrix);
      console.log("trade routes: ", tradeRoutes);
      const cities = this.game.findCities(boardMatrix);
      const adjacentResources = this.game.findAdjacentResources(boardMatrix);
      console.log("Adjacent resources:", adjacentResources);
      console.log("cities: ", cities);
    }
  }
  addMapPiece(piece, x, y) {
    const pieceWidth = piece.shape[0].length;
    const pieceHeight = piece.shape.length;
    for (let i = 0; i < pieceHeight; i++) {
      for (let j = 0; j < pieceWidth; j++) {
        if (piece.shape[i][j] === 1) {
          const squareX = x + j;
          const squareY = y + i;
          const squareIndex = piece.shapeRelativeSquareLocations.find(
            (loc) => loc.x === j && loc.y === i
          ).index;
          this.grid[squareY][squareX] = {
            type: "mapPiece",
            color: piece.color,
            mapPiece: piece, // Store a reference to the MapPiece
            id: squareIndex, // Set id to the index of the square within the map piece
            //index: squareIndex,
            mapPieceID: piece.id,
            stones: 0,
            stoneOwner: null,
            cellSquareLocation: {
              x: squareX,
              y: squareY,
            },
          };
          piece.absoluteSquareLocations[squareIndex] = {
            x: squareX,
            y: squareY,
          }; // Update the absolute position
        }
      }
    }
    this.onBoardStateChange();
  }
}
// a renderer class that takes the board and renders it in the index.html #game-board via grid-container
class Renderer {
  constructor(game) {
    this.board = null;
    this.game = game;
    this.gridContainer = document.getElementById("game-board");
    // Subscribe to game state updates
    this.game.subscribe(() => this.rerender());
  }
  setBoard(board) {
    this.board = board;
    this.render();
  }
  rerender() {
    this.render();
  }
  render() {
    //log board state
    const tradeRoutesCheckbox = document.getElementById("checkTradeRoutes");
    const citiesCheckbox = document.getElementById("checkCities");
    console.log(this.board.grid);
    if (!this.board) return;
    const gridContainer = document.getElementById("game-board");
    gridContainer.innerHTML = "";
    this.board.grid.forEach((row, rowIndex) => {
      const rowElement = document.createElement("div");
      rowElement.classList.add("row");
      row.forEach((cell, cellIndex) => {
        const cellElement = document.createElement("div");
        cellElement.classList.add("cell");
        cellElement.dataset.row = rowIndex;
        cellElement.dataset.col = cellIndex;
        const removedPeninsula = this.game.removedPeninsulas.find(
          (p) => p.x === cellIndex && p.y === rowIndex
        );
        if (removedPeninsula) {
          const timeSinceAffected = Date.now() - removedPeninsula.time;
          cellElement.style.setProperty(
            "--time-since-affected",
            timeSinceAffected
          );
          cellElement.classList.add("removed-peninsula");
        }
        if (cell && cell.type === "mapPiece") {
          const mapPieceColorClass = `map-piece-${cell.color}`;
          cellElement.classList.add("map-piece");
          cellElement.classList.add(mapPieceColorClass);
          cellElement.dataset.id = cell.id;
          const squareElement = document.createElement("div");
          squareElement.classList.add("square");
          squareElement.dataset.row = cell.cellSquareLocation.y;
          squareElement.dataset.col = cell.cellSquareLocation.x;
          cellElement.appendChild(squareElement);
          for (let i = 0; i < cell.stones; i++) {
            const permanentStone = document.createElement("div");
            permanentStone.classList.add("stone-permanent");
            permanentStone.classList.add("stone");
            if (cell.lastPlayed) {
              permanentStone.classList.add("lastPlayed");
            } else {
              permanentStone.classList.remove("lastPlayed");
            }
            if (cell.stoneOwner === this.game.player1) {
              permanentStone.classList.add("stone-player1");
            } else if (cell.stoneOwner === this.game.player2) {
              permanentStone.classList.add("stone-player2");
            }
            if (cell.isPartOfCity && citiesCheckbox) {
              permanentStone.classList.add("is-part-of-city");
            }
            if (cell.isPartOfTradeRoute && tradeRoutesCheckbox.checked) {
              // Check if the cell is part of a trade route
              permanentStone.classList.add("is-part-of-route"); // Add the class if it is
            }
            cellElement.appendChild(permanentStone);
          }
        } else if (cell && cell.type === "naturalResource") {
          cellElement.classList.add("resource");
        }
        rowElement.appendChild(cellElement);
      });
      gridContainer.appendChild(rowElement);
    });
    const populations = this.game.findRuledPopulation();
    const player1Population = document.getElementById("player1-population");
    player1Population.textContent = `${populations[this.game.player1]}`;
    const player2Population = document.getElementById("player2-population");
    player2Population.textContent = `${populations[this.game.player2]}`;

    // Update turn indicator
    const turnIndicator = document.getElementById("turn-indicator");
    turnIndicator.textContent = `${this.game.turns}`;
    // Update phase indicator
    const phaseIndicator = document.getElementById("game-phase");
    phaseIndicator.textContent = `${this.game.gamePhase}`;
    const currentPlayerIndicator = document.getElementById("current-player");
    currentPlayerIndicator.textContent = `${this.getCurrentPlayerName()}`;
    // Update player emperor counts in the UI
    // Retrieve emperors object
    const emperors = this.game.countEmperors();
    const tradeRoutes = this.game.findTradeRoutes(this.board.getBoardMatrix());
    const player1TradeRoutes = document.getElementById("player1-trade-routes");
    player1TradeRoutes.innerHTML = `${tradeRoutes["p1"].count} routes, <br> ${tradeRoutes["p1"].totalLength} length`;
    const player2TradeRoutes = document.getElementById("player2-trade-routes");
    player2TradeRoutes.innerHTML = `${tradeRoutes["p2"].count} routes, <br> ${tradeRoutes["p2"].totalLength} length`;
    const boardMatrix = this.board.getBoardMatrix();
    const cities = this.game.findCities(boardMatrix);
    const player1Cities = document.getElementById("player1-cities");
    player1Cities.textContent = `${cities["p1"]}`;
    const player2Cities = document.getElementById("player2-cities");
    player2Cities.textContent = `${cities["p2"]}`;
    // Update player emperor counts in the UI
    const player1EmperorCount = document.getElementById("player1-emperor");
    player1EmperorCount.textContent = `${emperors[this.game.player1]}`;
    const player2EmperorCount = document.getElementById("player2-emperor");
    player2EmperorCount.textContent = `${emperors[this.game.player2]}`;
    const resources = this.game.findAdjacentResources(boardMatrix);
    const player1Resources = document.getElementById("player1-resources");
    player1Resources.textContent = `${resources["p1"]}`;
    const player2Resources = document.getElementById("player2-resources");
    player2Resources.textContent = `${resources["p2"]}`;
    const scores = this.game.calculateScore();

    const player1Score = document.getElementById("player1-score");
    player1Score.textContent = `${scores[this.game.player1]}`;
    const player2Score = document.getElementById("player2-score");
    player2Score.textContent = `${scores[this.game.player2]}`;
  }
  getCurrentPlayerName() {
    return this.game.currentPlayer === this.game.player1 ? "White" : "Black";
  }
  renderPreview(cellElement, piece, preview = true) {
    // Add a flag to the cellElement to track the stone preview state
    if (typeof cellElement.stonePreviewActive === "undefined") {
      cellElement.stonePreviewActive = false;
    }
    if (this.game.gamePhase === "map") {
      const x =
        parseInt(cellElement.dataset.col) -
        Math.floor(this.game.PIECE_SHAPE_SIZE / 2);
      const y =
        parseInt(cellElement.dataset.row) -
        Math.floor(this.game.PIECE_SHAPE_SIZE / 2);
      const pieceWidth = piece.shape[0].length;
      const pieceHeight = piece.shape.length;
      for (let i = 0; i < pieceHeight; i++) {
        for (let j = 0; j < pieceWidth; j++) {
          if (piece.shape[i][j] === 1) {
            const row = this.gridContainer.children[y + i];
            if (row) {
              const cell = row.children[x + j];
              if (cell) {
                if (preview) {
                  cell.classList.add("preview");
                } else {
                  cell.classList.remove("preview");
                }
              }
            }
          }
        }
      }
    } else if (this.game.gamePhase === "stone") {
      const existingStonePreview = cellElement.querySelector(".stone-preview");
      const square =
        this.game.board.grid[cellElement.dataset.row][cellElement.dataset.col];
      if (
        preview &&
        !cellElement.stonePreviewActive &&
        square &&
        square.stones === 0
      ) {
        // Only add the stone preview if it's not already active and the square is not occupied
        const stonePreview = document.createElement("div");
        stonePreview.classList.add("stone-preview");
        stonePreview.classList.add("stone");
        cellElement.appendChild(stonePreview);
        cellElement.stonePreviewActive = true;
      } else if (!preview && cellElement.stonePreviewActive) {
        // Only remove the stone preview if it's currently active
        if (existingStonePreview) {
          cellElement.removeChild(existingStonePreview);
        }
        cellElement.stonePreviewActive = false;
      }
    }
  }
}
class EventListener {
  constructor(game, board) {
    this.game = game;
    this.board = board; // Store the board instance
    this.gridContainer = document.getElementById("game-board");
    this.attachEventListeners();
  }
  attachEventListeners() {
    this.gridContainer.addEventListener("mouseover", (event) => {
      const cellElement = event.target.closest(".cell");
      if (cellElement) {
        this.handleHoverEnter(cellElement);
      }
    });
    this.gridContainer.addEventListener("mouseout", (event) => {
      const cellElement = event.target.closest(".cell");
      if (cellElement) {
        this.handleHoverLeave(cellElement);
      }
    });
    this.gridContainer.addEventListener("click", (event) => {
      const cellElement = event.target.closest(".cell");
      if (cellElement) {
        this.handleClick(cellElement);
      }
    });
    const undoButton = document.getElementById("undo-button");
    undoButton.addEventListener("click", () => {
      this.game.undo();
    });
  }
  handleHoverEnter(cellElement) {
    // Logic for hovering over a cell
    cellElement.classList.add("hovered");
    if (this.game.gamePhase === "map") {
      const piece =
        this.game.pieceBag.mapPieces[this.game.currentMapPieceIndex];
      this.game.renderer.renderPreview(cellElement, piece, true);
    }
    if (this.game.gamePhase === "stone") {
      this.game.renderer.renderPreview(cellElement, null, true);
    }
  }
  handleHoverLeave(cellElement) {
    // Logic for leaving a cell
    cellElement.classList.remove("hovered");
    if (this.game.gamePhase === "map") {
      const piece =
        this.game.pieceBag.mapPieces[this.game.currentMapPieceIndex];
      this.game.renderer.renderPreview(cellElement, piece, false);
    }
    if (this.game.gamePhase === "stone") {
      this.game.renderer.renderPreview(cellElement, null, false);
    }
  }
  handleClick(cellElement) {
    const row = parseInt(cellElement.dataset.row);
    const col = parseInt(cellElement.dataset.col);
    if (this.game.gamePhase === "map") {
      const piece =
        this.game.pieceBag.mapPieces[this.game.currentMapPieceIndex];
      this.game.placeMapPiece(piece, col, row);
    } else if (this.game.gamePhase === "stone") {
      this.game.placeStone(col, row);
    }
  }
}
document.addEventListener("DOMContentLoaded", function () {
  let game = new Game();
  game.startGame();
});
