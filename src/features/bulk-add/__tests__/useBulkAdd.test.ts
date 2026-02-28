import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  bulkAddReducer,
  initialState,
  stepIndex,
  createBulkAddPhoto,
  type BulkAddState,
  type BulkAddPhoto,
} from '../useBulkAdd';

function photo(overrides?: Partial<BulkAddPhoto>): BulkAddPhoto {
  return {
    id: 'p1',
    file: new File([], 'test.jpg'),
    previewUrl: 'blob:test',
    status: 'pending',
    name: '',
    items: [],
    notes: '',
    tags: [],
    areaId: null,
    icon: '',
    color: '',
    analyzeError: null,
    ...overrides,
  };
}

describe('bulkAddReducer', () => {
  describe('ADD_PHOTOS', () => {
    it('appends photos to the array', () => {
      const p1 = photo({ id: 'p1' });
      const p2 = photo({ id: 'p2' });
      const state: BulkAddState = { ...initialState, photos: [p1] };
      const result = bulkAddReducer(state, { type: 'ADD_PHOTOS', photos: [p2] });
      expect(result.photos).toHaveLength(2);
      expect(result.photos[0].id).toBe('p1');
      expect(result.photos[1].id).toBe('p2');
    });
  });

  describe('REMOVE_PHOTO', () => {
    it('filters out the photo by id', () => {
      const p1 = photo({ id: 'p1' });
      const p2 = photo({ id: 'p2' });
      const state: BulkAddState = { ...initialState, photos: [p1, p2] };
      const result = bulkAddReducer(state, { type: 'REMOVE_PHOTO', id: 'p1' });
      expect(result.photos).toHaveLength(1);
      expect(result.photos[0].id).toBe('p2');
    });
  });

  describe('SET_SHARED_AREA', () => {
    it('sets sharedAreaId and updates pending photos areaId', () => {
      const pending = photo({ id: 'p1', status: 'pending' });
      const reviewed = photo({ id: 'p2', status: 'reviewed' });
      const state: BulkAddState = { ...initialState, photos: [pending, reviewed] };
      const result = bulkAddReducer(state, { type: 'SET_SHARED_AREA', areaId: 'area-1' });
      expect(result.sharedAreaId).toBe('area-1');
      expect(result.photos[0].areaId).toBe('area-1');
      expect(result.photos[1].areaId).toBeNull();
    });
  });

  describe('GO_TO_REVIEW', () => {
    it('sets step to review', () => {
      const result = bulkAddReducer(initialState, { type: 'GO_TO_REVIEW' });
      expect(result.step).toBe('review');
    });
  });

  describe('GO_TO_UPLOAD', () => {
    it('sets step to upload', () => {
      const state: BulkAddState = { ...initialState, step: 'review' };
      const result = bulkAddReducer(state, { type: 'GO_TO_UPLOAD' });
      expect(result.step).toBe('upload');
    });
  });

  describe('GO_TO_SUMMARY', () => {
    it('sets step to summary', () => {
      const result = bulkAddReducer(initialState, { type: 'GO_TO_SUMMARY' });
      expect(result.step).toBe('summary');
    });
  });

  describe('SET_CURRENT_INDEX', () => {
    it('sets currentIndex', () => {
      const result = bulkAddReducer(initialState, { type: 'SET_CURRENT_INDEX', index: 5 });
      expect(result.currentIndex).toBe(5);
    });
  });

  describe('UPDATE_PHOTO', () => {
    it('merges changes into the matching photo', () => {
      const p = photo({ id: 'p1', name: 'old' });
      const state: BulkAddState = { ...initialState, photos: [p] };
      const result = bulkAddReducer(state, {
        type: 'UPDATE_PHOTO',
        id: 'p1',
        changes: { name: 'new', tags: ['tag1'] },
      });
      expect(result.photos[0].name).toBe('new');
      expect(result.photos[0].tags).toEqual(['tag1']);
    });
  });

  describe('SET_ANALYZING', () => {
    it('sets status to analyzing and clears analyzeError', () => {
      const p = photo({ id: 'p1', analyzeError: 'old error' });
      const state: BulkAddState = { ...initialState, photos: [p] };
      const result = bulkAddReducer(state, { type: 'SET_ANALYZING', id: 'p1' });
      expect(result.photos[0].status).toBe('analyzing');
      expect(result.photos[0].analyzeError).toBeNull();
    });
  });

  describe('SET_ANALYZE_RESULT', () => {
    it('sets status to reviewed with name, items, tags, notes', () => {
      const p = photo({ id: 'p1' });
      const state: BulkAddState = { ...initialState, photos: [p] };
      const result = bulkAddReducer(state, {
        type: 'SET_ANALYZE_RESULT',
        id: 'p1',
        name: 'Cables',
        items: ['USB-C', 'HDMI'],
        tags: ['electronics'],
        notes: 'Mixed cables',
      });
      expect(result.photos[0].status).toBe('reviewed');
      expect(result.photos[0].name).toBe('Cables');
      expect(result.photos[0].items).toEqual(['USB-C', 'HDMI']);
      expect(result.photos[0].tags).toEqual(['electronics']);
      expect(result.photos[0].notes).toBe('Mixed cables');
    });
  });

  describe('SET_ANALYZE_ERROR', () => {
    it('sets status to pending and sets analyzeError', () => {
      const p = photo({ id: 'p1', status: 'analyzing' });
      const state: BulkAddState = { ...initialState, photos: [p] };
      const result = bulkAddReducer(state, {
        type: 'SET_ANALYZE_ERROR',
        id: 'p1',
        error: 'API failed',
      });
      expect(result.photos[0].status).toBe('pending');
      expect(result.photos[0].analyzeError).toBe('API failed');
    });
  });

  describe('SKIP_PHOTO', () => {
    it('sets status to skipped', () => {
      const p = photo({ id: 'p1' });
      const state: BulkAddState = { ...initialState, photos: [p] };
      const result = bulkAddReducer(state, { type: 'SKIP_PHOTO', id: 'p1' });
      expect(result.photos[0].status).toBe('skipped');
    });
  });

  describe('UNSKIP_PHOTO', () => {
    it('sets status to pending', () => {
      const p = photo({ id: 'p1', status: 'skipped' });
      const state: BulkAddState = { ...initialState, photos: [p] };
      const result = bulkAddReducer(state, { type: 'UNSKIP_PHOTO', id: 'p1' });
      expect(result.photos[0].status).toBe('pending');
    });
  });

  describe('START_CREATING', () => {
    it('sets isCreating true and createdCount to 0', () => {
      const state: BulkAddState = { ...initialState, createdCount: 5 };
      const result = bulkAddReducer(state, { type: 'START_CREATING' });
      expect(result.isCreating).toBe(true);
      expect(result.createdCount).toBe(0);
    });
  });

  describe('SET_CREATING', () => {
    it('sets status to creating', () => {
      const p = photo({ id: 'p1' });
      const state: BulkAddState = { ...initialState, photos: [p] };
      const result = bulkAddReducer(state, { type: 'SET_CREATING', id: 'p1' });
      expect(result.photos[0].status).toBe('creating');
    });
  });

  describe('SET_CREATED', () => {
    it('sets status to created, createdBinId, and increments createdCount', () => {
      const p = photo({ id: 'p1', status: 'creating' });
      const state: BulkAddState = { ...initialState, photos: [p], createdCount: 2 };
      const result = bulkAddReducer(state, { type: 'SET_CREATED', id: 'p1', binId: 'bin-99' });
      expect(result.photos[0].status).toBe('created');
      expect(result.photos[0].createdBinId).toBe('bin-99');
      expect(result.createdCount).toBe(3);
    });
  });

  describe('SET_CREATE_ERROR', () => {
    it('sets status to failed and createError', () => {
      const p = photo({ id: 'p1', status: 'creating' });
      const state: BulkAddState = { ...initialState, photos: [p] };
      const result = bulkAddReducer(state, {
        type: 'SET_CREATE_ERROR',
        id: 'p1',
        error: 'Server error',
      });
      expect(result.photos[0].status).toBe('failed');
      expect(result.photos[0].createError).toBe('Server error');
    });
  });
});

