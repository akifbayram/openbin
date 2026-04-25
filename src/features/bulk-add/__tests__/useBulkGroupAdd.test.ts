import { beforeEach, describe, expect, it } from 'vitest';
import {
  type BulkAddState,
  boundaryIndex,
  bulkAddReducer,
  computeFlowProgress,
  createGroupFromPhoto,
  createPhoto,
  type Group,
  initialState,
  type Photo,
} from '../useBulkGroupAdd';

let nextPhotoId = 0;
let nextGroupId = 0;

function makePhoto(overrides: Partial<Photo> = {}): Photo {
  return {
    id: `ph${++nextPhotoId}`,
    file: new File([''], 'test.jpg', { type: 'image/jpeg' }),
    previewUrl: 'blob:test',
    ...overrides,
  };
}

function makeGroup(photos: Photo[], overrides: Partial<Group> = {}): Group {
  return {
    id: `g${++nextGroupId}`,
    photos,
    status: 'pending',
    name: '',
    items: [],
    notes: '',
    tags: [],
    areaId: null,
    icon: '',
    color: '',
    analyzeError: null,
    correctionCount: 0,
    ...overrides,
  };
}

beforeEach(() => {
  nextPhotoId = 0;
  nextGroupId = 0;
});

describe('initialState', () => {
  it('starts with no groups, step=group, currentIndex=0', () => {
    expect(initialState).toEqual({
      step: 'group',
      groups: [],
      sharedAreaId: null,
      currentIndex: 0,
      isCreating: false,
      createdCount: 0,
      editingFromSummary: false,
      lastToggle: null,
    });
  });
});

describe('createPhoto', () => {
  it('returns a Photo with a stable id and a blob preview URL', () => {
    const file = new File([''], 'a.jpg', { type: 'image/jpeg' });
    const p = createPhoto(file);
    expect(p.file).toBe(file);
    expect(typeof p.id).toBe('string');
    expect(p.id).not.toBe('');
    expect(p.previewUrl).toMatch(/^blob:/);
  });
});

describe('createGroupFromPhoto', () => {
  it('returns a singleton group containing only the given photo with default fields', () => {
    const p = makePhoto();
    const g = createGroupFromPhoto(p, 'area-1');
    expect(g.photos).toEqual([p]);
    expect(g.areaId).toBe('area-1');
    expect(g.status).toBe('pending');
    expect(g.name).toBe('');
    expect(g.items).toEqual([]);
    expect(g.tags).toEqual([]);
    expect(g.notes).toBe('');
    expect(g.icon).toBe('');
    expect(g.color).toBe('');
    expect(g.correctionCount).toBe(0);
    expect(g.analyzeError).toBe(null);
  });
});

describe('bulkAddReducer ADD_PHOTOS', () => {
  it('appends each photo as its own singleton group', () => {
    const p1 = makePhoto();
    const p2 = makePhoto();
    const result = bulkAddReducer(initialState, { type: 'ADD_PHOTOS', photos: [p1, p2] });
    expect(result.groups).toHaveLength(2);
    expect(result.groups[0].photos).toEqual([p1]);
    expect(result.groups[1].photos).toEqual([p2]);
  });

  it('preserves existing groups and appends new singleton groups after them', () => {
    const existing = makeGroup([makePhoto()]);
    const newPhoto = makePhoto();
    const state: BulkAddState = { ...initialState, groups: [existing] };
    const result = bulkAddReducer(state, { type: 'ADD_PHOTOS', photos: [newPhoto] });
    expect(result.groups).toHaveLength(2);
    expect(result.groups[0]).toBe(existing);
    expect(result.groups[1].photos).toEqual([newPhoto]);
  });

  it('uses sharedAreaId as the new groups areaId', () => {
    const state: BulkAddState = { ...initialState, sharedAreaId: 'area-1' };
    const p = makePhoto();
    const result = bulkAddReducer(state, { type: 'ADD_PHOTOS', photos: [p] });
    expect(result.groups[0].areaId).toBe('area-1');
  });
});

