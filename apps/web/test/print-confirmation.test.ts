// @vitest-environment jsdom
import { createElement } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { renderWithProviders } from './test-utils';
import i18n from '../src/i18n';
import { en } from '../src/i18n/locales/en';
import { PrintConfirmation } from '../src/features/printing/components/print-confirmation';
import {
  chequeNumberSuffix,
  validateLoadedSuffix,
} from '../src/features/printing/lib/confirmation';

/** `340123` -> the operator must read `0123` on the leaf loaded in the printer. */
const EXPECTED_CHEQUE_NUMBER = '340123';
const EXPECTED_SUFFIX = '0123';

afterEach(cleanup);

describe('print confirmation of the loaded cheque number', () => {
  it('accepts the matching suffix and rejects a mismatched one', () => {
    expect(chequeNumberSuffix(EXPECTED_CHEQUE_NUMBER)).toBe(EXPECTED_SUFFIX);
    expect(validateLoadedSuffix(EXPECTED_SUFFIX, EXPECTED_CHEQUE_NUMBER)).toEqual({ ok: true });
    expect(validateLoadedSuffix('9999', EXPECTED_CHEQUE_NUMBER)).toEqual({
      ok: false,
      issue: 'PRINT_CONFIRM_MISMATCH',
    });
  });

  it('reports the exact failure: empty, wrong length or wrong digits', () => {
    expect(validateLoadedSuffix('', EXPECTED_CHEQUE_NUMBER)).toEqual({
      ok: false,
      issue: 'PRINT_CONFIRM_REQUIRED',
    });
    expect(validateLoadedSuffix('   ', EXPECTED_CHEQUE_NUMBER)).toEqual({
      ok: false,
      issue: 'PRINT_CONFIRM_REQUIRED',
    });
    expect(validateLoadedSuffix('312', EXPECTED_CHEQUE_NUMBER)).toEqual({
      ok: false,
      issue: 'PRINT_CONFIRM_LENGTH',
    });
    expect(validateLoadedSuffix('31234', EXPECTED_CHEQUE_NUMBER)).toEqual({
      ok: false,
      issue: 'PRINT_CONFIRM_LENGTH',
    });
  });

  it('accepts Arabic-Indic digits and separators in the printed number', () => {
    // `٠١٢٣` is what an Arabic keyboard produces for the same leaf.
    expect(validateLoadedSuffix('٠١٢٣', EXPECTED_CHEQUE_NUMBER)).toEqual({ ok: true });
    expect(validateLoadedSuffix('٠١٢٣', '340123/7')).toEqual({
      ok: false,
      issue: 'PRINT_CONFIRM_MISMATCH',
    });
    expect(chequeNumberSuffix('000123/45')).toBe('2345');
  });
});

describe('print confirmation form', () => {
  it('rejects a mismatched suffix and accepts a matching one', async () => {
    const confirmed: string[] = [];

    await renderWithProviders(
      createElement(PrintConfirmation, {
        expectedChequeNumber: EXPECTED_CHEQUE_NUMBER,
        onConfirm: (suffix: string) => {
          confirmed.push(suffix);
        },
      }),
      { language: 'en' },
    );

    const input = screen.getByRole('textbox', {
      name: i18n.t('print.confirm.field', { digits: 4 }),
    });
    const submit = screen.getByRole('button', { name: en.print.confirm.actions.confirm });

    fireEvent.change(input, { target: { value: '9999' } });
    fireEvent.click(submit);

    await waitFor(() => {
      expect(screen.getByText(en.print.confirm.errors.mismatch)).toBeTruthy();
    });
    // A wrong suffix must not send anything to the printer.
    expect(confirmed).toHaveLength(0);

    fireEvent.change(input, { target: { value: EXPECTED_SUFFIX } });
    fireEvent.click(submit);

    await waitFor(() => {
      expect(confirmed).toEqual([EXPECTED_SUFFIX]);
    });
    expect(screen.queryByText(en.print.confirm.errors.mismatch)).toBeNull();
  });

  it('rejects an empty suffix with the "required" message', async () => {
    const confirmed: string[] = [];

    await renderWithProviders(
      createElement(PrintConfirmation, {
        expectedChequeNumber: EXPECTED_CHEQUE_NUMBER,
        onConfirm: (suffix: string) => {
          confirmed.push(suffix);
        },
      }),
      { language: 'ar' },
    );

    fireEvent.click(screen.getByRole('button', { name: i18n.t('print.confirm.actions.confirm') }));

    await waitFor(() => {
      expect(screen.getByText(i18n.t('print.confirm.errors.required', { digits: 4 }))).toBeTruthy();
    });
    expect(confirmed).toHaveLength(0);
  });
});
