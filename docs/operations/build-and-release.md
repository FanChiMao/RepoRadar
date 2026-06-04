# Build And Release

## 本機建置

```powershell
npm.cmd run dist
```

流程：

1. `npm.cmd run build:ts` 編譯 `src/**/*.ts` 與 `frontend/**/*.ts` 至 `dist/`。
2. `npm.cmd run pack:backend` 使用 PyInstaller 封裝 `backend/app.py`。
3. `electron-builder` 產生 `release/Gitlab Tracker Setup <version>.exe` 與 `release/win-unpacked/`。

產品名稱、package name、appId 與 executable 均維持 `Gitlab Tracker` 現況。

## 封裝後路徑

- Backend executable：`resources/backend/dist/gitlab-tracker-backend/`
- App 資料：`app.getPath('userData')/tracker-data`
- Frontend：隨 app files 封裝

`nsis.deleteAppDataOnUninstall=true`，解除安裝會刪除 userData 內 tracker data。

## GitHub Actions 現況

- `.github/workflows/main.yml` 安裝依賴、建置 TypeScript 並執行 `npm run dist`。
- `.github/workflows/release.yml` 在 release/tag 流程建置與發佈。
- 目前 workflows **不執行** Python tests、compileall、Black 或 Prettier check；這些仍需在本機驗證。

本次文件同步不修改 workflows。

## 發版前檢查

```powershell
.\.venv\Scripts\python.exe -m unittest discover -s backend\tests -v
npm.cmd run build:ts
.\.venv\Scripts\python.exe -m compileall -q backend
.\.venv\Scripts\python.exe -m black --check backend
npx.cmd prettier --check README.md "docs/**/*.md" frontend/scripts/README.md package.json
git diff --check
npm.cmd run dist
```

安裝封裝版後確認：

- App 與 `/api/health` 正常。
- GitLab/GitHub connection test、儲存、同步與 provider 切換正常。
- GitLab MR/links 與 GitHub PR/dependencies/sub-issues 正常。
- RAG reindex/search/chat 正常。
- Arrange preview/process/export 同時涵蓋 GitLab/GitHub URLs。
- Markdown/HTML/PDF 與外部連結正常。
