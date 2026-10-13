/**
 * ⚠️ MOCK API — THE ONLY PLACE THAT FABRICATES DATA ⚠️
 *
 * `apps/api` is not ready, so this module implements the `ApiClient` interface
 * with deterministic in-memory fixtures. Everything the screens read comes from
 * here; no component and no hook holds a fixture of its own.
 *
 * REPLACING IT IS A ONE-FILE CHANGE:
 *   1. add `src/api/http-api.ts` that implements `ApiClient` against
 *      `/api/v1` (fetch + the `{ data, meta }` envelope of CONVENTIONS.md §13);
 *   2. repoint the single `api` binding in `src/api/client.ts`;
 *   3. delete this file. Nothing else imports it.
 *
 * Determinism: no `Math.random`, no `new Date()` — the fixture set is a pure
 * function of the index, so the same screens and the same tests always see the
 * same cheques.
 */
import type { ApiClient } from './client';
import type {
  BankAccount,
  ChequeStatus,
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
  PrinterProfile,
} from './types';
import { grantsForRole } from '../permissions/seed';

const COMPANIES: readonly Company[] = [
  { id: 'cmp-arabi', name: 'شركة الاتحاد التجارية', currency: 'JOD' },
  { id: 'cmp-sharq', name: 'مؤسسة الشرق للمقاولات', currency: 'JOD' },
];

const BANK_ACCOUNTS: readonly BankAccount[] = [
  {
    id: 'acc-arabi-jod',
    companyId: 'cmp-arabi',
    bankName: 'البنك العربي',
    maskedAccountNumber: '**** **** **** 4417',
    currency: 'JOD',
  },
  {
    id: 'acc-arabi-usd',
    companyId: 'cmp-arabi',
    bankName: 'البنك العربي — حساب دولار',
    maskedAccountNumber: '**** **** **** 9032',
    currency: 'USD',
  },
  {
    id: 'acc-sharq-jod',
    companyId: 'cmp-sharq',
    bankName: 'بنك الإسكان',
    maskedAccountNumber: '**** **** **** 1188',
    currency: 'JOD',
  },
];

const PARTIES: readonly Party[] = [
  { id: 'pty-noor', companyId: 'cmp-arabi', name: 'شركة النور للتوريدات', type: 'company' },
  { id: 'pty-khalil', companyId: null, name: 'خليل إبراهيم العمري', type: 'individual' },
  { id: 'pty-gov', companyId: null, name: 'دائرة ضريبة الدخل والمبيعات', type: 'government' },
  { id: 'pty-salam', companyId: 'cmp-sharq', name: 'مؤسسة السلام للنقل', type: 'company' },
];

const PRINTERS: readonly PrinterProfile[] = [
  {
    id: 'prn-arabi-1',
    name: 'Arabi Cheque Printer',
    bankName: 'البنك العربي',
    offsetXmm: '0.00',
    offsetYmm: '0.00',
  },
  {
    id: 'prn-housing-1',
    name: 'Housing Cheque Printer',
    bankName: 'بنك الإسكان',
    offsetXmm: '0.35',
    offsetYmm: '-0.20',
  },
];

/** Decimal strings only — never `number` (CONVENTIONS.md §6). */
const AMOUNT_POOL: readonly string[] = [
  '515.000',
  '1250.750',
  '999.999',
  '12.250',
  '4800.500',
  '75.125',
  '3355.515',
  '240.000',
];

const DESCRIPTION_POOL: readonly string[] = [
  'دفعة أولى عقد توريد',
  'أتعاب استشارات',
  'توريد مواد بناء',
  'إيجار مستودع',
  'أمر صرف داخلي',
];

