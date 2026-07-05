-- CreateTable
CREATE TABLE "Submission" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clientUid" TEXT NOT NULL,
    "entryMode" TEXT NOT NULL DEFAULT 'dae_officer',
    "region" TEXT NOT NULL DEFAULT '',
    "district" TEXT NOT NULL DEFAULT '',
    "upazila" TEXT NOT NULL DEFAULT '',
    "union" TEXT NOT NULL DEFAULT '',
    "blockId" TEXT,
    "blockName" TEXT,
    "village" TEXT NOT NULL DEFAULT '',
    "plantationDate" TEXT NOT NULL,
    "latitude" REAL NOT NULL DEFAULT 0,
    "longitude" REAL NOT NULL DEFAULT 0,
    "accuracy" REAL NOT NULL DEFAULT 0,
    "caretakerName" TEXT NOT NULL DEFAULT '',
    "caretakerMobile" TEXT NOT NULL DEFAULT '',
    "saaoId" TEXT,
    "saaoName" TEXT NOT NULL DEFAULT '',
    "saaoMobile" TEXT NOT NULL DEFAULT '',
    "monitoringOfficerId" TEXT,
    "monitoringOfficerName" TEXT NOT NULL DEFAULT '',
    "monitoringOfficerMobile" TEXT NOT NULL DEFAULT '',
    "remarks" TEXT,
    "areaSqMeters" REAL,
    "spacingFlag" BOOLEAN NOT NULL DEFAULT false,
    "nurserySourceId" TEXT,
    "nurserySourceName" TEXT,
    "nurserySourceLatitude" REAL,
    "nurserySourceLongitude" REAL,
    "synced" BOOLEAN NOT NULL DEFAULT true,
    "syncedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Seedling" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "submissionId" TEXT NOT NULL,
    "plantTypeId" TEXT,
    "speciesId" TEXT,
    "speciesName" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "Seedling_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "Submission" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Photo" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "submissionId" TEXT NOT NULL,
    "stage" TEXT NOT NULL DEFAULT 'planting',
    "url" TEXT NOT NULL,
    "sha256" TEXT NOT NULL DEFAULT '',
    "capturedAt" TEXT NOT NULL,
    "latitude" REAL NOT NULL DEFAULT 0,
    "longitude" REAL NOT NULL DEFAULT 0,
    "distanceFromOriginMeters" REAL,
    CONSTRAINT "Photo_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "Submission" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Submission_clientUid_key" ON "Submission"("clientUid");

-- CreateIndex
CREATE INDEX "Submission_district_idx" ON "Submission"("district");

-- CreateIndex
CREATE INDEX "Submission_upazila_idx" ON "Submission"("upazila");

-- CreateIndex
CREATE INDEX "Submission_synced_idx" ON "Submission"("synced");

-- CreateIndex
CREATE INDEX "Submission_createdAt_idx" ON "Submission"("createdAt");

-- CreateIndex
CREATE INDEX "Submission_plantationDate_idx" ON "Submission"("plantationDate");

-- CreateIndex
CREATE INDEX "Seedling_submissionId_idx" ON "Seedling"("submissionId");

-- CreateIndex
CREATE INDEX "Seedling_speciesName_idx" ON "Seedling"("speciesName");

-- CreateIndex
CREATE INDEX "Photo_submissionId_idx" ON "Photo"("submissionId");

-- CreateIndex
CREATE INDEX "Photo_stage_idx" ON "Photo"("stage");
