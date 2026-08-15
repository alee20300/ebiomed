"use server"

import { createClient } from "@/lib/supabase/server"
import { getCurrentUser } from "@/lib/actions/profiles"
import { logAudit } from "@/lib/actions/audit"
import { hasPermission } from "@/lib/actions/permissions"
import { recordSignature, verifyPassword } from "@/lib/actions/signatures"
import {
  buildCertificateNumber,
  calculateCertificateValidUntil,
  computeAuditTrailHash,
} from "@/lib/utils/certificates"
import type { Certificate, CalibrationReading } from "@/lib/types"

export async function generateCertificate(
  equipmentId: string,
  calibrationWorkOrderId: string | null,
  options: { reason: string; reauthPassword: string }
): Promise<{ success: boolean; certificateId?: string; error?: string }> {
  const supabase = await createClient()
  const user = await getCurrentUser()
  if (!user) return { success: false, error: "Not authenticated" }
  if (!await hasPermission({ action: "issue", resource: "certificates" })) {
    return { success: false, error: "You do not have permission to issue certificates" }
  }
  if (!options.reason.trim()) return { success: false, error: "Certificate issue reason is required" }

  const verified = options.reauthPassword.length > 0 && await verifyPassword(options.reauthPassword)
  if (!verified) return { success: false, error: "Re-authentication is required to issue a certificate" }

  // Get equipment
  const { data: equipment } = await supabase
    .from("equipment")
    .select("*")
    .eq("id", equipmentId)
    .single()

  if (!equipment) return { success: false, error: "Equipment not found" }

  // Get calibration readings
  const { data: readings } = await supabase
    .from("calibration_readings")
    .select("*, reference_standard:reference_standard_id(*)")
    .eq("equipment_id", equipmentId)
    .order("recorded_at", { ascending: false })
    .limit(50)

  // Get environmental reading
  const { data: envReading } = await supabase
    .from("environmental_readings")
    .select("*")
    .eq("equipment_id", equipmentId)
    .order("recorded_at", { ascending: false })
    .limit(1)
    .single()

  // Get audit trail for this equipment's calibration
  const { data: auditEntries } = await supabase
    .from("audit_log")
    .select("*")
    .eq("table_name", "equipment")
    .eq("record_id", equipmentId)
    .order("changed_at", { ascending: false })
    .limit(20)

  // Generate certificate number
  const issuedAt = new Date()
  const year = issuedAt.getFullYear()
  const { count } = await supabase
    .from("certificates")
    .select("*", { count: "exact", head: true })

  const certNumber = buildCertificateNumber(year, count || 0)

  // Compute audit trail hash
  const auditHash = computeAuditTrailHash({ equipment_id: equipmentId, readings, auditEntries })

  // Compute valid_until based on calibration interval
  const intervalDays = equipment.calibration_interval_days || 365
  const validUntil = calculateCertificateValidUntil(issuedAt, intervalDays)

  // Generate PDF
  const pdfUrl = await generateCertificatePdf({
    certNumber,
    equipment,
    readings: (readings || []) as CalibrationReading[],
    envReading,
    auditHash,
    issuedBy: user.full_name,
    issuedAt: issuedAt.toISOString(),
    validUntil: validUntil.toISOString(),
    intervalDays,
  })

  // Insert certificate record
  const { data: cert, error } = await supabase
    .from("certificates")
    .insert({
      equipment_id: equipmentId,
      certificate_number: certNumber,
      calibration_work_order_id: calibrationWorkOrderId,
      audit_trail_hash: auditHash,
      pdf_url: pdfUrl,
      issued_by: user.id,
      valid_until: validUntil.toISOString(),
    })
    .select("id")
    .single()

  if (error) return { success: false, error: error.message }

  // Update equipment status to certified
  await supabase
    .from("equipment")
    .update({ status: "certified", last_calibrated: issuedAt.toISOString() })
    .eq("id", equipmentId)

  await logAudit("certificates", cert.id, "insert", [
    { newValue: JSON.stringify({ certificate_number: certNumber, audit_trail_hash: auditHash }) }
  ], options.reason)

  await recordSignature("certificate", cert.id, "Approved", options.reason, auditHash)

  return { success: true, certificateId: cert.id }
}

