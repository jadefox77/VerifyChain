// =============================================================================
// Nigerian regions: one shared list of coordinates for the live cap check and
// the daily fraud pipeline. Keys match the values the batch form saves (see
// NIGERIAN_STATES in lib/nigeria.ts), so all 37 states and the FCT are covered.
// Coordinates are each state capital (approximate).
// =============================================================================

type Coords = { lat: number; lng: number }

const STATE_COORDS: Record<string, Coords> = {
  "Abia": { lat: 5.525, lng: 7.4922 },          // Umuahia
  "Adamawa": { lat: 9.2035, lng: 12.4954 },     // Yola
  "Akwa Ibom": { lat: 5.0377, lng: 7.9128 },    // Uyo
  "Anambra": { lat: 6.212, lng: 7.0715 },       // Awka
  "Bauchi": { lat: 10.3158, lng: 9.8442 },
  "Bayelsa": { lat: 4.9267, lng: 6.2676 },      // Yenagoa
  "Benue": { lat: 7.7322, lng: 8.5391 },        // Makurdi
  "Borno": { lat: 11.8333, lng: 13.151 },       // Maiduguri
  "Cross River": { lat: 4.9757, lng: 8.3417 },  // Calabar
  "Delta": { lat: 6.198, lng: 6.7319 },         // Asaba
  "Ebonyi": { lat: 6.3249, lng: 8.1137 },       // Abakaliki
  "Edo": { lat: 6.335, lng: 5.6037 },           // Benin City
  "Ekiti": { lat: 7.6233, lng: 5.2209 },        // Ado-Ekiti
  "Enugu": { lat: 6.4584, lng: 7.5464 },
  "Abuja": { lat: 9.0765, lng: 7.3986 },        // FCT
  "Gombe": { lat: 10.2897, lng: 11.1673 },
  "Imo": { lat: 5.484, lng: 7.0351 },           // Owerri
  "Jigawa": { lat: 11.7562, lng: 9.3388 },      // Dutse
  "Kaduna": { lat: 10.5264, lng: 7.4384 },
  "Kano": { lat: 12.0022, lng: 8.592 },
  "Katsina": { lat: 12.9908, lng: 7.6018 },
  "Kebbi": { lat: 12.4539, lng: 4.1975 },       // Birnin Kebbi
  "Kogi": { lat: 7.8023, lng: 6.7333 },         // Lokoja
  "Kwara": { lat: 8.4966, lng: 4.5421 },        // Ilorin
  "Lagos": { lat: 6.5244, lng: 3.3792 },
  "Nasarawa": { lat: 8.4939, lng: 8.515 },      // Lafia
  "Niger": { lat: 9.6139, lng: 6.5569 },        // Minna
  "Ogun": { lat: 7.1475, lng: 3.3619 },         // Abeokuta
  "Ondo": { lat: 7.2571, lng: 5.2058 },         // Akure
  "Osun": { lat: 7.7827, lng: 4.5418 },         // Osogbo
  "Oyo": { lat: 7.3775, lng: 3.947 },           // Ibadan
  "Plateau": { lat: 9.8965, lng: 8.8583 },      // Jos
  "Rivers": { lat: 4.8156, lng: 7.0498 },       // Port Harcourt
  "Sokoto": { lat: 13.0059, lng: 5.2476 },
  "Taraba": { lat: 8.8937, lng: 11.3596 },      // Jalingo
  "Yobe": { lat: 11.747, lng: 11.9608 },        // Damaturu
  "Zamfara": { lat: 12.1628, lng: 6.6614 },     // Gusau
}

// Other spellings of the FCT that may be saved on older batches.
const ALIASES: Record<string, string> = {
  FCT: "Abuja",
  "FCT (Abuja)": "Abuja",
  "FCT - Abuja": "Abuja",
}

export function regionCoords(region: string | null | undefined): Coords | null {
  if (!region) return null
  const trimmed = region.trim()
  const key = ALIASES[trimmed] ?? trimmed
  return STATE_COORDS[key] ?? null
}

export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// Distance from a scan to its batch's target region.
export const DRIFT_RADIUS_KM = 300

// One out-of-region open is recorded and reported but still passes, because
// stock moves between states and phone location is approximate. A product is
// only hard-flagged once this many other bottles of the same batch have been
// opened outside the area within DRIFT_WINDOW_DAYS. Resolving the batch's
// drift alert restarts the count.
export const DRIFT_HARD_FLAG_BOTTLES = 10
export const DRIFT_WINDOW_DAYS = 30
