import type { NextRequest } from "next/server"
import { handleVerify, preflight } from "@/lib/api-request"

// POST /api/v1/verify: check a bottle label or single code. See /developers.
export const POST = (req: NextRequest) => handleVerify(req, "bottle")
export const OPTIONS = preflight
