import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { UserMessage } from '../UserMessage';

describe('UserMessage', () => {
  it('renders the text inside an accent-colored right-aligned container', () => {
    const { container } = render(<UserMessage text="where is the wrench" />);
    expect(screen.getByText('where is the wrench')).toBeDefined();
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.className).toContain('ms-auto');
  });

  it('preserves whitespace and newlines', () => {
    render(<UserMessage text={'line 1\nline 2'} />);
    const el = screen.getByText(/line 1/);
    expect(el.textContent).toContain('line 1');
    expect(el.textContent).toContain('line 2');
  });
});
