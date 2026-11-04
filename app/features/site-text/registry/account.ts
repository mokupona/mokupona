import { defineTexts } from "../types";

export const accountTexts = defineTexts("account", {
  metaTitle: { label: "Browser tab title", default: "your account" },
  eyebrow: { label: "Small heading above the title", default: "account" },
  title: { label: "Page title", default: "your account" },

  "profile.save": { label: "Name: save button", default: "save" },
  "profile.saved": { label: "Name: saved pop-up", default: "name updated" },
  "profile.emailLabel": { label: "Email label", default: "email" },
  "profile.verified": { label: "Email verified badge", default: "verified" },
  "profile.emailHint": {
    label: "Email hint",
    default: "your email is your login and can't be changed here.",
  },

  "password.title": { label: "Password: heading", default: "password" },
  "password.subtitle": {
    label: "Password: text",
    default: "change the password you use to sign in.",
  },
  "password.titleSet": {
    label: "Set a password: heading",
    default: "set a password",
    hint: "For people who signed up with Google and have no password yet.",
  },
  "password.subtitleSet": {
    label: "Set a password: text",
    default:
      "you signed up with google. add a password to sign in either way — no current password needed.",
    kind: "paragraph",
  },
  "password.current": {
    label: "Password: current password field",
    default: "current password",
  },
  "password.submit": {
    label: "Password: button",
    default: "update password",
  },
  "password.submitSet": {
    label: "Set a password: button",
    default: "set password",
  },
  "password.saved": {
    label: "Password: saved pop-up",
    default: "password updated",
  },
  "password.savedSet": {
    label: "Set a password: saved pop-up",
    default: "password set",
  },
  "password.currentRequired": {
    label: "Password: current password missing",
    default: "Current password is required",
  },
  "password.wrongCurrent": {
    label: "Password: current password wrong",
    default: "that doesn't match your current password.",
  },
  "password.alreadySet": {
    label: "Set a password: one was set meanwhile",
    default: "a password is already set. reload the page to change it.",
  },

  "connected.title": {
    label: "Connected accounts: heading",
    default: "connected accounts",
  },
  "connected.subtitle": {
    label: "Connected accounts: text",
    default: "sign in faster by linking a provider.",
  },
  "connected.google": {
    label: "Connected accounts: Google",
    default: "google",
  },
  "connected.linkedAs": {
    label: "Connected accounts: linked",
    default: "linked as {email}",
    vars: { email: "the account's address" },
  },
  "connected.notLinked": {
    label: "Connected accounts: not linked",
    default: "not linked",
  },
  "connected.link": {
    label: "Connected accounts: link button",
    default: "link",
  },
  "connected.unlink": {
    label: "Connected accounts: unlink button",
    default: "unlink",
  },
  "connected.unlinked": {
    label: "Connected accounts: unlinked pop-up",
    default: "google unlinked",
  },
  "connected.unlinkBlocked": {
    label: "Connected accounts: can't unlink yet",
    default:
      "google is your only way to sign in right now. set a password first, then you can unlink.",
    kind: "paragraph",
  },

  "sessions.title": { label: "Sessions: heading", default: "sessions" },
  "sessions.body": {
    label: "Sessions: text",
    default: "you're signed in on {devices}, including this one.",
    vars: { devices: "the device count below, in bold" },
  },
  "sessions.devices.one": {
    label: "Sessions: one device",
    default: "1 device",
  },
  "sessions.devices.other": {
    label: "Sessions: several devices",
    default: "{count} devices",
    vars: { count: "the number of devices" },
  },
  "sessions.signOutOthers": {
    label: "Sessions: button",
    default: "sign out other sessions",
  },
  "sessions.signedOut": {
    label: "Sessions: signed out pop-up",
    default: "signed out everywhere else",
  },
});
