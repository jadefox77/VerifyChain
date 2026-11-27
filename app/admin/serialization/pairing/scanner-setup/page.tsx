import { requireAdmin } from "@/lib/admin-auth"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ??
  "https://verifychain-africa.vercel.app"

export default async function ScannerSetupPage() {
  await requireAdmin()

  return (
    <div className="p-6 max-w-3xl space-y-6">
      <Link
        href="/admin/serialization/pairing"
        className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-300 transition-colors"
      >
        <ArrowLeft className="w-3 h-3" />
        Pairing
      </Link>

      <div>
        <h1 className="text-lg font-bold text-white mb-1">
          Connect a factory scanner
        </h1>
        <p className="text-xs text-gray-500">
          How a production line scanner or vision system sends bottle and
          cap pairings to VerifyChain.
        </p>
      </div>

      {/* Endpoint */}
      <div className="bg-gray-900/60 border border-gray-800/60 rounded-xl p-5 space-y-4">
        <h2 className="text-xs text-gray-400 font-medium">
          Endpoint
        </h2>
        <div className="flex items-center gap-3 p-3 bg-gray-800/60 rounded-lg border border-gray-700">
          <span className="text-xs text-green-400 bg-green-500/10 border border-green-500/20 px-2 py-0.5 rounded">
            POST
          </span>
          <code className="text-sm text-gray-300">
            {APP_URL}/api/factory/pairing
          </code>
        </div>
        <div className="flex items-center gap-3 p-3 bg-gray-800/60 rounded-lg border border-gray-700">
          <span className="text-xs text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded">
            GET
          </span>
          <code className="text-sm text-gray-300">
            {APP_URL}/api/factory/pairing
          </code>
          <span className="text-xs text-gray-400">
            Health check
          </span>
        </div>
      </div>

      {/* Authentication */}
      <div className="bg-gray-900/60 border border-gray-800/60 rounded-xl p-5 space-y-3">
        <h2 className="text-xs text-gray-400 font-medium">
          Authentication
        </h2>
        <p className="text-xs text-gray-500 leading-relaxed">
          Each request carries three headers.{" "}
          <span className="text-gray-400">X-Factory-Timestamp</span> is the
          current Unix time in seconds.{" "}
          <span className="text-gray-400">X-Factory-Nonce</span> is a new
          random value for every request (16 to 64 letters, digits, - or _).{" "}
          <span className="text-gray-400">X-Factory-Token</span> is the
          HMAC-SHA256, in hex, of{" "}
          <span className="text-gray-400">timestamp.nonce.body</span>, keyed
          with your <span className="text-gray-400">FACTORY_SECRET</span>.
          Sign the body exactly as you send it.
        </p>
        <p className="text-xs text-gray-500 leading-relaxed">
          Requests more than 5 minutes from server time, and any nonce that was
          already used, are refused with 401. Keep the scanner&apos;s clock set
          automatically (NTP). To retry a failed request, sign it again with a
          new timestamp and nonce.
        </p>
        <div className="p-3 bg-gray-800/60 rounded-lg border border-gray-700">
          <pre className="text-xs text-gray-400 whitespace-pre-wrap">{`// Node.js example
const crypto = require('crypto')

const payload = JSON.stringify(body)
const timestamp = String(Math.floor(Date.now() / 1000))
const nonce = crypto.randomBytes(16).toString('hex')
const token = crypto
  .createHmac('sha256', process.env.FACTORY_SECRET)
  .update(\`\${timestamp}.\${nonce}.\${payload}\`)
  .digest('hex')

fetch('${APP_URL}/api/factory/pairing', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Factory-Timestamp': timestamp,
    'X-Factory-Nonce': nonce,
    'X-Factory-Token': token,
  },
  body: payload,
})`}</pre>
        </div>
      </div>

      {/* Request body */}
      <div className="bg-gray-900/60 border border-gray-800/60 rounded-xl p-5 space-y-3">
        <h2 className="text-xs text-gray-400 font-medium">
          Request body
        </h2>
        <div className="p-3 bg-gray-800/60 rounded-lg border border-gray-700">
          <pre className="text-xs text-gray-400 whitespace-pre-wrap">{`{
  "bottleSerialId": "abc123xyz",   // required: serial on the bottle label QR
  "topCapCode": "X7P2A9",          // required: code printed on top of the cap
  "hiddenSerialId": "QR-K7L91X",   // required: serial on the QR inside the cap
  "manufacturerId": "clxxx...",    // required: the manufacturer's ID
  "lineId": "LINE-A",              // optional: production line ID
  "eventType": "PAIRING"           // optional: defaults to PAIRING
}`}</pre>
        </div>
      </div>

      {/* Response codes */}
      <div className="bg-gray-900/60 border border-gray-800/60 rounded-xl p-5 space-y-3">
        <h2 className="text-xs text-gray-400 font-medium">
          Responses
        </h2>
        <div className="space-y-2">
          {[
            {
              code: "200",
              color: "text-green-400",
              label: "PAIRING_RECORDED",
              desc: "Pairing saved",
            },
            {
              code: "401",
              color: "text-red-400",
              label: "Unauthorized",
              desc: "Bad signature, stale timestamp, or a nonce already used",
            },
            {
              code: "404",
              color: "text-orange-400",
              label: "BOTTLE_NOT_FOUND",
              desc: "No bottle with that serial",
            },
            {
              code: "409",
              color: "text-red-400",
              label: "DUPLICATE_PAIRING",
              desc: "Bottle already has a cap paired",
            },
            {
              code: "409",
              color: "text-red-400",
              label: "DUPLICATE_CAP_IDENTITY",
              desc: "Cap codes already exist. The cap may be cloned.",
            },
          ].map((r) => (
            <div
              key={r.label}
              className="flex items-center gap-3 p-2.5 bg-gray-800/40 rounded-lg"
            >
              <span
                className={`text-xs w-8 ${r.color}`}
              >
                {r.code}
              </span>
              <span className="text-xs text-gray-400 w-40">
                {r.label}
              </span>
              <span className="text-xs text-gray-400">{r.desc}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Environment variable needed */}
      <div className="bg-yellow-500/5 border border-yellow-500/20 rounded-xl p-4">
        <p className="text-xs text-yellow-400 mb-2">
          Required environment variable
        </p>
        <code className="text-xs text-gray-400">
          FACTORY_SECRET=your-secret-key-here
        </code>
        <p className="text-[11px] text-gray-400 mt-2">
          Set this in the hosting environment and share it only with the
          team configuring the factory integration.
        </p>
      </div>
    </div>
  )
}