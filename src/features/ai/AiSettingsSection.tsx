import { useState, useEffect } from 'react';
import { Eye, EyeOff, Loader2, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/toast';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { Disclosure } from '@/components/ui/disclosure';
import { useAiSettings, saveAiSettings, deleteAiSettings, testAiConnection } from './useAiSettings';
import { useAiProviderSetup } from './useAiProviderSetup';
import { AI_PROVIDERS, MODEL_HINTS, KEY_PLACEHOLDERS } from './aiConstants';
import { useDefaultPrompts } from './useDefaultPrompts';

type PromptTab = 'analysis' | 'command' | 'query' | 'structure';

const PROMPT_TAB_META = [
  { key: 'analysis', label: 'Photo Analysis', shortLabel: 'Photos' },
  { key: 'command', label: 'Commands', shortLabel: 'Cmds' },
  { key: 'query', label: 'Queries', shortLabel: 'Queries' },
  { key: 'structure', label: 'Extraction', shortLabel: 'Extract' },
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
  const [activePromptTab, setActivePromptTab] = useState<PromptTab>('analysis');
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
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings]);

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
      });
      setSettings(saved);
      showToast({ message: 'AI settings saved' });
    } catch (err) {
      showToast({ message: err instanceof Error ? err.message : 'Failed to save' });
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
      setup.setTestResult(null);
      showToast({ message: 'AI settings removed' });
    } catch {
      showToast({ message: 'Failed to remove settings' });
    }
  }

  if (isLoading) return null;

  return (
    <Card id="ai-settings">
      <CardContent>
        <div className="flex items-center justify-between">
          <div className="flex-1 min-w-0">
            <Label htmlFor="ai-toggle">AI Features</Label>
            <p className="text-[13px] text-[var(--text-tertiary)] mt-1">
              Photo analysis, item extraction, and AI commands
            </p>
          </div>
          <Switch id="ai-toggle" checked={aiEnabled} onCheckedChange={onToggle} />
        </div>

        {aiEnabled && settings === null && !touched && (
          <p className="text-[13px] text-[var(--text-secondary)] mt-3">
            Connect an AI provider to unlock photo analysis, item extraction from text and voice, and natural language commands for managing your bins.
          </p>
        )}

        {aiEnabled && settings?.source === 'env' && (
          <div className="mt-3 px-3 py-2 rounded-[var(--radius-sm)] bg-[var(--accent)]/10 border border-[var(--accent)]/20">
            <p className="text-[13px] text-[var(--text-secondary)]">
              AI configured by server. Save your own settings to override.
            </p>
          </div>
        )}

        {aiEnabled && <div className="flex flex-col gap-4 mt-4">
          {/* Provider selector */}
          <div className="flex gap-1.5 bg-[var(--bg-input)] rounded-[var(--radius-full)] p-1">
            {AI_PROVIDERS.map((opt) => (
              <button
                key={opt.key}
                type="button"
                onClick={() => setup.handleProviderChange(opt.key)}
                className={`flex-1 text-[13px] font-medium py-1.5 px-3 rounded-[var(--radius-full)] transition-colors ${
                  setup.provider === opt.key
                    ? 'bg-[var(--accent)] text-[var(--text-on-accent)]'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

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
            };
            const helpText: Record<PromptTab, React.ReactNode> = {
              analysis: <>Use <code className="text-[11px] px-1 py-0.5 rounded bg-[var(--bg-input)]">{'{available_tags}'}</code> to inject existing tags. Leave empty for default.</>,
              command: 'Customize how commands are parsed. Leave empty for default.',
              query: 'Customize how inventory queries are answered. Leave empty for default.',
              structure: 'Customize how text is parsed into item lists. Leave empty for default.',
            };
            const active = promptMap[activePromptTab];
            return (
              <Disclosure label="Custom Prompts">
                <div className="space-y-2">
                  <div className="flex gap-1 bg-[var(--bg-input)] rounded-[var(--radius-full)] p-1">
                    {PROMPT_TAB_META.map((tab) => (
                      <button
                        key={tab.key}
                        type="button"
                        onClick={() => setActivePromptTab(tab.key)}
                        className={cn(
                          'relative flex-1 text-[12px] font-medium py-1.5 px-2 rounded-[var(--radius-full)] transition-colors text-center',
                          activePromptTab === tab.key
                            ? 'bg-[var(--accent)] text-[var(--text-on-accent)]'
                            : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                        )}
                      >
                        <span className="sm:hidden">{tab.shortLabel}</span>
                        <span className="hidden sm:inline">{tab.label}</span>
                        {promptMap[tab.key].value.trim() && (
                          <span className={cn('absolute top-1/2 -translate-y-1/2 right-1 h-1.5 w-1.5 rounded-full',
                            activePromptTab === tab.key ? 'bg-[var(--text-on-accent)]' : 'bg-[var(--accent)]'
                          )} />
                        )}
                      </button>
                    ))}
                  </div>
                  <Textarea
                    value={active.value}
                    onChange={(e) => active.set(e.target.value)}
                    placeholder={defaultPrompts?.[activePromptTab] ?? ''}
                    className="font-mono text-[13px] min-h-[200px] resize-y"
                    maxLength={10000}
                  />
                  <div className="flex items-center justify-between">
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

          {/* Test result */}
          {setup.testResult === 'success' && (
            <p className="text-[13px] text-green-600 dark:text-green-400">Connected to {setup.model} successfully</p>
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
              className="rounded-[var(--radius-full)]"
            >
              {setup.testing ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : null}
              Test Connection
            </Button>
            <Button
              onClick={handleSave}
              disabled={setup.saving || !setup.apiKey || !setup.model}
              className="rounded-[var(--radius-full)]"
            >
              {setup.saving ? 'Saving...' : 'Save'}
            </Button>
            {settings && settings.source !== 'env' && (
              <Button
                variant="ghost"
                onClick={handleRemove}
                className="rounded-[var(--radius-full)] text-[var(--destructive)]"
              >
                Remove AI Settings
              </Button>
            )}
          </div>
        </div>}
      </CardContent>
    </Card>
  );
}
