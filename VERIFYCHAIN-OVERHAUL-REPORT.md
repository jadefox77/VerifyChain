# VerifyChain Africa: overhaul report

This zip contains only files that were changed or added. Extract it at the root of the `verifychain` project folder and let it overwrite existing files. One file must be deleted by hand (see "Deletions" below).

There are no changes to `package.json`, the lockfile, `prisma/schema.prisma`, migrations, environment variables or API routes' request and response formats. No new dependencies were added.

## Deletions

Delete this file after extracting. It was not used anywhere:

- `components/nav-link.tsx`

## 1. Audit findings

### Bugs found and fixed

- **Sign-in swallowed its own success.** The credentials sign-in caught every error, including the redirect Next.js throws on success, so it could send people back to the sign-in page. It now only handles real authentication errors.
- **Forced password reset could loop.** After setting a new password the session token still said "must reset", so people were sent back to the reset page. The session is now refreshed after the reset.
- **After sign-in the address bar showed "/"** even though the dashboard was displayed. Sign-in and password reset now send people straight to `/admin`, `/dashboard` or the reset page based on their role.
- **The next-auth error page did not exist** (`/auth/error`), so sign-in errors showed a broken page. Added.
- **`requireAdmin` redirected to `/auth/signin`, which does not exist.** It now goes to `/login`.
- **Monthly usage on the Plan and usage page used the all-time total**, so every account looked over its allowance eventually. It now counts units created this month.
- **Drift detection never matched the FCT.** The state list stored "FCT — Abuja" but the coordinates table uses "Abuja". The list now stores "Abuja" (shown as "FCT (Abuja)").
- **The admin Alerts page said "Unresolved" but listed every alert** on first load. The default filter now matches what it says.
- **The admin overview chart's weekday labels were off by one**, and the overview's fraud rate was hard-coded to 0. Both now use real data.
- **The mobile homepage scrolled sideways** because a hidden button was still showing. Fixed.
- **A debug `console.log` in the QR ZIP export** printed bottle and cap data to the server logs. Removed.
- **Product and batch creation did not check that the company was approved.** They now require the account to be live, matching what the UI already implied.

### Security issues found and fixed

- **Create manufacturer server action had no permission check.** Server actions can be called directly, so the page's check alone was not enough. The action now requires a super admin.
- **The temporary password was put in the page URL**, so it landed in browser history and server logs. It is now passed in a short-lived (2 minute), httpOnly, path-scoped cookie, and there is an "I have saved these details" button that clears it. User and company records are now created in one transaction.
- **Manual pairing server action had no permission check.** It now requires an admin role that can write (super admin or support). It also now checks that the bottle belongs to the selected manufacturer and tells the admin why a pairing failed instead of silently doing nothing.
- **Resolving an alert redirected to whatever the Referer header said** (an open redirect). It now only returns to a page under `/admin` on the same site.

### Issues found but not changed (need your decision)

- **Migrations do not match the schema.** Running `prisma migrate deploy` on an empty database produces a schema without `User.password`, `User.mustResetPassword`, `Product.authMode`, `Batch.generationMode`, `Cap.batchId` and related indexes. Production was probably updated with `prisma db push`. I did not add a migration, because if production already has these columns a new migration would fail there. Worth fixing with `prisma migrate diff` plus `prisma migrate resolve` when you are ready.
- **Fraud analysts cannot resolve alerts.** `canWrite` only allows super admins and support. The role description used to say "alert management"; I changed it to "Read access to fraud data and alerts" so it is accurate. If analysts should resolve alerts, the role check needs changing.
- **Any admin role can export all alerts** via `/api/admin/alerts/export`.
- **`/api/verify` and `/api/verify-cap` do not check the QR signature**, unlike the web pages. Anyone with a serial can call them.
- **Plan limits and plan features are not enforced in code.** The Plan and usage page shows them, but nothing stops a Free account generating more than 5,000 units.
- **`totalBottlesGenerated` is only updated by the fraud pipeline**, so counts shown from it (admin fraud rankings, manufacturer lists) lag until the next run.
- **The on-demand fraud check always reports 0 alerts created** (`alertsCreated` is never incremented in `runFastFraudPipeline`).
- **A cap scanned without first scanning the bottle label is reported as genuine** (marked "Cap only"). That is how the existing logic works; I did not change it.
- **The map loads Leaflet marker images and tiles from unpkg and OpenStreetMap.** It works online, but it is an external dependency at runtime.
- **The manual pairing page had a "Production line ID" field that was never saved.** I removed the field rather than keep an input that did nothing. The pairing API still accepts `lineId`.

## 2. Design and UX changes

