import { useMemo, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { NavLink as RouterNavLink, useLocation } from 'react-router-dom';
import {
  AppShell as MantineAppShell,
  Burger,
  Group,
  NavLink as MantineNavLink,
  Text,
  Title,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import {
  destinationsInSection,
  NAV_SECTIONS,
  visibleDestinations,
  type NavDestination,
} from '../permissions/nav';
import { usePermissions } from '../permissions/permissions-context';
import { CompanySwitcher } from './company-switcher';
import { LanguageToggle } from './language-toggle';

/**
 * The shell builds its navigation from the permission list, not from role names
 * (CONVENTIONS.md §9/§16): a destination that the active scope cannot reach is
 * simply not rendered, and the route behind it is guarded as well.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const { grants, scope } = usePermissions();
  const [opened, { toggle }] = useDisclosure(true);

  const destinations = useMemo(() => visibleDestinations(grants, scope), [grants, scope]);

  return (
    <MantineAppShell
      header={{ height: 72 }}
      navbar={{ width: 264, breakpoint: 'sm', collapsed: { mobile: !opened } }}
      padding="md"
    >
      <MantineAppShell.Header>
        <Group h="100%" px="md" justify="space-between" wrap="nowrap">
          <Group gap="sm" wrap="nowrap">
            <Burger opened={opened} onClick={toggle} hiddenFrom="sm" size="sm" />
            <Title order={4}>{t('app.title')}</Title>
            <Text size="xs" c="dimmed" visibleFrom="md">
              {t('app.description')}
            </Text>
          </Group>
          <Group gap="md" align="flex-end" wrap="nowrap">
            <CompanySwitcher />
            <LanguageToggle />
          </Group>
        </Group>
      </MantineAppShell.Header>

      <MantineAppShell.Navbar p="xs">
        {NAV_SECTIONS.map((section) => {
          const items = destinationsInSection(destinations, section.id);
          if (items.length === 0) return null;
          return (
            <div key={section.id}>
              <Text className="nav-section-title" size="xs" c="dimmed">
                {t(section.labelKey)}
              </Text>
              {items.map((destination) => (
                <NavItem key={destination.id} destination={destination} />
              ))}
            </div>
          );
        })}
      </MantineAppShell.Navbar>

      <MantineAppShell.Main>{children}</MantineAppShell.Main>
    </MantineAppShell>
  );
}

function NavItem({ destination }: { destination: NavDestination }) {
  const { t } = useTranslation();
  const location = useLocation();
  const active = location.pathname === destination.path;

  return (
    <MantineNavLink
      component={RouterNavLink}
      to={destination.path}
      active={active}
      label={t(destination.labelKey)}
    />
  );
}
