import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AnimatedEllipsis } from '../animated-ellipsis';

describe('AnimatedEllipsis', () => {
  it('renders a span with the ai-ellipsis class', () => {
    const { container } = render(<AnimatedEllipsis />);
    const root = container.querySelector('.ai-ellipsis');
    expect(root).toBeTruthy();
  });

  it('renders three dot spans inside', () => {
    const { container } = render(<AnimatedEllipsis />);
    const dots = container.querySelectorAll('.ai-ellipsis > span');
    expect(dots.length).toBe(3);
  });

  it('hides the ellipsis from screen readers', () => {
    const { container } = render(<AnimatedEllipsis />);
    const root = container.querySelector('.ai-ellipsis');
    expect(root?.getAttribute('aria-hidden')).toBe('true');
  });
});
