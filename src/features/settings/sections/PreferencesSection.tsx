import { Check, ChevronsUpDown, Monitor, Moon, Sun } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import type { OptionGroupOption } from '@/components/ui/option-group';
import { OptionGroup } from '@/components/ui/option-group';
import { Switch } from '@/components/ui/switch';
import {
  ITEM_PAGE_SIZE_OPTIONS,
  type PageSizeValue,
  setItemPageSize,
  useItemPageSize,
} from '@/features/bins/useItemPageSize';
import {
  clamp,
  DASHBOARD_LIMITS,
  type DashboardSettings,
  useDashboardSettings,
} from '@/lib/dashboardSettings';
import { useTerminology } from '@/lib/terminology';
import type { ThemePreference } from '@/lib/theme';
import { useTheme } from '@/lib/theme';
import { useClickOutside } from '@/lib/useClickOutside';
import { usePopover } from '@/lib/usePopover';
import { useUserPreferences } from '@/lib/userPreferences';
import { cn } from '@/lib/utils';
import { SettingsPageHeader } from '../SettingsPageHeader';
import { SettingsRow } from '../SettingsRow';
import { SettingsSection } from '../SettingsSection';
import { SavedBadge, useSavedFlash } from '../useSavedFlash';

const themeOptions: OptionGroupOption<ThemePreference>[] = [
  { key: 'light', label: 'Light', icon: Sun },
  { key: 'dark', label: 'Dark', icon: Moon },
  { key: 'auto', label: 'Auto', icon: Monitor },
];

function formatPageSizeLabel(v: PageSizeValue): string {
  return v === 'all' ? 'All on one page' : `${v} per page`;
}

interface ItemPageSizeSelectProps {
  value: PageSizeValue;
  onChange: (v: PageSizeValue) => void;
  ariaLabel: string;
}

