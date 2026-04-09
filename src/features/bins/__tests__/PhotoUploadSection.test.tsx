import { fireEvent, render, screen } from '@testing-library/react';
import { createRef } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PhotoUploadSection } from '../PhotoUploadSection';

const clickSpy = vi.fn();

function setup(overrides: Partial<React.ComponentProps<typeof PhotoUploadSection>> = {}) {
	const fileInputRef = createRef<HTMLInputElement>();
	const props = {
		photos: [] as File[],
		photoPreviews: [] as string[],
		onPhotoSelect: vi.fn(),
		onRemovePhoto: vi.fn(),
		onCameraClick: vi.fn(),
		onFilesDropped: vi.fn(),
		analyzing: false,
		fileInputRef,
		...overrides,
	};
	render(<PhotoUploadSection {...props} />);
	return { ...props, fileInputRef };
}

beforeEach(() => {
	vi.clearAllMocks();
	clickSpy.mockReset();
	vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(clickSpy);
});

afterEach(() => {
	vi.restoreAllMocks();
});

describe('PhotoUploadSection', () => {
	describe('empty-state drop zone as click target', () => {
		it('opens file picker when the drop zone is clicked', () => {
			setup();
			const zone = screen.getByRole('button', { name: /add photos/i });
			fireEvent.click(zone);
			expect(clickSpy).toHaveBeenCalled();
		});

		it('does not open file picker when the camera button is clicked', () => {
			const { onCameraClick } = setup();
			clickSpy.mockClear();
			const cameraBtn = screen.getByRole('button', { name: /camera/i });
			fireEvent.click(cameraBtn);
			expect(onCameraClick).toHaveBeenCalled();
			expect(clickSpy).not.toHaveBeenCalled();
		});

		it('does not open file picker when Space is pressed on the camera button', () => {
			setup();
			clickSpy.mockClear();
			const cameraBtn = screen.getByRole('button', { name: /camera/i });
			fireEvent.keyDown(cameraBtn, { key: ' ' });
			expect(clickSpy).not.toHaveBeenCalled();
		});

		it('opens file picker via keyboard Enter on the drop zone', () => {
			setup();
			clickSpy.mockClear();
			const zone = screen.getByRole('button', { name: /add photos/i });
			fireEvent.keyDown(zone, { key: 'Enter' });
			expect(clickSpy).toHaveBeenCalled();
		});

		it('opens file picker via keyboard Space on the drop zone', () => {
			setup();
			clickSpy.mockClear();
			const zone = screen.getByRole('button', { name: /add photos/i });
			fireEvent.keyDown(zone, { key: ' ' });
			expect(clickSpy).toHaveBeenCalled();
		});
	});

	describe('drag and drop still works', () => {
		it('accepts dropped image files', () => {
			const { onFilesDropped } = setup();
			const zone = screen.getByRole('button', { name: /add photos/i });
			const file = new File(['img'], 'photo.png', { type: 'image/png' });
			fireEvent.drop(zone, { dataTransfer: { files: [file] } });
			expect(onFilesDropped).toHaveBeenCalledWith([file]);
		});

		it('highlights zone on drag over', () => {
			setup();
			const zone = screen.getByRole('button', { name: /add photos/i });
			fireEvent.dragOver(zone);
			expect(zone.className).toContain('border-[var(--accent)]');
		});
	});

	describe('analyzing state', () => {
		it('does not apply ai-photo-shimmer class to thumbnails during analysis', () => {
			const file = new File(['img'], 'photo.png', { type: 'image/png' });
			setup({
				photos: [file],
				photoPreviews: ['blob:preview-1'],
				analyzing: true,
			});
			const img = screen.getByAltText('Preview 1');
			expect(img.closest('.ai-photo-shimmer')).toBeNull();
		});

		it('hides remove button during analysis', () => {
			const file = new File(['img'], 'photo.png', { type: 'image/png' });
			setup({
				photos: [file],
				photoPreviews: ['blob:preview-1'],
				analyzing: true,
			});
			expect(screen.queryByRole('button', { name: /remove photo/i })).toBeNull();
		});
	});
});
