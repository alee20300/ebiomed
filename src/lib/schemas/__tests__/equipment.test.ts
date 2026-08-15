import { describe, it, expect } from "vitest"
import { equipmentSchema } from "@/lib/schemas/equipment"

describe("equipmentSchema", () => {
  const validData = {
    tag_number: "BM-001",
    name: "Ventilator V500",
    reason: "Adding new equipment to registry",
  }

  it("validates with minimum required fields", () => {
    const result = equipmentSchema.safeParse(validData)
    expect(result.success).toBe(true)
  })

  it("defaults status to active", () => {
    const result = equipmentSchema.safeParse(validData)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.status).toBe("active")
    }
  })

  it("rejects empty tag_number", () => {
    const result = equipmentSchema.safeParse({ ...validData, tag_number: "" })
    expect(result.success).toBe(false)
  })

  it("rejects empty name", () => {
    const result = equipmentSchema.safeParse({ ...validData, name: "" })
    expect(result.success).toBe(false)
  })

  it("rejects reason shorter than 5 characters", () => {
    const result = equipmentSchema.safeParse({ ...validData, reason: "Fix" })
    expect(result.success).toBe(false)
  })

  it("rejects reason longer than 500 characters", () => {
    const result = equipmentSchema.safeParse({ ...validData, reason: "x".repeat(501) })
    expect(result.success).toBe(false)
  })

  it("validates valid status values", () => {
    const statuses = ["active", "inactive", "retired", "under_repair", "out_of_tolerance", "certified"]
    for (const status of statuses) {
      const result = equipmentSchema.safeParse({ ...validData, status })
      expect(result.success).toBe(true)
    }
  })

  it("accepts optional fields", () => {
    const result = equipmentSchema.safeParse({
      ...validData,
      serial_number: "SN-123",
      model: "V500",
      manufacturer: "Drager",
      department: "ICU",
      location: "Room 101",
      category: "Ventilator",
      install_date: "2024-01-15",
      warranty_expiry: "2026-01-15",
      notes: "Test equipment",
      run_hours: "125.5",
      cycle_count: "42",
      pm_trigger_type: "run_hours",
      pm_trigger_value: "250",
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.run_hours).toBe(125.5)
      expect(result.data.cycle_count).toBe(42)
      expect(result.data.pm_trigger_type).toBe("run_hours")
      expect(result.data.pm_trigger_value).toBe(250)
    }
  })

  it("defaults PM trigger type to calendar", () => {
    const result = equipmentSchema.safeParse(validData)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.pm_trigger_type).toBe("calendar")
    }
  })

  it("defaults biomedical asset master classifications", () => {
    const result = equipmentSchema.safeParse(validData)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.asset_criticality).toBe("medium")
      expect(result.data.risk_class).toBe("class_ii")
      expect(result.data.ownership_type).toBe("owned")
      expect(result.data.network_connected).toBe(false)
    }
  })

  it("accepts biomedical asset master fields", () => {
    const result = equipmentSchema.safeParse({
      ...validData,
      device_category: "Life support",
      asset_criticality: "life_support",
      risk_class: "class_iii",
      ownership_type: "leased",
      cost_center: "ICU-100",
      clinical_area: "Adult ICU",
      manufacturer_device_id: "MFG-VENT-500",
      software_version: "5.4.1",
      firmware_version: "2.0.3",
      os_platform: "Windows 10 IoT",
      network_connected: "true",
      ip_address: "192.168.1.25",
      mac_address: "aa:bb:cc:dd:ee:ff",
      commissioned_at: "2024-02-01",
      acceptance_test_date: "2024-01-30",
      replacement_due_date: "2030-01-01",
    })

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.network_connected).toBe(true)
      expect(result.data.mac_address).toBe("AA:BB:CC:DD:EE:FF")
    }
  })

  it("requires network identity for connected assets", () => {
    const result = equipmentSchema.safeParse({
      ...validData,
      network_connected: "true",
    })
    expect(result.success).toBe(false)
  })

  it("requires OS platform for connected assets", () => {
    const result = equipmentSchema.safeParse({
      ...validData,
      network_connected: "true",
      ip_address: "192.168.1.25",
    })
    expect(result.success).toBe(false)
  })

  it("requires cyber risk acceptance expiry when accepted", () => {
    const result = equipmentSchema.safeParse({
      ...validData,
      risk_acceptance_status: "accepted",
    })
    expect(result.success).toBe(false)
  })

  it("requires retirement reason when lifecycle stage is retired", () => {
    const result = equipmentSchema.safeParse({
      ...validData,
      lifecycle_stage: "retired",
    })
    expect(result.success).toBe(false)
  })

  it("rejects negative usage counters", () => {
    expect(equipmentSchema.safeParse({ ...validData, run_hours: "-1" }).success).toBe(false)
    expect(equipmentSchema.safeParse({ ...validData, cycle_count: "-1" }).success).toBe(false)
  })

  it("requires usage threshold for usage-based PM triggers", () => {
    const result = equipmentSchema.safeParse({ ...validData, pm_trigger_type: "run_hours" })
    expect(result.success).toBe(false)
  })

  it("rejects warranty expiry before install date", () => {
    const result = equipmentSchema.safeParse({
      ...validData,
      install_date: "2026-01-15",
      warranty_expiry: "2025-01-15",
    })
    expect(result.success).toBe(false)
  })
})
