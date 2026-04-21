import { Eye, EyeOff, Loader2, RotateCcw, Sparkles } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Disclosure } from '@/components/ui/disclosure';
import { Input } from '@/components/ui/input';
import { OptionGroup } from '@/components/ui/option-group';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/toast';
import { useAuth } from '@/lib/auth';
import { usePlan } from '@/lib/usePlan';
import { cn, getErrorMessage } from '@/lib/utils';
import type { AiTaskGroup } from '@/types';
import { AI_PROVIDERS, KEY_PLACEHOLDERS, MODEL_HINTS, TASK_GROUP_META } from './aiConstants';
import { PROMPT_HELP_TEXT, type PromptTab } from './promptHelpText';
import { TaskRoutingSection } from './TaskRoutingSection';
import { useAiProviderSetup } from './useAiProviderSetup';
import { deleteAiSettings, deleteTaskOverride, saveAiSettings, saveTaskOverride, testAiConnection, useAiSettings } from './useAiSettings';
import { useDefaultPrompts } from './useDefaultPrompts';

const PROMPT_TAB_META = [
  { key: 'analysis', label: 'Photo Analysis', shortLabel: 'Photos' },
  { key: 'command', label: 'Commands', shortLabel: 'Cmds' },
  { key: 'query', label: 'Queries', shortLabel: 'Queries' },
  { key: 'structure', label: 'Extraction', shortLabel: 'Extract' },
  { key: 'reorganization', label: 'Reorganize', shortLabel: 'Reorg' },
  { key: 'tagSuggestion', label: 'Tag Suggestion', shortLabel: 'Tags' },
] as const;

interface AiSettingsSectionProps {
  aiEnabled: boolean;
  onToggle: (enabled: boolean) => void;
}

interface FormState {
  customPrompt: string;
  commandPrompt: string;
  queryPrompt: string;
  structurePrompt: string;
  reorganizationPrompt: string;
  tagSuggestionPrompt: string;
  temperature: string;
  maxTokens: string;
  topP: string;
  requestTimeout: string;
}

const EMPTY_FORM: FormState = {
  customPrompt: '',
  commandPrompt: '',
  queryPrompt: '',
  structurePrompt: '',
  reorganizationPrompt: '',
  tagSuggestionPrompt: '',
  temperature: '',
  maxTokens: '',
  topP: '',
  requestTimeout: '',
};

function numberToString(value: number | null | undefined): string {
  return value != null ? String(value) : '';
}

function parseOptionalNumber(value: string): number | null {
  return value ? Number(value) : null;
}

