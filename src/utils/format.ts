/**
 * 統一工具回傳格式（JSON-RPC 2.0 compatible）
 * Taiwan PT MCP — format.ts
 */

export interface EvidenceResult {
  title: string;
  summary: string;
  authors?: string[];
  doi?: string;
  pmid?: string;
  year?: number;
  journal?: string;
  url?: string;
  pedro_score?: number;   // PEDro 10分量表分數
  evidence_level?: string; // e.g. "Level 1a — Systematic Review"
}

export interface ToolResponse {
  source: string;           // 資料庫名稱（中文）
  source_url: string;       // 資料庫首頁
  query_time: string;       // ISO8601 查詢時間
  total_found: number;
  results: EvidenceResult[];
  warning?: string;         // 紅旗預警或免責聲明
  error?: string;           // 若查詢失敗的說明
}

/**
 * 建構標準回傳物件
 */
export function buildResponse(
  source: string,
  source_url: string,
  results: EvidenceResult[],
  opts: { warning?: string; error?: string } = {}
): ToolResponse {
  return {
    source,
    source_url,
    query_time: new Date().toISOString(),
    total_found: results.length,
    results,
    ...(opts.warning ? { warning: opts.warning } : {}),
    ...(opts.error ? { error: opts.error } : {}),
  };
}

/**
 * 截斷過長文字，確保 JSON payload 不超過 MCP 限制
 */
export function truncate(text: string | undefined, maxLen = 400): string {
  if (!text) return "";
  return text.length > maxLen ? text.slice(0, maxLen) + "…" : text;
}

/**
 * 從 PubMed authors array 轉為顯示字串
 */
export function formatAuthors(
  authors: Array<{ name: string }> | undefined,
  max = 3
): string[] {
  if (!authors) return [];
  const names = authors.slice(0, max).map((a) => a.name);
  if (authors.length > max) names.push(`et al. (共 ${authors.length} 人)`);
  return names;
}
