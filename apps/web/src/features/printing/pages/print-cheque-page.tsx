import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Alert, Anchor, Badge, Button, Card, Group, Stack, Text, Title } from '@mantine/core';
import { api } from '../../../api/client';
import { queryKeys } from '../../../api/query-keys';
import type { ConfirmPrintResult } from '../../../api/types';
import { useFormatSettings } from '../../../config/settings-context';
import { formatMoney } from '../../../lib/format';
import { PRINT_CHEQUE_ID_PARAM, ROUTES } from '../../../lib/paths';
import { createIdempotencyKey } from '../../../lib/idempotency';
import { LoadingState } from '../../../components/loading-state';
import { CONFIRMATION_DIGITS } from '../lib/confirmation';
import { ChequePreview } from '../components/cheque-preview';
import { PrintConfirmation } from '../components/print-confirmation';
import { ChevronForwardIcon, PrinterIcon } from '../../../components/icons';

/**
 * The print screen always shows the four things CONVENTIONS.md §16 requires
 * before anything is sent: the cheque, the printer, the last expected cheque
 * number, and the preview — plus the typed confirmation of the loaded leaf.
 */
export function PrintChequePage() {
  const { t } = useTranslation();
  const settings = useFormatSettings();
  const [searchParams] = useSearchParams();
  const chequeId = searchParams.get(PRINT_CHEQUE_ID_PARAM);

  const contextQuery = useQuery({
    queryKey: queryKeys.printContext(chequeId),
    queryFn: () => api.getPrintContext(chequeId),
  });

  const printMutation = useMutation({
    mutationFn: (loadedSuffix: string): Promise<ConfirmPrintResult> =>
      api.confirmPrint({
        chequeId: contextQuery.data?.cheque.id ?? '',
        loadedChequeNumberSuffix: loadedSuffix,
        // The server requires an idempotency key on anything that reserves or
        // prints a number (CONVENTIONS.md §13).
        idempotencyKey: createIdempotencyKey(),
      }),
  });

  return (
    <Stack gap="md">
      <div>
        <Title order={2}>{t('print.title')}</Title>
        <Text c="dimmed" size="sm">
          {t('print.subtitle')}
        </Text>
      </div>

      {contextQuery.isPending && <LoadingState />}

      {contextQuery.isError && (
        <Alert color="red" title={t('common.error')}>
          <Button size="compact-sm" variant="light" onClick={() => void contextQuery.refetch()}>
            {t('common.retry')}
          </Button>
        </Alert>
      )}

      {contextQuery.data && (
        <>
          <Card withBorder padding="md">
            <Group justify="space-between" align="center">
              <Stack gap={2}>
                <Text size="xs" c="dimmed">
                  {t('print.fields.printer')}
                </Text>
                <Group gap="xs">
                  <PrinterIcon />
                  <Text fw={600}>{contextQuery.data.printer.name}</Text>
                </Group>
              </Stack>
              <Stack gap={2}>
                <Text size="xs" c="dimmed">
                  {t('print.fields.lastExpectedNumber')}
                </Text>
                <Group gap="xs">
                  <Text
                    fw={700}
                    size="lg"
                    dir="ltr"
                    className="numeric-cell"
                    data-testid="last-expected-number"
                  >
                    {contextQuery.data.lastExpectedChequeNumber}
                  </Text>
                  <Badge variant="light" color="indigo">
                    {t(`issued.status.${contextQuery.data.cheque.status}`)}
                  </Badge>
                </Group>
              </Stack>
              <Stack gap={2}>
                <Text size="xs" c="dimmed">
                  {t('print.fields.amount')}
                </Text>
                <Text fw={600} className="numeric-cell">
                  {formatMoney(
                    contextQuery.data.cheque.amount,
                    contextQuery.data.cheque.currency,
                    settings,
                  )}
                </Text>
              </Stack>
            </Group>
          </Card>

          <ChequePreview context={contextQuery.data} />

          {printMutation.isSuccess && <Alert color="green">{t('print.state.sent')}</Alert>}
          {printMutation.isError && <Alert color="red">{t('print.state.failed')}</Alert>}

          <PrintConfirmation
            expectedChequeNumber={contextQuery.data.lastExpectedChequeNumber}
            digits={CONFIRMATION_DIGITS}
            submitting={printMutation.isPending}
            onConfirm={(loadedSuffix) => printMutation.mutate(loadedSuffix)}
          />
        </>
      )}

      <Anchor component={Link} to={ROUTES.issued}>
        <span className="button-content">
          <ChevronForwardIcon />
          <span>{t('print.backToList')}</span>
        </span>
      </Anchor>
    </Stack>
  );
}
