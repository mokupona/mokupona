-- An event's own payment reminder, written and sent from its signup sheet.
-- null falls back to the site-wide copy under Emails in the site texts.
ALTER TABLE "Event" ADD COLUMN "paymentReminderMailSubject" TEXT;
ALTER TABLE "Event" ADD COLUMN "paymentReminderMailMessage" TEXT;
