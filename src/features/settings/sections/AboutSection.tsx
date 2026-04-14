import { ExternalLink, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useLocationList } from '@/features/locations/useLocations';
import { useAppSettings } from '@/lib/appSettings';
import { useAuth } from '@/lib/auth';
import { useTerminology } from '@/lib/terminology';
import { useUserPreferences } from '@/lib/userPreferences';
import { cn, focusRing } from '@/lib/utils';
import { SettingsPageHeader } from '../SettingsPageHeader';
import { SettingsSection } from '../SettingsSection';

export function AboutSection() {
  const navigate = useNavigate();
  const { settings } = useAppSettings();
  const { activeLocationId } = useAuth();
  const { locations } = useLocationList();
  const t = useTerminology();
  const { updatePreferences } = useUserPreferences();

  const activeLocation = locations.find((l) => l.id === activeLocationId);
  const binCount = activeLocation?.bin_count ?? 0;

  return (
    <>
      <SettingsPageHeader title="About" description="Version info and resources." />

      <SettingsSection label="Info">
        <div className="py-3 border-b border-[var(--border-subtle)]">
          <div className="flex items-baseline gap-2">
            <p className="text-[var(--text-md)] font-semibold text-[var(--text-primary)]">{settings.appName}</p>
            <span className="text-[var(--text-sm)] text-[var(--text-tertiary)]">v{__APP_VERSION__}</span>
          </div>
        </div>
        {activeLocation && (
          <div className="py-3 border-b border-[var(--border-subtle)]">
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-[var(--text-sm)] text-[var(--text-secondary)]">
              <span>{binCount} {binCount !== 1 ? t.bins : t.bin}</span>
              {activeLocation.area_count != null && (
                <span>{activeLocation.area_count} {activeLocation.area_count !== 1 ? t.areas : t.area}</span>
              )}
              {activeLocation.member_count != null && (
                <span>{activeLocation.member_count} {activeLocation.member_count === 1 ? 'member' : 'members'}</span>
              )}
            </div>
          </div>
        )}
      </SettingsSection>

      <SettingsSection label="Links">
        <div className="flex gap-4 py-3">
          <a
            href="https://github.com/akifbayram/openbin"
            target="_blank"
            rel="noopener noreferrer"
            className={cn('inline-flex items-center gap-1.5 text-[var(--text-sm)] text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors rounded-[var(--radius-xs)]', focusRing)}
          >
            GitHub
            <ExternalLink className="h-3 w-3" />
          </a>
          <button
            type="button"
            onClick={() => {
              updatePreferences({ tour_completed: false, tour_version: 0 });
              navigate('/bins', { state: { startTour: true } });
            }}
            className={cn('inline-flex items-center gap-1.5 text-[var(--text-sm)] text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors rounded-[var(--radius-xs)]', focusRing)}
          >
            <Sparkles className="h-3 w-3" />
            Replay Tour
          </button>
        </div>
      </SettingsSection>
    </>
  );
}
