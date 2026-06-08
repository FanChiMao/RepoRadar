# Product

Repo Radar 將單一 GitLab project 或 GitHub repository 的 Issues 集中到桌面應用程式，提供同步、分析、Issue Detail、RAG Chat、Arrange 與報表。

## 文件導覽

| 文件                               | 內容                                                 |
| ---------------------------------- | ---------------------------------------------------- |
| [PRD.md](PRD.md)                   | 產品目標、範圍、限制與驗收                           |
| [project-flow.md](project-flow.md) | 從連線、同步、快取到報表的系統流程                   |
| [user-flow.md](user-flow.md)       | Connections、Dashboard、Detail、Chat 與 Arrange 操作 |

## 產品原則

- 一次啟用一個 provider 與一個 project/repository。
- GitLab/GitHub 資料正規化後共用 Dashboard、Analytics、RAG 與報表。
- UI 依 provider 動態顯示 MR 或 PR。
- GitHub 未提供的欄位明確顯示「GitHub 未提供」，不視為 `0` 或風險。
- GitHub relations 在 Issue Detail lazy-load，避免大量 API 請求。
- v1 為 read-only，不新增或修改 Issue/MR/PR。
