import { NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/actions/profiles"
import {
  buildAssetPacketCsv,
  buildAssetPacketPdf,
  buildAssetPacketZip,
  getAssetAuditPacket,
} from "@/lib/compliance/asset-packet"

export const dynamic = "force-dynamic"

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser()
  if (!user || user.role === "viewer") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params
  const packet = await getAssetAuditPacket(id)
  if (!packet) {
    return NextResponse.json({ error: "Asset not found" }, { status: 404 })
  }

  const { searchParams } = new URL(request.url)
  const format = searchParams.get("format") || "zip"
  const filename = `asset-auditor-packet-${packet.asset.tag_number}-${packet.generatedAt.slice(0, 10)}`

  if (format === "pdf") {
    return new NextResponse(await buildAssetPacketPdf(packet), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}.pdf"`,
      },
    })
  }

  if (format === "csv") {
    return new NextResponse(buildAssetPacketCsv(packet), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}.csv"`,
      },
    })
  }

  return new NextResponse(await buildAssetPacketZip(packet), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${filename}.zip"`,
    },
  })
}
