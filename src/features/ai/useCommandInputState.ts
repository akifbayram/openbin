import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/components/ui/toast';
import { useAuth } from '@/lib/auth';
import { useTerminology } from '@/lib/terminology';
import { mapAiError } from './aiErrors';
import type { ExecutionResult } from './useActionExecutor';
import { useAiSettings } from './useAiSettings';
import type { QueryResult } from './useInventoryQuery';
import { useStreamingCommand } from './useStreamingCommand';
import { useStreamingQuery } from './useStreamingQuery';

type State = 'idle' | 'parsing' | 'preview' | 'executing' | 'querying' | 'query-result' | 'success';

export function useCommandInputState(onOpenChange: (open: boolean) => void) {
  const t = useTerminology();
  const { activeLocationId } = useAuth();
  const navigate = useNavigate();
  const { settings, isLoading: aiSettingsLoading } = useAiSettings();
  const { showToast } = useToast();
  const { actions, interpretation, isStreaming: isParsing, error, parse, clear: clearCommand } = useStreamingCommand();
  const { partialText: queryPartialText, query, isStreaming: isQueryStreaming, error: queryError, cancel: cancelQuery, clear: clearQuery } = useStreamingQuery();
  const [text, setText] = useState('');
  const [checkedActions, setCheckedActions] = useState<Map<number, boolean>>(new Map());
  const [queryResult, setQueryResult] = useState<QueryResult | null>(null);
  const [isQuerying, setIsQuerying] = useState(false);
  const [photoMode, setPhotoMode] = useState(false);
  const [initialFiles, setInitialFiles] = useState<File[]>([]);
  const [examplesOpen, setExamplesOpen] = useState(false);
  const [executionResult, setExecutionResult] = useState<ExecutionResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isAiReady = settings !== null;

  const state: State = executionResult ? 'success'
    : checkedActions.size > 0 && actions ? 'preview'
    : isParsing ? 'parsing'
    : (isQuerying || isQueryStreaming) && queryPartialText.length === 0 ? 'querying'
    : (isQueryStreaming && queryPartialText.length > 0) ? 'query-result'
    : queryResult ? 'query-result'
    : actions ? 'preview'
    : 'idle';

  const selectedCount = actions
    ? actions.filter((_, i) => checkedActions.get(i) !== false).length
    : 0;

  async function handleParse() {
    if (!text.trim() || !activeLocationId || !isAiReady) return;
    const result = await parse({ text: text.trim(), locationId: activeLocationId });
    if (result?.actions) {
      if (result.actions.length === 0) {
        clearCommand();
        setIsQuerying(true);
        try {
          const qr = await query({ question: text.trim(), locationId: activeLocationId });
          setQueryResult(qr);
        } catch (err) {
          setQueryResult(null);
          showToast({ message: mapAiError(err, 'Query failed') });
        } finally {
          setIsQuerying(false);
        }
      } else {
        const initial = new Map<number, boolean>();
        for (let i = 0; i < result.actions.length; i++) initial.set(i, true);
        setCheckedActions(initial);
      }
    }
  }

  function handleBack() {
    clearCommand();
    cancelQuery();
    clearQuery();
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
      clearCommand();
      cancelQuery();
      clearQuery();
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

  function handleBinClick(binId: string) {
    handleClose(false);
    navigate(`/bin/${binId}`, { state: { backLabel: t.Bins, backPath: '/bins' } });
  }

  function handleExecuteComplete(result: ExecutionResult) {
    setText('');
    clearCommand();
    setCheckedActions(new Map());
    setExecutionResult(result);
  }

  function handleAskAnother() {
    setText('');
    clearCommand();
    setExecutionResult(null);
  }

  return {
    // State
    text,
    setText,
    checkedActions,
    queryResult,
    queryPartialText,
    isQueryStreaming,
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
    error: error || queryError,
    // Handlers
    handleParse,
    handleBack,
    toggleAction,
    handleClose,
    handlePhotoSelect,
    handleBinClick,
    handleExecuteComplete,
    handleAskAnother,
  };
}

export type { State };
