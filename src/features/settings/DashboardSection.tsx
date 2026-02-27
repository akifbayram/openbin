import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FormField } from '@/components/ui/form-field';
import { Switch } from '@/components/ui/switch';
import { useTerminology } from '@/lib/terminology';
import { DASHBOARD_LIMITS, type DashboardSettings } from '@/lib/dashboardSettings';

interface DashboardSectionProps {
  settings: DashboardSettings;
  updateSettings: (updates: Partial<DashboardSettings>) => void;
}

export function DashboardSection({ settings, updateSettings }: DashboardSectionProps) {
  const t = useTerminology();

  return (
    <Card id="dashboard-settings">
      <CardContent>
        <Label>Dashboard</Label>
        <div className="flex flex-col gap-3 mt-3">
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
                <div key={key} className="flex items-center justify-between py-1">
                  <span className="text-[14px] text-[var(--text-primary)]">{label}</span>
                  <Switch
                    checked={settings[key]}
                    onCheckedChange={(checked) => updateSettings({ [key]: checked })}
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
                min={DASHBOARD_LIMITS.recentBinsCount.min}
                max={DASHBOARD_LIMITS.recentBinsCount.max}
                value={settings.recentBinsCount}
                onChange={(e) => updateSettings({ recentBinsCount: Number(e.target.value) })}
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
                min={DASHBOARD_LIMITS.scanHistoryMax.min}
                max={DASHBOARD_LIMITS.scanHistoryMax.max}
                value={settings.scanHistoryMax}
                onChange={(e) => updateSettings({ scanHistoryMax: Number(e.target.value) })}
              />
            </FormField>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
