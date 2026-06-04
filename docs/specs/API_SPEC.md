# API Spec

Gitlab Tracker backend 是本機 FastAPI 服務。

- Base URL：`http://127.0.0.1:8765`
- Swagger UI：`http://127.0.0.1:8765/docs`
- JSON 錯誤格式：`{"detail":"..."}`
- CORS：僅允許 `null`、`http://127.0.0.1:8765`、`http://localhost:8765`
- Loopback API 目前無 session authentication。

## Health、Config 與 Provider

### `GET /api/health`

回傳 `{"status":"ok"}`。

### `GET /api/config`

回傳 masked nested config。`token` 與 `gemini_api_key` 固定為空字串，以 configured flags 表示是否已設定。

```json
{
  "active_provider": "github",
  "connections": {
    "gitlab": {
      "base_url": "https://gitlab.example.com",
      "token": "",
      "token_configured": true,
      "project_ref": "group/project",
      "project_ref_history": ["group/project"],
      "verify_ssl": false
    },
    "github": {
      "base_url": "https://github.com",
      "token": "",
      "token_configured": true,
      "project_ref": "microsoft/markitdown",
      "project_ref_history": ["microsoft/markitdown"],
      "verify_ssl": true
    }
  },
  "import_file": "",
  "gemini_api_key": "",
  "gemini_api_key_configured": true,
  "enable_daily_sync": true,
  "daily_sync_time": "09:00",
  "enable_weekly_report": true,
  "weekly_report_time": "17:30"
}
```

### `POST /api/config`

接受上述 nested config。Blank secret 保留 backend 既有值。舊 flat GitLab 欄位仍可 migration。

副作用：

- 維護各 provider 最近 10 筆 `project_ref_history`。
- Active provider、base URL 或 project ref 改變時清除 Issue cache、RAG index/jobs 與 `last_sync`。
- Response 為 masked public config。

### `POST /api/connection/test`

不保存設定、不清除 cache，測試 provider、repo/project、token 與權限。空白欄位沿用已保存設定。

```json
{
  "provider": "github",
  "base_url": "https://github.com",
  "token": "github_pat_secret",
  "project_ref": "microsoft/markitdown"
}
```

GitHub response 包含 `provider`、`source_ref`、`name`、`private`、`default_branch`、`rate_limit_remaining` 與 `rate_limit`。GitLab 回傳對應 project metadata。

### `GET /api/source/capabilities`

回傳 active provider 可用能力：

```json
{
  "provider": "github",
  "source_ref": "microsoft/markitdown",
  "issue_due_date": false,
  "milestone_start_date": false,
  "milestone_due_date": true,
  "discussion_threads": false,
  "related_change_kind": "pull_request",
  "issue_dependencies": true,
  "sub_issues": true,
  "pipeline_status": false,
  "anonymous_public_read": true,
  "bounded_concurrency": 1
}
```

## Sync、Dashboard 與 Issues

### `POST /api/fetch`

從 Import JSON 或 active provider 同步 normalized Issues，寫入 cache 並比較 comment count。

```json
{ "count": 394 }
```

### `GET /api/dashboard`

回傳 `summary`、`weekly_new`、`focus_progress`、`risks`、`last_sync`、`last_report`、`issue_count` 與 `latest_report_path`。

### `GET /api/issues`

回傳 simplified Issue array。主要欄位：

```json
{
  "schema_version": 2,
  "provider": "github",
  "source_ref": "microsoft/markitdown",
  "iid": 2019,
  "title": "Example",
  "state": "opened",
  "labels": ["bug"],
  "assignees": [],
  "milestone": null,
  "milestone_start_date": null,
  "milestone_due_date": null,
  "due_date": null,
  "web_url": "https://github.com/microsoft/markitdown/issues/2019",
  "user_notes_count": 1,
  "has_new_discussions": false,
  "relation_counts_known": false
}
```

### `POST /api/issues/detail-by-url`

取得 GitLab/GitHub URL 的完整 bundle。

```json
{ "url": "https://github.com/microsoft/markitdown/issues/2019" }
```

Response 包含 `issue`、`discussions`、`merge_requests`、`links`、`provider`、`project_ref` 與 `source_url`。

### `GET /api/issues/{iid}/discussions`

回傳 normalized discussions。GitHub 每則 flat comment 會包成一個單 note discussion。Import JSON 模式回傳 `[]`。

### `GET /api/issues/{iid}/merge-requests`

相容 route：GitLab 回傳 related MRs；GitHub 回傳 related PRs。每筆以 `kind: "merge_request" | "pull_request"` 區分。404 relation 降級為 `[]`，Import JSON 模式亦回傳 `[]`。

### `GET /api/issues/{iid}/links`

GitLab 回傳 linked issues；GitHub 回傳明確 dependencies、parent 與 sub-issues，不包含一般文字引用。404 或 Import JSON 模式回傳 `[]`。

### `POST /api/issues/{iid}/discussions/summary`

讀取 active provider discussions/comments 並使用 Gemini/Gemma 摘要。

```json
{ "summary": "..." }
```

需要 Gemini API key；無 discussions 時回傳說明文字。

## Issue Arrange

