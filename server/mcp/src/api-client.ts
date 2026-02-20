export class OpenBinApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = "OpenBinApiError";
  }
}

interface ErrorBody {
  error: string;
  message: string;
}

export class ApiClient {
  constructor(
    private baseUrl: string,
    private apiKey: string,
  ) {}

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.apiKey}`,
    };
    if (body !== undefined) {
      headers["Content-Type"] = "application/json";
    }

    const res = await fetch(url, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) {
      let code = "UNKNOWN";
      let message = `HTTP ${res.status}`;
      try {
        const err = (await res.json()) as ErrorBody;
        code = err.error;
        message = err.message;
      } catch {
        // use defaults
      }
      throw new OpenBinApiError(res.status, code, message);
    }

    if (res.status === 204) {
      return undefined as T;
    }

    return (await res.json()) as T;
  }

  get<T>(path: string): Promise<T> {
    return this.request<T>("GET", path);
  }

  post<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>("POST", path, body);
  }

  put<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>("PUT", path, body);
  }

  del<T>(path: string): Promise<T> {
    return this.request<T>("DELETE", path);
  }

  async getText(path: string): Promise<string> {
    const url = `${this.baseUrl}${path}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${this.apiKey}` },
    });

    if (!res.ok) {
      let code = "UNKNOWN";
      let message = `HTTP ${res.status}`;
      try {
        const err = (await res.json()) as ErrorBody;
        code = err.error;
        message = err.message;
      } catch {
        // use defaults
      }
      throw new OpenBinApiError(res.status, code, message);
    }

    return res.text();
  }
}

type ToolResult = { content: Array<{ type: "text"; text: string }>; isError?: boolean };

export function withErrorHandling<T extends Record<string, unknown>>(
  fn: (args: T) => Promise<ToolResult>,
): (args: T) => Promise<ToolResult> {
  return async (args: T) => {
    try {
      return await fn(args);
    } catch (err) {
      if (err instanceof OpenBinApiError) {
        return {
          content: [{ type: "text" as const, text: `Error (${err.code}): ${err.message}` }],
          isError: true,
        };
      }
      const message = err instanceof Error ? err.message : String(err);
      return {
        content: [{ type: "text" as const, text: `Unexpected error: ${message}` }],
        isError: true,
      };
    }
  };
}
