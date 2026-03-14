# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Emperors is a browser-based two-player strategy board game played on a 14x14 grid. The game has two phases:
1. **Map Phase** — Players alternate placing 10 randomly-generated map pieces (polyomino shapes) onto the grid
2. **Stone Phase** — Players alternate placing stones (white/black) on the map pieces until all squares are filled

Scoring combines: emperor control (majority stones on a piece), population (squares in controlled pieces), trade routes (stones bridging gaps), cities (3+ stones in a line), natural resources, and fishing villages (stones adjacent to enclosed lakes).

Multiplayer is supported via PeerJS peer-to-peer networking with a host/guest architecture.

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

## Architecture

The codebase now follows **strict separation of concerns** with a **DOM-free engine** (per `constitution.md`):

- **GameEngine** (pure logic, no DOM references) — Owns board state, validates moves, manages turns, emits events
- **RendererAdapter** (bridges engine to DOM) — Subscribes to engine events, orchestrates rendering
- **InputHandler** (captures input, routes to engine) — Grid clicks, buttons, checkboxes; prevents double-clicks
- **NetworkManager** (PeerJS multiplayer) — Host/guest sync via serialized GameState snapshots
- **EventEmitter** (decoupled pub/sub) — Components communicate without direct references
- **GameState** (serialization contract) — Handles JSON-safe snapshots for undo and network sync

Key architectural principle: **Event-driven communication**. Components emit events; subscribers respond without direct coupling.

### Key Files

| File | Purpose |
|------|---------|
| **main.mjs** | Composition root — assembles GameEngine, RendererAdapter, InputHandler, NetworkManager |
| **GameEngine.mjs** | Pure state machine: validate → save snapshot → mutate → change turn → flag routine → emit events |
| **GameState.mjs** | Serializer: JSON-safe snapshots for undo/network; reconstructs MapPiece cross-refs on deserialize |
| **EventEmitter.mjs** | Minimal pub/sub event bus (on/off/emit) for decoupled communication |
| **InputHandler.mjs** | Captures grid clicks, buttons, checkboxes; routes to engine; disables during guest's turns |
| **RendererAdapter.mjs** | Subscribes to engine events, builds StrategyDetails, calls RenderManager with board/status renderers |
| **NetworkManager.mjs** | PeerJS connection manager; host/guest sync via game-init/move-request/game-update messages |
| **MultiplayerUI.mjs** | DOM controls for room creation/joining, connection status, player role, disconnect button |
| **Constants.mjs** | Grid size (14), piece count (10), scoring values, phase thresholds, player IDs |
| **GameManagement.mjs** | Turn manager, score calculator, global warming tracker, StrategyDetails builder, history |
| **BoardManagement.mjs** | Board state, validators, editors, searchers (emperors, trade routes, cities, resources, etc.) |
| **MapPieces.mjs** | Map piece generation (random polyominoes), rotation |
| **UIManagement.mjs** | RenderManager, BoardRenderer, StatusRenderer (existing; used via RendererAdapter) |
| **constitution.md** | Core values: simplicity, feature preservation, DOM-free engine, event-driven architecture |

### Data Flow for a Move (Single-Player Example)

1. **InputHandler** captures grid click → extracts (x, y) → routes to `GameEngine.placeMapPiece()` or `placeStone()`
2. **GameEngine** validates move using strategy pattern
3. If valid: saves snapshot to undo stack → mutates board via strategy → changes turn via TurnManager
4. **GameEngine** runs flag routine: peninsula detection, global warming, emperor counting, trade routes, cities, population, resources, fishing villages, scoring
5. **GameEngine** emits `move-applied` event with serialized game state
6. **RendererAdapter** receives event → builds StrategyDetails from state → calls RenderManager to render board and status
7. Button states updated by InputHandler based on game phase and undo availability

### Multiplayer Data Flow (Host/Guest)

1. **Host** calls `NetworkManager.createRoom(roomCode)` → creates Peer with ID "emperors-{roomCode}"
2. **Guest** calls `NetworkManager.joinRoom(roomCode)` → connects to host
3. **Host** sends game-init with serialized state + player assignment ("p1" for host, "p2" for guest)
4. **Guest** receives game-init, calls `GameEngine.applyState()` to sync, disables InputHandler (until guest's turn)
5. **Host's move**: Local GameEngine mutation → move-applied event → NetworkManager broadcasts game-update to guest
6. **Guest's move**: Guest sends move-request to host → host executes action → validates → auto-broadcasts result
7. **Guest's InputHandler** re-enables when it's guest's turn; disables when it's host's turn

### Feature Flags

Runtime toggles control scoring features (global warming, trade routes, cities, fishing villages, blockades).
Configured via `GameEngine` constructor options; synced from checkboxes by InputHandler.
Feature flags serialized in GameState snapshots for network sync and undo.

### Undo System

Before each mutation, GameEngine saves snapshot (grid, mapPieces, turn, phase, global warming state, pending skips).
Up to 50 snapshots retained. On undo, GameState deserializes snapshot, recalculates computed state (emperors, scores, etc.).
