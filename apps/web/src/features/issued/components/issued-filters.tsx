import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Group, Select, TextInput } from '@mantine/core';
import type { BankAccount, Party } from '../../../api/types';
import { CHEQUE_STATUSES, isChequeStatus } from '../../../api/types';
import type { IssuedChequeFilters } from '../hooks/use-issued-cheques';
import { EMPTY_ISSUED_FILTERS } from '../hooks/use-issued-cheques';

export interface IssuedFiltersProps {
  value: IssuedChequeFilters;
  onChange: (next: IssuedChequeFilters) => void;
  accounts: readonly BankAccount[];
  parties: readonly Party[];
}

/**
 * Every label is an i18n key: status option labels come from `issued.status.*`,
 * and the enum values themselves stay English `snake_case` (CONVENTIONS.md §4).
 */
export function IssuedFilters({ value, onChange, accounts, parties }: IssuedFiltersProps) {
  const { t } = useTranslation();

  const statusOptions = useMemo(
    () =>
      CHEQUE_STATUSES.map((status) => ({
        value: status,
        label: t(`issued.status.${status}`),
      })),
    [t],
  );

  const accountOptions = useMemo(
    () =>
      accounts.map((account) => ({
        value: account.id,
        label: `${account.bankName} — ${account.maskedAccountNumber}`,
      })),
    [accounts],
  );

  const partyOptions = useMemo(
    () => parties.map((party) => ({ value: party.id, label: party.name })),
    [parties],
  );

  return (
    <Group align="flex-end" gap="sm" wrap="wrap">
      <Select
        w={200}
        clearable
        label={t('issued.list.filters.status')}
        placeholder={t('common.any')}
        data={statusOptions}
        value={value.status}
        onChange={(next) => onChange({ ...value, status: isChequeStatus(next) ? next : null })}
      />
      <TextInput
        w={170}
        type="date"
        label={t('issued.list.filters.dueDateFrom')}
        value={value.dueDateFrom ?? ''}
        onChange={(event) => onChange({ ...value, dueDateFrom: event.currentTarget.value || null })}
      />
      <TextInput
        w={170}
        type="date"
        label={t('issued.list.filters.dueDateTo')}
        value={value.dueDateTo ?? ''}
        onChange={(event) => onChange({ ...value, dueDateTo: event.currentTarget.value || null })}
      />
      <Select
        w={260}
        clearable
        searchable
        label={t('issued.list.filters.account')}
        placeholder={t('common.any')}
        data={accountOptions}
        value={value.bankAccountId}
        onChange={(next) => onChange({ ...value, bankAccountId: next })}
      />
      <Select
        w={220}
        clearable
        searchable
        label={t('issued.list.filters.party')}
        placeholder={t('common.any')}
        data={partyOptions}
        value={value.partyId}
        onChange={(next) => onChange({ ...value, partyId: next })}
      />
      <Button variant="subtle" onClick={() => onChange({ ...EMPTY_ISSUED_FILTERS })}>
        {t('common.reset')}
      </Button>
    </Group>
  );
}
