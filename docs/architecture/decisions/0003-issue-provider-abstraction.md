# ADR 0003 - Issue Provider 抽象層

- **狀態**：Accepted
- **日期**：2026-06-04

## Context

Dashboard、Analytics、Arrange、RAG、排程與報表原本直接依賴 GitLab client。若在 routes 與 frontend 分散加入 GitHub 判斷，平台欄位差異、rate limit 與 cache 隔離會難以維護。

## Decision

- 在 `backend/core/provider.py` 定義 `IssueProvider` protocol、factory 與 capabilities。
- GitLab/GitHub 一次只啟用一個 provider 與 project/repository。
- Provider 將資料正規化為共用 Issue schema v2。
- Cache 每筆資料包含 `provider`、`source_ref`、`schema_version`、`relation_counts_known`。
- 切換 provider、base URL 或 source ref 時清除 Issue cache、RAG index/jobs 與 `last_sync`。
- GitHub related PR、dependencies、parent、sub-issues 採詳情頁 lazy-load。

## Consequences

- Dashboard、Analytics、Arrange、RAG、排程與報表可持續使用共用資料 shape。
- GitHub 缺少的 due date、milestone start date、discussion threads 與 pipeline status 必須明確降級。
- 新 provider 必須實作 contract、normalizer、capabilities、錯誤處理與測試。
- 相容 route 可保留 MR 命名，但 response 必須以 `kind` 區分 MR/PR，UI 動態顯示。
- `app.py` 與 `legacy-app.ts` 仍偏大，後續需拆分 provider service 與 frontend 模組。
