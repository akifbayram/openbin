const MAX_DURATION_MS = 2 * 60 * 1000; // 2 minutes

export interface RecordingHandle {
  /** Stop recording and return the audio blob. */
  stop: () => Promise<Blob>;
  /** Cancel recording without returning data. */
  cancel: () => void;
  /** The raw MediaStream (for cleanup). */
  stream: MediaStream;
}

/**
 * Start recording audio from the user's microphone.
 * Returns a handle to stop/cancel the recording.
 * Automatically stops after MAX_DURATION_MS (2 minutes).
 */
export async function startRecording(onAutoStop?: () => void): Promise<RecordingHandle> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

  // Pick a supported MIME type
  const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
    ? 'audio/webm;codecs=opus'
    : MediaRecorder.isTypeSupported('audio/webm')
      ? 'audio/webm'
      : '';

  const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
  const chunks: Blob[] = [];

  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };

  recorder.start();

  let autoStopTimer: ReturnType<typeof setTimeout> | null = setTimeout(() => {
    autoStopTimer = null;
    if (recorder.state === 'recording') {
      recorder.stop();
      onAutoStop?.();
    }
  }, MAX_DURATION_MS);

  function cleanup() {
    if (autoStopTimer) {
      clearTimeout(autoStopTimer);
      autoStopTimer = null;
    }
    for (const track of stream.getTracks()) track.stop();
  }

  return {
    stop: () =>
      new Promise<Blob>((resolve) => {
        recorder.onstop = () => {
          cleanup();
          const blob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' });
          resolve(blob);
        };
        if (recorder.state === 'recording') {
          recorder.stop();
        } else {
          // Already stopped (e.g. auto-stop fired), resolve with collected chunks
          cleanup();
          resolve(new Blob(chunks, { type: recorder.mimeType || 'audio/webm' }));
        }
      }),
    cancel: () => {
      cleanup();
      if (recorder.state === 'recording') recorder.stop();
    },
    stream,
  };
}

/** Check if the browser supports audio recording. */
export function isRecordingSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    !!navigator.mediaDevices?.getUserMedia &&
    typeof MediaRecorder !== 'undefined' &&
    window.isSecureContext
  );
}
