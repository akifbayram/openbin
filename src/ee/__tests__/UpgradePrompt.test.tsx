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

import { useUserPreferences } from '@/lib/userPreferences';
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

  it('does not render the X button when dismissKey is omitted', () => {
    render(
      <UpgradePrompt
        feature="Document Attachments"
        upgradeAction={null}
      />,
    );

    expect(screen.queryByRole('button', { name: /Dismiss/i })).not.toBeInTheDocument();
  });

  it('appends dismissKey to dismissed_upgrade_prompts when X is clicked', async () => {
    const updatePreferences = vi.fn();
    (useUserPreferences as ReturnType<typeof vi.fn>).mockReturnValueOnce({
      preferences: { dismissed_upgrade_prompts: [] as string[] },
      isLoading: false,
      updatePreferences,
    });

    const { default: userEvent } = await import('@testing-library/user-event');
    const user = userEvent.setup();

    render(
      <UpgradePrompt
        feature="Document Attachments"
        upgradeAction={null}
        dismissKey="attachments"
      />,
    );

    await user.click(screen.getByRole('button', { name: /Dismiss/i }));

    expect(updatePreferences).toHaveBeenCalledTimes(1);
    // updatePreferences was called with a function. Invoke it with a fake
    // previous-state to assert the resulting patch.
    const call = updatePreferences.mock.calls[0][0] as (prev: { dismissed_upgrade_prompts: string[] }) => { dismissed_upgrade_prompts?: string[] };
    expect(call({ dismissed_upgrade_prompts: [] })).toEqual({
      dismissed_upgrade_prompts: ['attachments'],
    });
  });
});
