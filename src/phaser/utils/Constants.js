// Game constants
export const GRID_SIZE = 14;
export const GRID_OFFSET = 2;
export const TOTAL_RESOURCES = 4;
export const MAP_PHASE = "map";
export const STARTING_PHASE = MAP_PHASE;
export const PIECE_SHAPE_SIZE = 7;
export const PIECE_COUNT = 10;
export const INITIAL_SHAPE_VALUE = 1;
export const FORCED_PIECE_SHAPE_THRESHOLD = 4;
export const PLAYER_1 = "p1";
export const PLAYER_2 = "p2";
export const MAP_PHASE_TURNS_THRESHOLD = 10;
export const STONE_PHASE = "stone";
export const FIRST_STONE_TURNS_THRESHOLD = MAP_PHASE_TURNS_THRESHOLD + 1;
export const CITY_LENGTH_THRESHOLD = 3;
export const GLOBAL_WARMING_BASE_CHANCE = 0.003;

export const ADJACENT_OFFSETS = [
  { dx: -1, dy: 0 },  // Left
  { dx: 1, dy: 0 },   // Right
  { dx: 0, dy: -1 },  // Up
  { dx: 0, dy: 1 },   // Down
  { dx: -1, dy: -1 }, // Diagonal: Top-left
  { dx: 1, dy: -1 },  // Diagonal: Top-right
  { dx: -1, dy: 1 },  // Diagonal: Bottom-left
  { dx: 1, dy: 1 },   // Diagonal: Bottom-right
];

// Phaser-specific constants
export const CELL_SIZE = 30;
export const BOARD_WIDTH = GRID_SIZE * CELL_SIZE;
export const BOARD_HEIGHT = GRID_SIZE * CELL_SIZE;
export const GAME_WIDTH = 1200;
export const GAME_HEIGHT = 650;
export const BOARD_OFFSET_X = 20;
export const BOARD_OFFSET_Y = 100;

// Colors
export const MAP_PIECE_COLORS = [
  0xff6b6b, // Red
  0x4ecdc4, // Blue
  0x95e1d3, // Green
  0xf7dc6f, // Yellow
  0xbb8fce, // Purple
  0xf5b041, // Orange
  0x48c9b0, // Cyan
  0xec7063, // Magenta
  0xc39bd3, // Brown
  0xaed581, // Lime
];

export const STONE_COLOR_P1 = 0xffffff; // White
export const STONE_COLOR_P2 = 0x000000; // Black
export const RESOURCE_COLOR = 0x000000;
export const GRID_LINE_COLOR = 0x333333;
export const PREVIEW_COLOR = 0x808080;
export const LAST_PLAYED_COLOR = 0xff0000;

// City points value
export const CITY_POINTS = 2;
