/** All lengths are millimetres. y is measured from the TOP edge of the cheque. */

export type FieldAlign = 'left' | 'right' | 'center';

export type FieldLayout = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  align: FieldAlign;
  fontPt: number;
  /** Default 700: the current Excel prints bold. */
  weight?: 400 | 700;
  /** Default 'rtl'. Use 'ltr' for dates and numbers that should anchor left. */
  dir?: 'rtl' | 'ltr';
};

/** Layouts are data (one per bank cheque design), never code. */
export type ChequeLayout = {
  name: string;
  widthMm: number;
  heightMm: number;
  fields: FieldLayout[];
  /** Scan of the blank cheque, used in preview only; never printed. */
  backgroundDataUrl?: string;
};

export type PaperMode =
  /** Page = the cheque. Default: the cheque is fed from the manual tray as a small sheet. */
  | { kind: 'custom' }
  /** Page = A4 landscape; the cheque's top-left corner sits at (originXMm, originYMm) on the page. */
  | { kind: 'a4'; originXMm: number; originYMm: number };

/** Per printer/tray calibration (DESIGN.md 5.2). */
export type PrinterProfile = {
  offsetXMm: number;
  offsetYMm: number;
  /** 1 = actual size. Only for printers that cannot be calibrated otherwise. */
  scale: number;
  paper: PaperMode;
};

export const DEFAULT_PROFILE: PrinterProfile = {
  offsetXMm: 0,
  offsetYMm: 0,
  scale: 1,
  paper: { kind: 'custom' },
};

export type RenderOptions = {
  /** print: text only. preview: adds the background scan and field frames. */
  mode: 'print' | 'preview';
  /** Four 4 mm squares at the cheque corners (5 mm inset). Calibration and geometry tests only. */
  registrationMarks?: boolean;
};

export type RenderInput = {
  layout: ChequeLayout;
  /** field id -> text, already formatted (amounts are decimal strings, never numbers). */
  values: Record<string, string>;
  profile?: PrinterProfile;
  options?: RenderOptions;
};
