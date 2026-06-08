# Repo Radar Product Requirements Document

## 產品目標

Repo Radar 讓 PM、Tech Lead 與工程師從 GitLab 或 GitHub Issue 資料建立一致的專案視圖，降低跨 Issue、comments/discussions、MR/PR、milestone 與報表整理成本。

## 使用者

| Persona          | 主要需求                                                            |
| ---------------- | ------------------------------------------------------------------- |
| Project Manager  | 追蹤整體狀態、風險、milestone、週報與匯出                           |
| Tech Lead        | 檢查 blocker、relations、burndown、workload 與 delivery follow-up   |
| Engineer         | 查看單一 Issue 的內容、comments/discussions、linked issues 與 MR/PR |
| Analyst/Reviewer | 使用 RAG Chat、Arrange 與報表整理 Issue 資料                        |

## In Scope

- GitLab 與 GitHub Connections、connection test、一次啟用一個來源。
- Provider API 或 Import JSON 同步；source identity 隔離 cache。
- Dashboard、Analytics、Timeline、Table 與 Issue Detail。
- GitLab discussions/MR/links；GitHub comments/related PR/dependencies/parent/sub-issues。
- RAG index/search 與 AI Issue Chat，可選擇模型與 fallback candidates。
- Discussion summary、Issue Arrange、Excel、Markdown/HTML/PDF。
- App 內 daily sync 與 weekly report 排程。

## Provider 限制與降級

| 項目                 | GitLab     | GitHub               |
| -------------------- | ---------- | -------------------- |
| Project ref          | path 或 ID | `owner/repo`         |
| Related change       | MR         | PR                   |
| Discussion           | Threads    | Flat comments 正規化 |
| Issue due date       | 可用       | 未提供               |
| Milestone start date | 可用       | 未提供               |
| Pipeline status      | 可用       | v1 未提供            |
| Relations            | 可預載     | 詳情頁 lazy-load     |

GitHub v1 僅支援 `github.com`、read-only。Public repo 可匿名同步，但大型 repo 建議使用 token。

## Out of Scope

- 寫入、建立或修改 GitLab/GitHub Issue、MR、PR。
- GitHub Enterprise Server。
- 讀取原始碼、commits、releases、contributors 或 Actions checks。
- 多 provider/repository 同時聚合。
- App 關閉後仍持續執行的系統服務排程。
- Web SaaS 與多人權限管理。

## 功能需求

| ID  | 功能                                                      | 優先級 |
| --- | --------------------------------------------------------- | ------ |
| F-1 | Connections、provider/repository 設定與 connection test   | P0     |
| F-2 | Provider/Import JSON 同步與 cache isolation               | P0     |
| F-3 | Dashboard、Analytics、Timeline、Table                     | P0     |
| F-4 | Issue Detail、動態 MR/PR、comments/discussions、relations | P0     |
| F-5 | Markdown、HTML、PDF 報表                                  | P0     |
| F-6 | RAG index/search 與 AI Chat                               | P1     |
| F-7 | Issue/filter URL Arrange、LLM 處理與歷史                  | P1     |
| F-8 | Excel 匯出                                                | P1     |
| F-9 | Provider capabilities 與缺值降級 UI                       | P1     |

## 模型選擇

- Chat/RAG：`gemini-3.5-flash`、`gemini-2.5-pro`、`gemma-4-26b-a4b-it`。
- Arrange：`gemini-2.5-pro`、`gemini-3.5-flash`。
- Discussion summary：`gemini-2.5-flash`、`gemma-4-31b-it`。

## 驗收

- `microsoft/markitdown` 同步不混入 Pull Requests；Issue `#2019` 顯示 comment 與 related PR `#2066`。
- GitLab 舊 config 自動 migration，原功能維持。
- 切換 provider/repository 後 Issue 與 RAG cache 不混用。
- GitHub 缺少 due date 時不產生錯誤逾期或 burndown 判定。
- Arrange 支援 GitLab/GitHub Issue 與 filter URLs。
- 401、403、404、429、無 token與 rate-limit exhaustion 有明確錯誤。
- Python tests、TypeScript build、compileall、Black、Prettier 與 diff check 通過。
