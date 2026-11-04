import { defineTexts } from "../types";

const SIGNUP_VARS = {
  name: "name of the person who signed up",
  event: "event title",
  date: "date and time of the event",
  guests: "number of people in the signup",
  total: "total price of the signup",
};

const FRIEND_VARS = {
  signer: "the name of the person who signed them up",
  event: "event title",
  date: "date and time of the event",
};

const SIGNUP_HINT =
  "The default for every event; an event can still set its own on its edit page. A blank line starts a new paragraph. The guest list, answers and prices follow automatically.";

// the signup messages are Markdown (app/shared/markdown.server.ts)
const SIGNUP_MESSAGE_MARKDOWN =
  "Markdown works here: [link text](https://…), **bold**, *italic*, and lines starting with - for a list.";

export const emailTexts = defineTexts("emails", {
  linkFallback: {
    label: "Under every button",
    default:
      "If the link doesn't work, copy and paste this address into your browser:",
    hint: "Followed by the link itself.",
  },

  "verify.subject": {
    label: "Verify email: subject",
    default: "Verify your email address",
  },
  "verify.welcome": {
    label: "Verify email: greeting",
    default: "Welcome to moku pona!",
  },
  "verify.body": {
    label: "Verify email: text",
    default: "Confirm your email address to activate your account:",
  },
  "verify.button": {
    label: "Verify email: button",
    default: "Verify email address",
  },
  "verify.note": {
    label: "Verify email: small print",
    default: "If you didn't create an account, you can ignore this email.",
  },

  "reset.subject": {
    label: "Password reset: subject",
    default: "Reset your password",
  },
  "reset.intro": {
    label: "Password reset: first paragraph",
    default: "Someone requested a password reset for your moku pona account.",
  },
  "reset.body": {
    label: "Password reset: second paragraph",
    default: "Set a new password here (the link expires in one hour):",
  },
  "reset.button": {
    label: "Password reset: button",
    default: "Reset password",
  },
  "reset.note": {
    label: "Password reset: small print",
    default:
      "If this wasn't you, you can ignore this email — your password stays unchanged.",
  },

  "invite.subject": {
    label: "Invite: subject",
    default: "You're invited to moku pona",
  },
  "invite.introModerator": {
    label: "Invite: first paragraph (moderator)",
    default:
      "You've been invited to join moku pona as a moderator and help run our events.",
  },
  "invite.introUser": {
    label: "Invite: first paragraph (user)",
    default: "You've been invited to join moku pona.",
  },
  "invite.body": {
    label: "Invite: second paragraph",
    default:
      "Accept your invite here (the link is tied to this email address and expires in 7 days):",
  },
  "invite.button": { label: "Invite: button", default: "Accept invite" },
  "invite.note": {
    label: "Invite: small print",
    default: "If you weren't expecting this, you can ignore this email.",
  },

  "signup.confirmedSubject": {
    label: "Event signup, seat confirmed: subject",
    default: "Your seat for {event} is confirmed",
    vars: SIGNUP_VARS,
    hint: SIGNUP_HINT,
  },
  "signup.confirmedMessage": {
    label: "Event signup, seat confirmed: message",
    default: [
      "Hi {name},",
      "your seat for {event} on {date} is confirmed. Here's everything you sent us.",
    ].join("\n\n"),
    kind: "paragraph",
    vars: SIGNUP_VARS,
    hint: `Also sent when a group is moved up from the waiting list. ${SIGNUP_MESSAGE_MARKDOWN}`,
  },
  "signup.waitlistedSubject": {
    label: "Event signup, waiting list: subject",
    default: "You're on the waiting list for {event}",
    vars: SIGNUP_VARS,
    hint: SIGNUP_HINT,
  },
  "signup.waitlistedMessage": {
    label: "Event signup, waiting list: message",
    default: [
      "Hi {name},",
      "thanks for signing up for {event} on {date}. There aren't enough seats left right now, so you're on the waiting list.",
      "We'll email you as soon as a seat is yours. Here's everything you sent us.",
    ].join("\n\n"),
    kind: "paragraph",
    vars: SIGNUP_VARS,
    hint: SIGNUP_MESSAGE_MARKDOWN,
  },
  "signup.guest": {
    label: "Event signup: heading for each guest",
    default: "Guest {number}: {name}",
    vars: { number: "the guest's position", name: "the guest's name" },
  },
  "signup.guestSelf": {
    label: "Event signup: heading for the person who signed up",
    default: "Guest {number}: {name} (you)",
    vars: { number: "always 1", name: "their name" },
  },
  "signup.guestFallback": {
    label: "Event signup: guest without a name",
    default: "Guest {number}",
    vars: { number: "the guest's position" },
  },
  "signup.guestEmail": {
    label: "Event signup: a friend's email, in the signer's copy",
    default: "Their email",
    hint: "Shown under a friend the signer gave an email address for.",
  },
  "signup.details": {
    label: "Event signup: contact details heading",
    default: "Your details",
  },
  "signup.price": { label: "Event signup: price heading", default: "Price" },
  "signup.priceWaitlisted": {
    label: "Event signup: price heading on the waiting list",
    default: "Price once you have a seat",
  },
  "signup.student": {
    label: "Event signup: student in the price list",
    default: "{name} (student)",
    vars: { name: "the guest's name" },
  },
  "signup.total.one": {
    label: "Event signup: total for one",
    default: "Total for 1 person",
  },
  "signup.total.other": {
    label: "Event signup: total for several",
    default: "Total for {count} people",
    vars: { count: "the number of guests" },
  },
  "signup.amount": {
    label: "Event signup: amount",
    default: "{amount} CHF",
    vars: { amount: "a price" },
  },
  "signup.free": { label: "Event signup: price of zero", default: "free" },
  "signup.yes": { label: "Event signup: ticked box", default: "yes" },
  "signup.no": { label: "Event signup: unticked box", default: "no" },
  "signup.button": {
    label: "Event signup: button",
    default: "View the event",
  },

  "friend.confirmedSubject": {
    label: "Signed up by a friend, seat confirmed: subject",
    default: "{signer} signed you up for {event}",
    vars: FRIEND_VARS,
    hint: "Sent to a friend the signer gave an email address for.",
  },
  "friend.waitlistedSubject": {
    label: "Signed up by a friend, waiting list: subject",
    default: "{signer} signed you up for {event}: waiting list",
    vars: FRIEND_VARS,
  },
  "friend.greeting": {
    label: "Signed up by a friend: greeting",
    default: "Hi {name},",
    vars: { name: "the friend's first name, as they gave it" },
  },
  "friend.confirmedBody": {
    label: "Signed up by a friend, seat confirmed: text",
    default:
      "{signer} signed you up for {event} on {date}. Your seat is confirmed.",
    kind: "paragraph",
    vars: FRIEND_VARS,
  },
  "friend.waitlistedBody": {
    label: "Signed up by a friend, waiting list: text",
    default:
      "{signer} signed you up for {event} on {date}. There aren't enough seats left right now, so you're on the waiting list. We'll email you as soon as a seat is yours.",
    kind: "paragraph",
    vars: FRIEND_VARS,
  },
  "friend.price": {
    label: "Signed up by a friend: your price",
    default: "Your price: {price}.",
    vars: { price: "what the friend pays" },
  },
  "friend.note": {
    label: "Signed up by a friend: small print",
    default:
      "Didn't expect this? Write to contact@mokupona.ch and we'll sort it out.",
  },
  "signup.note": {
    label: "Event signup: small print",
    default: "If you didn't sign up for this event, you can ignore this email.",
  },
});
