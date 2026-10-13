import { TextInput } from '@mantine/core';
import { fractionDigitsFor } from '../../../config/currencies';

export interface MoneyFieldProps {
  name: string;
  label: string;
  value: string;
  currency: string;
  placeholder?: string;
  /** Already-localised message; the field never formats or translates itself. */
  error?: string | null;
  hint?: string;
  disabled?: boolean;
  onChange: (value: string) => void;
  onBlur?: () => void;
}

/**
 * Amount input. The value is a decimal *string* end to end: `onChange` hands the
 * raw text to the form and validation happens in the shared Zod schema
 * (CONVENTIONS.md §6 — no `Number` on a money value, anywhere).
 */
export function MoneyField({
  name,
  label,
  value,
  currency,
  placeholder,
  error,
  hint,
  disabled,
  onChange,
  onBlur,
}: MoneyFieldProps) {
  return (
    <TextInput
      name={name}
      label={label}
      value={value}
      placeholder={placeholder}
      description={hint}
      error={error ?? undefined}
      disabled={disabled}
      inputMode="decimal"
      autoComplete="off"
      // Layout stays logical (`text-align: start`, logical padding); the class
      // only pins tabular figures so amounts line up in both directions.
      className="money-field"
      aria-label={label}
      data-currency={currency}
      data-fraction-digits={String(fractionDigitsFor(currency))}
      onChange={(event) => onChange(event.currentTarget.value)}
      onBlur={onBlur}
    />
  );
}