describe('bulkAddReducer REMOVE_PHOTO', () => {
  it('removes the photo from its containing group', () => {
    const p1 = makePhoto();
    const p2 = makePhoto();
    const g = makeGroup([p1, p2]);
    const state: BulkAddState = { ...initialState, groups: [g] };
    const result = bulkAddReducer(state, { type: 'REMOVE_PHOTO', photoId: p1.id });
    expect(result.groups).toHaveLength(1);
    expect(result.groups[0].photos).toEqual([p2]);
    expect(result.groups[0].id).toBe(g.id);
  });

  it('drops the group when its last photo is removed', () => {
    const p = makePhoto();
    const g = makeGroup([p]);
    const state: BulkAddState = { ...initialState, groups: [g] };
    const result = bulkAddReducer(state, { type: 'REMOVE_PHOTO', photoId: p.id });
    expect(result.groups).toEqual([]);
  });

  it('clamps currentIndex to [0, groups.length - 1] after group drops', () => {
    const p1 = makePhoto();
    const p2 = makePhoto();
    const g1 = makeGroup([p1]);
    const g2 = makeGroup([p2]);
    const state: BulkAddState = { ...initialState, groups: [g1, g2], currentIndex: 1 };
    const result = bulkAddReducer(state, { type: 'REMOVE_PHOTO', photoId: p2.id });
    expect(result.groups).toHaveLength(1);
    expect(result.currentIndex).toBe(0);
  });

  it('sets currentIndex to 0 when all groups are removed', () => {
    const p = makePhoto();
    const g = makeGroup([p]);
    const state: BulkAddState = { ...initialState, groups: [g], currentIndex: 0 };
    const result = bulkAddReducer(state, { type: 'REMOVE_PHOTO', photoId: p.id });
    expect(result.groups).toEqual([]);
    expect(result.currentIndex).toBe(0);
  });

  it('returns state unchanged if photoId not found', () => {
    const p = makePhoto();
    const g = makeGroup([p]);
    const state: BulkAddState = { ...initialState, groups: [g] };
    const result = bulkAddReducer(state, { type: 'REMOVE_PHOTO', photoId: 'missing' });
    expect(result).toBe(state);
  });
});

describe('boundaryIndex helper', () => {
  it('maps photo index 0 to first group, within-index 0', () => {
    const groups = [makeGroup([makePhoto(), makePhoto()]), makeGroup([makePhoto()])];
    expect(boundaryIndex(groups, 0)).toEqual({ groupIndex: 0, withinGroupIndex: 0 });
  });

  it('maps a within-group photo index correctly', () => {
    const groups = [makeGroup([makePhoto(), makePhoto()]), makeGroup([makePhoto()])];
    expect(boundaryIndex(groups, 1)).toEqual({ groupIndex: 0, withinGroupIndex: 1 });
  });

  it('maps the first photo of the second group correctly', () => {
    const groups = [makeGroup([makePhoto(), makePhoto()]), makeGroup([makePhoto()])];
    expect(boundaryIndex(groups, 2)).toEqual({ groupIndex: 1, withinGroupIndex: 0 });
  });

  it('returns null for out-of-range photo index', () => {
    const groups = [makeGroup([makePhoto()])];
    expect(boundaryIndex(groups, 5)).toBe(null);
  });

  it('returns null for empty groups array', () => {
    expect(boundaryIndex([], 0)).toBe(null);
  });
});

describe('bulkAddReducer JOIN_AT', () => {
  it('merges the two groups around the boundary into one', () => {
    const p1 = makePhoto();
    const p2 = makePhoto();
    const p3 = makePhoto();
    const g1 = makeGroup([p1, p2], { icon: 'box', color: 'red', areaId: 'a1' });
    const g2 = makeGroup([p3]);
    const state: BulkAddState = { ...initialState, groups: [g1, g2] };
    const result = bulkAddReducer(state, { type: 'JOIN_AT', boundaryIndex: 2 });
    expect(result.groups).toHaveLength(1);
    expect(result.groups[0].photos).toEqual([p1, p2, p3]);
  });

  it('keeps the left group id; preserves icon/color/areaId from the left', () => {
    const p1 = makePhoto();
    const p2 = makePhoto();
    const g1 = makeGroup([p1], { icon: 'box', color: 'red', areaId: 'a1', name: 'left' });
    const g2 = makeGroup([p2], { icon: 'cup', color: 'blue', areaId: 'a2', name: 'right' });
    const state: BulkAddState = { ...initialState, groups: [g1, g2] };
    const result = bulkAddReducer(state, { type: 'JOIN_AT', boundaryIndex: 1 });
    expect(result.groups[0].id).toBe(g1.id);
    expect(result.groups[0].icon).toBe('box');
    expect(result.groups[0].color).toBe('red');
    expect(result.groups[0].areaId).toBe('a1');
  });

  it('clears name/items/tags/notes/correctionCount/analyzeError on the merged group', () => {
    const g1 = makeGroup([makePhoto()], {
      name: 'L', items: [{ id: 'i1', name: 'thing', quantity: null }],
      tags: ['t'], notes: 'n', correctionCount: 2, analyzeError: 'oops',
    });
    const g2 = makeGroup([makePhoto()], {
      name: 'R', items: [{ id: 'i2', name: 'other', quantity: null }],
      tags: ['u'], notes: 'm', correctionCount: 1,
    });
    const state: BulkAddState = { ...initialState, groups: [g1, g2] };
    const result = bulkAddReducer(state, { type: 'JOIN_AT', boundaryIndex: 1 });
    const merged = result.groups[0];
    expect(merged.name).toBe('');
    expect(merged.items).toEqual([]);
    expect(merged.tags).toEqual([]);
    expect(merged.notes).toBe('');
    expect(merged.correctionCount).toBe(0);
    expect(merged.analyzeError).toBe(null);
    expect(merged.status).toBe('pending');
  });

  it('snapshots the prior groups into lastToggle with verb=Joined', () => {
    const g1 = makeGroup([makePhoto()]);
    const g2 = makeGroup([makePhoto()]);
    const state: BulkAddState = { ...initialState, groups: [g1, g2] };
    const result = bulkAddReducer(state, { type: 'JOIN_AT', boundaryIndex: 1 });
    expect(result.lastToggle?.verb).toBe('Joined');
    expect(result.lastToggle?.snapshot).toEqual([g1, g2]);
  });

  it('is a no-op when both photos are already in the same group', () => {
    const p1 = makePhoto();
    const p2 = makePhoto();
    const g = makeGroup([p1, p2]);
    const state: BulkAddState = { ...initialState, groups: [g] };
    const result = bulkAddReducer(state, { type: 'JOIN_AT', boundaryIndex: 1 });
    expect(result).toBe(state);
  });

  it('is a no-op when merged size would exceed MAX_PHOTOS_PER_GROUP (5)', () => {
    const g1 = makeGroup([makePhoto(), makePhoto(), makePhoto()]);
    const g2 = makeGroup([makePhoto(), makePhoto(), makePhoto()]);
    const state: BulkAddState = { ...initialState, groups: [g1, g2] };
    const result = bulkAddReducer(state, { type: 'JOIN_AT', boundaryIndex: 3 });
    expect(result).toBe(state);
  });

  it('allows merge that exactly reaches MAX_PHOTOS_PER_GROUP (5)', () => {
    const g1 = makeGroup([makePhoto(), makePhoto(), makePhoto()]);
    const g2 = makeGroup([makePhoto(), makePhoto()]);
    const state: BulkAddState = { ...initialState, groups: [g1, g2] };
    const result = bulkAddReducer(state, { type: 'JOIN_AT', boundaryIndex: 3 });
    expect(result.groups).toHaveLength(1);
    expect(result.groups[0].photos).toHaveLength(5);
  });

  it('returns state unchanged for invalid boundaryIndex (out of range)', () => {
    const g = makeGroup([makePhoto()]);
    const state: BulkAddState = { ...initialState, groups: [g] };
    const result = bulkAddReducer(state, { type: 'JOIN_AT', boundaryIndex: 99 });
    expect(result).toBe(state);
  });
});

