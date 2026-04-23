import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { FirstRunCoachmark, HelpButton } from '../CameraGuidance';
import { CAMERA_TIPS, PHOTO_TIPS_SEEN_KEY } from '../tips';

const FIRST_TIP = CAMERA_TIPS[0].headline;

beforeEach(() => {
	localStorage.clear();
});
afterEach(() => {
	localStorage.clear();
});

describe('FirstRunCoachmark', () => {
	it('renders nothing when not streaming', () => {
		const { container } = render(<FirstRunCoachmark isStreaming={false} />);
		expect(container.textContent).toBe('');
	});

	it('shows the tip sheet when streaming begins and the seen flag is absent', () => {
		render(<FirstRunCoachmark isStreaming />);
		expect(screen.getByText(FIRST_TIP)).toBeTruthy();
		expect(screen.getByRole('button', { name: /got it/i })).toBeTruthy();
	});

	it('does not show the tip sheet when the seen flag is already set', () => {
		localStorage.setItem(PHOTO_TIPS_SEEN_KEY, 'true');
		render(<FirstRunCoachmark isStreaming />);
		expect(screen.queryByText(FIRST_TIP)).toBeNull();
	});

	it('sets the seen flag when the primary button is clicked', () => {
		render(<FirstRunCoachmark isStreaming />);
		fireEvent.click(screen.getByRole('button', { name: /got it/i }));
		expect(localStorage.getItem(PHOTO_TIPS_SEEN_KEY)).toBe('true');
	});
});

describe('HelpButton', () => {
	it('renders a button that opens the help sheet', () => {
		render(<HelpButton />);
		expect(screen.queryByText('Photo tips')).toBeNull();
		fireEvent.click(screen.getByRole('button', { name: /photo tips/i }));
		expect(screen.getByText('Photo tips')).toBeTruthy();
	});

	it('applies the className prop to the button', () => {
		render(<HelpButton className="custom-class" />);
		const btn = screen.getByRole('button', { name: /photo tips/i });
		expect(btn.className).toContain('custom-class');
	});
});