export async function revokeCertificate(certificateId: string, formData: FormData) {
  const supabase = await createClient()
  const user = await getCurrentUser()
  if (!user) return { success: false, error: "Not authenticated" }
  if (!await hasPermission({ action: "revoke", resource: "certificates" })) {
    return { success: false, error: "You do not have permission to revoke certificates" }
  }

  const reason = String(formData.get("reason") || "").trim()
  const password = String(formData.get("reauth_password") || "")
  if (reason.length < 5) return { success: false, error: "Revocation reason is required" }

  const verified = password.length > 0 && await verifyPassword(password)
  if (!verified) return { success: false, error: "Re-authentication is required to revoke a certificate" }

  const { data: cert } = await supabase
    .from("certificates")
    .select("id, equipment_id, audit_trail_hash")
    .eq("id", certificateId)
    .single()

  if (!cert) return { success: false, error: "Certificate not found" }

  const { data: revocation, error } = await supabase
    .from("certificate_revocations")
    .insert({
      certificate_id: certificateId,
      revoked_by: user.id,
      reason,
    })
    .select("id")
    .single()

  if (error) return { success: false, error: error.message }

  await logAudit("certificate_revocations", revocation.id, "insert", [
    { newValue: JSON.stringify({ certificate_id: certificateId }) },
  ], reason)

  await recordSignature("certificate", certificateId, "Approved", reason, cert.audit_trail_hash)

  return { success: true }
}

async function generateCertificatePdf(params: {
  certNumber: string
  equipment: Record<string, unknown>
  readings: CalibrationReading[]
  envReading: Record<string, unknown> | null
  auditHash: string
  issuedBy: string
  issuedAt: string
  validUntil: string
  intervalDays: number
}): Promise<string | null> {
  // Certificate is generated with a hash and stored as structured data;
  // PDF generation via pdfmake is deferred to a separate endpoint
  // to keep bundle size minimal. The certificate record serves as the
  // primary compliance artifact.
  return null
}

export async function getCertificates(equipmentId: string): Promise<Certificate[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from("certificates")
    .select("*, equipment:equipment_id(name, tag_number), issuer:issued_by(full_name, role)")
    .eq("equipment_id", equipmentId)
    .order("issued_at", { ascending: false })

  return (data || []) as unknown as Certificate[]
}

export async function getExpiringCertificates(daysWithin: number = 30): Promise<Certificate[]> {
  const supabase = await createClient()
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() + daysWithin)

  const { data } = await supabase
    .from("certificates")
    .select("*, equipment:equipment_id(name, tag_number)")
    .eq("status", "valid")
    .lte("valid_until", cutoff.toISOString())
    .order("valid_until", { ascending: true })

  return (data || []) as unknown as Certificate[]
}