describe('bulkAddReducer SPLIT_AT', () => {
  it('splits a group into two at the given boundary', () => {
    const p1 = makePhoto();
    const p2 = makePhoto();
    const p3 = makePhoto();
    const g = makeGroup([p1, p2, p3], { icon: 'box', color: 'red', areaId: 'a1', name: 'whole' });
    const state: BulkAddState = { ...initialState, groups: [g], sharedAreaId: 'shared' };
    const result = bulkAddReducer(state, { type: 'SPLIT_AT', boundaryIndex: 2 });
    expect(result.groups).toHaveLength(2);
    expect(result.groups[0].photos).toEqual([p1, p2]);
    expect(result.groups[1].photos).toEqual([p3]);
  });

  it('keeps the original group id and bin-level fields on the left part', () => {
    const p1 = makePhoto();
    const p2 = makePhoto();
    const g = makeGroup([p1, p2], {
      icon: 'box', color: 'red', areaId: 'a1', name: 'whole',
      items: [{ id: 'x', name: 'thing', quantity: null }], tags: ['t'], notes: 'n',
      status: 'reviewed',
    });
    const state: BulkAddState = { ...initialState, groups: [g] };
    const result = bulkAddReducer(state, { type: 'SPLIT_AT', boundaryIndex: 1 });
    expect(result.groups[0].id).toBe(g.id);
    expect(result.groups[0].name).toBe('whole');
    expect(result.groups[0].icon).toBe('box');
    expect(result.groups[0].status).toBe('reviewed');
  });

  it('the new (right) group has fresh id, pending status, cleared AI fields, sharedAreaId', () => {
    const p1 = makePhoto();
    const p2 = makePhoto();
    const g = makeGroup([p1, p2], { name: 'whole', icon: 'box' });
    const state: BulkAddState = { ...initialState, groups: [g], sharedAreaId: 'shared' };
    const result = bulkAddReducer(state, { type: 'SPLIT_AT', boundaryIndex: 1 });
    const right = result.groups[1];
    expect(right.id).not.toBe(g.id);
    expect(right.status).toBe('pending');
    expect(right.name).toBe('');
    expect(right.items).toEqual([]);
    expect(right.tags).toEqual([]);
    expect(right.notes).toBe('');
    expect(right.icon).toBe('');
    expect(right.color).toBe('');
    expect(right.areaId).toBe('shared');
    expect(right.correctionCount).toBe(0);
  });

  it('snapshots the prior groups into lastToggle with verb=Split', () => {
    const g = makeGroup([makePhoto(), makePhoto()]);
    const state: BulkAddState = { ...initialState, groups: [g] };
    const result = bulkAddReducer(state, { type: 'SPLIT_AT', boundaryIndex: 1 });
    expect(result.lastToggle?.verb).toBe('Split');
    expect(result.lastToggle?.snapshot).toEqual([g]);
  });

  it('is a no-op when the two photos are not in the same group', () => {
    const g1 = makeGroup([makePhoto()]);
    const g2 = makeGroup([makePhoto()]);
    const state: BulkAddState = { ...initialState, groups: [g1, g2] };
    const result = bulkAddReducer(state, { type: 'SPLIT_AT', boundaryIndex: 1 });
    expect(result).toBe(state);
  });

  it('is a no-op for invalid boundary (out of range or boundaryIndex=0)', () => {
    const g = makeGroup([makePhoto()]);
    const state: BulkAddState = { ...initialState, groups: [g] };
    expect(bulkAddReducer(state, { type: 'SPLIT_AT', boundaryIndex: 0 })).toBe(state);
    expect(bulkAddReducer(state, { type: 'SPLIT_AT', boundaryIndex: 99 })).toBe(state);
  });
});

