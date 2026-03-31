import { Paintbrush, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Disclosure } from '@/components/ui/disclosure';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import type { AppSettings } from '@/lib/appSettings';
import { SavedBadge, useSavedFlash } from './useSavedFlash';

interface PersonalizationSectionProps {
  settings: AppSettings;
  updateSettings: (updates: Partial<AppSettings>) => void;
  resetSettings: () => void;
}

export function PersonalizationSection({ settings, updateSettings, resetSettings }: PersonalizationSectionProps) {
  const { saved, flash } = useSavedFlash();

  return (
    <Card>
      <CardContent>
        <Disclosure
          label={
            <span className="inline-flex items-center gap-1.5 text-[var(--text-primary)]">
              <Paintbrush className="h-4 w-4" />
              Personalization
              <SavedBadge visible={saved} />
            </span>
          }
          labelClassName="text-[15px] font-semibold"
        >
          <div className="flex flex-col gap-3 mt-1">
            <FormField label="App Name" htmlFor="app-name">
              <Input
                id="app-name"
                value={settings.appName}
                onChange={(e) => updateSettings({ appName: e.target.value })}
                onBlur={flash}
                placeholder="OpenBin"
              />
            </FormField>
            <div>
              <p className="text-[13px] text-[var(--text-secondary)] font-medium mb-1">Custom Terminology</p>
              <p className="text-[11px] text-[var(--text-tertiary)] mb-2">Rename core concepts to match your workflow.</p>
              <div className="space-y-2">
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
            </div>
            <Button variant="outline" onClick={resetSettings} className="justify-start rounded-[var(--radius-sm)] h-11">
              <RotateCcw className="h-4 w-4 mr-2.5" />
              Reset to Defaults
            </Button>
          </div>
        </Disclosure>
      </CardContent>
    </Card>
  );
}
