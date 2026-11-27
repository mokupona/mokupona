// What the mail editors' image paste (admin-image-paste.tsx) and the upload
// route (app/routes/admin.mail-images.ts) agree on.

export const MAIL_IMAGE_UPLOAD_PATH = "/admin/mail-images";
export const MAIL_IMAGE_FIELD = "image";

export type MailImageReply =
  { ok: true; url: string } | { ok: false; error: string };
