import type { NextRequest } from "next/server"
import { handleVerify, preflight } from "@/lib/api-request"

// POST /api/v1/verify/cap: check the code inside a cap. See /developers.
export const POST = (req: NextRequest) => handleVerify(req, "cap")
export const OPTIONS = preflight
