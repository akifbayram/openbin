import { HelpCircle } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { cn, focusRing } from '@/lib/utils';
import { HelpSheet } from './HelpSheet';
import { PHOTO_TIPS_SEEN_KEY } from './tips';

function readSeenFlag(): boolean {
	try {
		return localStorage.getItem(PHOTO_TIPS_SEEN_KEY) === 'true';
	} catch {
		return false;
	}
}

function writeSeenFlag() {
	try {
		localStorage.setItem(PHOTO_TIPS_SEEN_KEY, 'true');
	} catch {
		// Storage blocked (Safari private mode etc.) — silently ignore.
	}
}

export function FirstRunCoachmark({ isStreaming }: { isStreaming: boolean }) {
	const [shouldShow, setShouldShow] = useState(false);

	useEffect(() => {
		if (!isStreaming) return;
		if (readSeenFlag()) return;
		setShouldShow(true);
	}, [isStreaming]);

	const handleDismiss = useCallback(() => {
		writeSeenFlag();
		setShouldShow(false);
	}, []);

	if (!isStreaming) return null;
	return <HelpSheet isOpen={shouldShow} onClose={handleDismiss} />;
}

export function HelpButton({ className }: { className?: string }) {
	const [isOpen, setIsOpen] = useState(false);
	return (
		<>
			<button
				type="button"
				aria-label="Photo tips"
				onClick={() => setIsOpen(true)}
				className={cn(
					focusRing,
					'h-8 w-8 flex items-center justify-center text-white/90 hover:text-white rounded-[50%]',
					className,
				)}
			>
				<HelpCircle className="h-5 w-5" aria-hidden="true" />
			</button>
			<HelpSheet isOpen={isOpen} onClose={() => setIsOpen(false)} />
		</>
	);
}
