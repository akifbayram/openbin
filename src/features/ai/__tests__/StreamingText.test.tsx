import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { StreamingText } from '../StreamingText';

describe('StreamingText', () => {
  it('renders text content', () => {
    render(<StreamingText text="Hello world" isStreaming={false} />);
    expect(screen.getByText('Hello world')).toBeDefined();
  });

  it('shows cursor when streaming', () => {
    const { container } = render(<StreamingText text="Partial" isStreaming={true} />);
    const cursor = container.querySelector('[data-streaming-cursor]');
    expect(cursor).not.toBeNull();
    expect(cursor?.textContent).toBe('\u258C');
  });

  it('hides cursor when not streaming', () => {
    const { container } = render(<StreamingText text="Done" isStreaming={false} />);
    const cursor = container.querySelector('[data-streaming-cursor]');
    expect(cursor).toBeNull();
  });

  it('renders empty text without crashing', () => {
    const { container } = render(<StreamingText text="" isStreaming={true} />);
    const cursor = container.querySelector('[data-streaming-cursor]');
    expect(cursor).not.toBeNull();
  });
});
