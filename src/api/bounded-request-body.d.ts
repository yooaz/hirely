import type { IncomingMessage } from 'node:http';
export declare const MAX_PARSE_REQUEST_BYTES: number;
export declare class RequestBodyLimitError extends Error {
  readonly code: 'INVALID_CONTENT_LENGTH' | 'REQUEST_BODY_TOO_LARGE';
  readonly status: 400 | 413;
  constructor(code: 'INVALID_CONTENT_LENGTH' | 'REQUEST_BODY_TOO_LARGE', status: 400 | 413);
}
export declare function readBoundedBody(req: IncomingMessage, limit?: number): Promise<Buffer>;