describe('bulkAddReducer MOVE_PHOTO_TO_GROUP', () => {
  it('moves a photo from its source group to the target group', () => {
    const p1 = makePhoto();
    const p2 = makePhoto();
    const p3 = makePhoto();
    const g1 = makeGroup([p1]);
    const g2 = makeGroup([p2, p3]);
    const state: BulkAddState = { ...initialState, groups: [g1, g2] };
    const result = bulkAddReducer(state, {
      type: 'MOVE_PHOTO_TO_GROUP',
      photoId: p1.id,
      targetGroupId: g2.id,
    });
    expect(result.groups).toHaveLength(1);
    expect(result.groups[0].id).toBe(g2.id);
    expect(result.groups[0].photos).toEqual([p2, p3, p1]);
  });

  it('removes the source group when it becomes empty', () => {
    const p1 = makePhoto();
    const p2 = makePhoto();
    const g1 = makeGroup([p1]);
    const g2 = makeGroup([p2]);
    const state: BulkAddState = { ...initialState, groups: [g1, g2] };
    const result = bulkAddReducer(state, {
      type: 'MOVE_PHOTO_TO_GROUP',
      photoId: p1.id,
      targetGroupId: g2.id,
    });
    expect(result.groups).toHaveLength(1);
    expect(result.groups[0].photos).toEqual([p2, p1]);
  });

  it('keeps the source group when it still has photos left', () => {
    const p1 = makePhoto();
    const p2 = makePhoto();
    const p3 = makePhoto();
    const g1 = makeGroup([p1, p2]);
    const g2 = makeGroup([p3]);
    const state: BulkAddState = { ...initialState, groups: [g1, g2] };
    const result = bulkAddReducer(state, {
      type: 'MOVE_PHOTO_TO_GROUP',
      photoId: p1.id,
      targetGroupId: g2.id,
    });
    expect(result.groups).toHaveLength(2);
    expect(result.groups[0].photos).toEqual([p2]);
    expect(result.groups[1].photos).toEqual([p3, p1]);
  });

  it('resets both groups AI state (name, items, tags, notes, correctionCount, status)', () => {
    const p1 = makePhoto();
    const p2 = makePhoto();
    const p3 = makePhoto();
    const g1 = makeGroup([p1, p2], {
      name: 'A',
      items: [{ id: 'i1', name: 'x', quantity: null }],
      tags: ['t'],
      notes: 'n',
      correctionCount: 2,
      status: 'reviewed',
    });
    const g2 = makeGroup([p3], {
      name: 'B',
      items: [{ id: 'i2', name: 'y', quantity: null }],
      tags: ['u'],
      notes: 'm',
      correctionCount: 1,
      status: 'reviewed',
    });
    const state: BulkAddState = { ...initialState, groups: [g1, g2] };
    const result = bulkAddReducer(state, {
      type: 'MOVE_PHOTO_TO_GROUP',
      photoId: p1.id,
      targetGroupId: g2.id,
    });
    const [newSource, newTarget] = result.groups;
    expect(newSource.name).toBe('');
    expect(newSource.items).toEqual([]);
    expect(newSource.tags).toEqual([]);
    expect(newSource.notes).toBe('');
    expect(newSource.correctionCount).toBe(0);
    expect(newSource.status).toBe('pending');
    expect(newTarget.name).toBe('');
    expect(newTarget.items).toEqual([]);
    expect(newTarget.tags).toEqual([]);
    expect(newTarget.notes).toBe('');
    expect(newTarget.correctionCount).toBe(0);
    expect(newTarget.status).toBe('pending');
  });

  it('records lastToggle with verb=Joined and prior snapshot', () => {
    const p1 = makePhoto();
    const p2 = makePhoto();
    const g1 = makeGroup([p1]);
    const g2 = makeGroup([p2]);
    const state: BulkAddState = { ...initialState, groups: [g1, g2] };
    const result = bulkAddReducer(state, {
      type: 'MOVE_PHOTO_TO_GROUP',
      photoId: p1.id,
      targetGroupId: g2.id,
    });
    expect(result.lastToggle?.verb).toBe('Joined');
    expect(result.lastToggle?.snapshot).toEqual([g1, g2]);
  });

  it('clamps currentIndex when the source group is removed', () => {
    const p1 = makePhoto();
    const p2 = makePhoto();
    const g1 = makeGroup([p1]);
    const g2 = makeGroup([p2]);
    const state: BulkAddState = { ...initialState, groups: [g1, g2], currentIndex: 1 };
    const result = bulkAddReducer(state, {
      type: 'MOVE_PHOTO_TO_GROUP',
      photoId: p1.id,
      targetGroupId: g2.id,
    });
    expect(result.groups).toHaveLength(1);
    expect(result.currentIndex).toBe(0);
  });

  it('is a no-op when target is the same as source', () => {
    const p1 = makePhoto();
    const p2 = makePhoto();
    const g = makeGroup([p1, p2]);
    const state: BulkAddState = { ...initialState, groups: [g] };
    const result = bulkAddReducer(state, {
      type: 'MOVE_PHOTO_TO_GROUP',
      photoId: p1.id,
      targetGroupId: g.id,
    });
    expect(result).toBe(state);
  });

  it('is a no-op when target would exceed MAX_PHOTOS_PER_GROUP', () => {
    const g1 = makeGroup([makePhoto()]);
    const g2 = makeGroup([makePhoto(), makePhoto(), makePhoto(), makePhoto(), makePhoto()]);
    const state: BulkAddState = { ...initialState, groups: [g1, g2] };
    const photoId = g1.photos[0].id;
    const result = bulkAddReducer(state, {
      type: 'MOVE_PHOTO_TO_GROUP',
      photoId,
      targetGroupId: g2.id,
    });
    expect(result).toBe(state);
  });

  it('is a no-op when photoId is not found', () => {
    const g = makeGroup([makePhoto()]);
    const state: BulkAddState = { ...initialState, groups: [g] };
    const result = bulkAddReducer(state, {
      type: 'MOVE_PHOTO_TO_GROUP',
      photoId: 'missing',
      targetGroupId: g.id,
    });
    expect(result).toBe(state);
  });

  it('is a no-op when targetGroupId is not found', () => {
    const p1 = makePhoto();
    const g = makeGroup([p1]);
    const state: BulkAddState = { ...initialState, groups: [g] };
    const result = bulkAddReducer(state, {
      type: 'MOVE_PHOTO_TO_GROUP',
      photoId: p1.id,
      targetGroupId: 'missing',
    });
    expect(result).toBe(state);
  });
});

