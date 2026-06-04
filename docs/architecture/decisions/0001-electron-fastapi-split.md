# ADR 0001 - Electron 前端與 Python FastAPI 後端

- **狀態**：Accepted
- **日期**：2025

## Context

產品需要桌面 UI、本機檔案、外部連結、PDF 匯出，以及 provider REST API、資料分析、LLM、RAG 與 Excel 處理。

## Decision

採用 Electron + Python FastAPI 雙 process：

- Electron main 負責視窗、backend lifecycle、受限 IPC、外部連結與 PDF。
- FastAPI bind `127.0.0.1:8765`，處理 provider、cache、分析、AI、Arrange、報表與排程。
- Renderer 透過 loopback HTTP 呼叫業務 API；IPC 僅處理桌面能力。

## Consequences

優點：

- Backend 可獨立啟動、測試與封裝。
- Frontend/backend contract 可由 [API 規格](../../specs/API_SPEC.md)管理。
- GitLab/GitHub provider 與資料處理可使用 Python 生態。

代價：

- 需等待 backend health check，port `8765` 衝突目前無 fallback。
- Build 同時包含 TypeScript、PyInstaller 與 electron-builder。
- Loopback API 目前無驗證，必須限制 CORS 並避免回傳 secrets。
