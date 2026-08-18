/**
 * 測試：search_pt_laws
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { searchPtLaws } from "../src/tools/laws.js";

describe("searchPtLaws — 靜態關鍵字匹配", () => {
  it("查詢「業務」應回傳第 12、13 條", async () => {
    // 關閉網路（讓 API 失敗，走靜態路徑）
    vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new Error("No network"))));
    const result = await searchPtLaws("業務");
    expect(result.results.length).toBeGreaterThan(0);
    const titles = result.results.map((r) => r.title);
    // 應包含第 12 或 13 條
    expect(titles.some((t) => t.includes("12") || t.includes("13"))).toBe(true);
    vi.unstubAllGlobals();
  });

  it("查詢「診斷」應回傳第 14 條禁止診斷條文", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new Error("No network"))));
    const result = await searchPtLaws("診斷");
    const summaries = result.results.map((r) => r.summary);
    expect(summaries.some((s) => s.includes("診斷"))).toBe(true);
    vi.unstubAllGlobals();
  });

  it("無匹配關鍵字時應回傳預設核心條文", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new Error("No network"))));
    const result = await searchPtLaws("xyzzzunknownterm");
    // 應至少回傳預設 4 條
    expect(result.results.length).toBeGreaterThanOrEqual(4);
    vi.unstubAllGlobals();
  });

  it("回傳格式應包含 warning 與官方連結", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new Error("No network"))));
    const result = await searchPtLaws("執業");
    expect(result.warning).toBeDefined();
    expect(result.source_url).toMatch(/law\.moj\.gov\.tw/);
    vi.unstubAllGlobals();
  });
});

describe("searchPtLaws — 格式驗證", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("每筆結果應有 title 和 summary", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new Error("No network"))));
    const result = await searchPtLaws("業務範圍");
    for (const item of result.results) {
      expect(item).toHaveProperty("title");
      expect(item).toHaveProperty("summary");
      expect(item.title.length).toBeGreaterThan(0);
      expect(item.summary.length).toBeGreaterThan(0);
    }
  });
});
