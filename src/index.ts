#!/usr/bin/env node
/**
 * Taiwan PT MCP Server — 台灣物理治療實證與法規助手
 *
 * 工具清單：
 *   1. search_pedro_evidence      — 查詢 PEDro / PubMed RCT 實證
 *   2. search_cpg_guidelines      — 查詢臨床實踐指南（CPG）
 *   3. search_pt_laws             — 查詢《物理治療師法》法規
 *   4. search_anatomy_biomechanics — 查詢解剖學與生物力學
 *
 * Transport: stdio（Standard I/O，供 Antigravity MCP 配置使用）
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

import { searchPedroEvidence } from "./tools/pedro.js";
import { searchCpgGuidelines } from "./tools/cpg.js";
import { searchPtLaws } from "./tools/laws.js";
import { searchAnatomyBiomechanics } from "./tools/anatomy.js";

// ─── 建立 MCP Server ────────────────────────────────────────────────────────
const server = new McpServer({
  name: "taiwan-pt-mcp",
  version: "1.0.0",
});

// ─── Tool 1: search_pedro_evidence ──────────────────────────────────────────
server.tool(
  "search_pedro_evidence",
  "查詢 PEDro 物理治療實證資料庫（RCT、統合分析）。透過 PubMed E-utilities 篩選隨機對照試驗與系統性回顧，提供 DOI 連結與 PEDro 備援查詢 URL。",
  {
    query: z
      .string()
      .min(2)
      .describe(
        "搜尋關鍵詞，例如 'rotator cuff exercise' 或 '低背痛 核心穩定訓練'"
      ),
    max_results: z
      .number()
      .int()
      .min(1)
      .max(10)
      .optional()
      .default(5)
      .describe("最多回傳筆數，預設 5"),
  },
  async ({ query, max_results }) => {
    const result = await searchPedroEvidence(query, max_results ?? 5);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  }
);

// ─── Tool 2: search_cpg_guidelines ──────────────────────────────────────────
server.tool(
  "search_cpg_guidelines",
  "查詢國際與台灣認可之臨床實踐指南（CPG）。透過 PubMed Practice Guideline 類型篩選，並附加台灣物理治療學會、GIN、NICE、APTA 等指南連結。",
  {
    condition: z
      .string()
      .min(2)
      .describe(
        "疾患或診斷名稱，例如 'rotator cuff tear', '下背痛', 'knee osteoarthritis'"
      ),
    body_region: z
      .string()
      .min(2)
      .describe(
        "身體部位，例如 'shoulder', 'lumbar spine', 'knee', '頸椎'"
      ),
    max_results: z
      .number()
      .int()
      .min(1)
      .max(10)
      .optional()
      .default(5)
      .describe("最多回傳筆數，預設 5"),
  },
  async ({ condition, body_region, max_results }) => {
    const result = await searchCpgGuidelines(
      condition,
      body_region,
      max_results ?? 5
    );
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  }
);

// ─── Tool 3: search_pt_laws ─────────────────────────────────────────────────
server.tool(
  "search_pt_laws",
  "查詢台灣《物理治療師法》及施行細則。優先回傳靜態核心條文（第 1、12、13、14、24 條），並嘗試呼叫全國法規資料庫 API 取得動態結果。",
  {
    keyword: z
      .string()
      .min(1)
      .describe(
        "查詢關鍵詞，例如 '業務範圍', '醫囑', '執業', '診斷', '禁忌'"
      ),
  },
  async ({ keyword }) => {
    const result = await searchPtLaws(keyword);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  }
);

// ─── Tool 4: search_anatomy_biomechanics ────────────────────────────────────
server.tool(
  "search_anatomy_biomechanics",
  "檢索解剖學與生物力學標準定義，包含肌肉功能、神經支配、臨床意義與動作分析。內建靜態詞典（中英文），同時查詢 PubMed Anatomy/Biomechanics 文獻。",
  {
    muscle_or_joint: z
      .string()
      .min(2)
      .describe(
        "肌肉或關節名稱（中英文皆可），例如 'rotator cuff', '臀中肌', 'lumbar spine', 'knee'"
      ),
    max_results: z
      .number()
      .int()
      .min(1)
      .max(8)
      .optional()
      .default(4)
      .describe("PubMed 最多回傳筆數，預設 4"),
  },
  async ({ muscle_or_joint, max_results }) => {
    const result = await searchAnatomyBiomechanics(
      muscle_or_joint,
      max_results ?? 4
    );
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  }
);

// ─── 啟動 Server ─────────────────────────────────────────────────────────────
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // MCP servers must not write to stdout except via the protocol
  process.stderr.write(
    "[taiwan-pt-mcp] Server started on stdio. Ready to serve PT evidence queries.\n"
  );
}

main().catch((err) => {
  process.stderr.write(`[taiwan-pt-mcp] Fatal error: ${err}\n`);
  process.exit(1);
});
