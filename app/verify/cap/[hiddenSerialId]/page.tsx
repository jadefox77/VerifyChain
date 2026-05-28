import { verifyCap } from "@/lib/verify-cap"
import { verifySignature } from "@/lib/serial"
import type { CapVerifyResult } from "@/lib/verify-cap"

type RenderInput =
  | CapVerifyResult
  | { status: "NOT_FOUND"; message: string }

function renderResult(result: RenderInput) {
  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-10 h-10 bg-gray-900 dark:bg-white rounded-xl mb-3">
            <span className="text-white dark:text-gray-900 text-lg font-bold">
              V
            </span>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            VerifyChain Africa
          </p>
        </div>

        {/* GENUINE */}
        {result.status === "GENUINE" && (
          <div className="bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-2xl p-8 text-center">
            <div className="text-5xl mb-4">✅</div>
            <h1 className="text-xl font-bold text-green-900 dark:text-green-200 mb-2">
              Genuine Product
            </h1>
            <p className="text-green-700 dark:text-green-300 text-sm leading-relaxed mb-6">
              {result.message}
            </p>
            <div className="bg-green-100 dark:bg-green-900 rounded-xl p-4 text-left text-xs space-y-2 text-green-800 dark:text-green-300">
              <div className="flex justify-between">
                <span className="font-medium">Product</span>
                <span>{result.productName}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-medium">Verified at</span>
                <span>
                  {new Date(result.openedAt).toLocaleString("en-NG", {
                    timeZone: "Africa/Lagos",
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="font-medium">Authentication</span>
                <span className="text-green-600 dark:text-green-400 font-semibold">
                  Triple-layer confirmed ✓
                </span>
              </div>
            </div>
          </div>
        )}

        {/* WARNING — already opened */}
        {result.status === "WARNING" && (
          <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-2xl p-8 text-center">
            <div className="text-5xl mb-4">⚠️</div>
            <h1 className="text-xl font-bold text-amber-900 dark:text-amber-200 mb-2">
              Cap Already Opened
            </h1>
            <p className="text-amber-700 dark:text-amber-300 text-sm leading-relaxed">
              {result.message}
            </p>
            <div className="mt-6 bg-amber-100 dark:bg-amber-900 rounded-xl p-4 text-left text-xs text-amber-800 dark:text-amber-300 space-y-2">
              <div className="flex justify-between">
                <span className="font-medium">First opened</span>
                <span>
                  {new Date(result.firstOpened).toLocaleString("en-NG", {
                    timeZone: "Africa/Lagos",
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
              {result.firstLocation && (
                <div className="flex justify-between">
                  <span className="font-medium">First location</span>
                  <span>{result.firstLocation}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* MISMATCH */}
        {result.status === "MISMATCH" && (
          <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-2xl p-8 text-center">
            <div className="text-5xl mb-4">🚨</div>
            <h1 className="text-xl font-bold text-red-900 dark:text-red-200 mb-2">
              Identity Mismatch
            </h1>
            <p className="text-red-700 dark:text-red-300 text-sm leading-relaxed">
              {result.message}
            </p>
          </div>
        )}

        {/* FLAGGED */}
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

        {/* NOT FOUND */}
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

export default async function CapVerifyPage({
  params,
  searchParams,
}: {
  params: Promise<{ hiddenSerialId: string }>
  searchParams: Promise<{ sig?: string; bottle?: string }>
}) {
  const { hiddenSerialId } = await params
  const { sig, bottle } = await searchParams

  const signatureValid = sig ? verifySignature(hiddenSerialId, sig) : false

  if (!signatureValid) {
    return renderResult({
      status: "NOT_FOUND",
      message:
        "Invalid or tampered QR code. This product may be counterfeit.",
    })
  }

  if (!bottle) {
    return renderResult({
      status: "NOT_FOUND",
      message:
        "Incomplete verification. Please scan the bottle QR code first, then scan the cap QR inside.",
    })
  }

  const result = await verifyCap({
    hiddenSerialId,
    bottleSerialId: bottle,
  })

  return renderResult(result)
}