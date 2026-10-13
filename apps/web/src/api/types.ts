import type { PermissionGrant, RoleName } from '../permissions/types';
import type { Currency } from '../config/currencies';

/**
 * Wire types. They mirror the `{ data, meta }` envelope of CONVENTIONS.md §13;
 * once `packages/shared` exists these declarations are replaced by its Zod
 * schemas and the types are inferred from them.
 */

export interface ApiEnvelope<TData> {
  data: TData;
  meta?: Record<string, unknown>;
}

export interface CursorPage<TItem> {
  items: TItem[];
  nextCursor: string | null;
  total?: number;
}

export type ChequeStatus =
  | 'draft'
  | 'pending_approval'
  | 'approved'
  | 'printing'
  | 'printed'
  | 'delivered'
  | 'cashed'
  | 'cancelled'
  | 'damaged'
  | 'lost'
  | 'stopped';

export const CHEQUE_STATUSES: readonly ChequeStatus[] = [
  'draft',
  'pending_approval',
  'approved',
  'printing',
  'printed',
  'delivered',
  'cashed',
  'cancelled',
  'damaged',
  'lost',
  'stopped',
];

export function isChequeStatus(value: string | null | undefined): value is ChequeStatus {
  return value !== null && value !== undefined && CHEQUE_STATUSES.some((s) => s === value);
}

export type PartyType = 'company' | 'individual' | 'government';

export interface Company {
  id: string;
  name: string;
  currency: Currency;
}

export interface BankAccount {
  id: string;
  companyId: string;
  bankName: string;
  /** Account numbers are masked until the reveal permission is used (CONVENTIONS.md §14). */
  maskedAccountNumber: string;
  currency: Currency;
}

export interface Party {
  id: string;
  companyId: string | null;
  name: string;
  type: PartyType;
}

export interface IssuedCheque {
  id: string;
  companyId: string;
  bankAccountId: string;
  /** `null` while the cheque is still a draft: the number is reserved at print time. */
  chequeNumber: string | null;
  partyId: string;
  partyName: string;
  /** Decimal string, never a number. */
  amount: string;
  currency: Currency;
  issueDate: string;
  dueDate: string;
  status: ChequeStatus;
  description?: string;
}

export interface IssuedChequeQuery {
  status?: ChequeStatus | null;
  dueDateFrom?: string | null;
  dueDateTo?: string | null;
  bankAccountId?: string | null;
  partyId?: string | null;
  companyId?: string | null;
  cursor?: string | null;
  limit?: number;
}

export interface PrinterProfile {
  id: string;
  name: string;
  bankName: string;
  /** Unused by the mock; the real profile carries offsets in millimetres. */
  offsetXmm: string;
  offsetYmm: string;
}

export interface PrintContext {
  cheque: IssuedCheque;
  printer: PrinterProfile;
  /** Server-computed: the number the operator must find on the loaded leaf. */
  lastExpectedChequeNumber: string;
  /** Tafqeet is a server concern (`packages/words`); `null` until it is produced. */
  amountInWords: string | null;
}

export interface CreateDraftInput {
  companyId: string;
  bankAccountId: string;
  partyId: string;
  amount: string;
  currency: Currency;
  issueDate: string;
  dueDate: string;
  description?: string;
}

export interface ConfirmPrintInput {
  chequeId: string;
  loadedChequeNumberSuffix: string;
  /** CONVENTIONS.md §13: every operation that reserves or prints a number is idempotent. */
  idempotencyKey: string;
}

export interface ConfirmPrintResult {
  chequeId: string;
  status: ChequeStatus;
  printedChequeNumber: string;
}

export interface CurrentUser {
  userId: string;
  displayName: string;
  /** Display only — the UI never branches on a role name (CONVENTIONS.md §9). */
  roleName: RoleName;
  grants: PermissionGrant[];
}
