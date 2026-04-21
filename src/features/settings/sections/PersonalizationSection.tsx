import { RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { useAppSettings } from '@/lib/appSettings';
import { SettingsPageHeader } from '../SettingsPageHeader';
import { SettingsSection } from '../SettingsSection';
import { SavedBadge, useSavedFlash } from '../useSavedFlash';

const TERM_ROWS = [
  { key: 'termBin', singular: 'Bin', plural: 'Bins' },
  { key: 'termLocation', singular: 'Location', plural: 'Locations' },
  { key: 'termArea', singular: 'Area', plural: 'Areas' },
] as const;

export function PersonalizationSection() {
  const { settings, updateSettings, resetSettings } = useAppSettings();
  const { saved, flash } = useSavedFlash();

  return (
    <>
      <SettingsPageHeader
        title="Personalization"
        description="Customize naming and branding for your workspace."
        action={<SavedBadge visible={saved} />}
      />

      <SettingsSection label="App Name">
        <FormField label="Workspace name" htmlFor="app-name" hint="Shown in the header and browser tab.">
          <Input
            id="app-name"
            value={settings.appName}
            onChange={(e) => updateSettings({ appName: e.target.value })}
            onBlur={flash}
            placeholder="OpenBin"
          />
        </FormField>
      </SettingsSection>

      <SettingsSection
        label="Custom Terminology"
        dividerAbove
        description="Rename core concepts to match your workflow. Singular and plural are used throughout the UI."
      >
        <div className="flex flex-col gap-4">
          {TERM_ROWS.map(({ key, singular, plural }) => {
            const raw = settings[key];
            const parts = raw ? raw.split('|') : ['', ''];
            return (
              <div key={key} className="grid grid-cols-1 gap-2 sm:grid-cols-[120px_1fr_1fr] sm:items-center">
                <span className="settings-field-label">{singular}</span>
                <Input
                  value={parts[0] || ''}
                  onChange={(e) => {
                    const newSingular = e.target.value;
                    const newPlural = parts[1] || '';
                    updateSettings({ [key]: newSingular || newPlural ? `${newSingular}|${newPlural}` : '' });
                  }}
                  onBlur={flash}
                  placeholder={singular}
                  aria-label={`${singular} singular name`}
                />
                <Input
                  value={parts[1] || ''}
                  onChange={(e) => {
                    const newSingular = parts[0] || '';
                    const newPlural = e.target.value;
                    updateSettings({ [key]: newSingular || newPlural ? `${newSingular}|${newPlural}` : '' });
                  }}
                  onBlur={flash}
                  placeholder={plural}
                  aria-label={`${plural} plural name`}
                />
              </div>
            );
          })}
        </div>
      </SettingsSection>

      <div className="pt-2">
        <Button variant="outline" onClick={resetSettings}>
          <RotateCcw className="h-4 w-4 mr-2" />
          Reset to defaults
        </Button>
      </div>
    </>
  );
}
