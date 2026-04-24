import { Github, RefreshCw } from 'lucide-react';
import { TourLauncher } from '@/features/tour/TourLauncher';
import { listTours } from '@/features/tour/tourRegistry';
import { useAppSettings } from '@/lib/appSettings';
import { useUserPreferences } from '@/lib/userPreferences';
import { SettingsPageHeader } from '../SettingsPageHeader';
import { SettingsRow } from '../SettingsRow';
import { SettingsSection } from '../SettingsSection';

export function AboutSection() {
  const { settings } = useAppSettings();
  const { updatePreferences } = useUserPreferences();
  const tours = listTours();

  return (
    <>
      <SettingsPageHeader title="About" description="Version info and resources." />

      <SettingsSection label="App">
        <div className="flex items-baseline gap-3 py-2">
          <span className="settings-entity-title">{settings.appName}</span>
          <span className="settings-hint tabular-nums tracking-wide">v{__APP_VERSION__}</span>
        </div>
      </SettingsSection>

      <SettingsSection label="Guided tours" dividerAbove>
        <div className="flex flex-col">
          {tours.map((tour) => (
            <TourLauncher key={tour.id} tourId={tour.id} variant="menu" />
          ))}
        </div>
        <SettingsRow
          icon={RefreshCw}
          label="Reset all tours"
          description="Mark every tour unseen so they show up again"
          border={false}
          onClick={() => updatePreferences({ tours_seen: [] })}
        />
      </SettingsSection>

      <SettingsSection label="Resources" dividerAbove>
        <SettingsRow
          icon={Github}
          label="GitHub"
          description="Source code, issues, and releases"
          border={false}
          onClick={() =>
            window.open('https://github.com/akifbayram/openbin', '_blank', 'noopener,noreferrer')
          }
        />
      </SettingsSection>
    </>
  );
}
