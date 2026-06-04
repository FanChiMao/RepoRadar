# GitHub Provider

## 支援範圍

GitHub v1 支援 `github.com` repository 的 read-only Issue-centric 能力：

- Issue list、單一 Issue、comments。
- Related PR、dependencies、parent、sub-issues。
- 單一 Issue URL 與 repository Issues filter URL。
- Public repo 可匿名讀取；private repo 需要 token。

不支援 GitHub Enterprise Server、寫入 Issue/PR、原始碼、commits、releases、contributors 或 Actions checks。

## API 與分頁

- 使用 GitHub REST API 與版本 header。
- Issue list 依 `Link` header 分頁。
- GitHub Issue list 同時包含 Pull Requests；provider 必須排除含 `pull_request` 欄位的項目。
- 關聯資料不在 bulk sync 預抓，Issue Detail 才 lazy-load。
- 一般文字引用不視為 linked issue；只納入明確 dependency、parent、sub-issue。

## Normalization

| 共用欄位/能力        | GitHub 對應                                       |
| -------------------- | ------------------------------------------------- |
| `iid`                | Issue `number`                                    |
| `state=open`         | 正規化成 `opened`                                 |
| labels               | Label objects 轉 name list                        |
| discussions          | 每則 flat comment 包成一個 single-note discussion |
| `user_notes_count`   | Issue `comments`                                  |
| task completion      | 從 Issue body Markdown checkboxes 計算            |
| milestone due date   | `milestone.due_on`                                |
| Issue due date       | `null`                                            |
| milestone start date | `null`                                            |
| related MR route     | Related PR，`kind="pull_request"`                 |
| links route          | Dependencies、parent、sub-issues                  |
| pipeline status      | `null`                                            |
| relation counts      | Bulk sync 時 `relation_counts_known=false`        |

UI 對缺少欄位必須顯示「GitHub 未提供」，不能顯示 `0`、假日期或判斷成風險。

## Connections 與 URL

- Base URL 固定為 `https://github.com`。
- Project Ref 格式為 `owner/repo`。
- 單一 Issue：`https://github.com/{owner}/{repo}/issues/{number}`。
- Filter：`https://github.com/{owner}/{repo}/issues?...`，目前解析 state、labels 與 assignee。

Connection test 不保存設定，成功 response 包含 repo metadata、default branch、private 與 rate-limit 狀態。

## Rate Limit 與錯誤

- 匿名 request 額度很低，大型 repo 完整同步建議使用 fine-grained token。
- Token 應只授予目標 repository 與 Issues read 權限。
- 401、403、404、429 保留對應 HTTP status 給 API layer。
- 403/429/rate-limit exhaustion 最多嘗試 3 次，單次等待上限 5 秒。
- Provider bounded concurrency 為 1，relations 採 lazy-load 以降低 secondary rate limit。

## MarkItDown 驗證基準

2026-06-04 以 `microsoft/markitdown` 驗證：

- Default branch 為 `main`。
- 約 394 個 open Issues，同步結果不混入 Pull Requests。
- Issue `#2019` 可讀取 comment。
- Issue `#2019` related PR 包含 `#2066`。
- 缺少 Issue due date 時，Timeline 與風險分析不產生錯誤逾期判定。

匿名額度在完整驗證後可能耗盡，重複測試請設定 token。

## 測試要求

- PR exclusion、normalizer、comments、related PR、dependencies/sub-issues。
- URL/filter parsing。
- 401、403、404、429、bounded retry 與無 token。
- Provider 切換 cache isolation。
- Missing due date 不產生錯誤風險。
