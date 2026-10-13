import { mockApi } from './mock-api';
import type { PermissionGrant } from '../permissions/types';
import type {
  BankAccount,
  Company,
  ConfirmPrintInput,
  ConfirmPrintResult,
  CreateDraftInput,
  CursorPage,
  CurrentUser,
  IssuedCheque,
  IssuedChequeQuery,
  Party,
  PrintContext,
} from './types';

/**
 * The HTTP surface the UI expects from `apps/api` (`/api/v1`).
 *
 * ⚠️ THIS IS THE ONLY SEAM. `mockApi` implements it locally today; when the API
 * is ready, add `http-api.ts` that implements the same interface and switch the
 * single binding below. No component imports the mock directly.
 */
export interface ApiClient {
  getCurrentUser(): Promise<CurrentUser>;
  listCompanies(): Promise<Company[]>;
  listBankAccounts(companyId?: string | null): Promise<BankAccount[]>;
  listParties(companyId?: string | null): Promise<Party[]>;
  listIssuedCheques(query: IssuedChequeQuery): Promise<CursorPage<IssuedCheque>>;
  createDraftCheque(input: CreateDraftInput): Promise<IssuedCheque>;
  getPrintContext(chequeId: string | null): Promise<PrintContext>;
  confirmPrint(input: ConfirmPrintInput): Promise<ConfirmPrintResult>;
}

export type { PermissionGrant };

/**
 * ⚠️ THE SINGLE BINDING TO REPLACE. Swap `mockApi` for the future `httpApi`
 * and the whole UI talks to `apps/api` — no screen imports a mock.
 */
export const api: ApiClient = mockApi;
