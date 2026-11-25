/**
 * Telegram 每日狀態摘要報告模組
 * Taiwan PT MCP — telegram.ts
 *
 * 負責定時於每日中午 12:00 發送運行報告至指定的 Telegram 聊天室或頻道。
 */

import { get24hStats, type Stats24h } from "./metrics.js";

let schedulerTimer: NodeJS.Timeout | null = null;

export interface TelegramConfig {
  botToken?: string;
  chatId?: string;
}

/**
 * 取得當前 Telegram 設定
 */
export function getTelegramConfig(): TelegramConfig {
  return {
    botToken: process.env.TELEGRAM_BOT_TOKEN ?? "",
    chatId: process.env.TELEGRAM_CHAT_ID ?? "",
  };
}

/**
 * 產生每日運行報告文字
 */
export function formatDailyReport(customStats?: Stats24h): string {
  const stats = customStats ?? get24hStats();

  return (
    `🟢 [Taiwan-PT-MCP 運行報告]\n` +
    `- 伺服器狀態：${stats.status}\n` +
    `- 連續運作時間（Uptime）：${stats.uptimeFormatted}\n` +
    `- 過去 24 小時查詢次數：${stats.queryCount} 次\n` +
    `- 外部 PubMed 連線成功率：${stats.apiSuccessRate}`
  );
}

/**
 * 發送訊息至 Telegram
 */
export async function sendTelegramMessage(
  text: string,
  customConfig?: TelegramConfig
): Promise<boolean> {
  const config = customConfig ?? getTelegramConfig();
  if (!config.botToken || !config.chatId) {
    return false;
  }

  const url = `https://api.telegram.org/bot${config.botToken}/sendMessage`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: config.chatId,
        text,
      }),
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      process.stderr.write(
        `[taiwan-pt-mcp] Telegram 發送失敗 (${res.status}): ${errText}\n`
      );
      return false;
    }
    return true;
  } catch (err) {
    clearTimeout(timer);
    process.stderr.write(`[taiwan-pt-mcp] Telegram 網路發送錯誤: ${err}\n`);
    return false;
  }
}

/**
 * 發送每日運行報告
 */
export async function sendDailyReport(customConfig?: TelegramConfig): Promise<boolean> {
  const report = formatDailyReport();
  return sendTelegramMessage(report, customConfig);
}

/**
 * 計算距離下一個指定時間（預設中午 12:00:00）的毫秒數
 */
export function getMsUntilTargetTime(
  targetHour = 12,
  targetMinute = 0,
  now = new Date()
): number {
  const target = new Date(now);
  target.setHours(targetHour, targetMinute, 0, 0);

  // 如果今天的目標時間已過（或差距小於 1 秒），排程到明天
  if (target.getTime() <= now.getTime() + 1000) {
    target.setDate(target.getDate() + 1);
  }

  return target.getTime() - now.getTime();
}

/**
 * 啟動定時排程器（每日中午 12:00 發送報告）
 */
export function startTelegramScheduler(customConfig?: TelegramConfig): void {
  const config = customConfig ?? getTelegramConfig();
  if (!config.botToken || !config.chatId) {
    process.stderr.write(
      "[taiwan-pt-mcp] Telegram 定時摘要未啟用（未配置 TELEGRAM_BOT_TOKEN 或 TELEGRAM_CHAT_ID）。\n"
    );
    return;
  }

  // 支援啟動時立即測試發送一次
  if (process.env.TELEGRAM_TEST_ON_STARTUP === "true") {
    process.stderr.write("[taiwan-pt-mcp] 偵測到 TELEGRAM_TEST_ON_STARTUP，立即發送測試報告...\n");
    sendDailyReport(config).catch(() => {});
  }

  function scheduleNext() {
    const delayMs = getMsUntilTargetTime(12, 0);
    const nextTime = new Date(Date.now() + delayMs);
    process.stderr.write(
      `[taiwan-pt-mcp] 下次 Telegram 運行報告排定於：${nextTime.toLocaleString("zh-TW")}\n`
    );

    schedulerTimer = setTimeout(async () => {
      try {
        await sendDailyReport(config);
      } catch (err) {
        process.stderr.write(`[taiwan-pt-mcp] 排程發送 Telegram 失敗: ${err}\n`);
      }
      scheduleNext();
    }, delayMs);
  }

  scheduleNext();
}

/**
 * 停止 Telegram 排程器
 */
export function stopTelegramScheduler(): void {
  if (schedulerTimer) {
    clearTimeout(schedulerTimer);
    schedulerTimer = null;
  }
}

let isListening = false;
let listenerAbortController: AbortController | null = null;

/**
 * 啟動 Telegram 指令監聽（長輪詢 Long Polling）
 * 支援在 Telegram 中隨時輸入 /status 或 /help 取得即時伺服器報告
 */
export async function startTelegramListener(customConfig?: TelegramConfig): Promise<void> {
  const config = customConfig ?? getTelegramConfig();
  if (!config.botToken || !config.chatId) {
    return;
  }

  if (isListening) return;
  isListening = true;
  listenerAbortController = new AbortController();

  let offset = 0;

  // 取得最新 offset
  try {
    const initRes = await fetch(
      `https://api.telegram.org/bot${config.botToken}/getUpdates?offset=-1&timeout=0`
    );
    const initData = (await initRes.json()) as any;
    if (initData.ok && Array.isArray(initData.result) && initData.result.length > 0) {
      offset = initData.result[initData.result.length - 1].update_id + 1;
    }
  } catch {}

  process.stderr.write("[taiwan-pt-mcp] Telegram 指令監聽已啟動（支援 /status, /help）。\n");

  (async () => {
    while (isListening) {
      try {
        const res = await fetch(
          `https://api.telegram.org/bot${config.botToken}/getUpdates?offset=${offset}&timeout=20`,
          { signal: listenerAbortController?.signal }
        );
        if (!res.ok) {
          await new Promise((r) => setTimeout(r, 3000));
          continue;
        }
        const data = (await res.json()) as any;
        if (data.ok && Array.isArray(data.result)) {
          for (const update of data.result) {
            offset = update.update_id + 1;
            const msg = update.message;
            if (!msg || !msg.text) continue;

            const text = msg.text.trim();
            const fromChatId = String(msg.chat?.id);

            // 僅回應授權的 Chat ID
            if (fromChatId !== String(config.chatId)) continue;

            if (text.startsWith("/status") || text.startsWith("/report")) {
              await sendDailyReport(config);
            } else if (text.startsWith("/start") || text.startsWith("/help")) {
              await sendTelegramMessage(
                "👋 你好！我是 Taiwan-PT-MCP 物理治療監控助理。\n\n" +
                  "📌 可用指令：\n" +
                  "• /status — 即時查看伺服器健康狀態與 24 小時統計\n" +
                  "• /report — 即時產生完整運行報告",
                config
              );
            }
          }
        }
      } catch (err: any) {
        if (err?.name === "AbortError" || !isListening) break;
        await new Promise((r) => setTimeout(r, 3000));
      }
    }
  })();
}

/**
 * 停止 Telegram 指令監聽
 */
export function stopTelegramListener(): void {
  isListening = false;
  if (listenerAbortController) {
    listenerAbortController.abort();
    listenerAbortController = null;
  }
}
