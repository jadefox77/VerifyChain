/*
  Warnings:

  - You are about to drop the column `quantity` on the `Batch` table. All the data in the column will be lost.
  - You are about to drop the column `firstPhoneHash` on the `Bottle` table. All the data in the column will be lost.
  - You are about to drop the column `firstScannedAt` on the `Bottle` table. All the data in the column will be lost.
  - You are about to drop the column `firstScannedLat` on the `Bottle` table. All the data in the column will be lost.
  - You are about to drop the column `firstScannedLng` on the `Bottle` table. All the data in the column will be lost.
  - You are about to drop the column `firstOpenedAt` on the `Cap` table. All the data in the column will be lost.
  - You are about to drop the column `firstOpenedLat` on the `Cap` table. All the data in the column will be lost.
  - You are about to drop the column `firstOpenedLng` on the `Cap` table. All the data in the column will be lost.
  - You are about to drop the column `firstPhoneHash` on the `Cap` table. All the data in the column will be lost.
  - You are about to drop the column `contactEmail` on the `Manufacturer` table. All the data in the column will be lost.
  - You are about to drop the column `logoUrl` on the `Manufacturer` table. All the data in the column will be lost.
  - You are about to drop the column `city` on the `ScanLog` table. All the data in the column will be lost.
  - You are about to drop the column `createdAt` on the `ScanLog` table. All the data in the column will be lost.
  - You are about to drop the column `phoneHash` on the `ScanLog` table. All the data in the column will be lost.
  - You are about to drop the column `scanCount` on the `ScanLog` table. All the data in the column will be lost.
  - You are about to drop the column `password` on the `User` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[batchCode]` on the table `Batch` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[rcNumber]` on the table `Manufacturer` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[token]` on the table `VerificationToken` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `batchCode` to the `Batch` table without a default value. This is not possible if the table is not empty.
  - Added the required column `bottleCount` to the `Batch` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `Batch` table without a default value. This is not possible if the table is not empty.
  - Added the required column `hmacSig` to the `Bottle` table without a default value. This is not possible if the table is not empty.
  - Added the required column `manufacturerId` to the `Bottle` table without a default value. This is not possible if the table is not empty.
  - Added the required column `hiddenHmacSig` to the `Cap` table without a default value. This is not possible if the table is not empty.
  - Added the required column `manufacturerId` to the `ScanLog` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('SUPER_ADMIN', 'MANUFACTURER_ADMIN', 'FACTORY_OPERATOR', 'FRAUD_ANALYST', 'REGULATORY_OBSERVER', 'DISTRIBUTOR_MANAGER', 'SUPPORT');

-- CreateEnum
CREATE TYPE "OnboardingStatus" AS ENUM ('PENDING_REVIEW', 'COMPLIANCE_VERIFICATION', 'TECHNICAL_INTEGRATION', 'PILOT_APPROVAL', 'ACTIVE_PRODUCTION', 'REJECTED', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "SubscriptionPlan" AS ENUM ('FREE', 'STARTER', 'PROFESSIONAL', 'ENTERPRISE');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('ACTIVE', 'PAST_DUE', 'SUSPENDED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AlertSeverity" AS ENUM ('SAFE', 'SUSPICIOUS', 'HIGH_CONCERN', 'CRITICAL');

-- CreateEnum
CREATE TYPE "AlertType" AS ENUM ('INVALID_PAIRING', 'MASS_CLONING', 'GEOGRAPHIC_TELEPORTATION', 'SUPPLY_CHAIN_DRIFT', 'REPEAT_SCAN_ABUSE', 'BOT_ACTIVITY', 'REFILL_DETECTED', 'PRODUCTION_PAIRING_FAIL', 'SUSPICIOUS_RETAIL_CLUSTER', 'IDENTITY_EXHAUSTION');

-- DropForeignKey
ALTER TABLE "Batch" DROP CONSTRAINT "Batch_productId_fkey";

-- DropForeignKey
ALTER TABLE "Bottle" DROP CONSTRAINT "Bottle_batchId_fkey";

-- DropForeignKey
ALTER TABLE "ScanLog" DROP CONSTRAINT "ScanLog_bottleId_fkey";

-- DropForeignKey
ALTER TABLE "ScanLog" DROP CONSTRAINT "ScanLog_capId_fkey";

-- AlterTable
ALTER TABLE "Batch" DROP COLUMN "quantity",
ADD COLUMN     "batchCode" TEXT NOT NULL,
ADD COLUMN     "bottleCount" INTEGER NOT NULL,
ADD COLUMN     "expiryDate" TIMESTAMP(3),
ADD COLUMN     "productionDate" TIMESTAMP(3),
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ALTER COLUMN "productId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Bottle" DROP COLUMN "firstPhoneHash",
DROP COLUMN "firstScannedAt",
DROP COLUMN "firstScannedLat",
DROP COLUMN "firstScannedLng",
ADD COLUMN     "hmacSig" TEXT NOT NULL,
ADD COLUMN     "lastScannedAt" TIMESTAMP(3),
ADD COLUMN     "manufacturerId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Cap" DROP COLUMN "firstOpenedAt",
DROP COLUMN "firstOpenedLat",
DROP COLUMN "firstOpenedLng",
DROP COLUMN "firstPhoneHash",
ADD COLUMN     "hiddenHmacSig" TEXT NOT NULL,
ADD COLUMN     "openedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Manufacturer" DROP COLUMN "contactEmail",
DROP COLUMN "logoUrl",
ADD COLUMN     "bottlingLineType" TEXT,
ADD COLUMN     "brandPortfolio" TEXT,
ADD COLUMN     "capSupplier" TEXT,
ADD COLUMN     "complianceOfficer" TEXT,
ADD COLUMN     "distributionRegions" TEXT,
ADD COLUMN     "erpSystem" TEXT,
ADD COLUMN     "estimatedBottlesPerMonth" INTEGER,
ADD COLUMN     "factoryLocations" TEXT,
ADD COLUMN     "fraudRateCached" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "industryType" TEXT,
ADD COLUMN     "nafdacNumbers" TEXT,
ADD COLUMN     "onboardingStatus" "OnboardingStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
ADD COLUMN     "packagingType" TEXT,
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "primaryContact" TEXT,
ADD COLUMN     "productionCapacity" INTEGER,
ADD COLUMN     "rcNumber" TEXT,
ADD COLUMN     "subscriptionPlan" "SubscriptionPlan" NOT NULL DEFAULT 'FREE',
ADD COLUMN     "subscriptionStatus" "SubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN     "taxId" TEXT,
ADD COLUMN     "technicalContact" TEXT,
ADD COLUMN     "totalBottlesGenerated" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "totalFraudFlags" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "totalScans" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "active" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "sku" TEXT,
ADD COLUMN     "volumeMl" INTEGER,
ALTER COLUMN "category" DROP NOT NULL;

-- AlterTable
ALTER TABLE "ScanLog" DROP COLUMN "city",
DROP COLUMN "createdAt",
DROP COLUMN "phoneHash",
DROP COLUMN "scanCount",
ADD COLUMN     "batchId" TEXT,
ADD COLUMN     "channel" TEXT,
ADD COLUMN     "fraudScore" DOUBLE PRECISION,
ADD COLUMN     "manufacturerId" TEXT NOT NULL,
ADD COLUMN     "region" TEXT,
ADD COLUMN     "scannedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "userAgent" TEXT;

-- AlterTable
ALTER TABLE "User" DROP COLUMN "password",
ADD COLUMN     "role" "UserRole" NOT NULL DEFAULT 'MANUFACTURER_ADMIN';

-- CreateTable
CREATE TABLE "AlertLog" (
    "id" TEXT NOT NULL,
    "manufacturerId" TEXT,
    "type" "AlertType" NOT NULL,
    "severity" "AlertSeverity" NOT NULL,
    "message" TEXT NOT NULL,
    "detail" TEXT,
    "batchId" TEXT,
    "affectedCount" INTEGER,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "region" TEXT,
    "confidenceScore" DOUBLE PRECISION,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "resolvedAt" TIMESTAMP(3),
    "resolvedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AlertLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminNote" (
    "id" TEXT NOT NULL,
    "manufacturerId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "authorName" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "isInternal" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "targetType" TEXT,
    "targetId" TEXT,
    "before" TEXT,
    "after" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AlertLog_severity_idx" ON "AlertLog"("severity");

-- CreateIndex
CREATE INDEX "AlertLog_type_idx" ON "AlertLog"("type");

-- CreateIndex
CREATE INDEX "AlertLog_manufacturerId_idx" ON "AlertLog"("manufacturerId");

-- CreateIndex
CREATE INDEX "AlertLog_resolved_idx" ON "AlertLog"("resolved");

-- CreateIndex
CREATE INDEX "AlertLog_createdAt_idx" ON "AlertLog"("createdAt");

-- CreateIndex
CREATE INDEX "AdminNote_manufacturerId_idx" ON "AdminNote"("manufacturerId");

-- CreateIndex
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");

-- CreateIndex
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");

-- CreateIndex
CREATE INDEX "AuditLog_targetType_targetId_idx" ON "AuditLog"("targetType", "targetId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Batch_batchCode_key" ON "Batch"("batchCode");

-- CreateIndex
CREATE INDEX "Batch_manufacturerId_idx" ON "Batch"("manufacturerId");

-- CreateIndex
CREATE INDEX "Batch_targetRegion_idx" ON "Batch"("targetRegion");

-- CreateIndex
CREATE INDEX "Bottle_serialId_idx" ON "Bottle"("serialId");

-- CreateIndex
CREATE INDEX "Bottle_manufacturerId_idx" ON "Bottle"("manufacturerId");

-- CreateIndex
CREATE INDEX "Bottle_status_idx" ON "Bottle"("status");

-- CreateIndex
CREATE INDEX "Bottle_batchId_idx" ON "Bottle"("batchId");

-- CreateIndex
CREATE INDEX "Cap_topCode_idx" ON "Cap"("topCode");

-- CreateIndex
CREATE INDEX "Cap_hiddenSerialId_idx" ON "Cap"("hiddenSerialId");

-- CreateIndex
CREATE INDEX "Cap_status_idx" ON "Cap"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Manufacturer_rcNumber_key" ON "Manufacturer"("rcNumber");

-- CreateIndex
CREATE INDEX "Manufacturer_onboardingStatus_idx" ON "Manufacturer"("onboardingStatus");

-- CreateIndex
CREATE INDEX "Manufacturer_subscriptionPlan_idx" ON "Manufacturer"("subscriptionPlan");

-- CreateIndex
CREATE INDEX "Manufacturer_rcNumber_idx" ON "Manufacturer"("rcNumber");

-- CreateIndex
CREATE INDEX "Product_manufacturerId_idx" ON "Product"("manufacturerId");

-- CreateIndex
CREATE INDEX "ScanLog_manufacturerId_idx" ON "ScanLog"("manufacturerId");

-- CreateIndex
CREATE INDEX "ScanLog_bottleId_idx" ON "ScanLog"("bottleId");

-- CreateIndex
CREATE INDEX "ScanLog_capId_idx" ON "ScanLog"("capId");

-- CreateIndex
CREATE INDEX "ScanLog_fraudFlag_idx" ON "ScanLog"("fraudFlag");

-- CreateIndex
CREATE INDEX "ScanLog_scannedAt_idx" ON "ScanLog"("scannedAt");

-- CreateIndex
CREATE INDEX "ScanLog_lat_lng_idx" ON "ScanLog"("lat", "lng");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");

-- AddForeignKey
ALTER TABLE "Batch" ADD CONSTRAINT "Batch_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bottle" ADD CONSTRAINT "Bottle_manufacturerId_fkey" FOREIGN KEY ("manufacturerId") REFERENCES "Manufacturer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bottle" ADD CONSTRAINT "Bottle_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "Batch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScanLog" ADD CONSTRAINT "ScanLog_manufacturerId_fkey" FOREIGN KEY ("manufacturerId") REFERENCES "Manufacturer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScanLog" ADD CONSTRAINT "ScanLog_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "Batch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScanLog" ADD CONSTRAINT "ScanLog_bottleId_fkey" FOREIGN KEY ("bottleId") REFERENCES "Bottle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScanLog" ADD CONSTRAINT "ScanLog_capId_fkey" FOREIGN KEY ("capId") REFERENCES "Cap"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlertLog" ADD CONSTRAINT "AlertLog_manufacturerId_fkey" FOREIGN KEY ("manufacturerId") REFERENCES "Manufacturer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminNote" ADD CONSTRAINT "AdminNote_manufacturerId_fkey" FOREIGN KEY ("manufacturerId") REFERENCES "Manufacturer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
