/**
 * 測試：telegram 模組
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  formatDailyReport,
  sendTelegramMessage,
  getMsUntilTargetTime,
  stopTelegramScheduler,
} from "../src/utils/telegram.js";
import type { Stats24h } from "../src/utils/metrics.js";

describe("telegram 每日狀態摘要模組測試", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    stopTelegramScheduler();
  });

  afterEach(() => {
    stopTelegramScheduler();
    vi.unstubAllGlobals();
  });

  it("formatDailyReport 輸出格式應精確符合規範", () => {
    const mockStats: Stats24h = {
      status: "健康運行中",
      uptimeFormatted: "3 天 14 小時",
      queryCount: 86,
      apiTotal: 100,
      apiSuccess: 99,
      apiSuccessRate: "99.2%",
    };

    const text = formatDailyReport(mockStats);
    const expected =
      `🟢 [Taiwan-PT-MCP 運行報告]\n` +
      `- 伺服器狀態：健康運行中\n` +
      `- 連續運作時間（Uptime）：3 天 14 小時\n` +
      `- 過去 24 小時查詢次數：86 次\n` +
      `- 外部 PubMed 連線成功率：99.2%`;

    expect(text).toBe(expected);
  });

  it("未提供 botToken 或 chatId 時 sendTelegramMessage 應回傳 false", async () => {
    const ok = await sendTelegramMessage("test", {
      botToken: "",
      chatId: "",
    });
    expect(ok).toBe(false);
  });

  it("sendTelegramMessage 應正確打向 Telegram Bot API", async () => {
    let requestedUrl = "";
    let requestBody: any = {};

    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, opts: any) => {
        requestedUrl = url;
        requestBody = JSON.parse(opts.body);
        return { ok: true, status: 200 } as any;
      })
    );

    const ok = await sendTelegramMessage("Hello from MCP", {
      botToken: "123456:ABC-DEF",
      chatId: "987654321",
    });

    expect(ok).toBe(true);
    expect(requestedUrl).toBe("https://api.telegram.org/bot123456:ABC-DEF/sendMessage");
    expect(requestBody.chat_id).toBe("987654321");
    expect(requestBody.text).toBe("Hello from MCP");
  });

  it("getMsUntilTargetTime 計算距離中午 12:00 的毫秒數", () => {
    // 早上 10:00:00 -> 距離今天 12:00:00 應為 2 小時
    const morning = new Date(2026, 8, 4, 10, 0, 0);
    const ms1 = getMsUntilTargetTime(12, 0, morning);
    expect(ms1).toBe(2 * 60 * 60 * 1000);

    // 下午 14:00:00 -> 今天的 12:00 已過，距離明天 12:00:00 應為 22 小時
    const afternoon = new Date(2026, 8, 4, 14, 0, 0);
    const ms2 = getMsUntilTargetTime(12, 0, afternoon);
    expect(ms2).toBe(22 * 60 * 60 * 1000);
  });
});
