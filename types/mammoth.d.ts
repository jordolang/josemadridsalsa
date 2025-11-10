declare module 'mammoth' {
  export type MammothInput = {
    path?: string
    buffer?: Buffer | ArrayBuffer | Uint8Array
  }

  export type MammothResult = {
    value: string
    messages: Array<{ message: string; type: string }>
  }

  export function extractRawText(input: MammothInput, options?: Record<string, unknown>): Promise<MammothResult>
}
