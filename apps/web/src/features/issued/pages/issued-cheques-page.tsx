import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Button, Card, Group, Stack, Text, Title } from '@mantine/core';
import { usePermissions } from '../../../permissions/permissions-context';
import { useBankAccounts, useParties } from '../../../hooks/use-reference-data';
import {
  EMPTY_ISSUED_FILTERS,
  useIssuedCheques,
  type IssuedChequeFilters,
} from '../hooks/use-issued-cheques';
import { IssuedFilters } from '../components/issued-filters';
import { IssuedChequesTable } from '../components/issued-cheques-table';
import { ChevronDownIcon } from '../../../components/icons';
import { LoadingState } from '../../../components/loading-state';

export function IssuedChequesPage() {
  const { t } = useTranslation();
  const { scope } = usePermissions();
  const companyId = scope.kind === 'tenant' ? null : scope.companyId;

  const [filters, setFilters] = useState<IssuedChequeFilters>(EMPTY_ISSUED_FILTERS);

  const accountsQuery = useBankAccounts(companyId);
  const partiesQuery = useParties(companyId);
  const chequesQuery = useIssuedCheques(filters, companyId);

  const cheques = chequesQuery.data?.items ?? [];
  const total = chequesQuery.data?.total ?? null;
  const isLoading = chequesQuery.isPending || accountsQuery.isPending || partiesQuery.isPending;
  const isError = chequesQuery.isError || accountsQuery.isError || partiesQuery.isError;

  return (
    <Stack gap="md">
      <div>
        <Title order={2}>{t('issued.list.title')}</Title>
        <Text c="dimmed" size="sm">
          {t('issued.list.subtitle')}
        </Text>
      </div>

      <Card withBorder padding="md">
        <IssuedFilters
          value={filters}
          onChange={setFilters}
          accounts={accountsQuery.data ?? []}
          parties={partiesQuery.data ?? []}
        />
      </Card>

      {isError && (
        <Alert color="red" title={t('issued.list.error')}>
          <Group justify="space-between">
            <Text size="sm">{t('common.error')}</Text>
            <Button size="compact-sm" variant="light" onClick={() => void chequesQuery.refetch()}>
              {t('common.retry')}
            </Button>
          </Group>
        </Alert>
      )}

      {isLoading && <LoadingState labelKey="issued.list.loading" />}

      {!isLoading && !isError && cheques.length === 0 && (
        <Alert color="gray" title={t('issued.list.empty')} />
      )}

      {!isLoading && !isError && cheques.length > 0 && (
        <Card withBorder padding="md">
          <IssuedChequesTable cheques={cheques} accounts={accountsQuery.data ?? []} />
          <Group justify="space-between" mt="md">
            <Text size="sm" c="dimmed">
              {t('common.loadedOfTotal', {
                loaded: cheques.length,
                total: total ?? t('common.unknown'),
              })}
            </Text>
            {chequesQuery.hasNextPage && (
              <Button
                variant="light"
                loading={chequesQuery.isFetchingNextPage}
                onClick={() => void chequesQuery.fetchNextPage()}
              >
                <span className="button-content">
                  <span>{t('issued.list.loadMore')}</span>
                  <ChevronDownIcon />
                </span>
              </Button>
            )}
          </Group>
        </Card>
      )}
    </Stack>
  );
}
