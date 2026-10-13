import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { Button, Group, Select, SimpleGrid, Stack, Textarea, TextInput } from '@mantine/core';
import type { BankAccount, Company, Party } from '../../../api/types';
import {
  DEFAULT_CURRENCY,
  SUPPORTED_CURRENCIES,
  fractionDigitsFor,
} from '../../../config/currencies';
import {
  createDraftChequeSchema,
  draftErrorKey,
  type CreateDraftChequeValues,
} from '../schema/create-draft-schema';
import { MoneyField } from './money-field';

export interface CreateDraftFormProps {
  companies: readonly Company[];
  bankAccounts: readonly BankAccount[];
  parties: readonly Party[];
  initialValues?: Partial<CreateDraftChequeValues>;
  submitting?: boolean;
  onSubmit: (values: CreateDraftChequeValues) => void;
}

const DEFAULTS: CreateDraftChequeValues = {
  companyId: '',
  bankAccountId: '',
  partyId: '',
  amount: '',
  currency: DEFAULT_CURRENCY,
  issueDate: '',
  dueDate: '',
  description: '',
};

export function CreateDraftForm({
  companies,
  bankAccounts,
  parties,
  initialValues,
  submitting = false,
  onSubmit,
}: CreateDraftFormProps) {
  const { t } = useTranslation();
  const methods = useForm<CreateDraftChequeValues>({
    resolver: zodResolver(createDraftChequeSchema),
    defaultValues: { ...DEFAULTS, ...initialValues },
    mode: 'onSubmit',
  });

  const { control, register, handleSubmit, watch, formState } = methods;
  const currency = watch('currency');
  const digits = fractionDigitsFor(currency);

  /**
   * A Zod issue carries a stable code, never a sentence; this is the only place
   * the code becomes visible text (CONVENTIONS.md §4).
   */
  const messageFor = (code: string | undefined): string | undefined => {
    if (!code) return undefined;
    const key = draftErrorKey(code);
    return key ? t(key, { currency, digits }) : t('common.error');
  };

  const companyOptions = companies.map((company) => ({ value: company.id, label: company.name }));
  const accountOptions = bankAccounts.map((account) => ({
    value: account.id,
    label: `${account.bankName} — ${account.maskedAccountNumber}`,
  }));
  const partyOptions = parties.map((party) => ({ value: party.id, label: party.name }));
  const currencyOptions = SUPPORTED_CURRENCIES.map((code) => ({ value: code, label: code }));

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <Stack gap="md">
        <SimpleGrid cols={{ base: 1, sm: 2 }}>
          <Controller
            control={control}
            name="companyId"
            render={({ field, fieldState }) => (
              <Select
                label={t('draft.form.fields.company')}
                data={companyOptions}
                value={field.value || null}
                error={messageFor(fieldState.error?.message)}
                onChange={(next) => field.onChange(next ?? '')}
                onBlur={field.onBlur}
              />
            )}
          />
          <Controller
            control={control}
            name="bankAccountId"
            render={({ field, fieldState }) => (
              <Select
                searchable
                label={t('draft.form.fields.account')}
                data={accountOptions}
                value={field.value || null}
                error={messageFor(fieldState.error?.message)}
                onChange={(next) => field.onChange(next ?? '')}
                onBlur={field.onBlur}
              />
            )}
          />
          <Controller
            control={control}
            name="partyId"
            render={({ field, fieldState }) => (
              <Select
                searchable
                label={t('draft.form.fields.party')}
                data={partyOptions}
                value={field.value || null}
                error={messageFor(fieldState.error?.message)}
                onChange={(next) => field.onChange(next ?? '')}
                onBlur={field.onBlur}
              />
            )}
          />
          <Controller
            control={control}
            name="currency"
            render={({ field }) => (
              <Select
                label={t('draft.form.fields.currency')}
                data={currencyOptions}
                value={field.value}
                allowDeselect={false}
                onChange={(next) => field.onChange(next ?? DEFAULT_CURRENCY)}
                onBlur={field.onBlur}
              />
            )}
          />
          <Controller
            control={control}
            name="amount"
            render={({ field, fieldState }) => (
              <MoneyField
                name={field.name}
                label={t('draft.form.fields.amount')}
                placeholder={t('draft.form.placeholders.amount')}
                hint={t('draft.form.hints.amount', { currency, digits })}
                value={field.value}
                currency={currency}
                error={messageFor(fieldState.error?.message)}
                onChange={field.onChange}
                onBlur={field.onBlur}
              />
            )}
          />
          <TextInput
            type="date"
            label={t('draft.form.fields.issueDate')}
            error={messageFor(formState.errors.issueDate?.message)}
            {...register('issueDate')}
          />
          <TextInput
            type="date"
            label={t('draft.form.fields.dueDate')}
            error={messageFor(formState.errors.dueDate?.message)}
            {...register('dueDate')}
          />
        </SimpleGrid>
        <Textarea
          autosize
          minRows={2}
          label={t('draft.form.fields.description')}
          placeholder={t('draft.form.placeholders.description')}
          {...register('description')}
        />
        <Group justify="flex-end">
          <Button type="reset" variant="default" onClick={() => methods.reset()}>
            {t('draft.form.actions.cancel')}
          </Button>
          <Button type="submit" loading={submitting}>
            {t('draft.form.actions.submit')}
          </Button>
        </Group>
      </Stack>
    </form>
  );
}
