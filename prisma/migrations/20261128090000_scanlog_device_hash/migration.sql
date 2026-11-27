-- Anonymous device id on scan logs, so rate limits and fraud rules can tell
-- apart shoppers who share one mobile network IP. Safe to run more than once.

ALTER TABLE "ScanLog" ADD COLUMN IF NOT EXISTS "deviceHash" TEXT;

CREATE INDEX IF NOT EXISTS "ScanLog_deviceHash_scannedAt_idx" ON "ScanLog"("deviceHash", "scannedAt");
