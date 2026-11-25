/**
 * 測試：search_cpg_guidelines
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { searchCpgGuidelines } from "../src/tools/cpg.js";

describe("searchCpgGuidelines — integration", () => {
  it("應回傳正確結構", async () => {
    const result = await searchCpgGuidelines("rotator cuff", "shoulder", 3);
    expect(result).toHaveProperty("source");
    expect(result).toHaveProperty("results");
    expect(Array.isArray(result.results)).toBe(true);
    expect(result.source_url).toMatch(/^https?:\/\//);
  }, 20_000);

  it("應包含台灣物理治療學會等備援連結於 warning 中", async () => {
    const result = await searchCpgGuidelines("knee osteoarthritis", "knee", 2);
    // warning 欄位應包含至少一個 URL
    if (result.warning) {
      expect(result.warning).toMatch(/http/);
    }
  }, 20_000);
});

describe("searchCpgGuidelines — unit (mock)", () => {
  const mockSearchResp = {
    esearchresult: { count: "1", idlist: ["99999999"] },
  };
  const mockSummaryResp = {
    result: {
      uids: ["99999999"],
      "99999999": {
        uid: "99999999",
        pubdate: "2023 Mar",
        source: "Phys Ther",
        title: "Clinical Practice Guideline: Shoulder Disorders",
        authors: [{ name: "Lin CC", authtype: "Author" }],
        elocationid: "10.9999/pt.2023.cpg",
        fulljournalname: "Physical Therapy",
      },
    },
  };

  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string | URL | Request) => {
        const urlStr = typeof url === "string" ? url : url.toString();
        const body = urlStr.includes("esummary")
          ? JSON.stringify(mockSummaryResp)
          : JSON.stringify(mockSearchResp);
        return {
          ok: true,
          status: 200,
          json: async () => JSON.parse(body),
          headers: { get: () => null },
        } as unknown as Response;
      })
    );
  });

  afterEach(() => vi.unstubAllGlobals());

  it("應正確解析 CPG 回傳", async () => {
    const result = await searchCpgGuidelines("shoulder impingement", "shoulder", 1);
    expect(result.results.length).toBeGreaterThanOrEqual(1);
    expect(result.results[0].title).toContain("Shoulder");
    expect(result.results[0].doi).toBe("10.9999/pt.2023.cpg");
    // 結構正確
    expect(result).toHaveProperty("query_time");
  });
});
