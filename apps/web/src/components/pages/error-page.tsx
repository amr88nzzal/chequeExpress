import { useTranslation } from 'react-i18next';
import { Alert, Button, Container, Stack, Text, Title } from '@mantine/core';

/** Fallback rendered by `AppErrorBoundary` when a screen throws while rendering. */
export function ErrorPage({ onRetry }: { onRetry: () => void }) {
  const { t } = useTranslation();
  return (
    <Container size="sm" py="xl">
      <Stack gap="sm">
        <Title order={2}>{t('error.title')}</Title>
        <Alert color="red">
          <Text size="sm">{t('error.description')}</Text>
        </Alert>
        <Button variant="light" w="fit-content" onClick={onRetry}>
          {t('error.retry')}
        </Button>
      </Stack>
    </Container>
  );
}
