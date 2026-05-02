import type { AiProvider, AiTaskGroup } from '@/types';

export const MAX_AI_PHOTOS = 5;

/**
 * Lock-confirmation hold during the AI analyze → review handoff. CSS animations
 * finish at ~240ms, leaving the brackets converged and "LOCKED" readout visible;
 * the remainder is held stillness so the brain registers the lock as a discrete
 * event before the photo collapse and form fade-in start.
 */
export const LOCK_BEAT_MS = 600;

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

export const TASK_GROUP_META: { key: AiTaskGroup; label: string; description: string }[] = [
  { key: 'vision', label: 'Vision', description: 'Photo Scan' },
  { key: 'quickText', label: 'Quick Text', description: 'Commands, Queries, Text Extraction' },
  { key: 'deepText', label: 'Deep Text', description: 'Reorganize, Tag Suggestions' },
];