支援 GitLab/GitHub 單一 Issue URL 與 repository Issues filter URL。

### `POST /api/arrange/preview`

```json
{ "urls": ["https://github.com/microsoft/markitdown/issues/2019"] }
```

回傳 `count`、`issues` preview 與逐 URL `errors`。

### `POST /api/arrange/resolve-filter`

```json
{
  "filter_url": "https://github.com/microsoft/markitdown/issues?q=is%3Aissue+is%3Aopen"
}
```

回傳 `count`、`provider`、`project_ref` 與 `issues`。

### `POST /api/arrange/process`

Scrape 後執行 LLM：

```json
{
  "url": "https://github.com/microsoft/markitdown/issues/2019",
  "system_prompt": "請整理成繁體中文摘要",
  "preferred_model": "gemini-2.5-pro",
  "model_candidates": ["gemini-2.5-pro", "gemini-3.5-flash"]
}
```

回傳 `issue`、`raw_text`、`result`、`model`、`saved_raw_path`、`saved_result_path`。

### `POST /api/arrange/scrape`

接受與 process 相同 payload，只取得 provider Issue/comments 並回傳 `issue`、`raw_text`、`saved_raw_path`。

### `POST /api/arrange/llm`

不重新抓 provider：

```json
{
  "url": "https://github.com/microsoft/markitdown/issues/2019",
  "raw_text": "# Issue ...",
  "system_prompt": "請整理",
  "preferred_model": "gemini-2.5-pro",
  "model_candidates": ["gemini-2.5-pro", "gemini-3.5-flash"]
}
```

回傳 `result`、`model`、`saved_result_path`。

### `POST /api/arrange/export-excel`

接受 `{"urls":[...]}`，回傳 `path`、`count`、`errors`。

### `GET /api/arrange/history`

回傳 `root_path` 與 `files`，每筆包含 `filename`、`kind`、`size`、`mtime`、`path`。

### `GET /api/arrange/history/{filename}`

回傳歷史檔 metadata；非 Excel 增加 `content`。無效檔名為 400，不存在為 404。

## RAG 與 Chat

### `GET /api/rag/status`

回傳目前 index summary：`built_at`、`issue_count`、`indexed_issues`、`skipped_issues`、`reused_issues`、`rebuilt_issues`、`chunk_count`。

### `GET /api/rag/jobs`

回傳 `{"jobs":[...]}`。

### `GET /api/rag/jobs/{job_id}`

回傳單一 rebuild job；不存在為 404。

### `POST /api/rag/reindex`

以目前 Issue cache 啟動背景重建，回傳 job。無 cache 為 400。

### `POST /api/rag/search`

```json
{
  "query": "CSV conversion",
  "top_k": 8,
  "state": "opened",
  "labels": ["bug"],
  "assignees": []
}
```

`top_k` 限制為 1 至 20。回傳 `query`、`count`、`results`。

### `POST /api/chat`

```json
{
  "question": "目前主要風險是什麼？",
  "history": [{ "role": "user", "content": "先看 open issues" }],
  "preferred_model": "gemini-3.5-flash",
  "model_candidates": ["gemini-3.5-flash", "gemini-2.5-pro", "gemma-4-26b-a4b-it"],
  "use_rag": true,
  "top_k": 6
}
```

History 最多使用最近 10 筆；Chat RAG `top_k` 上限 10。回傳：

```json
{
  "answer": "...",
  "model": "gemini-3.5-flash",
  "mode": "rag",
  "sources": [
    {
      "issue_iid": 2019,
      "chunk_id": "...",
      "title": "...",
      "score": 0.9,
      "source_type": "discussion"
    }
  ]
}
```

若無 RAG 結果，`mode="issue_list"` 且 `sources=[]`。

## Analytics 與 Reports

### `GET /api/analytics`

回傳 `burndown`、`workload`、`alerts`、`delivery`、`label_distribution` 與 `lifecycle`。平台未提供的 dates 不得產生逾期風險。

### `POST /api/report/weekly`

產生 Markdown，回傳 `{"report_path":"..."}`。

### `GET /api/report/html`

回傳可供 Electron print-to-PDF 的 `html` 與 `generated_at`。

### `GET /api/reports/latest`

回傳最後一份 Markdown 的 `report_path` 與 `content`；沒有報表時兩者為 `null`。

## Error Mapping

| Status | 情境                                                                       |
| ------ | -------------------------------------------------------------------------- |
| 400    | 驗證失敗、缺 project/ref/key/cache、URL/filter 不支援                      |
| 401    | Provider token 無效                                                        |
| 403    | Provider 權限不足或 GitHub rate limit/secondary limit                      |
| 404    | Repo/project/Issue/job/history 不存在；relation route 的 404 會降級為 `[]` |
| 429    | GitHub/Gemini rate limit；GitHub provider bounded retry 後仍失敗           |
| 500    | RAG/Excel/未預期 backend 錯誤                                              |
| 502    | Provider 或 Gemini upstream 失敗                                           |

GitHub provider 對 403/429/rate-limit exhaustion 最多嘗試 3 次，單次等待上限 5 秒。詳細平台行為見 [GitHub Provider](GITHUB_PROVIDER.md)。
