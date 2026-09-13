import type { IncomingMessage, ServerResponse } from 'node:http';

export interface SendMethods {
  /** Infer the content type unless one is already set. Null and undefined send an empty body. */
  send(payload?: unknown, statusCode?: number, statusText?: string): void;
  /** Send plain text without content detection. */
  text(this: ServerResponse, payload?: unknown, statusCode?: number, statusText?: string): void;
  /** Serialize a JavaScript value once with JSON.stringify. */
  json(this: ServerResponse, payload?: unknown, statusCode?: number, statusText?: string): void;
  /** Send trusted, already serialized JSON without parsing or serializing it again. */
  jsonString(this: ServerResponse, payload: string, statusCode?: number, statusText?: string): void;
}

/** Use this response type for handlers that run after send() middleware. */
export type SendResponse<Request extends IncomingMessage = IncomingMessage> = ServerResponse<Request> & SendMethods;

export type SendMiddleware = (req: IncomingMessage, res: ServerResponse, next: (error?: unknown) => unknown) => unknown;

declare module 'node:http' {
  interface ServerResponse<Request extends IncomingMessage = IncomingMessage> extends Partial<SendMethods> {}
}

/** Attach response helpers to the current response. */
export default function send(): SendMiddleware;
