/**
 * DOI 解析驗證測試 — 針對 extractDoi 修復的完整覆蓋
 *
 * 驗證目標：
 * 1. PubMed 回傳的各種 elocationid 格式都能正確提取 DOI
 * 2. 產出的文獻連結 (https://doi.org/xxx) 與論文實際對應
 * 3. Mock 測試使用 URL 路由而非 callCount
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { searchPedroEvidence } from "../src/tools/pedro.js";
import { searchCpgGuidelines } from "../src/tools/cpg.js";
import { searchAnatomyBiomechanics } from "../src/tools/anatomy.js";

// ─── 直接測試 extractDoi 的各種 PubMed 格式 ─────────────────────────────────
describe("extractDoi — PubMed elocationid 格式覆蓋", () => {
  // 直接 import 測試 extractDoi
  let extractDoi: (elocationid?: string) => string | undefined;
  let parseYear: (pubdate?: string) => number | undefined;
  let buildArticleUrl: (doi?: string, pmid?: string) => string;

  it("載入共用模組", async () => {
    const mod = await import("../src/utils/pubmed.js");
    extractDoi = mod.extractDoi;
    parseYear = mod.parseYear;
    buildArticleUrl = mod.buildArticleUrl;
  });

  it("格式 1: 純 DOI（10.xxxx/yyyy）", () => {
    expect(extractDoi("10.1093/ptj/pzae123")).toBe("10.1093/ptj/pzae123");
  });

  it("格式 2: 帶 doi: 前綴（doi: 10.xxxx/yyyy）— 舊版 bug 的核心場景", () => {
    // 這是修復前會被丟棄的格式
    expect(extractDoi("doi: 10.1093/ptj/pzae123")).toBe("10.1093/ptj/pzae123");
  });

  it("格式 3: 帶 doi: 前綴大小寫混合（DOI: 10.xxxx）", () => {
    expect(extractDoi("DOI: 10.1016/j.apmr.2023.01.001")).toBe("10.1016/j.apmr.2023.01.001");
  });

  it("格式 4: doi: 後有多餘空格", () => {
    expect(extractDoi("doi:  10.1234/test")).toBe("10.1234/test");
  });

  it("格式 5: pii 格式（非 DOI）應回傳 undefined", () => {
    // PubMed 有時回傳 pii 格式，不是 DOI
    expect(extractDoi("S0003-9993(23)00456-7")).toBeUndefined();
  });

  it("格式 6: 空字串應回傳 undefined", () => {
    expect(extractDoi("")).toBeUndefined();
  });

  it("格式 7: undefined 應回傳 undefined", () => {
    expect(extractDoi(undefined)).toBeUndefined();
  });

  it("格式 8: 純文字（無 DOI）應回傳 undefined", () => {
    expect(extractDoi("pmid:12345678")).toBeUndefined();
  });
});

describe("parseYear — 年份解析", () => {
  let parseYear: (pubdate?: string) => number | undefined;

  it("載入共用模組", async () => {
    const mod = await import("../src/utils/pubmed.js");
    parseYear = mod.parseYear;
  });

  it("標準格式 '2024 Mar' → 2024", () => {
    expect(parseYear("2024 Mar")).toBe(2024);
  });

  it("只有年份 '2023' → 2023", () => {
    expect(parseYear("2023")).toBe(2023);
  });

  it("異常格式 'Mar 2024'（月在前）→ undefined", () => {
    expect(parseYear("Mar 2024")).toBeUndefined();
  });

  it("空字串 → undefined", () => {
    expect(parseYear("")).toBeUndefined();
  });

  it("不合理年份 '1' → undefined", () => {
    expect(parseYear("1")).toBeUndefined();
  });
});

describe("buildArticleUrl — 文獻連結產出", () => {
  let buildArticleUrl: (doi?: string, pmid?: string) => string;

  it("載入共用模組", async () => {
    const mod = await import("../src/utils/pubmed.js");
    buildArticleUrl = mod.buildArticleUrl;
  });

  it("有 DOI 時應產出 doi.org 連結", () => {
    expect(buildArticleUrl("10.1093/ptj/pzae123", "12345678"))
      .toBe("https://doi.org/10.1093/ptj/pzae123");
  });

  it("無 DOI 但有 PMID 時應產出 pubmed 連結", () => {
    expect(buildArticleUrl(undefined, "12345678"))
      .toBe("https://pubmed.ncbi.nlm.nih.gov/12345678/");
  });

  it("DOI 優先於 PMID", () => {
    const url = buildArticleUrl("10.1234/test", "99999");
    expect(url).toContain("doi.org");
    expect(url).not.toContain("pubmed");
  });
});

// ─── Pedro Mock 測試：驗證 DOI 在完整流程中被正確解析 ─────────────────────────
describe("searchPedroEvidence — DOI 解析端到端驗證 (mock)", () => {
  afterEach(() => vi.unstubAllGlobals());

  // 模擬 PubMed 回傳「doi: 」前綴的格式（修復前會失敗的場景）
  it("elocationid 為 'doi: 10.xxxx' 格式時，DOI 與 URL 應正確", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string | URL | Request) => {
        const urlStr = typeof url === "string" ? url : url.toString();
        if (urlStr.includes("esummary")) {
          return {
            ok: true, status: 200,
            json: async () => ({
              result: {
                uids: ["38000001"],
                "38000001": {
                  uid: "38000001",
                  pubdate: "2024 May",
                  source: "Phys Ther",
                  title: "Exercise therapy for rotator cuff tendinopathy: RCT",
                  authors: [{ name: "Wang YC" }],
                  // 關鍵：帶 "doi: " 前綴的格式
                  elocationid: "doi: 10.1093/ptj/pzae050",
                  fulljournalname: "Physical Therapy",
                },
              },
            }),
            headers: { get: () => null },
          } as unknown as Response;
        }
        // esearch
        return {
          ok: true, status: 200,
          json: async () => ({
            esearchresult: { count: "1", idlist: ["38000001"] },
          }),
          headers: { get: () => null },
        } as unknown as Response;
      })
    );

    const result = await searchPedroEvidence("rotator cuff", 1);

    expect(result.total_found).toBe(1);
    const article = result.results[0];
    // DOI 應被正確提取（去掉 "doi: " 前綴）
    expect(article.doi).toBe("10.1093/ptj/pzae050");
    // URL 應指向 doi.org
    expect(article.url).toBe("https://doi.org/10.1093/ptj/pzae050");
    // 其他欄位
    expect(article.year).toBe(2024);
    expect(article.title).toContain("rotator cuff");
  });

  // 模擬 pii 格式（非 DOI），應 fallback 到 PubMed 連結
  it("elocationid 為 pii 格式時，應 fallback 到 PubMed 連結", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string | URL | Request) => {
        const urlStr = typeof url === "string" ? url : url.toString();
        if (urlStr.includes("esummary")) {
          return {
            ok: true, status: 200,
            json: async () => ({
              result: {
                uids: ["38000002"],
                "38000002": {
                  uid: "38000002",
                  pubdate: "2023 Nov",
                  source: "Arch Phys Med Rehabil",
                  title: "Knee OA rehabilitation outcomes",
                  authors: [{ name: "Chen HL" }],
                  // pii 格式，非 DOI
                  elocationid: "S0003-9993(23)00456-7",
                  fulljournalname: "Archives of Physical Medicine and Rehabilitation",
                },
              },
            }),
            headers: { get: () => null },
          } as unknown as Response;
        }
        return {
          ok: true, status: 200,
          json: async () => ({
            esearchresult: { count: "1", idlist: ["38000002"] },
          }),
          headers: { get: () => null },
        } as unknown as Response;
      })
    );

    const result = await searchPedroEvidence("knee OA", 1);

    const article = result.results[0];
    // DOI 應為 undefined（pii 不是 DOI）
    expect(article.doi).toBeUndefined();
    // URL 應 fallback 到 PubMed
    expect(article.url).toBe("https://pubmed.ncbi.nlm.nih.gov/38000002/");
  });
});

// ─── CPG Mock 測試：URL 路由 + DOI 驗證 ──────────────────────────────────────
describe("searchCpgGuidelines — DOI 解析端到端驗證 (mock)", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("帶 'doi:' 前綴的 CPG 文獻應正確解析 DOI 與連結", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string | URL | Request) => {
        const urlStr = typeof url === "string" ? url : url.toString();
        if (urlStr.includes("esummary")) {
          return {
            ok: true, status: 200,
            json: async () => ({
              result: {
                uids: ["37500001"],
                "37500001": {
                  uid: "37500001",
                  pubdate: "2023 Jun",
                  source: "J Orthop Sports Phys Ther",
                  title: "CPG: Management of Achilles Tendinopathy",
                  authors: [{ name: "Martin RL" }, { name: "Chimenti R" }],
                  elocationid: "doi: 10.2519/jospt.2023.0302",
                  fulljournalname: "Journal of Orthopaedic & Sports Physical Therapy",
                },
              },
            }),
            headers: { get: () => null },
          } as unknown as Response;
        }
        return {
          ok: true, status: 200,
          json: async () => ({
            esearchresult: { count: "1", idlist: ["37500001"] },
          }),
          headers: { get: () => null },
        } as unknown as Response;
      })
    );

    const result = await searchCpgGuidelines("achilles tendinopathy", "ankle", 1);

    expect(result.total_found).toBe(1);
    const article = result.results[0];
    expect(article.doi).toBe("10.2519/jospt.2023.0302");
    expect(article.url).toBe("https://doi.org/10.2519/jospt.2023.0302");
    expect(article.title).toContain("Achilles");
  });
});

// ─── 整合測試：用真實 PubMed 回傳驗證 DOI 連結格式 ───────────────────────────
describe("DOI 連結格式 — 整合驗證（真實 PubMed API）", () => {
  it("Pedro: 所有回傳結果的 url 應為合法 https 連結", async () => {
    const result = await searchPedroEvidence("low back pain core stability", 3);
    for (const article of result.results) {
      expect(article.url).toMatch(/^https:\/\/(doi\.org\/10\.|pubmed\.ncbi\.nlm\.nih\.gov\/)/);
      // 若有 DOI，URL 應包含該 DOI
      if (article.doi) {
        expect(article.url).toBe(`https://doi.org/${article.doi}`);
        // DOI 不應還帶有 "doi:" 前綴
        expect(article.doi).not.toMatch(/^doi:/i);
        expect(article.doi).toMatch(/^10\./);
      }
    }
  }, 20_000);

  it("CPG: 所有回傳結果的 url 應為合法 https 連結", async () => {
    const result = await searchCpgGuidelines("low back pain", "lumbar spine", 3);
    for (const article of result.results) {
      expect(article.url).toMatch(/^https:\/\/(doi\.org\/10\.|pubmed\.ncbi\.nlm\.nih\.gov\/)/);
      if (article.doi) {
        expect(article.url).toBe(`https://doi.org/${article.doi}`);
        expect(article.doi).not.toMatch(/^doi:/i);
        expect(article.doi).toMatch(/^10\./);
      }
    }
  }, 20_000);

  it("Anatomy: 靜態 + PubMed 結果的 url 應為合法連結", async () => {
    const result = await searchAnatomyBiomechanics("rotator cuff", 2);
    for (const article of result.results) {
      expect(article.url).toMatch(/^https:\/\//);
      if (article.doi) {
        expect(article.url).toBe(`https://doi.org/${article.doi}`);
        expect(article.doi).not.toMatch(/^doi:/i);
      }
    }
  }, 20_000);
});
