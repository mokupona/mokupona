-- CreateTable
CREATE TABLE "Volunteer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "role" TEXT,
    "bio" TEXT,
    "imageId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Volunteer_imageId_fkey" FOREIGN KEY ("imageId") REFERENCES "Image" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "_EventToVolunteer" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,
    CONSTRAINT "_EventToVolunteer_A_fkey" FOREIGN KEY ("A") REFERENCES "Event" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "_EventToVolunteer_B_fkey" FOREIGN KEY ("B") REFERENCES "Volunteer" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Volunteer_imageId_key" ON "Volunteer"("imageId");

-- CreateIndex
CREATE UNIQUE INDEX "_EventToVolunteer_AB_unique" ON "_EventToVolunteer"("A", "B");

-- CreateIndex
CREATE INDEX "_EventToVolunteer_B_index" ON "_EventToVolunteer"("B");
