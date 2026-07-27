-- ─── UserProfile: Admin / Cadre / Monitoring Officer / SAAO / Citizen accounts ─
-- Idempotent upsert by `email` (unique). The allow-list lives in
-- seed/admins.json so it can be updated without a migration.

CREATE TABLE "UserProfile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "mobile" TEXT NOT NULL DEFAULT '',
    "role" TEXT NOT NULL DEFAULT 'citizen',
    "nid" TEXT,
    "jobId" TEXT,
    "designation" TEXT,
    "district" TEXT,
    "upazila" TEXT,
    "blockId" TEXT,
    "photoUrl" TEXT,
    "xp" INTEGER NOT NULL DEFAULT 0,
    "greenTokens" INTEGER NOT NULL DEFAULT 0,
    "streakCount" INTEGER NOT NULL DEFAULT 0,
    "profileCompletionBonus" BOOLEAN NOT NULL DEFAULT false,
    "bootstrapSource" TEXT,
    "invitedBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "UserProfile_email_key" ON "UserProfile"("email");

-- CreateIndex
CREATE INDEX "UserProfile_role_idx" ON "UserProfile"("role");

-- CreateIndex
CREATE INDEX "UserProfile_district_idx" ON "UserProfile"("district");

-- CreateIndex
CREATE INDEX "UserProfile_upazila_idx" ON "UserProfile"("upazila");

-- ─── SeedSync: tracks each bulk-upsert of workbook data into Submission ──────

CREATE TABLE "SeedSync" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "syncedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recordCount" INTEGER NOT NULL,
    "sourceFileName" TEXT NOT NULL DEFAULT 'Tree_Plantation_Reporting_Workbook.xlsx',
    "sourceFileHash" TEXT NOT NULL DEFAULT '',
    "syncedByEmail" TEXT,
    "notes" TEXT
);

-- CreateIndex
CREATE INDEX "SeedSync_syncedAt_idx" ON "SeedSync"("syncedAt");
