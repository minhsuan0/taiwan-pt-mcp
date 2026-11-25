/**
 * PubMed E-utilities 共用模組
 * Taiwan PT MCP — pubmed.ts
 *
 * 統一 PubMed 相關的常數、介面、與查詢邏輯，
 * 避免在各工具檔中重複定義。
 */

import { getJson } from "./http.js";

// ─── 常數 ─────────────────────────────────────────────────────────────────────
export const PUBMED_ESEARCH =
  "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi";
export const PUBMED_ESUMMARY =
  "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi";

// ─── NCBI API Key（提高 rate limit：3 req/s → 10 req/s）──────────────────────
const NCBI_API_KEY = process.env.NCBI_API_KEY ?? "";

/**
 * 若有設定 NCBI_API_KEY，附加到 URL query string
 */
export function appendApiKey(url: string): string {
  if (!NCBI_API_KEY) return url;
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}api_key=${encodeURIComponent(NCBI_API_KEY)}`;
}

// ─── PubMed 回傳介面 ──────────────────────────────────────────────────────────
export interface ESearchResult {
  esearchresult: {
    count: string;
    idlist: string[];
  };
}

export interface ESummaryResult {
  result: {
    uids: string[];
    [pmid: string]: unknown;
  };
}

export interface ArticleSummary {
  uid: string;
  pubdate: string;
  epubdate?: string;
  source: string;
  title: string;
  authors: Array<{ name: string; authtype?: string }>;
  elocationid: string;
  fulljournalname?: string;
}

// ─── 共用查詢函式 ──────────────────────────────────────────────────────────────

/**
 * PubMed esearch: 搜尋 → 取得 PMID 列表
 */
export async function pubmedSearch(
  query: string,
  maxResults: number,
  extraParams = ""
): Promise<string[]> {
  const url = appendApiKey(
    `${PUBMED_ESEARCH}?db=pubmed` +
      `&term=${encodeURIComponent(query)}` +
      `&retmax=${maxResults}&retmode=json&sort=relevance` +
      extraParams
  );
  const data = await getJson<ESearchResult>(url);
  return data.esearchresult?.idlist ?? [];
}

/**
 * PubMed esummary: 批次取得文章摘要
 */
export async function pubmedSummary(
  ids: string[]
): Promise<Record<string, ArticleSummary>> {
  if (ids.length === 0) return {};
  const url = appendApiKey(
    `${PUBMED_ESUMMARY}?db=pubmed&id=${ids.join(",")}&retmode=json`
  );
  const data = await getJson<ESummaryResult>(url);

  const result: Record<string, ArticleSummary> = {};
  for (const pmid of ids) {
    const art = data.result[pmid] as ArticleSummary | undefined;
    if (art) result[pmid] = art;
  }
  return result;
}

// ─── DOI 提取 ──────────────────────────────────────────────────────────────────

/**
 * 從 PubMed ESummary 的 elocationid 欄位提取 DOI。
 * PubMed 回傳格式可能為 "10.xxxx/yyyy" 或 "doi: 10.xxxx/yyyy"，
 * 此函式統一處理兩種格式。
 */
export function extractDoi(elocationid?: string): string | undefined {
  if (!elocationid) return undefined;
  const raw = elocationid.replace(/^doi:\s*/i, "").trim();
  return raw.startsWith("10.") ? raw : undefined;
}

/**
 * 從 pubdate 欄位解析年份（PubMed 通常回傳 "2024 Mar" 格式）
 */
export function parseYear(pubdate?: string): number | undefined {
  if (!pubdate) return undefined;
  const year = parseInt(pubdate.split(" ")[0] ?? "0", 10);
  return year >= 1900 && year <= 2100 ? year : undefined;
}

/**
 * 從 DOI 或 PMID 產生文獻連結
 */
export function buildArticleUrl(doi?: string, pmid?: string): string {
  if (doi) return `https://doi.org/${doi}`;
  if (pmid) return `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`;
  return "https://pubmed.ncbi.nlm.nih.gov/";
}
