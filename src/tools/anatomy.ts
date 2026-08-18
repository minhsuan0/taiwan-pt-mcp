/**
 * search_anatomy_biomechanics
 *
 * 檢索解剖學與生物力學標準定義、動作功能分析。
 * 資料來源：
 *   1. PubMed E-utilities（Anatomy / Biomechanics MeSH）
 *   2. 靜態解剖詞典（確保沙盒環境可用）
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

// ─── 靜態解剖生物力學詞典 ────────────────────────────────────────────────
// 涵蓋最常被物理治療師查詢的肌群與關節
const ANATOMY_DICT: Record<string, { zh: string; function: string; innervation: string; clinical: string }> = {
  // 肩關節群
  "rotator cuff": {
    zh: "旋轉肌群（棘上肌、棘下肌、肩胛下肌、小圓肌）",
    function:
      "穩定肱骨頭於關節盂內（動態穩定）；棘上肌負責肩外展 0–15°，棘下肌與小圓肌負責外旋，肩胛下肌負責內旋。",
    innervation: "腋神經（C5–C6）、肩胛上神經（C5–C6）、肩胛下神經（C5–C6）",
    clinical:
      "旋轉肌群撕裂傷：疼痛弧 60–120°、Neer/Hawkins 測試陽性；完全撕裂時 Drop Arm Test 陽性。",
  },
  "棘上肌": {
    zh: "棘上肌（Supraspinatus）",
    function: "肩外展初始 0–15°，協助肱骨頭下壓，防止肩峰下夾擠。",
    innervation: "肩胛上神經（C5–C6）",
    clinical: "最常見旋轉肌群損傷部位，空罐測試（Empty Can Test）陽性。",
  },
  "gluteus medius": {
    zh: "臀中肌（Gluteus Medius）",
    function: "髖關節外展、內旋（前段纖維）；步態站立相骨盆穩定的關鍵肌肉，防止 Trendelenburg 步態。",
    innervation: "臀上神經（L4–S1）",
    clinical: "臀中肌無力 → 對側骨盆下沉（Trendelenburg sign）→ 髂脛束症候群、膝外翻風險增加。",
  },
  "臀中肌": {
    zh: "臀中肌（Gluteus Medius）",
    function: "髖關節外展、內旋（前段纖維）；步態站立相骨盆穩定的關鍵肌肉。",
    innervation: "臀上神經（L4–S1）",
    clinical: "無力時出現 Trendelenburg 步態；與髂脛束症候群、低背痛、髖骨股症候群（PFPS）相關。",
  },
  "quadriceps": {
    zh: "股四頭肌（Quadriceps Femoris）：股直肌、股外側肌、股中間肌、股內側肌",
    function: "伸膝（主要）；股直肌亦協助屈髖。VMO（股內斜肌）在膝末期伸直扮演重要角色。",
    innervation: "股神經（L2–L4）",
    clinical: "VMO 收縮不足 → 髕骨外移 → PFPS；ACL 重建後股四頭肌萎縮是復健重點指標。",
  },
  "anterior cruciate ligament": {
    zh: "前十字韌帶（ACL, Anterior Cruciate Ligament）",
    function: "限制脛骨前移、防止膝過伸、協助旋轉穩定。",
    innervation: "關節神經（本體感覺豐富）",
    clinical: "Lachman test（敏感性最高）、前抽屜測試、Pivot Shift test 評估 ACL 完整性。",
  },
  "前十字韌帶": {
    zh: "前十字韌帶（ACL, Anterior Cruciate Ligament）",
    function: "限制脛骨前移、防止膝過伸、協助旋轉穩定。",
    innervation: "關節神經（本體感覺豐富）",
    clinical: "Lachman test（敏感性最高）、前抽屜測試、Pivot Shift test 評估 ACL 完整性。",
  },
  "lumbar spine": {
    zh: "腰椎（Lumbar Spine, L1–L5）",
    function: "承重（壓力可達體重 5 倍）、前屈（主要）、後伸、側屈、有限旋轉（小平面關節限制）。",
    innervation: "腰神經根 L1–L5（椎間盤突出壓迫節段對應下肢皮節）",
    clinical: "紅旗徵兆：馬尾症候群（大小便失禁需緊急手術）。SLR（直腿抬高）測試 L4–S1 神經根刺激。",
  },
  "腰椎": {
    zh: "腰椎（Lumbar Spine, L1–L5）",
    function: "承重、前屈（主要）、後伸、側屈、有限旋轉。",
    innervation: "腰神經根 L1–L5",
    clinical: "紅旗徵兆：馬尾症候群（大小便失禁需緊急轉診）。SLR 測試 L4–S1 神經根。",
  },
  "shoulder": {
    zh: "肩複合體（Shoulder Complex）：盂肱關節、肩鎖關節、胸鎖關節、肩胛胸壁關節",
    function: "盂肱節律（GH rhythm）2:1（肩外展 180° = GH 120° + 肩胛骨 60° 上旋）。",
    innervation: "C5–C6（外展）、C5–T1（完整上肢動作）",
    clinical: "肩峰下夾擠：Hawkins/Kennedy test；肩不穩：恐懼測試；肩峰鎖骨分離：AC joint 壓痛。",
  },
  "knee": {
    zh: "膝關節（Knee Joint）：脛股關節、髕股關節、上脛腓關節",
    function: "主要為屈伸（矢狀面）；終端外旋（screw home mechanism）鎖定伸直位。",
    innervation: "股神經、坐骨神經、閉孔神經",
    clinical: "PFPS：Clarke 測試；半月板：McMurray/Thessaly；PCL：後抽屜；MCL：外翻應力測試。",
  },
};

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
 * @param muscle_or_joint - 肌肉或關節名稱（中英文皆可）
 * @param maxResults      - 最多回傳 PubMed 筆數（預設 4）
 */
