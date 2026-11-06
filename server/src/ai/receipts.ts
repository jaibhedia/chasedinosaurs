/**
 * Receipts for the bots' AI lines when they run on the 0G Compute Router. Every Router
 * response carries `x_0g_trace`: a request id and the on-chain address of the provider
 * that served it (plus `tee_verified` when the request asked the Router to check the
 * provider's TEE signature). They're kept in memory, newest first, for /ai/receipts and
 * the results screen. Prompts and lines are not kept.
 */
export interface Receipt {
  requestId: string;
  /** On-chain address of the 0G provider that served the request. */
  provider: string | null;
  teeVerified: boolean | null;
  kind: 'line' | 'roast';
  at: number;
}

const MAX = 50;
const receipts: Receipt[] = [];

/** The receipt in a Router response, or null for any other provider. */
export function receiptOf(res: unknown, kind: Receipt['kind'], now = Date.now()): Receipt | null {
  const t = (res as { x_0g_trace?: { request_id?: unknown; provider?: unknown; tee_verified?: unknown } } | null)?.x_0g_trace;
  if (!t || typeof t.request_id !== 'string' || !t.request_id) return null;
  return {
    requestId: t.request_id.slice(0, 100),
    provider: typeof t.provider === 'string' ? t.provider.slice(0, 64) : null,
    teeVerified: typeof t.tee_verified === 'boolean' ? t.tee_verified : null,
    kind,
    at: now,
  };
}

export function keepReceipt(r: Receipt): void {
  receipts.unshift(r);
  if (receipts.length > MAX) receipts.length = MAX;
}

export function recentReceipts(limit = 20): Receipt[] {
  return receipts.slice(0, limit);
}
