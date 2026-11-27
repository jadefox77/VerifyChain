// What each manufacturer role can do in the dashboard. Kept free of server
// imports so the sidebar (a client component) can use it too.

export type ManufacturerRole = "MANUFACTURER_ADMIN" | "FACTORY_OPERATOR" | "DISTRIBUTOR_MANAGER"

export type Capability =
  | "viewProducts"
  | "manageProducts"
  | "viewBatches"
  | "createBatches"
  | "exportBatches"
  | "viewScans"
  | "viewFraud"
  | "viewBilling"
  | "manageTeam"

export const MANUFACTURER_ROLE_LIST: ManufacturerRole[] = [
  "MANUFACTURER_ADMIN",
  "FACTORY_OPERATOR",
  "DISTRIBUTOR_MANAGER",
]

const CAPABILITIES: Record<ManufacturerRole, Capability[]> = {
  // Everything, including the plan and the team.
  MANUFACTURER_ADMIN: [
    "viewProducts",
    "manageProducts",
    "viewBatches",
    "createBatches",
    "exportBatches",
    "viewScans",
    "viewFraud",
    "viewBilling",
    "manageTeam",
  ],
  // The production line: make batches and download their QR files.
  FACTORY_OPERATOR: ["viewProducts", "viewBatches", "createBatches", "exportBatches", "viewScans"],
  // Distribution: read-only view of batches, scans and fraud alerts.
  DISTRIBUTOR_MANAGER: ["viewProducts", "viewBatches", "viewScans", "viewFraud"],
}

export function isManufacturerRole(role: string | null | undefined): role is ManufacturerRole {
  return MANUFACTURER_ROLE_LIST.includes(role as ManufacturerRole)
}

export function can(role: string | null | undefined, capability: Capability): boolean {
  if (!isManufacturerRole(role)) return false
  return CAPABILITIES[role].includes(capability)
}

export const TEAM_ROLE_LABELS: Record<ManufacturerRole, string> = {
  MANUFACTURER_ADMIN: "Admin",
  FACTORY_OPERATOR: "Factory operator",
  DISTRIBUTOR_MANAGER: "Distributor manager",
}

export const TEAM_ROLE_DESCRIPTIONS: Record<ManufacturerRole, string> = {
  MANUFACTURER_ADMIN: "Everything, including the plan and the team.",
  FACTORY_OPERATOR: "Products, batches and scans. Can make batches and download QR files.",
  DISTRIBUTOR_MANAGER: "Read-only view of products, batches, scans and fraud alerts.",
}
