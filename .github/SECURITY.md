# Security Policy

## 支援版本

Repo Radar 僅針對**最新發行版本**提供安全修補。回報前請先確認問題在 [latest release](https://github.com/FanChiMao/RepoRadar/releases/latest) 仍可重現。

| 版本           | 是否支援 |
| -------------- | -------- |
| 最新 release   | ✅       |
| 較舊版本       | ❌       |

## 回報安全漏洞

**請勿在公開 Issue、Discussion 或 PR 中揭露安全漏洞。**

請改用 GitHub 私密回報管道:

1. 進入 repo 的 **Security** 分頁。
2. 點選 **Report a vulnerability**(Private vulnerability reporting）。
3. 描述問題、重現步驟與可能影響。

回報時請避免貼出 token、Issue 內容或內部 URL 等機密資訊。我們會在確認後盡快回覆並協調修補與揭露時程。

## 安全模型摘要

Repo Radar 是單機 Electron + 本機 FastAPI(loopback)桌面應用,主要安全考量包含:

- Backend 只 bind `127.0.0.1:8765`,並以 per-launch session token(`X-Session-Token`)驗證請求。
- Provider token 與 Gemini API key 以明碼存於 backend `config.json`,`GET /api/config` 不回傳機密。
- Provider 標題/內文屬外部資料,renderer 顯示前需 escape;LLM 輸出只作文字顯示,不執行。

完整安全模型、已知風險與緩解措施請見 [詳細安全文件](../docs/security/SECURITY.md)。
