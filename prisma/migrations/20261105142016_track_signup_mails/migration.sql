-- CreateTable
CREATE TABLE "SignupMail" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "kind" TEXT NOT NULL,
    "recipient" TEXT NOT NULL,
    "subject" TEXT NOT NULL DEFAULT '',
    "message" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submissionId" TEXT NOT NULL,
    "sentById" TEXT,
    CONSTRAINT "SignupMail_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "FormSubmission" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SignupMail_sentById_fkey" FOREIGN KEY ("sentById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_FormSubmission" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "answers" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'confirmed',
    "seats" INTEGER NOT NULL DEFAULT 1,
    "email" TEXT NOT NULL DEFAULT '',
    "firstHalfPaid" BOOLEAN NOT NULL DEFAULT false,
    "secondHalfPaid" BOOLEAN NOT NULL DEFAULT false,
    "adminNote" TEXT NOT NULL DEFAULT '',
    "mailsTracked" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "formVersionId" TEXT NOT NULL,
    CONSTRAINT "FormSubmission_formVersionId_fkey" FOREIGN KEY ("formVersionId") REFERENCES "FormVersion" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
-- nobody kept track of the mails sent for the signups already here, so they
-- start untracked: having no record of a mail doesn't mean none went out
INSERT INTO "new_FormSubmission" ("adminNote", "answers", "createdAt", "email", "firstHalfPaid", "formVersionId", "id", "mailsTracked", "seats", "secondHalfPaid", "status") SELECT "adminNote", "answers", "createdAt", "email", "firstHalfPaid", "formVersionId", "id", false, "seats", "secondHalfPaid", "status" FROM "FormSubmission";
DROP TABLE "FormSubmission";
ALTER TABLE "new_FormSubmission" RENAME TO "FormSubmission";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "SignupMail_submissionId_idx" ON "SignupMail"("submissionId");
