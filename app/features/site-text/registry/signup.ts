import { defineTexts } from "../types";

export const signupTexts = defineTexts("signup", {
  heading: {
    label: "Heading above the form",
    default: "reserve your seat",
  },
  privacy: {
    label: "Privacy checkbox",
    default: "i agree to the <link>privacy policy</link>",
    tags: { link: "link to the privacy policy" },
  },
  "waitlistWarning.one": {
    label: "Waiting list warning (one seat left)",
    default:
      "only {left} seat left, so a group of {party} goes on the waiting list.",
    vars: { left: "seats still free", party: "people in the signup" },
    hint: "Shown while the form holds more people than there are seats.",
  },
  "waitlistWarning.other": {
    label: "Waiting list warning (several seats left)",
    default:
      "only {left} seats left, so a group of {party} goes on the waiting list.",
    vars: { left: "seats still free", party: "people in the signup" },
  },
  submit: { label: "Sign-up button", default: "join this event" },
  submitWaitlist: {
    label: "Sign-up button for the waiting list",
    default: "join the waiting list",
  },
  footnote: {
    label: "Note under the button",
    default: "we'll email you right away whether you have a seat.",
  },
  footnoteFull: {
    label: "Note under the button once fully booked",
    default:
      "this event is fully booked. we'll email you as soon as a seat is yours.",
  },

  "list.upTo": {
    label: "Limit next to a list (e.g. friends)",
    default: "up to {count}",
    vars: { count: "how many entries the list takes" },
  },
  "list.item": {
    label: "Heading of each list entry",
    default: "{label} {number}",
    vars: {
      label: "the list's label, e.g. Friends",
      number: "the entry's position",
    },
  },
  "select.placeholder": {
    label: "Empty choice of a dropdown",
    default: "Select…",
  },

  "validation.required": {
    label: "Missing answer",
    default: "{label} is required",
    vars: { label: "the question's label" },
  },
  "validation.invalid": {
    label: "Invalid answer",
    default: "{label} is invalid",
    vars: { label: "the question's label" },
  },
  "validation.listMax.one": {
    label: "Too many list entries (limit of one)",
    default: "{label} can have at most {count} entry",
    vars: { label: "the list's label", count: "the limit" },
  },
  "validation.listMax.other": {
    label: "Too many list entries",
    default: "{label} can have at most {count} entries",
    vars: { label: "the list's label", count: "the limit" },
  },
  "validation.privacy": {
    label: "Privacy checkbox not ticked",
    default: "You must agree to signup",
  },

  "error.formChanged": {
    label: "Form changed while filling it in",
    default:
      "The signup form was updated while you were filling it out. Please review your answers and submit again.",
    kind: "paragraph",
  },
  "error.duplicate": {
    label: "Email already signed up",
    default:
      "This email address is already signed up for this event. If you'd like to change your signup, please get in touch with us.",
    kind: "paragraph",
  },
  "error.saveFailed": {
    label: "Signup couldn't be saved",
    default: "Your signup could not be saved. Please try again.",
  },

  "toast.confirmedTitle": {
    label: "Pop-up after signing up: title",
    default: "You're in!",
  },
  "toast.confirmedBody": {
    label: "Pop-up after signing up: text",
    default: "Your seat is confirmed. We've emailed you the details.",
  },
  "toast.waitlistedTitle": {
    label: "Pop-up after joining the waiting list: title",
    default: "You're on the waiting list",
  },
  "toast.waitlistedBody": {
    label: "Pop-up after joining the waiting list: text",
    default:
      "There weren't enough seats left. We've emailed you the details and will let you know as soon as a seat is yours.",
    kind: "paragraph",
  },
});
