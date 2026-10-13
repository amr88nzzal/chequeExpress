/** Millimetre <-> PDF point conversion. 1 pt = 1/72 in, 1 in = 25.4 mm. */

/** PDF points per millimetre. */
export const PT_PER_MM = 72 / 25.4;

export function mmToPt(mm: number): number {
  return mm * PT_PER_MM;
}

export function ptToMm(pt: number): number {
  return pt / PT_PER_MM;
}

/** A rectangle in millimetres, `y` measured from the TOP edge of the page. */
export interface BoxMm {
  readonly xMm: number;
  readonly yMm: number;
  readonly wMm: number;
  readonly hMm: number;
}

/** A rectangle in PDF points, `y` measured from the BOTTOM edge of the page. */
export interface BoxPt {
  readonly xPt: number;
  readonly yPt: number;
  readonly wPt: number;
  readonly hPt: number;
}

/**
 * Converts a top-left-origin millimetre box to a bottom-left-origin point box.
 * `pageHmm` is the page height, which is what makes the flip possible.
 */
export function boxMmToPt(box: BoxMm, pageHmm: number): BoxPt {
  return {
    xPt: mmToPt(box.xMm),
    yPt: mmToPt(pageHmm - (box.yMm + box.hMm)),
    wPt: mmToPt(box.wMm),
    hPt: mmToPt(box.hMm),
  };
}
