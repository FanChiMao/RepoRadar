# Glossary

| 名詞                         | 定義                                                                                                              |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| **Issue Provider**           | 讀取與正規化 Issue 的共用 contract。目前實作為 GitLab 與 GitHub，一次只啟用一個。                                 |
| **Active Provider**          | `active_provider` 指定的目前來源，值為 `gitlab` 或 `github`。                                                     |
| **Project Ref**              | Provider-specific 專案識別：GitLab path/ID，或 GitHub `owner/repo`。                                              |
| **Source Ref**               | 寫入 normalized Issue/cache 的來源識別，用於避免不同 provider/repository 混用。                                   |
| **Issue / IID**              | 通用 Issue；normalized `iid` 對應 GitLab IID 或 GitHub Issue number。                                             |
| **MR/PR**                    | GitLab Merge Request 或 GitHub Pull Request。API 為相容性保留 merge-request route，response 以 `kind` 區分。      |
| **Discussion normalization** | GitLab 保留 discussion threads；GitHub 每個 flat comment 包裝為一個 discussion。                                  |
| **Relation Counts Known**    | `relation_counts_known` 表示目前 relation count 是否已載入。GitHub bulk list 通常為 `false`，詳情頁再 lazy-load。 |
| **Capabilities**             | Provider 可提供的欄位與關聯，例如 due date、milestone start、pipeline、related MR/PR 或 sub-issues。              |
| **Cache Schema v2**          | 包含 `provider`、`source_ref`、`relation_counts_known` 的 Issue cache 格式。                                      |
| **RAG**                      | 將目前 Issue cache 建立成可搜尋索引，供 AI Chat 擷取相關內容。                                                    |
| **Issue Arrange**            | 從單一 Issue URL 或 filter URL 取得資料、套用 LLM、匯出 Excel 與保存歷史的流程。                                  |
| **Dashboard / Analytics**    | 從 Issue cache 計算 KPI、風險、burndown、workload、label、lifecycle 與 delivery follow-up。                       |
| **Risk**                     | 依 overdue、長期無更新、blocker、checklist 與 delivery relation 等規則計算的提醒。平台未提供的欄位不得視為風險。  |
| **Import JSON**              | 不呼叫 provider API，直接以本機 JSON 作為同步來源；優先於 active provider。                                       |
| **Tracker Bridge**           | Electron preload 透過 `contextBridge` 暴露給 renderer 的受限 IPC API：`window.trackerBridge`。                    |
