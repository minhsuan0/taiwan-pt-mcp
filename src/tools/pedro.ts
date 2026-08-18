/**
 * search_pedro_evidence
 *
 * 查詢 PEDro (Physiotherapy Evidence Database) 物理治療實證資料庫。
 * PEDro 無公開 REST API，改用 PubMed E-utilities 查詢物理治療 RCT，
 * 並標示 PubMed 的 Clinical Trial publication type，提供 DOI 連結。
 *
 * 備援：若 PubMed 無法連線，回傳 PEDro 搜尋連結供使用者自行查詢。
 */

import { getJson } from "../utils/http.js";
import {
  buildResponse,
  formatAuthors,
  truncate,
  type EvidenceResult,
} from "../utils/format.js";

const PUBMED_ESEARCH = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi";
const PUBMED_ESUMMARY = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi";
const PUBMED_EFETCH = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi";
const PEDRO_SEARCH_URL = "https://pedro.org.au/english/search/";

interface ESearchResult {
  esearchresult: {
    count: string;
    idlist: string[];
  };
}

interface ESummaryResult {
  result: {
    uids: string[];
    [pmid: string]: unknown;
  };
}

interface ArticleSummary {
  uid: string;
  pubdate: string;
  epubdate: string;
  source: string;
  title: string;
  authors: Array<{ name: string; authtype: string }>;
  elocationid: string; // DOI
  fulljournalname?: string;
}

/**
 * 主要查詢函式
 * @param query - 查詢關鍵詞（中英文皆可）
 * @param maxResults - 最多回傳幾筆（預設 5）
 */
export async function searchPedroEvidence(query: string, maxResults = 5) {
  // 建立 PubMed 查詢：限制在 Randomized Controlled Trial + Physical Therapy
  const fullQuery = `(${query}) AND (physical therapy[MeSH] OR physiotherapy OR rehabilitation OR exercise therapy) AND (randomized controlled trial[pt] OR systematic review[pt] OR meta-analysis[pt])`;
  const pedroFallbackUrl = `${PEDRO_SEARCH_URL}?topic=&title=&abstract=&authors=&source=&dosage=&subdosage=&method=0&search-language=0&keyword=${encodeURIComponent(query)}&year_from=&year_to=&search=Search`;

  try {
    // Step 1: esearch → 取得 PMID 列表
    const searchUrl = `${PUBMED_ESEARCH}?db=pubmed&term=${encodeURIComponent(fullQuery)}&retmax=${maxResults}&retmode=json&sort=relevance`;
    const searchData = await getJson<ESearchResult>(searchUrl);
    const ids = searchData.esearchresult?.idlist ?? [];

    if (ids.length === 0) {
      return buildResponse(
        "PubMed（PEDro 備援）",
        "https://pubmed.ncbi.nlm.nih.gov/",
        [],
        {
          warning:
            `查無結果。請直接至 PEDro 資料庫搜尋：${pedroFallbackUrl}`,
        }
      );
    }

    // Step 2: esummary → 取得文章摘要資訊
    const summaryUrl = `${PUBMED_ESUMMARY}?db=pubmed&id=${ids.join(",")}&retmode=json`;
    const summaryData = await getJson<ESummaryResult>(summaryUrl);

    const results: EvidenceResult[] = ids
      .map((pmid): EvidenceResult | null => {
        const art = summaryData.result[pmid] as ArticleSummary | undefined;
        if (!art) return null;

        const year = parseInt(art.pubdate?.split(" ")[0] ?? "0", 10) || undefined;
        const doi = art.elocationid?.startsWith("10.")
          ? art.elocationid.replace(/^doi:\s*/i, "").trim()
          : undefined;

        return {
          title: truncate(art.title, 200),
          summary: `發表於：${art.fulljournalname ?? art.source}`,
          authors: formatAuthors(art.authors),
          doi,
          pmid,
          year,
          journal: art.fulljournalname ?? art.source,
          url: doi
            ? `https://doi.org/${doi}`
            : `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`,
          evidence_level: "RCT / Systematic Review / Meta-analysis（經 PubMed 篩選）",
        };
      })
      .filter((r): r is EvidenceResult => r !== null);

    return buildResponse(
      "PubMed（PEDro 備援查詢）",
      "https://pubmed.ncbi.nlm.nih.gov/",
      results,
      {
        warning:
          `⚠️ PEDro 目前無公開 REST API。本結果來自 PubMed（RCT/SR/MA 篩選）。\n` +
          `如需完整 PEDro 評分，請至：${pedroFallbackUrl}`,
      }
    );
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    return buildResponse("PubMed", "https://pubmed.ncbi.nlm.nih.gov/", [], {
      error: `查詢失敗：${errMsg}`,
      warning: `請手動至 PEDro 查詢：${pedroFallbackUrl}`,
    });
  }
}
