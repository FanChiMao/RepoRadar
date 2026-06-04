# Frontend Scripts

目前 frontend 採 partial-based 架構：

1. `frontend/index.html` 載入 `frontend/scripts/bootstrap.js`。
2. `bootstrap.js` 載入 `frontend/partials/*.html`。
3. partial 完成後載入編譯產物 `dist/frontend/scripts/legacy-app.js`。

主要互動邏輯仍集中在 `legacy-app.ts`。它負責 API 呼叫、畫面狀態、Dashboard、Analytics、Timeline、Issue Detail、Connections、Issue Arrange、RAG Chat 與 Preferences。

## Provider-aware UI

- Connections 可選擇 GitLab 或 GitHub，並透過 backend 測試連線。
- UI 依目前 provider 顯示 MR 或 PR。
- GitHub 未提供的 due date、milestone start date 與 pipeline status 必須顯示「GitHub 未提供」，不能視為 `0` 或逾期。
- GitHub relation list 不在清單階段預抓；Issue Detail 開啟時才 lazy-load，降低 secondary rate limit 風險。
- Secrets 不寫入 localStorage；frontend 只接收 `token_configured` 與 `gemini_api_key_configured`。

## 後續拆分方向

`legacy-app.ts` 已超過 6,000 行，是目前主要 frontend 技術債。拆分時應維持既有 partial 與 API contract，逐步移至下列模組：

```text
core/dom.ts
core/api.ts
core/state.ts
core/preferences.ts
pages/dashboard.ts
pages/analytics.ts
pages/timeline.ts
pages/arrange.ts
pages/connections.ts
pages/preferences.ts
widgets/issue-detail.ts
widgets/chat.ts
main.ts
```

在完成拆分前，新增功能應避免在各畫面散佈 provider 判斷；優先使用既有 provider metadata、capabilities 與共用 formatter。
