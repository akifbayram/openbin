import { Camera, Image, Plus, X } from 'lucide-react';
import { useState } from 'react';
import { MAX_AI_PHOTOS } from '@/features/ai/useAiAnalysis';
import { cn, focusRing } from '@/lib/utils';

interface PhotoUploadSectionProps {
	photos: File[];
	photoPreviews: string[];
	onPhotoSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
	onRemovePhoto: (index: number) => void;
	onCameraClick?: () => void;
	onFilesDropped?: (files: File[]) => void;
	analyzing: boolean;
	fileInputRef: React.RefObject<HTMLInputElement | null>;
}

export function PhotoUploadSection({
	photos,
	photoPreviews,
	onPhotoSelect,
	onRemovePhoto,
	onCameraClick,
	onFilesDropped,
	analyzing,
	fileInputRef,
}: PhotoUploadSectionProps) {
	const [isDragging, setIsDragging] = useState(false);

	function handleDragOver(e: React.DragEvent<HTMLDivElement>) {
		e.preventDefault();
		setIsDragging(true);
	}

	function handleDragLeave() {
		setIsDragging(false);
	}

	function handleDrop(e: React.DragEvent<HTMLDivElement>) {
		e.preventDefault();
		setIsDragging(false);
		const files = Array.from(e.dataTransfer.files).filter((f) =>
			f.type.startsWith('image/')
		);
		if (files.length > 0) {
			onFilesDropped?.(files);
		}
	}

	return (
		<div className="space-y-2">
			<input
				ref={fileInputRef as React.RefObject<HTMLInputElement>}
				type="file"
				accept="image/*"
				multiple
				className="hidden"
				onChange={onPhotoSelect}
			/>

			{photos.length === 0 ? (
				// biome-ignore lint/a11y/useSemanticElements: button can't receive drag events needed for drop zone
				<div
					role="button"
					tabIndex={0}
					aria-label="Add photos"
					onDragOver={handleDragOver}
					onDragLeave={handleDragLeave}
					onDrop={handleDrop}
					onClick={() => fileInputRef.current?.click()}
					onKeyDown={(e) => {
						if (e.key === 'Enter' || e.key === ' ') {
							e.preventDefault();
							fileInputRef.current?.click();
						}
					}}
					className={cn(
						'flex flex-col items-center justify-center gap-3 rounded-[var(--radius-lg)] border-2 border-dashed py-4 px-4 transition-colors text-center cursor-pointer',
						focusRing,
						isDragging
							? 'border-[var(--accent)] bg-[var(--accent)]/5 text-[var(--accent)]'
							: 'border-[var(--border-subtle)] text-[var(--text-tertiary)] hover:border-[var(--accent)] hover:text-[var(--accent)] active:border-[var(--accent)] active:bg-[var(--accent)]/5 active:text-[var(--accent)]'
					)}
				>
					<Image className="h-6 w-6" />
					<div>
						<p className="text-[14px] font-medium">
							<span className="sm:hidden">Tap to add photos</span>
							<span className="hidden sm:inline">Drag &amp; drop or click to add photos</span>
						</p>
						<p className="text-[12px] mt-0.5 text-[var(--text-tertiary)]">
							Multiple photos improve AI accuracy
						</p>
					</div>
					{onCameraClick && (
						<button
							type="button"
							onClick={(e) => {
								e.stopPropagation();
								onCameraClick();
							}}
							onKeyDown={(e) => e.stopPropagation()}
							className={cn(
								'flex items-center justify-center gap-2 rounded-[var(--radius-md)] min-h-[44px] px-5 py-2.5 text-[14px] font-medium transition-colors mt-1',
								'sm:border sm:border-[var(--border-flat)] sm:bg-transparent sm:text-[var(--text-secondary)] sm:hover:border-[var(--accent)] sm:hover:text-[var(--accent)]',
								'bg-[var(--accent)] text-[var(--text-on-accent)] hover:bg-[var(--accent-hover)] active:bg-[var(--accent-active)] sm:bg-transparent sm:text-[var(--text-secondary)]'
							)}
						>
							<Camera className="h-4 w-4" />
							Camera
						</button>
					)}
				</div>
			) : (
				<div className="space-y-2">
					<div className="grid grid-cols-3 gap-2">
						{photoPreviews.map((preview, i) => (
							<div
								// biome-ignore lint/suspicious/noArrayIndexKey: preview blobs have no stable identity
								key={i}
								className="group relative aspect-square"
							>
								<img
									src={preview}
									alt={`Preview ${i + 1}`}
									className="h-full w-full object-cover rounded-[var(--radius-md)]"
								/>
								{!analyzing && (
									<button
										type="button"
										onClick={() => onRemovePhoto(i)}
										aria-label={`Remove photo ${i + 1}`}
										className="absolute top-1 right-1 size-9 flex items-center justify-center rounded-[var(--radius-xs)] bg-[var(--overlay-button)] text-white opacity-100 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 transition-opacity hover:bg-[var(--overlay-button-hover)] hover:text-[var(--destructive)]"
									>
										<X className="h-3.5 w-3.5" />
									</button>
								)}
							</div>
						))}
						{photos.length < MAX_AI_PHOTOS && (
							<button
								type="button"
								onClick={() => fileInputRef.current?.click()}
								className="aspect-square flex items-center justify-center rounded-[var(--radius-md)] border-2 border-dashed border-[var(--border-subtle)] text-[var(--text-tertiary)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors"
								aria-label="Add more photos"
							>
								<Plus className="h-5 w-5" />
							</button>
						)}
					</div>
					<div className="flex gap-2">
						{onCameraClick && (
							<button
								type="button"
								onClick={onCameraClick}
								className="flex-1 flex items-center justify-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--border-flat)] min-h-[44px] px-4 py-2.5 text-[12px] font-medium text-[var(--text-tertiary)] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]"
							>
								<Camera className="h-3.5 w-3.5" />
								More photos
							</button>
						)}
						<button
							type="button"
							onClick={() => fileInputRef.current?.click()}
							className="flex-1 flex items-center justify-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--border-flat)] min-h-[44px] px-4 py-2.5 text-[12px] font-medium text-[var(--text-tertiary)] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]"
						>
							<Image className="h-3.5 w-3.5" />
							Add from gallery
						</button>
					</div>
				</div>
			)}
		</div>
	);
}
