/**
 * UUIDv7 (RFC 9562): 48-bit big-endian Unix millisecond timestamp, 12 bits of
 * counter, then random. Ids therefore sort by creation time — including two ids
 * created in the same millisecond — which is what the project wants for primary
 * keys (docs/CONVENTIONS.md 5).
 *
 * The counter sits in the LOW nibble of byte 6 and all of byte 7, immediately
 * after the timestamp, NOT at the end of the random tail: byte order is
 * lexicographic order, so a counter after the random bytes would only ever break a
 * tie the random bytes almost never produce. (An earlier revision put the whole
 * counter in the high nibble of byte 6, where the version field lives; the counter
 * was truncated to 4 bits, wrapped after 16 ids, and produced ids out of order.)
 *
 * PostgreSQL 18 ships `uuidv7()`. So that this slice also runs on PostgreSQL 17
 * (the version pinned in `.github/workflows/ci.yml`) the *application* generates
 * the id and the column default is only a fallback; see
 * `src/db/migrations/0003_demo_items.sql` and `0004_uuid_v7.sql`.
 */

/** 12-bit counter for ids created inside the same millisecond (wraps at 4096). */
const SEQUENCE_MASK = 0xfff;

let lastTimestamp = -1;
let sequence = 0;

export function uuidv7(now: number = Date.now()): string {
  let timestamp = now;

  if (timestamp === lastTimestamp) {
    sequence += 1;
    if (sequence > SEQUENCE_MASK) {
      // The counter for this millisecond is exhausted (4096 ids, RFC 9562 limits
      // the counter to the bits the version and variant fields leave free). Borrow
      // from the next millisecond instead of wrapping: wrapping would produce an
      // id that sorts before its predecessor. Ids stay unique and increasing; the
      // encoded timestamp is at most a few milliseconds ahead of the clock.
      timestamp += 1;
      sequence = 0;
    }
  } else if (timestamp < lastTimestamp) {
    // A clock that moved backwards must not break monotonicity either.
    sequence += 1;
    if (sequence > SEQUENCE_MASK) {
      timestamp = lastTimestamp + 1;
      sequence = 0;
    } else {
      timestamp = lastTimestamp;
    }
  } else {
    sequence = 0;
  }

  lastTimestamp = timestamp;

  const bytes = new Uint8Array(16);

  // Bytes 0..5: the 48-bit big-endian timestamp, written byte by byte so the
  // endianness is explicit rather than implied by a DataView call.
  const high = Math.floor(timestamp / 2 ** 32);
  const low = timestamp >>> 0;
  bytes[0] = (high >>> 8) & 0xff;
  bytes[1] = high & 0xff;
  bytes[2] = (low >>> 24) & 0xff;
  bytes[3] = (low >>> 16) & 0xff;
  bytes[4] = (low >>> 8) & 0xff;
  bytes[5] = low & 0xff;

  // Bytes 6..15: the counter, then random.
  const random = new Uint8Array(10);
  globalThis.crypto.getRandomValues(random);
  bytes.set(random, 6);

  // Version 7 in the high nibble of byte 6; the counter's low nibble next to it.
  bytes[6] = 0x70 | ((sequence >>> 8) & 0x0f);
  bytes[7] = sequence & 0xff;

  // RFC 4122 variant in the top two bits of byte 8.
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;

  return formatUuid(bytes);
}

const HEX: readonly string[] = Array.from({ length: 256 }, (_, index) =>
  index.toString(16).padStart(2, '0'),
);

function formatUuid(bytes: Uint8Array): string {
  const hex = Array.from(bytes, (byte) => HEX[byte]).join('');
  return (
    `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-` +
    `${hex.slice(16, 20)}-${hex.slice(20, 32)}`
  );
}

const UUID_V7_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export function isUuidV7(value: string): boolean {
  return UUID_V7_PATTERN.test(value);
}
