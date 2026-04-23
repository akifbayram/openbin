import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { HelpSheet } from '../HelpSheet';
import { CAMERA_TIPS } from '../tips';

describe('HelpSheet', () => {
	it('does not render its content when closed', () => {
		render(<HelpSheet isOpen={false} onClose={() => {}} />);
		expect(screen.queryByText(/Photo tips/i)).toBeNull();
	});

	it('renders the title and every tip headline on a single page when open', () => {
		render(<HelpSheet isOpen onClose={() => {}} />);
		expect(screen.getByText('Photo tips')).toBeTruthy();
		for (const tip of CAMERA_TIPS) {
			expect(screen.getByText(tip.headline)).toBeTruthy();
		}
	});

	it('calls onClose when the primary button is clicked', () => {
		const onClose = vi.fn();
		render(<HelpSheet isOpen onClose={onClose} />);
		fireEvent.click(screen.getByRole('button', { name: /got it/i }));
		expect(onClose).toHaveBeenCalled();
	});

	it('calls onClose when Escape is pressed', () => {
		const onClose = vi.fn();
		render(<HelpSheet isOpen onClose={onClose} />);
		fireEvent.keyDown(document, { key: 'Escape' });
		expect(onClose).toHaveBeenCalled();
	});
});
