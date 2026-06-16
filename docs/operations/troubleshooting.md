# Troubleshooting

## 啟動與建置

| 症狀                               | 處理                                                                           |
| ---------------------------------- | ------------------------------------------------------------------------------ |
| Backend not ready                  | 確認 port `8765` 未占用，並檢查 `.venv`、Python 與 backend stderr。            |
| UI 載入失敗                        | 執行 `npm.cmd run build:ts`，確認 `dist/frontend/scripts/legacy-app.js` 存在。 |
| `npm.ps1` 被 execution policy 阻擋 | 使用 `npm.cmd` / `npx.cmd`。                                                   |
| 打包版 backend 啟動失敗            | 先單獨執行 PyInstaller 產物，檢查 hidden imports。                             |

## GitLab

| 症狀                    | 處理                                                                       |
| ----------------------- | -------------------------------------------------------------------------- |
| 401                     | 使用至少具有 `read_api` 的 token。                                         |
| 404                     | 確認 project path/ID 與 token 權限。                                       |
| SSL 錯誤                | 確認 base URL、網路與自簽憑證；GitLab 預設 `verify_ssl=false` 有安全風險。 |
| Import JSON 無 MR/links | Import 模式不會呼叫 live provider relation APIs。                          |

## GitHub

| 症狀                           | 處理                                                                 |
| ------------------------------ | -------------------------------------------------------------------- |
| 401                            | Token 無效或撤銷，重新建立只授予所需 repo/Issues read 權限的 token。 |
| 403 / rate limit               | 設定 token、等待 reset；避免連續開啟大量 Issue Detail。              |
| 404                            | 確認 `owner/repo` 與 private repo 權限。                             |
| 429                            | 等待後重試；client 最多 bounded retry 3 次，單次等待上限 5 秒。      |
| GitHub Enterprise URL 被拒絕   | v1 僅支援 `github.com`。                                             |
| Issue list 出現 PR             | 屬於錯誤，GitHub provider 應排除含 `pull_request` 欄位的項目。       |
| Relations 尚未顯示             | GitHub related PR、dependencies、sub-issues 在 detail lazy-load。    |
| Timeline 顯示「GitHub 未提供」 | GitHub Issue 沒有原生 due date、milestone start 或 pipeline status。 |

大型 public repo（例如 `microsoft/markitdown`）容易耗盡匿名 rate limit，建議完整測試時使用 token。

## Provider 切換與 Cache

切換 provider/base URL/project ref 後，舊 Issue/RAG cache 應清除。若畫面仍有舊來源資料，確認 `config.json` 的 active source，停止 App 後備份並移除 `issues_cache.json`、`rag_index.json` 與 `rag_rebuild_jobs.json` 再同步。

## RAG / AI

| 症狀                   | 處理                                         |
| ---------------------- | -------------------------------------------- |
| Chat 說沒有資料        | 先同步 Issues；使用 RAG 模式前執行 reindex。 |
| Reindex 無法開始       | 確認目前有 `issues_cache.json`。             |
| Gemini 502/429         | 確認 key，稍後重試或調整模型 candidates。    |
| 切換來源後找不到舊索引 | 正常行為；為避免來源混用，需重新 reindex。   |

## Issue Arrange

支援 GitLab `.../-/issues/<iid>`、GitLab filter、GitHub `github.com/owner/repo/issues/<number>` 與 GitHub Issues filter URL。若 preview 失敗，先執行 connection test，並確認 URL 對應 active provider/repository。

Excel 匯出失敗時重新安裝 `backend/requirements.txt`，確認 `openpyxl` 可用。

## Reports、Scheduler 與資料

- Scheduler 只在 App 開啟時執行，並以 `meta.json.scheduler` 同日去重。
- 開發資料在 `backend/data/`，封裝版在 `userData/repo-radar-data/`，Windows 預設為 `%APPDATA%\RepoRadar\repo-radar-data\`。
- PDF 無反應時先確認 `GET /api/report/html` 有內容，再重試 Electron 匯出。
