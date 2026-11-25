/**
 * 測試：metrics 模組
 */
import { describe, it, expect, beforeEach } from "vitest";
import {
  recordQuery,
  recordApiCall,
  formatUptime,
  get24hStats,
  resetMetrics,
} from "../src/utils/metrics.js";

describe("metrics 模組測試", () => {
  beforeEach(() => {
    resetMetrics();
  });

  it("recordQuery 應正確累計查詢次數", () => {
    recordQuery();
    recordQuery();
    recordQuery();

    const stats = get24hStats();
    expect(stats.queryCount).toBe(3);
  });

  it("recordApiCall 應正確計算成功率", () => {
    recordApiCall(true);
    recordApiCall(true);
    recordApiCall(true);
    recordApiCall(false); // 3 成功，1 失敗 = 75.0%

    const stats = get24hStats();
    expect(stats.apiTotal).toBe(4);
    expect(stats.apiSuccess).toBe(3);
    expect(stats.apiSuccessRate).toBe("75.0%");
  });

  it("無任何 API 呼叫時成功率預設為 100.0%", () => {
    const stats = get24hStats();
    expect(stats.apiTotal).toBe(0);
    expect(stats.apiSuccessRate).toBe("100.0%");
  });

  it("應過濾超過 24 小時的過期事件", () => {
    const now = Date.now();
    const twentyFiveHoursAgo = now - 25 * 60 * 60 * 1000;
    const oneHourAgo = now - 1 * 60 * 60 * 1000;

    recordQuery(twentyFiveHoursAgo);
    recordQuery(oneHourAgo);
    recordQuery(now);

    recordApiCall(false, twentyFiveHoursAgo);
    recordApiCall(true, oneHourAgo);

    const stats = get24hStats(now);
    expect(stats.queryCount).toBe(2);
    expect(stats.apiTotal).toBe(1);
    expect(stats.apiSuccessRate).toBe("100.0%");
  });

  it("formatUptime 應正確轉換時間格式", () => {
    // 3 天 14 小時 (3 * 86400 + 14 * 3600 = 310800 秒)
    expect(formatUptime(310800)).toBe("3 天 14 小時");

    // 5 小時 20 分鐘 (5 * 3600 + 20 * 60 = 19200 秒)
    expect(formatUptime(19200)).toBe("5 小時 20 分鐘");

    // 15 分鐘
    expect(formatUptime(900)).toBe("15 分鐘");

    // 未滿 1 分鐘
    expect(formatUptime(30)).toBe("1 分鐘");
  });
});
