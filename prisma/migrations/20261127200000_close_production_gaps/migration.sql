-- Closes the remaining differences between the production database and
-- prisma/schema.prisma. Safe to run more than once.

-- 1. Foreign keys from Account and Session to User.
--    These were missing on production. The check below stops the migration
--    with a clear message if any rows point at a user that no longer exists,
--    instead of failing halfway.
DO $$
DECLARE
  orphan_accounts integer;
  orphan_sessions integer;
BEGIN
  SELECT count(*) INTO orphan_accounts
    FROM "Account" a LEFT JOIN "User" u ON u."id" = a."userId"
    WHERE u."id" IS NULL;
  SELECT count(*) INTO orphan_sessions
    FROM "Session" s LEFT JOIN "User" u ON u."id" = s."userId"
    WHERE u."id" IS NULL;
  IF orphan_accounts > 0 OR orphan_sessions > 0 THEN
    RAISE EXCEPTION 'Found % Account and % Session rows whose user no longer exists. Remove them before running this migration.', orphan_accounts, orphan_sessions;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Account_userId_fkey') THEN
    ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Session_userId_fkey') THEN
    ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$$;

-- 2. Index on Cap.bottleId declared in the schema.
CREATE INDEX IF NOT EXISTS "Cap_bottleId_idx" ON "Cap"("bottleId");

-- 3. updatedAt defaults. Production already has these, and they help any
--    insert made outside Prisma, so the schema now declares them too.
--    On production these statements change nothing.
ALTER TABLE "Batch" ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "Bottle" ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "Cap" ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "Manufacturer" ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "Product" ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "User" ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP;
