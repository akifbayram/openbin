import { Eye, Images, Lightbulb, type LucideIcon, ScanSearch } from 'lucide-react';

export interface CameraTip {
	id: "visibility" | "light" | "angles" | "labels";
	icon: LucideIcon;
	headline: string;
}

export const CAMERA_TIPS: CameraTip[] = [
	{ id: "visibility", icon: Eye, headline: "Open the bin so contents are visible" },
	{ id: "light", icon: Lightbulb, headline: "Use bright, even light" },
	{ id: "angles", icon: Images, headline: "Take 2–3 angles" },
	{ id: "labels", icon: ScanSearch, headline: "Get close to labels" },
];

export const PHOTO_TIPS_SEEN_KEY = "openbin-photo-tips-seen";
