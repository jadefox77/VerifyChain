# VerifyChain: production schema gaps and faster admin pages

Extract this zip at the root of the `verifychain` project folder, on top of what you have now (commit `5ea571f` on GitHub). Let it overwrite. I compared every file it replaces with GitHub first, and none of them had changed since the last zip.

It contains 13 files. Nothing needs deleting, and `package.json` is unchanged.

## Part 1: close the production schema gaps

The diff you ran showed three kinds of difference between production and the schema. This zip closes them with a new migration, `prisma/migrations/20261127200000_close_production_gaps/migration.sql`, plus a small schema edit.

| Gap on production | What this does |
|---|---|
| No foreign key from `Account.userId` and `Session.userId` to `User` | Adds both, with delete cascade as the schema says. It checks for orphaned rows first. |
| No `Cap_bottleId_idx` index | Creates it. |
| `updatedAt` columns have a `now()` default that the schema did not declare | **Keeps the defaults.** The schema now declares `@default(now())` on those six `updatedAt` fields instead. Removing the defaults could break any insert made outside Prisma, and keeping them changes nothing for the app. |

Every statement checks first, so running it twice is harmless.

### Steps (PowerShell, from the project folder, with `.env` pointing at production)

1. **Check for orphaned rows.** These are logins or sessions whose user no longer exists. Run this in the Supabase SQL editor:

   ```sql
   SELECT
     (SELECT count(*) FROM "Account" a LEFT JOIN "User" u ON u.id = a."userId" WHERE u.id IS NULL) AS orphan_accounts,
     (SELECT count(*) FROM "Session" s LEFT JOIN "User" u ON u.id = s."userId" WHERE u.id IS NULL) AS orphan_sessions;
   ```

   - If both are 0, go to step 2.
   - If either is above 0, those rows belong to deleted users and cannot be used to sign in. Remove them with the two lines below. This deletes data, so only run it if you are happy to remove those rows:

   ```sql
   DELETE FROM "Session" s WHERE NOT EXISTS (SELECT 1 FROM "User" u WHERE u.id = s."userId");
   DELETE FROM "Account" a WHERE NOT EXISTS (SELECT 1 FROM "User" u WHERE u.id = a."userId");
   ```

2. **Apply the migration:**

   ```powershell
   npx prisma migrate deploy
   ```

   It should say it applied `20261127200000_close_production_gaps`.

3. **Confirm the database now matches the schema:**

   ```powershell
   npx prisma migrate diff --from-schema-datasource prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma
   npx prisma migrate status
   ```

   The first should print `No difference detected.` and the second `Database schema is up to date!`

If you skip step 1 and orphans exist, the migration stops with a message giving the count, and nothing changes. To recover, run the delete lines, then:

```powershell
npx prisma migrate resolve --rolled-back 20261127200000_close_production_gaps
npx prisma migrate deploy
```

## Part 2: why admin navigation was slow, and what changed

### What I found

I measured it by putting a 75ms round-trip delay between the app and the database. That is roughly the distance from Vercel's default region (Washington, US) to your Supabase database in London. Then I timed clicks between admin pages in a real browser.

Two things made it feel slow:

1. **No response at all until the whole page was ready.** The admin pages had no loading screen, so after a click nothing changed on screen until the server finished every query. Next.js also cannot prefetch these pages without one.
2. **Too many database trips, one after another.**
   - Analytics made about 40 queries in sequence. It also downloaded every scan from the last 7 days just to count them by hour.
   - Serialisation, Regulatory, Fraud, Billing and Overview also ran queries in batches, or in loops, one after another.
   - At 75ms per round trip that adds up quickly.

### What changed

- **Loading screens** for the admin area and the manufacturer dashboard. A click now gets a visible response straight away, and Next.js can prefetch the page frame.
- **Fewer, parallel queries:**
  - Analytics, Serialisation, Regulatory, Fraud, Billing and the admin Overview now run their queries at the same time.
  - Totals, daily charts, hourly charts and monthly trends are each worked out by the database in one query.
  - Analytics no longer downloads raw scan rows.
- **Days and months now follow Lagos time.** "Today", the daily and hourly charts, and the monthly trend used the server's clock, which is UTC on Vercel. This also fixes the Serialisation chart's weekday labels, which were off by one day.
- **Serialisation's "Plan usage" column** now uses this month's units, the same figure the plan limits use.
- **Leftover inflated headings tidied** on Analytics, Serialisation and Regulatory, for example "Regulatory Intelligence View" and "All manufacturer activity is monitored and logged".

### Measured results (75ms simulated database distance, 2 rounds per page)

| Page | Before: first response / done | After: first response / done |
|---|---|---|
| Analytics | 3.9s / 3.9s | 0.06s / 0.37s |
| Serialisation | 1.6s / 1.6s | 0.06s / 0.52s |
| Regulatory | 1.3s / 1.3s | 0.06s / 0.36s |
| Fraud | 0.84s / 0.84s | 0.06s / 0.37s |
| Users | 0.52s / 0.52s | 0.06s / 0.50s |
| Billing | 0.52s / 0.52s | 0.06s / 0.37s |
| Overview | 0.44s / 0.44s | 0.06s / 0.36s |
| **Average of all 10 admin pages** | **1.0s / 1.0s** | **0.06s / 0.39s** |

One trade-off: the quickest pages (Manufacturers, Alerts) used to finish in about 0.22s and now take about 0.36s. React keeps a loading screen up for a short minimum time so it does not flash. In exchange, every click responds within about 60ms. On production, with real data and real distances, every page takes longer than that minimum anyway.

These numbers come from a small local test database. Production has more data, so its absolute times will be higher. The reduction in round trips applies there just the same.

### One more change: run the server next to the database

`vercel.json` now sets `"regions": ["lhr1"]`, which runs the app's server functions in London, next to your Supabase database. Every query then travels a few milliseconds instead of crossing the Atlantic. You in Lagos are also closer to London than to Washington.

- This takes effect on the next deploy.
- If you would rather choose the region yourself, remove that line and set it in Vercel under Project Settings, Functions.

**Worth checking in your Vercel environment variables.** `DATABASE_URL` (used by the running app) should use Supabase's transaction pooler on port 6543 with `?pgbouncer=true`. If it also has `connection_limit=1`, queries in a page still run one at a time. Raising it to 3 or 5 lets the parallel queries actually run in parallel. `DIRECT_URL` stays on the session pooler (5432), as you set it.

## Testing

Everything below was run in this session:

- `npx tsc --noEmit`, `npx eslint .` and `npx next build` all pass.
- **Migration.** I recreated your production state locally, and `migrate diff` printed exactly the same list you got. Then:
  - `migrate deploy` applied the new migration, and `migrate diff` reports "No difference detected."
  - A fresh empty database built from all six migrations also matches the schema exactly.
  - With an orphaned session row present, the migration stops with "Found 0 Account and 1 Session rows whose user no longer exists". After deleting the row, `migrate resolve --rolled-back` then `migrate deploy` succeeds and the diff is empty.
- **Speed:** measured as in the table above.
- **Correctness of the rewritten pages:** I compared the figures on Overview, Analytics, Serialisation, Regulatory and Fraud with direct SQL counts. They match: 20 scans, 7 flagged, 14 cap and 6 label scans, 5,525 units, and 0 bottles without a cap. Hourly buckets were checked in Lagos time.
- **Full browser suite run again:** 85 of 85 checks pass.

Not tested: the Vercel region change (it only applies on Vercel), and timings against your real production data.
