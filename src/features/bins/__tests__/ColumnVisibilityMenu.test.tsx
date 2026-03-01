import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ColumnVisibilityMenu } from '../ColumnVisibilityMenu';
import { FIELD_LABELS, type FieldKey } from '../useColumnVisibility';

const DEFAULT_VIS: Record<FieldKey, boolean> = {
  icon: true, area: true, items: true, tags: true,
  updated: true, created: false, notes: false, createdBy: false,
};

function renderMenu(overrides: {
  applicableFields?: FieldKey[];
  visibility?: Record<FieldKey, boolean>;
  onToggle?: (field: FieldKey) => void;
} = {}) {
  const props = {
    applicableFields: overrides.applicableFields ?? ['icon', 'area', 'items', 'tags', 'notes'],
    visibility: overrides.visibility ?? DEFAULT_VIS,
    onToggle: overrides.onToggle ?? vi.fn(),
  };
  return { ...render(<ColumnVisibilityMenu {...props} />), props };
}

describe('ColumnVisibilityMenu', () => {
  it('renders button with correct aria-label', () => {
    renderMenu();
    expect(screen.getByRole('button', { name: 'Toggle field visibility' })).toBeDefined();
  });

  it('menu is initially closed', () => {
    renderMenu();
    expect(screen.queryByText('Visible Fields')).toBeNull();
  });

  it('click opens menu showing field labels', () => {
    const fields: FieldKey[] = ['icon', 'area', 'items'];
    renderMenu({ applicableFields: fields });

    fireEvent.click(screen.getByRole('button', { name: 'Toggle field visibility' }));

    expect(screen.getByText('Visible Fields')).toBeDefined();
    for (const field of fields) {
      expect(screen.getByText(FIELD_LABELS[field])).toBeDefined();
    }
  });

  it('calls onToggle when a switch is clicked', () => {
    const onToggle = vi.fn();
    renderMenu({ applicableFields: ['icon', 'area'], onToggle });

    fireEvent.click(screen.getByRole('button', { name: 'Toggle field visibility' }));

    const switches = screen.getAllByRole('switch');
    fireEvent.click(switches[0]);
    expect(onToggle).toHaveBeenCalledWith('icon');
  });

  it('renders correct number of fields per applicableFields', () => {
    const fields: FieldKey[] = ['icon', 'area', 'items', 'tags', 'updated', 'created', 'notes', 'createdBy'];
    renderMenu({ applicableFields: fields });

    fireEvent.click(screen.getByRole('button', { name: 'Toggle field visibility' }));

    const switches = screen.getAllByRole('switch');
    expect(switches).toHaveLength(fields.length);
  });
});
