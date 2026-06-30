# Security

## 安全模型

Repo Radar 是單機桌面應用程式。Electron 啟動 FastAPI backend，backend 只 bind `127.0.0.1:8765`。

```text
User -> Electron -> loopback FastAPI
                       |-> GitLab/GitHub
                       |-> Gemini
```

## Secrets

| Secret         | Backend 儲存            | Frontend      |
| -------------- | ----------------------- | ------------- |
| GitLab token   | `data/config.json` 明碼 | 不回傳/不保存 |
| GitHub token   | `data/config.json` 明碼 | 不回傳/不保存 |
| Gemini API key | `data/config.json` 明碼 | 不回傳/不保存 |

- `GET /api/config` 遮蔽 secret，只回傳 configured flags。
- `POST /api/config` blank secret 保留既有值。
- Frontend localStorage 不保存 secret 原文。
- Backend 明碼 config 仍是剩餘風險；正式 private repo 使用情境應導入 OS keyring。

## Loopback API 與 CORS

- Backend 只 bind loopback。
- CORS 允許 `null`、`http://127.0.0.1:8765`、`http://localhost:8765`。
- `allow_credentials=false`。
- Loopback API 採用 **per-launch session token**:`src/main.ts` 以 `crypto.randomBytes(32)` 產生 token,透過 `REPO_RADAR_SESSION_TOKEN` 環境變數傳給 backend,renderer 經 `getSessionToken` bridge 取得後,於每個請求帶上 `X-Session-Token` header。
  - Backend middleware 在 token 已設定時強制驗證,僅 `/api/health`(Electron readiness 探測需在 renderer 取得 token 前可用)與 CORS preflight(`OPTIONS`)豁免;驗證失敗回傳 `401 {"detail":"Invalid session."}`。
  - token 未設定(raw `uvicorn` 開發或測試)時略過驗證,維持既有流程。
  - 此機制能阻擋同機其他程式直接呼叫 API,但 token 仍是明碼經環境變數傳遞,屬剩餘風險。

## Provider 權限與傳輸

- GitLab token 建議最小 `read_api`；GitLab `verify_ssl` 預設 `false`，自簽環境方便但有 MITM 風險。
- GitHub public repo 可匿名；private repo 使用只授予目標 repo 與 Issues read-only 的 fine-grained token。
- GitHub v1 固定驗證 HTTPS，僅支援 github.com。
- Gemini key 置於 upstream URL query，log 不得輸出完整 URL。

## 已知風險

| 風險                        | 狀態/緩解                                                      |
| --------------------------- | -------------------------------------------------------------- |
| Backend config 明碼 secret  | 尚未解決；限制 OS 檔案權限，規劃 OS keyring                    |
| 同機其他程式呼叫 API        | 以 per-launch session token(`X-Session-Token`)驗證,搭配 CORS 與 loopback bind |
| GitLab `verify_ssl=false`   | 使用者需確認內網信任；正式環境應開啟驗證                       |
| Renderer XSS                | Provider title/body 屬外部資料；使用 `innerHTML` 前必須 escape |
| LLM prompt injection        | AI output 只作文字顯示，不執行；不得把 secrets 放入 prompt     |
| GitHub secondary rate limit | Lazy relations、bounded retry、bounded concurrency             |
| External URL phishing       | Electron 使用受控 bridge 與瀏覽器選擇流程                      |

## Electron Renderer

`src/main.ts` 使用：

- `contextIsolation: true`
- `nodeIntegration: false`
- Preload 只暴露 `openFileDialog`、`openPath`、`exportPdf`、`getAppVersion`、`getSessionToken`

## 資料清除與回報

NSIS `deleteAppDataOnUninstall=true`，解除安裝會刪除 userData tracker data。安全問題請私人聯絡維護者，不要在 public issue 公開 tokens、Issue 內容或內部 URL。
