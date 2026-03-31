import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/components/ui/toast';
import { useAuth } from '@/lib/auth';
import { useTerminology } from '@/lib/terminology';
import { mapAiError } from './aiErrors';
import type { ExecutionResult } from './useActionExecutor';
import { useAiSettings } from './useAiSettings';
import type { CommandAction } from './useCommand';
import type { QueryResult } from './useInventoryQuery';
import { useStreamingAsk } from './useStreamingAsk';

type State = 'idle' | 'parsing' | 'preview' | 'executing' | 'querying' | 'query-result' | 'success';

export function useCommandInputState(onOpenChange: (open: boolean) => void) {
  const t = useTerminology();
  const { activeLocationId } = useAuth();
  const navigate = useNavigate();
  const { settings, isLoading: aiSettingsLoading } = useAiSettings();
  const { showToast } = useToast();
  const { isStreaming: isParsing, error, partialText: queryPartialText, ask, cancel: cancelAsk, clear: clearAsk } = useStreamingAsk();
  const [text, setText] = useState('');
  const [checkedActions, setCheckedActions] = useState<Map<number, boolean>>(new Map());
  const [actions, setActions] = useState<CommandAction[] | null>(null);
  const [interpretation, setInterpretation] = useState('');
  const [queryResult, setQueryResult] = useState<QueryResult | null>(null);
  const [photoMode, setPhotoMode] = useState(false);
  const [initialFiles, setInitialFiles] = useState<File[]>([]);
  const [examplesOpen, setExamplesOpen] = useState(false);
  const [executionResult, setExecutionResult] = useState<ExecutionResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isAiReady = settings !== null;

  // Derive querying state from streaming + query result
  const isQuerying = isParsing && !actions && !queryResult;

  const state: State = executionResult ? 'success'
    : checkedActions.size > 0 && actions ? 'preview'
    : isParsing ? 'parsing'
    : isQuerying ? 'querying'
    : queryResult ? 'query-result'
    : actions ? 'preview'
    : 'idle';

  const selectedCount = actions
    ? actions.filter((_, i) => checkedActions.get(i) !== false).length
    : 0;

  function applyAskResult(result: unknown) {
    const asCmd = result as { actions?: CommandAction[]; interpretation?: string };
    const asQuery = result as { answer?: string; matches?: Array<{ bin_id: string; name: string; area_name: string; items: string[]; tags: string[]; relevance: string }> };

    if (Array.isArray(asCmd.actions) && asCmd.actions.length > 0) {
      const validActions = asCmd.actions.filter(
        (a): a is CommandAction => typeof a === 'object' && a !== null && typeof (a as Record<string, unknown>).type === 'string'
      );
      setActions(validActions);
      setInterpretation(asCmd.interpretation ?? '');
      const initial = new Map<number, boolean>();
      for (let i = 0; i < validActions.length; i++) initial.set(i, true);
      setCheckedActions(initial);
    } else if (typeof asQuery.answer === 'string') {
      setQueryResult({ answer: asQuery.answer, matches: asQuery.matches ?? [] });
    } else if (Array.isArray(asCmd.actions) && asCmd.actions.length === 0) {
      setQueryResult({
        answer: asCmd.interpretation || 'I couldn\'t find relevant information for that.',
        matches: [],
      });
    }
  }

  async function handleParse() {
    if (!text.trim() || !activeLocationId || !isAiReady) return;
    setActions(null);
    setInterpretation('');
    setQueryResult(null);

    try {
      const result = await ask({ text: text.trim(), locationId: activeLocationId });
      if (result) applyAskResult(result);
    } catch (err) {
      showToast({ message: mapAiError(err, 'Request failed') });
    }
  }

  function handleBack() {
    cancelAsk();
    clearAsk();
    setActions(null);
    setInterpretation('');
    setCheckedActions(new Map());
    setQueryResult(null);
    setExecutionResult(null);
  }

  function toggleAction(index: number) {
    setCheckedActions((prev) => {
      const next = new Map(prev);
      next.set(index, !(prev.get(index) ?? true));
      return next;
    });
  }

  function handleClose(v: boolean) {
    if (!v) {
      setText('');
      cancelAsk();
      clearAsk();
      setActions(null);
      setInterpretation('');
      setCheckedActions(new Map());
      setQueryResult(null);
      setExecutionResult(null);
      setPhotoMode(false);
      setInitialFiles([]);
    }
    onOpenChange(v);
  }

  function handlePhotoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setInitialFiles(Array.from(files));
    setPhotoMode(true);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function handleBinClick(binId: string, isTrashed?: boolean) {
    handleClose(false);
    if (isTrashed) {
      navigate('/trash');
    } else {
      navigate(`/bin/${binId}`, { state: { backLabel: t.Bins, backPath: '/bins' } });
    }
  }

  function handleExecuteComplete(result: ExecutionResult) {
    setExecutionResult(result);
    setText('');
    setActions(null);
    setInterpretation('');
    setCheckedActions(new Map());
  }

  async function handleFollowUp(followUpText: string) {
    if (!activeLocationId || !isAiReady) return;

    // Build context-aware prompt with previous Q&A
    const contextParts: string[] = [];
    if (text) contextParts.push(`Previous question: "${text}"`);
    if (queryResult?.answer) contextParts.push(`Previous answer: "${queryResult.answer}"`);
    if (queryResult?.matches?.length) {
      contextParts.push(`Matched bins: ${queryResult.matches.map(m => m.name).join(', ')}`);
    }
    const contextPrefix = contextParts.length > 0
      ? `Context from prior exchange:\n${contextParts.join('\n')}\n\nFollow-up: `
      : '';

    clearAsk();
    setActions(null);
    setInterpretation('');
    setQueryResult(null);
    setText(followUpText);

    try {
      const result = await ask({ text: contextPrefix + followUpText, locationId: activeLocationId });
      if (result) applyAskResult(result);
    } catch (err) {
      showToast({ message: mapAiError(err, 'Request failed') });
    }
  }

  function handleAskAnother() {
    setText('');
    clearAsk();
    setActions(null);
    setInterpretation('');
    setExecutionResult(null);
  }

  return {
    // State
    text,
    setText,
    checkedActions,
    queryResult,
    queryPartialText,
    isQueryStreaming: isParsing && queryResult === null && actions === null,
    photoMode,
    setPhotoMode,
    initialFiles,
    setInitialFiles,
    examplesOpen,
    setExamplesOpen,
    executionResult,
    fileInputRef,
    // Derived
    state,
    isAiReady,
    aiSettingsLoading,
    selectedCount,
    // Command
    actions,
    interpretation,
    error,
    // Handlers
    handleParse,
    handleBack,
    toggleAction,
    handleClose,
    handlePhotoSelect,
    handleBinClick,
    handleExecuteComplete,
    handleAskAnother,
    handleFollowUp,
  };
}

export type { State };
