// CheckoutLink + submitCheckoutAction render a CheckoutAction from /api/plan
// as a form-POST (or anchor for GET) so the JWT rides the request body
// instead of the URL — keeping it out of browser history, Referer, and
// access logs. The URL/method allowlist guard is internal: callers only
// need to null-check the action; <CheckoutLink> returns null and
// submitCheckoutAction no-ops if the action is unsafe.

import type React from 'react';
import { cn, isSafeExternalUrl } from '@/lib/utils';
import type { CheckoutAction } from '@/types';

function isSafeCheckoutAction(action: CheckoutAction | null): action is CheckoutAction {
  if (!action) return false;
  if (!isSafeExternalUrl(action.url)) return false;
  // Defense-in-depth on the method: server only emits 'GET' or 'POST'
  // today, but a stale client + new server combo shouldn't render a form
  // with a method we don't expect.
  return action.method === 'GET' || action.method === 'POST';
}

interface CheckoutLinkProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'type' | 'children'> {
  action: CheckoutAction;
  /** Where the resulting page opens. Mirrors anchor `target`. */
  target?: '_self' | '_blank';
  className?: string;
  children: React.ReactNode;
  /** Form `rel` semantics — applied to the rendered anchor (GET path). */
  rel?: string;
}

export function CheckoutLink({
  action,
  target = '_blank',
  className,
  children,
  rel = 'noopener noreferrer',
  ...buttonProps
}: CheckoutLinkProps) {
  if (!isSafeCheckoutAction(action)) return null;

  if (action.method === 'GET') {
    // GET goes to /plans (static page) so the token has to ride the URL
    // anyway. Cache-Control: no-store on billing's /plans + Referrer-Policy
    // strict-origin in Caddy keep the leak surface scoped to this tab's
    // history.
    const params = new URLSearchParams(action.fields).toString();
    const href = params ? `${action.url}?${params}` : action.url;
    return (
      <a
        href={href}
        target={target}
        rel={rel}
        className={className}
        // forward aria-label, onClick, etc.
        {...(buttonProps as unknown as React.AnchorHTMLAttributes<HTMLAnchorElement>)}
      >
        {children}
      </a>
    );
  }

  // POST: render an inline form. The button is the visible control; the
  // form is a contents-style wrapper so Tailwind layout on the parent is
  // unaffected. `target` controls where billing's redirect lands.
  return (
    <form
      method="post"
      action={action.url}
      target={target}
      className="contents"
    >
      {Object.entries(action.fields).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <button type="submit" className={cn(className)} {...buttonProps}>
        {children}
      </button>
    </form>
  );
}

interface SubmitOptions {
  target?: '_self' | '_blank';
}

// Programmatic equivalent of CheckoutLink. Used by SubscriptionSection's
// "Manage Subscription" row, which used to call window.open(portalUrl).
// Builds a transient form, submits it (browser navigates / opens tab),
// then removes the form from the DOM. For GET actions, falls through to
// window.open with the encoded URL.
export function submitCheckoutAction(action: CheckoutAction, opts: SubmitOptions = {}): void {
  if (!isSafeCheckoutAction(action)) return;

  if (action.method === 'GET') {
    const params = new URLSearchParams(action.fields).toString();
    const href = params ? `${action.url}?${params}` : action.url;
    window.open(href, opts.target ?? '_blank', 'noopener,noreferrer');
    return;
  }

  const form = document.createElement('form');
  form.method = 'POST';
  form.action = action.url;
  form.target = opts.target ?? '_blank';
  // `rel` on a form is ignored, but new-tab opens via target=_blank get
  // the noopener guarantee from the form-submit branch in the HTML spec.
  form.style.display = 'none';
  for (const [k, v] of Object.entries(action.fields)) {
    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = k;
    input.value = v;
    form.appendChild(input);
  }
  document.body.appendChild(form);
  try {
    form.submit();
  } finally {
    document.body.removeChild(form);
  }
}
