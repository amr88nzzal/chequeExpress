// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, screen } from '@testing-library/react';
import { renderApp } from './test-utils';
import { en } from '../src/i18n/locales/en';
import { PERMISSIONS } from '../src/permissions/catalog';
import { visibleDestinations } from '../src/permissions/nav';
import { grantsForRole } from '../src/permissions/seed';
import type { PermissionGrant, Scope } from '../src/permissions/types';

const TENANT_SCOPE: Scope = { kind: 'tenant' };

/** Only `cheques.issued.view` — no print, no create, no reports. */
const VIEW_ONLY: readonly PermissionGrant[] = [
  { permission: PERMISSIONS.issuedView, scope: TENANT_SCOPE },
];

afterEach(cleanup);

describe('permission driven navigation', () => {
  it('derives the destination list from grants, not from a role name', () => {
    const ids = visibleDestinations(grantsForRole('issuer'), TENANT_SCOPE).map((item) => item.id);
    expect(ids).toEqual(['issued', 'create-draft', 'print']);
  });

  it('hides a destination whose permission is absent', async () => {
    await renderApp({ language: 'en', permissions: VIEW_ONLY, route: '/issued' });

    expect(screen.getByRole('link', { name: en.nav.issued })).toBeTruthy();
    expect(screen.queryByRole('link', { name: en.nav.print })).toBeNull();
    expect(screen.queryByRole('link', { name: en.nav.createDraft })).toBeNull();
  });

  it('shows the destination once the permission is present', async () => {
    await renderApp({ language: 'en', permissions: grantsForRole('issuer'), route: '/issued' });
    expect(screen.getByRole('link', { name: en.nav.print })).toBeTruthy();
    expect(screen.getByRole('link', { name: en.nav.createDraft })).toBeTruthy();
  });

  it('drops a company-scoped permission when another company is active', () => {
    // `follower` holds reports only on `cmp-arabi` (see permissions/seed.ts).
    const follower = grantsForRole('follower');

    expect(
      visibleDestinations(follower, { kind: 'company', companyId: 'cmp-arabi' }),
    ).toContainEqual(expect.objectContaining({ id: 'reports' }));
    expect(
      visibleDestinations(follower, { kind: 'company', companyId: 'cmp-sharq' }),
    ).not.toContainEqual(expect.objectContaining({ id: 'reports' }));
  });

  it('protects the route as well as the nav: a direct URL gets the 403 screen', async () => {
    await renderApp({ language: 'en', permissions: VIEW_ONLY, route: '/print' });

    expect(await screen.findByRole('heading', { name: en.forbidden.title })).toBeTruthy();
    expect(
      screen.getByText(
        en.forbidden.requiredPermission.replace('{{permission}}', PERMISSIONS.issuedPrint),
      ),
    ).toBeTruthy();
  });

  it('waits for the grants instead of flashing the 403 page while /me is in flight', async () => {
    // No injected grants here: this is the real fetch path through the mock API.
    await renderApp({ language: 'en', route: '/issued' });

    expect(screen.queryByRole('heading', { name: en.forbidden.title })).toBeNull();
    expect(await screen.findByRole('heading', { name: en.issued.list.title })).toBeTruthy();
    expect(
      await screen.findByRole('link', { name: en.nav.print }, { timeout: 5_000 }),
    ).toBeTruthy();
  });
});
