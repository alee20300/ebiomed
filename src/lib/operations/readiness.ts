export type ReadinessStatus = "ready" | "partial" | "blocked"

export interface ReadinessCapability {
  id: string
  label: string
  implemented: boolean
  evidence: string
}

export interface EnterpriseReadinessReport {
  status: ReadinessStatus
  score: number
  implemented: number
  total: number
  capabilities: ReadinessCapability[]
}

export function buildEnterpriseReadinessReport(capabilities: ReadinessCapability[]): EnterpriseReadinessReport {
  const total = capabilities.length
  const implemented = capabilities.filter((capability) => capability.implemented).length
  const score = total === 0 ? 0 : Math.round((implemented / total) * 100)
  const status: ReadinessStatus = score >= 95 ? "ready" : score >= 80 ? "partial" : "blocked"

  return {
    status,
    score,
    implemented,
    total,
    capabilities,
  }
}

export const ENTERPRISE_READINESS_CAPABILITIES: ReadinessCapability[] = [
  { id: "asset-master", label: "Biomedical asset master", implemented: true, evidence: "Asset criticality, risk class, UDI/GMDN, hierarchy, and lifecycle fields" },
  { id: "cyber-governance", label: "Cybersecurity governance", implemented: true, evidence: "Cyber assessments, risk acceptance, network controls, and packet export" },
  { id: "commissioning", label: "Commissioning workflow", implemented: true, evidence: "Commissioning records and approval gate before service transition" },
  { id: "decommissioning", label: "Decommissioning workflow", implemented: true, evidence: "Sanitization, hazard check, re-auth, and retirement gate" },
  { id: "work-order-closeout", label: "Work order closeout controls", implemented: true, evidence: "Root cause, outcome, re-auth, time entry, and safety escalation" },
  { id: "calibration-compliance", label: "Calibration compliance", implemented: true, evidence: "Reference standards, e-signatures, certificates, and OOT investigation" },
  { id: "inventory-governance", label: "Inventory governance", implemented: true, evidence: "Ledger, valuation, quarantine/expiry controls, and reorder suggestions" },
  { id: "purchasing-contracts", label: "Purchasing and contracts", implemented: true, evidence: "Vendor performance, purchase requests, PO receiving, and threshold approvals" },
  { id: "enterprise-scope", label: "Enterprise scoping", implemented: true, evidence: "Sites, departments, scoped permissions, viewer department access" },
  { id: "imports-integrations", label: "Imports and integrations", implemented: true, evidence: "Validated import batches, rollback metadata, API scopes, and usage audit" },
  { id: "operations-health", label: "Operational health", implemented: true, evidence: "Health checks for runtime, DB, PM engine, outbox, and integrations" },
  { id: "audit-export", label: "Audit export readiness", implemented: true, evidence: "Hashed asset audit packet with governance, work order, calibration, attachments, and signatures" },
]

export function getEnterpriseReadinessReport() {
  return buildEnterpriseReadinessReport(ENTERPRISE_READINESS_CAPABILITIES)
}
