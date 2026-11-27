// Nigerian states used for distribution regions and batch target regions.
// The FCT is stored as "Abuja" so it lines up with the coordinates the
// fraud checks use for supply chain drift.
export const NIGERIAN_STATES: { value: string; label: string }[] = [
  "Abia", "Adamawa", "Akwa Ibom", "Anambra", "Bauchi", "Bayelsa",
  "Benue", "Borno", "Cross River", "Delta", "Ebonyi", "Edo",
  "Ekiti", "Enugu", "Abuja", "Gombe", "Imo", "Jigawa",
  "Kaduna", "Kano", "Katsina", "Kebbi", "Kogi", "Kwara",
  "Lagos", "Nasarawa", "Niger", "Ogun", "Ondo", "Osun",
  "Oyo", "Plateau", "Rivers", "Sokoto", "Taraba", "Yobe", "Zamfara",
].map((s) => ({ value: s, label: s === "Abuja" ? "FCT (Abuja)" : s }))

export const INDUSTRY_TYPES = [
  "Beer",
  "Soft drinks",
  "Bottled water",
  "Energy drinks",
  "Spirits and alcoholic drinks",
  "Dairy",
  "Food and consumables",
  "Other",
]
