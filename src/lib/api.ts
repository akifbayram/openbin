const API_BASE = '';

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

interface ApiFetchOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  timeout?: number;
}

// Shared promise to deduplicate concurrent refresh attempts
let refreshPromise: Promise<boolean> | null = null;

async function tryRefresh(): Promise<boolean> {
  if (refreshPromise) return refreshPromise;
  refreshPromise = (async () => {
    try {
      const res = await fetch(`${API_BASE}/api/auth/refresh`, {
        method: 'POST',
        credentials: 'same-origin',
      });
      return res.ok;
    } catch {
      return false;
    } finally {
      refreshPromise = null;
    }
  })();
  return refreshPromise;
}

async function doFetch<T>(path: string, options: ApiFetchOptions, isRetry: boolean): Promise<T> {
  const headers: Record<string, string> = {};

  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;

  if (!isFormData && options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  // Merge provided headers
  if (options.headers) {
    const provided = options.headers as Record<string, string>;
    for (const [k, v] of Object.entries(provided)) {
      headers[k] = v;
    }
  }

  let controller: AbortController | undefined;
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  if (options.timeout) {
    controller = new AbortController();
    timeoutId = setTimeout(() => controller!.abort(), options.timeout);
  }

  const fetchOptions: RequestInit = {
    ...options,
    headers,
    credentials: 'same-origin',
    signal: controller && options.signal
      ? AbortSignal.any([controller.signal, options.signal])
      : controller?.signal ?? options.signal,
    body: isFormData
      ? (options.body as FormData)
      : options.body !== undefined
        ? JSON.stringify(options.body)
        : undefined,
  };

  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, fetchOptions);
  } finally {
    if (timeoutId !== undefined) clearTimeout(timeoutId);
  }

  // Auto-refresh on 401 (but not if this is already a retry or the failing request is the refresh endpoint itself)
  if (res.status === 401 && !isRetry && !path.includes('/api/auth/refresh')) {
    const refreshed = await tryRefresh();
    if (refreshed) {
      return doFetch<T>(path, options, true);
    }
    // Refresh failed — notify auth provider
    window.dispatchEvent(new CustomEvent('openbin-auth-expired'));
  }

  if (!res.ok) {
    const data = await res.json().catch(() => ({ error: res.statusText }));
    throw new ApiError(res.status, data.message || data.error || res.statusText);
  }

  if (res.status === 204) return undefined as T;

  const text = await res.text();
  if (!text) return undefined as T;
  return JSON.parse(text) as T;
}

export async function apiFetch<T>(
  path: string,
  options: ApiFetchOptions = {}
): Promise<T> {
  return doFetch<T>(path, options, false);
}

/** Build an avatar URL (cookies handle auth automatically). */
export function getAvatarUrl(avatarPath: string): string {
  return avatarPath;
}
