import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Badge, Button, Group, Table, Text } from '@mantine/core';
import type { BankAccount, ChequeStatus, IssuedCheque } from '../../../api/types';
import { useFormatSettings } from '../../../config/settings-context';
import { formatDate, formatMoney } from '../../../lib/format';
import { PERMISSIONS } from '../../../permissions/catalog';
import { Can } from '../../../permissions/can';
import { PRINT_CHEQUE_ID_PARAM, ROUTES } from '../../../lib/paths';
import { ChevronForwardIcon } from '../../../components/icons';

export interface IssuedChequesTableProps {
  cheques: readonly IssuedCheque[];
  accounts: readonly BankAccount[];
}

const STATUS_COLORS: Readonly<Record<ChequeStatus, string>> = {
  draft: 'gray',
  pending_approval: 'yellow',
  approved: 'blue',
  printing: 'indigo',
  printed: 'cyan',
  delivered: 'teal',
  cashed: 'green',
  cancelled: 'red',
  damaged: 'orange',
  lost: 'pink',
  stopped: 'grape',
};

export function IssuedChequesTable({ cheques, accounts }: IssuedChequesTableProps) {
  const { t } = useTranslation();
  const settings = useFormatSettings();

  const accountLabel = (accountId: string) => {
    const account = accounts.find((candidate) => candidate.id === accountId);
    return account ? account.maskedAccountNumber : t('common.unknown');
  };

  return (
    <Table.ScrollContainer minWidth={880}>
      <Table striped highlightOnHover verticalSpacing="sm">
        <Table.Thead>
          <Table.Tr>
            <Table.Th>{t('issued.list.columns.number')}</Table.Th>
            <Table.Th>{t('issued.list.columns.dueDate')}</Table.Th>
            <Table.Th>{t('issued.list.columns.amount')}</Table.Th>
            <Table.Th>{t('issued.list.columns.party')}</Table.Th>
            <Table.Th>{t('issued.list.columns.account')}</Table.Th>
            <Table.Th>{t('issued.list.columns.status')}</Table.Th>
            <Table.Th>{t('issued.list.columns.actions')}</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {cheques.map((cheque) => (
            <Table.Tr key={cheque.id}>
              <Table.Td>
                <Text ff="monospace" dir="ltr" className="numeric-cell">
                  {cheque.chequeNumber ?? t('common.unknown')}
                </Text>
              </Table.Td>
              <Table.Td>{formatDate(cheque.dueDate, settings)}</Table.Td>
              <Table.Td>
                <Text className="numeric-cell">
                  {formatMoney(cheque.amount, cheque.currency, settings)}
                </Text>
              </Table.Td>
              <Table.Td>{cheque.partyName}</Table.Td>
              <Table.Td>
                <Text dir="ltr" className="numeric-cell">
                  {accountLabel(cheque.bankAccountId)}
                </Text>
              </Table.Td>
              <Table.Td>
                <Badge color={STATUS_COLORS[cheque.status]} variant="light">
                  {t(`issued.status.${cheque.status}`)}
                </Badge>
              </Table.Td>
              <Table.Td>
                <Can permission={PERMISSIONS.issuedPrint}>
                  <Button
                    component={Link}
                    to={`${ROUTES.print}?${PRINT_CHEQUE_ID_PARAM}=${cheque.id}`}
                    size="compact-sm"
                    variant="light"
                  >
                    <span className="button-content">
                      <span>{t('issued.list.actions.print')}</span>
                      <ChevronForwardIcon />
                    </span>
                  </Button>
                </Can>
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
      <Group justify="flex-end" mt="xs">
        <Text size="xs" c="dimmed">
          {t('issued.list.pagingNote')}
        </Text>
      </Group>
    </Table.ScrollContainer>
  );
}
