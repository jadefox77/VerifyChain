"use client"

import { useEffect, useRef } from "react"

type ScanPoint = {
  lat: number
  lng: number
  fraudFlag: boolean
  region?: string | null
}

type FraudMapProps = {
  scanPoints: ScanPoint[]
}

export function FraudMap({ scanPoints }: FraudMapProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<any>(null)

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return

    // Dynamically import leaflet to avoid SSR issues
    import("leaflet").then((L) => {
      // Fix default marker icon paths broken by webpack
      delete (L.Icon.Default.prototype as any)._getIconUrl
      L.Icon.Default.mergeOptions({
        iconRetinaUrl:
          "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        iconUrl:
          "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        shadowUrl:
          "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      })

      const map = L.map(mapRef.current!, {
        center: [9.082, 8.6753], // Nigeria center
        zoom: 6,
        zoomControl: true,
        attributionControl: false,
      })

      // Dark tile layer from CartoDB
      L.tileLayer(
        "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
        { subdomains: "abcd", maxZoom: 19 }
      ).addTo(map)

      // Plot scan points
      scanPoints.forEach((point) => {
        const color = point.fraudFlag ? "#ef4444" : "#22c55e"
        const radius = point.fraudFlag ? 8 : 5

        const circle = L.circleMarker([point.lat, point.lng], {
          radius,
          fillColor: color,
          fillOpacity: point.fraudFlag ? 0.8 : 0.4,
          color: color,
          weight: point.fraudFlag ? 2 : 1,
          opacity: 0.9,
        })

        circle.bindPopup(
          `<div style="font-family: monospace; font-size: 11px; color: #111;">
            <strong>${point.fraudFlag ? "⚠ FRAUD" : "✓ Genuine"}</strong><br/>
            Region: ${point.region ?? "Unknown"}<br/>
            ${point.lat.toFixed(4)}, ${point.lng.toFixed(4)}
          </div>`
        )

        circle.addTo(map)
      })

      mapInstanceRef.current = map
    })

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove()
        mapInstanceRef.current = null
      }
    }
  }, [scanPoints])

  return (
    <>
      <link
        rel="stylesheet"
        href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
      />
      <div
        ref={mapRef}
        className="w-full h-full rounded-lg overflow-hidden"
        style={{ minHeight: "400px" }}
      />
    </>
  )
}