import { Game } from "./Game.mjs";
import { initFlagSelectors } from "./UIManagement.mjs";

document.addEventListener("DOMContentLoaded", function () {
  let game = new Game();
  game.initialize();
  initFlagSelectors(game);
});
