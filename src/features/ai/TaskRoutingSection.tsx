import { RotateCcw } from 'lucide-react';
import { Disclosure } from '@/components/ui/disclosure';
import { Input } from '@/components/ui/input';
import { cn, inputBase } from '@/lib/utils';
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
  const hasAnyOverride = Object.values(overrides).some((o) => o && (o.provider || o.model));

  const configuredProviders = settings.providerConfigs
    ? Object.keys(settings.providerConfigs) as AiProvider[]
    : [settings.provider];

  return (
    <Disclosure label="Task Routing" indicator={hasAnyOverride}>
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
                  <div className="px-3 py-2 rounded-[var(--radius-sm)] bg-[var(--accent)]/10 border border-[var(--accent)]/20">
                    <p className="text-[12px] text-[var(--text-secondary)]">
                      Configured by server
                      {envOverride?.provider && ` \u2014 ${envOverride.provider}`}
                      {envOverride?.model && ` / ${envOverride.model}`}
                    </p>
                  </div>
                )}

                {!isLocked && (
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:gap-3">
                    <div className="flex-1 min-w-0 space-y-1">
                      <label htmlFor={`task-provider-${group.key}`} className="text-[12px] text-[var(--text-tertiary)]">Provider</label>
                      <select
                        id={`task-provider-${group.key}`}
                        value={selectedProvider}
                        onChange={(e) => {
                          const provider = e.target.value || null;
                          onChange(group.key, {
                            provider,
                            model: provider ? selectedModel : null,
                            endpointUrl: provider === 'openai-compatible' ? selectedEndpoint : null,
                          });
                        }}
                        disabled={disabled}
                        className={cn(inputBase, 'text-[13px]')}
                      >
                        <option value="">Default ({AI_PROVIDERS.find((p) => p.key === settings.provider)?.label ?? settings.provider})</option>
                        {configuredProviders.map((p) => (
                          <option key={p} value={p}>
                            {AI_PROVIDERS.find((ap) => ap.key === p)?.label ?? p}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="flex-1 min-w-0 space-y-1">
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
                        className="self-end sm:self-center p-1.5 text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors"
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
    </Disclosure>
  );
}
