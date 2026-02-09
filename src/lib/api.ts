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
}

export async function apiFetch<T>(
  path: string,
  options: ApiFetchOptions = {}
): Promise<T> {
  const token = localStorage.getItem('qrbin-token');
  const headers: Record<string, string> = {};

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

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

  const fetchOptions: RequestInit = {
    ...options,
    headers,
    body: isFormData
      ? (options.body as FormData)
      : options.body !== undefined
        ? JSON.stringify(options.body)
        : undefined,
  };

  const res = await fetch(`${API_BASE}${path}`, fetchOptions);

  if (!res.ok) {
    const data = await res.json().catch(() => ({ error: res.statusText }));
    throw new ApiError(res.status, data.error || res.statusText);
  }

  if (res.status === 204) return undefined as T;

  const text = await res.text();
  if (!text) return undefined as T;
  return JSON.parse(text) as T;
}
