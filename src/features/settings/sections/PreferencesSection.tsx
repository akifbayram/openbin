import { Monitor, Moon, Sun } from 'lucide-react';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import type { OptionGroupOption } from '@/components/ui/option-group';
import { OptionGroup } from '@/components/ui/option-group';
import { Switch } from '@/components/ui/switch';
import {
  clamp,
  DASHBOARD_LIMITS,
  type DashboardSettings,
  useDashboardSettings,
} from '@/lib/dashboardSettings';
import { useTerminology } from '@/lib/terminology';
import type { ThemePreference } from '@/lib/theme';
import { useTheme } from '@/lib/theme';
import { useUserPreferences } from '@/lib/userPreferences';
import { SettingsPageHeader } from '../SettingsPageHeader';
import { SettingsRow } from '../SettingsRow';
import { SettingsSection } from '../SettingsSection';
import { SavedBadge, useSavedFlash } from '../useSavedFlash';

const themeOptions: OptionGroupOption<ThemePreference>[] = [
  { key: 'light', label: 'Light', icon: Sun },
  { key: 'dark', label: 'Dark', icon: Moon },
  { key: 'auto', label: 'Auto', icon: Monitor },
];

export function PreferencesSection() {
  const { preference, setThemePreference } = useTheme();
  const { preferences, updatePreferences } = useUserPreferences();
  const { settings: dashSettings, updateSettings: updateDashSettings } =
    useDashboardSettings();
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
    </>
  );
}
