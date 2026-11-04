import { defineTexts } from "../types";

export const siteTexts = defineTexts("site", {
  "brand.name": {
    label: "Club name",
    default: "moku pona",
    hint: "Next to the logo in the footer, and read out for the logo link in the header.",
  },

  "nav.events": { label: "Events link", default: "events" },
  "nav.gallery": { label: "Gallery link", default: "gallery" },
  "nav.about": { label: "About link", default: "about" },
  "nav.instagram": { label: "Instagram link", default: "instagram" },
  "nav.admin": {
    label: "Admin link",
    default: "admin area",
    hint: "Only moderators and admins see it.",
  },
  "nav.account": {
    label: "Account link",
    default: "account",
    hint: "Shown while logged in.",
  },
  "nav.logout": { label: "Log out button", default: "logout" },
  "nav.openMenu": {
    label: "Open menu button (read out)",
    default: "Open menu",
    hint: "The phone menu button; screen readers announce it.",
  },
  "nav.closeMenu": {
    label: "Close menu button (read out)",
    default: "Close menu",
  },

  "footer.tagline": {
    label: "Footer tagline",
    default: "made with love in zürich",
    hint: "Also at the bottom of the phone menu.",
  },
  "footer.explore": { label: "Footer heading: links", default: "explore" },
  "footer.follow": { label: "Footer heading: social", default: "follow" },
  "footer.privacy": {
    label: "Privacy policy link",
    default: "privacy policy",
    hint: "In the footer and the phone menu.",
  },
  "footer.impressum": {
    label: "Impressum link",
    default: "impressum",
    hint: "In the footer and the phone menu.",
  },

  "headings.ourVision": {
    label: "Drawn heading “our vision” (read out)",
    default: "our vision",
    hint: "The hand-drawn heading is artwork; this is what screen readers announce for it.",
  },
  "headings.nextDinner": {
    label: "Drawn heading “the next dinner” (read out)",
    default: "the next dinner",
    hint: "On the landing and events pages.",
  },
  "headings.pastDinners": {
    label: "Drawn heading “past dinners” (read out)",
    default: "past dinners",
    hint: "On the landing and events pages.",
  },

  "photoCount.one": {
    label: "Photo count (one)",
    default: "{count} photo",
    hint: "Under event and album covers.",
    vars: { count: "the number of photos" },
  },
  "photoCount.other": {
    label: "Photo count (several)",
    default: "{count} photos",
    vars: { count: "the number of photos" },
  },

  "role.user": { label: "Role name: user", default: "user" },
  "role.moderator": { label: "Role name: moderator", default: "moderator" },
  "role.admin": { label: "Role name: admin", default: "admin" },

  "forms.retry": {
    label: "Form couldn't be checked",
    default: "Something went wrong. Please try submitting the form again.",
    hint: "When the spam check can't verify a sign-up form, so the visitor has to send it again.",
  },
  "google.continue": {
    label: "Google button",
    default: "Continue with Google",
  },
  "google.or": {
    label: "Divider above the Google button",
    default: "or",
  },

  "a11y.previousSlide": {
    label: "Previous photo button (read out)",
    default: "Previous slide",
  },
  "a11y.nextSlide": {
    label: "Next photo button (read out)",
    default: "Next slide",
  },
  "a11y.carousel": {
    label: "Photo slider (read out)",
    default: "carousel",
    hint: "What screen readers call the photo slider.",
  },
  "a11y.slide": {
    label: "Photo in the slider (read out)",
    default: "slide",
  },
  "a11y.closeDialog": {
    label: "Close button of pop-ups (read out)",
    default: "Close",
  },

  "error.notFoundHeading": {
    label: "Page not found: heading",
    default: "404 Not Found",
  },
  "error.notFoundMessage": {
    label: "Page not found: message",
    default: "Not found",
    optional: true,
  },
  "error.forbiddenHeading": {
    label: "No access: heading",
    default: "403",
    hint: "E.g. a logged-in member opening the admin area.",
  },
  "error.forbiddenMessage": {
    label: "No access: message",
    default: "Forbidden",
    optional: true,
  },
  "error.statusHeading": {
    label: "Other errors: heading",
    default: "{status} {statusText}",
    vars: {
      status: "the error number, e.g. 500",
      statusText: "its standard name, e.g. Internal Server Error",
    },
  },
  "error.heading": {
    label: "Unexpected error: heading",
    default: "Error",
  },
  "error.unknownHeading": {
    label: "Unknown error: heading",
    default: "Unknown Error",
  },
});
