// ── Batch naming utilities ────────────────────────────────────────────────────
// Pure functions — no server actions, no async

export function makeManufacturerCode(companyName: string): string {
  return companyName
    .replace(/[^a-zA-Z0-9]/g, "")
    .toUpperCase()
    .slice(0, 6)
}

export function makeBatchZipName(
  companyName: string,
  productName: string,
  batchCode: string
): string {
  const mfr = makeManufacturerCode(companyName)
  const product = productName
    .replace(/[^a-zA-Z0-9]/g, "")
    .slice(0, 12)
  const date = new Date().toISOString().split("T")[0]
  return `VC_${mfr}_${product}_${batchCode}_${date}`
}

export function makeCsvName(
  companyName: string,
  productName: string,
  batchCode: string
): string {
  return `${makeBatchZipName(companyName, productName, batchCode)}_serials.csv`
}