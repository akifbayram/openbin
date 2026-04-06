import { describe, expect, it } from 'vitest';
import {
  filterCategories,
  SETTINGS_CATEGORIES,
} from '../settingsCategories';

describe('SETTINGS_CATEGORIES', () => {
  it('has 8 entries with correct IDs', () => {
    expect(SETTINGS_CATEGORIES).toHaveLength(8);
    expect(SETTINGS_CATEGORIES.map((c) => c.id)).toEqual([
      'account',
      'subscription',
      'preferences',
      'personalization',
      'ai',
      'data',
      'about',
      'admin',
    ]);
  });

  it('marks admin entry with adminSection and external', () => {
    const admin = SETTINGS_CATEGORIES.find((c) => c.id === 'admin');
    expect(admin).toBeDefined();
    expect(admin?.adminSection).toBe(true);
    expect(admin?.external).toBe(true);
    expect(admin?.path).toBe('/admin/users');
  });
});

describe('filterCategories', () => {
  it('shows only ungated categories for non-admin users', () => {
    const result = filterCategories({
      isAdmin: false,
      isEE: false,
      isSiteAdmin: false,
    });
    expect(result.map((c) => c.id)).toEqual([
      'account',
      'preferences',
      'about',
    ]);
  });

  it('shows admin-gated categories for location admins', () => {
    const result = filterCategories({
      isAdmin: true,
      isEE: false,
      isSiteAdmin: false,
    });
    expect(result.map((c) => c.id)).toEqual([
      'account',
      'preferences',
      'personalization',
      'ai',
      'data',
      'about',
    ]);
  });

  it('shows subscription when EE is enabled', () => {
    const result = filterCategories({
      isAdmin: false,
      isEE: true,
      isSiteAdmin: false,
    });
    expect(result.map((c) => c.id)).toEqual([
      'account',
      'subscription',
      'preferences',
      'about',
    ]);
  });

  it('shows admin link for site admins', () => {
    const result = filterCategories({
      isAdmin: true,
      isEE: false,
      isSiteAdmin: true,
    });
    expect(result.map((c) => c.id)).toEqual([
      'account',
      'preferences',
      'personalization',
      'ai',
      'data',
      'about',
      'admin',
    ]);
  });

  it('does not show admin link for site admin without location admin', () => {
    const result = filterCategories({
      isAdmin: false,
      isEE: false,
      isSiteAdmin: true,
    });
    // siteAdmin gate only requires isSiteAdmin, but admin-gated items still hidden
    expect(result.map((c) => c.id)).toEqual([
      'account',
      'preferences',
      'about',
      'admin',
    ]);
  });

  it('shows everything when all flags are true', () => {
    const result = filterCategories({
      isAdmin: true,
      isEE: true,
      isSiteAdmin: true,
    });
    expect(result.map((c) => c.id)).toEqual([
      'account',
      'subscription',
      'preferences',
      'personalization',
      'ai',
      'data',
      'about',
      'admin',
    ]);
  });
});
