import { verifyBottle } from "@/lib/verify"
import { verifySignature } from "@/lib/serial"

export default async function VerifyPage({
  params,
  searchParams,
}: {
  params: Promise<{ serialId: string }>
  searchParams: Promise<{ sig?: string }>
}) {
  const { serialId } = await params
  const { sig } = await searchParams

  const signatureValid = sig ? verifySignature(serialId, sig) : false

  const result = signatureValid
    ? await verifyBottle({ serialId })
    : {
        status: "NOT_FOUND" as const,
        message: "Invalid or tampered QR code. This product may be counterfeit.",
      }

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center px-4">
      <div className="w-full max-w-md">

        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-10 h-10 bg-gray-900 dark:bg-white rounded-xl mb-3">
            <span className="text-white dark:text-gray-900 text-lg font-bold">V</span>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400">VerifyChain Africa</p>
        </div>

        {result.status === "PROMPT_CAP" && (
          <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-2xl p-8 text-center">
            <div className="text-5xl mb-4">🔍</div>
            <h1 className="text-xl font-bold text-blue-900 dark:text-blue-200 mb-2">
              Step 1 Complete
            </h1>
            <p className="text-blue-700 dark:text-blue-300 text-sm leading-relaxed mb-6">
              Bottle identity confirmed for{" "}
              <strong>{result.productName}</strong>.
            </p>
            <div className="bg-blue-100 dark:bg-blue-900 rounded-xl p-4 text-left space-y-3">
              <p className="text-xs font-semibold text-blue-800 dark:text-blue-200 uppercase tracking-wide">
                Step 2 — Complete verification
              </p>
              <ol className="text-sm text-blue-700 dark:text-blue-300 space-y-2 list-decimal list-inside">
                <li>Open the bottle</li>
                <li>Look inside the cap for a hidden QR code</li>
                <li>Scan that QR code to confirm authenticity</li>
              </ol>
              {result.topCode && (
                <div className="mt-3 pt-3 border-t border-blue-200 dark:border-blue-800">
                  <p className="text-xs text-blue-600 dark:text-blue-400">
                    Top-cap code for reference:{" "}
                    <span className="font-mono font-bold tracking-widest">
                      {result.topCode}
                    </span>
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {result.status === "ALREADY_OPENED" && (
          <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-2xl p-8 text-center">
            <div className="text-5xl mb-4">⚠️</div>
            <h1 className="text-xl font-bold text-amber-900 dark:text-amber-200 mb-2">
              Already Opened
            </h1>
            <p className="text-amber-700 dark:text-amber-300 text-sm leading-relaxed">
              {result.message}
            </p>
            <div className="mt-6 bg-amber-100 dark:bg-amber-900 rounded-xl p-4 text-left text-xs text-amber-800 dark:text-amber-300">
              <div className="flex justify-between">
                <span className="font-medium">First verified</span>
                <span>
                  {new Date(result.firstScan).toLocaleString("en-NG", {
                    timeZone: "Africa/Lagos",
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
            </div>
          </div>
        )}

        {result.status === "FLAGGED" && (
          <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-2xl p-8 text-center">
            <div className="text-5xl mb-4">🚨</div>
            <h1 className="text-xl font-bold text-red-900 dark:text-red-200 mb-2">
              Fraud Alert
            </h1>
            <p className="text-red-700 dark:text-red-300 text-sm leading-relaxed">
              {result.message}
            </p>
          </div>
        )}

        {result.status === "NOT_FOUND" && (
          <div className="bg-gray-100 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-8 text-center">
            <div className="text-5xl mb-4">❌</div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
              Not Found
            </h1>
            <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed">
              {result.message}
            </p>
          </div>
        )}

        <p className="text-center text-xs text-gray-400 dark:text-gray-600 mt-6">
          Powered by VerifyChain Africa
        </p>
      </div>
    </main>
  )
}