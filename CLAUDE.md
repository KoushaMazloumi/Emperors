# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Emperors is a browser-based two-player strategy board game played on a 14x14 grid. The game has two phases:
1. **Map Phase** — Players alternate placing 10 randomly-generated map pieces (polyomino shapes) onto the grid
2. **Stone Phase** — Players alternate placing stones (white/black) on the map pieces until all squares are filled

Scoring combines: emperor control (majority stones on a piece), population (squares in controlled pieces), trade routes (stones bridging gaps), cities (3+ stones in a line), natural resources, and fishing villages (stones adjacent to enclosed lakes).

## Running the App

```bash
node index.js
# Opens at http://localhost:3000
```

No build step. The app serves static files via a simple Node HTTP server (`index.js`). The browser loads `index.html` which imports `main.mjs` as an ES module.

## Linting

```bash
npx eslint .
```

ESLint 8 is the sole dev dependency.

## Testing

No test framework is configured. `npm test` is a placeholder that exits with error.

## Architecture

The codebase uses the **Strategy pattern** extensively. Most game operations are performed by swapping strategy objects on manager classes, then calling `performStrategy(details)`.

### Key Files

- **`main.mjs`** — Entry point; creates `Game` instance on DOMContentLoaded
- **`Game.mjs`** — Central orchestrator. `executeStrategy(action, details)` is the main dispatch method handling all game actions (placeMapPiece, placeStone, rotate, undo, autoplace, renderBoard, etc.). Also manages the undo stack via `_saveSnapshot()`/`_restoreSnapshot()`
- **`Constants.mjs`** — All game constants: grid size (14), piece count (10), scoring values, phase thresholds, adjacency offsets
- **`GameManagement.mjs`** — Turn management (`TurnManager`), score calculation (`ScoreTracker`), global warming chance (`GlobalWarmingChanceTracker`), the `StrategyDetails` builder (fluent API used to pass state between strategies), `HistoryManager`, `Logger`
- **`BoardManagement.mjs`** — Board state (`BoardState` with private `#grid`/`#mapPieces`), plus all board-related strategies: validation (`MoveValidator`, `ValidateMapPiecePlacementStrategy`, `ValidateStonePlacementStrategy`), editing (`BoardStateEditor`, `AddMapPieceStrategy`, `AddStoneStrategy`), searching (`BoardStateSearcher`, `EmperorCounter`, `TradeRouteCounter`, `CityFinder`, `PeninsulaFinder`, `FishingVillageFinder`, `PopulationCounter`, `ResourceCounter`), and update strategies
- **`MapPieces.mjs`** — `MapPieceGenerator` (random polyomino generation), `MapPiece` data class, `MapPieceRotator`
- **`UIManagement.mjs`** — `RenderManager`, `BoardRenderer`, `StatusRenderer` (sidebar scores/labels), `MovePreviewRenderer` (hover previews), `EventListener` (click/hover/button handlers)
- **`styles1.css`** — All styling. CSS variable `--grid-columns` must match `GRID_SIZE` in Constants.mjs
- **`index.html`** — Game layout with sidebar (score table), board grid with labels, control buttons, feature toggle checkboxes, and rules text

### Core Patterns

- **StrategyDetails** (`GameManagement.mjs`) — Fluent builder that carries all transient game state between strategies. Most strategy methods receive a `details` object as their parameter.
- **Manager + Strategy** — `BoardStateEditor`, `BoardStateSearcher`, `MoveValidator`, and `RenderManager` each accept interchangeable strategies via `setStrategy()` then execute via `performStrategy()`.
- **Feature Flags** — UI checkboxes (`checkTradeRoutes`, `checkCities`, `checkGlobalWarming`, `checkFishingVillages`) toggle scoring features at runtime. Read via `Game._getFeatureFlags()`.
- **Undo System** — `Game._saveSnapshot()` deep-clones grid, map pieces, and game state before mutations. Up to `MAX_UNDO` (50) snapshots stored.
- **Two players** — `PLAYER_1` ("p1"/White) and `PLAYER_2` ("p2"/Black), alternating via `TurnManager.changeTurn()`.

### Data Flow for a Move

1. `EventListener` captures click → builds `StrategyDetails` → calls `Game.executeStrategy()`
2. `Game` sets validator strategy → validates → saves snapshot → sets editor strategy → mutates board
3. `TurnManager.changeTurn()` switches player/increments turn
4. `flagRoutine()` recalculates emperors, trade routes, cities, population, resources, fishing villages, scores
5. `renderRoutine()` re-renders board and status sidebar
