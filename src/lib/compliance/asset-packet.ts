import PdfPrinter from "pdfmake"
import { createHash } from "crypto"
import { createClient } from "@/lib/supabase/server"
import type { AuditLogEntry, Certificate, CommissioningRecord, CybersecurityAssessment, DecommissioningRecord, Equipment, Signature, WorkOrder } from "@/lib/types"

type TableRow = Array<string | number | boolean | null | undefined>

export interface AssetAuditPacket {
  generatedAt: string
  asset: Equipment
  assetHistory: AuditLogEntry[]
  workOrders: WorkOrder[]
  cybersecurityAssessments: CybersecurityAssessment[]
  commissioningRecords: CommissioningRecord[]
  decommissioningRecords: DecommissioningRecord[]
  pmEvidence: unknown[]
  calibrationReadings: unknown[]
  certificates: Certificate[]
  certificateRevocations: unknown[]
  signatures: Signature[]
  photos: unknown[]
  documents: unknown[]
  partsAndTime: unknown[]
}

export interface AssetPacketManifest {
  generatedAt: string
  assetId: string
  assetTag: string
  counts: Record<string, number>
  hashes: Record<string, string>
}

const fontPath = "node_modules/pdfmake/fonts/Roboto"

function csvCell(value: string | number | boolean | null | undefined) {
  const text = String(value ?? "")
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`
  return text
}

function csvRows(rows: TableRow[]) {
  return rows.map((row) => row.map(csvCell).join(",")).join("\n")
}

function value(record: unknown, key: string) {
  return (record as Record<string, unknown> | null)?.[key] as string | number | null | undefined
}

function sectionCsv(title: string, headers: string[], rows: TableRow[]) {
  return csvRows([[title], [], headers, ...rows])
}

function crc32(buffer: Buffer) {
  let crc = ~0
  for (const byte of buffer) {
    crc ^= byte
    for (let index = 0; index < 8; index += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1))
    }
  }
  return ~crc >>> 0
}

function zip(files: Array<{ name: string; content: string | Buffer }>) {
  const chunks: Buffer[] = []
  const central: Buffer[] = []
  let offset = 0

  for (const file of files) {
    const name = Buffer.from(file.name)
    const content = Buffer.isBuffer(file.content) ? file.content : Buffer.from(file.content)
    const crc = crc32(content)
    const local = Buffer.alloc(30)
    local.writeUInt32LE(0x04034b50, 0)
    local.writeUInt16LE(20, 4)
    local.writeUInt16LE(0, 6)
    local.writeUInt16LE(0, 8)
    local.writeUInt32LE(0, 10)
    local.writeUInt32LE(crc, 14)
    local.writeUInt32LE(content.length, 18)
    local.writeUInt32LE(content.length, 22)
    local.writeUInt16LE(name.length, 26)
    chunks.push(local, name, content)

    const header = Buffer.alloc(46)
    header.writeUInt32LE(0x02014b50, 0)
    header.writeUInt16LE(20, 4)
    header.writeUInt16LE(20, 6)
    header.writeUInt32LE(0, 8)
    header.writeUInt32LE(crc, 16)
    header.writeUInt32LE(content.length, 20)
    header.writeUInt32LE(content.length, 24)
    header.writeUInt16LE(name.length, 28)
    header.writeUInt32LE(offset, 42)
    central.push(header, name)
    offset += local.length + name.length + content.length
  }

  const centralOffset = offset
  const centralBuffer = Buffer.concat(central)
  const end = Buffer.alloc(22)
  end.writeUInt32LE(0x06054b50, 0)
  end.writeUInt16LE(files.length, 8)
  end.writeUInt16LE(files.length, 10)
  end.writeUInt32LE(centralBuffer.length, 12)
  end.writeUInt32LE(centralOffset, 16)
  return Buffer.concat([...chunks, centralBuffer, end])
}

function packetSections(packet: AssetAuditPacket) {
  const workOrderIds = new Set(packet.workOrders.map((wo) => wo.id))

  return {
    asset: sectionCsv("Asset", ["Field", "Value"], [
      ["Name", packet.asset.name],
      ["Tag", packet.asset.tag_number],
      ["Serial", packet.asset.serial_number],
      ["Status", packet.asset.status],
      ["Lifecycle Stage", packet.asset.lifecycle_stage],
      ["Department", packet.asset.department],
      ["Location", packet.asset.location],
      ["UDI-DI", packet.asset.udi_di],
      ["UDI-PI", packet.asset.udi_pi],
    ]),
    assetHistory: sectionCsv("Asset History", ["Changed At", "Action", "Field", "Old", "New", "Reason", "Changed By"], packet.assetHistory.map((entry) => [
      entry.changed_at,
      entry.action,
      entry.field_name,
      entry.old_value,
      entry.new_value,
      entry.reason,
      entry.profile?.full_name,
    ])),
    workOrders: sectionCsv("Work Order History", ["ID", "Type", "Priority", "Status", "Created", "Started", "Completed", "Description", "Resolution"], packet.workOrders.map((wo) => [
      wo.id,
      wo.type,
      wo.priority,
      wo.status,
      wo.created_at,
      wo.started_at,
      wo.completed_at,
      wo.description,
      wo.resolution_notes,
    ])),
    cybersecurityAssessments: sectionCsv("Cybersecurity Assessments", ["Assessed At", "Status", "Patch", "Antivirus", "Backup", "Internet Exposed", "Remote Access", "Vulnerabilities", "Risk Acceptance Expires", "Notes"], packet.cybersecurityAssessments.map((assessment) => [
      assessment.assessed_at,
      assessment.assessment_status,
      assessment.patch_status,
      assessment.antivirus_status,
      assessment.backup_status,
      assessment.internet_exposed,
      assessment.remote_access_enabled,
      Array.isArray(assessment.vulnerabilities) ? assessment.vulnerabilities.join("; ") : JSON.stringify(assessment.vulnerabilities || []),
      assessment.risk_acceptance_expires_at,
      assessment.assessment_notes,
    ])),
    commissioningRecords: sectionCsv("Commissioning Records", ["Created At", "Status", "Installation", "Acceptance Test", "Training", "Handover", "Approved At", "Evidence"], packet.commissioningRecords.map((record) => [
      record.created_at,
      record.commissioning_status,
      record.installation_verified,
      record.acceptance_test_passed,
      record.user_training_completed,
      record.handover_completed,
      record.approved_at,
      record.evidence_notes,
    ])),
    decommissioningRecords: sectionCsv("Decommissioning Records", ["Created At", "Method", "Data Sanitization", "Accessories", "Hazardous Material", "Finance Approval", "Completed At", "Evidence"], packet.decommissioningRecords.map((record) => [
      record.created_at,
      record.disposal_method,
      record.data_sanitization_status,
      record.accessories_recovered,
      record.hazardous_material_checked,
      record.finance_approval_reference,
      record.completed_at,
      record.evidence_notes,
    ])),
    pmEvidence: sectionCsv("PM Evidence", ["Due At", "Status", "Completed At", "Work Order", "Escalation"], packet.pmEvidence.map((row) => [
      value(row, "due_at"),
      value(row, "status"),
      value(row, "completed_at"),
      value(row, "work_order_id"),
      value(row, "escalation_level"),
    ])),
    calibration: sectionCsv("Calibration Evidence", ["Recorded At", "Parameter", "Measured", "Expected", "Tolerance Min", "Tolerance Max", "Passed", "Reference Standard"], packet.calibrationReadings.map((row) => [
      value(row, "recorded_at"),
      value(row, "parameter"),
      value(row, "measured_value"),
      value(row, "expected_value"),
      value(row, "tolerance_min"),
      value(row, "tolerance_max"),
      value(row, "passed"),
      value(value(row, "reference_standard"), "name"),
    ])),
    certificates: sectionCsv("Calibration Certificates", ["Certificate", "Issued", "Valid Until", "Status", "Audit Hash", "Revoked At", "Revocation Reason"], packet.certificates.map((cert) => {
      const revocation = packet.certificateRevocations.find((row) => value(row, "certificate_id") === cert.id)
      return [
        cert.certificate_number,
        cert.issued_at,
        cert.valid_until,
        revocation ? "revoked" : cert.status,
        cert.audit_trail_hash,
        value(revocation, "revoked_at"),
        value(revocation, "reason"),
      ]
    })),
    signatures: sectionCsv("Electronic Signatures", ["Signed At", "Record Type", "Record ID", "Meaning", "Reason", "Signer", "Hash"], packet.signatures.map((sig) => [
      sig.signed_at,
      sig.record_type,
      sig.record_id,
      sig.meaning,
      sig.reason,
      sig.signer?.full_name,
      sig.signature_hash,
    ])),
    attachments: sectionCsv("Attachments", ["Created At", "Source", "Type", "Caption/Title", "File Name", "MIME Type", "Size Bytes", "URL"], packet.photos.map((attachment) => [
      value(attachment, "created_at"),
      workOrderIds.has(String(value(attachment, "work_order_id"))) ? "work_order" : "asset_document",
      value(attachment, "media_type") || value(attachment, "document_type") || "image",
      value(attachment, "caption") || value(attachment, "title"),
      value(attachment, "file_name"),
      value(attachment, "mime_type"),
      value(attachment, "file_size_bytes"),
      value(attachment, "file_url") || value(attachment, "photo_url"),
    ])),
    documents: sectionCsv("Documents", ["Created At", "Type", "Title", "Expires", "Retention Policy", "Retain Until", "Legal Hold", "URL"], packet.documents.map((document) => [
      value(document, "created_at"),
      value(document, "document_type"),
      value(document, "title"),
      value(document, "expires_at"),
      value(document, "retention_policy"),
      value(document, "retain_until"),
      value(document, "legal_hold"),
      value(document, "file_url"),
    ])),
    partsAndTime: sectionCsv("Parts And Time", ["Work Order", "Technician", "Started", "Completed", "Time Minutes", "Part", "Quantity", "Part Cost", "Expense"], packet.partsAndTime.map((row) => [
      value(row, "work_order_id"),
      value(value(row, "technician"), "full_name"),
      value(row, "started_at"),
      value(row, "completed_at"),
      (value(row, "entries") as Array<Record<string, unknown>> | undefined)?.reduce((sum, entry) => sum + Number(entry.duration_minutes || 0), 0),
      (value(row, "parts") as Array<Record<string, unknown>> | undefined)?.map((part) => value(value(part, "part"), "name")).join("; "),
      (value(row, "parts") as Array<Record<string, unknown>> | undefined)?.map((part) => value(part, "quantity_used")).join("; "),
      (value(row, "parts") as Array<Record<string, unknown>> | undefined)?.map((part) => value(value(part, "part"), "unit_cost")).join("; "),
      (value(row, "expenses") as Array<Record<string, unknown>> | undefined)?.reduce((sum, expense) => sum + Number(expense.amount || 0), 0),
    ])),
  }
}

function sha256(content: string | Buffer) {
  return createHash("sha256").update(content).digest("hex")
}

export function buildAssetPacketManifest(packet: AssetAuditPacket, sections = packetSections(packet), pdf?: Buffer): AssetPacketManifest {
  return {
    generatedAt: packet.generatedAt,
    assetId: packet.asset.id,
    assetTag: packet.asset.tag_number,
    counts: {
      assetHistory: packet.assetHistory.length,
      workOrders: packet.workOrders.length,
      cybersecurityAssessments: packet.cybersecurityAssessments.length,
      commissioningRecords: packet.commissioningRecords.length,
      decommissioningRecords: packet.decommissioningRecords.length,
      pmEvidence: packet.pmEvidence.length,
      calibrationReadings: packet.calibrationReadings.length,
      certificates: packet.certificates.length,
      certificateRevocations: packet.certificateRevocations.length,
      signatures: packet.signatures.length,
      attachments: packet.photos.length,
      documents: packet.documents.length,
      partsAndTime: packet.partsAndTime.length,
    },
    hashes: {
      ...Object.fromEntries(Object.entries(sections).map(([name, content]) => [`${name}.csv`, sha256(content)])),
      ...(pdf ? { "asset-auditor-packet.pdf": sha256(pdf) } : {}),
    },
  }
}

export async function getAssetAuditPacket(equipmentId: string): Promise<AssetAuditPacket | null> {
  const supabase = await createClient()
  const { data: asset } = await supabase.from("equipment").select("*").eq("id", equipmentId).single()
  if (!asset) return null

  const { data: workOrders } = await supabase
    .from("work_orders")
    .select("*, assigned_profile:assigned_to(*), created_profile:created_by(*)")
    .eq("equipment_id", equipmentId)
    .order("created_at", { ascending: false })

  const workOrderIds = (workOrders || []).map((wo) => wo.id)

  const [
    assetHistory,
    cybersecurityAssessments,
    commissioningRecords,
    decommissioningRecords,
    pmEvidence,
    calibrationReadings,
    certificates,
    certificateRevocations,
    equipmentSignatures,
    calibrationSignatures,
    certificateSignatures,
    workOrderSignatures,
    workOrderAttachments,
    workOrderPhotos,
    documents,
    partsAndTime,
  ] = await Promise.all([
    supabase.from("audit_log").select("*, profile:changed_by(full_name, role)").eq("table_name", "equipment").eq("record_id", equipmentId).order("changed_at", { ascending: false }),
    supabase.from("cybersecurity_assessments").select("*, assessor:assessed_by(full_name, role)").eq("equipment_id", equipmentId).order("assessed_at", { ascending: false }),
    supabase.from("commissioning_records").select("*, creator:created_by(full_name, role), approver:approved_by(full_name, role)").eq("equipment_id", equipmentId).order("created_at", { ascending: false }),
    supabase.from("decommissioning_records").select("*, completer:completed_by(full_name, role)").eq("equipment_id", equipmentId).order("created_at", { ascending: false }),
    supabase.from("pm_occurrences").select("*").eq("equipment_id", equipmentId).order("due_at", { ascending: false }),
    supabase.from("calibration_readings").select("*, reference_standard:reference_standard_id(*)").eq("equipment_id", equipmentId).order("recorded_at", { ascending: false }),
    supabase.from("certificates").select("*, issuer:issued_by(full_name, role)").eq("equipment_id", equipmentId).order("issued_at", { ascending: false }),
    supabase.from("certificate_revocations").select("*, revoker:revoked_by(full_name, role)").in("certificate_id", (await supabase.from("certificates").select("id").eq("equipment_id", equipmentId)).data?.map((cert) => cert.id) || ["00000000-0000-0000-0000-000000000000"]),
    supabase.from("signatures").select("*, signer:signer_id(full_name, role)").eq("record_type", "equipment").eq("record_id", equipmentId),
    supabase.from("signatures").select("*, signer:signer_id(full_name, role)").eq("record_type", "calibration").eq("record_id", equipmentId),
    supabase.from("signatures").select("*, signer:signer_id(full_name, role)").eq("record_type", "certificate").in("record_id", (await supabase.from("certificates").select("id").eq("equipment_id", equipmentId)).data?.map((cert) => cert.id) || ["00000000-0000-0000-0000-000000000000"]),
    workOrderIds.length > 0
      ? supabase.from("signatures").select("*, signer:signer_id(full_name, role)").eq("record_type", "work_order").in("record_id", workOrderIds)
      : Promise.resolve({ data: [] }),
    workOrderIds.length > 0
      ? supabase.from("work_order_attachments").select("*").in("work_order_id", workOrderIds).order("created_at", { ascending: false })
      : Promise.resolve({ data: [] }),
    workOrderIds.length > 0
      ? supabase.from("work_order_photos").select("*").in("work_order_id", workOrderIds).order("created_at", { ascending: false })
      : Promise.resolve({ data: [] }),
    supabase.from("asset_documents").select("*, uploader:uploaded_by(full_name, role)").eq("equipment_id", equipmentId).order("created_at", { ascending: false }),
    workOrderIds.length > 0
      ? supabase.from("job_cards").select("*, technician:technician_id(full_name, role), entries:job_card_entries(*), parts:job_card_parts(*, part:part_id(name, unit_cost)), expenses:job_card_expenses(*)").in("work_order_id", workOrderIds)
      : Promise.resolve({ data: [] }),
  ])

  const assetPhotos = (documents.data || []).filter((document) => document.document_type === "photo")

  return {
    generatedAt: new Date().toISOString(),
    asset: asset as Equipment,
    assetHistory: (assetHistory.data || []) as AuditLogEntry[],
    workOrders: (workOrders || []) as WorkOrder[],
    cybersecurityAssessments: (cybersecurityAssessments.data || []) as CybersecurityAssessment[],
    commissioningRecords: (commissioningRecords.data || []) as CommissioningRecord[],
    decommissioningRecords: (decommissioningRecords.data || []) as DecommissioningRecord[],
    pmEvidence: pmEvidence.data || [],
    calibrationReadings: calibrationReadings.data || [],
    certificates: (certificates.data || []) as Certificate[],
    certificateRevocations: certificateRevocations.data || [],
    signatures: [
      ...(equipmentSignatures.data || []),
      ...(calibrationSignatures.data || []),
      ...(certificateSignatures.data || []),
      ...(workOrderSignatures.data || []),
    ] as Signature[],
    photos: [
      ...(workOrderAttachments.data || []),
      ...(workOrderPhotos.data || []).map((photo) => ({
        ...photo,
        file_url: photo.photo_url,
        media_type: "image",
        mime_type: "image/jpeg",
      })),
      ...assetPhotos,
    ],
    documents: documents.data || [],
    partsAndTime: partsAndTime.data || [],
  }
}

export function buildAssetPacketCsv(packet: AssetAuditPacket) {
  const sections = packetSections(packet)
  const manifest = buildAssetPacketManifest(packet, sections)
  const manifestCsv = sectionCsv("Manifest", ["Field", "Value"], [
    ["Generated At", manifest.generatedAt],
    ["Asset ID", manifest.assetId],
    ["Asset Tag", manifest.assetTag],
    ["Counts", JSON.stringify(manifest.counts)],
    ["Hashes", JSON.stringify(manifest.hashes)],
  ])
  return [manifestCsv, ...Object.values(sections)].join("\n\n")
}

export async function buildAssetPacketPdf(packet: AssetAuditPacket) {
  const printer = new PdfPrinter({
    Roboto: {
      normal: `${fontPath}/Roboto-Regular.ttf`,
      bold: `${fontPath}/Roboto-Medium.ttf`,
      italics: `${fontPath}/Roboto-Italic.ttf`,
      bolditalics: `${fontPath}/Roboto-MediumItalic.ttf`,
    },
  })

  const doc = printer.createPdfKitDocument({
    pageSize: "A4",
    pageMargins: [36, 36, 36, 36],
    content: [
      { text: "Asset Auditor Packet", style: "title" },
      { text: `${packet.asset.name} (${packet.asset.tag_number})`, style: "subtitle" },
      { text: `Generated ${packet.generatedAt}`, style: "small" },
      { text: "Asset Summary", style: "section" },
      {
        table: {
          widths: ["30%", "70%"],
          body: [
            ["Tag", packet.asset.tag_number],
            ["Serial", packet.asset.serial_number || ""],
            ["Status", packet.asset.status],
            ["Lifecycle", packet.asset.lifecycle_stage],
            ["Department", packet.asset.department || ""],
            ["Location", packet.asset.location || ""],
          ],
        },
      },
      { text: "Evidence Counts", style: "section" },
      {
        table: {
          widths: ["70%", "30%"],
          body: [
            ["Immutable audit events", packet.assetHistory.length],
            ["Work orders", packet.workOrders.length],
            ["Cybersecurity assessments", packet.cybersecurityAssessments.length],
            ["Commissioning records", packet.commissioningRecords.length],
            ["Decommissioning records", packet.decommissioningRecords.length],
            ["PM occurrences", packet.pmEvidence.length],
            ["Calibration readings", packet.calibrationReadings.length],
            ["Calibration certificates", packet.certificates.length],
            ["Electronic signatures", packet.signatures.length],
            ["Attachments", packet.photos.length],
            ["Documents", packet.documents.length],
            ["Parts/time records", packet.partsAndTime.length],
          ],
        },
      },
      { text: "Latest Work Orders", style: "section" },
      {
        table: {
          headerRows: 1,
          widths: ["17%", "14%", "14%", "20%", "35%"],
          body: [
            ["Created", "Type", "Status", "Completed", "Description"],
            ...packet.workOrders.slice(0, 15).map((wo) => [wo.created_at?.slice(0, 10), wo.type, wo.status, wo.completed_at?.slice(0, 10) || "", wo.description]),
          ],
        },
      },
      { text: "Certificates", style: "section" },
      {
        table: {
          headerRows: 1,
          widths: ["22%", "18%", "18%", "14%", "28%"],
          body: [
            ["Certificate", "Issued", "Valid Until", "Status", "Audit Hash"],
            ...packet.certificates.map((cert) => {
              const revoked = packet.certificateRevocations.some((row) => value(row, "certificate_id") === cert.id)
              return [cert.certificate_number, cert.issued_at?.slice(0, 10), cert.valid_until?.slice(0, 10), revoked ? "revoked" : cert.status, cert.audit_trail_hash]
            }),
          ],
        },
      },
      { text: "Electronic Signatures", style: "section" },
      {
        table: {
          headerRows: 1,
          widths: ["19%", "18%", "15%", "23%", "25%"],
          body: [
            ["Signed", "Record", "Meaning", "Signer", "Reason"],
            ...packet.signatures.map((sig) => [sig.signed_at?.slice(0, 19), sig.record_type, sig.meaning, sig.signer?.full_name || "", sig.reason]),
          ],
        },
      },
    ],
    styles: {
      title: { fontSize: 18, bold: true, margin: [0, 0, 0, 4] },
      subtitle: { fontSize: 12, bold: true, margin: [0, 0, 0, 4] },
      small: { fontSize: 8, color: "#666666", margin: [0, 0, 0, 12] },
      section: { fontSize: 12, bold: true, margin: [0, 14, 0, 6] },
    },
    defaultStyle: { fontSize: 8 },
  })

  const chunks: Buffer[] = []
  for await (const chunk of doc) {
    chunks.push(Buffer.from(chunk))
  }
  return Buffer.concat(chunks)
}

export async function buildAssetPacketZip(packet: AssetAuditPacket) {
  const sections = packetSections(packet)
  const pdf = await buildAssetPacketPdf(packet)
  const manifest = buildAssetPacketManifest(packet, sections, pdf)
  return zip([
    { name: "manifest.json", content: JSON.stringify(manifest, null, 2) },
    { name: "asset-auditor-packet.pdf", content: pdf },
    ...Object.entries(sections).map(([name, content]) => ({ name: `${name}.csv`, content })),
  ])
}
