import type { Metadata } from "next"
import Link from "next/link"
import type { ReactNode } from "react"
import { Logo } from "@/components/ui/logo"
import { DRIFT_HARD_FLAG_BOTTLES, DRIFT_RADIUS_KM, DRIFT_WINDOW_DAYS } from "@/lib/regions"

export const metadata: Metadata = {
  title: "Verification API",
  description: "Check VerifyChain codes from your own website or app.",
}

function baseUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL ?? "https://your-verifychain-domain").replace(/\/$/, "")
}

function Code({ children }: { children: string }) {
  return (
    <pre className="overflow-x-auto rounded-xl border border-gray-200 bg-gray-950 p-4 text-xs leading-relaxed text-gray-100 dark:border-gray-800">
      <code>{children}</code>
    </pre>
  )
}

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-8 space-y-4">
      <h2 className="text-lg font-semibold tracking-tight text-gray-900 dark:text-white">{title}</h2>
      {children}
    </section>
  )
}

const P = ({ children }: { children: ReactNode }) => (
  <p className="text-sm leading-relaxed text-gray-700 dark:text-gray-300">{children}</p>
)
const C = ({ children }: { children: ReactNode }) => (
  <code className="rounded bg-gray-100 px-1 py-0.5 font-mono text-[0.8em] text-gray-900 dark:bg-gray-800 dark:text-gray-100">
    {children}
  </code>
)