const STATUS_POOL: readonly ChequeStatus[] = [
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

function isoDate(year: number, month: number, day: number): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${String(year).padStart(4, '0')}-${pad(month)}-${pad(day)}`;
}

function buildCheques(): IssuedCheque[] {
  const cheques: IssuedCheque[] = [];
  for (let index = 0; index < 24; index += 1) {
    const status = STATUS_POOL[index % STATUS_POOL.length];
    const account = BANK_ACCOUNTS[index % BANK_ACCOUNTS.length];
    const party = PARTIES[index % PARTIES.length];
    // The number exists only once the leaf has been reserved (status past draft).
    const chequeNumber = status === 'draft' ? null : String(345_000 + index * 7).padStart(6, '0');
    cheques.push({
      id: `chq-${String(index + 1).padStart(3, '0')}`,
      companyId: account.companyId,
      bankAccountId: account.id,
      chequeNumber,
      partyId: party.id,
      partyName: party.name,
      amount: AMOUNT_POOL[index % AMOUNT_POOL.length],
      currency: account.currency,
      issueDate: isoDate(2026, 8 + (index % 2), 1 + (index % 27)),
      dueDate: isoDate(2026, 10 + Math.floor(index / 18), 1 + ((index * 3) % 27)),
      status,
      description: DESCRIPTION_POOL[index % DESCRIPTION_POOL.length],
    });
  }
  return cheques;
}

const CHEQUES: IssuedCheque[] = buildCheques();

function matchesFilters(cheque: IssuedCheque, query: IssuedChequeQuery): boolean {
  if (query.companyId && cheque.companyId !== query.companyId) return false;
  if (query.status && cheque.status !== query.status) return false;
  if (query.dueDateFrom && cheque.dueDate < query.dueDateFrom) return false;
  if (query.dueDateTo && cheque.dueDate > query.dueDateTo) return false;
  if (query.bankAccountId && cheque.bankAccountId !== query.bankAccountId) return false;
  if (query.partyId && cheque.partyId !== query.partyId) return false;
  return true;
}

const DEFAULT_PAGE_SIZE = 10;

function paginate<TItem>(
  items: readonly TItem[],
  cursor: string | null,
  limit: number,
): CursorPage<TItem> {
  const offset = cursor ? Number.parseInt(cursor, 10) : 0;
  const start = Number.isFinite(offset) && offset > 0 ? offset : 0;
  const page = items.slice(start, start + limit);
  const consumed = start + page.length;
  return {
    items: page,
    nextCursor: consumed < items.length ? String(consumed) : null,
    total: items.length,
  };
}

function nextExpectedChequeNumber(cheque: IssuedCheque): string {
  if (cheque.chequeNumber) return cheque.chequeNumber;
  // A draft has no reserved leaf yet; the printing service would reserve one.
  return String(345_168).padStart(6, '0');
}

export const mockApi: ApiClient = {
  async getCurrentUser(): Promise<CurrentUser> {
    return {
      userId: 'usr-admin',
      displayName: 'مدير النظام',
      roleName: 'admin',
      grants: grantsForRole('admin'),
    };
  },

  async listCompanies(): Promise<Company[]> {
    return COMPANIES.map((company) => ({ ...company }));
  },

  async listBankAccounts(companyId?: string | null): Promise<BankAccount[]> {
    const accounts = companyId
      ? BANK_ACCOUNTS.filter((account) => account.companyId === companyId)
      : BANK_ACCOUNTS;
    return accounts.map((account) => ({ ...account }));
  },

  async listParties(companyId?: string | null): Promise<Party[]> {
    // Tenant-wide parties (companyId === null) are visible to every company.
    const parties = companyId
      ? PARTIES.filter((party) => party.companyId === null || party.companyId === companyId)
      : PARTIES;
    return parties.map((party) => ({ ...party }));
  },

  async listIssuedCheques(query: IssuedChequeQuery): Promise<CursorPage<IssuedCheque>> {
    const filtered = CHEQUES.filter((cheque) => matchesFilters(cheque, query)).sort(
      (left, right) => (left.dueDate < right.dueDate ? -1 : left.dueDate > right.dueDate ? 1 : 0),
    );
    const page = paginate(filtered, query.cursor ?? null, query.limit ?? DEFAULT_PAGE_SIZE);
    return { ...page, items: page.items.map((cheque) => ({ ...cheque })) };
  },

  async createDraftCheque(input: CreateDraftInput): Promise<IssuedCheque> {
    const party = PARTIES.find((candidate) => candidate.id === input.partyId);
    const cheque: IssuedCheque = {
      id: `chq-${String(CHEQUES.length + 1).padStart(3, '0')}`,
      companyId: input.companyId,
      bankAccountId: input.bankAccountId,
      chequeNumber: null,
      partyId: input.partyId,
      partyName: party?.name ?? '',
      amount: input.amount,
      currency: input.currency,
      issueDate: input.issueDate,
      dueDate: input.dueDate,
      status: 'draft',
      description: input.description,
    };
    CHEQUES.unshift(cheque);
    return { ...cheque };
  },

  async getPrintContext(chequeId: string | null): Promise<PrintContext> {
    const cheque =
      (chequeId ? CHEQUES.find((candidate) => candidate.id === chequeId) : undefined) ??
      CHEQUES.find((candidate) => candidate.status === 'printing') ??
      CHEQUES[0];
    const account = BANK_ACCOUNTS.find((candidate) => candidate.id === cheque.bankAccountId);
    const printer =
      PRINTERS.find((candidate) => candidate.bankName === account?.bankName) ?? PRINTERS[0];
    return {
      cheque: { ...cheque },
      printer: { ...printer },
      lastExpectedChequeNumber: nextExpectedChequeNumber(cheque),
      // Tafqeet (amount in words) is a server responsibility: `packages/words`
      // is pure and has no place in the bundle. The mock returns nothing and the
      // screen shows the "produced at print time" note instead of inventing text.
      amountInWords: null,
    };
  },

  async confirmPrint(input: ConfirmPrintInput): Promise<ConfirmPrintResult> {
    const cheque = CHEQUES.find((candidate) => candidate.id === input.chequeId);
    if (!cheque) {
      throw new Error('CHEQUE_NOT_FOUND');
    }
    const expected = nextExpectedChequeNumber(cheque);
    // The server re-checks what the operator typed (CONVENTIONS.md §11); the
    // client-side check is only there to save a round trip.
    if (!expected.endsWith(input.loadedChequeNumberSuffix)) {
      throw new Error('PRINT_CONFIRM_MISMATCH');
    }
    cheque.status = 'printed';
    cheque.chequeNumber = expected;
    return { chequeId: cheque.id, status: cheque.status, printedChequeNumber: expected };
  },
};
