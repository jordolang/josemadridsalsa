declare module 'pdf-parse' {
  export interface PDFMetadata {
    info?: Record<string, unknown>
    metadata?: Record<string, unknown>
  }

  export interface PDFParseResult {
    numpages: number
    numrender: number
    info?: Record<string, unknown>
    metadata?: unknown
    version?: string
    text: string
  }

  export type PDFParseOptions = {
    pagerender?: (pageData: any) => string | Promise<string>
    max?: number
  }

  function pdf(data: Buffer | Uint8Array, options?: PDFParseOptions): Promise<PDFParseResult>

  export = pdf
}
