// @vitest-environment jsdom
import { createElement } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { renderWithProviders } from './test-utils';
import { en } from '../src/i18n/locales/en';
import i18n from '../src/i18n';
import type { BankAccount, Company, Party } from '../src/api/types';
import { CreateDraftForm } from '../src/features/drafts/components/create-draft-form';
import {
  createDraftChequeSchema,
  type CreateDraftChequeValues,
} from '../src/features/drafts/schema/create-draft-schema';
import { validateMoney } from '../src/lib/money';

afterEach(cleanup);

const VALID_DRAFT = {
  companyId: 'cmp-arabi',
  bankAccountId: 'acc-arabi-jod',
  partyId: 'pty-noor',
  currency: 'JOD' as const,
  issueDate: '2026-10-05',
  dueDate: '2026-11-05',
};

const COMPANIES: Company[] = [{ id: 'cmp-arabi', name: 'Al Ittihad Trading', currency: 'JOD' }];
const ACCOUNTS: BankAccount[] = [
  {
    id: 'acc-arabi-jod',
    companyId: 'cmp-arabi',
    bankName: 'Arab Bank',
    maskedAccountNumber: '**** 4417',
    currency: 'JOD',
  },
];
const PARTIES: Party[] = [
  { id: 'pty-noor', companyId: 'cmp-arabi', name: 'Al Noor Supplies', type: 'company' },
];

function firstIssueMessage(input: unknown): string | undefined {
  const result = createDraftChequeSchema.safeParse(input);
  return result.success ? undefined : result.error.issues[0]?.message;
}

describe('money validation per currency', () => {
  it('accepts up to three fraction digits for JOD', () => {
    expect(validateMoney('5.123', 'JOD').ok).toBe(true);
    expect(createDraftChequeSchema.safeParse({ ...VALID_DRAFT, amount: '5.123' }).success).toBe(
      true,
    );
  });

  it('rejects four fraction digits for JOD with the fraction-digits code', () => {
    const rejected = validateMoney('5.1234', 'JOD');
    expect(rejected.ok).toBe(false);
    if (!rejected.ok) {
      expect(rejected.issue).toBe('AMOUNT_FRACTION_DIGITS');
      expect(rejected.expectedFractionDigits).toBe(3);
    }
    expect(firstIssueMessage({ ...VALID_DRAFT, amount: '5.1234' })).toBe('AMOUNT_FRACTION_DIGITS');
  });

  it('applies the currency it is given, not a global default (USD = 2)', () => {
    expect(
      createDraftChequeSchema.safeParse({ ...VALID_DRAFT, currency: 'USD', amount: '5.12' })
        .success,
    ).toBe(true);
    expect(firstIssueMessage({ ...VALID_DRAFT, currency: 'USD', amount: '5.123' })).toBe(
      'AMOUNT_FRACTION_DIGITS',
    );
  });

  it('rejects a number, grouping separators and a non-positive amount', () => {
    expect(firstIssueMessage({ ...VALID_DRAFT, amount: 5.123 })).toBe('AMOUNT_FORMAT');
    expect(firstIssueMessage({ ...VALID_DRAFT, amount: '1,250.000' })).toBe('AMOUNT_FORMAT');
    expect(firstIssueMessage({ ...VALID_DRAFT, amount: '5.12.3' })).toBe('AMOUNT_FORMAT');
    expect(firstIssueMessage({ ...VALID_DRAFT, amount: '0' })).toBe('AMOUNT_NOT_POSITIVE');
    expect(firstIssueMessage({ ...VALID_DRAFT, amount: '' })).toBe('AMOUNT_REQUIRED');
  });

  it('accepts Arabic-Indic digits typed on an Arabic keyboard', () => {
    expect(validateMoney('٥٫١٢٣', 'JOD')).toEqual({ ok: true, value: '5.123' });
  });
});

describe('money field in the draft form', () => {
  it('rejects "5.1234" for JOD and accepts "5.123"', async () => {
    const submitted: CreateDraftChequeValues[] = [];

    await renderWithProviders(
      createElement(CreateDraftForm, {
        companies: COMPANIES,
        bankAccounts: ACCOUNTS,
        parties: PARTIES,
        initialValues: {
          companyId: 'cmp-arabi',
          bankAccountId: 'acc-arabi-jod',
          partyId: 'pty-noor',
          currency: 'JOD',
          issueDate: '2026-10-05',
          dueDate: '2026-11-05',
        },
        onSubmit: (values) => {
          submitted.push(values);
        },
      }),
      { language: 'en' },
    );

    const amount = screen.getByRole('textbox', { name: en.draft.form.fields.amount });
    const submit = screen.getByRole('button', { name: en.draft.form.actions.submit });
    const fractionError = i18n.t('draft.form.errors.amountFractionDigits', {
      currency: 'JOD',
      digits: 3,
    });

    fireEvent.change(amount, { target: { value: '5.1234' } });
    fireEvent.click(submit);

    await waitFor(() => {
      expect(screen.getByText(fractionError)).toBeTruthy();
    });
    // The user asked for four digits; nothing may reach the API.
    expect(submitted).toHaveLength(0);

    fireEvent.change(amount, { target: { value: '5.123' } });
    fireEvent.click(submit);

    await waitFor(() => {
      expect(submitted).toHaveLength(1);
    });
    expect(submitted[0]?.amount).toBe('5.123');
    expect(screen.queryByText(fractionError)).toBeNull();
  });
});