describe('bulkAddReducer MOVE_PHOTO_TO_NEW_GROUP', () => {
  it('promotes a photo out of a multi-photo group into a new singleton group', () => {
    const p1 = makePhoto();
    const p2 = makePhoto();
    const p3 = makePhoto();
    const g = makeGroup([p1, p2, p3]);
    const state: BulkAddState = { ...initialState, groups: [g] };
    const result = bulkAddReducer(state, { type: 'MOVE_PHOTO_TO_NEW_GROUP', photoId: p2.id });
    expect(result.groups).toHaveLength(2);
    expect(result.groups[0].photos).toEqual([p1, p3]);
    expect(result.groups[1].photos).toEqual([p2]);
  });

  it('inserts the new singleton immediately after the source group', () => {
    const p1 = makePhoto();
    const p2 = makePhoto();
    const p3 = makePhoto();
    const p4 = makePhoto();
    const gA = makeGroup([p1]);
    const gB = makeGroup([p2, p3]);
    const gC = makeGroup([p4]);
    const state: BulkAddState = { ...initialState, groups: [gA, gB, gC] };
    const result = bulkAddReducer(state, { type: 'MOVE_PHOTO_TO_NEW_GROUP', photoId: p2.id });
    expect(result.groups).toHaveLength(4);
    expect(result.groups[0].id).toBe(gA.id);
    expect(result.groups[1].id).toBe(gB.id);
    expect(result.groups[1].photos).toEqual([p3]);
    expect(result.groups[2].photos).toEqual([p2]);
    expect(result.groups[3].id).toBe(gC.id);
  });

  it('resets the source group AI state and uses sharedAreaId for the new group', () => {
    const p1 = makePhoto();
    const p2 = makePhoto();
    const g = makeGroup([p1, p2], {
      name: 'src',
      items: [{ id: 'i1', name: 'x', quantity: null }],
      tags: ['t'],
      notes: 'n',
      correctionCount: 3,
      status: 'reviewed',
    });
    const state: BulkAddState = { ...initialState, groups: [g], sharedAreaId: 'area-x' };
    const result = bulkAddReducer(state, { type: 'MOVE_PHOTO_TO_NEW_GROUP', photoId: p1.id });
    const [newSource, newGroup] = result.groups;
    expect(newSource.name).toBe('');
    expect(newSource.items).toEqual([]);
    expect(newSource.tags).toEqual([]);
    expect(newSource.notes).toBe('');
    expect(newSource.correctionCount).toBe(0);
    expect(newSource.status).toBe('pending');
    expect(newGroup.areaId).toBe('area-x');
    expect(newGroup.status).toBe('pending');
  });

  it('records lastToggle with verb=Split and prior snapshot', () => {
    const p1 = makePhoto();
    const p2 = makePhoto();
    const g = makeGroup([p1, p2]);
    const state: BulkAddState = { ...initialState, groups: [g] };
    const result = bulkAddReducer(state, { type: 'MOVE_PHOTO_TO_NEW_GROUP', photoId: p1.id });
    expect(result.lastToggle?.verb).toBe('Split');
    expect(result.lastToggle?.snapshot).toEqual([g]);
  });

  it('is a no-op when the source group is already a singleton', () => {
    const p = makePhoto();
    const g = makeGroup([p]);
    const state: BulkAddState = { ...initialState, groups: [g] };
    const result = bulkAddReducer(state, { type: 'MOVE_PHOTO_TO_NEW_GROUP', photoId: p.id });
    expect(result).toBe(state);
  });

  it('is a no-op when photoId is not found', () => {
    const g = makeGroup([makePhoto(), makePhoto()]);
    const state: BulkAddState = { ...initialState, groups: [g] };
    const result = bulkAddReducer(state, { type: 'MOVE_PHOTO_TO_NEW_GROUP', photoId: 'missing' });
    expect(result).toBe(state);
  });
});

