import PdfPrinter from "pdfmake"
import { REPORT_LABELS, type ReportId } from "@/lib/reports/definitions"
import type { EvidenceRow, GroupMetric, KpiValue, ReportingDashboard } from "@/lib/reports/calculations"

type TableRow = Array<string | number>

const fontPath = "node_modules/pdfmake/fonts/Roboto"

function reportRows(dashboard: ReportingDashboard, report: ReportId): TableRow[] {
  const rows = dashboard.reports[report].rows
  if (report === "compliance-evidence") {
    return (rows as EvidenceRow[]).map((row) => [row.item, row.owner, row.status, row.date, row.evidence])
  }
  return (rows as GroupMetric[]).map((row) => [row.label, row.value, row.secondary || ""])
}

function reportHeader(report: ReportId): string[] {
  return report === "compliance-evidence"
    ? ["Item", "Owner", "Status", "Date", "Evidence"]
    : ["Metric", "Value", "Detail"]
}

function kpiRows(kpis: KpiValue[]): TableRow[] {
  return kpis.map((kpi) => [kpi.label, kpi.displayValue, kpi.formula])
}

function escapeCsvCell(value: string | number) {
  const text = String(value ?? "")
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`
  return text
}

export function buildReportCsv(dashboard: ReportingDashboard, report: ReportId) {
  const rows: TableRow[] = [
    ["Report", REPORT_LABELS[report]],
    ["From", dashboard.filters.from],
    ["To", dashboard.filters.to],
    [],
    ["KPI", "Value", "Formula"],
    ...kpiRows(dashboard.kpis),
    [],
    reportHeader(report),
    ...reportRows(dashboard, report),
  ]
  return rows.map((row) => row.map(escapeCsvCell).join(",")).join("\n")
}

function crc32(buffer: Buffer) {
  let crc = ~0
  for (const byte of buffer) {
    crc ^= byte
    for (let i = 0; i < 8; i += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1))
    }
  }
  return ~crc >>> 0
}

function zip(files: Array<{ name: string; content: string }>) {
  const chunks: Buffer[] = []
  const central: Buffer[] = []
  let offset = 0

  for (const file of files) {
    const name = Buffer.from(file.name)
    const content = Buffer.from(file.content)
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

function xml(value: string | number) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

function sheetXml(rows: TableRow[]) {
  const rowXml = rows.map((row, rowIndex) => {
    const cells = row.map((cell, colIndex) => {
      const ref = `${String.fromCharCode(65 + colIndex)}${rowIndex + 1}`
      return `<c r="${ref}" t="inlineStr"><is><t>${xml(cell)}</t></is></c>`
    }).join("")
    return `<row r="${rowIndex + 1}">${cells}</row>`
  }).join("")
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${rowXml}</sheetData></worksheet>`
}

export function buildReportXlsx(dashboard: ReportingDashboard, report: ReportId) {
  const rows: TableRow[] = [
    ["KPI", "Value", "Formula"],
    ...kpiRows(dashboard.kpis),
    [],
    reportHeader(report),
    ...reportRows(dashboard, report),
  ]

  return zip([
    {
      name: "[Content_Types].xml",
      content: `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>`,
    },
    {
      name: "_rels/.rels",
      content: `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    },
    {
      name: "xl/workbook.xml",
      content: `<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${xml(REPORT_LABELS[report])}" sheetId="1" r:id="rId1"/></sheets></workbook>`,
    },
    {
      name: "xl/_rels/workbook.xml.rels",
      content: `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>`,
    },
    { name: "xl/worksheets/sheet1.xml", content: sheetXml(rows) },
  ])
}

export async function buildReportPdf(dashboard: ReportingDashboard, report: ReportId) {
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
      { text: REPORT_LABELS[report], style: "title" },
      { text: `${dashboard.filters.from.slice(0, 10)} to ${dashboard.filters.to.slice(0, 10)}`, style: "subtitle" },
      { text: "KPI Definitions", style: "section" },
      {
        table: {
          headerRows: 1,
          widths: ["22%", "18%", "60%"],
          body: [["KPI", "Value", "Formula"], ...kpiRows(dashboard.kpis)],
        },
      },
      { text: dashboard.reports[report].title, style: "section" },
      {
        table: {
          headerRows: 1,
          widths: report === "compliance-evidence" ? ["25%", "18%", "14%", "18%", "25%"] : ["45%", "20%", "35%"],
          body: [reportHeader(report), ...reportRows(dashboard, report)],
        },
      },
    ],
    styles: {
      title: { fontSize: 18, bold: true, margin: [0, 0, 0, 6] },
      subtitle: { fontSize: 9, color: "#666666", margin: [0, 0, 0, 16] },
      section: { fontSize: 13, bold: true, margin: [0, 16, 0, 8] },
    },
    defaultStyle: { fontSize: 8 },
  })

  const chunks: Buffer[] = []
  for await (const chunk of doc) {
    chunks.push(Buffer.from(chunk))
  }
  return Buffer.concat(chunks)
}
