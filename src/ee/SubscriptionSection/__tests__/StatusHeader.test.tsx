import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { StatusHeader } from '../StatusHeader';

describe('StatusHeader', () => {
  it('Free state: shows "Free Plan" with no date', () => {
    render(<StatusHeader plan="free" status="active" activeUntil={null} cancelAtPeriodEnd={null} previousSubStatus={null} />);
    expect(screen.getByText(/Free Plan/)).toBeInTheDocument();
    expect(screen.queryByText(/Renews/i)).toBeNull();
  });

  it('Plus trial: shows "Trial · X days remaining" + countdown bar', () => {
    const future = new Date(Date.now() + 5 * 24 * 3600 * 1000).toISOString();
    render(<StatusHeader plan="plus" status="trial" activeUntil={future} cancelAtPeriodEnd={null} previousSubStatus={null} />);
    expect(screen.getByText(/Plus/)).toBeInTheDocument();
    expect(screen.getByText(/Trial/)).toBeInTheDocument();
    expect(screen.getByText(/5 days remaining/)).toBeInTheDocument();
  });

  it('Plus paid active: shows "Active · Renews May 27, 2026"', () => {
    render(<StatusHeader plan="plus" status="active" activeUntil="2026-05-27T00:00:00Z" cancelAtPeriodEnd={null} previousSubStatus={null} />);
    expect(screen.getByText(/Renews/)).toBeInTheDocument();
    expect(screen.getByText(/May 27, 2026/)).toBeInTheDocument();
  });

  it('Plus cancel-pending: shows "Cancels May 27, 2026"', () => {
    render(<StatusHeader plan="plus" status="active" activeUntil="2026-05-27T00:00:00Z" cancelAtPeriodEnd="2026-05-27T00:00:00Z" previousSubStatus={null} />);
    expect(screen.getByText(/Cancels/)).toBeInTheDocument();
    expect(screen.queryByText(/Renews/)).toBeNull();
  });

  it('Pro paid: shows "Pro" badge', () => {
    render(<StatusHeader plan="pro" status="active" activeUntil="2026-05-27T00:00:00Z" cancelAtPeriodEnd={null} previousSubStatus={null} />);
    expect(screen.getByText(/Pro/)).toBeInTheDocument();
  });

  it('Lapsed (inactive + previous status): shows "Expired"', () => {
    render(<StatusHeader plan="plus" status="inactive" activeUntil="2026-04-15T00:00:00Z" cancelAtPeriodEnd={null} previousSubStatus="active" />);
    expect(screen.getByText(/Expired/)).toBeInTheDocument();
  });
});