export function AiSettingsSection({ aiEnabled, onToggle }: AiSettingsSectionProps) {
  const { demoMode } = useAuth();
  const { isSelfHosted } = usePlan();
  const { settings, isLoading, setSettings } = useAiSettings();
  const { prompts: defaultPrompts } = useDefaultPrompts();
  const { showToast } = useToast();

  const setup = useAiProviderSetup({ providerConfigs: settings?.providerConfigs });
  const { setProvider, setApiKey, setModel, setEndpointUrl } = setup;

  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [activePromptTab, setActivePromptTab] = useState<PromptTab>('analysis');
  const [taskOverrides, setTaskOverrides] = useState<Partial<Record<AiTaskGroup, { provider: string | null; model: string | null; endpointUrl: string | null }>>>({});
  const [testError, setTestError] = useState('');
  const [touched, setTouched] = useState(false);

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  // Populate form from loaded settings
  useEffect(() => {
    if (settings) {
      setProvider(settings.provider);
      setApiKey(settings.apiKey);
      setModel(settings.model);
      setEndpointUrl(settings.endpointUrl || '');
      setForm({
        customPrompt: settings.customPrompt || '',
        commandPrompt: settings.commandPrompt || '',
        queryPrompt: settings.queryPrompt || '',
        structurePrompt: settings.structurePrompt || '',
        reorganizationPrompt: settings.reorganizationPrompt || '',
        tagSuggestionPrompt: settings.tagSuggestionPrompt || '',
        temperature: numberToString(settings.temperature),
        maxTokens: numberToString(settings.maxTokens),
        topP: numberToString(settings.topP),
        requestTimeout: numberToString(settings.requestTimeout),
      });
      setTaskOverrides(settings.taskOverrides
        ? Object.fromEntries(
            Object.entries(settings.taskOverrides)
              .filter(([, v]) => v)
              .map(([k, v]) => [k, { provider: v?.provider, model: v?.model, endpointUrl: v?.endpointUrl }])
          )
        : {});
    }
  }, [settings, setProvider, setApiKey, setModel, setEndpointUrl]);

  async function handleTest() {
    setup.setTestResult(null);
    setTestError('');
    try {
      await testAiConnection({
        provider: setup.provider,
        apiKey: setup.apiKey,
        model: setup.model,
        endpointUrl: setup.endpointUrl || undefined,
      });
      setup.setTestResult('success');
    } catch (err) {
      setup.setTestResult('error');
      const base = getErrorMessage(err, 'Connection failed');
      setTestError(setup.model ? `${base} (model: ${setup.model})` : base);
    }
  }

  async function handleSave() {
    try {
      const saved = await saveAiSettings({
        provider: setup.provider,
        apiKey: setup.apiKey,
        model: setup.model,
        endpointUrl: setup.endpointUrl || undefined,
        customPrompt: form.customPrompt.trim() || null,
        commandPrompt: form.commandPrompt.trim() || null,
        queryPrompt: form.queryPrompt.trim() || null,
        structurePrompt: form.structurePrompt.trim() || null,
        reorganizationPrompt: form.reorganizationPrompt.trim() || null,
        tagSuggestionPrompt: form.tagSuggestionPrompt.trim() || null,
        temperature: parseOptionalNumber(form.temperature),
        maxTokens: parseOptionalNumber(form.maxTokens),
        topP: parseOptionalNumber(form.topP),
        requestTimeout: parseOptionalNumber(form.requestTimeout),
      });

      // Save task overrides in parallel
      const overrideOps = TASK_GROUP_META.map((g) => g.key)
        .filter((group) => !settings?.taskOverridesEnvLocked?.includes(group))
        .map((group) => {
          const override = taskOverrides[group];
          const original = settings?.taskOverrides?.[group];
          if (override && (override.provider || override.model)) return saveTaskOverride(group, override);
          if (original) return deleteTaskOverride(group);
          return null;
        })
        .filter(Boolean);
      if (overrideOps.length > 0) await Promise.all(overrideOps);

      setSettings(saved);
      showToast({ message: 'AI settings saved', variant: 'success' });
    } catch (err) {
      showToast({ message: getErrorMessage(err, 'Failed to save'), variant: 'error' });
    }
  }

  async function handleRemove() {
    try {
      await deleteAiSettings();
      setSettings(null);
      setup.setProvider('openai');
      setup.setApiKey('');
      setup.setModel('');
      setup.setEndpointUrl('');
      setForm(EMPTY_FORM);
      setTaskOverrides({});
      setup.setTestResult(null);
      showToast({ message: 'AI settings removed', variant: 'success' });
    } catch {
      showToast({ message: 'Failed to remove settings', variant: 'error' });
    }
  }

  if (isLoading) return null;

  return (
    <Card id="ai-settings">
      <CardContent>
        <Disclosure defaultOpen={window.location.hash === '#ai-settings'} label={<span className="inline-flex items-center gap-1.5 text-[var(--text-primary)]"><Sparkles className="h-4 w-4" />AI Features</span>} labelClassName="text-[15px] font-semibold">
        <div className="row-spread mt-1">
          <p id="ai-toggle-description" className="text-[13px] text-[var(--text-tertiary)]">
            Photo analysis, item extraction, and AI commands
          </p>
          <Switch id="ai-toggle" checked={aiEnabled} onCheckedChange={onToggle} aria-labelledby="ai-toggle-description" />
        </div>

        {/* Animated expand/collapse wrapper — self-hosted only */}
        {isSelfHosted && (
        <div className={cn(
          'grid transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none',
          aiEnabled ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
        )}>
          <div className="overflow-hidden min-h-0 -mx-5 px-5">
            <div className={cn(
              'transition-opacity duration-200 motion-reduce:transition-none',
              aiEnabled ? 'opacity-100' : 'opacity-0',
            )}>
              {settings === null && !touched && (
                <p className="text-[13px] text-[var(--text-secondary)] mt-3">
                  Connect an AI provider to unlock photo analysis, item extraction from text and voice, and natural language commands for managing your bins.
                </p>
              )}

              {settings?.source === 'env' && (
                <div className="mt-3 px-3 py-2 rounded-[var(--radius-sm)] bg-[var(--accent)]/10 border border-[var(--accent)]/20">
                  <p className="text-[13px] text-[var(--text-secondary)]">
                    AI configured by server. Save your own settings to override.
                  </p>
                </div>
              )}

              <div className="flex flex-col gap-4 mt-4">
                {/* Provider selector */}
                <OptionGroup
                  options={AI_PROVIDERS}
                  value={setup.provider}
                  onChange={setup.handleProviderChange}
                />

                {/* API Key */}
                <div className="space-y-1.5">
                  <label htmlFor="ai-api-key" className="text-[13px] text-[var(--text-secondary)]">API Key</label>
                  <div className="relative">
                    <Input
                      id="ai-api-key"
                      type={setup.showKey ? 'text' : 'password'}
                      value={setup.apiKey}
                      onChange={(e) => { setup.setApiKey(e.target.value); setup.setTestResult(null); setTouched(true); }}
                      placeholder={KEY_PLACEHOLDERS[setup.provider]}
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setup.setShowKey(!setup.showKey)}
                      aria-label={setup.showKey ? 'Hide API key' : 'Show API key'}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors"
                    >
                      {setup.showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {/* Model */}
                <div className="space-y-1.5">
                  <label htmlFor="ai-model" className="text-[13px] text-[var(--text-secondary)]">Model</label>
                  <Input
                    id="ai-model"
                    value={setup.model}
                    onChange={(e) => { setup.setModel(e.target.value); setup.setTestResult(null); setTouched(true); }}
                    placeholder={MODEL_HINTS[setup.provider]}
                  />
                </div>

                {/* Endpoint URL — only for openai-compatible */}
                {setup.provider === 'openai-compatible' && (
                  <div className="space-y-1.5">
                    <label htmlFor="ai-endpoint" className="text-[13px] text-[var(--text-secondary)]">Endpoint URL</label>
                    <Input
                      id="ai-endpoint"
                      value={setup.endpointUrl}
                      onChange={(e) => { setup.setEndpointUrl(e.target.value); setup.setTestResult(null); }}
                      placeholder="http://localhost:11434/v1"
                    />
                  </div>
                )}

                {/* Required fields hint */}
                {touched && !setup.apiKey && !setup.model && (
                  <p className="text-[12px] text-[var(--text-tertiary)]" role="alert">
                    API key and model are required.
                  </p>
                )}

                {/* Task Routing */}
                {settings && (
                  <TaskRoutingSection
                    settings={settings}
                    overrides={taskOverrides}
                    onChange={(group, override) => {
                      setTaskOverrides((prev) => {
                        if (!override) {
                          const { [group]: _, ...rest } = prev;
                          return rest;
                        }
                        return { ...prev, [group]: override };
                      });
                    }}
                    disabled={demoMode}
                  />
                )}

                {/* Custom Prompts */}
                {(() => {
                  const promptMap: Record<PromptTab, { value: string; key: keyof FormState }> = {
                    analysis:  { value: form.customPrompt,         key: 'customPrompt' },
                    command:   { value: form.commandPrompt,        key: 'commandPrompt' },
                    query:     { value: form.queryPrompt,          key: 'queryPrompt' },
                    structure: { value: form.structurePrompt,      key: 'structurePrompt' },
                    reorganization: { value: form.reorganizationPrompt, key: 'reorganizationPrompt' },
                    tagSuggestion: { value: form.tagSuggestionPrompt, key: 'tagSuggestionPrompt' },
                  };
                  const active = promptMap[activePromptTab];
                  const setActive = (value: string) => updateField(active.key, value);
                  return (
                    <Disclosure label="Custom Prompts">
                      <div className="space-y-2">
                        <OptionGroup
                          options={PROMPT_TAB_META.map((tab) => ({ key: tab.key, label: tab.label, shortLabel: tab.shortLabel }))}
                          value={activePromptTab}
                          onChange={setActivePromptTab}
                          size="sm"
                          renderContent={(opt, active) => (
                            <span className="relative text-center w-full">
                              <span className="sm:hidden">{opt.shortLabel}</span>
                              <span className="hidden sm:inline">{opt.label}</span>
                              {promptMap[opt.key as PromptTab].value.trim() && (
                                <span className={cn('absolute top-1/2 -translate-y-1/2 -right-0.5 h-1.5 w-1.5 rounded-full',
                                  active ? 'bg-[var(--text-primary)]' : 'bg-[var(--accent)]'
                                )} />
                              )}
                            </span>
                          )}
                        />
                        {demoMode && (
                          <p className="text-[12px] text-[var(--text-tertiary)] italic">Custom prompts are disabled for demo accounts.</p>
                        )}
                        <Textarea
                          value={active.value}
                          onChange={(e) => setActive(e.target.value)}
                          placeholder={defaultPrompts?.[activePromptTab] ?? ''}
                          className="font-mono text-[13px] min-h-[200px] resize-y"
                          maxLength={10000}
                          disabled={demoMode}
                        />
                        <div className="row-spread">
                          <p className="text-[12px] text-[var(--text-tertiary)]">{PROMPT_HELP_TEXT[activePromptTab]}</p>
                          {!demoMode && (active.value.trim() ? (
                            <button
                              type="button"
                              onClick={() => setActive('')}
                              className="flex items-center gap-1 text-[12px] text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors shrink-0 ml-2"
                            >
                              <RotateCcw className="h-3 w-3" />
                              Reset to Default
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setActive(defaultPrompts?.[activePromptTab] ?? '')}
                              className="text-[12px] text-[var(--accent)] hover:underline shrink-0 ml-2"
                            >
                              Load default to customize
                            </button>
                          ))}
                        </div>
                      </div>
                    </Disclosure>
                  );
                })()}

                {/* Advanced AI Parameters */}
                <Disclosure
                  label="Advanced"
                  indicator={!!(form.temperature || form.maxTokens || form.topP || form.requestTimeout)}
                >
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label htmlFor="ai-temperature" className="text-[13px] text-[var(--text-secondary)]">Temperature</label>
                      <div className="relative">
                        <Input
                          id="ai-temperature"
                          type="number"
                          inputMode="decimal"
                          min={0}
                          max={2}
                          step={0.1}
                          value={form.temperature}
                          onChange={(e) => updateField('temperature', e.target.value)}
                          placeholder="Default"
                        />
                        {form.temperature && (
                          <button type="button" onClick={() => updateField('temperature', '')} className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]">
                            <RotateCcw className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                      <p className="text-[11px] text-[var(--text-tertiary)]">0.0–2.0</p>
                    </div>
                    <div className="space-y-1.5">
                      <label htmlFor="ai-max-tokens" className="text-[13px] text-[var(--text-secondary)]">Max Tokens</label>
                      <div className="relative">
                        <Input
                          id="ai-max-tokens"
                          type="number"
                          inputMode="numeric"
                          min={100}
                          max={16000}
                          step={100}
                          value={form.maxTokens}
                          onChange={(e) => updateField('maxTokens', e.target.value)}
                          placeholder="Default"
                        />
                        {form.maxTokens && (
                          <button type="button" onClick={() => updateField('maxTokens', '')} className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]">
                            <RotateCcw className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                      <p className="text-[11px] text-[var(--text-tertiary)]">100–16,000</p>
                    </div>
                    <div className="space-y-1.5">
                      <label htmlFor="ai-top-p" className="text-[13px] text-[var(--text-secondary)]">Top P</label>
                      <div className="relative">
                        <Input
                          id="ai-top-p"
                          type="number"
                          inputMode="decimal"
                          min={0}
                          max={1}
                          step={0.05}
                          value={form.topP}
                          onChange={(e) => updateField('topP', e.target.value)}
                          placeholder="Default"
                        />
                        {form.topP && (
                          <button type="button" onClick={() => updateField('topP', '')} className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]">
                            <RotateCcw className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                      <p className="text-[11px] text-[var(--text-tertiary)]">0.0–1.0</p>
                    </div>
                    <div className="space-y-1.5">
                      <label htmlFor="ai-timeout" className="text-[13px] text-[var(--text-secondary)]">Request Timeout</label>
                      <div className="relative">
                        <Input
                          id="ai-timeout"
                          type="number"
                          inputMode="numeric"
                          min={10}
                          max={300}
                          step={5}
                          value={form.requestTimeout}
                          onChange={(e) => updateField('requestTimeout', e.target.value)}
                          placeholder="Default (30)"
                        />
                        {form.requestTimeout && (
                          <button type="button" onClick={() => updateField('requestTimeout', '')} className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]">
                            <RotateCcw className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                      <p className="text-[11px] text-[var(--text-tertiary)]">10–300 seconds</p>
                    </div>
                  </div>
                </Disclosure>

                {/* Test result */}
                {setup.testResult === 'success' && (
                  <p className="text-[13px] text-[var(--color-success)]" aria-live="polite">Connected to {setup.model} successfully</p>
                )}
                {setup.testResult === 'error' && (
                  <p className="text-[13px] text-[var(--destructive)]" role="alert">{testError}</p>
                )}

                {/* Buttons */}
                <div className="flex flex-col gap-3">
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      onClick={handleTest}
                      disabled={setup.testing || !setup.apiKey || !setup.model}
                    >
                      {setup.testing ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : null}
                      Test Connection
                    </Button>
                    <Button
                      onClick={handleSave}
                      disabled={setup.saving || !setup.apiKey || !setup.model}
                    >
                      {setup.saving ? 'Saving...' : 'Save'}
                    </Button>
                  </div>
                  {settings && settings.source !== 'env' && (
                    <div className="pt-1 border-t border-[var(--border-flat)]">
                      <Button
                        variant="destructive-ghost"
                        onClick={handleRemove}
                      >
                        Remove AI Settings
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
        )}
        </Disclosure>
      </CardContent>
    </Card>
  );
}
