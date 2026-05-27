import { NextResponse } from "next/server"
import { generateCertificatePdfEndpoint } from "@/lib/actions/certificates"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const doc = await generateCertificatePdfEndpoint(id)

  if (!doc) {
    return NextResponse.json({ error: "Certificate not found" }, { status: 404 })
  }

  const chunks: Buffer[] = []
  for await (const chunk of doc) {
    chunks.push(Buffer.from(chunk))
  }
  const pdfBuffer = Buffer.concat(chunks)

  return new NextResponse(pdfBuffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="certificate-${id.slice(0, 8)}.pdf"`,
    },
  })
}
