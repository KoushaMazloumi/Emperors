import {
    GRID_SIZE,
    GRID_OFFSET,
    TOTAL_RESOURCES,
    STARTING_PHASE,
    PIECE_SHAPE_SIZE,
    PIECE_COUNT,
    INITIAL_SHAPE_VALUE,
    FORCED_PIECE_SHAPE_THRESHOLD,
    ADJACENT_OFFSETS
} from './Constants.mjs';

import { TurnManager, HistoryManager, HistoryTracker, ScoreTracker, Player, GlobalWarming, Logger, InfoAlert, StrategyDetails } from './GameManagement.mjs';
import { BoardState, BoardStateSearcher, BoardStateEditor, MoveValidator, ValidateMapPiecePlacementStrategy, AddStoneStrategy, AddMapPieceStrategy, AddNaturalResourceStrategy } from './BoardManagement.mjs';
import { MapPieceGenerator, MapPiece } from './MapPieces.mjs';
import { RenderManager, StatusRenderer, BoardRenderer, MovePreviewRenderer, EventListener } from './UIManagement.mjs';

import { Game } from './Game.mjs';


document.addEventListener("DOMContentLoaded", function() {
    let game = new Game(STARTING_PHASE);
    game.initialize();
});