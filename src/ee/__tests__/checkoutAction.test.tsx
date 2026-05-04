import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CheckoutLink, submitCheckoutAction } from '../checkoutAction';

const SAFE_POST = { url: 'https://billing.example.com/checkout', method: 'POST' as const, fields: { token: 'jwt123' } };
const SAFE_GET = { url: 'https://billing.example.com/plans', method: 'GET' as const, fields: { token: 'jwt123' } };

describe('CheckoutLink', () => {
  it('renders null for a null action', () => {
    const { container } = render(<CheckoutLink action={null as never}>Pay</CheckoutLink>);
    expect(container.firstChild).toBeNull();
  });

  it('renders null for an unsafe URL', () => {
    const action = { url: 'ftp://attacker.example.com', method: 'POST' as const, fields: {} };
    const { container } = render(<CheckoutLink action={action}>Pay</CheckoutLink>);
    expect(container.firstChild).toBeNull();
  });

  it('renders null for an unrecognised method', () => {
    const action = { url: 'https://billing.example.com', method: 'DELETE' as const, fields: {} };
    const { container } = render(<CheckoutLink action={action as never}>Pay</CheckoutLink>);
    expect(container.firstChild).toBeNull();
  });

  it('POST action renders a form with hidden token input', () => {
    render(<CheckoutLink action={SAFE_POST}>Pay</CheckoutLink>);
    const form = document.querySelector('form');
    expect(form).toBeTruthy();
    expect(form?.method).toBe('post');
    expect(form?.action).toContain('checkout');
    const hidden = document.querySelector('input[type="hidden"][name="token"]') as HTMLInputElement;
    expect(hidden?.value).toBe('jwt123');
    expect(screen.getByRole('button', { name: 'Pay' })).toBeInTheDocument();
  });

  it('GET action renders an anchor with token in query string', () => {
    render(<CheckoutLink action={SAFE_GET}>Plans</CheckoutLink>);
    const link = screen.getByRole('link', { name: 'Plans' });
    expect(link).toBeInTheDocument();
    expect(link.getAttribute('href')).toContain('token=jwt123');
  });
});

describe('submitCheckoutAction', () => {
  it('no-ops for null action', () => {
    const spy = vi.spyOn(document.body, 'appendChild');
    submitCheckoutAction(null as never);
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('no-ops for an unsafe URL', () => {
    const spy = vi.spyOn(document.body, 'appendChild');
    submitCheckoutAction({ url: 'javascript:alert(1)', method: 'POST', fields: {} });
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('GET action calls window.open with encoded URL', () => {
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(null);
    submitCheckoutAction(SAFE_GET);
    expect(openSpy).toHaveBeenCalledWith(
      expect.stringContaining('token=jwt123'),
      '_blank',
      'noopener,noreferrer',
    );
    openSpy.mockRestore();
  });

  it('POST action appends a form and submits it', () => {
    const submitSpy = vi.spyOn(HTMLFormElement.prototype, 'submit').mockImplementation(() => {});
    submitCheckoutAction(SAFE_POST);
    expect(submitSpy).toHaveBeenCalledOnce();
    expect(document.querySelector('form')).toBeNull();
    submitSpy.mockRestore();
  });
});
