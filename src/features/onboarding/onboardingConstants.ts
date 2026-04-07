import { Camera, ListChecks, MessageSquare, Search } from 'lucide-react';

export interface OnboardingActions {
  step: number;
  totalSteps: number;
  locationId?: string;
  advanceWithLocation: (id: string) => void;
  advanceStep: () => void;
  complete: () => void;
  demoMode?: boolean;
  activeLocationId?: string;
  isSelfHosted?: boolean;
}

export const AI_FEATURES = [
  { icon: Camera, title: 'Photo Analysis', desc: 'Snap a photo, AI catalogs everything inside' },
  { icon: MessageSquare, title: 'Natural Language', desc: "'Add screwdriver to the tools bin'" },
  { icon: Search, title: 'Inventory Search', desc: "'Where is the glass cleaner?'" },
  { icon: ListChecks, title: 'Smart Lists', desc: 'Dictate items, AI extracts a clean list' },
] as const;

const LS_KEY_TOUR_DONE = 'openbin-demo-tour-done';
export const DEMO_TOUR_DONE_EVENT = 'demo-tour-done';

export function markDemoTourDone() {
  if (!localStorage.getItem(LS_KEY_TOUR_DONE)) {
    localStorage.setItem(LS_KEY_TOUR_DONE, String(Date.now()));
    window.dispatchEvent(new Event(DEMO_TOUR_DONE_EVENT));
  }
}

export function getDemoTourDoneAt(): number | null {
  const v = localStorage.getItem(LS_KEY_TOUR_DONE);
  return v ? Number(v) : null;
}

/** Hardcoded Tech Accessories bin data shared by demo steps 1 (AI) and 2 (browse). */
export const DEMO_BIN = {
  name: 'Tech Accessories',
  shortCode: 'TCHACC',
  icon: 'Laptop',
  color: '220:3',
  items: [
    'Sonoff Zigbee 3.0 USB Dongle Plus',
    'Raspberry Pi 4 Model B',
    'Logitech C920 Webcam',
    'White outdoor security camera',
    'Nooelec NESDR Nano 3',
    '5-port Ethernet switch',
    '...and more'
  ],
  tags: ['electronics', 'networking', 'iot'],
  areaName: 'Office',
} as const;
