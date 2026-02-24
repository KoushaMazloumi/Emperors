# Emperors — Game Rules

**Emperors** is a two-player territorial strategy board game played on a 14x14 grid. It combines polyomino tile placement with stone-based area control and dynamic scoring.

## Players

Two players: **Black** (Player 1) and **White** (Player 2). They alternate turns, with Player 1 going first.

## Phase 1: Map Phase (Turns 1-10)

Players take turns placing **map pieces** (randomly generated polyomino shapes of 2-7 cells) onto the board.

- **10 map pieces** total, each with a unique color.
- The first 4 pieces are guaranteed to be larger (4+ cells).
- The first piece can be placed anywhere; subsequent pieces **must be orthogonally adjacent** (up, down, left, right) to an existing piece.
- Pieces **cannot overlap** existing pieces or extend out of bounds.
- Pieces can be **rotated** in 90-degree increments (0, 90, 180, 270).

After turn 10, the game automatically transitions to the Stone Phase.

## Phase 2: Stone Phase (Turns 11+)

Players place **stones** (colored markers) onto map piece cells to claim territory.

- Stones can only be placed on map piece cells, not on empty grid spaces.
- **One stone per cell** maximum.
- The first stone (turn 11) can be placed on any map piece cell.
- All subsequent stones **must be orthogonally adjacent** to an existing stone.

## Scoring

Scores are tracked continuously across five categories:

| Category        | Points                                                                                      |
| --------------- | ------------------------------------------------------------------------------------------- |
| **Emperors**    | 1 point per map piece you control (you have more stones than your opponent on that piece)    |
| **Population**  | 1 point per cell in map pieces where you are emperor                                        |
| **Trade Routes**| Points based on the count and length of gaps between your aligned stones                    |
| **Cities**      | 2 points per city (3 or more consecutive stones of yours in a straight horizontal or vertical line) |
| **Resources**   | 1 point per natural resource adjacent to your stones                                        |

## Global Warming

Starting in the Stone Phase, **peninsulas** (map piece cells with 3 ocean/empty neighbors) can be randomly destroyed.

- Base chance: 0.3% per turn, scaling exponentially over time (multiplied by `2^((turn - 10) / 10)`).
- Each peninsula removed slightly decreases the probability of further removals.
- Destroyed cells shrink map pieces, which can shift emperor control and alter scores.
- Visually indicated by a red pulsing animation.

## Special Elements

- **Natural Resources:** 4 resources are placed on the board at the start. Players gain points for each resource orthogonally adjacent to their stones.
- **Map Piece Generation:** Pieces are randomly generated connected polyominoes. The first 4 are guaranteed to be at least 4 cells; later pieces range from 2-7 cells.

## Controls

- **Rotate:** Rotate the current map piece before placing it.
- **Undo:** Undo the last action.
- **Auto-Place / Auto-Place All:** Automatically place pieces on the board.

## Winning

The player with the **highest total score** wins. The game is played until all placements are made or players agree to stop.
