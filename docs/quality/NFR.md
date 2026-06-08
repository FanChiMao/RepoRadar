# Non-Functional Requirements

## 效能與容量

| 指標                     | 目標/假設                         |
| ------------------------ | --------------------------------- |
| 冷啟動到可互動           | 5 秒內，包含 backend health check |
| Dashboard cache hit      | 1 秒內                            |
| Analytics / 1,000 Issues | 500 ms 內                         |
| 單一 source Issues       | 5,000 筆內                        |
| `issues_cache.json`      | 50 MB 內                          |

GitHub relation 不在 bulk list 預抓，Issue Detail 才 lazy-load，以控制 API 數量。

## 可靠性

- Scheduler 使用 `meta.scheduler.<task>` 同日去重。
- Provider request timeout 為 30 秒。
- GitHub 403/429/rate-limit exhaustion 最多嘗試 3 次，單次等待上限 5 秒，bounded concurrency 為 1。
- Gemini 429 使用最多 3 次 exponential backoff。
- Backend crash 目前不自動重啟。
- 切換 provider/source 時必須清除 Issue 與 RAG cache。

## 相容性

| 項目   | 範圍                                                        |
| ------ | ----------------------------------------------------------- |
| OS     | Windows 10/11 x64；macOS/Linux 未驗證                       |
| Node   | 18+                                                         |
| Python | `Start-RepoRadar.bat` 要求 3.12                         |
| GitLab | Self-hosted/GitLab.com，read-only Issue 能力                |
| GitHub | github.com，read-only Issue-centric；不支援 GHES            |
| Models | Chat/RAG、Arrange、Summary 各使用文件列出的 model allowlist |

## 可維護性

- TypeScript 使用 strict；Python 使用 Black、typing 與 `unittest`。
- Provider-specific 呼叫與 normalization 應留在 provider client。
- API、schema、provider capability 與模型變更需同步文件和測試。
- 目前 13 個 Python tests；provider contract、normalizer、migration、URL parsing、rate limit 與 API integration 必須持續覆蓋。
- `backend/app.py` 含 routing、AI、analytics、同步與報表，仍需拆分。
- `frontend/scripts/legacy-app.ts` 超過 6,000 行，仍需拆分。

## 可觀測性

- Backend stdout/stderr 由 Electron main process 接收。
- Dev mode 可使用 renderer DevTools。
- RAG jobs/status 可由 API 查詢。
- 目前無結構化 logs、metrics 或 distributed tracing。

## 安全

- Backend 僅 bind loopback，CORS 限制本機 origins。
- Loopback API 仍無驗證；backend config secrets 仍明碼。
- GET config 與 frontend localStorage 不得包含 secret。
- Provider token 採最小 read-only 權限。

## Migration 與資料一致性

- 舊 flat GitLab config 自動 migration 至 nested connections。
- Issue cache schema 為 version 2，包含 `provider`、`source_ref`、`relation_counts_known`。
- 未來 schema 變更必須提供 migration 或相容讀取。
- Provider 未提供欄位時必須為 `null`/unknown，不得產生錯誤風險判斷。

## CI 缺口

GitHub Actions 目前只執行 build/release，未執行 Python tests、compileall、Black 或 Prettier check；發版前需依[建置與發版文件](../operations/build-and-release.md)在本機驗證。
