export interface BulkAddPhoto {
  id: string;
  file: File;
  previewUrl: string;
  status: 'pending' | 'analyzing' | 'reviewed' | 'skipped' | 'creating' | 'created' | 'failed';
  name: string;
  items: string[];
  notes: string;
  tags: string[];
  areaId: string | null;
  icon: string;
  color: string;
  analyzeError: string | null;
  createError?: string;
  createdBinId?: string;
}

export type BulkAddStep = 'upload' | 'review' | 'summary';

export interface BulkAddState {
  step: BulkAddStep;
  photos: BulkAddPhoto[];
  sharedAreaId: string | null;
  currentIndex: number;
  isCreating: boolean;
  createdCount: number;
}

export type BulkAddAction =
  | { type: 'ADD_PHOTOS'; photos: BulkAddPhoto[] }
  | { type: 'REMOVE_PHOTO'; id: string }
  | { type: 'SET_SHARED_AREA'; areaId: string | null }
  | { type: 'GO_TO_REVIEW' }
  | { type: 'GO_TO_UPLOAD' }
  | { type: 'GO_TO_SUMMARY' }
  | { type: 'SET_CURRENT_INDEX'; index: number }
  | { type: 'UPDATE_PHOTO'; id: string; changes: Partial<BulkAddPhoto> }
  | { type: 'SET_ANALYZING'; id: string }
  | { type: 'SET_ANALYZE_RESULT'; id: string; name: string; items: string[]; tags: string[]; notes: string }
  | { type: 'SET_ANALYZE_ERROR'; id: string; error: string }
  | { type: 'SKIP_PHOTO'; id: string }
  | { type: 'UNSKIP_PHOTO'; id: string }
  | { type: 'START_CREATING' }
  | { type: 'SET_CREATING'; id: string }
  | { type: 'SET_CREATED'; id: string; binId: string }
  | { type: 'SET_CREATE_ERROR'; id: string; error: string }
  | { type: 'DONE_CREATING' };

export const initialState: BulkAddState = {
  step: 'upload',
  photos: [],
  sharedAreaId: null,
  currentIndex: 0,
  isCreating: false,
  createdCount: 0,
};

export function bulkAddReducer(state: BulkAddState, action: BulkAddAction): BulkAddState {
  switch (action.type) {
    case 'ADD_PHOTOS':
      return { ...state, photos: [...state.photos, ...action.photos] };

    case 'REMOVE_PHOTO':
      return { ...state, photos: state.photos.filter((p) => p.id !== action.id) };

    case 'SET_SHARED_AREA':
      return {
        ...state,
        sharedAreaId: action.areaId,
        photos: state.photos.map((p) =>
          p.status === 'pending' ? { ...p, areaId: action.areaId } : p
        ),
      };

    case 'GO_TO_REVIEW':
      return { ...state, step: 'review', currentIndex: state.currentIndex };

    case 'GO_TO_UPLOAD':
      return { ...state, step: 'upload' };

    case 'GO_TO_SUMMARY':
      return { ...state, step: 'summary' };

    case 'SET_CURRENT_INDEX':
      return { ...state, currentIndex: action.index };

    case 'UPDATE_PHOTO':
      return {
        ...state,
        photos: state.photos.map((p) =>
          p.id === action.id ? { ...p, ...action.changes } : p
        ),
      };

    case 'SET_ANALYZING':
      return {
        ...state,
        photos: state.photos.map((p) =>
          p.id === action.id ? { ...p, status: 'analyzing', analyzeError: null } : p
        ),
      };

    case 'SET_ANALYZE_RESULT':
      return {
        ...state,
        photos: state.photos.map((p) =>
          p.id === action.id
            ? { ...p, status: 'reviewed', name: action.name, items: action.items, tags: action.tags, notes: action.notes, analyzeError: null }
            : p
        ),
      };

    case 'SET_ANALYZE_ERROR':
      return {
        ...state,
        photos: state.photos.map((p) =>
          p.id === action.id ? { ...p, status: 'pending', analyzeError: action.error } : p
        ),
      };

    case 'SKIP_PHOTO':
      return {
        ...state,
        photos: state.photos.map((p) =>
          p.id === action.id ? { ...p, status: 'skipped' } : p
        ),
      };

    case 'UNSKIP_PHOTO':
      return {
        ...state,
        photos: state.photos.map((p) =>
          p.id === action.id ? { ...p, status: 'pending' } : p
        ),
      };

    case 'START_CREATING':
      return { ...state, isCreating: true, createdCount: 0 };

    case 'SET_CREATING':
      return {
        ...state,
        photos: state.photos.map((p) =>
          p.id === action.id ? { ...p, status: 'creating' } : p
        ),
      };

    case 'SET_CREATED':
      return {
        ...state,
        createdCount: state.createdCount + 1,
        photos: state.photos.map((p) =>
          p.id === action.id ? { ...p, status: 'created', createdBinId: action.binId } : p
        ),
      };

    case 'SET_CREATE_ERROR':
      return {
        ...state,
        photos: state.photos.map((p) =>
          p.id === action.id ? { ...p, status: 'failed', createError: action.error } : p
        ),
      };

    case 'DONE_CREATING':
      return { ...state, isCreating: false };

    default:
      return state;
  }
}

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

export function createBulkAddPhoto(file: File, sharedAreaId: string | null): BulkAddPhoto {
  return {
    id: generateId(),
    file,
    previewUrl: URL.createObjectURL(file),
    status: 'pending',
    name: '',
    items: [],
    notes: '',
    tags: [],
    areaId: sharedAreaId,
    icon: '',
    color: '',
    analyzeError: null,
  };
}

const STEP_ORDER: BulkAddStep[] = ['upload', 'review', 'summary'];

export function stepIndex(step: BulkAddStep): number {
  return STEP_ORDER.indexOf(step);
}
