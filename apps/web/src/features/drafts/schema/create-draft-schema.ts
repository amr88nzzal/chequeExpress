import { z } from 'zod';
import { SUPPORTED_CURRENCIES } from '../../../config/currencies';
import { validateMoney } from '../../../lib/money';

/**
 * ⚠️ MIGRATION (CONVENTIONS.md §16): this schema belongs in `packages/shared`
 * and must be the *same object* `apps/api` validates with, so the client and the
 * server cannot drift. The package does not exist yet, so it lives here, marked,
 * and is the only place the draft payload is described on this side.
 *
 * Language neutrality: `message` carries a stable ERROR CODE (`AMOUNT_FORMAT`),
 * never a sentence. `create-draft-form.tsx` maps the code to an i18n key, so the
 * shared schema stays translatable and reusable by the API.
 */
export const DRAFT_FORM_ERROR_CODES = {
  required: 'REQUIRED',
  amountRequired: 'AMOUNT_REQUIRED',
  amountFormat: 'AMOUNT_FORMAT',
  amountFractionDigits: 'AMOUNT_FRACTION_DIGITS',
  amountPositive: 'AMOUNT_NOT_POSITIVE',
  dueDateBeforeIssue: 'DUE_DATE_BEFORE_ISSUE',
} as const;

export type DraftFormErrorCode =
  (typeof DRAFT_FORM_ERROR_CODES)[keyof typeof DRAFT_FORM_ERROR_CODES];

/** Error code -> i18n key. Kept next to the schema so a new code cannot be forgotten. */
export const DRAFT_FORM_ERROR_KEYS: Readonly<Record<DraftFormErrorCode, string>> = {
  REQUIRED: 'draft.form.errors.required',
  AMOUNT_REQUIRED: 'draft.form.errors.amountRequired',
  AMOUNT_FORMAT: 'draft.form.errors.amountFormat',
  AMOUNT_FRACTION_DIGITS: 'draft.form.errors.amountFractionDigits',
  AMOUNT_NOT_POSITIVE: 'draft.form.errors.amountPositive',
  DUE_DATE_BEFORE_ISSUE: 'draft.form.errors.dueDateBeforeIssue',
};

const requiredString = (code: DraftFormErrorCode) => z.string().min(1, { message: code });

export const createDraftChequeSchema = z
  .object({
    companyId: requiredString(DRAFT_FORM_ERROR_CODES.required),
    bankAccountId: requiredString(DRAFT_FORM_ERROR_CODES.required),
    partyId: requiredString(DRAFT_FORM_ERROR_CODES.required),
    /**
     * A decimal STRING, never a number: `z.number()` is rejected outright so a
     * `Number` can never reach the payload (CONVENTIONS.md §6).
     */
    amount: z
      .string({ invalid_type_error: DRAFT_FORM_ERROR_CODES.amountFormat })
      .min(1, { message: DRAFT_FORM_ERROR_CODES.amountRequired }),
    currency: z.enum(SUPPORTED_CURRENCIES),
    issueDate: requiredString(DRAFT_FORM_ERROR_CODES.required),
    dueDate: requiredString(DRAFT_FORM_ERROR_CODES.required),
    description: z.string().max(280).optional(),
  })
  .superRefine((value, ctx) => {
    const money = validateMoney(value.amount, value.currency);
    if (!money.ok) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['amount'],
        message: money.issue,
      });
    }
    if (value.issueDate && value.dueDate && value.dueDate < value.issueDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['dueDate'],
        message: DRAFT_FORM_ERROR_CODES.dueDateBeforeIssue,
      });
    }
  });

export type CreateDraftChequeValues = z.infer<typeof createDraftChequeSchema>;

/** Resolves a validated error code to its i18n key, ignoring anything unknown. */
export function draftErrorKey(code: string | undefined): string | null {
  if (!code) return null;
  return code in DRAFT_FORM_ERROR_KEYS ? DRAFT_FORM_ERROR_KEYS[code as DraftFormErrorCode] : null;
}
