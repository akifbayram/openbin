import { useState } from 'react';
import { useToast } from '@/components/ui/toast';
import { saveAiSettings, testAiConnection } from './useAiSettings';
import { DEFAULT_MODELS } from './aiConstants';
import type { AiProvider, AiSettings } from '@/types';

export interface AiProviderSetup {
  provider: AiProvider;
  setProvider: (p: AiProvider) => void;
  apiKey: string;
  setApiKey: (k: string) => void;
  model: string;
  setModel: (m: string) => void;
  endpointUrl: string;
  setEndpointUrl: (u: string) => void;
  showKey: boolean;
  setShowKey: (v: boolean) => void;
  testing: boolean;
  saving: boolean;
  configured: boolean;
  testResult: 'success' | 'error' | null;
  setTestResult: (r: 'success' | 'error' | null) => void;
  handleProviderChange: (p: AiProvider) => void;
  handleTest: () => Promise<void>;
  handleSave: () => Promise<void>;
  isReady: boolean;
}

interface UseAiProviderSetupOptions {
  onSaveSuccess?: () => void;
  providerConfigs?: AiSettings['providerConfigs'];
}

export function useAiProviderSetup(opts?: UseAiProviderSetupOptions): AiProviderSetup {
  const { showToast } = useToast();

  const [provider, setProvider] = useState<AiProvider>('openai');
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState(DEFAULT_MODELS.openai);
  const [endpointUrl, setEndpointUrl] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [configured, setConfigured] = useState(false);
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null);

  function handleProviderChange(p: AiProvider) {
    setProvider(p);
    const saved = opts?.providerConfigs?.[p];
    if (saved) {
      setApiKey(saved.apiKey);
      setModel(saved.model);
      setEndpointUrl(saved.endpointUrl || '');
    } else {
      setApiKey('');
      setModel(DEFAULT_MODELS[p]);
      setEndpointUrl('');
    }
    setTestResult(null);
  }

  async function handleTest() {
    if (!apiKey || !model) return;
    setTesting(true);
    setTestResult(null);
    try {
      await testAiConnection({
        provider,
        apiKey,
        model,
        endpointUrl: provider === 'openai-compatible' ? endpointUrl : undefined,
      });
      setTestResult('success');
    } catch {
      setTestResult('error');
    } finally {
      setTesting(false);
    }
  }

  async function handleSave() {
    if (!apiKey || !model) return;
    setSaving(true);
    try {
      await saveAiSettings({
        provider,
        apiKey,
        model,
        endpointUrl: provider === 'openai-compatible' ? endpointUrl : undefined,
      });
      setConfigured(true);
      showToast({ message: 'AI settings saved' });
      opts?.onSaveSuccess?.();
    } catch (err) {
      showToast({ message: err instanceof Error ? err.message : 'Failed to save AI settings' });
    } finally {
      setSaving(false);
    }
  }

  return {
    provider,
    setProvider,
    apiKey,
    setApiKey,
    model,
    setModel,
    endpointUrl,
    setEndpointUrl,
    showKey,
    setShowKey,
    testing,
    saving,
    configured,
    testResult,
    setTestResult,
    handleProviderChange,
    handleTest,
    handleSave,
    isReady: configured,
  };
}
