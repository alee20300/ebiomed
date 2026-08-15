import { describe, expect, it } from "vitest"
import { buildAssetPacketCsv, buildAssetPacketManifest, type AssetAuditPacket } from "@/lib/compliance/asset-packet"

const packet = {
  generatedAt: "2026-06-05T10:00:00.000Z",
  asset: {
    id: "asset-1",
    name: "Infusion Pump",
    tag_number: "BIO-001",
    serial_number: "SN-1",
    status: "certified",
    lifecycle_stage: "in_service",
    department: "ICU",
    location: "Ward 1",
    udi_di: "UDI-DI",
    udi_pi: "UDI-PI",
  },
  assetHistory: [
    {
      id: "audit-1",
      table_name: "equipment",
      record_id: "asset-1",
      action: "update",
      field_name: "status",
      old_value: "active",
      new_value: "certified",
      changed_by: "user-1",
      changed_at: "2026-06-05T09:00:00.000Z",
      reason: "Calibration approved",
      profile: { full_name: "A Tech" },
    },
  ],
  workOrders: [
    {
      id: "wo-1",
      type: "preventive",
      priority: "medium",
      status: "completed",
      created_at: "2026-06-04T09:00:00.000Z",
      started_at: "2026-06-04T10:00:00.000Z",
      completed_at: "2026-06-04T11:00:00.000Z",
      description: "PM",
      resolution_notes: "Done",
    },
  ],
  cybersecurityAssessments: [
    {
      id: "cyber-1",
      equipment_id: "asset-1",
      assessment_status: "risk_acceptance_required",
      patch_status: "unsupported",
      antivirus_status: "unsupported",
      backup_status: "missing",
      internet_exposed: false,
      remote_access_enabled: true,
      vulnerabilities: ["Unsupported OS"],
      assessment_notes: "Compensating controls documented",
      risk_acceptance_reason: "Vendor patch unavailable",
      risk_acceptance_expires_at: "2026-12-31",
      assessed_at: "2026-06-04T08:30:00.000Z",
    },
  ],
  commissioningRecords: [
    {
      id: "comm-1",
      equipment_id: "asset-1",
      commissioning_status: "approved_for_service",
      installation_verified: true,
      acceptance_test_passed: true,
      user_training_completed: true,
      handover_completed: true,
      evidence_notes: "Installed and accepted by ICU",
      approved_at: "2026-06-04T08:00:00.000Z",
      created_at: "2026-06-04T07:00:00.000Z",
    },
  ],
  decommissioningRecords: [],
  pmEvidence: [{ due_at: "2026-06-04T00:00:00.000Z", status: "completed", completed_at: "2026-06-04T11:00:00.000Z", work_order_id: "wo-1" }],
  calibrationReadings: [{ recorded_at: "2026-06-04T11:00:00.000Z", parameter: "Flow", measured_value: 10, expected_value: 10, tolerance_min: 9, tolerance_max: 11, passed: true, reference_standard: { name: "Master Meter" } }],
  certificates: [{ id: "cert-1", certificate_number: "CAL-2026-0001", issued_at: "2026-06-04T11:05:00.000Z", valid_until: "2027-06-04T11:05:00.000Z", status: "valid", audit_trail_hash: "hash" }],
  certificateRevocations: [{ certificate_id: "cert-1", revoked_at: "2026-06-05T09:00:00.000Z", reason: "Issued in error" }],
  signatures: [{ id: "sig-1", signed_at: "2026-06-04T11:05:00.000Z", record_type: "certificate", record_id: "cert-1", meaning: "Approved", reason: "Calibration passed", signature_hash: "hash", signer: { full_name: "A Tech" } }],
  photos: [
    {
      created_at: "2026-06-04T10:30:00.000Z",
      work_order_id: "wo-1",
      caption: "Before",
      file_url: "https://example.test/photo.jpg",
      file_name: "before.jpg",
      mime_type: "image/jpeg",
      media_type: "image",
      file_size_bytes: 2048,
    },
    {
      created_at: "2026-06-04T10:45:00.000Z",
      work_order_id: "wo-1",
      caption: "Functional test",
      file_url: "https://example.test/repair.mp4",
      file_name: "repair.mp4",
      mime_type: "video/mp4",
      media_type: "video",
      file_size_bytes: 4096,
    },
  ],
  documents: [{ created_at: "2026-06-04T09:00:00.000Z", document_type: "manual", title: "Manual", expires_at: null, retention_policy: "standard_7_years", retain_until: "2033-06-04", legal_hold: false, file_url: "https://example.test/manual.pdf" }],
  partsAndTime: [{ work_order_id: "wo-1", started_at: "2026-06-04T10:00:00.000Z", completed_at: "2026-06-04T11:00:00.000Z", technician: { full_name: "A Tech" }, entries: [{ duration_minutes: 60 }], parts: [{ quantity_used: 1, part: { name: "Battery", unit_cost: 25 } }], expenses: [{ amount: 5 }] }],
} as unknown as AssetAuditPacket

describe("asset auditor packet export", () => {
  it("includes all compliance evidence sections in CSV", () => {
    const csv = buildAssetPacketCsv(packet)

    expect(csv).toContain("Asset History")
    expect(csv).toContain("Work Order History")
    expect(csv).toContain("Cybersecurity Assessments")
    expect(csv).toContain("Commissioning Records")
    expect(csv).toContain("Decommissioning Records")
    expect(csv).toContain("PM Evidence")
    expect(csv).toContain("Calibration Evidence")
    expect(csv).toContain("Calibration Certificates")
    expect(csv).toContain("Electronic Signatures")
    expect(csv).toContain("Attachments")
    expect(csv).toContain("Documents")
    expect(csv).toContain("Parts And Time")
    expect(csv).toContain("Manifest")
    expect(csv).toContain("Hashes")
    expect(csv).toContain("video/mp4")
    expect(csv).toContain("repair.mp4")
    expect(csv).toContain("Issued in error")
    expect(csv).toContain("Calibration passed")
    expect(csv).toContain("Unsupported OS")
    expect(csv).toContain("Installed and accepted by ICU")
  })

  it("builds deterministic manifest counts and hashes", () => {
    const manifest = buildAssetPacketManifest(packet)

    expect(manifest.counts.workOrders).toBe(1)
    expect(manifest.counts.cybersecurityAssessments).toBe(1)
    expect(manifest.counts.commissioningRecords).toBe(1)
    expect(manifest.counts.decommissioningRecords).toBe(0)
    expect(manifest.counts.attachments).toBe(2)
    expect(manifest.hashes["asset.csv"]).toMatch(/^[a-f0-9]{64}$/)
    expect(manifest.hashes["signatures.csv"]).toMatch(/^[a-f0-9]{64}$/)
  })
})
