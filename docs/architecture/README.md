# Architecture

Repo Radar 採 Electron main process、partial-based frontend 與 Python FastAPI backend 三層架構。GitLab 與 GitHub 透過共用 Issue Provider contract 接入；Dashboard、Analytics、RAG、Arrange 與報表主要消費 normalized cache。

## 文件導覽

| 文件                                                     | 內容                                               |
| -------------------------------------------------------- | -------------------------------------------------- |
| [runtime-overview.md](runtime-overview.md)               | Processes、模組責任、provider 與主要資料流         |
| [data-model.md](data-model.md)                           | Config、Issue schema v2、RAG、meta 與 localStorage |
| [ADR 0001](decisions/0001-electron-fastapi-split.md)     | Electron + FastAPI 雙 process                      |
| [ADR 0002](decisions/0002-no-frontend-framework.md)      | Vanilla TypeScript 與 partial-based UI             |
| [ADR 0003](decisions/0003-issue-provider-abstraction.md) | Issue Provider 抽象與 cache identity               |

## 當前架構重點

- `backend/core/provider.py` 定義 `IssueProvider` protocol、factory 與 capabilities。
- GitLab/GitHub client 將平台資料正規化為共用 Issue shape；一次只啟用一個來源。
- GitHub 關聯資料在 Issue Detail lazy-load，避免列表大量請求觸發 secondary rate limit。
- 切換 provider、base URL 或 source ref 會清除 Issue cache、RAG index/jobs 與 `last_sync`。
- Electron main 負責 backend lifecycle、檔案/連結與 PDF；業務資料透過 loopback HTTP。

## 已知技術債

- `backend/app.py` 仍包含 routing、AI、analytics、同步與 HTML 報表組裝，並非單純 composition root。
- `frontend/scripts/legacy-app.ts` 已超過 6,000 行，包含大部分 renderer 狀態與 provider-aware UI。
- Loopback API 以 per-launch session token(`X-Session-Token`)驗證；backend secrets 仍以明碼寫入 `config.json`。
