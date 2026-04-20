import type { BinItem } from '@/types';

export interface Photo {
  id: string;
  file: File;
  previewUrl: string;
}

export interface Group {
  id: string;
  photos: Photo[];
  status: 'pending' | 'analyzing' | 'reviewed' | 'creating' | 'created' | 'failed';
  name: string;
  items: BinItem[];
  notes: string;
  tags: string[];
  areaId: string | null;
  icon: string;
  color: string;
  analyzeError: string | null;
  createError?: string;
  createdBinId?: string;
  correctionCount: number;
}

export type Step = 'group' | 'review' | 'summary';

export interface BulkAddState {
  step: Step;
  groups: Group[];
  sharedAreaId: string | null;
  currentIndex: number;
  isCreating: boolean;
  createdCount: number;
  editingFromSummary: boolean;
  lastToggle: { snapshot: Group[]; verb: 'Joined' | 'Split' } | null;
}

export type BulkAddAction =
  | { type: 'ADD_PHOTOS'; photos: Photo[] }
  | { type: 'REMOVE_PHOTO'; photoId: string }
  | { type: 'JOIN_AT'; boundaryIndex: number }
  | { type: 'SPLIT_AT'; boundaryIndex: number }
  | { type: 'UNDO_LAST_TOGGLE' }
  | { type: 'CLEAR_LAST_TOGGLE' }
  | { type: 'SET_SHARED_AREA'; areaId: string | null }
  | { type: 'GO_TO_GROUP' }
  | { type: 'GO_TO_REVIEW' }
  | { type: 'GO_TO_SUMMARY' }
  | { type: 'SET_CURRENT_INDEX'; index: number }
  | { type: 'SET_EDITING_FROM_SUMMARY'; value: boolean }
  | { type: 'UPDATE_GROUP'; id: string; changes: Partial<Group> }
  | { type: 'SET_ANALYZING'; id: string }
  | { type: 'SET_ANALYZE_RESULT'; id: string; name: string; items: BinItem[]; tags: string[]; notes: string }
  | { type: 'SET_ANALYZE_ERROR'; id: string; error: string }
  | { type: 'INCREMENT_CORRECTION'; id: string }
  | { type: 'RESET_CORRECTION_COUNT'; id: string }
  | { type: 'START_CREATING' }
  | { type: 'SET_CREATING'; id: string }
  | { type: 'SET_CREATED'; id: string; binId: string }
  | { type: 'SET_CREATE_ERROR'; id: string; error: string }
  | { type: 'DONE_CREATING' };

export const MAX_PHOTOS_PER_GROUP = 5;

export const BULK_ADD_STEPS = [
  { id: 'group', label: 'Photos' },
  { id: 'analyze', label: 'AI' },
  { id: 'review', label: 'Review' },
  { id: 'create', label: 'Create' },
];

/** Map reducer state to the 4-step visual indicator index. */
export function bulkAddStepIndex(state: BulkAddState): number {
  if (state.step === 'group') return 0;
  if (state.step === 'summary') return 3;
  // 'review' step: AI(1) while current group is pending/analyzing, Review(2) otherwise
  const group = state.groups[state.currentIndex];
  if (group && (group.status === 'pending' || group.status === 'analyzing')) return 1;
  return 2;
}

export const initialState: BulkAddState = {
  step: 'group',
  groups: [],
  sharedAreaId: null,
  currentIndex: 0,
  isCreating: false,
  createdCount: 0,
  editingFromSummary: false,
  lastToggle: null,
};

function generateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Fallback for non-secure contexts (e.g. HTTP on mobile)
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const h = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

export function createPhoto(file: File): Photo {
  return {
    id: generateId(),
    file,
    previewUrl: URL.createObjectURL(file),
  };
}

export function createGroupFromPhoto(photo: Photo, sharedAreaId: string | null): Group {
  return {
    id: generateId(),
    photos: [photo],
    status: 'pending',
    name: '',
    items: [],
    notes: '',
    tags: [],
    areaId: sharedAreaId,
    icon: '',
    color: '',
    analyzeError: null,
    correctionCount: 0,
  };
}

/**
 * Maps a flattened photo index to its (groupIndex, withinGroupIndex).
 * Used by PhotoGroupingGrid to render gap buttons and dispatch correctly.
 * Returns null if photoIndex is out of range.
 */
export function boundaryIndex(
  groups: Group[],
  photoIndex: number,
): { groupIndex: number; withinGroupIndex: number } | null {
  let acc = 0;
  for (let g = 0; g < groups.length; g++) {
    const n = groups[g].photos.length;
    if (photoIndex < acc + n) {
      return { groupIndex: g, withinGroupIndex: photoIndex - acc };
    }
    acc += n;
  }
  return null;
}

