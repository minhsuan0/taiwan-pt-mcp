/**
 * 測試：search_anatomy_biomechanics
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { searchAnatomyBiomechanics } from "../src/tools/anatomy.js";

describe("searchAnatomyBiomechanics — 靜態詞典匹配", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("查詢 'rotator cuff' 應回傳靜態解剖定義", async () => {
    // 允許網路（PubMed），主要驗證靜態路徑
    vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new Error("No network"))));
    const result = await searchAnatomyBiomechanics("rotator cuff", 0);

    expect(result.results.length).toBeGreaterThan(0);
    const first = result.results[0];
    expect(first.title).toContain("旋轉肌群");
    expect(first.summary).toContain("功能");
    expect(first.summary).toContain("神經支配");
    expect(first.summary).toContain("臨床意義");
  });

  it("查詢 '臀中肌' 應回傳步態穩定相關資訊", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new Error("No network"))));
    const result = await searchAnatomyBiomechanics("臀中肌", 0);
    expect(result.results[0].summary).toContain("Trendelenburg");
  });

  it("查詢 '腰椎' 應包含紅旗徵兆資訊", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new Error("No network"))));
    const result = await searchAnatomyBiomechanics("腰椎", 0);
    const combined = result.results.map((r) => r.summary).join(" ");
    expect(combined).toMatch(/馬尾|紅旗|SLR/);
  });

  it("查詢 'knee' 應回傳膝關節資訊", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new Error("No network"))));
    const result = await searchAnatomyBiomechanics("knee", 0);
    expect(result.results.length).toBeGreaterThan(0);
  });

  it("未知詞彙應回傳提示訊息而非 crash", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new Error("No network"))));
    const result = await searchAnatomyBiomechanics("xyzunknownmuscle999", 0);
    expect(result).toHaveProperty("results");
    expect(result.results.length).toBeGreaterThan(0);
    expect(result.results[0].title).toContain("無直接匹配");
  });
});

describe("searchAnatomyBiomechanics — 格式驗證", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("回傳應符合 ToolResponse 結構", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new Error("No network"))));
    const result = await searchAnatomyBiomechanics("shoulder", 0);
    expect(result).toHaveProperty("source");
    expect(result).toHaveProperty("source_url");
    expect(result).toHaveProperty("query_time");
    expect(result).toHaveProperty("total_found");
    expect(result).toHaveProperty("results");
    expect(result).toHaveProperty("warning");
  });
});
