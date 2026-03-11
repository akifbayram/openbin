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
}

export const AI_FEATURES = [
  { icon: Camera, title: 'Photo Analysis', desc: 'Snap a photo, AI catalogs everything inside' },
  { icon: MessageSquare, title: 'Natural Language', desc: "'Add screwdriver to the tools bin'" },
  { icon: Search, title: 'Inventory Search', desc: "'Where is the glass cleaner?'" },
  { icon: ListChecks, title: 'Smart Lists', desc: 'Dictate items, AI extracts a clean list' },
] as const;

/** Hardcoded Camping Gear bin data shared by demo steps 1 (AI) and 2 (browse). */
export const DEMO_BIN = {
  name: 'Camping Gear',
  shortCode: 'CMPTCK',
  icon: 'Leaf',
  color: '140:3',
  items: ['Tent', 'Sleeping bags (x4)', 'Headlamps', 'Camping stove', 'Water filter', 'Tarp', 'Cooler (hard shell)', 'Fire starters'],
  tags: ['outdoor', 'seasonal', 'family'],
  areaName: 'Garage',
} as const;
