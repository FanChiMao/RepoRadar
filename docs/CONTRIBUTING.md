# Contributing Guide

## 分支與 Commit

建議分支使用 `feat/<short-name>`、`fix/<short-name>` 或 `docs/<short-name>`，commit 使用 Conventional Commits：

```text
feat(provider): add GitHub issue comments
fix(rag): clear index when source changes
docs(api): document provider capabilities
```

## 實作原則

- 優先沿用現有 Electron、partial-based frontend、FastAPI 與 core service 邊界。
- Provider-specific API 呼叫放在 provider client；通用 route 與 UI 使用 normalized Issue shape。
- 新增 provider 欄位時需定義缺值降級策略，不能把「平台未提供」判斷成 `0` 或風險。
- Secrets 不得由 `GET /api/config` 回傳，也不得寫入 frontend localStorage。
- 修改 config 或 cache schema 時必須提供舊資料 migration 與 source identity 切換規則。
- `backend/app.py` 與 `frontend/scripts/legacy-app.ts` 仍偏大；新增程式碼應避免讓 routing、provider 或畫面條件耦合持續擴大。

## 必要文件

下列變更必須同步文件：

- API route/request/response：更新 [API_SPEC.md](specs/API_SPEC.md)。
- Provider contract、normalizer、capabilities：更新 [GITHUB_PROVIDER.md](specs/GITHUB_PROVIDER.md)與 ADR。
- Config/cache schema 或 migration：更新 [data-model.md](architecture/data-model.md)。
- UI 流程或產品限制：更新 [user-flow.md](product/user-flow.md)與 [PRD.md](product/PRD.md)。
- 安全行為：更新 [SECURITY.md](security/SECURITY.md)。

## 驗證

目前 repository 有 13 個 Python `unittest`，涵蓋 config migration/masking、GitHub PR 排除與 normalizer、comments、relations、rate limit、URL parsing、cache identity 與 API integration。

```powershell
.\.venv\Scripts\python.exe -m unittest discover -s backend\tests -v
npm.cmd run build:ts
.\.venv\Scripts\python.exe -m compileall -q backend
.\.venv\Scripts\python.exe -m black --check backend
npx.cmd prettier --check README.md "docs/**/*.md" frontend/scripts/README.md package.json
git diff --check
```

格式化可使用：

```powershell
.\.venv\Scripts\python.exe -m black backend
npx.cmd prettier --write README.md "docs/**/*.md" frontend/scripts/README.md package.json
```

GitHub Actions 目前只執行 TypeScript build、封裝與 release，不會執行 Python tests、Black 或 Prettier check；提交前需在本機完成上述驗證。

## Provider 測試要求

- Provider contract 與 normalizer 必須以 fixture 測試。
- GitHub list 測試必須確認排除 Pull Requests。
- 覆蓋 401、403、404、429、rate-limit exhaustion 與無 token情境。
- 覆蓋 provider/repository 切換後 Issue 與 RAG cache 不混用。
- GitHub 缺少 due date 等欄位時，不得產生錯誤逾期或 burndown 判定。
- 修改 API 時，需新增或更新 integration tests。
