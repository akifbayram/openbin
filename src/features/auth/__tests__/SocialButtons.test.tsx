import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SocialButtons } from '../SocialButtons';

describe('SocialButtons', () => {
  it('renders nothing when providers list is empty', () => {
    const { container } = render(<SocialButtons providers={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders Google button when google is in providers', () => {
    render(<SocialButtons providers={['google']} />);
    expect(screen.getByText('Continue with Google')).toBeTruthy();
  });

  it('renders Apple button when apple is in providers', () => {
    render(<SocialButtons providers={['apple']} />);
    expect(screen.getByText('Continue with Apple')).toBeTruthy();
  });

  it('renders both buttons when both providers present', () => {
    render(<SocialButtons providers={['google', 'apple']} />);
    expect(screen.getByText('Continue with Google')).toBeTruthy();
    expect(screen.getByText('Continue with Apple')).toBeTruthy();
  });

  it('buttons are links to OAuth endpoints', () => {
    render(<SocialButtons providers={['google']} />);
    const link = screen.getByText('Continue with Google').closest('a');
    expect(link?.getAttribute('href')).toBe('/api/auth/oauth/google');
  });
});
