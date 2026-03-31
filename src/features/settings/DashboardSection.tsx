import { LayoutDashboard } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Disclosure } from '@/components/ui/disclosure';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { clamp, DASHBOARD_LIMITS, type DashboardSettings } from '@/lib/dashboardSettings';
import { useTerminology } from '@/lib/terminology';
import { SavedBadge, useSavedFlash } from './useSavedFlash';

interface DashboardSectionProps {
  settings: DashboardSettings;
  updateSettings: (updates: Partial<DashboardSettings>) => void;
}

export function DashboardSection({ settings, updateSettings }: DashboardSectionProps) {
  const t = useTerminology();
  const { saved, flash } = useSavedFlash();

  function handleUpdate(updates: Partial<DashboardSettings>) {
    updateSettings(updates);
    flash();
  }

  return (
    <Card id="dashboard-settings">
      <CardContent>
        <Disclosure
          label={
            <span className="inline-flex items-center gap-1.5 text-[var(--text-primary)]">
              <LayoutDashboard className="h-4 w-4" />
              Dashboard
              <SavedBadge visible={saved} />
            </span>
          }
          labelClassName="text-[15px] font-semibold"
        >
        <div className="flex flex-col gap-3 mt-1">
          <div className="space-y-1.5">
            <div className="flex flex-col gap-2">
              {([
                { key: 'showStats' as const, label: 'Stats' },
                { key: 'showNeedsOrganizing' as const, label: 'Needs Organizing' },
                { key: 'showSavedViews' as const, label: 'Saved Views' },
                { key: 'showPinnedBins' as const, label: `Pinned ${t.Bins}` },
                { key: 'showRecentlyScanned' as const, label: 'Recently Scanned' },
                { key: 'showRecentlyUpdated' as const, label: 'Recently Updated' },
              ]).map(({ key, label }) => (
                <div key={key} className="row-spread py-1">
                  <span id={`dash-${key}`} className="text-[14px] text-[var(--text-primary)]">{label}</span>
                  <Switch
                    checked={settings[key]}
                    onCheckedChange={(checked) => handleUpdate({ [key]: checked })}
                    aria-labelledby={`dash-${key}`}
                  />
                </div>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <FormField
              label={`Recent ${t.bins} shown`}
              htmlFor="recent-bins"
              hint={`${DASHBOARD_LIMITS.recentBinsCount.min}–${DASHBOARD_LIMITS.recentBinsCount.max}`}
            >
              <Input
                id="recent-bins"
                type="number"
                inputMode="numeric"
                min={DASHBOARD_LIMITS.recentBinsCount.min}
                max={DASHBOARD_LIMITS.recentBinsCount.max}
                value={settings.recentBinsCount}
                onChange={(e) => updateSettings({ recentBinsCount: Number(e.target.value) })}
                onBlur={(e) => {
                  const clamped = clamp(Number(e.target.value), DASHBOARD_LIMITS.recentBinsCount.min, DASHBOARD_LIMITS.recentBinsCount.max);
                  if (clamped !== settings.recentBinsCount) updateSettings({ recentBinsCount: clamped });
                  flash();
                }}
              />
            </FormField>
            <FormField
              label="Scan history entries"
              htmlFor="scan-history"
              hint={`${DASHBOARD_LIMITS.scanHistoryMax.min}–${DASHBOARD_LIMITS.scanHistoryMax.max}`}
            >
              <Input
                id="scan-history"
                type="number"
                inputMode="numeric"
                min={DASHBOARD_LIMITS.scanHistoryMax.min}
                max={DASHBOARD_LIMITS.scanHistoryMax.max}
                value={settings.scanHistoryMax}
                onChange={(e) => updateSettings({ scanHistoryMax: Number(e.target.value) })}
                onBlur={(e) => {
                  const clamped = clamp(Number(e.target.value), DASHBOARD_LIMITS.scanHistoryMax.min, DASHBOARD_LIMITS.scanHistoryMax.max);
                  if (clamped !== settings.scanHistoryMax) updateSettings({ scanHistoryMax: clamped });
                  flash();
                }}
              />
            </FormField>
          </div>
        </div>
        </Disclosure>
      </CardContent>
    </Card>
  );
}
