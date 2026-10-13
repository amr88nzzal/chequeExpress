/**
 * Page geometry, and the ONE place where the printer offset is applied.
 *
 * Project rule (DESIGN 5.2): `(dxMm, dyMm)` is applied in exactly one place, so
 * it cannot be applied twice by accident. That place is `resolveGeometry`.
 *
 * The page is always the requested size: `custom` uses the layout's own
 * millimetres, `a4` uses 210x297 mm. Offsetting the cheque inside that page can
 * push content past an edge, and the rule is that content is CLIPPED at the
 * page edge - never that the page grows, shrinks or re-scales. That failure
 * (Chromium silently shrinking the page when content overflowed) is why these
 * numbers are asserted in the tests rather than trusted.
 */
import { InvalidLayoutError, InvalidProfileError } from './errors.ts';
import type { ChequeLayout, PrinterProfile } from './types.ts';
import { A4_HEIGHT_MM, A4_WIDTH_MM } from './types.ts';

export interface PageGeometry {
  /** Page width in millimetres. */
  readonly pageWidthMm: number;
  /** Page height in millimetres. */
  readonly pageHeightMm: number;
  /**
   * Where the cheque's top-left corner lands on the page, offset applied.
   * Only values inside `[0, page]` can carry ink; anything beyond is clipped.
   */
  readonly contentXMm: number;
  readonly contentYMm: number;
  /** The offset that was applied, echoed for diagnostics. */
  readonly offsetXMm: number;
  readonly offsetYMm: number;
  /**
   * The scale that was accepted. Carried for diagnostics only: the page is always
   * the cheque's own millimetre size, so `scale !== 1` currently changes nothing.
   * A printer that genuinely needs scaling must be handled by the print pipeline,
   * not by redefining the paper size.
   */
  readonly scale: number;
  readonly paperMode: 'custom' | 'a4';
}

export function resolveGeometry(layout: ChequeLayout, profile: PrinterProfile): PageGeometry {
  validateLayout(layout);
  validateProfile(profile);
  const scale = profile.scale ?? 1;
  const offsetXMm = profile.dxMm;
  const offsetYMm = profile.dyMm;
  const isA4 = profile.paperMode === 'a4';
  const pageWidthMm = isA4 ? A4_WIDTH_MM : layout.widthMm;
  const pageHeightMm = isA4 ? A4_HEIGHT_MM : layout.heightMm;
  const originXMm = isA4 ? (profile.originXMm ?? 0) : 0;
  const originYMm = isA4 ? (profile.originYMm ?? 0) : 0;
  return {
    pageWidthMm,
    pageHeightMm,
    contentXMm: originXMm + offsetXMm,
    contentYMm: originYMm + offsetYMm,
    offsetXMm,
    offsetYMm,
    scale,
    paperMode: profile.paperMode,
  };
}

export function validateLayout(layout: ChequeLayout): void {
  if (!Number.isFinite(layout.widthMm) || layout.widthMm <= 0) {
    throw new InvalidLayoutError(
      'layout.widthMm must be a positive number of millimetres',
      'widthMm',
    );
  }
  if (!Number.isFinite(layout.heightMm) || layout.heightMm <= 0) {
    throw new InvalidLayoutError(
      'layout.heightMm must be a positive number of millimetres',
      'heightMm',
    );
  }
  if (!Array.isArray(layout.fields)) {
    throw new InvalidLayoutError('layout.fields must be an array', 'fields');
  }
  const seen = new Set<string>();
  for (const field of layout.fields) {
    if (typeof field.id !== 'string' || field.id.length === 0) {
      throw new InvalidLayoutError('every field needs a non-empty id', 'fields');
    }
    if (seen.has(field.id)) {
      throw new InvalidLayoutError('field ids must be unique', field.id);
    }
    seen.add(field.id);
  }
}

export function validateProfile(profile: PrinterProfile): void {
  if (profile.paperMode !== 'custom' && profile.paperMode !== 'a4') {
    throw new InvalidProfileError(
      `unsupported paperMode ${String(profile.paperMode)}`,
      'paperMode',
    );
  }
  for (const [key, value] of [
    ['dxMm', profile.dxMm],
    ['dyMm', profile.dyMm],
    ['originXMm', profile.originXMm],
    ['originYMm', profile.originYMm],
    ['scale', profile.scale],
  ] as const) {
    if (value !== undefined && !Number.isFinite(value)) {
      throw new InvalidProfileError(`${key} must be a finite number`, key);
    }
  }
  if (profile.scale !== undefined && profile.scale <= 0) {
    throw new InvalidProfileError('scale must be greater than zero', 'scale');
  }
}

/** Clamps a value to an inclusive range. */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
