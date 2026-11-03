export const AUTH_TOGGLES = ["emailSignup", "google"] as const;
export type AuthToggle = (typeof AUTH_TOGGLES)[number];

/** Which self-service auth paths are currently open. */
export type AuthSettings = Record<AuthToggle, boolean>;

export const AUTH_TOGGLE_COPY = {
  emailSignup: {
    label: "email sign-ups",
    description: "lets anyone create an account from the sign-up form.",
  },
  google: {
    label: "google sign-in",
    description:
      "lets anyone sign in, sign up, or link an account with google. turning it off refuses all three.",
  },
} satisfies Record<AuthToggle, { label: string; description: string }>;

/** The error code the OAuth callback redirects with once Google is off. */
export const GOOGLE_DISABLED_ERROR = "google_disabled";

// What visitors read while a toggle is off lives with the other site texts:
// auth.join.closed, auth.join.emailClosed and auth.login.googleOffBody.