function ItemPageSizeSelect({ value, onChange, ariaLabel }: ItemPageSizeSelectProps) {
  const { visible, animating, isOpen, close, toggle } = usePopover();
  const ref = useRef<HTMLDivElement>(null);
  useClickOutside(ref, close);

  useEffect(() => {
    if (!isOpen) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') close();
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isOpen, close]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={toggle}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius-sm)] bg-[var(--bg-input)] border border-[var(--border-flat)] text-[13px] text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors"
        aria-haspopup="listbox"
        aria-expanded={visible}
        aria-label={ariaLabel}
      >
        <span className="tabular-nums">{formatPageSizeLabel(value)}</span>
        <ChevronsUpDown className="h-3.5 w-3.5 text-[var(--text-tertiary)]" />
      </button>
      {visible && (
        <div
          role="listbox"
          className={cn(
            animating === 'exit' ? 'animate-popover-exit' : 'animate-popover-enter',
            'absolute top-full mt-1.5 right-0 z-50 rounded-[var(--radius-md)] flat-popover min-w-[160px] overflow-hidden',
          )}
        >
          {ITEM_PAGE_SIZE_OPTIONS.map((opt) => {
            const selected = opt === value;
            return (
              <button
                key={String(opt)}
                type="button"
                role="option"
                aria-selected={selected}
                onClick={() => { onChange(opt); close(); }}
                className={cn(
                  'w-full flex items-center gap-2 px-3 py-1.5 text-[13px] transition-colors',
                  selected
                    ? 'text-[var(--text-primary)] bg-[var(--bg-hover)]'
                    : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]',
                )}
              >
                <Check className={cn('h-3.5 w-3.5 shrink-0', selected ? 'text-[var(--accent)]' : 'invisible')} />
                <span className="tabular-nums">{formatPageSizeLabel(opt)}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function PreferencesSection() {
  const { preference, setThemePreference } = useTheme();
  const { preferences, updatePreferences } = useUserPreferences();
  const { settings: dashSettings, updateSettings: updateDashSettings } =
    useDashboardSettings();
  const { pageSize: itemPageSize } = useItemPageSize();
  const t = useTerminology();
  const { saved, flash } = useSavedFlash();

  function handleDashUpdate(updates: Partial<DashboardSettings>) {
    updateDashSettings(updates);
    flash();
  }

  return (
    <>
      <SettingsPageHeader title="Preferences" description="Customize your experience." />

      <SettingsSection label="Appearance">
        <SettingsRow
          label="Theme"
          control={
            <OptionGroup
              options={themeOptions}
              value={preference}
              onChange={setThemePreference}
              iconOnly
            />
          }
        />
      </SettingsSection>

      <SettingsSection label="Display">
        <SettingsRow
          label={`Items per ${t.bin} page`}
          description={`Number of items shown before pagination. Select "All on one page" to disable.`}
          control={
            <ItemPageSizeSelect
              value={itemPageSize}
              onChange={setItemPageSize}
              ariaLabel={`Items per ${t.bin} page`}
            />
          }
        />
      </SettingsSection>

      <SettingsSection label="Keyboard">
        <SettingsRow
          label="Keyboard Shortcuts"
          description={
            <span>
              Press{' '}
              <kbd className="inline-flex items-center justify-center min-w-[20px] h-5 px-1 rounded-[var(--radius-sm)] bg-[var(--bg-input)] font-mono text-[11px] text-[var(--text-secondary)] leading-none">
                ?
              </kbd>{' '}
              to view all shortcuts
            </span>
          }
          control={
            <Switch
              checked={preferences.keyboard_shortcuts_enabled}
              onCheckedChange={(checked) =>
                updatePreferences({ keyboard_shortcuts_enabled: checked })
              }
            />
          }
        />
      </SettingsSection>

      <SettingsSection
        label="Dashboard Widgets"
        action={<SavedBadge visible={saved} />}
      >
        <SettingsRow
          label="Stats"
          control={
            <Switch
              checked={dashSettings.showStats}
              onCheckedChange={(checked) =>
                handleDashUpdate({ showStats: checked })
              }
            />
          }
        />
        <SettingsRow
          label="Needs Organizing"
          control={
            <Switch
              checked={dashSettings.showNeedsOrganizing}
              onCheckedChange={(checked) =>
                handleDashUpdate({ showNeedsOrganizing: checked })
              }
            />
          }
        />
        <SettingsRow
          label="Saved Views"
          control={
            <Switch
              checked={dashSettings.showSavedViews}
              onCheckedChange={(checked) =>
                handleDashUpdate({ showSavedViews: checked })
              }
            />
          }
        />
        <SettingsRow
          label={`Pinned ${t.Bins}`}
          control={
            <Switch
              checked={dashSettings.showPinnedBins}
              onCheckedChange={(checked) =>
                handleDashUpdate({ showPinnedBins: checked })
              }
            />
          }
        />
        <SettingsRow
          label="Recently Scanned"
          control={
            <Switch
              checked={dashSettings.showRecentlyScanned}
              onCheckedChange={(checked) =>
                handleDashUpdate({ showRecentlyScanned: checked })
              }
            />
          }
        />
        <SettingsRow
          label="Recently Updated"
          border={false}
          control={
            <Switch
              checked={dashSettings.showRecentlyUpdated}
              onCheckedChange={(checked) =>
                handleDashUpdate({ showRecentlyUpdated: checked })
              }
            />
          }
        />

        <div className="grid grid-cols-2 gap-3 pt-3">
          <FormField label="Recent bins shown" htmlFor="recentBinsCount">
            <Input
              id="recentBinsCount"
              type="number"
              min={DASHBOARD_LIMITS.recentBinsCount.min}
              max={DASHBOARD_LIMITS.recentBinsCount.max}
              value={dashSettings.recentBinsCount}
              onChange={(e) =>
                updateDashSettings({
                  recentBinsCount: Number(e.target.value),
                })
              }
              onBlur={(e) => {
                const clamped = clamp(
                  Number(e.target.value),
                  DASHBOARD_LIMITS.recentBinsCount.min,
                  DASHBOARD_LIMITS.recentBinsCount.max,
                );
                updateDashSettings({ recentBinsCount: clamped });
                flash();
              }}
            />
          </FormField>
          <FormField label="Scan history entries" htmlFor="scanHistoryMax">
            <Input
              id="scanHistoryMax"
              type="number"
              min={DASHBOARD_LIMITS.scanHistoryMax.min}
              max={DASHBOARD_LIMITS.scanHistoryMax.max}
              value={dashSettings.scanHistoryMax}
              onChange={(e) =>
                updateDashSettings({
                  scanHistoryMax: Number(e.target.value),
                })
              }
              onBlur={(e) => {
                const clamped = clamp(
                  Number(e.target.value),
                  DASHBOARD_LIMITS.scanHistoryMax.min,
                  DASHBOARD_LIMITS.scanHistoryMax.max,
                );
                updateDashSettings({ scanHistoryMax: clamped });
                flash();
              }}
            />
          </FormField>
        </div>
      </SettingsSection>

      <SettingsSection label="Usage Tracking">
        <SettingsRow
          label="Scan QR code"
          description="Record a usage dot when you scan a QR code"
          control={
            <Switch
              checked={preferences.usage_tracking_scan}
              onCheckedChange={(checked) => updatePreferences({ usage_tracking_scan: checked })}
            />
          }
        />
        <SettingsRow
          label="Manual code lookup"
          description={`Record when you look up a ${t.bin} by typing its code`}
          control={
            <Switch
              checked={preferences.usage_tracking_manual_lookup}
              onCheckedChange={(checked) => updatePreferences({ usage_tracking_manual_lookup: checked })}
            />
          }
        />
        <SettingsRow
          label={`View ${t.bin}`}
          description={`Record every time you open a ${t.bin} detail page`}
          control={
            <Switch
              checked={preferences.usage_tracking_view}
              onCheckedChange={(checked) => updatePreferences({ usage_tracking_view: checked })}
            />
          }
        />
        <SettingsRow
          label={`Modify ${t.bin}`}
          description={`Record when you edit a ${t.bin}'s contents or metadata`}
          control={
            <Switch
              checked={preferences.usage_tracking_modify}
              onCheckedChange={(checked) => updatePreferences({ usage_tracking_modify: checked })}
            />
          }
        />
        <SettingsRow
          label="Default granularity"
          description="Heatmap display: day / week / month"
          control={
            <OptionGroup
              options={[
                { key: 'daily' as const, label: 'Day' },
                { key: 'weekly' as const, label: 'Week' },
                { key: 'monthly' as const, label: 'Month' },
              ]}
              value={preferences.usage_granularity}
              onChange={(v) => updatePreferences({ usage_granularity: v })}
              size="sm"
            />
          }
        />
      </SettingsSection>
    </>
  );
}