describe('bulkAddReducer UNDO_LAST_TOGGLE', () => {
  it('restores groups from snapshot and clears lastToggle', () => {
    const g1 = makeGroup([makePhoto()]);
    const g2 = makeGroup([makePhoto()]);
    const state: BulkAddState = {
      ...initialState,
      groups: [makeGroup([])],
      lastToggle: { snapshot: [g1, g2], verb: 'Joined' },
    };
    const result = bulkAddReducer(state, { type: 'UNDO_LAST_TOGGLE' });
    expect(result.groups).toEqual([g1, g2]);
    expect(result.lastToggle).toBe(null);
  });

  it('is a no-op when lastToggle is null', () => {
    const state: BulkAddState = { ...initialState, lastToggle: null };
    const result = bulkAddReducer(state, { type: 'UNDO_LAST_TOGGLE' });
    expect(result).toBe(state);
  });
});

describe('bulkAddReducer CLEAR_LAST_TOGGLE', () => {
  it('clears lastToggle without changing groups', () => {
    const g = makeGroup([makePhoto()]);
    const state: BulkAddState = {
      ...initialState,
      groups: [g],
      lastToggle: { snapshot: [], verb: 'Joined' },
    };
    const result = bulkAddReducer(state, { type: 'CLEAR_LAST_TOGGLE' });
    expect(result.groups).toEqual([g]);
    expect(result.lastToggle).toBe(null);
  });

  it('is a no-op when lastToggle is already null', () => {
    const state: BulkAddState = { ...initialState };
    const result = bulkAddReducer(state, { type: 'CLEAR_LAST_TOGGLE' });
    expect(result).toBe(state);
  });
});

describe('bulkAddReducer SET_SHARED_AREA', () => {
  it('sets sharedAreaId and updates pending-status groups areaId', () => {
    const pendingG = makeGroup([makePhoto()], { status: 'pending' });
    const reviewedG = makeGroup([makePhoto()], { status: 'reviewed', areaId: 'old' });
    const state: BulkAddState = { ...initialState, groups: [pendingG, reviewedG] };
    const result = bulkAddReducer(state, { type: 'SET_SHARED_AREA', areaId: 'a-new' });
    expect(result.sharedAreaId).toBe('a-new');
    expect(result.groups[0].areaId).toBe('a-new');
    expect(result.groups[1].areaId).toBe('old');
  });
});

describe('bulkAddReducer step transitions', () => {
  it('GO_TO_GROUP sets step=group', () => {
    const state: BulkAddState = { ...initialState, step: 'review' };
    const result = bulkAddReducer(state, { type: 'GO_TO_GROUP' });
    expect(result.step).toBe('group');
  });

  it('GO_TO_REVIEW sets step=review', () => {
    const state: BulkAddState = { ...initialState, step: 'group' };
    const result = bulkAddReducer(state, { type: 'GO_TO_REVIEW' });
    expect(result.step).toBe('review');
  });

  it('GO_TO_SUMMARY sets step=summary and clears editingFromSummary', () => {
    const state: BulkAddState = { ...initialState, step: 'review', editingFromSummary: true };
    const result = bulkAddReducer(state, { type: 'GO_TO_SUMMARY' });
    expect(result.step).toBe('summary');
    expect(result.editingFromSummary).toBe(false);
  });
});

