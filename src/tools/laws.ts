/**
 * search_pt_laws
 *
 * 查詢台灣《物理治療師法》及相關施行細則。
 *
 * 資料來源：全國法規資料庫 (law.moj.gov.tw)
 * API 端點：https://law.moj.gov.tw/api/laws/{pcode}/articles
 *
 * 物理治療師法 pCode: L0020003
 * 物理治療師法施行細則 pCode: L0020004
 *
 * 若 API 不可用（在 sandbox 環境中），回傳官方連結與靜態條文摘要。
 */

import { getJson } from "../utils/http.js";
import { buildResponse, type EvidenceResult } from "../utils/format.js";

const MOJ_API_BASE = "https://law.moj.gov.tw/api";
const PT_LAW_PCODE = "L0020003";
const PT_LAW_RULE_PCODE = "L0020004";

// 靜態摘要：物理治療師法核心條文（確保離線亦可查詢）
const STATIC_PT_LAW_ARTICLES: Record<string, { article: string; content: string }> = {
  第1條: {
    article: "第 1 條",
    content:
      "中華民國人民經物理治療師考試及格，並依本法領有物理治療師證書者，得充物理治療師。",
  },
  第12條: {
    article: "第 12 條",
    content:
      "物理治療師執行業務，應依醫師開具之診斷或醫囑，提供物理治療評估及治療。" +
      "但緊急情況時，可先給予必要之物理治療，再申請補具醫囑。",
  },
  第13條: {
    article: "第 13 條",
    content:
      "物理治療師之業務範圍如下：" +
      "一、物理治療之評估及測試。" +
      "二、電、熱、光、水、冷、機械等物理性治療。" +
      "三、運動及運動訓練。" +
      "四、輔具之評估及使用訓練。" +
      "五、其他物理治療業務。",
  },
  第14條: {
    article: "第 14 條",
    content:
      "物理治療師不得為醫療診斷，其業務範圍以物理治療評估與治療為限。",
  },
  第24條: {
    article: "第 24 條",
    content:
      "物理治療師不得同時在兩所以上機構執業，但機構間之支援或協助，不在此限。",
  },
};

// 關鍵字對應常見條文
const KEYWORD_MAP: Record<string, string[]> = {
  業務: ["第12條", "第13條"],
  診斷: ["第12條", "第14條"],
  醫囑: ["第12條"],
  評估: ["第12條", "第13條"],
  "執業": ["第24條"],
  資格: ["第1條"],
  治療: ["第12條", "第13條"],
  禁忌: ["第14條"],
  範圍: ["第13條", "第14條"],
  訓練: ["第13條"],
};

interface MojArticle {
  ArticleNo: string;
  ArticleContent: string;
}

interface MojLawResponse {
  laws?: Array<{
    LawArticles?: { Article?: MojArticle[] };
  }>;
}

/**
 * @param keyword - 查詢關鍵詞，例如 "業務範圍", "醫囑", "執業"
 */
export async function searchPtLaws(keyword: string) {
  const officialUrl = `https://law.moj.gov.tw/LawClass/LawAll.aspx?pcode=${PT_LAW_PCODE}`;
  const ruleUrl = `https://law.moj.gov.tw/LawClass/LawAll.aspx?pcode=${PT_LAW_RULE_PCODE}`;

  // 先嘗試靜態關鍵字匹配
  const matchedKeys = Object.keys(KEYWORD_MAP).filter((k) =>
    keyword.includes(k)
  );
  const matchedArticleIds = [
    ...new Set(matchedKeys.flatMap((k) => KEYWORD_MAP[k])),
  ];

  const staticResults: EvidenceResult[] = matchedArticleIds
    .map((id) => STATIC_PT_LAW_ARTICLES[id])
    .filter(Boolean)
    .map((a) => ({
      title: `《物理治療師法》${a.article}`,
      summary: a.content,
      url: officialUrl,
      evidence_level: "台灣法規（全國法規資料庫）",
    }));

  // 嘗試呼叫全國法規 API（dynamic query）
  try {
    // 注意：法規 API 路徑以 LawID 為主，keyword 搜尋需用搜尋 endpoint
    const searchUrl =
      `${MOJ_API_BASE}/laws` +
      `?keyword=${encodeURIComponent("物理治療師")}` +
      `&page=1&pageSize=5`;

    const data = await getJson<MojLawResponse>(searchUrl, { timeoutMs: 8000 });

    const dynamicResults: EvidenceResult[] = [];

    if (data?.laws && Array.isArray(data.laws)) {
      for (const law of data.laws) {
        const articles = law.LawArticles?.Article ?? [];
        for (const art of articles) {
          if (
            art.ArticleContent?.includes(keyword) ||
            art.ArticleNo?.includes(keyword)
          ) {
            dynamicResults.push({
              title: `《物理治療師法》第 ${art.ArticleNo} 條`,
              summary: art.ArticleContent,
              url: officialUrl,
              evidence_level: "台灣法規（全國法規資料庫 API）",
            });
          }
        }
      }
    }

    const allResults = dynamicResults.length > 0
      ? dynamicResults
      : staticResults.length > 0
        ? staticResults
        : [];

    return buildResponse(
      "全國法規資料庫 — 物理治療師法",
      officialUrl,
      allResults.length > 0 ? allResults : getDefaultResults(officialUrl, ruleUrl),
      {
        warning:
          `⚖️ 本資料僅供參考，完整法條請至官方全文：\n` +
          `• 物理治療師法：${officialUrl}\n` +
          `• 施行細則：${ruleUrl}`,
      }
    );
  } catch {
    // API 不可用時，回傳靜態結果
    return buildResponse(
      "全國法規資料庫 — 物理治療師法（靜態摘要）",
      officialUrl,
      staticResults.length > 0
        ? staticResults
        : getDefaultResults(officialUrl, ruleUrl),
      {
        warning:
          `⚠️ 全國法規 API 暫時無法連線（沙盒網路限制）。\n` +
          `完整條文請至：${officialUrl}`,
      }
    );
  }
}

function getDefaultResults(officialUrl: string, ruleUrl: string): EvidenceResult[] {
  return [
    {
      title: "《物理治療師法》第 12 條 — 執業依據",
      summary:
        "物理治療師執行業務，應依醫師開具之診斷或醫囑，提供物理治療評估及治療。",
      url: officialUrl,
      evidence_level: "台灣法規（全國法規資料庫）",
    },
    {
      title: "《物理治療師法》第 13 條 — 業務範圍",
      summary:
        "業務範圍：物理治療評估及測試、電熱光水冷機械等物理性治療、運動及運動訓練、輔具評估及使用訓練。",
      url: officialUrl,
      evidence_level: "台灣法規（全國法規資料庫）",
    },
    {
      title: "《物理治療師法》第 14 條 — 禁止診斷",
      summary: "物理治療師不得為醫療診斷，其業務範圍以物理治療評估與治療為限。",
      url: officialUrl,
      evidence_level: "台灣法規（全國法規資料庫）",
    },
    {
      title: "物理治療師法施行細則",
      summary: "詳見施行細則全文，規範資格審查、執業登記等行政程序。",
      url: ruleUrl,
      evidence_level: "台灣法規（全國法規資料庫）",
    },
  ];
}
