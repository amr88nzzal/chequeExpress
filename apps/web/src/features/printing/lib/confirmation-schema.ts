import { z } from 'zod';
import { validateLoadedSuffix, CONFIRMATION_DIGITS } from './confirmation';

/**
 * ⚠️ MIGRATION (CONVENTIONS.md §16): like the draft schema, this one belongs in
 * `packages/shared` so `apps/api` validates the very same object. It carries
 * error *codes* only; `print-confirmation.tsx` maps them to i18n keys.
 */
export function createPrintConfirmationSchema(
  expectedChequeNumber: string,
  digits: number = CONFIRMATION_DIGITS,
) {
  return z
    .object({
      loadedSuffix: z.string(),
    })
    .superRefine((value, ctx) => {
      const result = validateLoadedSuffix(value.loadedSuffix, expectedChequeNumber, digits);
      if (!result.ok) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['loadedSuffix'],
          message: result.issue,
        });
      }
    });
}

export type PrintConfirmationValues = z.infer<ReturnType<typeof createPrintConfirmationSchema>>;
