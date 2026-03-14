# Project Constitution

## Core Values
1. **Simplicity over cleverness**: Vanilla JS ES modules, no build step, no bundlers, no transpilers
2. **Feature preservation**: All existing game features must continue working after any change
3. **Incremental safety**: Each change should leave the game functional and playable

## Architectural Principles
1. **DOM-free engine**: GameEngine must never reference document or window — pure logic only
2. **Separation of concerns**: Game logic, rendering, input handling, and networking are separate layers
3. **Event-driven communication**: Components communicate via EventEmitter, not direct references
4. **Stateless helpers**: Utility classes (TurnManager, ScoreTracker) accept params and return results — no circular dependencies

## Quality Standards
1. **No silent regressions**: Scoring, feature toggles, undo, and autoplace must produce identical results after refactoring
2. **Serializable state**: Game state must be JSON-serializable for both undo and network sync
3. **Backward compatibility**: Existing single-player mode must work unchanged when multiplayer is added
