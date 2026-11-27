// The admin forms' note under a field that takes Markdown
// (app/shared/markdown.server.ts): event texts, signup messages, bios.
export const MARKDOWN_HINT =
  "Markdown works here: [link text](https://…), **bold**, *italic*, and lines starting with - for a list.";

// The same note under a mail message's editor, which also takes pictures
// (app/features/mail/admin-image-paste.tsx).
export const MAIL_IMAGE_HINT =
  "Paste or drop an image to put it in the email, on a line of its own.";

export const MAIL_MARKDOWN_HINT = `${MARKDOWN_HINT} ${MAIL_IMAGE_HINT}`;
