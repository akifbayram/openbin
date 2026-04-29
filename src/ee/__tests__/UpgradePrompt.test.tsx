import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/userPreferences', () => ({
  useUserPreferences: vi.fn(() => ({
    preferences: { dismissed_upgrade_prompts: [] as string[] },
    isLoading: false,
    updatePreferences: vi.fn(),
  })),
}));

vi.mock('@/lib/usePlan', () => ({
  usePlan: vi.fn(() => ({
    isFree: false,
    isPlus: true,
    isLocked: false,
  })),
}));

import { UpgradePrompt } from '../UpgradePrompt';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('UpgradePrompt', () => {
  it('renders an X dismiss button when dismissKey is provided', () => {
    render(
      <UpgradePrompt
        feature="Document Attachments"
        upgradeAction={null}
        dismissKey="attachments"
      />,
    );

    expect(screen.getByRole('button', { name: /Dismiss/i })).toBeInTheDocument();
  });
});
