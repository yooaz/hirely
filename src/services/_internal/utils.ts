import { randomUUID } from 'node:crypto';
import type { StageName, StageStatus, StageTrace } from '../../types/trace.types.js';

export function newId(prefix: string): string {
  return `${prefix}_${randomUUID().slice(0, 8)}`;
}

export function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

export function stageTrace(
  stage: StageName,
  status: StageStatus,
  started: number,
  metrics?: StageTrace['metrics'],
  errors?: string[],
  fallback_reason?: string
): StageTrace {
  const ended = Date.now();
  return {
    stage,
    status,
    duration_ms: ended - started,
    started_at: new Date(started).toISOString(),
    ended_at: new Date(ended).toISOString(),
    metrics,
    errors,
    fallback_reason,
  };
}

export function tokenize(text: string): string[] {
  return String(text || '')
    .split(/\s+/)
    .map((t) => t.trim())
    .filter(Boolean);
}

export function uniqueStrings(items: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of items) {
    const key = item.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(item.trim());
  }
  return out;
}

export function setByPath(obj: Record<string, unknown>, path: string, value: unknown): void {
  // Never traverse inherited properties or mutate JS prototypes from CV correction input.
  if (typeof path !== 'string' || path.length === 0 || path.length > 256) {
    throw new TypeError('INVALID_CORRECTION_PATH');
  }
  const normalized = path.replace(/\[(\d+)\]/g, '.$1');
  const parts = normalized.split('.');
  if (parts.length > 32 || parts.some((part) =>
    !part || Object.hasOwn(Object.prototype, part) || part === 'constructor' || part === 'prototype' ||
    /[\[\]]/.test(part)
  )) {
    throw new TypeError('INVALID_CORRECTION_PATH');
  }
  // Validate numeric segments before mutating the CV to avoid sparse-array DoS.
  for (const part of parts) {
    if (/^\d+$/.test(part) && (!Number.isSafeInteger(Number(part)) || Number(part) > 10000)) {
      throw new TypeError('INVALID_CORRECTION_PATH');
    }
  }
  let cur: Record<string, unknown> | unknown[] = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const key = parts[i]!;
    const nextKey = parts[i + 1]!;
    const isIndex = /^\d+$/.test(nextKey);
    if (Array.isArray(cur)) {
      if (!/^\d+$/.test(key)) throw new TypeError('INVALID_CORRECTION_PATH');
      const idx = Number(key);
      if (cur[idx] == null) cur[idx] = isIndex ? [] : {};
      cur = cur[idx] as Record<string, unknown>;
    } else if (cur !== null && typeof cur === 'object') {
      if (!Object.hasOwn(cur, key) || cur[key] == null) cur[key] = isIndex ? [] : {};
      cur = cur[key] as Record<string, unknown>;
    } else {
      throw new TypeError('INVALID_CORRECTION_PATH');
    }
  }
  const last = parts[parts.length - 1]!;
  if (Array.isArray(cur)) {
    if (!/^\d+$/.test(last)) throw new TypeError('INVALID_CORRECTION_PATH');
    cur[Number(last)] = value;
  } else if (cur !== null && typeof cur === 'object') {
    cur[last] = value;
  } else {
    throw new TypeError('INVALID_CORRECTION_PATH');
  }
}
