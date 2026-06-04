# Gitlab Tracker 文件導覽

本目錄記錄 Gitlab Tracker 的產品行為、架構、Issue Provider、API、安全、品質與操作方式。實作以 `src/`、`frontend/`、`backend/` 與 `backend/tests/` 為準。

## 文件索引

| 分類       | 文件                                                                                                                                                                                                                                     |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 產品       | [product/README.md](product/README.md)、[product/PRD.md](product/PRD.md)、[product/project-flow.md](product/project-flow.md)、[product/user-flow.md](product/user-flow.md)                                                               |
| 架構       | [architecture/README.md](architecture/README.md)、[architecture/runtime-overview.md](architecture/runtime-overview.md)、[architecture/data-model.md](architecture/data-model.md)                                                         |
| 決策       | [ADR 0001](architecture/decisions/0001-electron-fastapi-split.md)、[ADR 0002](architecture/decisions/0002-no-frontend-framework.md)、[ADR 0003](architecture/decisions/0003-issue-provider-abstraction.md)                               |
| 規格       | [specs/API_SPEC.md](specs/API_SPEC.md)、[specs/GITHUB_PROVIDER.md](specs/GITHUB_PROVIDER.md)                                                                                                                                             |
| 操作       | [operations/README.md](operations/README.md)、[operations/local-setup.md](operations/local-setup.md)、[operations/build-and-release.md](operations/build-and-release.md)、[operations/troubleshooting.md](operations/troubleshooting.md) |
| 安全與品質 | [security/SECURITY.md](security/SECURITY.md)、[quality/NFR.md](quality/NFR.md)                                                                                                                                                           |
| 開發       | [CONTRIBUTING.md](CONTRIBUTING.md)、[GLOSSARY.md](GLOSSARY.md)                                                                                                                                                                           |

## 建議閱讀順序

1. 從[根目錄 README](../README.md)了解功能與啟動方式。
2. 閱讀[產品流程](product/project-flow.md)與[使用者流程](product/user-flow.md)。
3. 閱讀[runtime overview](architecture/runtime-overview.md)、[data model](architecture/data-model.md)與[Issue Provider ADR](architecture/decisions/0003-issue-provider-abstraction.md)。
4. 修改 backend route 或 provider 前先檢查[API 規格](specs/API_SPEC.md)與[GitHub Provider 規格](specs/GITHUB_PROVIDER.md)。
5. 開發與發版前依[本機設定](operations/local-setup.md)、[貢獻指南](CONTRIBUTING.md)與[安全文件](security/SECURITY.md)驗證。

## 文件維護原則

- 產品名稱、套件名稱與 executable 維持 `Gitlab Tracker`。
- 通用行為使用 Issue Provider、MR/PR 等中性用語；僅在平台專屬行為使用 GitLab 或 GitHub。
- API、config、cache schema、模型清單、測試數量與 CI 行為變更時，需同步更新相關文件。
- `.github/skills/**` 為通用設計技能資料，不屬於本專案開發文件。
