-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "Submission" (
    "id" TEXT NOT NULL,
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
    "latitude" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "longitude" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "accuracy" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "caretakerName" TEXT NOT NULL DEFAULT '',
    "caretakerMobile" TEXT NOT NULL DEFAULT '',
    "saaoId" TEXT,
    "saaoName" TEXT NOT NULL DEFAULT '',
    "saaoMobile" TEXT NOT NULL DEFAULT '',
    "monitoringOfficerId" TEXT,
    "monitoringOfficerName" TEXT NOT NULL DEFAULT '',
    "monitoringOfficerMobile" TEXT NOT NULL DEFAULT '',
    "remarks" TEXT,
    "areaSqMeters" DOUBLE PRECISION,
    "spacingFlag" BOOLEAN NOT NULL DEFAULT false,
    "nurserySourceId" TEXT,
    "nurserySourceName" TEXT,
    "nurserySourceLatitude" DOUBLE PRECISION,
    "nurserySourceLongitude" DOUBLE PRECISION,
    "trackingMethod" TEXT NOT NULL DEFAULT 'census',
    "treeSerial" TEXT,
    "vm0047HealthStatus" TEXT NOT NULL DEFAULT 'healthy',
    "geoPolygon" TEXT,
    "modellingUnitId" TEXT,
    "sdgIncomeChange" TEXT,
    "sdgSoilHealth" TEXT,
    "biodiversityNote" TEXT,
    "synced" BOOLEAN NOT NULL DEFAULT true,
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Submission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Seedling" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "plantTypeId" TEXT,
    "speciesId" TEXT,
    "speciesName" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "carbonFactor" DOUBLE PRECISION,

    CONSTRAINT "Seedling_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Photo" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "stage" TEXT NOT NULL DEFAULT 'planting',
    "url" TEXT NOT NULL,
    "sha256" TEXT NOT NULL DEFAULT '',
    "capturedAt" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "longitude" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "distanceFromOriginMeters" DOUBLE PRECISION,
    "photoType" TEXT,

    CONSTRAINT "Photo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Monitoring" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "stage" TEXT NOT NULL DEFAULT 'month_6',
    "monitoredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "avgHeightM" DOUBLE PRECISION,
    "avgDbhCm" DOUBLE PRECISION,
    "avgCanopyRadiusM" DOUBLE PRECISION,
    "vm0047HealthStatus" TEXT NOT NULL DEFAULT 'healthy',
    "survivalCount" INTEGER,
    "deadCount" INTEGER,
    "latitude" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "longitude" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "accuracy" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "sdgIncomeChange" TEXT,
    "sdgSoilHealth" TEXT,
    "biodiversityNote" TEXT,
    "remarks" TEXT,

    CONSTRAINT "Monitoring_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserProfile" (
    "id" TEXT NOT NULL,
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
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SeedSync" (
    "id" TEXT NOT NULL,
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recordCount" INTEGER NOT NULL,
    "sourceFileName" TEXT NOT NULL DEFAULT 'Tree_Plantation_Reporting_Workbook.xlsx',
    "sourceFileHash" TEXT NOT NULL DEFAULT '',
    "syncedByEmail" TEXT,
    "notes" TEXT,

    CONSTRAINT "SeedSync_pkey" PRIMARY KEY ("id")
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
CREATE INDEX "Submission_vm0047HealthStatus_idx" ON "Submission"("vm0047HealthStatus");

-- CreateIndex
CREATE INDEX "Submission_trackingMethod_idx" ON "Submission"("trackingMethod");

-- CreateIndex
CREATE INDEX "Submission_modellingUnitId_idx" ON "Submission"("modellingUnitId");

-- CreateIndex
CREATE INDEX "Seedling_submissionId_idx" ON "Seedling"("submissionId");

-- CreateIndex
CREATE INDEX "Seedling_speciesName_idx" ON "Seedling"("speciesName");

-- CreateIndex
CREATE INDEX "Photo_submissionId_idx" ON "Photo"("submissionId");

-- CreateIndex
CREATE INDEX "Photo_stage_idx" ON "Photo"("stage");

-- CreateIndex
CREATE INDEX "Photo_photoType_idx" ON "Photo"("photoType");

-- CreateIndex
CREATE INDEX "Monitoring_submissionId_idx" ON "Monitoring"("submissionId");

-- CreateIndex
CREATE INDEX "Monitoring_stage_idx" ON "Monitoring"("stage");

-- CreateIndex
CREATE INDEX "Monitoring_vm0047HealthStatus_idx" ON "Monitoring"("vm0047HealthStatus");

-- CreateIndex
CREATE UNIQUE INDEX "UserProfile_email_key" ON "UserProfile"("email");

-- CreateIndex
CREATE INDEX "UserProfile_role_idx" ON "UserProfile"("role");

-- CreateIndex
CREATE INDEX "UserProfile_district_idx" ON "UserProfile"("district");

-- CreateIndex
CREATE INDEX "UserProfile_upazila_idx" ON "UserProfile"("upazila");

-- CreateIndex
CREATE INDEX "SeedSync_syncedAt_idx" ON "SeedSync"("syncedAt");

-- AddForeignKey
ALTER TABLE "Seedling" ADD CONSTRAINT "Seedling_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "Submission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Photo" ADD CONSTRAINT "Photo_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "Submission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Monitoring" ADD CONSTRAINT "Monitoring_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "Submission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

