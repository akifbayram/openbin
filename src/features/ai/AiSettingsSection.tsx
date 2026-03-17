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
import { cn } from '@/lib/utils';
import { AI_PROVIDERS, KEY_PLACEHOLDERS, MODEL_HINTS } from './aiConstants';
import { useAiProviderSetup } from './useAiProviderSetup';
import { deleteAiSettings, saveAiSettings, testAiConnection, useAiSettings } from './useAiSettings';
import { useDefaultPrompts } from './useDefaultPrompts';

type PromptTab = 'analysis' | 'command' | 'query' | 'structure' | 'reorganization';

const PROMPT_TAB_META = [
  { key: 'analysis', label: 'Photo Analysis', shortLabel: 'Photos' },
  { key: 'command', label: 'Commands', shortLabel: 'Cmds' },
  { key: 'query', label: 'Queries', shortLabel: 'Queries' },
  { key: 'structure', label: 'Extraction', shortLabel: 'Extract' },
  { key: 'reorganization', label: 'Reorganize', shortLabel: 'Reorg' },
] as const;

interface AiSettingsSectionProps {
  aiEnabled: boolean;
  onToggle: (enabled: boolean) => void;
}

export function AiSettingsSection({ aiEnabled, onToggle }: AiSettingsSectionProps) {
  const { settings, isLoading, setSettings } = useAiSettings();
  const { prompts: defaultPrompts } = useDefaultPrompts();
  const { showToast } = useToast();

  const setup = useAiProviderSetup({ providerConfigs: settings?.providerConfigs });

  const [customPrompt, setCustomPrompt] = useState('');
  const [commandPrompt, setCommandPrompt] = useState('');
  const [queryPrompt, setQueryPrompt] = useState('');
  const [structurePrompt, setStructurePrompt] = useState('');
  const [reorganizationPrompt, setReorganizationPrompt] = useState('');
  const [activePromptTab, setActivePromptTab] = useState<PromptTab>('analysis');
  const [temperature, setTemperature] = useState<string>('');
  const [maxTokens, setMaxTokens] = useState<string>('');
  const [topP, setTopP] = useState<string>('');
  const [requestTimeout, setRequestTimeout] = useState<string>('');
  const [testError, setTestError] = useState('');
  const [touched, setTouched] = useState(false);

  // Populate form from loaded settings
  useEffect(() => {
    if (settings) {
      setup.setProvider(settings.provider);
      setup.setApiKey(settings.apiKey);
      setup.setModel(settings.model);
      setup.setEndpointUrl(settings.endpointUrl || '');
      setCustomPrompt(settings.customPrompt || '');
      setCommandPrompt(settings.commandPrompt || '');
      setQueryPrompt(settings.queryPrompt || '');
      setStructurePrompt(settings.structurePrompt || '');
      setReorganizationPrompt(settings.reorganizationPrompt || '');
      setTemperature(settings.temperature != null ? String(settings.temperature) : '');
      setMaxTokens(settings.maxTokens != null ? String(settings.maxTokens) : '');
      setTopP(settings.topP != null ? String(settings.topP) : '');
      setRequestTimeout(settings.requestTimeout != null ? String(settings.requestTimeout) : '');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings, setup.setApiKey, setup.setEndpointUrl, setup.setModel, setup.setProvider]);

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
      const base = err instanceof Error ? err.message : 'Connection failed';
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
        customPrompt: customPrompt.trim() || null,
        commandPrompt: commandPrompt.trim() || null,
        queryPrompt: queryPrompt.trim() || null,
        structurePrompt: structurePrompt.trim() || null,
        reorganizationPrompt: reorganizationPrompt.trim() || null,
        temperature: temperature ? Number(temperature) : null,
        maxTokens: maxTokens ? Number(maxTokens) : null,
        topP: topP ? Number(topP) : null,
        requestTimeout: requestTimeout ? Number(requestTimeout) : null,
      });
      setSettings(saved);
      showToast({ message: 'AI settings saved', variant: 'success' });
    } catch (err) {
      showToast({ message: err instanceof Error ? err.message : 'Failed to save', variant: 'error' });
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
      setCustomPrompt('');
      setCommandPrompt('');
      setQueryPrompt('');
      setStructurePrompt('');
      setReorganizationPrompt('');
      setTemperature('');
      setMaxTokens('');
      setTopP('');
      setRequestTimeout('');
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
        <Disclosure defaultOpen={window.location.hash === '#ai-settings'} label={<span className="inline-flex items-center gap-1.5 text-[var(--text-primary)]"><Sparkles className="h-3.5 w-3.5" />AI Features</span>} labelClassName="text-[15px] font-semibold">
        <div className="row-spread mt-1">
          <p className="text-[13px] text-[var(--text-tertiary)]">
            Photo analysis, item extraction, and AI commands
          </p>
          <Switch id="ai-toggle" checked={aiEnabled} onCheckedChange={onToggle} />
        </div>

        {/* Animated expand/collapse wrapper */}
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
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
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
                  <p className="text-[12px] text-[var(--text-tertiary)]">
                    API key and model are required.
                  </p>
                )}

                {/* Custom Prompts */}
                {(() => {
                  const promptMap = {
                    analysis:  { value: customPrompt,    set: setCustomPrompt },
                    command:   { value: commandPrompt,   set: setCommandPrompt },
                    query:     { value: queryPrompt,     set: setQueryPrompt },
                    structure: { value: structurePrompt, set: setStructurePrompt },
                    reorganization: { value: reorganizationPrompt, set: setReorganizationPrompt },
                  };
                  const V = ({ children }: { children: string }) => (
                    <code className="text-[11px] px-1 py-0.5 rounded bg-[var(--bg-input)]">{children}</code>
                  );
                  const helpText: Record<PromptTab, React.ReactNode> = {
                    analysis: <>Available variables: <V>{'{available_tags}'}</V>. Custom fields are appended automatically.</>,
                    command: <>Inventory context (bins, items, areas, tags, colors, icons) is passed automatically. This prompt defines the instructions only.</>,
                    query: <>Inventory context (bins, items, areas, tags) is passed automatically. This prompt defines the instructions only.</>,
                    structure: <>Bin name and existing items are appended automatically. This prompt defines the extraction rules.</>,
                    reorganization: <>Available variables: <V>{'{available_tags}'}</V> <V>{'{max_bins_instruction}'}</V> <V>{'{area_instruction}'}</V> <V>{'{strictness_instruction}'}</V> <V>{'{granularity_instruction}'}</V> <V>{'{duplicates_instruction}'}</V> <V>{'{ambiguous_instruction}'}</V> <V>{'{outliers_instruction}'}</V> <V>{'{items_per_bin_instruction}'}</V> <V>{'{notes_instruction}'}</V></>,
                  };
                  const active = promptMap[activePromptTab];
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
                        <Textarea
                          value={active.value}
                          onChange={(e) => active.set(e.target.value)}
                          placeholder={defaultPrompts?.[activePromptTab] ?? ''}
                          className="font-mono text-[13px] min-h-[200px] resize-y"
                          maxLength={10000}
                        />
                        <div className="row-spread">
                          <p className="text-[12px] text-[var(--text-tertiary)]">{helpText[activePromptTab]}</p>
                          {active.value.trim() ? (
                            <button
                              type="button"
                              onClick={() => active.set('')}
                              className="flex items-center gap-1 text-[12px] text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors shrink-0 ml-2"
                            >
                              <RotateCcw className="h-3 w-3" />
                              Reset to Default
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => active.set(defaultPrompts?.[activePromptTab] ?? '')}
                              className="text-[12px] text-[var(--accent)] hover:underline shrink-0 ml-2"
                            >
                              Load default to customize
                            </button>
                          )}
                        </div>
                      </div>
                    </Disclosure>
                  );
                })()}

                {/* Advanced AI Parameters */}
                <Disclosure
                  label="Advanced"
                  indicator={!!(temperature || maxTokens || topP || requestTimeout)}
                >
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label htmlFor="ai-temperature" className="text-[13px] text-[var(--text-secondary)]">Temperature</label>
                      <div className="relative">
                        <Input
                          id="ai-temperature"
                          type="number"
                          min={0}
                          max={2}
                          step={0.1}
                          value={temperature}
                          onChange={(e) => setTemperature(e.target.value)}
                          placeholder="Default"
                        />
                        {temperature && (
                          <button type="button" onClick={() => setTemperature('')} className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]">
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
                          min={100}
                          max={16000}
                          step={100}
                          value={maxTokens}
                          onChange={(e) => setMaxTokens(e.target.value)}
                          placeholder="Default"
                        />
                        {maxTokens && (
                          <button type="button" onClick={() => setMaxTokens('')} className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]">
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
                          min={0}
                          max={1}
                          step={0.05}
                          value={topP}
                          onChange={(e) => setTopP(e.target.value)}
                          placeholder="Default"
                        />
                        {topP && (
                          <button type="button" onClick={() => setTopP('')} className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]">
                            <RotateCcw className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                      <p className="text-[11px] text-[var(--text-tertiary)]">0.0–1.0</p>
                    </div>
                    <div className="space-y-1.5">
                      <label htmlFor="ai-timeout" className="text-[13px] text-[var(--text-secondary)]">Timeout (s)</label>
                      <div className="relative">
                        <Input
                          id="ai-timeout"
                          type="number"
                          min={10}
                          max={300}
                          step={5}
                          value={requestTimeout}
                          onChange={(e) => setRequestTimeout(e.target.value)}
                          placeholder="Default (30)"
                        />
                        {requestTimeout && (
                          <button type="button" onClick={() => setRequestTimeout('')} className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]">
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
                  <p className="text-[13px] text-[var(--color-success)]">Connected to {setup.model} successfully</p>
                )}
                {setup.testResult === 'error' && (
                  <p className="text-[13px] text-[var(--destructive)]">{testError}</p>
                )}

                {/* Buttons */}
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
                  {settings && settings.source !== 'env' && (
                    <Button
                      variant="destructive-ghost"
                      onClick={handleRemove}
                    >
                      Remove AI Settings
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
        </Disclosure>
      </CardContent>
    </Card>
  );
}
