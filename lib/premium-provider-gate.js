/**
 * Fail-closed admission for legacy billable CV AI/OCR endpoints.
 *
 * No server-side transaction-bound premium entitlement AND explicit CV consent
 * verifier is implemented yet. A provider key, client flag, header, cookie,
 * exportId or request body must never grant permission to call a provider.
 *
 * Intentionally returns false for every request until a separately reviewed,
 * server-verified entitlement and consent implementation replaces this HOLD.
 * This module performs no I/O and never launches a provider request.
 */
export const PREMIUM_PROVIDER_HOLD_CODE = 'PREMIUM_ENTITLEMENT_REQUIRED';

export function canCallBillableCvProvider(_request) {
  return false;
}
