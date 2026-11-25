# taiwan-pt-mcp

**台灣物理治療實證與法規 MCP Server**

> 透過 [Model Context Protocol (MCP)](https://modelcontextprotocol.io) 讓 AI 助手（Claude、Cursor、Antigravity 等）即時查證物理治療實證、臨床指南與台灣法規，**嚴禁憑記憶捏造復健指引**。

[![npm version](https://img.shields.io/npm/v/taiwan-pt-mcp)](https://www.npmjs.com/package/taiwan-pt-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

---

## 四大查詢工具

| 工具 | 功能 | 資料來源 |
|---|---|---|
| `search_pedro_evidence` | 查詢 RCT、統合分析等物理治療實證 | PubMed（PEDro 備援） |
| `search_cpg_guidelines` | 查詢臨床實踐指南（CPG） | PubMed + TWPTA / GIN / NICE / APTA |
| `search_pt_laws` | 查詢《物理治療師法》條文 | 全國法規資料庫 + 靜態備援 |
| `search_anatomy_biomechanics` | 查詢解剖學與生物力學定義 | 靜態詞典 + PubMed |

---

## 安裝與使用

### 需求
- Node.js ≥ 18.0.0

### 方法一：npx（不需安裝，直接執行）

```bash
npx taiwan-pt-mcp
```

### 方法二：全域安裝

```bash
npm install -g taiwan-pt-mcp
taiwan-pt-mcp
```

### 方法三：從原始碼

```bash
git clone https://github.com/minhsuan0/taiwan-pt-mcp.git
cd taiwan-pt-mcp
npm install
npm run build
node dist/index.js
```

---

## 設定 MCP 客戶端

### Claude Desktop

編輯 `~/Library/Application Support/Claude/claude_desktop_config.json`（Mac）：

```json
{
  "mcpServers": {
    "taiwan-pt-mcp": {
      "command": "npx",
      "args": ["taiwan-pt-mcp"]
    }
  }
}
```

### Cursor

編輯 `.cursor/mcp.json`：

```json
{
  "mcpServers": {
    "taiwan-pt-mcp": {
      "command": "npx",
      "args": ["taiwan-pt-mcp"]
    }
  }
}
```

### Google Antigravity

專案根目錄建立 `.mcp.json`：

```json
{
  "mcpServers": {
    "taiwan-pt-mcp": {
      "command": "npx",
      "args": ["taiwan-pt-mcp"]
    }
  }
}
```

---

## 使用範例

設定完成後，直接用自然語言提問，AI 會自動呼叫工具查證：

```
「前十字韌帶術後的復健流程？」
「低背痛的臨床指南有哪些？」
「物理治療師的業務範圍包含哪些？法規依據？」
「臀中肌無力與步態的關係？」
```

---

## 查詢工具說明

### `search_pedro_evidence(query, max_results?)`
查詢物理治療相關 RCT、系統性回顧、統合分析。

```json
{
  "query": "rotator cuff exercise therapy",
  "max_results": 5
}
```

### `search_cpg_guidelines(condition, body_region, max_results?)`
查詢針對特定疾患與身體部位的臨床實踐指南。

```json
{
  "condition": "knee osteoarthritis",
  "body_region": "knee",
  "max_results": 5
}
```

### `search_pt_laws(keyword)`
查詢台灣《物理治療師法》相關條文（離線靜態備援確保可用性）。

```json
{
  "keyword": "業務範圍"
}
```

### `search_anatomy_biomechanics(muscle_or_joint, max_results?)`
查詢解剖定義、肌肉功能、神經支配與臨床意義（中英文皆可）。

```json
{
  "muscle_or_joint": "臀中肌"
}
```

---

## 系統監控與心跳通知（維運設定）

本伺服器支援**外部心跳監控（死人開關）**與**每日 Telegram 狀態報告**，協助維護者隨時掌握系統可用性。

### 1. 外部心跳檢測（Dead Man's Switch）
防止主機斷電、程式崩潰或網路中斷而無聲死亡：
- 註冊並在 [Healthchecks.io](https://healthchecks.io) 建立 Check（建議間隔 2 分鐘）。
- 設定環境變數 `HEARTBEAT_URL`，伺服器每 2 分鐘會定時打卡。若超時未收到心跳，Healthchecks 會自動透過 Email/Telegram 發出斷線警報。

### 2. 每日中午 12 點 Telegram 運行報告
每天中午 12:00 自動推播過去 24 小時的運行摘要：
```
🟢 [Taiwan-PT-MCP 運行報告]
- 伺服器狀態：健康運行中
- 連續運作時間（Uptime）：3 天 14 小時
- 過去 24 小時查詢次數：86 次
- 外部 PubMed 連線成功率：99.2%
```
- 設定環境變數 `TELEGRAM_BOT_TOKEN`（向 `@BotFather` 取得）與 `TELEGRAM_CHAT_ID`。

### MCP 客戶端環境變數配置範例（Claude Desktop / Cursor / Antigravity）

```json
{
  "mcpServers": {
    "taiwan-pt-mcp": {
      "command": "npx",
      "args": ["taiwan-pt-mcp"],
      "env": {
        "NCBI_API_KEY": "你的_NCBI_API_KEY",
        "HEARTBEAT_URL": "https://hc-ping.com/你的-uuid",
        "TELEGRAM_BOT_TOKEN": "123456:ABC-DEF...",
        "TELEGRAM_CHAT_ID": "你的_CHAT_ID"
      }
    }
  }
}
```

---

## 免責聲明

- 本工具查詢結果**僅供物理治療師臨床參考**，不替代醫療診斷
- 依台灣《物理治療師法》第 12 條，物理治療處置應依醫師診斷或醫囑執行
- 法規資訊以[全國法規資料庫](https://law.moj.gov.tw/LawClass/LawAll.aspx?pcode=L0020003)官方全文為準

---

## License

MIT © 2026
