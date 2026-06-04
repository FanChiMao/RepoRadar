# User Flow

## 首次設定

1. 開啟 `Connections`。
2. 選擇 GitLab 或 GitHub。
3. 輸入 project/repository 與 token；GitHub public repo token 可留空但額度有限。
4. 執行 `Test Connection`。
5. 設定 Gemini API key，儲存後執行 `Sync Now`。

Connection test 不會保存輸入內容。Frontend 只接收 secret configured flags，不保存 token/API key。

## 切換 Provider

1. 在 Connections 選擇另一 provider 或 project ref。
2. 執行 connection test 並儲存。
3. Backend 清除舊 Issue cache、RAG index/jobs 與 `last_sync`。
4. 執行同步，重新建立 dashboard；需要 Chat 時再重建 RAG。

## Dashboard 與 Issue Detail

- Dashboard/Analytics/Timeline/Table 共用 normalized Issues。
- 點選 Issue 開啟 detail overlay。
- GitLab 顯示 discussions、MR 與 linked issues。
- GitHub 顯示 normalized comments、PR、dependencies 與 sub-issues；relations 開啟 detail 才載入。
- GitHub 不支援的 due date、milestone start 或 pipeline 顯示「GitHub 未提供」。
- 可執行 AI discussion summary。

## AI Issue Chat

1. 同步 Issues。
2. 執行 RAG reindex，並從 status/jobs 觀察進度。
3. 開啟 AI Issue Chat，選擇 Chat/RAG 模型。
4. 輸入問題；回答會包含 mode 與 sources。

Chat/RAG 可用模型為 `gemini-3.5-flash`、`gemini-2.5-pro`、`gemma-4-26b-a4b-it`。

## Issue Arrange

支援輸入：

- GitLab：`https://gitlab.example.com/group/project/-/issues/42`
- GitLab filter：包含 `/-/issues?`
- GitHub：`https://github.com/owner/repo/issues/42`
- GitHub filter：`https://github.com/owner/repo/issues?...`

流程：

1. Preview 單一 Issue 或展開 filter。
2. 選擇/編輯 prompt template。
3. 執行 scrape，視需要使用 Arrange 模型。
4. 檢視 raw/result 與歷史。
5. 匯出 Excel。

Arrange 模型為 `gemini-2.5-pro`、`gemini-3.5-flash`。

## Preferences 與 Reports

Preferences 保存 theme、scale、sidebar、模型與 prompt templates，不保存 secrets。週報可產生 Markdown、HTML 與 PDF。
