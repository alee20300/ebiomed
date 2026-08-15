declare module "pdfmake" {
  type FontDescriptors = Record<string, Record<string, string>>

  class PdfPrinter {
    constructor(fonts: FontDescriptors)
    createPdfKitDocument(docDefinition: Record<string, unknown>): AsyncIterable<Buffer> & {
      on(event: "data", callback: (chunk: Buffer) => void): void
      on(event: "end", callback: () => void): void
      end(): void
    }
  }

  export default PdfPrinter
}
