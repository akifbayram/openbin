import { useCallback, useEffect, useRef, useState } from 'react';
import { useToast } from '@/components/ui/toast';
import { mapAiError } from '@/features/ai/aiErrors';
import { apiFetch } from '@/lib/api';
import type { RecordingHandle } from '@/lib/audioRecorder';
import { startRecording } from '@/lib/audioRecorder';
import { Events, notify } from '@/lib/eventBus';

export type TranscriptionState = 'idle' | 'recording' | 'transcribing';

interface TranscribeResponse {
  text: string;
}

interface UseTranscriptionOptions {
  onTranscribed: (text: string) => void;
}

export function useTranscription({ onTranscribed }: UseTranscriptionOptions) {
  const { showToast } = useToast();

  const [state, setState] = useState<TranscriptionState>('idle');
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const recordingRef = useRef<RecordingHandle | null>(null);
  const cancelledRef = useRef(false);
  const startRef = useRef<() => void>(() => {});
  const onTranscribedRef = useRef(onTranscribed);
  onTranscribedRef.current = onTranscribed;

  // Tick elapsed time during recording
  const isRecording = state === 'recording';
  useEffect(() => {
    if (!isRecording) return;
    setDuration(0);
    const id = setInterval(() => setDuration((d) => d + 1), 1000);
    return () => clearInterval(id);
  }, [isRecording]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      recordingRef.current?.cancel();
    };
  }, []);

  const cancel = useCallback(() => {
    cancelledRef.current = true;
    recordingRef.current?.cancel();
    recordingRef.current = null;
    setState('idle');
    setDuration(0);
    setError(null);
  }, []);

  const handleStopInternal = useCallback(async () => {
    const handle = recordingRef.current;
    if (!handle) return;
    recordingRef.current = null;

    setState('transcribing');
    try {
      const blob = await handle.stop();
      if (blob.size < 1000) {
        showToast({ message: 'No audio recorded', variant: 'warning' });
        setState('idle');
        return;
      }

      const formData = new FormData();
      let ext = 'webm';
      if (blob.type.includes('mp4')) ext = 'mp4';
      else if (blob.type.includes('ogg')) ext = 'ogg';
      formData.append('audio', blob, `recording.${ext}`);
      const result = await apiFetch<TranscribeResponse>('/api/ai/transcribe', {
        method: 'POST',
        body: formData,
      });
      notify(Events.PLAN); // AI credit used

      if (cancelledRef.current) return;

      const text = result.text.trim();
      if (!text) {
        showToast({ message: 'No speech detected. Try again.', variant: 'warning' });
        setState('idle');
        return;
      }

      setState('idle');
      setDuration(0);
      onTranscribedRef.current(text);
    } catch (err) {
      if (cancelledRef.current) return;
      const message = mapAiError(err, 'Transcription failed. Try again.');
      setError(message);
      showToast({
        message,
        variant: 'error',
        action: { label: 'Retry', onClick: () => startRef.current() },
      });
      setState('idle');
    }
  }, [showToast]);

  const start = useCallback(async () => {
    if (state !== 'idle') return;
    cancelledRef.current = false;
    setError(null);

    try {
      const handle = await startRecording(() => {
        handleStopInternal();
      });
      recordingRef.current = handle;
      setState('recording');
    } catch (err) {
      let message = 'Could not start recording';
      if (err instanceof DOMException) {
        if (err.name === 'NotAllowedError') message = 'Microphone access was denied by the browser';
        else if (err.name === 'NotFoundError') message = 'No microphone found on this device';
        else if (err.name === 'NotReadableError') message = 'Microphone is in use by another application';
        else message = `Recording error: ${err.name}`;
      }
      showToast({ message, variant: 'error' });
    }
  }, [state, showToast, handleStopInternal]);
  startRef.current = start;

  const stop = useCallback(() => {
    handleStopInternal();
  }, [handleStopInternal]);

  return { state, duration, error, start, stop, cancel };
}
