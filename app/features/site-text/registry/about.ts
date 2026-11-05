import { defineTexts } from "../types";

const PARAGRAPHS_HINT = "Leave an empty line between paragraphs.";

export const aboutTexts = defineTexts("about", {
  "meta.title": { label: "Browser tab title", default: "About" },
  "meta.description": {
    label: "Search and share description",
    default:
      "moku pona is a non-profit dinner club in Zurich. We cook themed dinners, tell the stories behind them and get strangers talking to each other. Meet the people who make it happen.",
    kind: "paragraph",
  },
  eyebrow: { label: "Small heading above the title", default: "about us" },
  title: {
    label: "Page title",
    default: "hi, we're moku pona",
  },
  intro: {
    label: "Intro",
    default:
      "we're a non-profit dinner club in zurich. we cook themed dinners for around forty people at a time, tell a few stories along the way, and try to get everyone at the table talking to each other.",
    kind: "paragraph",
  },

  "story.eyebrow": {
    label: "“How it started” small heading",
    default: "how it started",
  },
  "story.headline": {
    label: "“How it started” headline",
    default: "it started in our living room",
  },
  "story.body": {
    label: "“How it started” text",
    default:
      "at first it was just us cooking for close friends at home, mostly because we wanted an excuse to try things we'd never made before.\n\nthen we got hooked on where the dishes actually come from. you start digging and you find the same ideas popping up in kitchens on opposite sides of the world. we call that the red thread, and we like following it from one course to the next.\n\nit ended up pulling together everything we're into anyway: history, culture, food and a good story. so every dinner has a topic now. we dig into a place, its kitchen or a moment in time, and we try to teach you something while you eat. it's not often you get forty people actually listening to you, so we try to make it count.",
    kind: "paragraph",
    hint: PARAGRAPHS_HINT,
  },

  "why.eyebrow": {
    label: "“Why we do it” small heading",
    default: "why we do it",
  },
  "why.headline": {
    label: "“Why we do it” headline",
    default: "meeting new people as an adult is weirdly hard",
  },
  "why.body": {
    label: "“Why we do it” text",
    default:
      'think about it. when was the last time you sat down with a table full of strangers and talked about something real? once you\'re out of school it barely happens. we wanted a room where it does, where you skip the "so what do you do?" bit and get to the good conversations.\n\nand honestly, we got a bit tired of all the perfect dinner parties online. the styled tables, the food that looks like it was made for the camera. to us a good dinner looks like smeared plates and empty wine bottles, and you walk out feeling like something important got said at that table.',
    kind: "paragraph",
    hint: PARAGRAPHS_HINT,
  },

  "name.eyebrow": {
    label: "“The name” small heading",
    default: "the name",
  },
  "name.headline": {
    label: "“The name” headline",
    default: "so why “moku pona”?",
  },
  "name.body": {
    label: "“The name” text",
    default:
      "blame bharat, our resident language nerd. right when we were dreaming up the dinner club, bharat got completely obsessed with <link>toki pona</link>. it's a tiny made-up language by a canadian linguist called sonja lang, and it only has about 120 words.\n\nwe spent an evening trying to name ourselves in it and kept coming back to moku pona. moku means food, pona means good. good food. hard to argue with that.\n\nand it stuck. every menu we write is in toki pona first, with the english underneath.",
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
    default: "dinner, with a bit of homework",
  },
  "what.body": {
    label: "“What we do” text",
    default:
      "every dinner is built around a slice of food history or a cultural moment. we research it, cook it, and tell you the story behind each course as it comes out.\n\nit's not a restaurant though, and you're not just there to be served. everyone at the table brings something to it, whether that's a question, a story of their own or just a big appetite.\n\nwe're a non-profit association, so nobody's in it for the money. we just really love doing it.",
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
      "we're a bunch of friends who are a little too into food. and yes, surprise, we love to cook (and eat). we plan every dinner together and we're always learning stuff from each other. there's room for more of us, too. if this sounds like your kind of thing, there's a sign-up at the bottom of the page.",
    kind: "paragraph",
  },
  hallOfFame: {
    label: "Heading above the board members",
    default: "the board",
    hint: "The people themselves are edited under Admin → Board.",
  },
  hallEmpty: {
    label: "No board members yet",
    default:
      "we're still trying to get everyone to sit still for a photo. check back soon.",
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
      "these are the people chopping onions, pouring wine and doing the dishes at midnight. none of the dinners would happen without them.",
    kind: "paragraph",
    optional: true,
  },

  "join.eyebrow": {
    label: "“Become a volunteer” small heading",
    default: "get involved",
  },
  "join.headline": {
    label: "“Become a volunteer” headline",
    default: "fancy helping out?",
  },
  "join.body": {
    label: "“Become a volunteer” text",
    default:
      "you don't need to be a chef. we need people to cook, host, dig into the research, pour wine and, yes, wash up. if any of that sounds fun, leave us your details and we'll be in touch.",
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
    default: "tell us a bit about yourself and one of us will get back to you.",
    kind: "paragraph",
  },
  "signup.name": { label: "Sign-up form: name field", default: "Name" },
  "signup.email": { label: "Sign-up form: email field", default: "Email" },
  "signup.message": {
    label: "Sign-up form: message field",
    default: "Anything else?",
  },
  "signup.messageHint": {
    label: "Sign-up form: message field hint",
    default:
      "Optional. What would you like to help with? A cuisine you can't stop cooking?",
  },
  "signup.submit": { label: "Sign-up form: send button", default: "send" },
  "signup.sending": {
    label: "Sign-up form: send button while sending",
    default: "sending…",
  },
  "signup.nameRequired": {
    label: "Sign-up form: name missing",
    default: "What should we call you?",
  },
  "signup.emailRequired": {
    label: "Sign-up form: email missing or invalid",
    default: "We need an email address to get back to you",
  },
  "signup.failed": {
    label: "Sign-up form: sending failed",
    default:
      "Hmm, that didn't go through. You can always just email us at {email}.",
    vars: { email: "the address sign-ups are sent to" },
  },
  "signup.sentTitle": {
    label: "Sign-up form: thank-you title",
    default: "thanks!",
  },
  "signup.sentBody": {
    label: "Sign-up form: thank-you text",
    default: "got it. one of us will email you soon.",
    kind: "paragraph",
  },
  "signup.close": {
    label: "Sign-up form: close button",
    default: "close",
  },
});
