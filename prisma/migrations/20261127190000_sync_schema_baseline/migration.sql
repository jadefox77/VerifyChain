-- Brings the migration history in line with prisma/schema.prisma.
--
-- These columns, the AuthMode type and the indexes were added to the live
-- database earlier without a migration (most likely with `prisma db push`).
-- Every statement below checks first, so running it against a database that
-- already has them changes nothing. On production, mark this migration as
-- applied instead of running it:
--   npx prisma migrate resolve --applied 20261127190000_sync_schema_baseline

-- AuthMode enum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'AuthMode') THEN
    CREATE TYPE "AuthMode" AS ENUM ('PAIRED', 'SINGLE');
  END IF;
END
$$;

-- Batch
ALTER TABLE "Batch" ADD COLUMN IF NOT EXISTS "generationMode" TEXT NOT NULL DEFAULT 'PRE_PAIRED';

-- Cap
ALTER TABLE "Cap" ADD COLUMN IF NOT EXISTS "batchId" TEXT;
ALTER TABLE "Cap" ALTER COLUMN "bottleId" DROP NOT NULL;

-- Product
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "authMode" "AuthMode" NOT NULL DEFAULT 'PAIRED';

-- User
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "mustResetPassword" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "password" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "tempPasswordUsed" BOOLEAN NOT NULL DEFAULT false;

-- Indexes
CREATE INDEX IF NOT EXISTS "Cap_bottleId_idx" ON "Cap"("bottleId");
CREATE INDEX IF NOT EXISTS "Cap_batchId_idx" ON "Cap"("batchId");
