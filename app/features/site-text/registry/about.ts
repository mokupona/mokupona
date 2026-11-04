import { defineTexts } from "../types";

export const aboutTexts = defineTexts("about", {
  "meta.title": { label: "Browser tab title", default: "About" },
  "meta.description": {
    label: "Search and share description",
    default:
      "The people behind moku pona — a dinner society in Zurich built on community, creativity, and hospitality.",
    kind: "paragraph",
  },
  eyebrow: { label: "Small heading above the title", default: "the people" },
  title: { label: "Page title", default: "about" },
  intro: {
    label: "Intro",
    default:
      "moku pona runs on volunteers — the ones who cook, host, wash up, and somehow still have room for dessert.",
    kind: "paragraph",
  },
  "whoWeAre.eyebrow": {
    label: "“Who we are” small heading",
    default: "who we are",
  },
  "whoWeAre.headline": {
    label: "“Who we are” headline",
    default: "a community of around fifteen",
  },
  "whoWeAre.body": {
    label: "“Who we are” text",
    default:
      "what started as a shared love of cooking has grown into a community who come together to create, host, and share meals. as an association, moku pona is about community, creativity, and hospitality, not just dining, but making people feel welcome.",
    kind: "paragraph",
  },
  hallOfFame: {
    label: "Heading above the board members",
    default: "the moku pona hall of fame",
    hint: "The people themselves are edited under Admin → Board.",
  },
  hallEmpty: {
    label: "No board members yet",
    default:
      "the hall is still being hung. check back once we've persuaded everyone to sit still for a photograph.",
    kind: "paragraph",
  },
  "volunteers.heading": {
    label: "Heading above the volunteers",
    default: "our volunteers",
    hint: "Shown only when there are volunteers. The people themselves are edited under Admin → Volunteers.",
  },
  "volunteers.body": {
    label: "Text above the volunteers",
    default:
      "the hands in the kitchen, at the door and at the sink — every evening happens because of them.",
    kind: "paragraph",
  },
});