describe('bulkAddReducer SET_CURRENT_INDEX', () => {
  it('sets currentIndex', () => {
    const state: BulkAddState = { ...initialState, currentIndex: 0 };
    const result = bulkAddReducer(state, { type: 'SET_CURRENT_INDEX', index: 2 });
    expect(result.currentIndex).toBe(2);
  });
});

describe('bulkAddReducer SET_EDITING_FROM_SUMMARY', () => {
  it('sets editingFromSummary', () => {
    const state: BulkAddState = { ...initialState, editingFromSummary: false };
    const result = bulkAddReducer(state, { type: 'SET_EDITING_FROM_SUMMARY', value: true });
    expect(result.editingFromSummary).toBe(true);
  });
});

describe('bulkAddReducer UPDATE_GROUP', () => {
  it('merges changes into the matching group', () => {
    const g = makeGroup([makePhoto()], { name: 'old' });
    const state: BulkAddState = { ...initialState, groups: [g] };
    const result = bulkAddReducer(state, { type: 'UPDATE_GROUP', id: g.id, changes: { name: 'new', notes: 'note' } });
    expect(result.groups[0].name).toBe('new');
    expect(result.groups[0].notes).toBe('note');
    expect(result.groups[0].id).toBe(g.id);
  });

  it('is a no-op for unknown id', () => {
    const g = makeGroup([makePhoto()]);
    const state: BulkAddState = { ...initialState, groups: [g] };
    const result = bulkAddReducer(state, { type: 'UPDATE_GROUP', id: 'missing', changes: { name: 'x' } });
    expect(result.groups[0]).toBe(g);
  });
});

describe('bulkAddReducer AI lifecycle', () => {
  it('SET_ANALYZING flips status to analyzing and clears analyzeError', () => {
    const g = makeGroup([makePhoto()], { status: 'pending', analyzeError: 'old' });
    const state: BulkAddState = { ...initialState, groups: [g] };
    const result = bulkAddReducer(state, { type: 'SET_ANALYZING', id: g.id });
    expect(result.groups[0].status).toBe('analyzing');
    expect(result.groups[0].analyzeError).toBe(null);
  });

  it('SET_ANALYZE_RESULT applies fields and sets status=reviewed', () => {
    const g = makeGroup([makePhoto()], { status: 'analyzing' });
    const state: BulkAddState = { ...initialState, groups: [g] };
    const items = [{ id: 'i1', name: 'thing', quantity: null }];
    const result = bulkAddReducer(state, {
      type: 'SET_ANALYZE_RESULT',
      id: g.id,
      name: 'A bin',
      items,
    });
    expect(result.groups[0].status).toBe('reviewed');
    expect(result.groups[0].name).toBe('A bin');
    expect(result.groups[0].items).toEqual(items);
    expect(result.groups[0].analyzeError).toBe(null);
  });

  it('SET_ANALYZE_ERROR sets analyzeError and reverts status to pending', () => {
    const g = makeGroup([makePhoto()], { status: 'analyzing' });
    const state: BulkAddState = { ...initialState, groups: [g] };
    const result = bulkAddReducer(state, { type: 'SET_ANALYZE_ERROR', id: g.id, error: 'oops' });
    expect(result.groups[0].status).toBe('pending');
    expect(result.groups[0].analyzeError).toBe('oops');
  });

  it('INCREMENT_CORRECTION bumps the counter on the matching group', () => {
    const g = makeGroup([makePhoto()], { correctionCount: 1 });
    const state: BulkAddState = { ...initialState, groups: [g] };
    const result = bulkAddReducer(state, { type: 'INCREMENT_CORRECTION', id: g.id });
    expect(result.groups[0].correctionCount).toBe(2);
  });

  it('RESET_CORRECTION_COUNT zeroes the counter', () => {
    const g = makeGroup([makePhoto()], { correctionCount: 3 });
    const state: BulkAddState = { ...initialState, groups: [g] };
    const result = bulkAddReducer(state, { type: 'RESET_CORRECTION_COUNT', id: g.id });
    expect(result.groups[0].correctionCount).toBe(0);
  });
});

