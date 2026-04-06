import { RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { useAppSettings } from '@/lib/appSettings';
import { SettingsSection } from '../SettingsSection';
import { SavedBadge, useSavedFlash } from '../useSavedFlash';

export function PersonalizationSection() {
  const { settings, updateSettings, resetSettings } = useAppSettings();
  const { saved, flash } = useSavedFlash();

  return (
    <>
      <div className="mb-6">
        <div className="flex items-center gap-2">
          <h2 className="text-[20px] font-bold text-[var(--text-primary)]">
            Personalization
          </h2>
          <SavedBadge visible={saved} />
        </div>
        <p className="text-[13px] text-[var(--text-tertiary)]">
          Customize naming and branding for your workspace.
        </p>
      </div>

      <SettingsSection label="App Name">
        <div className="py-2">
          <FormField label="App Name" htmlFor="app-name">
            <Input
              id="app-name"
              value={settings.appName}
              onChange={(e) => updateSettings({ appName: e.target.value })}
              onBlur={flash}
              placeholder="OpenBin"
            />
          </FormField>
        </div>
      </SettingsSection>

      <SettingsSection
        label="Custom Terminology"
        description="Rename core concepts to match your workflow."
      >
        <div className="space-y-2 py-2">
          {([
            { key: 'termBin' as const, singular: 'Bin', plural: 'Bins' },
            { key: 'termLocation' as const, singular: 'Location', plural: 'Locations' },
            { key: 'termArea' as const, singular: 'Area', plural: 'Areas' },
          ]).map(({ key, singular, plural }) => {
            const raw = settings[key];
            const parts = raw ? raw.split('|') : ['', ''];
            return (
              <div key={key} className="grid grid-cols-2 gap-2">
                <Input
                  value={parts[0] || ''}
                  onChange={(e) => {
                    const newSingular = e.target.value;
                    const newPlural = parts[1] || '';
                    updateSettings({ [key]: newSingular || newPlural ? `${newSingular}|${newPlural}` : '' });
                  }}
                  onBlur={flash}
                  placeholder={`${singular} (singular)`}
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
                  placeholder={`${plural} (plural)`}
                  aria-label={`${plural} plural name`}
                />
              </div>
            );
          })}
        </div>
      </SettingsSection>

      <div className="pt-2">
        <Button
          variant="outline"
          onClick={resetSettings}
          className="justify-start rounded-[var(--radius-sm)] h-11"
        >
          <RotateCcw className="h-4 w-4 mr-2.5" />
          Reset to Defaults
        </Button>
      </div>
    </>
  );
}
