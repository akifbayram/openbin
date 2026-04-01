import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../config.js', () => ({
  config: {
    emailTemplateDir: null as string | null,
  },
}));

import { config } from '../config.js';
import { _clearOverrides, getTemplateOverride, loadEmailTemplates } from '../emailTemplateLoader.js';

function setConfig(overrides: Partial<typeof config>) {
  Object.assign(config, overrides);
}

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'email-tpl-'));
  _clearOverrides();
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
  _clearOverrides();
});

function writeTemplate(name: string, data: Record<string, unknown>): void {
  fs.writeFileSync(path.join(tmpDir, `${name}.json`), JSON.stringify(data));
}

describe('loadEmailTemplates()', () => {
  it('does nothing when emailTemplateDir is null', () => {
    setConfig({ emailTemplateDir: null });
    loadEmailTemplates();
    expect(getTemplateOverride('welcome', {})).toBeNull();
  });

  it('loads valid template files from directory', () => {
    writeTemplate('welcome', {
      subject: 'Hello {{displayName}}',
      html: '<h1>Hi {{displayName}}</h1>',
      text: 'Hi {{displayName}}',
    });
    setConfig({ emailTemplateDir: tmpDir });
    loadEmailTemplates();
    const result = getTemplateOverride('welcome', { displayName: 'Alice' });
    expect(result).not.toBeNull();
    expect(result!.subject).toBe('Hello Alice');
    expect(result!.html).toBe('<h1>Hi Alice</h1>');
    expect(result!.text).toBe('Hi Alice');
  });

  it('skips unknown template types', () => {
    writeTemplate('unknown_type', {
      subject: 'test',
      html: 'test',
      text: 'test',
    });
    setConfig({ emailTemplateDir: tmpDir });
    loadEmailTemplates();
    expect(getTemplateOverride('unknown_type', {})).toBeNull();
  });

  it('skips templates missing required fields', () => {
    writeTemplate('welcome', { subject: 'test' });
    setConfig({ emailTemplateDir: tmpDir });
    loadEmailTemplates();
    expect(getTemplateOverride('welcome', {})).toBeNull();
  });

  it('skips invalid JSON files', () => {
    fs.writeFileSync(path.join(tmpDir, 'welcome.json'), 'not json');
    setConfig({ emailTemplateDir: tmpDir });
    loadEmailTemplates();
    expect(getTemplateOverride('welcome', {})).toBeNull();
  });

  it('handles non-existent directory gracefully', () => {
    setConfig({ emailTemplateDir: '/nonexistent/path' });
    loadEmailTemplates();
    expect(getTemplateOverride('welcome', {})).toBeNull();
  });
});

describe('getTemplateOverride()', () => {
  it('returns null when no override exists', () => {
    expect(getTemplateOverride('trial_expiring', {})).toBeNull();
  });

  it('preserves unmatched placeholders', () => {
    writeTemplate('trial_expiring', {
      subject: 'Expiring {{displayName}}',
      html: '{{displayName}} - {{unknown}}',
      text: '{{displayName}} - {{unknown}}',
    });
    setConfig({ emailTemplateDir: tmpDir });
    loadEmailTemplates();
    const result = getTemplateOverride('trial_expiring', { displayName: 'Bob' });
    expect(result!.html).toBe('Bob - {{unknown}}');
  });

  it('substitutes multiple variables', () => {
    writeTemplate('password_reset', {
      subject: 'Reset',
      html: '{{displayName}} reset at {{resetUrl}}',
      text: '{{displayName}} reset at {{resetUrl}}',
    });
    setConfig({ emailTemplateDir: tmpDir });
    loadEmailTemplates();
    const result = getTemplateOverride('password_reset', { displayName: 'Eve', resetUrl: 'https://example.com/reset' });
    expect(result!.html).toBe('Eve reset at https://example.com/reset');
  });
});
