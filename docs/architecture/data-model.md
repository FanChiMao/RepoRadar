# Data Model

## 資料目錄

所有 backend 資料由 `core/config_store.py` 管理：

- 開發模式：`backend/data/`
- 封裝模式：`<Electron userData>/repo-radar-data/`，Windows 預設為 `%APPDATA%\RepoRadar\repo-radar-data\`
- 覆寫：`REPO_RADAR_DATA_DIR`

```text
data/
├── config.json
├── issues_cache.json
├── rag_index.json
├── rag_rebuild_jobs.json
├── meta.json
├── reports/
└── arrange_exports/
    ├── scrape/
    ├── result/
    └── excel/
```

## Config

目前 `config.json` 使用 nested connections：

```json
{
  "active_provider": "github",
  "connections": {
    "gitlab": {
      "base_url": "https://gitlab.example.com",
      "token": "glpat-secret",
      "project_ref": "group/project",
      "project_ref_history": ["group/project"],
      "verify_ssl": false
    },
    "github": {
      "base_url": "https://github.com",
      "token": "github_pat_secret",
      "project_ref": "microsoft/markitdown",
      "project_ref_history": ["microsoft/markitdown"],
      "verify_ssl": true
    }
  },
  "import_file": "",
  "gemini_api_key": "secret",
  "enable_daily_sync": false,
  "daily_sync_time": "09:00",
  "enable_weekly_report": false,
  "weekly_report_time": "17:30"
}
```

規則：

- 舊版 flat GitLab config 會自動 migration 至 `connections.gitlab`。
- 每個 provider 的 `project_ref_history` 去重並保留最近 10 筆。
- `GET /api/config` 遮蔽 secrets，只回傳 `token_configured` / `gemini_api_key_configured`。
- `POST /api/config` 的空白 secret 保留既有值。
- Active provider、base URL 或 project ref 改變時，清除 Issue cache、RAG index/jobs 與 `last_sync`。
- Backend `config.json` 仍以明碼保存 secrets。

## Issue Cache Schema v2

`issues_cache.json` 是 Dashboard、Analytics、Timeline、Table、報表與 RAG 的主要來源。

```json
{
  "schema_version": 2,
  "provider": "github",
  "source_ref": "microsoft/markitdown",
  "iid": 2019,
  "title": "Example issue",
  "state": "opened",
  "labels": ["bug"],
  "assignees": [],
  "milestone": {
    "title": "vNext",
    "start_date": null,
    "due_date": "2026-07-01"
  },
  "due_date": null,
  "created_at": "2026-01-01T00:00:00Z",
  "updated_at": "2026-01-02T00:00:00Z",
  "closed_at": null,
  "web_url": "https://github.com/microsoft/markitdown/issues/2019",
  "user_notes_count": 1,
  "has_new_discussions": false,
  "relation_counts_known": false,
  "merge_requests_count": 0,
  "blocking_issues_count": 0,
  "task_completion_status": {
    "count": 2,
    "completed_count": 1
  }
}
```

- GitHub `open` 正規化成 `opened`，Issue number 對應 `iid`。
- GitHub Issue due date、milestone start date、pipeline status 為 `null`。
- GitHub bulk sync 的 relation counts 通常未知；詳情頁 lazy-load 後才可顯示。
- `has_new_discussions` 由本次與上次 `user_notes_count` 比較產生。
- `provider` + `source_ref` 是 cache identity，不得跨來源混用。

## RAG

- `rag_index.json`：目前來源的 chunks、metadata 與 build summary。
- `rag_rebuild_jobs.json`：背景重建工作的狀態與結果。

RAG index 必須與目前 Issue cache 使用相同來源。切換 provider/repository 或清除 Issue cache 時，一併清除 RAG。

## AI 排程

AI 排程使用 backend-only JSON 檔保存任務與歷史：

- `ai_report_schedules.json`：AI 排程設定。包含 repo binding、整理類型、preferred model、發送時間、工作日、filter、Teams Webhook URL 與 `rebuild_index_before_send`。
- `ai_report_history.json`：執行歷史。保存 schedule/repo/report type/run type、issue count、成功狀態、錯誤訊息、index 時間與 started/finished 時間；不得保存 Teams Webhook URL。
- `project_pulse_jobs.json`：preview 或需要重建 index 的 background job 狀態，包含 `phase`、`progress`、`result` 與 `error`。
- `repos.json` 與 per-repo snapshot/index：記錄可被 AI 排程綁定的 repo，並保存該 repo 的 Issue cache 與 RAG index。

Frontend 只接收 masked webhook 狀態：`has_teams_webhook_url` 與 `teams_webhook_url_masked`。完整 URL 不得回傳前端，也不得寫入 history。

## Meta

`meta.json` 保存 `last_sync`、`last_report`、`latest_report_path` 與 `scheduler` 同日去重狀態，不保存業務內容。

## Arrange 與 Reports

- `reports/weekly_report_*.md`：週報 Markdown。
- `arrange_exports/scrape/`：provider Issue/comments 組成的 raw text。
- `arrange_exports/result/`：LLM 處理結果。
- `arrange_exports/excel/`：Excel 匯出。

Import JSON 模式優先於 provider API；由於沒有 live provider context，relation routes 回傳空陣列。

## Frontend localStorage

Frontend 只保存非 secret UI 狀態：

| Key                                   | 內容                                     |
| ------------------------------------- | ---------------------------------------- |
| `repo-radar:config-cache`             | Masked config 與 configured flags        |
| `repo-radar:ui-preferences`           | Theme、scale、sidebar、Chat/Arrange 模型 |
| `repo-radar:arrange-prompt-templates` | Arrange prompt templates                 |

Token 與 Gemini API key 不得保存於 localStorage。Electron main 另在 userData 保存 `external-link-preferences.json`。
