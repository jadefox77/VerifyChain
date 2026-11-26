-- AlterTable
ALTER TABLE "ScanLog" ADD COLUMN "ipHash" TEXT;

-- CreateIndex
CREATE INDEX "ScanLog_ipHash_scannedAt_idx" ON "ScanLog"("ipHash", "scannedAt");
