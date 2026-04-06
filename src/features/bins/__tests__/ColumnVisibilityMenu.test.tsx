import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ColumnVisibilityMenu, FieldToggleList } from '../ColumnVisibilityMenu';
import { FIELD_LABELS, type FieldKey } from '../useColumnVisibility';

const DEFAULT_VIS: Record<string, boolean> = {
  icon: true, area: true, items: true, tags: true,
  updated: true, created: false, notes: false, createdBy: false, customFields: false,
};

function renderMenu(overrides: {
  applicableFields?: string[];
  visibility?: Record<string, boolean>;
  onToggle?: (field: string) => void;
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

// ---------------------------------------------------------------------------
// FieldToggleList with cf_* keys — Slice 3
// ---------------------------------------------------------------------------
describe('FieldToggleList with dynamic cf_* keys', () => {
  it('renders custom field name for cf_* keys via customFieldLabels', () => {
    const onToggle = vi.fn();
    render(
      <FieldToggleList
        fields={['icon', 'cf_f1', 'cf_f2']}
        visibility={{ ...DEFAULT_VIS, cf_f1: true, cf_f2: false }}
        onToggle={onToggle}
        customFieldLabels={{ cf_f1: 'Serial Number', cf_f2: 'Warranty' }}
      />,
    );
    expect(screen.getByText('Serial Number')).toBeDefined();
    expect(screen.getByText('Warranty')).toBeDefined();
    expect(screen.getByText('Icon')).toBeDefined();
  });

  it('calls onToggle with cf_* key when switch clicked', () => {
    const onToggle = vi.fn();
    render(
      <FieldToggleList
        fields={['cf_f1']}
        visibility={{ ...DEFAULT_VIS, cf_f1: true }}
        onToggle={onToggle}
        customFieldLabels={{ cf_f1: 'Serial Number' }}
      />,
    );
    fireEvent.click(screen.getByRole('switch'));
    expect(onToggle).toHaveBeenCalledWith('cf_f1');
  });

  it('falls back to FIELD_LABELS for static keys when customFieldLabels provided', () => {
    render(
      <FieldToggleList
        fields={['icon', 'cf_f1']}
        visibility={{ ...DEFAULT_VIS, cf_f1: true }}
        onToggle={vi.fn()}
        customFieldLabels={{ cf_f1: 'Serial' }}
      />,
    );
    expect(screen.getByText('Icon')).toBeDefined();
    expect(screen.getByText('Serial')).toBeDefined();
  });
});
