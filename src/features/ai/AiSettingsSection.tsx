import { useState, useEffect } from 'react';
import { Eye, EyeOff, Loader2, ChevronRight, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/toast';
import { cn } from '@/lib/utils';
import { useAiSettings, saveAiSettings, deleteAiSettings, testAiConnection } from './useAiSettings';
import { useAiProviderSetup } from './useAiProviderSetup';
import { AI_PROVIDERS, MODEL_HINTS, KEY_PLACEHOLDERS } from './aiConstants';
import { DEFAULT_AI_PROMPT } from './defaultPrompt';
import { DEFAULT_COMMAND_PROMPT } from './defaultCommandPrompt';
import { DEFAULT_QUERY_PROMPT } from './defaultQueryPrompt';

export function AiSettingsSection() {
  const { settings, isLoading, setSettings } = useAiSettings();
  const { showToast } = useToast();

  const setup = useAiProviderSetup();

  const [customPrompt, setCustomPrompt] = useState('');
  const [commandPrompt, setCommandPrompt] = useState('');
  const [queryPrompt, setQueryPrompt] = useState('');
  const [promptExpanded, setPromptExpanded] = useState(false);
  const [commandPromptExpanded, setCommandPromptExpanded] = useState(false);
  const [queryPromptExpanded, setQueryPromptExpanded] = useState(false);
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
      if (settings.customPrompt) setPromptExpanded(true);
      if (settings.commandPrompt) setCommandPromptExpanded(true);
      if (settings.queryPrompt) setQueryPromptExpanded(true);
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
      setPromptExpanded(false);
      setCommandPromptExpanded(false);
      setQueryPromptExpanded(false);
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
        <Label>AI Settings</Label>
        <p className="text-[13px] text-[var(--text-tertiary)] mt-1">
          Analyze photos, extract items from text, and run natural language commands.
        </p>

        {settings === null && !touched && (
          <p className="text-[13px] text-[var(--text-secondary)] mt-3">
            Connect an AI provider to unlock photo analysis, item extraction from text and voice, and natural language commands for managing your bins.
          </p>
        )}

        <div className="flex flex-col gap-4 mt-4">
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
          <div className="space-y-2">
            <p className="text-[13px] text-[var(--text-secondary)] font-medium">Custom Prompts</p>

            {/* Image Analysis Prompt */}
            <div>
              <button
                type="button"
                onClick={() => setPromptExpanded(!promptExpanded)}
                className="flex items-center gap-1.5 text-[13px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
              >
                <ChevronRight className={cn('h-3.5 w-3.5 transition-transform', promptExpanded && 'rotate-90')} />
                Photo Analysis
                {customPrompt.trim() && (
                  <span className="text-[11px] font-medium px-1.5 py-0.5 rounded-[var(--radius-full)] bg-[var(--accent)] text-[var(--text-on-accent)]">
                    customized
                  </span>
                )}
              </button>
              {promptExpanded && (
                <div className="mt-2 space-y-2">
                  <Textarea
                    value={customPrompt}
                    onChange={(e) => setCustomPrompt(e.target.value)}
                    placeholder={DEFAULT_AI_PROMPT}
                    className="font-mono text-[13px] min-h-[200px] resize-y"
                    maxLength={10000}
                  />
                  <div className="flex items-center justify-between">
                    <p className="text-[12px] text-[var(--text-tertiary)]">
                      Use <code className="text-[11px] px-1 py-0.5 rounded bg-[var(--bg-input)]">{'{available_tags}'}</code> to inject existing tags at runtime. Leave empty for the default prompt.
                    </p>
                    {customPrompt.trim() && (
                      <button
                        type="button"
                        onClick={() => setCustomPrompt('')}
                        className="flex items-center gap-1 text-[12px] text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors shrink-0 ml-2"
                      >
                        <RotateCcw className="h-3 w-3" />
                        Reset to Default
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* AI Command Prompt */}
            <div>
              <button
                type="button"
                onClick={() => setCommandPromptExpanded(!commandPromptExpanded)}
                className="flex items-center gap-1.5 text-[13px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
              >
                <ChevronRight className={cn('h-3.5 w-3.5 transition-transform', commandPromptExpanded && 'rotate-90')} />
                Commands
                {commandPrompt.trim() && (
                  <span className="text-[11px] font-medium px-1.5 py-0.5 rounded-[var(--radius-full)] bg-[var(--accent)] text-[var(--text-on-accent)]">
                    customized
                  </span>
                )}
              </button>
              {commandPromptExpanded && (
                <div className="mt-2 space-y-2">
                  <Textarea
                    value={commandPrompt}
                    onChange={(e) => setCommandPrompt(e.target.value)}
                    placeholder={DEFAULT_COMMAND_PROMPT}
                    className="font-mono text-[13px] min-h-[200px] resize-y"
                    maxLength={10000}
                  />
                  <div className="flex items-center justify-between">
                    <p className="text-[12px] text-[var(--text-tertiary)]">
                      Customize how commands like &apos;add screwdriver to tools bin&apos; are parsed. Leave empty for default.
                    </p>
                    {commandPrompt.trim() && (
                      <button
                        type="button"
                        onClick={() => setCommandPrompt('')}
                        className="flex items-center gap-1 text-[12px] text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors shrink-0 ml-2"
                      >
                        <RotateCcw className="h-3 w-3" />
                        Reset to Default
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Inventory Query Prompt */}
            <div>
              <button
                type="button"
                onClick={() => setQueryPromptExpanded(!queryPromptExpanded)}
                className="flex items-center gap-1.5 text-[13px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
              >
                <ChevronRight className={cn('h-3.5 w-3.5 transition-transform', queryPromptExpanded && 'rotate-90')} />
                Inventory Queries
                {queryPrompt.trim() && (
                  <span className="text-[11px] font-medium px-1.5 py-0.5 rounded-[var(--radius-full)] bg-[var(--accent)] text-[var(--text-on-accent)]">
                    customized
                  </span>
                )}
              </button>
              {queryPromptExpanded && (
                <div className="mt-2 space-y-2">
                  <Textarea
                    value={queryPrompt}
                    onChange={(e) => setQueryPrompt(e.target.value)}
                    placeholder={DEFAULT_QUERY_PROMPT}
                    className="font-mono text-[13px] min-h-[200px] resize-y"
                    maxLength={10000}
                  />
                  <div className="flex items-center justify-between">
                    <p className="text-[12px] text-[var(--text-tertiary)]">
                      Customize how inventory queries like &apos;where are my batteries?&apos; are answered. Leave empty for default.
                    </p>
                    {queryPrompt.trim() && (
                      <button
                        type="button"
                        onClick={() => setQueryPrompt('')}
                        className="flex items-center gap-1 text-[12px] text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors shrink-0 ml-2"
                      >
                        <RotateCcw className="h-3 w-3" />
                        Reset to Default
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

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
            {settings && (
              <Button
                variant="ghost"
                onClick={handleRemove}
                className="rounded-[var(--radius-full)] text-[var(--destructive)]"
              >
                Remove AI Settings
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
