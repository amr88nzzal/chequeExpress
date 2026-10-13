import { useTranslation } from 'react-i18next';
import { Card, Group, Table, Text, Title } from '@mantine/core';
import type { BankAccount, PrintContext } from '../../../api/types';
import { useFormatSettings } from '../../../config/settings-context';
import { formatDate, formatMoney } from '../../../lib/format';

export interface ChequePreviewProps {
  context: PrintContext;
  account?: BankAccount;
}

/**
 * Preview shown before anything is sent (CONVENTIONS.md §16). The pixel-exact
 * cheque image is produced by the printing service; this panel is the human
 * readable summary of what is about to be printed.
 */
export function ChequePreview({ context, account }: ChequePreviewProps) {
  const { t } = useTranslation();
  const settings = useFormatSettings();
  const { cheque } = context;

  const rows: Array<{ label: string; value: string; ltr?: boolean }> = [
    {
      label: t('print.fields.number'),
      value: cheque.chequeNumber ?? t('common.unknown'),
      ltr: true,
    },
    { label: t('print.fields.payee'), value: cheque.partyName },
    {
      label: t('print.fields.amount'),
      value: formatMoney(cheque.amount, cheque.currency, settings),
    },
    {
      label: t('print.fields.amountInWords'),
      value: context.amountInWords ?? t('print.wordsPending'),
    },
    { label: t('print.fields.dueDate'), value: formatDate(cheque.dueDate, settings) },
    {
      label: t('print.fields.account'),
      value: account ? `${account.bankName} — ${account.maskedAccountNumber}` : t('common.unknown'),
    },
  ];

  return (
    <Card withBorder padding="md">
      <Group justify="space-between" align="baseline">
        <Title order={3}>{t('print.fields.preview')}</Title>
        <Text size="xs" c="dimmed">
          {t('print.previewNote')}
        </Text>
      </Group>
      <Table mt="sm" verticalSpacing="xs">
        <Table.Tbody>
          {rows.map((row) => (
            <Table.Tr key={row.label}>
              <Table.Th w={220} scope="row">
                {row.label}
              </Table.Th>
              <Table.Td>
                <Text dir={row.ltr ? 'ltr' : undefined} className="numeric-cell">
                  {row.value}
                </Text>
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Card>
  );
}
