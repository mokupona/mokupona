import { defineTexts } from "../types";

export const musiTexts = defineTexts("musi", {
  metaTitle: { label: "Browser tab title", default: "musi · moku pona" },
  back: { label: "Back link", default: "moku pona" },
  machineLabel: {
    label: "Word above the score",
    default: "pona",
  },
  score: {
    label: "Score (read out)",
    default: "score {score}",
    vars: { score: "the current score" },
  },
  timeLeft: {
    label: "Clock (read out)",
    default: "{seconds} seconds left",
    vars: { seconds: "seconds left" },
  },
  start: { label: "Start button", default: "start" },
  holeUp: {
    label: "Hole with a soweli (read out)",
    default: "soweli! bonk it",
  },
  holeEmpty: { label: "Empty hole (read out)", default: "empty hole" },
  readyTitle: { label: "Before a game: heading", default: "bonk the soweli!" },
  readyBody: { label: "Before a game: text", default: "you have one minute." },
  overTitle: { label: "Game over: heading", default: "tenpo li pini!" },
  overBody: {
    label: "Game over: score",
    default: "time's up — you bonked {score} soweli.",
    vars: { score: "the score, in bold" },
  },
  overBest: {
    label: "Game over: best score",
    default: "best so far: {best}",
    vars: { best: "the best score, in bold" },
  },
  playAgain: { label: "Game over: button", default: "play again" },
  backHome: { label: "Game over: link home", default: "back to moku pona" },
  tip: {
    label: "Keyboard tip",
    default: "tip: the number keys work too — 7 8 9 / 4 5 6 / 1 2 3",
    hint: "Hidden on touch screens.",
  },
});
