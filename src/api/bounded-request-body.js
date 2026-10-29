// Local, dependency-free bound for CV parser uploads. No external services.
export const MAX_PARSE_REQUEST_BYTES = 24 * 1024 * 1024;

export class RequestBodyLimitError extends Error {
  constructor(code, status) {
    super(code);
    this.name = 'RequestBodyLimitError';
    this.code = code;
    this.status = status;
  }
}

export async function readBoundedBody(req, limit = MAX_PARSE_REQUEST_BYTES) {
  if (!Number.isSafeInteger(limit) || limit < 1) throw new TypeError('INVALID_BODY_LIMIT');
  const rawLength = req.headers?.['content-length'];
  if (rawLength !== undefined) {
    if (typeof rawLength !== 'string' || !/^(0|[1-9][0-9]*)$/.test(rawLength)) {
      throw new RequestBodyLimitError('INVALID_CONTENT_LENGTH', 400);
    }
    if (BigInt(rawLength) > BigInt(limit)) {
      throw new RequestBodyLimitError('REQUEST_BODY_TOO_LARGE', 413);
    }
  }
  const chunks = [];
  let bytes = 0;
  for await (const raw of req) {
    const chunk = Buffer.isBuffer(raw) ? raw : Buffer.from(raw);
    if (chunk.length > limit - bytes) {
      throw new RequestBodyLimitError('REQUEST_BODY_TOO_LARGE', 413);
    }
    bytes += chunk.length;
    chunks.push(chunk);
  }
  return Buffer.concat(chunks, bytes);
}
