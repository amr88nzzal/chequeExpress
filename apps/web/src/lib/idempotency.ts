let fallbackCounter = 0;

/**
 * Idempotency key for operations that reserve or print a cheque number
 * (CONVENTIONS.md §13). In production the key is created once per user action
 * and reused for every retry of that action, so a retried request cannot reserve
 * a second leaf.
 */
export function createIdempotencyKey(): string {
  const generator = globalThis.crypto;
  if (generator && typeof generator.randomUUID === 'function') {
    return generator.randomUUID();
  }
  // Only reached in environments without WebCrypto (older jsdom, plain Node).
  fallbackCounter += 1;
  return `cheques-print-${fallbackCounter}`;
}
