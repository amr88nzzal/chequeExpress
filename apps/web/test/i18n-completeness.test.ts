// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { ar } from '../src/i18n/locales/ar';
import { en } from '../src/i18n/locales/en';
import i18n, { resources } from '../src/i18n';
import { CHEQUE_STATUSES } from '../src/api/types';
import { ALL_PERMISSIONS, permissionLabelKey } from '../src/permissions/catalog';
import { NAV_DESTINATIONS } from '../src/permissions/nav';

function flattenKeys(value: unknown, prefix = ''): string[] {
  if (typeof value !== 'object' || value === null) return [prefix];
  return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) =>
    flattenKeys(child, prefix ? `${prefix}.${key}` : key),
  );
}

function lookup(resource: unknown, key: string): unknown {
  return key
    .split('.')
    .reduce<unknown>(
      (node, part) =>
        typeof node === 'object' && node !== null
          ? (node as Record<string, unknown>)[part]
          : undefined,
      resource,
    );
}

describe('i18n completeness', () => {
  it('ships exactly the same key set in Arabic and English', () => {
    const arabicKeys = flattenKeys(ar).sort();
    const englishKeys = flattenKeys(en).sort();
    expect(arabicKeys).toEqual(englishKeys);
    expect(englishKeys.length).toBeGreaterThan(100);
  });

  it('has no empty translation in either language', () => {
    for (const [language, resource] of [
      ['ar', ar],
      ['en', en],
    ] as const) {
      for (const key of flattenKeys(resource)) {
        expect(lookup(resource, key), `${language}:${key}`).toBeTruthy();
      }
    }
  });

  it('registers both bundles with i18next and resolves them', () => {
    expect(Object.keys(resources).sort()).toEqual(['ar', 'en']);
    expect(i18n.getFixedT('ar')('issued.list.title')).toBe(ar.issued.list.title);
    expect(i18n.getFixedT('en')('issued.list.title')).toBe(en.issued.list.title);
  });

  it('has a label for every cheque status value in both languages', () => {
    for (const status of CHEQUE_STATUSES) {
      const key = `issued.status.${status}`;
      expect(lookup(ar, key), `ar:${key}`).toBeTruthy();
      expect(lookup(en, key), `en:${key}`).toBeTruthy();
    }
  });

  it('has a label for every permission and every nav destination', () => {
    for (const permission of ALL_PERMISSIONS) {
      const key = permissionLabelKey(permission);
      expect(lookup(ar, key), `ar:${key}`).toBeTruthy();
      expect(lookup(en, key), `en:${key}`).toBeTruthy();
    }
    for (const destination of NAV_DESTINATIONS) {
      expect(lookup(ar, destination.labelKey), `ar:${destination.labelKey}`).toBeTruthy();
      expect(lookup(en, destination.labelKey), `en:${destination.labelKey}`).toBeTruthy();
    }
  });
});
