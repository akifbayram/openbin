import { render, screen } from '@testing-library/react';
import { ChakraProvider, defaultSystem } from '@chakra-ui/react';
import { describe, expect, it, vi } from 'vitest';
import { InventoryQueryResult } from '../InventoryQueryResult';

function renderWithChakra(ui: React.ReactElement) {
  return render(<ChakraProvider value={defaultSystem}>{ui}</ChakraProvider>);
}

describe('InventoryQueryResult', () => {
  const defaultProps = {
    onBinClick: vi.fn(),
    onBack: vi.fn(),
  };

  it('renders completed query result with answer and matches', () => {
    renderWithChakra(
      <InventoryQueryResult
        {...defaultProps}
        queryResult={{
          answer: 'Found in Kitchen.',
          matches: [
            { bin_id: 'b1', name: 'Kitchen', area_name: 'Home', items: ['tape'], tags: [], relevance: 'exact' },
          ],
        }}
      />
    );

    expect(screen.getByText('Found in Kitchen.')).toBeDefined();
    expect(screen.getByText('Kitchen')).toBeDefined();
  });

  it('renders streaming text with cursor when isStreaming and no queryResult', () => {
    const { container } = renderWithChakra(
      <InventoryQueryResult
        {...defaultProps}
        queryResult={null}
        streamingText="Searching for..."
        isStreaming={true}
      />
    );

    expect(screen.getByText(/Searching for\.\.\./)).toBeDefined();
    expect(container.querySelector('[data-streaming-cursor]')).not.toBeNull();
    expect(screen.queryByRole('button', { name: /Kitchen/ })).toBeNull();
  });

  it('hides Back button while streaming', () => {
    renderWithChakra(
      <InventoryQueryResult
        {...defaultProps}
        queryResult={null}
        streamingText="Loading..."
        isStreaming={true}
      />
    );

    expect(screen.queryByText('Back')).toBeNull();
  });
});
