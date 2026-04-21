import { Github, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAppSettings } from '@/lib/appSettings';
import { useUserPreferences } from '@/lib/userPreferences';
import { SettingsPageHeader } from '../SettingsPageHeader';
import { SettingsRow } from '../SettingsRow';
import { SettingsSection } from '../SettingsSection';

export function AboutSection() {
  const navigate = useNavigate();
  const { settings } = useAppSettings();
  const { updatePreferences } = useUserPreferences();

  return (
    <>
      <SettingsPageHeader
        title="About"
        description="Version info and resources."
      />

      <SettingsSection label="App">
        <div className="flex items-baseline gap-3 py-2">
          <span className="settings-entity-title">{settings.appName}</span>
          <span className="settings-hint tabular-nums tracking-wide">
            v{__APP_VERSION__}
          </span>
        </div>
      </SettingsSection>

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
