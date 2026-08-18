/**
 * search_cpg_guidelines
 *
 * 查詢臨床實踐指南（Clinical Practice Guidelines）。
 * 資料來源：
 *   1. PubMed — 篩選 "Practice Guideline" publication type
 *   2. OpenAlex（若網路允許）— 全文搜尋指南
 *
 * 備援連結：
 *   - GIN (Guidelines International Network): https://g-i-n.net/
 *   - NGC (National Guideline Clearinghouse 已停用) → AHRQ 指南
 *   - 台灣實證醫學學會: https://www.ebmta.org.tw/
 *   - 台灣物理治療學會: https://www.twpta.org.tw/
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

interface ESearchResult {
  esearchresult: { count: string; idlist: string[] };
}
interface ESummaryResult {
  result: { uids: string[]; [pmid: string]: unknown };
}
interface ArticleSummary {
  uid: string;
  pubdate: string;
  source: string;
  title: string;
  authors: Array<{ name: string }>;
  elocationid: string;
  fulljournalname?: string;
}

/**
 * @param condition   - 疾患名稱，例如 "rotator cuff", "低背痛", "anterior cruciate ligament"
 * @param body_region - 身體部位，例如 "shoulder", "lumbar spine", "knee"
 * @param maxResults  - 最多回傳筆數（預設 5）
 */
export async function searchCpgGuidelines(
  condition: string,
  body_region: string,
  maxResults = 5
) {
  const twGuidelines = [
    "台灣物理治療學會 (TWPTA): https://www.twpta.org.tw/",
    "台灣實證醫學學會: https://www.ebmta.org.tw/",
    "GIN (Guidelines International Network): https://g-i-n.net/",
    "NICE Guidelines: https://www.nice.org.uk/guidance",
    "APTA (American Physical Therapy Association) CPG: https://www.apta.org/patient-care/evidence-based-practice-resources/cpg/",
  ];

  const combinedQuery = `(${condition}) AND (${body_region}) AND (clinical practice guideline OR guideline OR CPG) AND (physical therapy OR physiotherapy OR rehabilitation)`;

  try {
    const searchUrl =
      `${PUBMED_ESEARCH}?db=pubmed` +
      `&term=${encodeURIComponent(combinedQuery)}` +
      `&retmax=${maxResults}&retmode=json&sort=relevance` +
      `&filter=pubt.practiceguideline`;

    const searchData = await getJson<ESearchResult>(searchUrl);
    const ids = searchData.esearchresult?.idlist ?? [];

    // 若 Practice Guideline filter 無結果，放寬條件
    let finalIds = ids;
    if (ids.length === 0) {
      const fallbackUrl =
        `${PUBMED_ESEARCH}?db=pubmed` +
        `&term=${encodeURIComponent(
          `(${condition}) AND (${body_region}) AND (guideline OR CPG OR systematic review) AND (physical therapy OR physiotherapy)`
        )}&retmax=${maxResults}&retmode=json&sort=relevance`;
      const fallback = await getJson<ESearchResult>(fallbackUrl);
      finalIds = fallback.esearchresult?.idlist ?? [];
    }

    if (finalIds.length === 0) {
      return buildResponse(
        "PubMed CPG 查詢",
        "https://pubmed.ncbi.nlm.nih.gov/",
        [],
        {
          warning:
            `查無結果。建議至以下資源查詢：\n${twGuidelines.join("\n")}`,
        }
      );
    }

    const summaryUrl = `${PUBMED_ESUMMARY}?db=pubmed&id=${finalIds.join(",")}&retmode=json`;
    const summaryData = await getJson<ESummaryResult>(summaryUrl);

    const results: EvidenceResult[] = finalIds
      .map((pmid): EvidenceResult | null => {
        const art = summaryData.result[pmid] as ArticleSummary | undefined;
        if (!art) return null;
        const year = parseInt(art.pubdate?.split(" ")[0] ?? "0", 10) || undefined;
        const doi = art.elocationid?.startsWith("10.")
          ? art.elocationid.replace(/^doi:\s*/i, "").trim()
          : undefined;

        return {
          title: truncate(art.title, 200),
          summary: `${art.fulljournalname ?? art.source}｜CPG / 臨床指南`,
          authors: formatAuthors(art.authors),
          doi,
          pmid,
          year,
          journal: art.fulljournalname ?? art.source,
          url: doi
            ? `https://doi.org/${doi}`
            : `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`,
          evidence_level: "Clinical Practice Guideline / Systematic Review",
        };
      })
      .filter((r): r is EvidenceResult => r !== null);

    return buildResponse(
      "PubMed 臨床實踐指南（CPG）",
      "https://pubmed.ncbi.nlm.nih.gov/",
      results,
      {
        warning:
          `📋 額外指南資源：\n${twGuidelines.join("\n")}`,
      }
    );
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    return buildResponse("PubMed CPG", "https://pubmed.ncbi.nlm.nih.gov/", [], {
      error: `查詢失敗：${errMsg}`,
      warning: `請手動查詢：\n${twGuidelines.join("\n")}`,
    });
  }
}