export async function generateCertificatePdfEndpoint(certificateId: string) {
  const supabase = await createClient()

  const { data: cert } = await supabase
    .from("certificates")
    .select("*, equipment:equipment_id(*), issuer:issued_by(full_name, role)")
    .eq("id", certificateId)
    .single()

  if (!cert) return null

  const { data: readings } = await supabase
    .from("calibration_readings")
    .select("*, reference_standard:reference_standard_id(*)")
    .eq("equipment_id", cert.equipment_id)
    .order("recorded_at", { ascending: false })
    .limit(50)

  // Dynamic import of pdfmake to avoid bundling in all server actions
  const PdfPrinter = (await import("pdfmake")).default
  const fonts = {
    Helvetica: {
      normal: "Helvetica",
      bold: "Helvetica-Bold",
      italics: "Helvetica-Oblique",
      bolditalics: "Helvetica-BoldOblique",
    },
  }

  const printer = new PdfPrinter(fonts)

  const equip = cert.equipment as Record<string, unknown>
  const issuer = cert.issuer as Record<string, unknown>

  const docDefinition = {
    pageSize: "A4" as const,
    pageMargins: [50, 60, 50, 60] as [number, number, number, number],
    info: {
      title: `Certificate of Calibration — ${cert.certificate_number}`,
      author: issuer?.full_name as string || "eBiomed",
      subject: "Calibration Certificate",
    },
    watermark: { text: cert.certificate_number, opacity: 0.03, bold: true, fontSize: 72 },
    content: [
      // Header
      { text: "CERTIFICATE OF CALIBRATION & COMPLIANCE", style: "header" },
      { text: `Certificate #${cert.certificate_number}`, style: "subheader" },
      { text: "Issued in accordance with ISO 15189 / 17025 requirements", style: "subtitle" },
      { canvas: [{ type: "line", x1: 0, y1: 10, x2: 515.28, y2: 10, lineWidth: 1, lineColor: "#2563eb" }], margin: [0, 10, 0, 10] },

      // Equipment Details
      { text: "Equipment Details", style: "sectionHeader" },
      {
        table: {
          widths: ["*", "*"],
          body: [
            [{ text: "Equipment Name", style: "label" }, { text: equip.name || "", style: "value" }],
            [{ text: "Tag Number", style: "label" }, { text: equip.tag_number || "", style: "value" }],
            [{ text: "Model", style: "label" }, { text: equip.model || "N/A", style: "value" }],
            [{ text: "Manufacturer", style: "label" }, { text: equip.manufacturer || "N/A", style: "value" }],
            [{ text: "Serial Number", style: "label" }, { text: equip.serial_number || "N/A", style: "value" }],
            [{ text: "Department", style: "label" }, { text: equip.department || "N/A", style: "value" }],
            [{ text: "Location", style: "label" }, { text: equip.location || "N/A", style: "value" }],
          ],
        },
        layout: "noBorders",
      },

      { text: "", margin: [0, 10] },

      // Calibration Readings
      { text: "Calibration Readings", style: "sectionHeader" },
      {
        table: {
          headerRows: 1,
          widths: ["auto", "auto", "auto", "auto", "auto"],
          body: [
            [{ text: "Parameter", style: "tableHeader" }, { text: "Measured", style: "tableHeader" }, { text: "Expected", style: "tableHeader" }, { text: "Tolerance", style: "tableHeader" }, { text: "Result", style: "tableHeader" }],
            ...((readings || []) as CalibrationReading[]).map((r) => [
              { text: `${r.parameter}${r.unit ? ` (${r.unit})` : ""}` },
              { text: String(r.measured_value) },
              { text: String(r.expected_value) },
              { text: `${r.tolerance_min} – ${r.tolerance_max}` },
              { text: r.passed ? "PASS" : "FAIL", color: r.passed ? "#16a34a" : "#dc2626", bold: true },
            ]),
          ],
        },
      },

      { text: "", margin: [0, 10] },

      // Reference Standard
      ...(readings && readings.length > 0 && readings[0].reference_standard ? [
        { text: "Reference Standard Used", style: "sectionHeader" },
        {
          table: {
            widths: ["*", "*"],
            body: [
              [{ text: "Name", style: "label" }, { text: readings[0].reference_standard.name, style: "value" }],
              [{ text: "Serial Number", style: "label" }, { text: readings[0].reference_standard.serial_number, style: "value" }],
              [{ text: "Certificate Number", style: "label" }, { text: readings[0].reference_standard.certificate_number || "N/A", style: "value" }],
            ],
          },
          layout: "noBorders",
        },
      ] : []),

      { text: "", margin: [0, 10] },

      // Environmental Conditions
      ...(cert as Record<string, unknown>).envReading ? [
        { text: "Environmental Conditions", style: "sectionHeader" },
        { text: `Temperature: ${(cert as Record<string, unknown>).envTemperature || "N/A"}°C  |  Humidity: ${(cert as Record<string, unknown>).envHumidity || "N/A"}%`, style: "value" },
      ] : [],

      // Audit Trail Hash
      { canvas: [{ type: "line", x1: 0, y1: 10, x2: 515.28, y2: 10, lineWidth: 0.5, lineColor: "#cccccc" }], margin: [0, 15, 0, 10] },
      { text: "Digital Attestation", style: "sectionHeader" },
      {
        text: [
          { text: "Audit Trail Hash (SHA-256): ", style: "label" },
          { text: cert.audit_trail_hash, style: "hash" },
        ],
      },
      { text: "This certificate is cryptographically bound to the immutable audit trail. Any tampering with the underlying records will invalidate this hash.", style: "subtitle" },

      // Signature Block
      { canvas: [{ type: "line", x1: 0, y1: 10, x2: 515.28, y2: 10, lineWidth: 0.5, lineColor: "#cccccc" }], margin: [0, 15, 0, 10] },
      { text: "Electronic Signature", style: "sectionHeader" },
      { text: `Electronically signed by ${issuer?.full_name || "Unknown"} on ${new Date(cert.issued_at).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })} at ${new Date(cert.issued_at).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}`, style: "value" },
      { text: `Role: ${issuer?.role || "N/A"}  |  Meaning: Calibrated`, style: "subtitle" },

      // Footer
      { text: "", margin: [0, 20] },
      { text: `Certificate issued: ${new Date(cert.issued_at).toISOString().slice(0, 10)}  |  Valid until: ${new Date(cert.valid_until).toISOString().slice(0, 10)}`, style: "footer" },
      { text: "eBiomed — Healthcare Certificate Electronic Maintenance Management System", style: "footerSmall" },
    ],
    styles: {
      header: { fontSize: 22, bold: true, color: "#2563eb", alignment: "center", margin: [0, 0, 0, 5] },
      subheader: { fontSize: 14, bold: true, alignment: "center", margin: [0, 0, 0, 2] },
      subtitle: { fontSize: 8, color: "#6b7280", alignment: "center", margin: [0, 0, 0, 5] },
      sectionHeader: { fontSize: 12, bold: true, color: "#1f2937", margin: [0, 8, 0, 4] },
      label: { fontSize: 9, color: "#6b7280" },
      value: { fontSize: 9, color: "#1f2937" },
      tableHeader: { fontSize: 8, bold: true, color: "#6b7280", fillColor: "#f3f4f6" },
      hash: { fontSize: 6, font: "Courier", color: "#9ca3af" },
      footer: { fontSize: 8, color: "#6b7280", alignment: "center" },
      footerSmall: { fontSize: 7, color: "#9ca3af", alignment: "center" },
    },
  }

  return printer.createPdfKitDocument(docDefinition)
}
