/**
 * 系統指標收集與統計模組
 * Taiwan PT MCP — metrics.ts
 *
 * 負責追蹤：
 * 1. 使用者查詢次數（24 小時滾動統計）
 * 2. 外部 API（PubMed、法規資料庫等）連線總數與成功率
 * 3. 伺服器 Uptime 運行時間格式化
 */

export interface MetricEvent {
  timestamp: number;
}

export interface ApiCallEvent extends MetricEvent {
  success: boolean;
}

export interface Stats24h {
  queryCount: number;
  apiTotal: number;
  apiSuccess: number;
  apiSuccessRate: string;
  uptimeFormatted: string;
  status: string;
}

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

// 儲存事件紀錄
let queryEvents: MetricEvent[] = [];
let apiCallEvents: ApiCallEvent[] = [];

/**
 * 記錄一次使用者查詢
 */
export function recordQuery(timestamp: number = Date.now()): void {
  queryEvents.push({ timestamp });
  cleanupOldEvents(timestamp);
}

/**
 * 記錄一次外部 API 連線（成功或失敗）
 */
export function recordApiCall(success: boolean, timestamp: number = Date.now()): void {
  apiCallEvents.push({ timestamp, success });
  cleanupOldEvents(timestamp);
}

/**
 * 格式化伺服器 Uptime
 * @param uptimeSeconds 運行秒數，預設使用 process.uptime()
 */
export function formatUptime(uptimeSeconds: number = process.uptime()): string {
  const totalSeconds = Math.floor(uptimeSeconds);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);

  if (days > 0) {
    return `${days} 天 ${hours} 小時`;
  }
  if (hours > 0) {
    return `${hours} 小時 ${minutes} 分鐘`;
  }
  return `${Math.max(1, minutes)} 分鐘`;
}

/**
 * 清除超過 24 小時的舊紀錄，防止記憶體無上限累積
 */
export function cleanupOldEvents(now: number = Date.now()): void {
  const threshold = now - TWENTY_FOUR_HOURS_MS;
  queryEvents = queryEvents.filter((e) => e.timestamp >= threshold);
  apiCallEvents = apiCallEvents.filter((e) => e.timestamp >= threshold);
}

/**
 * 取得過去 24 小時的各項指標摘要
 */
export function get24hStats(now: number = Date.now()): Stats24h {
  cleanupOldEvents(now);

  const queryCount = queryEvents.length;
  const apiTotal = apiCallEvents.length;
  const apiSuccess = apiCallEvents.filter((e) => e.success).length;

  let apiSuccessRate = "100.0%";
  if (apiTotal > 0) {
    const rate = (apiSuccess / apiTotal) * 100;
    apiSuccessRate = `${rate.toFixed(1)}%`;
  }

  return {
    queryCount,
    apiTotal,
    apiSuccess,
    apiSuccessRate,
    uptimeFormatted: formatUptime(),
    status: "健康運行中",
  };
}

/**
 * 重置指標（主要供單元測試使用）
 */
export function resetMetrics(): void {
  queryEvents = [];
  apiCallEvents = [];
}
