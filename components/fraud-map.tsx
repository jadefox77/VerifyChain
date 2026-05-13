"use client"

import { useEffect, useRef } from "react"

type MapPoint = {
  lat: number
  lng: number
  fraudFlag: boolean
}

export function FraudMap({ points }: { points: MapPoint[] }) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<unknown>(null)

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return

    // Dynamically import leaflet to avoid SSR issues
    import("leaflet").then((L) => {
      import("leaflet/dist/leaflet.css")

      if (!mapRef.current) return

      // Center on Nigeria
      const map = L.map(mapRef.current).setView([9.082, 8.6753], 6)

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap contributors",
      }).addTo(map)

      points.forEach((point) => {
        const color = point.fraudFlag ? "#ef4444" : "#22c55e"

        L.circleMarker([point.lat, point.lng], {
          radius: 8,
          fillColor: color,
          color: "#fff",
          weight: 1.5,
          opacity: 1,
          fillOpacity: 0.8,
        }).addTo(map)
      })

      mapInstanceRef.current = map
    })

    return () => {
      if (mapInstanceRef.current) {
        const map = mapInstanceRef.current as { remove: () => void }
        map.remove()
        mapInstanceRef.current = null
      }
    }
  }, [points])

  return (
    <div
      ref={mapRef}
      className="w-full h-80 z-0"
      style={{ minHeight: "320px" }}
    />
  )
}