-- Team members: users who work for a manufacturer they do not own, such as
-- factory operators and distributor managers. Safe to run more than once.

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "teamManufacturerId" TEXT;

CREATE INDEX IF NOT EXISTS "User_teamManufacturerId_idx" ON "User"("teamManufacturerId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'User_teamManufacturerId_fkey'
  ) THEN
    ALTER TABLE "User"
      ADD CONSTRAINT "User_teamManufacturerId_fkey"
      FOREIGN KEY ("teamManufacturerId") REFERENCES "Manufacturer"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
