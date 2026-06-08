# Local Setup

## 需求

- Windows 10/11
- Node.js 18+
- Python 3.12（`Start-RepoRadar.bat` 會檢查）
- Git

## 快速啟動

執行 `Start-RepoRadar.bat`，它會檢查 `npm.cmd` 與 Python 3.12、建立 `.venv`、安裝 `backend/requirements.txt`、必要時執行 `npm ci`，最後執行 `npm.cmd run dev`。

手動設定：

```powershell
npm.cmd install
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r backend\requirements.txt
npm.cmd run dev
```

Backend API：`http://127.0.0.1:8765`；Swagger UI：`http://127.0.0.1:8765/docs`。

## Connections

### GitLab

- Base URL：GitLab instance URL。
- Project Ref：project path 或 ID。
- Token：至少具有 `read_api`。
- `verify_ssl` 預設為 `false`，適合內網自簽環境，但有傳輸風險。

### GitHub

- Base URL：`https://github.com`。
- Project Ref：`owner/repo`。
- Public repo 可匿名測試；private repo 或完整同步建議使用 fine-grained token。
- GitHub v1 僅支援 github.com、read-only。

先使用 `Test Connection` 驗證 provider、project/repo、token 與 rate-limit，再儲存與同步。切換 provider/repository 後會清除 Issue/RAG cache。

## 單獨啟動 Backend

```powershell
.\.venv\Scripts\python.exe backend\app.py --port 8765
.\.venv\Scripts\python.exe backend\app.py --once fetch
.\.venv\Scripts\python.exe backend\app.py --once weekly-report
```

可用 `REPO_RADAR_DATA_DIR` 覆寫 `backend/data/`：

```powershell
$env:REPO_RADAR_DATA_DIR = "D:\repo-radar-data"
.\.venv\Scripts\python.exe backend\app.py
```

## 驗證

```powershell
.\.venv\Scripts\python.exe -m unittest discover -s backend\tests -v
npm.cmd run build:ts
.\.venv\Scripts\python.exe -m compileall -q backend
.\.venv\Scripts\python.exe -m black --check backend
npx.cmd prettier --check README.md "docs/**/*.md" frontend/scripts/README.md package.json
git diff --check
```

目前 13 個 Python tests 涵蓋 provider、normalizer、config migration/masking、rate limit 與 API integration。

## 首次功能驗證

1. GitLab：測試連線、同步、打開 Issue Detail 與 MR/links。
2. GitHub：以 `microsoft/markitdown` 測試，確認 Issue list 不含 PR，Issue `#2019` 顯示 comment 與 PR `#2066`。
3. 確認 GitHub 無 due date 時不產生錯誤逾期風險。
4. 執行 RAG reindex/search/chat。
5. 使用 GitLab/GitHub URL 測試 Arrange preview/process/export。
