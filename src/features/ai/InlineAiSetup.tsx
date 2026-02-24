import { Sparkles, ChevronRight, Eye, EyeOff, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AI_PROVIDERS } from './aiConstants';
import type { AiProviderSetup } from './useAiProviderSetup';
import { OptionGroup } from '@/components/ui/option-group';

interface InlineAiSetupProps {
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
  setup: AiProviderSetup;
  label?: string;
}

export function InlineAiSetup({ expanded, onExpandedChange, setup, label = 'Set up AI provider to get started' }: InlineAiSetupProps) {
  return (
    <div className="text-left">
      <button
        type="button"
        onClick={() => onExpandedChange(!expanded)}
        className="flex items-center gap-1.5 text-[13px] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors"
      >
        <ChevronRight className={cn('h-3.5 w-3.5 transition-transform', expanded && 'rotate-90')} />
        <Sparkles className="h-3.5 w-3.5" />
        {label}
      </button>
      {expanded && (
        <div className="mt-2 space-y-2.5 rounded-[var(--radius-md)] bg-[var(--bg-input)] p-3">
          {/* Provider pills */}
          <OptionGroup
            options={AI_PROVIDERS}
            value={setup.provider}
            onChange={setup.handleProviderChange}
            shape="pill"
            size="sm"
          />
          {/* API key */}
          <div className="relative">
            <input
              type={setup.showKey ? 'text' : 'password'}
              value={setup.apiKey}
              onChange={(e) => { setup.setApiKey(e.target.value); setup.setTestResult(null); }}
              placeholder="API key"
              className="w-full h-8 rounded-[var(--radius-sm)] bg-[var(--bg-elevated)] border border-[var(--border-primary)] px-2.5 pr-8 text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] outline-none focus:ring-1 focus:ring-[var(--accent)]"
            />
            <button
              type="button"
              onClick={() => setup.setShowKey(!setup.showKey)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
            >
              {setup.showKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            </button>
          </div>
          {/* Model */}
          <input
            type="text"
            value={setup.model}
            onChange={(e) => { setup.setModel(e.target.value); setup.setTestResult(null); }}
            placeholder="Model name"
            className="w-full h-8 rounded-[var(--radius-sm)] bg-[var(--bg-elevated)] border border-[var(--border-primary)] px-2.5 text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] outline-none focus:ring-1 focus:ring-[var(--accent)]"
          />
          {/* Endpoint URL (openai-compatible only) */}
          {setup.provider === 'openai-compatible' && (
            <input
              type="text"
              value={setup.endpointUrl}
              onChange={(e) => setup.setEndpointUrl(e.target.value)}
              placeholder="Endpoint URL"
              className="w-full h-8 rounded-[var(--radius-sm)] bg-[var(--bg-elevated)] border border-[var(--border-primary)] px-2.5 text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] outline-none focus:ring-1 focus:ring-[var(--accent)]"
            />
          )}
          {/* Test result */}
          {setup.testResult && (
            <p className={cn('text-[12px]', setup.testResult === 'success' ? 'text-green-500' : 'text-red-500')}>
              {setup.testResult === 'success' ? 'Connection successful' : 'Connection failed — check settings'}
            </p>
          )}
          {/* Test + Save buttons */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={setup.handleTest}
              disabled={!setup.apiKey || !setup.model || setup.testing}
              className="flex-1 h-7 rounded-[var(--radius-sm)] bg-[var(--bg-active)] text-[12px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-40 transition-colors"
            >
              {setup.testing ? 'Testing...' : 'Test'}
            </button>
            <button
              type="button"
              onClick={setup.handleSave}
              disabled={!setup.apiKey || !setup.model || setup.saving}
              className="flex-1 h-7 rounded-[var(--radius-sm)] bg-[var(--accent)] text-[12px] text-white disabled:opacity-40 transition-colors"
            >
              {setup.saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function AiConfiguredIndicator({ children }: { children?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1.5 text-[12px] text-[var(--accent)]">
      <Check className="h-3.5 w-3.5" />
      <span>AI configured</span>
      {children}
    </div>
  );
}

export function AiSetupView({ onNavigate }: { onNavigate: () => void }) {
  return (
    <div className="flex flex-col items-center py-8 px-2">
      <Sparkles className="h-6 w-6 text-[var(--ai-accent)] mb-3" />
      <p className="text-[15px] font-semibold text-[var(--text-primary)] text-center mb-1">
        Set up an AI provider to start using Ask AI
      </p>
      <p className="text-[13px] text-[var(--text-tertiary)] text-center mb-5">
        Your key is encrypted and stored securely
      </p>
      <button
        type="button"
        onClick={onNavigate}
        className="h-9 px-5 rounded-full bg-[var(--ai-accent)] text-[13px] text-white hover:bg-[var(--ai-accent-hover)] transition-colors"
      >
        Go to Settings
      </button>
    </div>
  );
}
