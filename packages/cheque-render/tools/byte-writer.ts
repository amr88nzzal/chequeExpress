/**
 * A growable big-endian byte writer with back-patching, used by the fixture font
 * builders.
 */
export class ByteWriter {
  private readonly bytes: number[] = [];

  uint8(value: number): void {
    this.bytes.push(value & 0xff);
  }

  int16(value: number): void {
    this.uint16(value < 0 ? value + 0x10000 : value);
  }

  uint16(value: number): void {
    this.uint8(value >> 8);
    this.uint8(value);
  }

  int32(value: number): void {
    this.uint32(value < 0 ? value + 0x100000000 : value);
  }

  uint32(value: number): void {
    this.uint8(value >>> 24);
    this.uint8(value >>> 16);
    this.uint8(value >>> 8);
    this.uint8(value);
  }

  tag(value: string): void {
    if (value.length !== 4) throw new Error(`tag must be 4 characters: ${value}`);
    for (let i = 0; i < 4; i += 1) this.uint8(value.charCodeAt(i));
  }

  raw(value: Uint8Array | readonly number[]): void {
    for (const byte of value) this.uint8(byte);
  }

  /** Overwrites a previously written big-endian uint16. */
  patchUint16At(offset: number, value: number): void {
    this.bytes[offset] = (value >> 8) & 0xff;
    this.bytes[offset + 1] = value & 0xff;
  }

  /** Overwrites a previously written big-endian uint32. */
  patchUint32At(offset: number, value: number): void {
    this.bytes[offset] = (value >>> 24) & 0xff;
    this.bytes[offset + 1] = (value >>> 16) & 0xff;
    this.bytes[offset + 2] = (value >>> 8) & 0xff;
    this.bytes[offset + 3] = value & 0xff;
  }

  get length(): number {
    return this.bytes.length;
  }

  toUint8Array(): Uint8Array {
    return Uint8Array.from(this.bytes);
  }
}

export function concat(parts: readonly Uint8Array[]): Uint8Array {
  let total = 0;
  for (const part of parts) total += part.length;
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

export function computeChecksum(data: Uint8Array): number {
  let sum = 0;
  for (let i = 0; i < data.length; i += 4) {
    const a = data[i] ?? 0;
    const b = data[i + 1] ?? 0;
    const c = data[i + 2] ?? 0;
    const d = data[i + 3] ?? 0;
    sum = (sum + ((a << 24) | (b << 16) | (c << 8) | d)) >>> 0;
  }
  return sum;
}
