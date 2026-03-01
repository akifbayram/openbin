import type { AiProvider } from '@/types';

export const AI_PROVIDERS: { key: AiProvider; label: string }[] = [
  { key: 'openai', label: 'OpenAI' },
  { key: 'anthropic', label: 'Anthropic' },
  { key: 'gemini', label: 'Gemini' },
  { key: 'openai-compatible', label: 'Self-Hosted' },
];

export const DEFAULT_MODELS: Record<AiProvider, string> = {
  openai: 'gpt-5-mini',
  anthropic: 'claude-sonnet-4-6',
  gemini: 'gemini-3-flash-preview',
  'openai-compatible': '',
};

export const MODEL_HINTS: Record<AiProvider, string> = {
  openai: 'e.g., gpt-5-mini, gpt-5',
  anthropic: 'e.g., claude-sonnet-4-6, claude-haiku-4-5-20251001',
  gemini: 'e.g., gemini-3-flash-preview, gemini-2.5-pro',
  'openai-compatible': 'e.g., llava, llama3.2-vision',
};

export const KEY_PLACEHOLDERS: Record<AiProvider, string> = {
  openai: 'sk-...',
  anthropic: 'sk-ant-...',
  gemini: 'AIza...',
  'openai-compatible': 'API key (if required)',
};
