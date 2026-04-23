import { describe, expect, it } from 'vitest';
import { CAMERA_TIPS } from '../tips';

describe('CAMERA_TIPS', () => {
	it('has exactly 4 tips in the documented order', () => {
		expect(CAMERA_TIPS).toHaveLength(4);
		expect(CAMERA_TIPS.map((t) => t.id)).toEqual([
			'visibility',
			'light',
			'angles',
			'labels',
		]);
	});

	it('gives every tip an icon and a non-empty headline', () => {
		for (const tip of CAMERA_TIPS) {
			expect(typeof tip.icon).toBe('object');
			expect(tip.headline.length).toBeGreaterThan(0);
		}
	});

	it('keeps every headline on a single line', () => {
		for (const tip of CAMERA_TIPS) {
			expect(tip.headline).not.toContain('\n');
		}
	});
});
