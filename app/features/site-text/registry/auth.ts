import { defineTexts } from "../types";

const PRIVACY_LINK = { link: "link to the privacy policy" };

export const authTexts = defineTexts("auth", {
  "shell.eyebrow": {
    label: "Side panel: small heading",
    default: "members",
    hint: "The panel beside the log in and sign up forms.",
  },
  "shell.heading": {
    label: "Side panel: heading",
    default: "welcome back to the table",
  },
  "shell.body": {
    label: "Side panel: text",
    default:
      "sign in to manage your reservations, or create an account to start joining our events.",
    kind: "paragraph",
  },
  "toggle.login": { label: "Switch: log in", default: "log in" },
  "toggle.join": { label: "Switch: sign up", default: "sign up" },

  "field.name": { label: "Field: name", default: "name" },
  "field.email": { label: "Field: email", default: "email address" },
  "field.emailPlaceholder": {
    label: "Field: email example",
    default: "you@example.com",
  },
  "field.password": { label: "Field: password", default: "password" },
  "field.newPassword": {
    label: "Field: new password",
    default: "new password",
    hint: "On the password reset page and the account page.",
  },
  "field.confirmNewPassword": {
    label: "Field: confirm new password",
    default: "confirm new password",
  },
  backToLogin: { label: "Back to log in", default: "back to log in" },
  continueToLogin: {
    label: "Continue to log in",
    default: "continue to log in",
  },

  "login.metaTitle": { label: "Log in: browser tab title", default: "Login" },
  "login.title": { label: "Log in: heading", default: "log in" },
  "login.rejected": {
    label: "Log in: wrong email or password",
    default:
      "we couldn't sign you in. check your email and password, then try again.",
  },
  "login.googleOffTitle": {
    label: "Log in: Google switched off, title",
    default: "google sign-in is turned off",
  },
  "login.googleOffBody": {
    label: "Log in: Google switched off, text",
    default:
      "google sign-in is switched off right now. use your email address and password instead — if you only ever signed in with google, use forgot password to set one.",
    kind: "paragraph",
  },
  "login.unverifiedTitle": {
    label: "Log in: email not verified, title",
    default: "your email isn't verified yet",
  },
  "login.unverifiedBody": {
    label: "Log in: email not verified, text",
    default:
      "we just sent a fresh verification link to {email}. open it, then come back and log in.",
    vars: { email: "the address they logged in with" },
  },
  "login.unverifiedHint": {
    label: "Log in: email not verified, hint",
    default: "didn't get it? give it a minute, then check your spam folder.",
  },
  "login.forgot": {
    label: "Log in: forgot password link",
    default: "forgot password?",
  },
  "login.remember": { label: "Log in: remember me", default: "remember me" },
  "login.submit": { label: "Log in: button", default: "log in" },
  "login.privacy": {
    label: "Log in: privacy note",
    default: "by continuing you accept the <link>privacy policy</link>",
    tags: PRIVACY_LINK,
  },
  "login.noAccount": {
    label: "Log in: link to sign up",
    default: "don't have an account? <link>sign up</link>",
    tags: { link: "link to the sign up page" },
  },

  "join.metaTitle": { label: "Sign up: browser tab title", default: "Sign Up" },
  "join.title": { label: "Sign up: heading", default: "sign up" },
  "join.closed": {
    label: "Sign up: sign-ups closed",
    default:
      "sign-ups are closed right now. if you were invited, use the link in your invitation email.",
    kind: "paragraph",
    hint: "When an admin has switched off email sign-ups and Google.",
  },
  "join.emailClosed": {
    label: "Sign up: email sign-ups closed",
    default:
      "email sign-ups are closed right now. you can still continue with google below.",
    kind: "paragraph",
  },
  "join.namePlaceholder": {
    label: "Sign up: name example",
    default: "e.g. lena huber",
  },
  "join.confirmPassword": {
    label: "Sign up: confirm password field",
    default: "confirm password",
  },
  "join.privacy": {
    label: "Sign up: privacy note",
    default:
      "by creating an account you accept the <link>privacy policy</link>",
    tags: PRIVACY_LINK,
  },
  "join.submit": { label: "Sign up: button", default: "create account" },
  "join.haveAccount": {
    label: "Sign up: link to log in",
    default: "already have an account? <link>log in</link>",
    tags: { link: "link to the log in page" },
  },
  "join.accountExists": {
    label: "Sign up: email already taken",
    default:
      "an account already exists with this email. try logging in instead.",
  },

  "forgot.metaTitle": {
    label: "Forgot password: browser tab title",
    default: "Forgot password",
  },
  "forgot.eyebrow": {
    label: "Forgot password: side panel small heading",
    default: "reset",
  },
  "forgot.panelHeading": {
    label: "Forgot password: side panel heading",
    default: "happens to everyone",
  },
  "forgot.panelBody": {
    label: "Forgot password: side panel text",
    default: "tell us your email and we'll send a link to set a new password.",
  },
  "forgot.title": {
    label: "Forgot password: heading",
    default: "forgot your password?",
  },
  "forgot.intro": {
    label: "Forgot password: intro",
    default: "enter the email you signed up with and we'll send a reset link.",
  },
  "forgot.submit": {
    label: "Forgot password: button",
    default: "send reset link",
  },
  "forgot.remembered": {
    label: "Forgot password: link back",
    default: "remembered it? <link>back to log in</link>",
    tags: { link: "link to the log in page" },
  },
  "forgot.sentHeading": {
    label: "Reset link sent: heading",
    default: "check your inbox",
  },
  "forgot.sentBody": {
    label: "Reset link sent: text",
    default:
      "if an account exists for {email}, we've sent a link to reset your password.",
    vars: { email: "the address they typed" },
  },

  "reset.metaTitle": {
    label: "Reset password: browser tab title",
    default: "Reset password",
  },
  "reset.doneHeading": {
    label: "Password changed: heading",
    default: "password updated",
  },
  "reset.doneBody": {
    label: "Password changed: text",
    default:
      "your new password is saved and your email is confirmed. log in to pick up where you left off.",
    kind: "paragraph",
  },
  "reset.invalidHeading": {
    label: "Reset link expired: heading",
    default: "this reset link has expired",
  },
  "reset.invalidBody": {
    label: "Reset link expired: text",
    default: "request a fresh one and we'll email it right over.",
  },
  "reset.invalidCta": {
    label: "Reset link expired: button",
    default: "request a new link",
  },
  "reset.eyebrow": {
    label: "Reset password: side panel small heading",
    default: "reset",
  },
  "reset.panelHeading": {
    label: "Reset password: side panel heading",
    default: "pick something new",
  },
  "reset.panelBody": {
    label: "Reset password: side panel text",
    default:
      "pick a new password with at least 8 characters and you're back in.",
  },
  "reset.title": {
    label: "Reset password: heading",
    default: "choose a new password",
  },
  "reset.resettingFor": {
    label: "Reset password: whose password",
    default: "resetting for {email}",
    vars: { email: "the account's address" },
  },
  "reset.passwordHint": {
    label: "Reset password: length hint",
    default: "at least 8 characters.",
  },
  "reset.submit": {
    label: "Reset password: button",
    default: "save new password",
  },

  "verify.metaTitle": {
    label: "Email verified: browser tab title",
    default: "Verify email",
  },
  "verify.failedHeading": {
    label: "Verification link expired: heading",
    default: "this link has expired",
  },
  "verify.failedBody": {
    label: "Verification link expired: text",
    default: "just log in and we'll send a new link to verify your email.",
  },
  "verify.eyebrow": {
    label: "Email verified: side panel small heading",
    default: "you're in",
  },
  "verify.panelHeading": {
    label: "Email verified: side panel heading",
    default: "a seat at the table is yours",
  },
  "verify.panelBody": {
    label: "Email verified: side panel text",
    default:
      "your email is confirmed. log in to browse the next events and reserve your spot.",
  },
  "verify.heading": {
    label: "Email verified: heading",
    default: "your email is verified",
  },
  "verify.bodyWithEmail": {
    label: "Email verified: text",
    default: "thanks for confirming {email}. you're all set to sign in.",
    vars: { email: "the verified address" },
  },
  "verify.body": {
    label: "Email verified: text without an address",
    default: "you're all set to sign in.",
  },
  "verify.browse": {
    label: "Email verified: events link",
    default: "browse events instead",
  },

  "inbox.metaTitle": {
    label: "Check your inbox: browser tab title",
    default: "Check your inbox",
  },
  "inbox.eyebrow": {
    label: "Check your inbox: side panel small heading",
    default: "one more step",
  },
  "inbox.panelHeading": {
    label: "Check your inbox: side panel heading",
    default: "you're almost at the table",
  },
  "inbox.panelBody": {
    label: "Check your inbox: side panel text",
    default:
      "just confirm your email and your account is ready. we'll keep your seat warm.",
  },
  "inbox.heading": {
    label: "Check your inbox: heading",
    default: "check your inbox",
  },
  "inbox.body": {
    label: "Check your inbox: text",
    default:
      "we sent a verification link to {email}. open it to confirm your address, then log in.",
    vars: { email: "the address they signed up with" },
  },
  "inbox.hint": {
    label: "Check your inbox: hint",
    default: "no link yet? give it a minute, then check your spam folder.",
  },

  "validation.nameRequired": {
    label: "Missing name",
    default: "Name is required",
  },
  "validation.emailRequired": {
    label: "Missing or invalid email",
    default: "Email is required",
  },
  "validation.passwordRequired": {
    label: "Missing password",
    default: "Password is required",
  },
  "validation.passwordTooShort": {
    label: "Password too short",
    default: "password must be at least 8 characters.",
  },
  "validation.passwordTooLong": {
    label: "Password too long",
    default: "password must be at most 128 characters.",
  },
  "validation.confirmRequired": {
    label: "Missing password confirmation",
    default: "Please confirm your password",
  },
  "validation.passwordsMatch": {
    label: "Passwords differ",
    default: "passwords must match.",
  },
});
