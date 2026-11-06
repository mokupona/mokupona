import { defineTexts } from "../types";

const PARAGRAPHS_HINT = "Leave an empty line between paragraphs.";

export const aboutTexts = defineTexts("about", {
  "meta.title": { label: "Browser tab title", default: "About" },
  "meta.description": {
    label: "Search and share description",
    default: "The people behind moku pona, a non-profit dinner club in Zurich.",
    kind: "paragraph",
  },
  eyebrow: { label: "Small heading above the title", default: "about us" },
  title: { label: "Page title", default: "moku pona" },
  intro: {
    label: "Intro",
    default:
      "we're a non-profit dinner club in zurich. our mission is to connect people through shared meals and storytelling.",
    kind: "paragraph",
  },

  "story.headline": {
    label: "“How we started” headline",
    default: "from our living room",
  },
  "story.body": {
    label: "“How we started” text",
    default:
      "we started in our living room, hosting our close friends. we wanted the freedom to explore our creativity with food, but also to learn more about kitchens around the world and share the “red thread” connecting many of them through each course 🙂\n\nthese dinners combined our interest in history, culture, food and storytelling. it's a way to learn about a place and its kitchen, and to get creative with the stories around a topic related to food. at these dinners we try to use the moment to teach our guests something, about a place, a food, an idea or a moment in time. it's a gift to have 40 or so people give you their full attention.",
    kind: "paragraph",
    hint: PARAGRAPHS_HINT,
  },

  "why.headline": {
    label: "“Why we do it” headline",
    default: "away from the small talk",
  },
  "why.body": {
    label: "“Why we do it” text",
    default:
      "there are rarely moments in adult life where you can meet and really connect with strangers. we set up these dinners to create a real nexus of connection, away from the small talk.\n\nwe also got tired of seeing the rise of performative dinners online, with beautiful tables and designed food. we think the sign of a good meal is the smeared plates, the empty wine bottles and a lingering sense that some important conversations happened here.",
    kind: "paragraph",
    hint: PARAGRAPHS_HINT,
  },

  "name.headline": {
    label: "“The name” headline",
    default: "why moku pona?",
  },
  "name.body": {
    label: "“The name” text",
    default:
      "bharat is a linguist nerd, and when we developed the idea for a dinner club, bharat became obsessed with <link>toki pona</link>, one of the simplest constructed languages, created by canadian linguist sonja lang. we thought of ideas to name our dinner club using this language and settled on “moku pona”, or “good food” in english.\n\nthis story remains in our name and in our menus. all our menus are first in toki pona, then translated to english.",
    kind: "paragraph",
    tags: { link: "Link to tokipona.org, the official toki pona site" },
    hint: PARAGRAPHS_HINT,
  },

  "what.headline": {
    label: "“What we do” headline",
    default: "what we do",
  },
  "what.body": {
    label: "“What we do” text",
    default:
      "we host themed and researched dinners covering topics in food history and cultural moments. we create a space for our guests to connect, not simply consume. the dinner is a shared space for all to contribute.",
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
      "we are a group of friends and food enthusiasts. and surprise, we also love to cook (and eat)! we learn constantly from each other and develop our dinners together.",
    kind: "paragraph",
  },
  hallOfFame: {
    label: "Heading above the board members",
    default: "board",
    hint: "The people themselves are edited under Admin → Board.",
  },
  hallEmpty: {
    label: "No board members yet",
    default: "photos coming soon.",
    kind: "paragraph",
  },
  "volunteers.heading": {
    label: "Heading above the volunteers",
    default: "volunteers",
    hint: "Shown only when there are volunteers. The people themselves are edited under Admin → Volunteers.",
  },

  "join.headline": {
    label: "“Become a volunteer” headline",
    default: "become a volunteer",
  },
  "join.body": {
    label: "“Become a volunteer” text",
    default:
      "we are always looking for more enthusiastic people to contribute to the project, so if you're feeling inspired, sign up as a volunteer!",
    kind: "paragraph",
  },
  "join.button": {
    label: "“Become a volunteer” button",
    default: "sign up as a volunteer",
    hint: "Opens the volunteer sign-up form.",
  },

  "signup.title": {
    label: "Sign-up form title",
    default: "become a volunteer",
  },
  "signup.description": {
    label: "Sign-up form intro",
    default: "leave your name and email and we'll get back to you.",
    kind: "paragraph",
  },
  "signup.name": { label: "Sign-up form: name field", default: "Name" },
  "signup.email": { label: "Sign-up form: email field", default: "Email" },
  "signup.message": {
    label: "Sign-up form: message field",
    default: "Anything you'd like to tell us?",
  },
  "signup.messageHint": {
    label: "Sign-up form: message field hint",
    default: "Optional",
  },
  "signup.submit": { label: "Sign-up form: send button", default: "send" },
  "signup.sending": {
    label: "Sign-up form: send button while sending",
    default: "sending…",
  },
  "signup.nameRequired": {
    label: "Sign-up form: name missing",
    default: "Please enter your name",
  },
  "signup.emailRequired": {
    label: "Sign-up form: email missing or invalid",
    default: "Please enter your email address",
  },
  "signup.failed": {
    label: "Sign-up form: sending failed",
    default: "Something went wrong. You can also email us at {email}.",
    vars: { email: "the address sign-ups are sent to" },
  },
  "signup.sentTitle": {
    label: "Sign-up form: thank-you title",
    default: "thank you!",
  },
  "signup.sentBody": {
    label: "Sign-up form: thank-you text",
    default: "we'll get back to you soon.",
    kind: "paragraph",
  },
  "signup.close": {
    label: "Sign-up form: close button",
    default: "close",
  },
});