describe('bulkAddReducer create lifecycle', () => {
  it('START_CREATING flips isCreating=true and resets createdCount=0', () => {
    const state: BulkAddState = { ...initialState, isCreating: false, createdCount: 3 };
    const result = bulkAddReducer(state, { type: 'START_CREATING' });
    expect(result.isCreating).toBe(true);
    expect(result.createdCount).toBe(0);
  });

  it('SET_CREATING flips a groups status to creating', () => {
    const g = makeGroup([makePhoto()], { status: 'reviewed' });
    const state: BulkAddState = { ...initialState, groups: [g] };
    const result = bulkAddReducer(state, { type: 'SET_CREATING', id: g.id });
    expect(result.groups[0].status).toBe('creating');
  });

  it('SET_CREATED sets status=created, stores binId, increments createdCount', () => {
    const g = makeGroup([makePhoto()], { status: 'creating' });
    const state: BulkAddState = { ...initialState, groups: [g], createdCount: 0 };
    const result = bulkAddReducer(state, { type: 'SET_CREATED', id: g.id, binId: 'bin-1' });
    expect(result.groups[0].status).toBe('created');
    expect(result.groups[0].createdBinId).toBe('bin-1');
    expect(result.createdCount).toBe(1);
  });

  it('SET_CREATE_ERROR sets status=failed and stores createError', () => {
    const g = makeGroup([makePhoto()], { status: 'creating' });
    const state: BulkAddState = { ...initialState, groups: [g] };
    const result = bulkAddReducer(state, { type: 'SET_CREATE_ERROR', id: g.id, error: 'boom' });
    expect(result.groups[0].status).toBe('failed');
    expect(result.groups[0].createError).toBe('boom');
  });

  it('DONE_CREATING flips isCreating=false', () => {
    const state: BulkAddState = { ...initialState, isCreating: true };
    const result = bulkAddReducer(state, { type: 'DONE_CREATING' });
    expect(result.isCreating).toBe(false);
  });
});

describe('computeFlowProgress', () => {
  it('group step with no bins yet returns Photos/Create bookends', () => {
    const result = computeFlowProgress({ ...initialState, step: 'group' });
    expect(result.dots.map((d) => d.state)).toEqual(['current', 'pending']);
    expect(result.dots.map((d) => d.key)).toEqual(['photos', 'create']);
    expect(result.label).toBe('PHOTOS');
    expect(result.currentIndex).toBe(0);
    expect(result.total).toBe(2);
  });

  it('group step with bins keeps bin dots pending', () => {
    const groups = [makeGroup([makePhoto()]), makeGroup([makePhoto()])];
    const result = computeFlowProgress({ ...initialState, step: 'group', groups });
    expect(result.dots.map((d) => d.state)).toEqual(['current', 'pending', 'pending', 'pending']);
    expect(result.label).toBe('PHOTOS');
  });

  it('review step with single bin uses REVIEW label, no count', () => {
    const g = makeGroup([makePhoto()], { status: 'analyzing' });
    const result = computeFlowProgress({ ...initialState, step: 'review', groups: [g], currentIndex: 0 });
    expect(result.dots.map((d) => d.state)).toEqual(['done', 'current', 'pending']);
    expect(result.label).toBe('REVIEW');
    expect(result.currentIndex).toBe(1);
  });

  it('review step with multiple bins shows BIN n/total label', () => {
    const groups = [
      makeGroup([makePhoto()], { status: 'reviewed' }),
      makeGroup([makePhoto()], { status: 'analyzing' }),
      makeGroup([makePhoto()]),
    ];
    const result = computeFlowProgress({ ...initialState, step: 'review', groups, currentIndex: 1 });
    expect(result.dots.map((d) => d.state)).toEqual(['done', 'done', 'current', 'pending', 'pending']);
    expect(result.label).toBe('BIN 2 / 3');
  });

  it('review step collapses analyze and review into one current dot per bin', () => {
    const analyzing = makeGroup([makePhoto()], { status: 'analyzing' });
    const reviewed = makeGroup([makePhoto()], { status: 'reviewed' });
    const a = computeFlowProgress({ ...initialState, step: 'review', groups: [analyzing], currentIndex: 0 });
    const b = computeFlowProgress({ ...initialState, step: 'review', groups: [reviewed], currentIndex: 0 });
    expect(a.dots.map((d) => d.state)).toEqual(['done', 'current', 'pending']);
    expect(b.dots.map((d) => d.state)).toEqual(['done', 'current', 'pending']);
  });

  it('marks bins ahead of current as done when reviewedCount > currentIndex (back-from-summary)', () => {
    const groups = [
      makeGroup([makePhoto()], { status: 'reviewed' }),
      makeGroup([makePhoto()], { status: 'reviewed' }),
      makeGroup([makePhoto()], { status: 'reviewed' }),
    ];
    const result = computeFlowProgress({ ...initialState, step: 'review', groups, currentIndex: 0 });
    expect(result.dots.map((d) => d.state)).toEqual(['done', 'current', 'done', 'done', 'pending']);
  });

  it('summary step marks all bins done and Create current', () => {
    const groups = [
      makeGroup([makePhoto()], { status: 'reviewed' }),
      makeGroup([makePhoto()], { status: 'reviewed' }),
    ];
    const result = computeFlowProgress({ ...initialState, step: 'summary', groups });
    expect(result.dots.map((d) => d.state)).toEqual(['done', 'done', 'done', 'current']);
    expect(result.label).toBe('CREATE');
    expect(result.currentIndex).toBe(3);
  });

  it('uses group ids as keys for bin dots', () => {
    const groups = [
      makeGroup([makePhoto()]),
      makeGroup([makePhoto()]),
    ];
    const result = computeFlowProgress({ ...initialState, step: 'group', groups });
    expect(result.dots.map((d) => d.key)).toEqual(['photos', groups[0].id, groups[1].id, 'create']);
  });
});

