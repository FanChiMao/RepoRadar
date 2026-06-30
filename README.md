<div align="center">

# Repo Radar

**集中同步、分析與彙整 GitLab / GitHub Issues 的 AI 桌面應用程式**

[![CI](https://img.shields.io/github/actions/workflow/status/FanChiMao/RepoRadar/main.yml?branch=main&style=flat&label=CI)](https://github.com/FanChiMao/RepoRadar/actions/workflows/main.yml)
[![latest](https://img.shields.io/github/v/release/FanChiMao/RepoRadar?style=flat&label=latest%20release)](https://github.com/FanChiMao/RepoRadar/releases/latest)
[![Backend Coverage](https://img.shields.io/codecov/c/github/FanChiMao/RepoRadar?flag=backend&style=flat&logo=python&logoColor=white&label=Backend%20Coverage)](https://codecov.io/gh/FanChiMao/RepoRadar?flags%5B0%5D=backend)
[![Frontend Coverage](https://img.shields.io/codecov/c/github/FanChiMao/RepoRadar?flag=frontend&style=flat&logo=vite&logoColor=white&label=Frontend%20Coverage)](https://codecov.io/gh/FanChiMao/RepoRadar?flags%5B0%5D=frontend)

<a href="https://youtu.be/UtHWj6HaNQ8" title="Repo Radar Demo (YouTube)">
  <img src="https://img.youtube.com/vi/UtHWj6HaNQ8/maxresdefault.jpg" alt="觀看 Repo Radar Demo 影片" title="▶️ 點擊觀看 Repo Radar Demo 影片 (YouTube)" width="640" />
</a>

</div>

---

Repo Radar 是一套 Electron 桌面應用程式,使用 partial-based HTML/CSS/TypeScript 前端與 Python FastAPI 後端,集中同步、分析與彙整 GitLab 或 GitHub Issues。

目前支援 **GitLab** 與 **GitHub** Issue Provider。一次只能啟用一個 provider 與一個 project/repository,切換來源時會清除 Issue 與 RAG cache,避免不同來源資料混用。

## ✨ 主要功能

| 功能                         | 說明                                                                            |
| ---------------------------- | ------------------------------------------------------------------------------- |
| 🔌 **Connections**           | 設定 GitLab 或 GitHub、測試連線、切換目前資料來源。                             |
| 📊 **Dashboard / Analytics** | 從快取計算狀態、風險、milestone、burndown、workload 與 lifecycle。              |
| 🗓️ **Timeline / Table**      | 以時間軸、行事曆與表格瀏覽 Issues。                                             |
| 🔍 **Issue Detail**          | 顯示 comments/discussions、related MR/PR、linked issues 與 AI 摘要(lazy-load)。 |
| 🤖 **AI Issue Chat / RAG**   | 重建 Issue 索引,使用選定 Gemini 模型搜尋並回答問題。                            |
| 📦 **Issue Arrange**         | 讀取單一 Issue URL 或 filter URL,批次處理、套用 LLM 並匯出 Excel。              |
| 📄 **Reports**               | 產生 Markdown、HTML 與 PDF 週報。                                               |
| ⏰ **Scheduler**             | 應用程式執行期間排程 daily sync 與 weekly report。                              |

## 🔄 Provider 支援範圍

| 能力                             | GitLab             | GitHub                              |
| -------------------------------- | ------------------ | ----------------------------------- |
| Issue list/detail                | 支援               | 支援,REST list 會排除 Pull Requests |
| Discussions/comments             | Discussion threads | Flat comments 正規化為 discussions  |
| Related change                   | Merge Requests     | Pull Requests                       |
| Dependencies/sub-issues          | Linked issues      | Dependencies、parent、sub-issues    |
| Issue due date / milestone start | 支援               | GitHub 未提供                       |
| Pipeline status                  | 支援               | v1 不提供                           |
| 寫入 Issue                       | 不支援             | 不支援                              |

GitHub v1 僅支援 `github.com` 且為 read-only。Public repository 可匿名連線,但匿名 REST API rate limit 很低,完整同步、關聯載入與 RAG 重建建議使用 GitHub token。

## 🚀 本機啟動

Windows 可直接執行 `Start-RepoRadar.bat`。它會檢查 Node.js 與 Python 3.12、建立 `.venv`、安裝相依套件並執行 `npm.cmd run dev`。

也可手動執行:

```powershell
npm.cmd install
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r backend\requirements.txt
npm.cmd run dev
```

Electron 啟動後會執行 loopback FastAPI;health endpoint 為 `http://127.0.0.1:8765/api/health`。

## 📋 使用流程

1. 在 `Connections` 選擇 GitLab 或 GitHub,填入 project/repository 與 token,執行 `Test Connection`。
2. 儲存設定後執行 `Sync Now`,或設定 `Import JSON` 取代 provider API。
3. 從 Dashboard、Analytics、Timeline、Table 與 Issue Detail 檢視資料。
4. 視需要執行 RAG reindex、AI Chat、Issue Arrange 或產生報表。

### GitHub 驗證範例

可使用 public repository `microsoft/markitdown` 驗證 GitHub 同步:

- Project Ref:`microsoft/markitdown`
- 預設 branch:`main`
- Issue `#2019` 可用於檢查 comment 與 related PR `#2066`
- Issue list 不應混入 Pull Requests

大型 public repository 容易耗盡匿名 rate limit。若收到 GitHub `403` 或 rate-limit 訊息,請設定 token 並稍後重試。

## 🗂️ 專案結構

- `src/`:Electron main process 與 preload bridge。
- `frontend/`:partial-based UI、styles 與 TypeScript renderer。
- `backend/`:FastAPI、Issue Provider、GitLab/GitHub clients、RAG、分析、報表與 Arrange。
- `backend/tests/`:provider、normalizer、config migration 與 API integration tests。
- `frontend/scripts/lib/`:從 renderer 抽出的純函式工具(日期、格式化、解析),供 unit test 使用。
- `frontend/tests/`:以 Vitest 撰寫的前端 unit tests。
- `docs/`:產品、架構、API、安全、品質與操作文件。

## 🔐 資料與 Secrets

開發環境資料預設在 `backend/data/`;封裝後使用 Electron `userData/repo-radar-data/`，Windows 預設為 `%APPDATA%\RepoRadar\repo-radar-data\`。可用 `REPO_RADAR_DATA_DIR` 覆寫。

- `config.json`:provider、project/repository、排程與 API key 設定。Secrets 仍以明碼存在 backend 檔案。
- `issues_cache.json`:目前來源的 schema v2 Issue cache。
- `rag_index.json` / `rag_rebuild_jobs.json`:RAG 索引與工作紀錄。
- `meta.json`:同步狀態與排程資訊。
- `reports/` / `arrange_exports/`:報表與 Arrange 匯出。

`GET /api/config` 不回傳 token/API key,frontend localStorage 也不保存 secrets。Loopback API 採用每次啟動產生的 session token:Electron main process 產生隨機 token、透過 `REPO_RADAR_SESSION_TOKEN` 傳給 backend,renderer 則於每個請求帶上 `X-Session-Token` header。未設定 token 時(例如直接以 `uvicorn` 跑開發或測試)會略過驗證。詳見[安全文件](docs/security/SECURITY.md)。

## ✅ 驗證

```powershell
# 後端測試(Python / pytest)與覆蓋率
.\.venv\Scripts\python.exe -m pytest backend\tests
.\.venv\Scripts\python.exe -m pytest backend\tests --cov --cov-report=term   # 目前 source 覆蓋率約 75%

# 前端測試(TypeScript / Vitest)與覆蓋率
npm.cmd test
npm.cmd run test:coverage   # 覆蓋率報告輸出至 coverage/frontend/(lcov + 終端摘要)

# Lint(前端 ESLint + 後端 Ruff)
npm.cmd run lint

# 格式檢查(Prettier + Black)
npm.cmd run format:check

# Build
npm.cmd run build:ts
```

GitHub Actions(`.github/workflows/main.yml`)在每次 push / PR 會跑格式檢查 → ESLint / Ruff lint → 後端 pytest 與前端 Vitest(各自上傳 `backend` / `frontend` flag 覆蓋率到 Codecov)→ TypeScript / Electron build。正式 Release 僅在 push `v*` tag 時由 `release.yml` 發布。

## 📦 建置

```powershell
npm.cmd run dist
```

此命令會編譯 TypeScript、以 PyInstaller 封裝 backend,並由 `electron-builder` 輸出至 `release/`。

## 🖼️ 應用程式預覽

<details>
<summary>應用程式截圖</summary>

<br />

<table>
  <tr>
    <td width="50%" align="center">
      <strong>Dashboard / Analytics</strong><br />
      <img src="assets/screenshots/dashboard-analytics.png" alt="Repo Radar Dashboard and Analytics" />
    </td>
    <td width="50%" align="center">
      <strong>Timeline / Gantt View</strong><br />
      <img src="assets/screenshots/timeline.png" alt="Repo Radar Timeline and Gantt view" />
    </td>
  </tr>
  <tr>
    <td width="50%" align="center">
      <strong>AI Issue Chat / RAG</strong><br />
      <img src="assets/screenshots/ai-chat.png" alt="Repo Radar AI Issue Chat and RAG" />
    </td>
    <td width="50%" align="center">
      <strong>AI Schedule</strong><br />
      <img src="assets/screenshots/ai-schedule.png" alt="Repo Radar AI Schedule and Teams automation" />
    </td>
  </tr>
</table>

</details>

## 📚 文件

- [文件導覽](docs/README.md)
- [產品文件](docs/product/README.md)
- [架構文件](docs/architecture/README.md)
- [API 規格](docs/specs/API_SPEC.md)
- [GitHub Provider 規格](docs/specs/GITHUB_PROVIDER.md)
- [安全文件](docs/security/SECURITY.md)
- [本機開發](docs/operations/local-setup.md)
