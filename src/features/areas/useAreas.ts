import { useEffect, useMemo, useState } from 'react';
import { notifyBinsChanged } from '@/features/bins/useBins';
import { apiFetch } from '@/lib/api';
import { Events, notify, useRefreshOn } from '@/lib/eventBus';
import type { Area, ListResponse } from '@/types';

export const notifyAreasChanged = () => notify(Events.AREAS);

export interface AreaTreeNode extends Area {
  children: AreaTreeNode[];
  depth: number;
}

interface AreasResponse extends ListResponse<Area> {
  unassigned_count: number;
}

/** Build a tree from a flat area list. Returns root nodes with nested children. */
export function buildAreaTree(areas: Area[]): AreaTreeNode[] {
  const map = new Map<string, AreaTreeNode>();
  for (const area of areas) {
    map.set(area.id, { ...area, children: [], depth: 0 });
  }

  const roots: AreaTreeNode[] = [];
  for (const node of map.values()) {
    const parent = node.parent_id ? map.get(node.parent_id) : undefined;
    if (parent) {
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  }

  // Set depth by walking the tree
  function setDepth(nodes: AreaTreeNode[], depth: number) {
    for (const node of nodes) {
      node.depth = depth;
      setDepth(node.children, depth + 1);
    }
  }
  setDepth(roots, 0);

  return roots;
}

/** Flatten a tree into a depth-first ordered list with depth values. */
export function flattenAreaTree(roots: AreaTreeNode[]): AreaTreeNode[] {
  const result: AreaTreeNode[] = [];
  function walk(nodes: AreaTreeNode[]) {
    for (const node of nodes) {
      result.push(node);
      walk(node.children);
    }
  }
  walk(roots);
  return result;
}

/** Get the full path string for an area by walking up parent_id links. */
export function getAreaPath(areaId: string, areas: Area[]): string {
  const map = new Map<string, Area>();
  for (const area of areas) {
    map.set(area.id, area);
  }

  const parts: string[] = [];
  let current = map.get(areaId);
  while (current) {
    parts.unshift(current.name);
    current = current.parent_id ? map.get(current.parent_id) : undefined;
  }
  return parts.join(' / ');
}

export function useAreaList(locationId: string | null | undefined) {
  const [areas, setAreas] = useState<Area[]>([]);
  const [unassignedCount, setUnassignedCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const refreshCounter = useRefreshOn(Events.AREAS);

  const path = locationId ? `/api/locations/${encodeURIComponent(locationId)}/areas` : null;

  useEffect(() => {
    if (!path) {
      setAreas([]);
      setUnassignedCount(0);
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);

    apiFetch<AreasResponse>(path)
      .then((resp) => {
        if (!cancelled) {
          setAreas(resp.results);
          setUnassignedCount(resp.unassigned_count);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setAreas([]);
          setUnassignedCount(0);
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => { cancelled = true; };
  }, [path, refreshCounter]);

  const areaTree = useMemo(() => buildAreaTree(areas), [areas]);

  return { areas, areaTree, unassignedCount, isLoading };
}

export async function createArea(locationId: string, name: string, parentId?: string | null): Promise<Area> {
  const area = await apiFetch<Area>(`/api/locations/${encodeURIComponent(locationId)}/areas`, {
    method: 'POST',
    body: { name, parent_id: parentId || null },
  });
  notifyAreasChanged();
  return area;
}

export async function updateArea(locationId: string, areaId: string, name: string): Promise<void> {
  await apiFetch(`/api/locations/${encodeURIComponent(locationId)}/areas/${encodeURIComponent(areaId)}`, {
    method: 'PUT',
    body: { name },
  });
  notifyAreasChanged();
  notifyBinsChanged();
}

export async function deleteArea(locationId: string, areaId: string): Promise<void> {
  await apiFetch(`/api/locations/${encodeURIComponent(locationId)}/areas/${encodeURIComponent(areaId)}`, {
    method: 'DELETE',
  });
  notifyAreasChanged();
  notifyBinsChanged();
}
