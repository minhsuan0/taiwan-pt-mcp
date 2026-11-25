/**
 * 伺服器外部心跳檢測模組 (Dead Man's Switch / 死人開關)
 * Taiwan PT MCP — heartbeat.ts
 *
 * 定時向外部監控服務（如 Healthchecks.io, Better Stack, Cronitor）打卡。
 * 若伺服器無聲崩潰、卡死或斷網，外部服務在超過時間門檻後會立即發出告警。
 */

const DEFAULT_INTERVAL_MS = 2 * 60 * 1000; // 預設 2 分鐘打卡一次

let heartbeatTimer: NodeJS.Timeout | null = null;

export interface HeartbeatConfig {
  url?: string;
  intervalMs?: number;
}

/**
 * 取得當前心跳設定
 */
export function getHeartbeatConfig(): HeartbeatConfig {
  return {
    url: process.env.HEARTBEAT_URL ?? "",
    intervalMs: process.env.HEARTBEAT_INTERVAL_MS
      ? parseInt(process.env.HEARTBEAT_INTERVAL_MS, 10)
      : DEFAULT_INTERVAL_MS,
  };
}

/**
 * 發送單次心跳請求
 * @param status 心跳狀態: 'start' (啟動), 'success' (正常打卡), 'fail' (失敗/即將終止)
 * @param customUrl 選填，自訂 URL（方便測試使用）
 */
export async function pingHeartbeat(
  status: "start" | "success" | "fail" = "success",
  customUrl?: string
): Promise<boolean> {
  const targetBaseUrl = customUrl ?? getHeartbeatConfig().url;
  if (!targetBaseUrl) {
    return false;
  }

  // Healthchecks.io 與多數平台標準：支援 /start 與 /fail 子路徑
  const url =
    status === "success"
      ? targetBaseUrl
      : `${targetBaseUrl.replace(/\/+$/, "")}/${status}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "User-Agent": "TaiwanPT-MCP/1.0",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        status,
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memoryUsageRss: process.memoryUsage?.().rss,
      }),
      signal: controller.signal,
    });
    clearTimeout(timer);
    return res.ok;
  } catch (err) {
    clearTimeout(timer);
    // 輸出到 stderr，不破壞 MCP stdio 協定
    process.stderr.write(`[taiwan-pt-mcp] 心跳打卡失敗: ${err}\n`);
    return false;
  }
}

/**
 * 啟動定時心跳循環
 */
export function startHeartbeat(customConfig?: HeartbeatConfig): void {
  const config = customConfig ?? getHeartbeatConfig();
  if (!config.url) {
    process.stderr.write(
      "[taiwan-pt-mcp] 外部心跳監控未啟用（未配置 HEARTBEAT_URL）。\n"
    );
    return;
  }

  const interval = config.intervalMs ?? DEFAULT_INTERVAL_MS;
  process.stderr.write(
    `[taiwan-pt-mcp] 外部心跳監控已啟動，間隔 ${Math.round(interval / 1000)} 秒打卡。\n`
  );

  // 立即發送一次啟動心跳
  pingHeartbeat("start", config.url).catch(() => {});

  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
  }

  heartbeatTimer = setInterval(() => {
    pingHeartbeat("success", config.url).catch(() => {});
  }, interval);
}

/**
 * 停止心跳循環
 */
export function stopHeartbeat(): void {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
}