describe('stepIndex', () => {
  it('returns 0 for upload', () => {
    expect(stepIndex('upload')).toBe(0);
  });

  it('returns 1 for review', () => {
    expect(stepIndex('review')).toBe(1);
  });

  it('returns 2 for summary', () => {
    expect(stepIndex('summary')).toBe(2);
  });
});

describe('createBulkAddPhoto', () => {
  beforeEach(() => {
    vi.stubGlobal('URL', { ...URL, createObjectURL: vi.fn(() => 'blob:mock') });
  });

  it('returns object with correct shape', () => {
    const file = new File(['data'], 'photo.jpg', { type: 'image/jpeg' });
    const result = createBulkAddPhoto(file, null);
    expect(result.status).toBe('pending');
    expect(result.name).toBe('');
    expect(result.items).toEqual([]);
    expect(result.notes).toBe('');
    expect(result.tags).toEqual([]);
    expect(result.icon).toBe('');
    expect(result.color).toBe('');
    expect(result.analyzeError).toBeNull();
    expect(result.file).toBe(file);
  });

  it('generates a string id', () => {
    const file = new File([], 'test.jpg');
    const result = createBulkAddPhoto(file, null);
    expect(typeof result.id).toBe('string');
    expect(result.id.length).toBeGreaterThan(0);
  });

  it('passes through sharedAreaId', () => {
    const file = new File([], 'test.jpg');
    const result = createBulkAddPhoto(file, 'area-42');
    expect(result.areaId).toBe('area-42');
  });

  it('uses the mocked createObjectURL for previewUrl', () => {
    const file = new File([], 'test.jpg');
    const result = createBulkAddPhoto(file, null);
    expect(result.previewUrl).toBe('blob:mock');
  });
});
