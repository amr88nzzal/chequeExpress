import { useTranslation } from 'react-i18next';
import { Select } from '@mantine/core';
import { useCompanies } from '../hooks/use-reference-data';
import { usePermissions } from '../permissions/permissions-context';

/** Sentinel for "all companies": the tenant-wide scope. */
const TENANT_OPTION_VALUE = '__tenant__';

/**
 * Switches the active scope. Selecting a company narrows every grant that was
 * made company-wide — destinations that are no longer reachable disappear from
 * the nav instead of being merely disabled.
 */
export function CompanySwitcher() {
  const { t } = useTranslation();
  const { scope, setCompanyId } = usePermissions();
  const companiesQuery = useCompanies();

  const options = [
    { value: TENANT_OPTION_VALUE, label: t('company.allCompanies') },
    ...(companiesQuery.data ?? []).map((company) => ({ value: company.id, label: company.name })),
  ];

  const value = scope.kind === 'tenant' ? TENANT_OPTION_VALUE : scope.companyId;

  return (
    <Select
      size="xs"
      w={260}
      allowDeselect={false}
      searchable
      label={t('company.label')}
      title={t('company.scopeNote')}
      data={options}
      value={value}
      onChange={(next) => setCompanyId(next && next !== TENANT_OPTION_VALUE ? next : undefined)}
    />
  );
}
