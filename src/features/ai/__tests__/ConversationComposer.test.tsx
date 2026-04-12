import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ConversationComposer } from '../ConversationComposer';

describe('ConversationComposer', () => {
  const defaultProps = {
    onSend: vi.fn(),
    onCancel: vi.fn(),
    onPhotoClick: vi.fn(),
    onCameraClick: vi.fn(),
    isStreaming: false,
    transcription: undefined,
  };

  it('shows Send button when idle with text', () => {
    render(<ConversationComposer {...defaultProps} />);
    const textarea = screen.getByRole('textbox');
    fireEvent.change(textarea, { target: { value: 'hello' } });
    expect(screen.getByLabelText(/send/i)).toBeDefined();
  });

  it('calls onSend with trimmed text when Enter is pressed', () => {
    const onSend = vi.fn();
    render(<ConversationComposer {...defaultProps} onSend={onSend} />);
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: '  hi  ' } });
    fireEvent.keyDown(textarea, { key: 'Enter' });
    expect(onSend).toHaveBeenCalledWith('hi');
  });

  it('sends on Enter without modifier', () => {
    const onSend = vi.fn();
    render(<ConversationComposer {...defaultProps} onSend={onSend} />);
    const textarea = screen.getByRole('textbox');
    fireEvent.change(textarea, { target: { value: 'hi' } });
    fireEvent.keyDown(textarea, { key: 'Enter' });
    expect(onSend).toHaveBeenCalledWith('hi');
  });

  it('does not send on Shift+Enter', () => {
    const onSend = vi.fn();
    render(<ConversationComposer {...defaultProps} onSend={onSend} />);
    const textarea = screen.getByRole('textbox');
    fireEvent.change(textarea, { target: { value: 'hi' } });
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: true });
    expect(onSend).not.toHaveBeenCalled();
  });

  it('shows Stop button when streaming', () => {
    render(<ConversationComposer {...defaultProps} isStreaming />);
    expect(screen.getByLabelText(/stop/i)).toBeDefined();
  });

  it('calls onCancel when Stop is clicked', () => {
    const onCancel = vi.fn();
    render(<ConversationComposer {...defaultProps} isStreaming onCancel={onCancel} />);
    fireEvent.click(screen.getByLabelText(/stop/i));
    expect(onCancel).toHaveBeenCalled();
  });

  it('clears the textarea after sending', () => {
    const onSend = vi.fn();
    render(<ConversationComposer {...defaultProps} onSend={onSend} />);
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: 'hi' } });
    fireEvent.keyDown(textarea, { key: 'Enter' });
    expect(textarea.value).toBe('');
  });

  it('does not send when text is empty or whitespace-only', () => {
    const onSend = vi.fn();
    render(<ConversationComposer {...defaultProps} onSend={onSend} />);
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: '   ' } });
    fireEvent.keyDown(textarea, { key: 'Enter' });
    expect(onSend).not.toHaveBeenCalled();
  });
});
