import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AiAnalyzeError, classifyAiError } from '../AiStreamingPreview';

describe('classifyAiError', () => {
  it('returns "rate-limit" for 429 messages', () => {
    expect(classifyAiError('AI provider rate limited — wait a moment and try again')).toBe('rate-limit');
    expect(classifyAiError('Too many requests, try again later')).toBe('rate-limit');
    expect(classifyAiError('429 status')).toBe('rate-limit');
  });

  it('returns "provider-down" for 502 / unavailable / not responding messages', () => {
    expect(classifyAiError('502 Bad Gateway')).toBe('provider-down');
    expect(classifyAiError('Service unavailable — please retry')).toBe('provider-down');
    expect(classifyAiError('Server is not responding')).toBe('provider-down');
    expect(classifyAiError('Your AI provider returned an error — verify your settings')).toBe('provider-down');
  });

  it('returns "invalid-config" for configuration errors', () => {
    expect(classifyAiError('Invalid API key or model — check Settings > AI')).toBe('invalid-config');
  });

  it('returns "generic" for unknown messages', () => {
    expect(classifyAiError('Something unexpected happened')).toBe('generic');
    expect(classifyAiError('AI response was cut short — try a shorter query or increase max tokens')).toBe('generic');
  });
});

describe('AiAnalyzeError', () => {
  it('renders "Rate limit reached" title for rate-limit messages', () => {
    render(<AiAnalyzeError error="AI provider rate limited — wait" onRetry={vi.fn()} />);
    expect(screen.getByText('Rate limit reached')).toBeTruthy();
  });

  it('renders "Provider unavailable" title for 502 messages', () => {
    render(<AiAnalyzeError error="502 Bad Gateway" onRetry={vi.fn()} />);
    expect(screen.getByText('Provider unavailable')).toBeTruthy();
  });

  it('renders "AI configuration issue" title for invalid-config messages', () => {
    render(<AiAnalyzeError error="Invalid API key — check Settings > AI" onRetry={vi.fn()} />);
    expect(screen.getByText('AI configuration issue')).toBeTruthy();
  });

  it('renders "Analysis failed" title for generic errors', () => {
    render(<AiAnalyzeError error="Something else broke" onRetry={vi.fn()} />);
    expect(screen.getByText('Analysis failed')).toBeTruthy();
  });

  it('renders the original error message in the body', () => {
    render(<AiAnalyzeError error="Specific error detail" onRetry={vi.fn()} />);
    expect(screen.getByText('Specific error detail')).toBeTruthy();
  });

  it('always renders a Retry button', () => {
    render(<AiAnalyzeError error="anything" onRetry={vi.fn()} />);
    expect(screen.getByRole('button', { name: /retry/i })).toBeTruthy();
  });

  it('invokes onRetry when Retry is clicked', () => {
    const onRetry = vi.fn();
    render(<AiAnalyzeError error="anything" onRetry={onRetry} />);
    fireEvent.click(screen.getByRole('button', { name: /retry/i }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('renders "Check AI Settings" when onConfigureAi is supplied AND variant is generic', () => {
    render(<AiAnalyzeError error="generic failure" onRetry={vi.fn()} onConfigureAi={vi.fn()} />);
    expect(screen.getByRole('button', { name: /check ai settings/i })).toBeTruthy();
  });

  it('renders "Check AI Settings" when onConfigureAi is supplied AND variant is invalid-config', () => {
    render(
      <AiAnalyzeError
        error="Invalid API key — check Settings > AI"
        onRetry={vi.fn()}
        onConfigureAi={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: /check ai settings/i })).toBeTruthy();
  });

  it('hides "Check AI Settings" for rate-limit (transient external issue)', () => {
    render(
      <AiAnalyzeError
        error="rate limited — wait"
        onRetry={vi.fn()}
        onConfigureAi={vi.fn()}
      />,
    );
    expect(screen.queryByRole('button', { name: /check ai settings/i })).toBeNull();
  });

  it('hides "Check AI Settings" for provider-down (transient external issue)', () => {
    render(
      <AiAnalyzeError
        error="502 Bad Gateway"
        onRetry={vi.fn()}
        onConfigureAi={vi.fn()}
      />,
    );
    expect(screen.queryByRole('button', { name: /check ai settings/i })).toBeNull();
  });

  it('hides "Check AI Settings" when onConfigureAi is omitted', () => {
    render(<AiAnalyzeError error="generic failure" onRetry={vi.fn()} />);
    expect(screen.queryByRole('button', { name: /check ai settings/i })).toBeNull();
  });

  it('invokes onConfigureAi when "Check AI Settings" is clicked', () => {
    const onConfigureAi = vi.fn();
    render(<AiAnalyzeError error="generic failure" onRetry={vi.fn()} onConfigureAi={onConfigureAi} />);
    fireEvent.click(screen.getByRole('button', { name: /check ai settings/i }));
    expect(onConfigureAi).toHaveBeenCalledTimes(1);
  });
});
