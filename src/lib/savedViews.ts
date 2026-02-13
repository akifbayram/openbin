import type { SortOption, BinFilters } from '@/features/bins/useBins';

export interface SavedView {
  id: string;
  name: string;
  searchQuery: string;
  sort: SortOption;
  filters: BinFilters;
  createdAt: string;
}

const MAX_VIEWS = 10;
const STORAGE_KEY_PREFIX = 'sanduk-saved-views-';

function getStorageKey(userId: string): string {
  return `${STORAGE_KEY_PREFIX}${userId}`;
}

export function getSavedViews(userId: string): SavedView[] {
  try {
    const raw = localStorage.getItem(getStorageKey(userId));
    if (!raw) return [];
    return JSON.parse(raw) as SavedView[];
  } catch {
    return [];
  }
}

export function saveView(userId: string, view: Omit<SavedView, 'id' | 'createdAt'>): SavedView {
  const views = getSavedViews(userId);
  const newView: SavedView = {
    ...view,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  };
  views.push(newView);
  // Enforce max limit — drop oldest if over
  while (views.length > MAX_VIEWS) {
    views.shift();
  }
  localStorage.setItem(getStorageKey(userId), JSON.stringify(views));
  return newView;
}

export function deleteView(userId: string, viewId: string): void {
  const views = getSavedViews(userId).filter((v) => v.id !== viewId);
  localStorage.setItem(getStorageKey(userId), JSON.stringify(views));
}

export function renameView(userId: string, viewId: string, newName: string): void {
  const views = getSavedViews(userId);
  const view = views.find((v) => v.id === viewId);
  if (view) {
    view.name = newName;
    localStorage.setItem(getStorageKey(userId), JSON.stringify(views));
  }
}