export async function searchAnatomyBiomechanics(
  muscle_or_joint: string,
  maxResults = 4
) {
  // 1. 靜態詞典優先匹配（不依賴網路）
  const dictKey = Object.keys(ANATOMY_DICT).find(
    (k) =>
      muscle_or_joint.toLowerCase().includes(k.toLowerCase()) ||
      k.toLowerCase().includes(muscle_or_joint.toLowerCase())
  );

  const staticResult: EvidenceResult[] = dictKey
    ? [
        {
          title: `解剖定義：${ANATOMY_DICT[dictKey].zh}`,
          summary:
            `【功能】${ANATOMY_DICT[dictKey].function}\n` +
            `【神經支配】${ANATOMY_DICT[dictKey].innervation}\n` +
            `【臨床意義】${ANATOMY_DICT[dictKey].clinical}`,
          url: `https://pubmed.ncbi.nlm.nih.gov/?term=${encodeURIComponent(muscle_or_joint + " anatomy biomechanics")}`,
          evidence_level: "解剖生物力學標準定義（臨床教科書）",
        },
      ]
    : [];

  // 2. PubMed 動態查詢（解剖 + 生物力學）
  const pubmedQuery =
    `(${muscle_or_joint}[Title/Abstract]) AND ` +
    `(anatomy[MeSH] OR biomechanics[MeSH] OR kinematics OR kinesiology OR "muscle function") AND ` +
    `(physical therapy OR physiotherapy OR rehabilitation)`;

  let pubmedResults: EvidenceResult[] = [];

  try {
    const searchUrl =
      `${PUBMED_ESEARCH}?db=pubmed` +
      `&term=${encodeURIComponent(pubmedQuery)}` +
      `&retmax=${maxResults}&retmode=json&sort=relevance`;

    const searchData = await getJson<ESearchResult>(searchUrl);
    const ids = searchData.esearchresult?.idlist ?? [];

    if (ids.length > 0) {
      const summaryUrl = `${PUBMED_ESUMMARY}?db=pubmed&id=${ids.join(",")}&retmode=json`;
      const summaryData = await getJson<ESummaryResult>(summaryUrl);

      pubmedResults = ids
        .map((pmid): EvidenceResult | null => {
          const art = summaryData.result[pmid] as ArticleSummary | undefined;
          if (!art) return null;
          const year = parseInt(art.pubdate?.split(" ")[0] ?? "0", 10) || undefined;
          const doi = art.elocationid?.startsWith("10.")
            ? art.elocationid.replace(/^doi:\s*/i, "").trim()
            : undefined;
          return {
            title: truncate(art.title, 200),
            summary: `${art.fulljournalname ?? art.source}`,
            authors: formatAuthors(art.authors),
            doi,
            pmid,
            year,
            journal: art.fulljournalname ?? art.source,
            url: doi
              ? `https://doi.org/${doi}`
              : `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`,
            evidence_level: "PubMed — Anatomy / Biomechanics",
          };
        })
        .filter((r): r is EvidenceResult => r !== null);
    }
  } catch {
    // PubMed 不可用，靜態結果仍可回傳
  }

  const allResults = [...staticResult, ...pubmedResults];

  return buildResponse(
    "解剖生物力學資料庫（PubMed + 臨床詞典）",
    `https://pubmed.ncbi.nlm.nih.gov/?term=${encodeURIComponent(muscle_or_joint + " anatomy biomechanics")}`,
    allResults.length > 0
      ? allResults
      : [
          {
            title: `${muscle_or_joint}（無直接匹配）`,
            summary: "請嘗試使用英文解剖學術語，或提供更具體的肌肉/關節名稱。",
            url: `https://pubmed.ncbi.nlm.nih.gov/?term=${encodeURIComponent(muscle_or_joint)}`,
          },
        ],
    {
      warning:
        "⚠️ 解剖學資訊供臨床參考，評估前請結合患者個別身體檢查結果。",
    }
  );
}
