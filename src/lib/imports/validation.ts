import { IMPORT_TEMPLATES, type ImportTemplate } from "@/lib/imports/templates"

export interface ImportValidationError {
  row: number
  field: string
  message: string
}

export interface ImportDuplicateMatch {
  row: number
  key: string
  matchedRow: number
}

export interface ImportValidationResult {
  preview: Array<Record<string, string>>
  errors: ImportValidationError[]
  duplicateMatches: ImportDuplicateMatch[]
  totalRows: number
  validRows: number
}

export function parseCsv(text: string) {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ""
  let quoted = false
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]
    const next = text[index + 1]
    if (quoted && char === '"' && next === '"') {
      cell += '"'
      index += 1
    } else if (char === '"') {
      quoted = !quoted
    } else if (!quoted && char === ",") {
      row.push(cell.trim())
      cell = ""
    } else if (!quoted && (char === "\n" || char === "\r")) {
      if (char === "\r" && next === "\n") index += 1
      row.push(cell.trim())
      if (row.some(Boolean)) rows.push(row)
      row = []
      cell = ""
    } else {
      cell += char
    }
  }
  row.push(cell.trim())
  if (row.some(Boolean)) rows.push(row)
  return rows
}

function addNumericError(
  errors: ImportValidationError[],
  rowNumber: number,
  row: Record<string, string>,
  field: string,
  options: { integer?: boolean; min?: number } = {},
) {
  const value = row[field]
  if (value == null || value === "") return
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) {
    errors.push({ row: rowNumber, field, message: `${field} must be a number` })
    return
  }
  if (options.integer && !Number.isInteger(parsed)) {
    errors.push({ row: rowNumber, field, message: `${field} must be a whole number` })
  }
  if (options.min != null && parsed < options.min) {
    errors.push({ row: rowNumber, field, message: `${field} must be at least ${options.min}` })
  }
}

function addTemplateSpecificErrors(template: ImportTemplate, row: Record<string, string>, rowNumber: number, errors: ImportValidationError[]) {
  if (template === "parts") {
    for (const field of ["quantity_on_hand", "min_threshold", "max_threshold", "reorder_quantity"]) {
      addNumericError(errors, rowNumber, row, field, { integer: true, min: 0 })
    }
    addNumericError(errors, rowNumber, row, "unit_cost", { min: 0 })
  }

  if (template === "pms") {
    addNumericError(errors, rowNumber, row, "frequency_days", { integer: true, min: 1 })
    if (row.next_due && Number.isNaN(Date.parse(row.next_due))) {
      errors.push({ row: rowNumber, field: "next_due", message: "next_due must be a valid date" })
    }
  }

  if (template === "equipment" && row.status && !["active", "inactive", "under_repair", "retired"].includes(row.status)) {
    errors.push({ row: rowNumber, field: "status", message: "status must be active, inactive, under_repair, or retired" })
  }

  if (template === "users" && row.role && !["admin", "technician", "viewer"].includes(row.role)) {
    errors.push({ row: rowNumber, field: "role", message: "role must be admin, technician, or viewer" })
  }
}

export function validateImportRows(template: ImportTemplate, csvText: string): ImportValidationResult {
  const rows = parseCsv(csvText)
  const headers = rows[0] || []
  const required = IMPORT_TEMPLATES[template]
  const missingHeaders = required.filter((header) => !headers.includes(header))
  const errors: ImportValidationError[] = []
  const preview = rows.slice(1).map((cells, index) => {
    const rowNumber = index + 2
    const item = Object.fromEntries(headers.map((header, cellIndex) => [header, cells[cellIndex] || ""]))
    for (const field of required.slice(0, template === "parts" ? 1 : 2)) {
      if (!item[field]) errors.push({ row: rowNumber, field, message: `${field} is required` })
    }
    addTemplateSpecificErrors(template, item, rowNumber, errors)
    return item
  })

  for (const field of missingHeaders) {
    errors.push({ row: 1, field, message: `Missing header ${field}` })
  }

  const seen = new Map<string, number>()
  const duplicateMatches: ImportDuplicateMatch[] = []
  const keyField = template === "equipment" ? "tag_number" : template === "users" ? "email" : template === "parts" ? "part_number" : "name"
  preview.forEach((row, index) => {
    const key = String(row[keyField] || row.name || "").toLowerCase()
    if (!key) return
    const previous = seen.get(key)
    if (previous) duplicateMatches.push({ row: index + 2, key, matchedRow: previous })
    else seen.set(key, index + 2)
  })

  const rowsWithErrors = new Set(errors.filter((error) => error.row > 1).map((error) => error.row))
  return {
    preview,
    errors,
    duplicateMatches,
    totalRows: preview.length,
    validRows: Math.max(preview.length - rowsWithErrors.size, 0),
  }
}
