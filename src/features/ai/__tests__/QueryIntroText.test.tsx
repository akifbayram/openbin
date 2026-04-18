import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { QueryIntroText } from '../QueryIntroText';

describe('QueryIntroText', () => {
  it('renders plain text', () => {
    render(<QueryIntroText text="Here's what you have for camping:" />);
    expect(screen.getByText("Here's what you have for camping:")).toBeDefined();
  });

  it('renders nothing when text is empty', () => {
    const { container } = render(<QueryIntroText text="" />);
    expect(container.textContent).toBe('');
  });

  it('renders nothing when text is whitespace-only', () => {
    const { container } = render(<QueryIntroText text="   " />);
    expect(container.textContent).toBe('');
  });
});
