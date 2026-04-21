import { RotateCcw } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import type { AiProvider, AiSettings, AiTaskGroup } from '@/types';
import { AI_PROVIDERS, MODEL_HINTS, TASK_GROUP_META } from './aiConstants';

interface TaskRoutingSectionProps {
  settings: AiSettings;
  overrides: Partial<Record<AiTaskGroup, { provider: string | null; model: string | null; endpointUrl: string | null }>>;
  onChange: (group: AiTaskGroup, override: { provider: string | null; model: string | null; endpointUrl: string | null } | null) => void;
  disabled?: boolean;
}

export function TaskRoutingSection({ settings, overrides, onChange, disabled }: TaskRoutingSectionProps) {
  const envLocked = settings.taskOverridesEnvLocked ?? [];

  const configuredProviders = settings.providerConfigs
    ? Object.keys(settings.providerConfigs) as AiProvider[]
    : [settings.provider];

  return (
    <div className="flex flex-col">
      {TASK_GROUP_META.map((group, i) => {
        const isLocked = envLocked.includes(group.key);
        const envOverride = settings.taskOverrides?.[group.key];
        const override = isLocked ? envOverride : overrides[group.key];
        const hasOverride = !!(override?.provider || override?.model);
        const selectedProvider = override?.provider || '';
        const selectedModel = override?.model || '';
        const selectedEndpoint = override?.endpointUrl || '';

        return (
          <div key={group.key}>
            {i > 0 && <div className="border-t border-[var(--border-subtle)] my-3" />}
            <div className="space-y-2">
              <div>
                <span className="text-[13px] font-medium text-[var(--text-primary)]">{group.label}</span>
                <span className="text-[11px] text-[var(--text-tertiary)] ml-1.5">{group.description}</span>
              </div>

              {isLocked && (
                <div className="settings-section-banner settings-section-banner-info">
                  Configured by server
                  {envOverride?.provider && ` \u2014 ${envOverride.provider}`}
                  {envOverride?.model && ` / ${envOverride.model}`}
                </div>
              )}

              {!isLocked && (
                <div className="flex flex-col gap-2">
                  <div className="min-w-0 space-y-1">
                    <label htmlFor={`task-provider-${group.key}`} className="text-[12px] text-[var(--text-tertiary)]">Provider</label>
                    <Select<string>
                      id={`task-provider-${group.key}`}
                      value={selectedProvider}
                      onChange={(v) => {
                        const provider = v || null;
                        onChange(group.key, {
                          provider,
                          model: provider ? selectedModel : null,
                          endpointUrl: provider === 'openai-compatible' ? selectedEndpoint : null,
                        });
                      }}
                      disabled={disabled}
                      ariaLabel="Provider"
                      options={[
                        {
                          value: '',
                          label: `Default (${AI_PROVIDERS.find((p) => p.key === settings.provider)?.label ?? settings.provider})`,
                        },
                        ...configuredProviders.map((p) => ({
                          value: p,
                          label: AI_PROVIDERS.find((ap) => ap.key === p)?.label ?? p,
                        })),
                      ]}
                    />
                  </div>

                  <div className="min-w-0 space-y-1">
                    <label htmlFor={`task-model-${group.key}`} className="text-[12px] text-[var(--text-tertiary)]">Model</label>
                    <Input
                      id={`task-model-${group.key}`}
                      value={selectedModel}
                      onChange={(e) => {
                        onChange(group.key, {
                          provider: selectedProvider || null,
                          model: e.target.value || null,
                          endpointUrl: selectedEndpoint || null,
                        });
                      }}
                      placeholder={
                        selectedProvider
                          ? (MODEL_HINTS[selectedProvider as AiProvider] ?? '')
                          : settings.model
                      }
                      disabled={disabled}
                      className="text-[13px]"
                    />
                  </div>

                  {hasOverride && !disabled && (
                    <button
                      type="button"
                      onClick={() => onChange(group.key, null)}
                      className="self-end p-1.5 text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors"
                      title="Reset to default"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              )}

              {!isLocked && selectedProvider === 'openai-compatible' && (
                <div className="space-y-1">
                  <label htmlFor={`task-endpoint-${group.key}`} className="text-[12px] text-[var(--text-tertiary)]">Endpoint URL</label>
                  <Input
                    id={`task-endpoint-${group.key}`}
                    value={selectedEndpoint}
                    onChange={(e) => {
                      onChange(group.key, {
                        provider: selectedProvider,
                        model: selectedModel || null,
                        endpointUrl: e.target.value || null,
                      });
                    }}
                    placeholder="http://localhost:11434/v1"
                    disabled={disabled}
                    className="text-[13px]"
                  />
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
