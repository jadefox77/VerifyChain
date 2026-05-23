"use client"

import dynamic from "next/dynamic"

type ScanPoint = {
  lat: number
  lng: number
  fraudFlag: boolean
  region?: string | null
}

const FraudMapClient = dynamic(
  () => import("@/components/admin/fraud-map").then((m) => m.FraudMap),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full min-h-[400px] bg-gray-900/60 rounded-lg flex items-center justify-center">
        <p className="text-xs font-mono text-gray-600">Loading map...</p>
      </div>
    ),
  }
)

export function FraudMapWrapper({ scanPoints }: { scanPoints: ScanPoint[] }) {
  return <FraudMapClient scanPoints={scanPoints} />
}