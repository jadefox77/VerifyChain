import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

// Serves brand logos and product pictures to the scan pages. Images are
// public by design (they appear on every scan of the brand's products). A new
// upload always gets a new id, so responses can be cached for a long time.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!/^[a-z0-9]{20,32}$/i.test(id)) return new NextResponse(null, { status: 404 })

  const image = await prisma.brandImage.findUnique({
    where: { id },
    select: { contentType: true, data: true },
  })
  if (!image) return new NextResponse(null, { status: 404 })

  return new NextResponse(new Uint8Array(image.data), {
    headers: {
      "Content-Type": image.contentType,
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
    },
  })
}