function Table({ head, rows }: { head: string[]; rows: ReactNode[][] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-800">
      <table className="w-full min-w-[32rem] text-left text-sm">
        <thead className="bg-gray-50 text-xs text-gray-500 dark:bg-gray-900 dark:text-gray-400">
          <tr>
            {head.map((h) => (
              <th key={h} className="px-4 py-2.5 font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 text-gray-700 dark:divide-gray-800 dark:text-gray-300">
          {rows.map((r, i) => (
            <tr key={i}>
              {r.map((cell, j) => (
                <td key={j} className="px-4 py-2.5 align-top">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function DevelopersDocsPage() {
  const base = baseUrl()

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950">
      <header className="border-b border-gray-200 dark:border-gray-800">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4">
          <Link href="/" aria-label="VerifyChain home">
            <Logo compact label="Developers" />
          </Link>
          <Link href="/dashboard/developers" className="text-sm font-medium text-brand-700 hover:underline dark:text-brand-300">
            Manage keys
          </Link>
        </div>
      </header>

      <main id="main" className="mx-auto max-w-3xl space-y-10 px-4 py-10">
        <div className="space-y-3">
          <h1 className="text-3xl font-semibold tracking-tight text-gray-900 dark:text-white">Verification API</h1>
          <P>
            Check your products&apos; VerifyChain codes from your own website or app, and show the result in your own design.
            The API runs the same checks as VerifyChain&apos;s scan pages. A check of one of your codes is recorded as a scan,
            counts toward first-open and refill detection, and is seen by the same fraud rules. A key can only check your own
            products.
          </P>
        </div>

        <Section id="keys" title="1. Get a key">
          <P>
            An admin on your team creates keys under <strong>API keys</strong> in the VerifyChain dashboard. The full key is
            shown once. There are two kinds:
          </P>
          <Table
            head={["Kind", "Starts with", "Use it", "Protection"]}
            rows={[
              [
                "Publishable",
                <C key="pk">vc_pk_</C>,
                "In your website's own code, in the browser.",
                "Only works from the domains you list. Each shopper is limited to 10 checks a minute.",
              ],
              [
                "Secret",
                <C key="sk">vc_sk_</C>,
                "On your server only.",
                "Refused when sent from a browser. Never put it in code that browsers download.",
              ],
            ]}
          />
          <P>
            Send the key on every request as <C>Authorization: Bearer &lt;key&gt;</C>. Revoking a key in the dashboard stops
            it on its next request.
          </P>
        </Section>

        <Section id="endpoints" title="2. Check a code">
          <P>
            The QR code on a product holds a VerifyChain link. Read it with any QR scanner and send the whole link as{" "}
            <C>code</C>. If you have the code&apos;s id and signature separately, send them as <C>code</C> and <C>sig</C>. A
            code without a valid signature is answered with <C>invalid</C>.
          </P>
          <Table
            head={["Endpoint", "For"]}
            rows={[
              [<C key="1">POST {base}/api/v1/verify</C>, "The label code on a bottle, or the only code on a can, sachet or carton."],
              [<C key="2">POST {base}/api/v1/verify/cap</C>, "The code inside the cap of a two-code product."],
            ]}
          />
          <Table
            head={["Field", "Required", "Meaning"]}
            rows={[
              [<C key="a">code</C>, "Yes", "The scanned link, or the code id."],
              [<C key="b">sig</C>, "Only with a bare id", "The code's signature (the sig value in the link)."],
              [<C key="c">bottle_code</C>, "Cap only, strongly recommended", "The bottle label the shopper scanned first. Lets us confirm the cap belongs to that bottle. Without it the result is authentic_unpaired, never authentic."],
              [<C key="d">lat</C>, "No", "Latitude, if the shopper agreed to share location. Helps spot products far from their market."],
              [<C key="e">lng</C>, "No", "Longitude."],
              [<C key="f">shopper_ip</C>, "No, secret keys only", "The shopper's IP address, if your server knows it. Stored only as a keyed hash."],
            ]}
          />
          <P>
            For a two-code product, the label check returns <C>scan_cap</C>. Ask the shopper to open the product and scan
            the code inside the cap, then call the cap endpoint with that code and the label code as <C>bottle_code</C>.
          </P>
        </Section>

        <Section id="response" title="3. Read the result">
          <P>Every check that reaches a code returns HTTP 200 with a body like this:</P>
          <Code>{`{
  "object": "verification",
  "status": "authentic",
  "message": "This Premium Malt 60cl is genuine. This is the first time the cap has been opened.",
  "product": { "name": "Premium Malt 60cl" },
  "check": {
    "layer": "cap",
    "auth_mode": "paired",
    "first_check": true,
    "pairing_checked": true,
    "first_checked_at": "2026-11-28T09:14:02.000Z",
    "reason": null,
    "outside_target_region": false
  },
  "next_step": null,
  "brand": { "name": "Your Brand", "legal_name": "Your Company Ltd" },
  "request_id": "req_Xk3..."
}`}</Code>
          <P>
            Show the <C>message</C> to the shopper. It is written for them and says what to do. Base any decision in your own
            code on <C>status</C>:
          </P>
          <Table
            head={["status", "Meaning"]}
            rows={[
              [<C key="1">authentic</C>, "Genuine, and this is the first check of this code (for two-code products, the first opening of this cap, and the cap belongs to the bottle_code you sent)."],
              [<C key="1b">authentic_unpaired</C>, "Cap endpoint only, when no bottle_code was sent. The cap is genuine and this is its first opening, but it was not checked against the bottle label, so a refill cannot be ruled out. check.reason is bottle_not_checked. Treat it as a pass with a caveat, and send bottle_code to get authentic."],
              [<C key="2">scan_cap</C>, "The bottle label is genuine and the bottle has not been opened. Not a final answer: the cap still needs to be scanned. next_step.top_code is the code printed on top of the cap."],
              [<C key="3">already_verified</C>, "This code was checked before, at check.first_checked_at. If the shopper has just opened the product, it may not be genuine. A repeat check alone does not prove a fake. When check.reason is same_shopper_recheck, the same shopper opened this cap in the last 24 hours (matched by shopper IP for publishable keys or when you send shopper_ip, otherwise by your key), the product was genuine then, and nothing was flagged."],
              [<C key="4">suspicious</C>, "Do not use the product. check.reason says why: flagged, cap_opened_before_label, cap_bottle_mismatch, cap_not_paired or outside_supply_region. For cap_bottle_mismatch with next_step.action scan_bottle, the cap is still sealed: ask the shopper to scan the label of the bottle they actually opened, then call the cap endpoint again with that label as bottle_code. This also happens when a cap that recently failed this check is sent without bottle_code. If the same mismatch happens again, the cap is flagged and next_step is null."],
              [<C key="5">not_found</C>, "No product of yours has this code."],
              [<C key="6">invalid</C>, "The code or its signature is malformed or altered."],
            ]}
          />
          <P>
            A one-code product can only prove that a code was issued and not checked before. If a code is copied, whoever
            checks the copy first gets <C>authentic</C>, and later checks of that code are caught. Two-code products also
            catch refills.
          </P>
          <P>
            <C>check.outside_target_region</C> is true when the product was opened more than {DRIFT_RADIUS_KM} km from the
            state its batch was made for. The product still passes, because stock moves between states and phone location
            is approximate, and the brand gets an alert. A product is only flagged once {DRIFT_HARD_FLAG_BOTTLES} other
            bottles of the same batch have been opened outside the area within {DRIFT_WINDOW_DAYS} days, and then the status is <C>suspicious</C> with reason <C>outside_supply_region</C>.
          </P>
        </Section>

        <Section id="errors" title="Errors">
          <Code>{`{ "error": { "code": "domain_not_allowed", "message": "..." }, "request_id": "req_..." }`}</Code>
          <Table
            head={["HTTP", "code", "What to do"]}
            rows={[
              ["400", <C key="1">bad_json</C>, "Send a JSON body with Content-Type: application/json."],
              ["400", <C key="2">bad_request</C>, "Send at least a code field."],
              ["401", <C key="3">missing_key</C>, "Add the Authorization header."],
              ["401", <C key="4">invalid_key</C>, "The key is wrong or revoked. Create a new one."],
              ["403", <C key="5">domain_not_allowed</C>, "Add this website's domain to the publishable key."],
              ["403", <C key="6">secret_key_in_browser</C>, "Move the call to your server, or use a publishable key."],
              ["403", <C key="7">account_inactive</C>, "Contact VerifyChain support."],
              ["429", <C key="8">rate_limited</C>, "Wait a minute. Each key allows 300 requests a minute."],
              ["500", <C key="9">server_error</C>, "Try again. Quote the request_id if it keeps happening."],
            ]}
          />
        </Section>

        <Section id="examples" title="Examples">
          <P>From your server, with a secret key:</P>
          <Code>{`curl -X POST ${base}/api/v1/verify \\
  -H "Authorization: Bearer $VERIFYCHAIN_SECRET_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"code": "${base}/verify/7KQ2M9XH4TPA?sig=..."}'`}</Code>
          <Code>{`// Node.js 18 or later
const res = await fetch("${base}/api/v1/verify", {
  method: "POST",
  headers: {
    Authorization: \`Bearer \${process.env.VERIFYCHAIN_SECRET_KEY}\`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ code: scannedText, shopper_ip: req.ip }),
})
const result = await res.json()
if (result.status === "authentic" || result.status === "authentic_unpaired") { /* show your genuine screen */ }`}</Code>
          <P>In your website&apos;s page, with a publishable key:</P>
          <Code>{`const res = await fetch("${base}/api/v1/verify/cap", {
  method: "POST",
  headers: {
    Authorization: "Bearer vc_pk_...",
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ code: capQrText, bottle_code: labelQrText }),
})
const result = await res.json()
document.querySelector("#result").textContent = result.message`}</Code>
        </Section>

        <Section id="notes" title="Good to know">
          <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed text-gray-700 dark:text-gray-300">
            <li>Every check changes state, the same as a scan. Do not call the API on page load or to test codes you intend to sell.</li>
            <li>Domain limits stop other websites from using your publishable key in a browser. They cannot stop a script that fakes the Origin header, which is why each shopper is also rate limited and keys can be revoked at any time.</li>
            <li>Request counts per key appear under API keys in the dashboard. Checks made through the API also appear in Scan activity.</li>
          </ul>
        </Section>
      </main>
    </div>
  )
}
