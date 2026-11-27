# VerifyChain follow-ups: migrations, alert resolving, plan limits

Extract this zip at the root of the `verifychain` project folder, on top of the overhaul you already applied. Let it overwrite. Nothing needs deleting this time, and nothing changed in `package.json`.

It contains 13 files: 12 changed or new code files and 1 new migration.

## 1. Migration history now matches the schema

New file: `prisma/migrations/20261127190000_sync_schema_baseline/migration.sql`

It adds what the old migrations were missing: the `AuthMode` type, `User.password`, `User.mustResetPassword`, `User.tempPasswordUsed`, `Product.authMode`, `Batch.generationMode`, `Cap.batchId` (with `Cap.bottleId` made optional), and two indexes on `Cap`.

Every statement checks before it changes anything. If the migration ever runs against a database that already has these columns, nothing changes there. Your production database already has them, so the plan is to **record the migration as applied without running it**.

Your `build` script does not run migrations, so deploying this code changes nothing in the database on its own.

### Steps for production (PowerShell)

Run these from the project folder. First make sure `DATABASE_URL` and `DIRECT_URL` in your `.env` point at the **production** database. Prisma reads them from there.

1. Check that the live database already matches the schema:

   ```powershell
   npx prisma migrate diff --from-schema-datasource prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma
   ```

   It should print `No difference detected.` If it prints anything else, stop and send me the output.

2. Record the new migration as already applied:

   ```powershell
   npx prisma migrate resolve --applied 20261127190000_sync_schema_baseline
   ```

3. Confirm:

   ```powershell
   npx prisma migrate status
   ```

   It should end with `Database schema is up to date!`

If your `.env` normally points at a development database, switch it back afterwards.

### For a new or empty database

`npx prisma migrate deploy` now builds the full, current schema from scratch. You do not need `db push` any more.

## 2. Fraud analysts can resolve alerts

- Super admins, support staff **and fraud analysts** can now resolve alerts. Regulatory observers still cannot.
- The Alerts page shows who resolved each alert and how long ago. Hover the time to see the exact date.
- The alerts CSV export has two new columns at the end: "Resolved By" and "Resolved At". Existing columns keep their order. Text columns are now quoted, so a comma in a company name no longer shifts the columns.
- An alert can only be resolved once, so the first person to resolve it stays on record.
- Each resolve is also written to the audit log, as before.

## 3. Plan limits are enforced, softly

Allowances are per calendar month, Lagos time, and reset at midnight on the 1st. They count units serialised that month:

| Plan | Units a month |
|---|---|
| Free | 5,000 |
| Starter | 50,000 |
| Professional | 500,000 |
| Enterprise | No limit |

How it works:

- **Under 80%:** no message.
- **80% or more:** a warning on the Overview, Batches and Plan and usage pages. It shows how many units are left and when the allowance resets. The batch form also shows the units left.
- **At or over 100%:** new batches are paused until the 1st of next month or until the plan changes. The batch form is disabled and the server refuses the request, so a page left open cannot get around it. Existing batches, downloads and shopper scans are not affected.
- **One batch can cross the limit.** As agreed, batches are only blocked once an account is already over its allowance. A batch started below the limit is allowed even if it ends above it. The largest batch is 5,000 units, so a Free account can reach up to 9,999 units in a month. Changing this to "refuse any batch that would go over" is a small change in `lib/actions/batches.ts`.

The admin Billing page now measures usage against this month's units. Before, it used an all-time total that only updated when the fraud checks ran.

Plan limits, prices and features now live in one file, `lib/plans.ts`, so they no longer have to be kept in step across several pages.

**Before you deploy:** check the admin Billing page. Any manufacturer already at or over their allowance this month will have new batches paused as soon as this goes live. You can move them to a larger plan first if needed.

## Testing

Everything below was run in this session, against a production build with a local PostgreSQL 16 database:

- `npx tsc --noEmit`, `npx eslint .` and `npx next build` all pass.
- **Migration**, three ways:
  - Fresh empty database: `migrate deploy` applies all five migrations, and the result matches the schema exactly (`migrate diff --exit-code` returns 0).
  - Copy of a database set up like production (`db push`, no baseline): `migrate resolve --applied` then `migrate status` reports up to date. The diff is empty and no data changed.
  - Same copy, running `migrate deploy` by mistake instead: it succeeds, changes nothing, and the row counts are unchanged.
- **Browser tests:** 16 of 16 pass for the new features.
  - A fraud analyst sees Resolve, resolves an alert, and "Resolved by" shows their name. The CSV includes resolver and time. A second resolve by a super admin does not overwrite it.
  - Free plan: no warning at 15 units. A warning at 4,015 on Overview and Batches. A batch allowed at 4,015 that ends at 5,515. Then the over-limit notice appears on all three pages, the form is disabled, and a submit from a page left open earlier is refused by the server.
  - The admin Billing page shows this month's 5,515 units against the 5,000 limit.
- The full earlier suite was run again: 85 of 85 checks pass.

While testing I found and fixed one more issue. Behind a proxy or load balancer, the redirect after resolving an alert could point at the server's internal address. It now uses a relative address on the same site.

Not tested: real phones, Google sign-in, and the month rollover itself. The reset date is calculated and displayed correctly ("1 Dec 2026"), but I did not wait for a real month change.
