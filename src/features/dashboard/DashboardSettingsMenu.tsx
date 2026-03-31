import { Settings2 } from 'lucide-react';
import { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Tooltip } from '@/components/ui/tooltip';
import { DASHBOARD_LIMITS, type DashboardSettings } from '@/lib/dashboardSettings';
import { useClickOutside } from '@/lib/useClickOutside';
import { usePopover } from '@/lib/usePopover';
import { cn } from '@/lib/utils';

interface DashboardSettingsMenuProps {
  settings: DashboardSettings;
  onUpdate: (patch: Partial<DashboardSettings>) => void;
  terminology: { Bins: string };
}

const SECTION_TOGGLES: Array<{ key: keyof DashboardSettings & `show${string}`; label: string }> = [
  { key: 'showStats', label: 'Stats' },
  { key: 'showNeedsOrganizing', label: 'Needs Organizing' },
  { key: 'showSavedViews', label: 'Saved Searches' },
  { key: 'showPinnedBins', label: 'Pinned' },
  { key: 'showRecentlyScanned', label: 'Recently Scanned' },
  { key: 'showRecentlyUpdated', label: 'Recently Updated' },
];

export function DashboardSettingsMenu({ settings, onUpdate, terminology }: DashboardSettingsMenuProps) {
  const { visible, animating, close, toggle } = usePopover();
  const menuRef = useRef<HTMLDivElement>(null);

  useClickOutside(menuRef, close);

  return (
    <div ref={menuRef} className="relative">
      <Tooltip content="Dashboard settings" side="bottom">
        <Button
          variant="ghost"
          size="icon"
          onClick={toggle}
          className="h-10 w-10 rounded-[var(--radius-sm)]"
          aria-label="Dashboard settings"
        >
          <Settings2 className="h-5 w-5" />
        </Button>
      </Tooltip>
      {visible && (
        <div className={cn(
          animating === 'exit' ? 'animate-popover-exit' : 'animate-popover-enter',
          'absolute right-0 mt-1 w-60 rounded-[var(--radius-md)] flat-popover overflow-hidden z-20',
        )}>
          <div className="px-3.5 py-2 text-[11px] font-medium text-[var(--text-tertiary)] uppercase tracking-wide">
            Sections
          </div>
          {SECTION_TOGGLES.map(({ key, label }) => (
            <label
              key={key}
              htmlFor={`dash-toggle-${key}`}
              className="w-full row-spread px-3.5 py-2 text-[14px] text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors cursor-pointer"
            >
              {key === 'showPinnedBins' ? `Pinned ${terminology.Bins}` : label}
              <Switch
                id={`dash-toggle-${key}`}
                checked={settings[key] as boolean}
                onCheckedChange={(checked) => onUpdate({ [key]: checked })}
              />
            </label>
          ))}
          <div className="border-t border-[var(--border-subtle)] mt-1 pt-1">
            <div className="px-3.5 py-2 text-[11px] font-medium text-[var(--text-tertiary)] uppercase tracking-wide">
              Display
            </div>
            <label
              htmlFor="dash-toggle-timestamps"
              className="w-full row-spread px-3.5 py-2 text-[14px] text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors cursor-pointer"
            >
              Timestamps
              <Switch
                id="dash-toggle-timestamps"
                checked={settings.showTimestamps}
                onCheckedChange={(checked) => onUpdate({ showTimestamps: checked })}
              />
            </label>
            <div className="px-3.5 py-2 flex items-center gap-3">
              <span className="text-[14px] text-[var(--text-primary)]">Recent {terminology.Bins}</span>
              <input
                type="range"
                min={DASHBOARD_LIMITS.recentBinsCount.min}
                max={DASHBOARD_LIMITS.recentBinsCount.max}
                value={settings.recentBinsCount}
                onChange={(e) => onUpdate({ recentBinsCount: Number(e.target.value) })}
                className="flex-1 accent-[var(--accent)]"
                aria-label="Number of recent bins to show"
              />
              <span className="text-[13px] text-[var(--text-secondary)] tabular-nums w-5 text-right">
                {settings.recentBinsCount}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
