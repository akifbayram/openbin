import type { AiProvider } from '@/types';

export const AI_PROVIDERS: { key: AiProvider; label: string }[] = [
  { key: 'openai', label: 'OpenAI' },
  { key: 'anthropic', label: 'Anthropic' },
  { key: 'openai-compatible', label: 'Self-Hosted' },
];

export const DEFAULT_MODELS: Record<AiProvider, string> = {
  openai: 'gpt-4o',
  anthropic: 'claude-sonnet-4-5-20250929',
  'openai-compatible': '',
};

export const MODEL_HINTS: Record<AiProvider, string> = {
  openai: 'e.g., gpt-4o, gpt-4o-mini',
  anthropic: 'e.g., claude-sonnet-4-5-20250929, claude-haiku-4-5-20251001',
  'openai-compatible': 'e.g., llava, llama3.2-vision',
};

export const KEY_PLACEHOLDERS: Record<AiProvider, string> = {
  openai: 'sk-...',
  anthropic: 'sk-ant-...',
  'openai-compatible': 'API key (if required)',
};
