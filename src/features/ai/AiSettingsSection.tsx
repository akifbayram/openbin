import { useState, useEffect } from 'react';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/toast';
import { useAiSettings, saveAiSettings, deleteAiSettings, testAiConnection } from './useAiSettings';
import type { AiProvider } from '@/types';

const PROVIDER_OPTIONS: { value: AiProvider; label: string }[] = [
  { value: 'openai', label: 'OpenAI' },
  { value: 'anthropic', label: 'Anthropic' },
  { value: 'openai-compatible', label: 'Local LLM' },
];

const DEFAULT_MODELS: Record<AiProvider, string> = {
  openai: 'gpt-4o',
  anthropic: 'claude-sonnet-4-5-20250929',
  'openai-compatible': '',
};

const MODEL_HINTS: Record<AiProvider, string> = {
  openai: 'e.g., gpt-4o, gpt-4o-mini',
  anthropic: 'e.g., claude-sonnet-4-5-20250929, claude-haiku-4-5-20251001',
  'openai-compatible': 'e.g., llava, llama3.2-vision',
};

const KEY_PLACEHOLDERS: Record<AiProvider, string> = {
  openai: 'sk-...',
  anthropic: 'sk-ant-...',
  'openai-compatible': 'API key (if required)',
};

export function AiSettingsSection() {
  const { settings, isLoading, setSettings } = useAiSettings();
  const { showToast } = useToast();

  const [provider, setProvider] = useState<AiProvider>('openai');
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('');
  const [endpointUrl, setEndpointUrl] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null);
  const [testError, setTestError] = useState('');

  // Populate form from loaded settings
  useEffect(() => {
    if (settings) {
      setProvider(settings.provider);
      setApiKey(settings.apiKey);
      setModel(settings.model);
      setEndpointUrl(settings.endpointUrl || '');
    }
  }, [settings]);

  function handleProviderChange(p: AiProvider) {
    setProvider(p);
    // Pre-fill model if switching providers and field is empty or was a default
    const currentDefault = DEFAULT_MODELS[provider];
    if (!model || model === currentDefault) {
      setModel(DEFAULT_MODELS[p]);
    }
    setTestResult(null);
  }

  async function handleTest() {
    setTesting(true);
    setTestResult(null);
    setTestError('');
    try {
      await testAiConnection({
        provider,
        apiKey,
        model,
        endpointUrl: endpointUrl || undefined,
      });
      setTestResult('success');
    } catch (err) {
      setTestResult('error');
      setTestError(err instanceof Error ? err.message : 'Connection failed');
    } finally {
      setTesting(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      const saved = await saveAiSettings({
        provider,
        apiKey,
        model,
        endpointUrl: endpointUrl || undefined,
      });
      setSettings(saved);
      showToast({ message: 'AI settings saved' });
    } catch (err) {
      showToast({ message: err instanceof Error ? err.message : 'Failed to save' });
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove() {
    try {
      await deleteAiSettings();
      setSettings(null);
      setProvider('openai');
      setApiKey('');
      setModel('');
      setEndpointUrl('');
      setTestResult(null);
      showToast({ message: 'AI settings removed' });
    } catch {
      showToast({ message: 'Failed to remove settings' });
    }
  }

  if (isLoading) return null;

  return (
    <Card>
      <CardContent>
        <Label>AI Image Analysis</Label>
        <p className="text-[13px] text-[var(--text-tertiary)] mt-1">
          Analyze bin photos with AI to suggest names, items, tags, and notes.
        </p>

        <div className="flex flex-col gap-4 mt-4">
          {/* Provider selector */}
          <div className="flex gap-1.5 bg-[var(--bg-input)] rounded-[var(--radius-full)] p-1">
            {PROVIDER_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => handleProviderChange(opt.value)}
                className={`flex-1 text-[13px] font-medium py-1.5 px-3 rounded-[var(--radius-full)] transition-colors ${
                  provider === opt.value
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
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => { setApiKey(e.target.value); setTestResult(null); }}
                placeholder={KEY_PLACEHOLDERS[provider]}
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
              >
                {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* Model */}
          <div className="space-y-1.5">
            <label htmlFor="ai-model" className="text-[13px] text-[var(--text-secondary)]">Model</label>
            <Input
              id="ai-model"
              value={model}
              onChange={(e) => { setModel(e.target.value); setTestResult(null); }}
              placeholder={MODEL_HINTS[provider]}
            />
            <p className="text-[12px] text-[var(--text-tertiary)]">{MODEL_HINTS[provider]}</p>
          </div>

          {/* Endpoint URL — only for openai-compatible */}
          {provider === 'openai-compatible' && (
            <div className="space-y-1.5">
              <label htmlFor="ai-endpoint" className="text-[13px] text-[var(--text-secondary)]">Endpoint URL</label>
              <Input
                id="ai-endpoint"
                value={endpointUrl}
                onChange={(e) => { setEndpointUrl(e.target.value); setTestResult(null); }}
                placeholder="http://localhost:11434/v1"
              />
            </div>
          )}

          {/* Test result */}
          {testResult === 'success' && (
            <p className="text-[13px] text-green-600 dark:text-green-400">Connection successful</p>
          )}
          {testResult === 'error' && (
            <p className="text-[13px] text-[var(--destructive)]">{testError}</p>
          )}

          {/* Buttons */}
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={handleTest}
              disabled={testing || !apiKey || !model}
              className="rounded-[var(--radius-full)]"
            >
              {testing ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : null}
              Test Connection
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving || !apiKey || !model}
              className="rounded-[var(--radius-full)]"
            >
              {saving ? 'Saving...' : 'Save'}
            </Button>
            {settings && (
              <Button
                variant="ghost"
                onClick={handleRemove}
                className="rounded-[var(--radius-full)] text-[var(--destructive)]"
              >
                Remove
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
