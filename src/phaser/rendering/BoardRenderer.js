import {
  GRID_SIZE,
  CELL_SIZE,
  BOARD_OFFSET_X,
  BOARD_OFFSET_Y,
  GRID_LINE_COLOR,
  STONE_COLOR_P1,
  STONE_COLOR_P2,
  RESOURCE_COLOR,
  LAST_PLAYED_COLOR,
  PREVIEW_COLOR,
  PLAYER_1,
  PLAYER_2
} from '../utils/Constants.js';

/**
 * Renders the game board using Phaser graphics
 */
export class BoardRenderer {
  constructor(scene) {
    this.scene = scene;
    this.gridGraphics = scene.add.graphics();
    this.pieceGraphics = scene.add.graphics();
    this.stoneGraphics = scene.add.graphics();
    this.previewGraphics = scene.add.graphics();
    this.highlightGraphics = scene.add.graphics();

    // Text objects for symbols
    this.symbolTexts = [];

    this.drawGrid();
  }

  drawGrid() {
    this.gridGraphics.clear();
    this.gridGraphics.lineStyle(1, GRID_LINE_COLOR, 0.5);

    // Draw vertical lines
    for (let i = 0; i <= GRID_SIZE; i++) {
      const x = BOARD_OFFSET_X + i * CELL_SIZE;
      this.gridGraphics.lineBetween(
        x,
        BOARD_OFFSET_Y,
        x,
        BOARD_OFFSET_Y + GRID_SIZE * CELL_SIZE
      );
    }

    // Draw horizontal lines
    for (let i = 0; i <= GRID_SIZE; i++) {
      const y = BOARD_OFFSET_Y + i * CELL_SIZE;
      this.gridGraphics.lineBetween(
        BOARD_OFFSET_X,
        y,
        BOARD_OFFSET_X + GRID_SIZE * CELL_SIZE,
        y
      );
    }
  }

  renderBoard(grid) {
    this.pieceGraphics.clear();
    this.stoneGraphics.clear();
    this.clearSymbols();

    for (let i = 0; i < grid.length; i++) {
      for (let j = 0; j < grid[i].length; j++) {
        const cell = grid[i][j];
        if (cell) {
          const x = BOARD_OFFSET_X + j * CELL_SIZE;
          const y = BOARD_OFFSET_Y + i * CELL_SIZE;

          if (cell.type === "mapPiece") {
            this.drawMapPieceCell(x, y, cell);
          } else if (cell.type === "naturalResource") {
            this.drawNaturalResource(x, y);
          }
        }
      }
    }
  }

  drawMapPieceCell(x, y, cell) {
    // Draw map piece background
    this.pieceGraphics.fillStyle(cell.color, 0.7);
    this.pieceGraphics.fillRect(x + 1, y + 1, CELL_SIZE - 2, CELL_SIZE - 2);

    // Draw stone if present
    if (cell.stoneCount > 0) {
      const stoneColor = cell.stoneOwner === PLAYER_1 ? STONE_COLOR_P1 : STONE_COLOR_P2;
      const strokeColor = cell.stoneOwner === PLAYER_1 ? STONE_COLOR_P2 : STONE_COLOR_P1;

      const centerX = x + CELL_SIZE / 2;
      const centerY = y + CELL_SIZE / 2;
      const radius = (CELL_SIZE * 0.55) / 2;

      this.stoneGraphics.fillStyle(stoneColor, 1);
      this.stoneGraphics.lineStyle(1, strokeColor, 1);
      this.stoneGraphics.fillCircle(centerX, centerY, radius);
      this.stoneGraphics.strokeCircle(centerX, centerY, radius);

      // Draw symbols for trade routes and cities
      this.drawSymbols(centerX, centerY, cell);
    }

    // Draw last played indicator
    if (cell.lastPlayed) {
      this.highlightGraphics.lineStyle(3, LAST_PLAYED_COLOR, 1);
      this.highlightGraphics.strokeRect(x + 2, y + 2, CELL_SIZE - 4, CELL_SIZE - 4);
    }
  }

  drawSymbols(centerX, centerY, cell) {
    let symbol = '';
    if (cell.isPartOfTradeRoute && cell.isPartOfCity) {
      symbol = '✥'; // Both
    } else if (cell.isPartOfCity) {
      symbol = '✢'; // City
    } else if (cell.isPartOfTradeRoute) {
      symbol = '⇹'; // Trade route
    }

    if (symbol) {
      const text = this.scene.add.text(centerX, centerY, symbol, {
        fontSize: '14px',
        color: '#ffff00',
        stroke: '#000000',
        strokeThickness: 2
      });
      text.setOrigin(0.5, 0.5);
      this.symbolTexts.push(text);
    }
  }

  drawNaturalResource(x, y) {
    this.pieceGraphics.fillStyle(RESOURCE_COLOR, 1);
    this.pieceGraphics.fillRect(x + 1, y + 1, CELL_SIZE - 2, CELL_SIZE - 2);
  }

  drawPreview(x, y, piece, isValid) {
    this.previewGraphics.clear();

    const color = isValid ? 0x00ff00 : 0xff0000;
    const alpha = 0.3;

    // Adjust for piece center
    const startX = x - Math.floor(piece.shape.length / 2);
    const startY = y - Math.floor(piece.shape.length / 2);

    for (let i = 0; i < piece.shape.length; i++) {
      for (let j = 0; j < piece.shape[i].length; j++) {
        if (piece.shape[i][j] === 1) {
          const boardX = startX + j;
          const boardY = startY + i;

          if (boardX >= 0 && boardX < GRID_SIZE && boardY >= 0 && boardY < GRID_SIZE) {
            const px = BOARD_OFFSET_X + boardX * CELL_SIZE;
            const py = BOARD_OFFSET_Y + boardY * CELL_SIZE;

            this.previewGraphics.fillStyle(color, alpha);
            this.previewGraphics.fillRect(px + 1, py + 1, CELL_SIZE - 2, CELL_SIZE - 2);
          }
        }
      }
    }
  }

  drawStonePreview(x, y, isValid) {
    this.previewGraphics.clear();

    const color = isValid ? 0x00ff00 : 0xff0000;
    const px = BOARD_OFFSET_X + x * CELL_SIZE + CELL_SIZE / 2;
    const py = BOARD_OFFSET_Y + y * CELL_SIZE + CELL_SIZE / 2;
    const radius = (CELL_SIZE * 0.55) / 2;

    this.previewGraphics.fillStyle(color, 0.3);
    this.previewGraphics.fillCircle(px, py, radius);
  }

  clearPreview() {
    this.previewGraphics.clear();
  }

  clearHighlights() {
    this.highlightGraphics.clear();
  }

  clearSymbols() {
    for (const text of this.symbolTexts) {
      text.destroy();
    }
    this.symbolTexts = [];
  }

  destroy() {
    this.gridGraphics.destroy();
    this.pieceGraphics.destroy();
    this.stoneGraphics.destroy();
    this.previewGraphics.destroy();
    this.highlightGraphics.destroy();
    this.clearSymbols();
  }
}
