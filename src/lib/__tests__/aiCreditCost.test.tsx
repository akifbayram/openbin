import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CreditCost, reorganizeWeight, visionWeight } from '../aiCreditCost';

describe('visionWeight (client mirror)', () => {
  it('charges 5 credits for 1 image', () => {
    expect(visionWeight(1)).toBe(5);
  });

  it('charges 10 credits for 2 images', () => {
    expect(visionWeight(2)).toBe(10);
  });

  it('charges 15 credits for 3 images', () => {
    expect(visionWeight(3)).toBe(15);
  });

  it('floors zero/negative to a single-image charge', () => {
    expect(visionWeight(0)).toBe(5);
    expect(visionWeight(-1)).toBe(5);
  });
});

describe('reorganizeWeight (client mirror)', () => {
  it('charges 14 for 7 bins', () => {
    expect(reorganizeWeight(7)).toBe(14);
  });

  it('charges 60 for 30 bins', () => {
    expect(reorganizeWeight(30)).toBe(60);
  });

  it('charges 0 for an empty bin list', () => {
    expect(reorganizeWeight(0)).toBe(0);
  });
});

describe('<CreditCost>', () => {
  it('renders the cost as small "Uses X credits" text', () => {
    const { getByText } = render(<CreditCost cost={5} />);
    expect(getByText(/Uses 5 credits/)).toBeTruthy();
  });

  it('uses the singular form when cost is 1', () => {
    const { getByText } = render(<CreditCost cost={1} />);
    expect(getByText(/Uses 1 credit\b/)).toBeTruthy();
  });

  it('renders nothing when cost is 0', () => {
    const { container } = render(<CreditCost cost={0} />);
    expect(container.firstChild).toBeNull();
  });

  it('forwards a className for layout adjustments', () => {
    const { container } = render(<CreditCost cost={5} className="ml-2" />);
    const el = container.firstChild as HTMLElement | null;
    expect(el?.className).toContain('ml-2');
  });
});
