import { defineTexts } from "../types";

export const eventsTexts = defineTexts("events", {
  "meta.title": { label: "Browser tab title", default: "Events" },

  "index.eyebrow": {
    label: "Small heading above the title",
    default: "gatherings",
  },
  "index.title": { label: "Page title", default: "events" },
  "index.introUpcoming": {
    label: "Intro while events are scheduled",
    default:
      "a handful of seats open before each supper. reserve early, tables are small and fill quickly.",
    kind: "paragraph",
  },
  "index.introEmpty": {
    label: "Intro while nothing is scheduled",
    default:
      "we run a handful of intimate events a year. there's nothing on the calendar right now, but the next one is never far off.",
    kind: "paragraph",
  },
  "index.alsoComingUp": {
    label: "Heading above further upcoming events",
    default: "also coming up",
  },

  "empty.label": {
    label: "No upcoming event: small label",
    default: "nothing on the calendar right now",
  },
  "empty.heading": {
    label: "No upcoming event: heading",
    default: "the table is being set",
  },
  "empty.body": {
    label: "No upcoming event: text",
    default:
      "we're planning the next gathering. check back soon to see what's next, or follow along on instagram for the announcement.",
    kind: "paragraph",
  },
  "empty.instagram": {
    label: "No upcoming event: Instagram button",
    default: "follow us on instagram",
  },

  "card.nextBadge": {
    label: "Badge on the next event's photo",
    default: "next event",
  },
  "card.reserve": {
    label: "Reserve button on the next event",
    default: "reserve a seat",
    hint: "On the landing and events pages.",
  },
  "card.readMore": {
    label: "Read more link on the next event",
    default: "read more →",
  },

  "facts.locationLabel": {
    label: "Location (read out)",
    default: "location",
    hint: "Screen readers announce it before the address.",
  },
  "facts.priceLabel": {
    label: "Price (read out)",
    default: "price",
    hint: "Screen readers announce it before the price.",
  },
  "facts.price": {
    label: "Price",
    default: "{price} chf",
    vars: { price: "the event's price" },
  },
  "facts.studentPrice": {
    label: "Student price",
    default: "· students {price} chf",
    vars: { price: "the student price" },
    hint: "Only on events that have a student price.",
  },
  "facts.seats": {
    label: "Seats",
    default: "{slots} seats",
    vars: { slots: "the number of seats" },
  },
  "facts.seatsLeft": {
    label: "Seats left",
    default: "{left} of {slots} seats left",
    vars: { left: "seats still free", slots: "the number of seats" },
  },
  "facts.fullyBooked": {
    label: "Fully booked",
    default: "fully booked · waiting list open",
  },
  "facts.discounts": {
    label: "Discounts link",
    default: "discounts",
  },
  "facts.noDiscounts": {
    label: "No discounts",
    default: "no discounts currently available",
    hint: "In the discounts pop-up when the event lists none.",
  },

  "detail.back": { label: "Back link on an event", default: "all events" },
  "detail.menu": { label: "Menu section", default: "menu" },
  "detail.donation": { label: "Donation section", default: "donation" },
  "detail.volunteers": {
    label: "Heading above a past event's volunteers",
    default: "made possible by",
    hint: "Under a past event, when volunteers are credited for it.",
  },
  "detail.metaTitle": {
    label: "Browser tab title of an event",
    default: "Event - {title}",
    vars: { title: "the event's title" },
  },
  "detail.metaFallback": {
    label: "Browser tab title while an event is missing",
    default: "Event",
  },
});
