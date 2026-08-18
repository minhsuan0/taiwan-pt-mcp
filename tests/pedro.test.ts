/**
 * 測試：search_pedro_evidence
 * 使用 vitest + 真實 PubMed API（整合測試）
 * 使用 vitest mock 替代（單元測試）
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { searchPedroEvidence } from "../src/tools/pedro.js";

// ─── 整合測試（需要網路）─────────────────────────────────────────────────────
describe("searchPedroEvidence — integration", () => {
  it("應回傳正確格式的 ToolResponse", async () => {
    const result = await searchPedroEvidence("rotator cuff exercise", 3);

    // 結構驗證
    expect(result).toHaveProperty("source");
    expect(result).toHaveProperty("source_url");
    expect(result).toHaveProperty("query_time");
    expect(result).toHaveProperty("total_found");
    expect(result).toHaveProperty("results");
    expect(Array.isArray(result.results)).toBe(true);
    expect(typeof result.total_found).toBe("number");
    expect(result.source_url).toMatch(/^https?:\/\//);
    // query_time 應為合法 ISO8601
    expect(() => new Date(result.query_time)).not.toThrow();
  }, 20_000);

  it("每筆結果應包含 title 和 summary", async () => {
    const result = await searchPedroEvidence("knee osteoarthritis exercise", 2);
    for (const item of result.results) {
      expect(item).toHaveProperty("title");
      expect(item).toHaveProperty("summary");
      expect(typeof item.title).toBe("string");
      expect(item.title.length).toBeGreaterThan(0);
    }
  }, 20_000);
});

// ─── 單元測試（mock fetch）──────────────────────────────────────────────────
describe("searchPedroEvidence — unit (mock)", () => {
  const mockEsearchResponse = {
    esearchresult: {
      count: "1",
      idlist: ["12345678"],
    },
  };

  const mockEsummaryResponse = {
    result: {
      uids: ["12345678"],
      "12345678": {
        uid: "12345678",
        pubdate: "2024 Jan",
        epubdate: "2024 Jan 01",
        source: "J Phys Ther",
        title: "Effects of exercise on rotator cuff: a randomized controlled trial",
        authors: [{ name: "Chen TW", authtype: "Author" }],
        elocationid: "10.1234/jpt.2024.001",
        fulljournalname: "Journal of Physical Therapy Science",
      },
    },
  };

  beforeEach(() => {
    let callCount = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        callCount++;
        const body =
          callCount === 1
            ? JSON.stringify(mockEsearchResponse)
            : JSON.stringify(mockEsummaryResponse);
        return {
          ok: true,
          status: 200,
          json: async () => JSON.parse(body),
          headers: { get: () => null },
        } as unknown as Response;
      })
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("應正確解析 mock 回傳並產出 ToolResponse", async () => {
    const result = await searchPedroEvidence("rotator cuff", 1);

    expect(result.total_found).toBe(1);
    expect(result.results[0].title).toContain("rotator cuff");
    expect(result.results[0].doi).toBe("10.1234/jpt.2024.001");
    expect(result.results[0].url).toBe("https://doi.org/10.1234/jpt.2024.001");
    expect(result.results[0].year).toBe(2024);
    expect(result.results[0].journal).toBe("Journal of Physical Therapy Science");
  });

  it("查無結果時應回傳 warning 而非 error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          esearchresult: { count: "0", idlist: [] },
        }),
        headers: { get: () => null },
      }))
    );

    const result = await searchPedroEvidence("xyznonexistentquery123", 1);
    expect(result.total_found).toBe(0);
    expect(result.results).toHaveLength(0);
    expect(result.warning).toBeDefined();
  });
});
