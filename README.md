# VerifyChain Africa

Anti-counterfeit verification for bottled and packaged products in Nigeria.

Every unit gets a unique digital identity. Consumers scan a QR code with their phone camera and get an answer in the browser in seconds: genuine, already opened, or possibly refilled. Manufacturers and regulators get a dashboard of scans and fraud alerts.

## How verification works

**Paired mode** (bottles, jars, spirits) uses two QR codes per unit:

1. **Bottle label QR.** The consumer scans it and taps *Verify*. The bottle's identity is confirmed and remembered on that phone for 10 minutes.
2. **Hidden cap QR.** It is printed inside the cap, so it can only be seen once the bottle is opened. The consumer scans it and taps *Confirm*. The cap is checked against the bottle scanned in step 1:
   - **Cap matches and is still sealed:** genuine, first opening confirmed.
   - **Cap already opened:** warning, and the cap is flagged.
   - **Cap belongs to a different bottle:** identity mismatch, possible refill, and both are flagged.

**Single mode** (cans, sachets, cartons) uses one QR code that can be verified as genuine only once.

Nothing is recorded until the consumer taps the button. Link previews, crawlers and browser prefetching can't mark a product as opened. The first-open check is atomic, so two simultaneous scans can't both be told a product is genuine.

QR links are HMAC-signed, and tampered or made-up codes are rejected.

## Fraud detection

A rule-based pipeline runs daily (Vercel Cron) and raises alerts for:

| Rule | Signal |
| --- | --- |
| Repeat scan abuse | The same unit scanned many times in 24 hours |
| Geographic teleportation | The same unit scanned in two places too far apart for the time between scans |
| Supply chain drift | A unit scanned more than 300 km from the batch's target region |
| Bot activity | Many scans from one source within 2 minutes (grouped by a keyed hash of the IP; raw IPs are never stored) |

Location is optional. The consumer's phone asks for permission when they tap *Verify*, and verification still works if they decline.

## Platform

- **Manufacturer portal:** onboarding, products, batch generation, QR export as a ZIP, scan logs, fraud alerts, billing plans.
- **Admin portal:** a manufacturer onboarding pipeline (review → compliance → integration → pilot → production), a fraud map, alerts, users and roles, and regulatory exports.
- **Factory integration:** production-line scanners pair caps to bottles through an HMAC-authenticated API (`POST /api/factory/pairing`).
- **Roles:** super admin, manufacturer admin, factory operator, fraud analyst, regulatory observer (read-only, scoped), distributor manager, support. Access is enforced in `proxy.ts`.

## Stack

Next.js 16 (App Router, Server Actions), React 19, TypeScript, Tailwind CSS v4, Prisma with PostgreSQL, next-auth v5 (Google and email/password), Upstash Redis rate limiting, Leaflet maps, and Vercel hosting and cron.

## Running locally

```bash
npm install
npx prisma migrate dev
npm run dev
```

Environment variables (`.env.local`):

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL`, `DIRECT_URL` | PostgreSQL connection |
| `NEXTAUTH_SECRET`, `NEXTAUTH_URL` | Auth |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Google sign-in |
| `QR_SECRET` | Signs QR links and hashes IPs |
| `FACTORY_SECRET` | Factory scanner request signing |
| `CRON_SECRET` | Protects the daily fraud job |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | Rate limiting |
| `NEXT_PUBLIC_APP_URL` | Public base URL used in QR codes |

Helper scripts live in `scripts/` (create an admin, seed a manufacturer, seed scan logs).
