import { defineTexts } from "../types";

const PARAGRAPHS_HINT = "Leave an empty line between paragraphs.";

export const aboutTexts = defineTexts("about", {
  "meta.title": { label: "Browser tab title", default: "About" },
  "meta.description": {
    label: "Search and share description",
    default:
      "moku pona is a non-profit dinner society in Zurich, connecting people through shared meals and storytelling. Meet the team behind the dinners.",
    kind: "paragraph",
  },
  eyebrow: { label: "Small heading above the title", default: "about us" },
  title: {
    label: "Page title",
    default: "good food, good stories, good company",
  },
  intro: {
    label: "Intro",
    default:
      "moku pona is a non-profit dinner society in zurich. our mission is to connect people through shared meals and storytelling.",
    kind: "paragraph",
  },

  "story.eyebrow": {
    label: "“How it started” small heading",
    default: "how it started",
  },
  "story.headline": {
    label: "“How it started” headline",
    default: "it began in our living room",
  },
  "story.body": {
    label: "“How it started” text",
    default:
      "the first moku pona dinners were for our closest friends, around our own table. we wanted the freedom to get creative with food, and to learn about kitchens from around the world — and the red thread that connects so many of them, course by course.\n\nthose evenings brought together everything we love: history, culture, food and storytelling. each dinner is a way to learn about a place and its kitchen, and to get creative with the stories behind a topic. and we always try to teach our guests something — about a place, a food, an idea or a moment in time. having forty or so people give you their full attention is a gift, and we try to make the most of it.",
    kind: "paragraph",
    hint: PARAGRAPHS_HINT,
  },

  "why.eyebrow": {
    label: "“Why we do it” small heading",
    default: "why we do it",
  },
  "why.headline": {
    label: "“Why we do it” headline",
    default: "real connection, away from the small talk",
  },
  "why.body": {
    label: "“Why we do it” text",
    default:
      "adult life rarely gives you the chance to meet strangers and really connect with them. we set these dinners up to make that happen.\n\nwe're also a little tired of the performative dinners online — perfectly styled tables and food designed for the camera. to us, the sign of a good meal is smeared plates, empty wine bottles, and a lingering sense that some important conversations happened here.",
    kind: "paragraph",
    hint: PARAGRAPHS_HINT,
  },

  "name.eyebrow": {
    label: "“The name” small heading",
    default: "the name",
  },
  "name.headline": {
    label: "“The name” headline",
    default: "why “moku pona”?",
  },
  "name.body": {
    label: "“The name” text",
    default:
      "when we were dreaming up a dinner club, bharat — our resident linguistics nerd — had just become obsessed with <link>toki pona</link>, the minimalist constructed language created by canadian linguist sonja lang. it gets by on roughly 120 words.\n\nwe tried out names in it and settled on “moku pona”: moku (food) and pona (good). good food — simple, and exactly the point.\n\nthe language never left the table. every menu we write is in toki pona first, then translated into english.",
    kind: "paragraph",
    tags: { link: "Link to tokipona.org, the official toki pona site" },
    hint: PARAGRAPHS_HINT,
  },

  "what.eyebrow": {
    label: "“What we do” small heading",
    default: "what we do",
  },
  "what.headline": {
    label: "“What we do” headline",
    default: "themed, researched dinners",
  },
  "what.body": {
    label: "“What we do” text",
    default:
      "we host dinners built around food history and cultural moments, researched and cooked by us. but a moku pona dinner isn't something you simply consume — it's a shared space that every guest helps shape.\n\nwe're a non-profit association, run by a group of friends who simply love to cook and to share a table.",
    kind: "paragraph",
    hint: PARAGRAPHS_HINT,
  },

  "team.heading": {
    label: "“Meet the team” heading",
    default: "meet the team",
  },
  "team.body": {
    label: "“Meet the team” text",
    default:
      "we're a group of friends and food enthusiasts — and, surprise, we also love to cook (and eat). we learn constantly from each other and develop our dinners together. we're always looking for more enthusiastic people to contribute, so if you're feeling inspired, sign up as a volunteer!",
    kind: "paragraph",
  },
  "team.button": {
    label: "“Meet the team” sign-up button",
    default: "sign up to volunteer",
    hint: "Opens the volunteer sign-up form.",
  },
  hallOfFame: {
    label: "Heading above the board members",
    default: "board",
    hint: "The people themselves are edited under Admin → Board.",
  },
  hallEmpty: {
    label: "No board members yet",
    default:
      "still being hung. check back once we've persuaded everyone to sit still for a photograph.",
    kind: "paragraph",
  },
  "volunteers.heading": {
    label: "Heading above the volunteers",
    default: "volunteers",
    hint: "Shown only when there are volunteers. The people themselves are edited under Admin → Volunteers.",
  },
  "volunteers.body": {
    label: "Text above the volunteers",
    default:
      "the hands in the kitchen, at the door and at the sink — every evening happens because of them.",
    kind: "paragraph",
    optional: true,
  },

  "join.eyebrow": {
    label: "“Become a volunteer” small heading",
    default: "get involved",
  },
  "join.headline": {
    label: "“Become a volunteer” headline",
    default: "become a volunteer",
  },
  "join.body": {
    label: "“Become a volunteer” text",
    default:
      "cook, host, research a theme, pour the wine or wash up — there's a seat for you on our side of the table too.",
    kind: "paragraph",
  },
  "join.button": {
    label: "“Become a volunteer” button",
    default: "become a volunteer",
    hint: "Opens the volunteer sign-up form.",
  },

  "signup.title": {
    label: "Sign-up form title",
    default: "become a volunteer",
  },
  "signup.description": {
    label: "Sign-up form intro",
    default:
      "leave your details and we'll get back to you about how you could get involved.",
    kind: "paragraph",
  },
  "signup.name": { label: "Sign-up form: name field", default: "Name" },
  "signup.email": { label: "Sign-up form: email field", default: "Email" },
  "signup.message": {
    label: "Sign-up form: message field",
    default: "Anything you'd like us to know?",
  },
  "signup.messageHint": {
    label: "Sign-up form: message field hint",
    default: "Optional — what you'd like to help with, a cuisine you love, …",
  },
  "signup.submit": { label: "Sign-up form: send button", default: "send" },
  "signup.sending": {
    label: "Sign-up form: send button while sending",
    default: "sending…",
  },
  "signup.nameRequired": {
    label: "Sign-up form: name missing",
    default: "Tell us your name",
  },
  "signup.emailRequired": {
    label: "Sign-up form: email missing or invalid",
    default: "We need an email address to get back to you",
  },
  "signup.failed": {
    label: "Sign-up form: sending failed",
    default:
      "Something went wrong sending that. You can always email us at {email}.",
    vars: { email: "the address sign-ups are sent to" },
  },
  "signup.sentTitle": {
    label: "Sign-up form: thank-you title",
    default: "thank you!",
  },
  "signup.sentBody": {
    label: "Sign-up form: thank-you text",
    default: "we've got your details and will be in touch soon.",
    kind: "paragraph",
  },
  "signup.close": {
    label: "Sign-up form: close button",
    default: "close",
  },
});
