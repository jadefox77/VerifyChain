/*
  Warnings:

  - Added the required column `scanLayer` to the `ScanLog` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "CapStatus" AS ENUM ('SEALED', 'OPENED', 'FLAGGED');

-- CreateEnum
CREATE TYPE "ScanLayer" AS ENUM ('BOTTLE', 'CAP');

-- AlterTable
ALTER TABLE "Batch" ADD COLUMN     "targetRegion" TEXT;

-- AlterTable
ALTER TABLE "ScanLog" ADD COLUMN     "capId" TEXT,
ADD COLUMN     "scanLayer" "ScanLayer" NOT NULL,
ALTER COLUMN "bottleId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "Cap" (
    "id" TEXT NOT NULL,
    "bottleId" TEXT NOT NULL,
    "topCode" TEXT NOT NULL,
    "hiddenSerialId" TEXT NOT NULL,
    "status" "CapStatus" NOT NULL DEFAULT 'SEALED',
    "firstOpenedAt" TIMESTAMP(3),
    "firstOpenedLat" DOUBLE PRECISION,
    "firstOpenedLng" DOUBLE PRECISION,
    "firstPhoneHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Cap_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Cap_bottleId_key" ON "Cap"("bottleId");

-- CreateIndex
CREATE UNIQUE INDEX "Cap_topCode_key" ON "Cap"("topCode");

-- CreateIndex
CREATE UNIQUE INDEX "Cap_hiddenSerialId_key" ON "Cap"("hiddenSerialId");

-- AddForeignKey
ALTER TABLE "Cap" ADD CONSTRAINT "Cap_bottleId_fkey" FOREIGN KEY ("bottleId") REFERENCES "Bottle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScanLog" ADD CONSTRAINT "ScanLog_capId_fkey" FOREIGN KEY ("capId") REFERENCES "Cap"("id") ON DELETE CASCADE ON UPDATE CASCADE;
