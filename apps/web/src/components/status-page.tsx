import { useTranslation } from 'react-i18next';
import { Link, useLocation } from 'react-router-dom';
import { Button, Card, Container, Stack, Text, Title } from '@mantine/core';
import { ROUTES } from '../lib/paths';
import { ChevronForwardIcon } from './icons';

export interface StatusPageProps {
  titleKey: string;
  descriptionKey: string;
  backKey: string;
  /** Optional third line, usually the permission that was missing. */
  extraKey?: string;
  /** Interpolation values merged with the `permission` carried by the redirect. */
  extraValues?: Record<string, unknown>;
}

/**
 * Shared layout for the 403 / 404 / unexpected-error pages. Every sentence comes
 * from i18n, so one component serves both languages.
 */
export function StatusPage({
  titleKey,
  descriptionKey,
  backKey,
  extraKey,
  extraValues,
}: StatusPageProps) {
  const { t } = useTranslation();
  const location = useLocation();
  const state = (location.state ?? {}) as { permission?: string };
  const values = { permission: state.permission ?? '', ...extraValues };

  return (
    <Container size="sm" py="xl">
      <Card withBorder padding="xl">
        <Stack gap="sm" align="flex-start">
          <Title order={2}>{t(titleKey)}</Title>
          <Text c="dimmed">{t(descriptionKey)}</Text>
          {extraKey && <Text c="dimmed">{t(extraKey, values)}</Text>}
          <Button component={Link} to={ROUTES.issued} variant="light">
            <span className="button-content">
              <ChevronForwardIcon />
              <span>{t(backKey)}</span>
            </span>
          </Button>
        </Stack>
      </Card>
    </Container>
  );
}
