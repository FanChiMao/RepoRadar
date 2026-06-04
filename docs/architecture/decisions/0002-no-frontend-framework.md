# ADR 0002 - Renderer 不使用前端框架

- **狀態**：Accepted
- **日期**：2025

## Context

Renderer 主要為表單、tabs、圖表、Issue Detail、Connections、Arrange 與 Chat。專案希望維持低 runtime 複雜度。

## Decision

採用 Vanilla TypeScript、直接 DOM 操作與 HTML partials，不引入 React、Vue 或 Svelte：

- [frontend/index.html](../../../frontend/index.html) 提供入口。
- `frontend/scripts/bootstrap.js` 載入 `frontend/partials/*`。
- [legacy-app.ts](../../../frontend/scripts/legacy-app.ts) 負責事件、狀態與 API 呼叫。

## Consequences

優點：

- 不增加 framework runtime 與 migration 成本。
- Partial、styles 與 TypeScript 可逐步拆分。

代價：

- `legacy-app.ts` 已超過 6,000 行，狀態與 provider-aware UI 維護成本高。
- 直接使用 `innerHTML` 時必須 escape 外部 provider 內容。

## Guideline

- 修改 UI 前先找對應 partial 與 selector。
- 使用 capabilities 與共用 formatter，避免散佈 GitLab/GitHub 條件。
- 新功能應朝 `core/`、`pages/`、`widgets/` 模組逐步拆分。
