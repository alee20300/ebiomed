import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { requireApiScope } from "@/lib/api/auth"

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiScope(request, "read", "fhir")
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("equipment")
    .select("*, certificates!inner(certificate_number, issued_at, valid_until, status)")
    .eq("id", id)
    .is("deleted_at", null)
    .eq("certificates.status", "valid")
    .single()

  if (!data) {
    // Fallback: try without active certificate filter
    const { data: equip } = await supabase
      .from("equipment")
      .select("*")
      .eq("id", id)
      .is("deleted_at", null)
      .single()

    if (!equip) {
      return NextResponse.json({ error: "Device not found" }, { status: 404 })
    }

    const fhirDevice = buildFhirDevice(equip, null)
    return NextResponse.json(fhirDevice)
  }

  const lastCert = Array.isArray(data.certificates) ? data.certificates[0] : null
  const fhirDevice = buildFhirDevice(data, lastCert)

  return NextResponse.json(fhirDevice)
}

function buildFhirDevice(equipment: Record<string, unknown>, lastCert: Record<string, unknown> | null): Record<string, unknown> {
  return {
    resourceType: "Device",
    id: equipment.id,
    identifier: [
      {
        system: "urn:ebiomed:tag_number",
        value: equipment.tag_number,
      },
      {
        system: "urn:ebiomed:serial_number",
        value: equipment.serial_number || null,
      },
      ...(equipment.udi_di ? [{
        system: "urn:ebiomed:udi_di",
        value: equipment.udi_di,
      }] : []),
    ],
    deviceName: [
      {
        name: equipment.name,
        type: "user-friendly-name",
      },
      {
        name: equipment.model,
        type: "model-name",
      },
    ].filter((d) => d.name),
    manufacturer: equipment.manufacturer || null,
    type: equipment.category ? {
      text: equipment.category,
    } : undefined,
    status: mapStatusToFhir(equipment.status as string),
    location: equipment.location ? {
      display: equipment.location,
    } : undefined,
    note: lastCert ? [{
      text: `Last calibrated: ${lastCert.issued_at}. Certificate: ${lastCert.certificate_number}. Valid until: ${lastCert.valid_until}.`,
    }] : undefined,
    extension: [
      {
        url: "http://ebiomed/fhir/StructureDefinition/calibration-status",
        valueString: equipment.status,
      },
      {
        url: "http://ebiomed/fhir/StructureDefinition/last-calibrated",
        valueDateTime: equipment.last_calibrated,
      },
    ],
  }
}

function mapStatusToFhir(status: string): string {
  switch (status) {
    case "active":
    case "certified":
      return "active"
    case "inactive":
    case "retired":
      return "inactive"
    case "under_repair":
    case "out_of_tolerance":
      return "entered-in-error"
    default:
      return "unknown"
  }
}
