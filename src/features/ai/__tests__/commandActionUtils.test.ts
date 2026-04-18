import { describe, expect, it } from 'vitest';
import type { Terminology } from '@/lib/terminology';
import { describeAction, enrichActionsWithNames } from '../commandActionUtils';
import type { CommandAction } from '../useCommand';

const t: Terminology = {
  bin: 'bin', bins: 'bins', Bin: 'Bin', Bins: 'Bins',
  area: 'area', areas: 'areas', Area: 'Area', Areas: 'Areas',
  location: 'location', locations: 'locations', Location: 'Location', Locations: 'Locations',
} as Terminology;

describe('enrichActionsWithNames', () => {
  it('fills missing bin_name from the bin map using bin_id', () => {
    const actions = [
      { type: 'duplicate_bin', bin_id: 'b1', new_name: 'Copy of Car Supplies' } as unknown as CommandAction,
    ];
    const map = new Map<string, { name: string }>([['b1', { name: 'Car Supplies' }]]);
    const enriched = enrichActionsWithNames(actions, map);
    expect(enriched[0]).toMatchObject({ type: 'duplicate_bin', bin_id: 'b1', bin_name: 'Car Supplies', new_name: 'Copy of Car Supplies' });
  });

  it('preserves an existing bin_name instead of overwriting', () => {
    const actions = [
      { type: 'delete_bin', bin_id: 'b1', bin_name: 'From AI' } as CommandAction,
    ];
    const map = new Map<string, { name: string }>([['b1', { name: 'From Map' }]]);
    const enriched = enrichActionsWithNames(actions, map);
    expect((enriched[0] as { bin_name: string }).bin_name).toBe('From AI');
  });

  it('leaves the action unchanged when the bin_id is not in the map', () => {
    const actions = [
      { type: 'add_items', bin_id: 'missing', items: ['hammer'] } as unknown as CommandAction,
    ];
    const enriched = enrichActionsWithNames(actions, new Map());
    expect(enriched[0]).toEqual(actions[0]);
  });

  it('fills target_bin_name on return_item from target_bin_id', () => {
    const actions = [
      {
        type: 'return_item',
        bin_id: 'b1',
        bin_name: 'Power Tools',
        item_name: 'Drill',
        target_bin_id: 'b2',
      } as unknown as CommandAction,
    ];
    const map = new Map<string, { name: string }>([
      ['b1', { name: 'Power Tools' }],
      ['b2', { name: 'Garage' }],
    ]);
    const enriched = enrichActionsWithNames(actions, map);
    expect(enriched[0]).toMatchObject({ target_bin_name: 'Garage' });
  });

  it('does not mutate the input actions array', () => {
    const original = [
      { type: 'delete_bin', bin_id: 'b1' } as unknown as CommandAction,
    ];
    const copy = [...original];
    const map = new Map<string, { name: string }>([['b1', { name: 'Tools' }]]);
    enrichActionsWithNames(original, map);
    expect(original).toEqual(copy);
    expect((original[0] as { bin_name?: string }).bin_name).toBeUndefined();
  });

  it('is a no-op for actions without bin_id (create_bin, set_tag_color)', () => {
    const actions: CommandAction[] = [
      { type: 'create_bin', name: 'New' } as CommandAction,
      { type: 'set_tag_color', tag: 'tools', color: 'blue' } as CommandAction,
    ];
    const map = new Map<string, { name: string }>([['irrelevant', { name: 'X' }]]);
    const enriched = enrichActionsWithNames(actions, map);
    expect(enriched).toEqual(actions);
  });
});

describe('describeAction fallback for missing bin_name', () => {
  it('does NOT render the string "undefined" when bin_name is missing on duplicate_bin', () => {
    const action = { type: 'duplicate_bin', bin_id: 'b1', new_name: 'Copy of Car Supplies' } as unknown as CommandAction;
    const description = describeAction(action, t);
    expect(description).not.toMatch(/undefined/i);
    // The copy's new name should still appear
    expect(description).toContain('Copy of Car Supplies');
  });

  it('does NOT render the string "undefined" when bin_name is missing on delete_bin', () => {
    const action = { type: 'delete_bin', bin_id: 'b1' } as unknown as CommandAction;
    const description = describeAction(action, t);
    expect(description).not.toMatch(/undefined/i);
  });
});
