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
export const MAP_PHASE_TURNS_THRESHOLD = 5;
export const STONE_PHASE = "stone";
export const FIRST_STONE_TURNS_THRESHOLD = 6;
export const CITY_LENGTH_THRESHOLD = 3;
export const GLOBAL_WARMING_BASE_CHANCE = 0.003;
export const ADJACENT_OFFSETS = [
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
