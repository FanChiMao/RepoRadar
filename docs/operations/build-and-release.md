# Build And Release

## 本機建置

```powershell
npm.cmd run dist
```

流程：

1. `npm.cmd run build:ts` 編譯 `src/**/*.ts` 與 `frontend/**/*.ts` 至 `dist/`。
2. `npm.cmd run pack:backend` 使用 PyInstaller 封裝 `backend/app.py`。
3. `electron-builder` 產生 `release/Repo Radar Setup <version>.exe` 與 `release/win-unpacked/`。

產品名稱、package name、appId 與 executable 均維持 `Repo Radar` 現況。

## 封裝後路徑

- Backend executable：`resources/backend/dist/repo-radar-backend/`
- App 資料：`app.getPath('userData')/repo-radar-data`
- Frontend：隨 app files 封裝

`nsis.deleteAppDataOnUninstall=true`，解除安裝會刪除 userData 內 tracker data。

## GitHub Actions 現況

- `.github/workflows/main.yml`（CI）：每次 push / PR 安裝依賴、建置 TypeScript 並執行 `npm run dist -- --publish never`，產物以 artifact 上傳，不發佈。
- `.github/workflows/release.yml`（Release）：在 push `v*` tag 時建置並透過 `electron-builder --win --publish always` 發佈。
- 目前 workflows **不執行** Python tests、compileall、Black 或 Prettier check；這些仍需在本機驗證。

## 自動發佈到 GitHub Release

`package.json` 的 `build.publish` 設定為：

```json
{
  "provider": "github",
  "owner": "FanChiMao",
  "repo": "RepoRadar",
  "releaseType": "release"
}
```

- `releaseType: "release"` 讓 electron-builder 直接建立**公開 release**（不是草稿），push tag 後別人立即能在 Releases 頁面下載 `Repo Radar Setup <version>.exe`。
- 若想先人工檢查再公開，改成 `"draft"`；想標記為測試版改成 `"prerelease"`。
- 隨安裝檔一併上傳的 `latest.yml` 與 `.blockmap` 供 `electron-updater` 自動更新使用，公開 release 後舊版才偵測得到更新。

## 發版步驟（tag 與 release）

> **關鍵：tag 必須對應 `package.json` 的 `version`。** electron-builder 以 `version` 決定 release 名稱與檔名；tag `vX.Y.Z` 要對應 version `X.Y.Z`，否則發佈時可能找不到對應 release 而失敗。

1. 完成上方「發版前檢查」全部通過。
2. 在 `package.json` bump `version`（例如 `1.2.4` → `1.2.5`），commit 進 `main`。
3. 建立並推送對應 tag：

   ```powershell
   git tag v1.2.5
   git push origin v1.2.5
   ```

4. `release.yml` 自動觸發，建置完成後安裝檔會出現在 Releases 頁面。
5. 到 GitHub Releases 確認 `.exe`、`latest.yml`、`.blockmap` 皆已上傳且 release 為公開狀態。

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
