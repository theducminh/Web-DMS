// Type stub cho mammoth.browser ESM build (chỉ dùng convertToHtml).
declare module 'mammoth/mammoth.browser' {
  export interface ConvertOptions {
    arrayBuffer: ArrayBuffer;
  }
  export interface ConvertResult {
    value: string;
    messages: Array<{ type: string; message: string }>;
  }
  export function convertToHtml(options: ConvertOptions): Promise<ConvertResult>;
  export function extractRawText(options: ConvertOptions): Promise<ConvertResult>;
}
