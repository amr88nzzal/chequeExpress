import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Alert, Card, Stack, Text, Title } from '@mantine/core';
import { api } from '../../../api/client';
import { queryKeys } from '../../../api/query-keys';
import type { CreateDraftInput } from '../../../api/types';
import { usePermissions } from '../../../permissions/permissions-context';
import { useBankAccounts, useCompanies, useParties } from '../../../hooks/use-reference-data';
import { CreateDraftForm } from '../components/create-draft-form';
import { LoadingState } from '../../../components/loading-state';
import type { CreateDraftChequeValues } from '../schema/create-draft-schema';

export function CreateDraftPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { scope } = usePermissions();
  const companyId = scope.kind === 'tenant' ? null : scope.companyId;

  const companiesQuery = useCompanies();
  const accountsQuery = useBankAccounts(companyId);
  const partiesQuery = useParties(companyId);

  const mutation = useMutation({
    mutationFn: (values: CreateDraftChequeValues) =>
      api.createDraftCheque(toDraftInput(values, companyId)),
    onSuccess: () => {
      // The list is server state: refresh every issued-cheques query instead of
      // copying the new row into local state (CONVENTIONS.md §16).
      void queryClient.invalidateQueries({ queryKey: queryKeys.issuedChequesAll });
    },
  });

  const initialValues = useMemo(
    () => ({
      companyId: companyId ?? companiesQuery.data?.[0]?.id ?? '',
    }),
    [companyId, companiesQuery.data],
  );

  const isLoading = companiesQuery.isPending || accountsQuery.isPending || partiesQuery.isPending;

  return (
    <Stack gap="md">
      <div>
        <Title order={2}>{t('draft.title')}</Title>
        <Text c="dimmed" size="sm">
          {t('draft.subtitle')}
        </Text>
      </div>

      {mutation.isSuccess && <Alert color="green">{t('draft.success')}</Alert>}
      {mutation.isError && <Alert color="red">{t('common.error')}</Alert>}

      <Card withBorder padding="md">
        <Title order={3} mb="md">
          {t('draft.form.title')}
        </Title>
        {isLoading ? (
          <LoadingState />
        ) : (
          <CreateDraftForm
            companies={companiesQuery.data ?? []}
            bankAccounts={accountsQuery.data ?? []}
            parties={partiesQuery.data ?? []}
            initialValues={initialValues}
            submitting={mutation.isPending}
            onSubmit={(values) => mutation.mutate(values)}
          />
        )}
      </Card>
    </Stack>
  );
}

/**
 * The form works with the tenant's active company; when the user is in
 * "all companies" scope the company chosen in the form wins.
 */
function toDraftInput(
  values: CreateDraftChequeValues,
  activeCompanyId: string | null,
): CreateDraftInput {
  return {
    companyId: activeCompanyId ?? values.companyId,
    bankAccountId: values.bankAccountId,
    partyId: values.partyId,
    amount: values.amount,
    currency: values.currency,
    issueDate: values.issueDate,
    dueDate: values.dueDate,
    description: values.description,
  };
}
