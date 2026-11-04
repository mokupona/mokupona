import { defineTexts } from "../types";

export const inviteTexts = defineTexts("invite", {
  metaTitle: { label: "Browser tab title", default: "Invite" },

  "invalid.heading": {
    label: "Unknown invite: heading",
    default: "we don't recognise this invite",
  },
  "invalid.body": {
    label: "Unknown invite: text",
    default: "double-check you copied the whole thing from your email.",
  },
  "expired.heading": {
    label: "Expired invite: heading",
    default: "this invite has expired",
  },
  "expired.body": {
    label: "Expired invite: text",
    default:
      "invites last about a week. ask whoever invited you to send a fresh one, or browse our public events in the meantime.",
    kind: "paragraph",
  },
  "used.heading": {
    label: "Used invite: heading",
    default: "this invite has already been accepted",
  },
  "used.body": {
    label: "Used invite: text",
    default: "if that was you, just log in.",
  },
  browseEvents: {
    label: "Dead invite: events button",
    default: "browse events",
  },
  goToLogin: { label: "Dead invite: log in link", default: "go to log in" },

  acceptTitle: {
    label: "Accept: heading",
    default: "accept your invite",
  },
  "confirm.body": {
    label: "Accept while logged in: text",
    default: "you're signed in as {email}. accept to confirm.",
    vars: { email: "the address they're logged in with" },
  },
  "confirm.bodyUpgrade": {
    label: "Accept while logged in: text when the role changes",
    default: "you're signed in as {email}. accept to change your role:",
    vars: { email: "the address they're logged in with" },
  },
  "confirm.accept": { label: "Accept: button", default: "accept invite" },
  "confirm.acceptUpgrade": {
    label: "Accept: button when the role changes",
    default: "accept and become a {role}",
    vars: { role: "the role they're invited to" },
  },
  "confirm.notNow": { label: "Accept: decline link", default: "not now" },

  "mismatch.heading": {
    label: "Wrong account: heading",
    default: "this invite is for a different account",
  },
  "mismatch.body": {
    label: "Wrong account: text",
    default:
      "it was sent to {invitedEmail}, but you're signed in as {currentEmail}. log out and open the link again to accept it.",
    vars: {
      invitedEmail: "the invited address",
      currentEmail: "the address they're logged in with",
    },
    kind: "paragraph",
  },
  "mismatch.retry": {
    label: "Wrong account: button",
    default: "log out & retry",
  },
  "mismatch.stay": {
    label: "Wrong account: stay link",
    default: "stay signed in",
  },

  "signup.eyebrow": {
    label: "New account: side panel small heading",
    default: "you've been invited",
  },
  "signup.heading": {
    label: "New account: side panel heading",
    default: "join moku pona as a {role}",
    vars: { role: "the role they're invited to, highlighted" },
  },
  "signup.bodyModerator": {
    label: "New account: side panel text (moderator)",
    default:
      "{inviter} invited you to help run our events. set a password to accept. your invite is tied to the email below.",
    vars: { inviter: "the name of whoever sent the invite" },
    kind: "paragraph",
  },
  "signup.bodyUser": {
    label: "New account: side panel text (user)",
    default:
      "{inviter} invited you to join our events. set a password to accept. your invite is tied to the email below.",
    vars: { inviter: "the name of whoever sent the invite" },
    kind: "paragraph",
  },
  "signup.emailHint": {
    label: "New account: email hint",
    default: "this invite is tied to this address.",
  },
  "signup.namePlaceholder": {
    label: "New account: name example",
    default: "e.g. nadia fischer",
  },
  "signup.submit": {
    label: "New account: button",
    default: "accept & create account",
  },
  "signup.googleNote": {
    label: "New account: Google note",
    default: "google must return {email} to accept.",
    vars: { email: "the invited address" },
  },
  "signup.privacy": {
    label: "New account: privacy note",
    default: "by continuing you accept the <link>privacy policy</link>.",
    tags: { link: "link to the privacy policy" },
  },
  "signup.accountExists": {
    label: "New account: address already has an account",
    default:
      "an account already exists for this address. log in, then open the link again to accept it.",
  },
});
