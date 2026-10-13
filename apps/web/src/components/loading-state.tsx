import { useTranslation } from 'react-i18next';
import { Group, Loader, Text } from '@mantine/core';

export interface LoadingStateProps {
  /** i18n key of the message; defaults to the generic `common.loading`. */
  labelKey?: string;
}

/** One loading state for every screen, so the wording cannot drift. */
export function LoadingState({ labelKey = 'common.loading' }: LoadingStateProps) {
  const { t } = useTranslation();
  return (
    <Group justify="center" py="xl">
      <Loader size="sm" />
      <Text size="sm">{t(labelKey)}</Text>
    </Group>
  );
}
