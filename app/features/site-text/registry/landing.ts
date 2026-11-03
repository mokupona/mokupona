import { defineTexts } from "../types";

export const landingTexts = defineTexts("landing", {
  "meta.title": {
    label: "Browser tab title",
    default: "moku pona",
    hint: "Also the title when the page is shared.",
  },
  "meta.description": {
    label: "Search and share description",
    default:
      "A culinary society in Zurich, bringing people together through shared meals, stories, and the joy of discovery.",
    kind: "paragraph",
  },

  "titleCard.title": {
    label: "Title card name (read out)",
    default: "moku pona",
    hint: "The drawn wordmark at the top is artwork; this is what screen readers announce for it.",
  },
  "titleCard.scroll": {
    label: "Scroll cue",
    default: "scroll",
    hint: "Under the wordmark, above the arrow.",
  },

  "vision.headline": {
    label: "Vision headline",
    default: "food as a way to connect",
  },
  "vision.body": {
    label: "Vision text",
    default:
      "moku pona began as a passion project by a group of friends who love cooking and wanted a creative way to explore our culinary interests. for us, food is a way to express creativity, share experiences, and connect with others. through our community, we surprise our guests with unique flavors and ingredients, introducing them to diverse cuisines and the stories behind them.",
    kind: "paragraph",
  },

  "dinners.empty": {
    label: "No upcoming event",
    default:
      "nothing on the calendar right now — we're planning the next gathering. the table is never empty for long.",
    kind: "paragraph",
    hint: "Shown under “the next dinner” while nothing is scheduled.",
  },
  "dinners.seeMore": {
    label: "“See more” tile after the past events",
    default: "see more →",
  },
  "dinners.seeAll": {
    label: "Link to all events",
    default: "see all events →",
    hint: "Shown when every past event already fits on the page.",
  },
});
