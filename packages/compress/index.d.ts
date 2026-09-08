import type { IncomingMessage, ServerResponse } from 'node:http';

export interface CompressOptions {
  /** Prefer Brotli when the client gives gzip and Brotli equal quality. Default: false. */
  preferBrotli?: boolean;
  /** Minimum known response length in bytes. Unknown-length streams compress immediately. Default: 1024. */
  threshold?: number;
  /** Compression quality: 1–9 for gzip or 1–11 for Brotli. Default: 6. */
  level?: number;
  /** Compressor output chunk size in KiB. Default: 16. */
  chunkSize?: number;
}

export type CompressionMiddleware = (
  req: IncomingMessage,
  res: ServerResponse,
  next: (error?: unknown) => unknown
) => unknown;

/** Compress eligible HTTP responses with gzip or Brotli while preserving streaming backpressure. */
export default function compress(options?: CompressOptions): CompressionMiddleware;
