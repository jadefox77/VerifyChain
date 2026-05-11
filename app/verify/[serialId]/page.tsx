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
    : { status: "NOT_FOUND" as const, message: "Invalid or tampered QR code. This product may be counterfeit." }

  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-10 h-10 bg-gray-900 rounded-xl mb-3">
            <span className="text-white text-lg font-bold">V</span>
          </div>
          <p className="text-sm text-gray-500">VerifyChain Africa</p>
        </div>

        <div className={`rounded-2xl border shadow-sm p-8 text-center ${
          result.status === "GENUINE"
            ? "bg-green-50 border-green-200"
            : result.status === "WARNING"
            ? "bg-amber-50 border-amber-200"
            : result.status === "FLAGGED"
            ? "bg-red-50 border-red-200"
            : "bg-gray-50 border-gray-200"
        }`}>
          <div className="text-5xl mb-4">
            {result.status === "GENUINE" && "✅"}
            {result.status === "WARNING" && "⚠️"}
            {result.status === "FLAGGED" && "🚨"}
            {result.status === "NOT_FOUND" && "❌"}
          </div>

          <h1 className={`text-xl font-bold mb-2 ${
            result.status === "GENUINE"
              ? "text-green-800"
              : result.status === "WARNING"
              ? "text-amber-800"
              : result.status === "FLAGGED"
              ? "text-red-800"
              : "text-gray-800"
          }`}>
            {result.status === "GENUINE" && "Genuine Product"}
            {result.status === "WARNING" && "Already Opened"}
            {result.status === "FLAGGED" && "Fraud Alert"}
            {result.status === "NOT_FOUND" && "Not Found"}
          </h1>

          <p className={`text-sm leading-relaxed ${
            result.status === "GENUINE"
              ? "text-green-700"
              : result.status === "WARNING"
              ? "text-amber-700"
              : result.status === "FLAGGED"
              ? "text-red-700"
              : "text-gray-600"
          }`}>
            {result.message}
          </p>

          {result.status !== "GENUINE" && result.status !== "NOT_FOUND" && (
            <div className={`mt-6 rounded-xl p-4 text-left text-xs space-y-2 ${
              result.status === "WARNING"
                ? "bg-amber-100 text-amber-800"
                : "bg-red-100 text-red-800"
            }`}>
              <div className="flex justify-between">
                <span className="font-medium">First scanned</span>
                <span>
                  {new Date(result.firstScan).toLocaleString("en-NG", {
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
              <div className="flex justify-between">
                <span className="font-medium">Serial</span>
                <span className="font-mono">{serialId}</span>
              </div>
            </div>
          )}

          {result.status === "GENUINE" && (
            <div className="mt-6 rounded-xl bg-green-100 p-4 text-left text-xs space-y-2 text-green-800">
              <div className="flex justify-between">
                <span className="font-medium">Verified at</span>
                <span>
                  {new Date(result.firstScan).toLocaleString("en-NG", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="font-medium">Serial</span>
                <span className="font-mono">{serialId}</span>
              </div>
            </div>
          )}
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          Powered by VerifyChain Africa
        </p>
      </div>
    </main>
  )
}