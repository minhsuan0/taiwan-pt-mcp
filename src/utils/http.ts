/**
 * HTTP fetch wrapper with retry, timeout, and rate-limit handling
 * Taiwan PT MCP — http.ts
 */

export interface FetchOptions {
  method?: "GET" | "POST";
  headers?: Record<string, string>;
  body?: string;
  timeoutMs?: number;
  retries?: number;
}

const DEFAULT_TIMEOUT = 12_000; // 12 秒
const DEFAULT_RETRIES = 2;

/**
 * 帶 timeout 和自動重試的 fetch
 */
export async function fetchWithRetry(
  url: string,
  opts: FetchOptions = {}
): Promise<Response> {
  const {
    method = "GET",
    headers = {},
    body,
    timeoutMs = DEFAULT_TIMEOUT,
    retries = DEFAULT_RETRIES,
  } = opts;

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        method,
        headers: {
          "User-Agent": "TaiwanPT-MCP/1.0 (mailto:pt-mcp@example.com)",
          Accept: "application/json",
          ...headers,
        },
        ...(body ? { body } : {}),
        signal: controller.signal,
      });

      clearTimeout(timer);

      // 429 Too Many Requests → 等待後重試
      if (response.status === 429 && attempt < retries) {
        const retryAfter = parseInt(response.headers.get("Retry-After") ?? "5", 10);
        await sleep(retryAfter * 1000);
        continue;
      }

      return response;
    } catch (err) {
      clearTimeout(timer);
      lastError = err instanceof Error ? err : new Error(String(err));

      if (attempt < retries) {
        // exponential back-off: 500ms, 1000ms
        await sleep(500 * Math.pow(2, attempt));
        continue;
      }
    }
  }

  throw lastError ?? new Error(`fetchWithRetry failed: ${url}`);
}

/**
 * 取得 JSON，若 HTTP 不成功則 throw
 */
export async function getJson<T>(url: string, opts?: FetchOptions): Promise<T> {
  const res = await fetchWithRetry(url, opts);
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status} ${res.statusText} — ${url}\n${text.slice(0, 200)}`);
  }
  return res.json() as Promise<T>;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
