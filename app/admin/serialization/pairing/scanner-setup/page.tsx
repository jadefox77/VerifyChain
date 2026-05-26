import { requireAdmin } from "@/lib/admin-auth"
import { ArrowLeft, Copy } from "lucide-react"
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
        className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-300 font-mono transition-colors"
      >
        <ArrowLeft className="w-3 h-3" />
        Back to Pairing Monitor
      </Link>

      <div>
        <h1 className="text-lg font-bold text-white mb-1">
          Factory Scanner Integration
        </h1>
        <p className="text-xs text-gray-500 font-mono">
          Connect your factory vision system or barcode scanner to
          VerifyChain's pairing API
        </p>
      </div>

      {/* Endpoint */}
      <div className="bg-gray-900/60 border border-gray-800/60 rounded-xl p-5 space-y-4">
        <h2 className="text-xs font-mono text-gray-400 uppercase tracking-wider">
          API Endpoint
        </h2>
        <div className="flex items-center gap-3 p-3 bg-gray-800/60 rounded-lg border border-gray-700">
          <span className="text-[10px] font-mono text-green-400 bg-green-500/10 border border-green-500/20 px-2 py-0.5 rounded">
            POST
          </span>
          <code className="text-sm font-mono text-gray-300">
            {APP_URL}/api/factory/pairing
          </code>
        </div>
        <div className="flex items-center gap-3 p-3 bg-gray-800/60 rounded-lg border border-gray-700">
          <span className="text-[10px] font-mono text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded">
            GET
          </span>
          <code className="text-sm font-mono text-gray-300">
            {APP_URL}/api/factory/pairing
          </code>
          <span className="text-[10px] text-gray-600">
            — Health check
          </span>
        </div>
      </div>

      {/* Authentication */}
      <div className="bg-gray-900/60 border border-gray-800/60 rounded-xl p-5 space-y-3">
        <h2 className="text-xs font-mono text-gray-400 uppercase tracking-wider">
          Authentication
        </h2>
        <p className="text-xs text-gray-500 leading-relaxed">
          Each request must include an HMAC-SHA256 signature of the
          request body in the{" "}
          <span className="font-mono text-gray-400">
            X-Factory-Token
          </span>{" "}
          header. The HMAC key is your{" "}
          <span className="font-mono text-gray-400">FACTORY_SECRET</span>{" "}
          environment variable.
        </p>
        <div className="p-3 bg-gray-800/60 rounded-lg border border-gray-700">
          <pre className="text-xs font-mono text-gray-400 whitespace-pre-wrap">{`// Node.js example
const crypto = require('crypto')

const payload = JSON.stringify(body)
const token = crypto
  .createHmac('sha256', process.env.FACTORY_SECRET)
  .update(payload)
  .digest('hex')

fetch('${APP_URL}/api/factory/pairing', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Factory-Token': token,
  },
  body: payload,
})`}</pre>
        </div>
      </div>

      {/* Request body */}
      <div className="bg-gray-900/60 border border-gray-800/60 rounded-xl p-5 space-y-3">
        <h2 className="text-xs font-mono text-gray-400 uppercase tracking-wider">
          Request Body
        </h2>
        <div className="p-3 bg-gray-800/60 rounded-lg border border-gray-700">
          <pre className="text-xs font-mono text-gray-400 whitespace-pre-wrap">{`{
  "bottleSerialId": "abc123xyz",      // required — bottle QR serial
  "topCapCode": "X7P2A9",            // required — visible cap code
  "hiddenSerialId": "QR-K7L91X",     // required — hidden internal QR
  "manufacturerId": "clxxx...",       // required — your manufacturer ID
  "lineId": "LINE-A",                 // optional — production line ID
  "eventType": "PAIRING"             // optional — defaults to PAIRING
}`}</pre>
        </div>
      </div>

      {/* Response codes */}
      <div className="bg-gray-900/60 border border-gray-800/60 rounded-xl p-5 space-y-3">
        <h2 className="text-xs font-mono text-gray-400 uppercase tracking-wider">
          Response Codes
        </h2>
        <div className="space-y-2">
          {[
            {
              code: "200",
              color: "text-green-400",
              label: "PAIRING_RECORDED",
              desc: "Pairing successful",
            },
            {
              code: "401",
              color: "text-red-400",
              label: "Unauthorized",
              desc: "Invalid factory token",
            },
            {
              code: "404",
              color: "text-orange-400",
              label: "BOTTLE_NOT_FOUND",
              desc: "Bottle serial not in system",
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
              desc: "Cap codes already exist — possible clone",
            },
          ].map((r) => (
            <div
              key={r.label}
              className="flex items-center gap-3 p-2.5 bg-gray-800/40 rounded-lg"
            >
              <span
                className={`text-[10px] font-mono w-8 ${r.color}`}
              >
                {r.code}
              </span>
              <span className="text-[10px] font-mono text-gray-400 w-40">
                {r.label}
              </span>
              <span className="text-[10px] text-gray-600">{r.desc}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Environment variable needed */}
      <div className="bg-yellow-500/5 border border-yellow-500/20 rounded-xl p-4">
        <p className="text-xs text-yellow-400 font-mono mb-2">
          Required environment variable:
        </p>
        <code className="text-xs font-mono text-gray-400">
          FACTORY_SECRET=your-secret-key-here
        </code>
        <p className="text-[11px] text-gray-600 mt-2">
          Add this to your Vercel environment variables and share it
          securely with your factory integration team.
        </p>
      </div>
    </div>
  )
}