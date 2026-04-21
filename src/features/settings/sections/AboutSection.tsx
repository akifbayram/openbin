import { Box, Github, MapPin, Sparkles, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useLocationList } from '@/features/locations/useLocations';
import { useAppSettings } from '@/lib/appSettings';
import { useAuth } from '@/lib/auth';
import { useTerminology } from '@/lib/terminology';
import { useUserPreferences } from '@/lib/userPreferences';
import { SettingsPageHeader } from '../SettingsPageHeader';
import { SettingsRow } from '../SettingsRow';
import { SettingsSection } from '../SettingsSection';

interface StatCellProps {
  icon: React.ComponentType<{ className?: string }>;
  value: number;
  label: string;
}

function StatCell({ icon: Icon, value, label }: StatCellProps) {
  return (
    <div className="flex flex-col gap-1">
      <Icon className="size-4 text-[var(--text-tertiary)]" aria-hidden="true" />
      <div className="mt-1.5 text-[22px] leading-none font-semibold tabular-nums text-[var(--text-primary)]">
        {value}
      </div>
      <div className="settings-row-desc mt-0.5">{label}</div>
    </div>
  );
}

export function AboutSection() {
  const navigate = useNavigate();
  const { settings } = useAppSettings();
  const { activeLocationId } = useAuth();
  const { locations } = useLocationList();
  const t = useTerminology();
  const { updatePreferences } = useUserPreferences();

  const activeLocation = locations.find((l) => l.id === activeLocationId);

  return (
    <>
      <SettingsPageHeader
        title="About"
        description="Version info, workspace stats, and resources."
      />

      <SettingsSection label="App">
        <div className="flex items-baseline gap-3 py-2">
          <span className="settings-entity-title">{settings.appName}</span>
          <span className="settings-hint tabular-nums tracking-wide">
            v{__APP_VERSION__}
          </span>
        </div>
      </SettingsSection>

      {activeLocation && (
        <SettingsSection label="Workspace" dividerAbove>
          <div className="grid grid-cols-3 gap-6 py-2">
            <StatCell
              icon={Box}
              value={activeLocation.bin_count ?? 0}
              label={(activeLocation.bin_count ?? 0) === 1 ? t.bin : t.bins}
            />
            {activeLocation.area_count != null && (
              <StatCell
                icon={MapPin}
                value={activeLocation.area_count}
                label={activeLocation.area_count === 1 ? t.area : t.areas}
              />
            )}
            {activeLocation.member_count != null && (
              <StatCell
                icon={Users}
                value={activeLocation.member_count}
                label={activeLocation.member_count === 1 ? 'member' : 'members'}
              />
            )}
          </div>
        </SettingsSection>
      )}

      <SettingsSection label="Resources" dividerAbove>
        <SettingsRow
          icon={Github}
          label="GitHub"
          description="Source code, issues, and releases"
          onClick={() =>
            window.open(
              'https://github.com/akifbayram/openbin',
              '_blank',
              'noopener,noreferrer',
            )
          }
        />
        <SettingsRow
          icon={Sparkles}
          label="Replay tour"
          description="Revisit the guided product walkthrough"
          border={false}
          onClick={() => {
            updatePreferences({ tour_completed: false, tour_version: 0 });
            navigate('/bins', { state: { startTour: true } });
          }}
        />
      </SettingsSection>
    </>
  );
}