- A small design system: IBM Plex Sans and Plex Mono (via `next/font`, no new package), a green brand colour scale, and shared building blocks in `components/ui/` (page header, stat card, badge, empty state, notice, submit button with a loading state, logo) and `lib/ui.ts` (inputs, buttons, cards).
- **Homepage** rebuilt around what the product actually does: the refill problem, the two-scan flow, the three possible results, features for manufacturers, safeguards and the onboarding stages.
- **Shopper verification** is mobile first, with clear result cards (genuine, warning, not genuine), step guidance, the top-cap code to compare, a countdown, and a "What you can do" section on failed checks.
- **Manufacturer dashboard**: new sidebar with icons and a mobile drawer, a getting-started checklist for new accounts, clearer stats, a unit status bar, and consistent tables that scroll sideways on small screens instead of breaking the layout. Dark mode on the batch detail page was fixed.
- **Onboarding**: labelled fields, accessible step navigation, an edit link for each section on the review step, and a stage timeline on the pending page.
- **Admin area**: a consistent dark theme, a new sidebar (grouped, with a mobile drawer, keeping the desktop collapse toggle), a rebuilt overview, larger and more readable text, and tables that scroll on mobile. Code values (serials, batch codes, RC numbers) use a monospace font.
- **Accessibility**: visible focus outlines, labels tied to every input, `aria-current` in navigation, the theme toggle is a labelled radio group, charts have text alternatives, reduced-motion support, and the mobile drawers close with Escape and are inert when hidden.

## 3. Copy changes

- All copy rewritten in plain British English and sentence case.
- Removed claims the product cannot back up, for example "Safe to consume", "Get Started Free", "Protecting consumers across Africa", "1 to 3 business days" and "you will receive confirmation".
- Status names made human: "Mint" became "Unopened", "PENDING_REVIEW" became "Pending review", alert types became phrases such as "Cap and bottle mismatch" or "Impossible travel".
- Error messages now say what happened and what to do next.
- Fraud alert messages written by the pipeline are now plain sentences. The serial is still in the message, so the pipeline's duplicate check still works. The internal flag reasons "Supply chain drift" and "mismatch" were kept, because pages search for them.

## 4. AI markers and template traits removed

- Every emoji, em dash, arrow and tick symbol in user-facing text.
- Fake live indicators: the pulsing dots, "SYSTEMS OPERATIONAL", "PAIRING SYSTEM ONLINE", "Auto-refresh every 30s" (nothing refreshed automatically), and the "Operational Intelligence" header bar.
- Wrong claims: "Runs hourly" (the cron runs daily at midnight UTC).
- A "Batch CSV Upload: Coming Soon" card for a feature that does not exist.
- Inflated headings such as "Fraud Intelligence Center" and "Geographic Fraud Intelligence".
- Leftover generated comments such as "Phase 4" placeholders and banner-style comment blocks in the files touched.
- Decorative uppercase monospace labels throughout the admin area.

## 5. Technical fixes

- ESLint config repaired (it was failing to load). Lint now passes with no errors or warnings.
- Removed every `as any` cast that lint flagged, by using Prisma's generated types.
- Removed unused imports, variables and parameters.
- Lint errors in the theme toggle and countdown timer fixed by using `useSyncExternalStore` and derived state.
- Inputs from forms are trimmed and length-limited before saving, and enum values are checked against allowed lists.
- Shared helpers for dates (Africa/Lagos time zone), relative times, naira amounts, status labels and Nigerian states.

## 6. Testing and results

Everything below was actually run in this session.

- `npx tsc --noEmit`: passes, no errors.
- `npx eslint .`: passes, no errors or warnings.
- `npx next build`: passes, all 50 routes build.
- **Browser tests** with Playwright against the production build (`next start`), a local PostgreSQL 16 database and a local HTTPS front end so secure cookies behave as they do in production. Each page was loaded at 390px (phone) and 1366px (desktop) and checked for server errors, browser console errors, sideways scrolling and banned characters (em dashes, arrows, ticks, emojis). **85 of 85 checks passed.** They covered:
  - Public pages: homepage, sign-in, sign-in error, unauthorised, auth error, 404, onboarding submitted.
  - Sign-in with a wrong password shows the error.
  - Manufacturer: all six dashboard pages; creating a two-code product and a single-code product; generating a batch of 5; CSV export; QR ZIP export; batch detail; being blocked from `/admin`.
  - Shopper flow: bottle label scan, then cap confirm gives "Genuine product"; scanning the same cap again gives "This cap was opened before"; a cap without the label scan; a tampered signature gives "This code is not valid"; an unknown serial.
  - Admin (super admin): all 14 admin pages; creating a manufacturer (temporary password shown, not in the URL); duplicate email error; manual pairing with an unknown bottle shows the reason.
  - Fraud analyst: manual pairing form is disabled; Users page is blocked.
  - New manufacturer signing in with the temporary password is sent to the reset page, and after resetting lands on the dashboard with no loop.
  - A user with no company is sent to onboarding.
  - Resolving an alert without a session is refused.

**Not tested:**

- Google sign-in (needs real Google credentials).
- Upstash rate limiting against the real service. A local stand-in that always allows requests was used.
- The map tiles and marker images, because the test environment cannot reach OpenStreetMap or unpkg. The map container renders; the tiles did not load there.
- The daily cron itself, the factory pairing API with a real scanner, and email delivery.
- Real phones and browsers other than Chromium.
- Every admin action button (approve, reject, suspend, change role, add note). The pages load; the actions themselves were not clicked through.

## 7. Remaining issues

The items under "Issues found but not changed" above, plus:

- Some admin pages (analytics, regulatory, billing, serialisation, manufacturer detail) were cleaned up and made readable but keep their original layout, rather than being fully rebuilt like the overview and alerts pages.
- The Leaflet stylesheet and marker images are still loaded from unpkg on the admin fraud map.
