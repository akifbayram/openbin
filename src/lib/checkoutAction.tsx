// CheckoutLink + submitCheckoutAction — render the structured CheckoutAction
// returned by /api/plan as a button-shaped link that does the right thing
// for the action's method.
//
// Why this exists: until the 2026-04-26 hardening pass on openbin-deploy,
// the billing service accepted the user's session JWT only via `?token=`
// in the URL. That landed in browser history, the Referer header, the
// Umami analytics URL, and the access log. Billing now accepts the token
// via POST body or `Authorization: Bearer`; this helper is the client side
// of that migration. /plans is intentionally still GET (it's a static page
// that needs the token client-side), but the rest of the surfaces are POST.
//
// The two entry points:
//   <CheckoutLink action={planInfo.upgradeProAction}>Upgrade to Pro</CheckoutLink>
//     — for inline buttons / CTAs in the React tree.
//   submitCheckoutAction(action, { target: '_blank' })
//     — for the rare imperative flow (window.open replacement). Builds a
//     transient form, submits, removes it. Same security properties.

import type React from 'react';
import { cn, isSafeExternalUrl } from '@/lib/utils';
import type { CheckoutAction } from '@/types';

export function isSafeCheckoutAction(action: CheckoutAction | null): action is CheckoutAction {
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