export function bulkAddReducer(state: BulkAddState, action: BulkAddAction): BulkAddState {
  switch (action.type) {
    case 'ADD_PHOTOS': {
      const newGroups = action.photos.map((p) => createGroupFromPhoto(p, state.sharedAreaId));
      return { ...state, groups: [...state.groups, ...newGroups] };
    }
    case 'REMOVE_PHOTO': {
      let mutated = false;
      const groups: Group[] = [];
      for (const g of state.groups) {
        if (g.photos.some((p) => p.id === action.photoId)) {
          mutated = true;
          const remaining = g.photos.filter((p) => p.id !== action.photoId);
          if (remaining.length > 0) groups.push({ ...g, photos: remaining });
        } else {
          groups.push(g);
        }
      }
      if (!mutated) return state;
      const maxIndex = Math.max(0, groups.length - 1);
      const currentIndex = Math.min(state.currentIndex, maxIndex);
      return { ...state, groups, currentIndex };
    }
    case 'JOIN_AT': {
      const left = boundaryIndex(state.groups, action.boundaryIndex - 1);
      const right = boundaryIndex(state.groups, action.boundaryIndex);
      if (!left || !right) return state;
      if (left.groupIndex === right.groupIndex) return state;
      const leftGroup = state.groups[left.groupIndex];
      const rightGroup = state.groups[right.groupIndex];
      if (leftGroup.photos.length + rightGroup.photos.length > MAX_PHOTOS_PER_GROUP) {
        return state;
      }
      const merged: Group = {
        ...leftGroup,
        photos: [...leftGroup.photos, ...rightGroup.photos],
        status: 'pending',
        name: '',
        items: [],
        tags: [],
        notes: '',
        correctionCount: 0,
        analyzeError: null,
        createError: undefined,
        createdBinId: undefined,
      };
      const newGroups = [
        ...state.groups.slice(0, left.groupIndex),
        merged,
        ...state.groups.slice(right.groupIndex + 1),
      ];
      return {
        ...state,
        groups: newGroups,
        lastToggle: { snapshot: state.groups, verb: 'Joined' },
      };
    }
    case 'SPLIT_AT': {
      if (action.boundaryIndex <= 0) return state;
      const left = boundaryIndex(state.groups, action.boundaryIndex - 1);
      const right = boundaryIndex(state.groups, action.boundaryIndex);
      if (!left || !right) return state;
      if (left.groupIndex !== right.groupIndex) return state;
      const original = state.groups[left.groupIndex];
      const leftPhotos = original.photos.slice(0, right.withinGroupIndex);
      const rightPhotos = original.photos.slice(right.withinGroupIndex);
      if (leftPhotos.length === 0 || rightPhotos.length === 0) return state;
      const newRight: Group = {
        id: generateId(),
        photos: rightPhotos,
        status: 'pending',
        name: '',
        items: [],
        notes: '',
        tags: [],
        areaId: state.sharedAreaId,
        icon: '',
        color: '',
        analyzeError: null,
        correctionCount: 0,
      };
      const updatedLeft: Group = { ...original, photos: leftPhotos };
      const newGroups = [
        ...state.groups.slice(0, left.groupIndex),
        updatedLeft,
        newRight,
        ...state.groups.slice(left.groupIndex + 1),
      ];
      return {
        ...state,
        groups: newGroups,
        lastToggle: { snapshot: state.groups, verb: 'Split' },
      };
    }
    case 'UNDO_LAST_TOGGLE': {
      if (!state.lastToggle) return state;
      return { ...state, groups: state.lastToggle.snapshot, lastToggle: null };
    }
    case 'CLEAR_LAST_TOGGLE': {
      if (!state.lastToggle) return state;
      return { ...state, lastToggle: null };
    }
    case 'SET_SHARED_AREA':
      return {
        ...state,
        sharedAreaId: action.areaId,
        groups: state.groups.map((g) =>
          g.status === 'pending' ? { ...g, areaId: action.areaId } : g,
        ),
      };

    case 'GO_TO_GROUP':
      return { ...state, step: 'group' };

    case 'GO_TO_REVIEW':
      return { ...state, step: 'review' };

    case 'GO_TO_SUMMARY':
      return { ...state, step: 'summary', editingFromSummary: false };

    case 'SET_CURRENT_INDEX':
      return { ...state, currentIndex: action.index };

    case 'SET_EDITING_FROM_SUMMARY':
      return { ...state, editingFromSummary: action.value };

    case 'UPDATE_GROUP':
      return {
        ...state,
        groups: state.groups.map((g) => (g.id === action.id ? { ...g, ...action.changes } : g)),
      };

    case 'SET_ANALYZING':
      return {
        ...state,
        groups: state.groups.map((g) =>
          g.id === action.id ? { ...g, status: 'analyzing', analyzeError: null } : g,
        ),
      };

    case 'SET_ANALYZE_RESULT':
      return {
        ...state,
        groups: state.groups.map((g) =>
          g.id === action.id
            ? {
                ...g,
                status: 'reviewed',
                name: action.name,
                items: action.items,
                tags: action.tags,
                notes: action.notes,
                analyzeError: null,
              }
            : g,
        ),
      };

    case 'SET_ANALYZE_ERROR':
      return {
        ...state,
        groups: state.groups.map((g) =>
          g.id === action.id ? { ...g, status: 'pending', analyzeError: action.error } : g,
        ),
      };

    case 'INCREMENT_CORRECTION':
      return {
        ...state,
        groups: state.groups.map((g) =>
          g.id === action.id ? { ...g, correctionCount: g.correctionCount + 1 } : g,
        ),
      };

    case 'RESET_CORRECTION_COUNT':
      return {
        ...state,
        groups: state.groups.map((g) =>
          g.id === action.id ? { ...g, correctionCount: 0 } : g,
        ),
      };

    case 'START_CREATING':
      return { ...state, isCreating: true, createdCount: 0 };

    case 'SET_CREATING':
      return {
        ...state,
        groups: state.groups.map((g) =>
          g.id === action.id ? { ...g, status: 'creating' } : g,
        ),
      };

    case 'SET_CREATED':
      return {
        ...state,
        createdCount: state.createdCount + 1,
        groups: state.groups.map((g) =>
          g.id === action.id ? { ...g, status: 'created', createdBinId: action.binId } : g,
        ),
      };

    case 'SET_CREATE_ERROR':
      return {
        ...state,
        groups: state.groups.map((g) =>
          g.id === action.id ? { ...g, status: 'failed', createError: action.error } : g,
        ),
      };

    case 'DONE_CREATING':
      return { ...state, isCreating: false };

    default:
      return state;
  }
}
