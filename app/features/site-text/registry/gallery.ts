import { defineTexts } from "../types";

export const galleryTexts = defineTexts("gallery", {
  "meta.title": { label: "Browser tab title", default: "Gallery" },
  eyebrow: {
    label: "Small heading above the title",
    default: "from the table",
  },
  title: { label: "Page title", default: "gallery" },
  intro: {
    label: "Intro",
    default:
      "plates, hands, half-finished glasses — everything we managed to photograph before it was eaten.",
    kind: "paragraph",
  },
  empty: {
    label: "No photos yet",
    default:
      "no photographs yet. the first ones appear once an event has been eaten and someone remembers to bring a camera.",
    kind: "paragraph",
  },

  "album.back": {
    label: "Back link on an event's album",
    default: "gallery",
  },
  "album.metaTitle": {
    label: "Browser tab title of an event's album",
    default: "{title} — gallery",
    vars: { title: "the event's title" },
  },
  "event.heading": {
    label: "Photos on a past event's page",
    default: "from that evening",
  },
  "wall.emptyLabel": {
    label: "Empty photo wall: small heading",
    default: "no photos yet",
    hint: "Where a photo wall has nothing to show yet.",
  },
  "wall.emptyBody": {
    label: "Empty photo wall: text",
    default:
      "nothing on the wall yet. the next event will hang the first ones.",
  },
  "lightbox.title": {
    label: "Photo viewer (read out)",
    default: "gallery",
    hint: "Screen readers announce it when a photo opens full size.",
  },
});
