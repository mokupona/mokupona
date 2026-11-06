-- CreateTable
CREATE TABLE "SignupGuest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "guestIndex" INTEGER NOT NULL,
    "arrivedAt" DATETIME,
    "donationRappen" INTEGER,
    "donationMethod" TEXT NOT NULL DEFAULT 'twint',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "submissionId" TEXT NOT NULL,
    CONSTRAINT "SignupGuest_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "FormSubmission" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Event" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "menuDescription" TEXT,
    "donationDescription" TEXT,
    "date" DATETIME NOT NULL,
    "slots" INTEGER NOT NULL,
    "published" BOOLEAN NOT NULL DEFAULT true,
    "price" INTEGER NOT NULL,
    "studentDiscount" INTEGER,
    "vegetarianDiscount" INTEGER,
    "discounts" TEXT,
    "confirmedMailSubject" TEXT,
    "confirmedMailMessage" TEXT,
    "waitlistMailSubject" TEXT,
    "waitlistMailMessage" TEXT,
    "twintFeePercent" REAL NOT NULL DEFAULT 1.5,
    "twintFeeFixedRappen" INTEGER NOT NULL DEFAULT 30,
    "imageId" TEXT,
    "addressId" TEXT NOT NULL,
    "createdById" TEXT,
    "formId" TEXT NOT NULL,
    CONSTRAINT "Event_imageId_fkey" FOREIGN KEY ("imageId") REFERENCES "Image" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Event_addressId_fkey" FOREIGN KEY ("addressId") REFERENCES "Address" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Event_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Event_formId_fkey" FOREIGN KEY ("formId") REFERENCES "Form" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Event" ("addressId", "confirmedMailMessage", "confirmedMailSubject", "createdById", "date", "description", "discounts", "donationDescription", "formId", "id", "imageId", "menuDescription", "price", "published", "slots", "studentDiscount", "title", "vegetarianDiscount", "waitlistMailMessage", "waitlistMailSubject") SELECT "addressId", "confirmedMailMessage", "confirmedMailSubject", "createdById", "date", "description", "discounts", "donationDescription", "formId", "id", "imageId", "menuDescription", "price", "published", "slots", "studentDiscount", "title", "vegetarianDiscount", "waitlistMailMessage", "waitlistMailSubject" FROM "Event";
DROP TABLE "Event";
ALTER TABLE "new_Event" RENAME TO "Event";
CREATE UNIQUE INDEX "Event_imageId_key" ON "Event"("imageId");
CREATE UNIQUE INDEX "Event_formId_key" ON "Event"("formId");
CREATE TABLE "new_FormSubmission" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "answers" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'confirmed',
    "seats" INTEGER NOT NULL DEFAULT 1,
    "email" TEXT NOT NULL DEFAULT '',
    "firstHalfPaid" BOOLEAN NOT NULL DEFAULT false,
    "secondHalfPaid" BOOLEAN NOT NULL DEFAULT false,
    "firstHalfMethod" TEXT NOT NULL DEFAULT 'twint',
    "secondHalfMethod" TEXT NOT NULL DEFAULT 'twint',
    "confirmationMarkedSent" BOOLEAN,
    "paymentReminderSent" BOOLEAN NOT NULL DEFAULT false,
    "adminNote" TEXT NOT NULL DEFAULT '',
    "mailsTracked" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "formVersionId" TEXT NOT NULL,
    CONSTRAINT "FormSubmission_formVersionId_fkey" FOREIGN KEY ("formVersionId") REFERENCES "FormVersion" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_FormSubmission" ("adminNote", "answers", "createdAt", "email", "firstHalfPaid", "formVersionId", "id", "mailsTracked", "seats", "secondHalfPaid", "status") SELECT "adminNote", "answers", "createdAt", "email", "firstHalfPaid", "formVersionId", "id", "mailsTracked", "seats", "secondHalfPaid", "status" FROM "FormSubmission";
DROP TABLE "FormSubmission";
ALTER TABLE "new_FormSubmission" RENAME TO "FormSubmission";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "SignupGuest_submissionId_guestIndex_key" ON "SignupGuest"("submissionId", "guestIndex");
