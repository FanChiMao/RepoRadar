type AppConfig = {
  active_provider: 'gitlab' | 'github';
  connections: Record<
    'gitlab' | 'github',
    {
      base_url: string;
      token: string;
      token_configured: boolean;
      project_ref: string;
      project_ref_history: string[];
      verify_ssl: boolean;
    }
  >;
  import_file: string;
  gemini_api_key: string;
  gemini_api_key_configured: boolean;
  enable_daily_sync: boolean;
  daily_sync_time: string;
  enable_weekly_report: boolean;
  weekly_report_time: string;
};

type RetrievalMode = 'auto' | 'fast-rag' | 'context-trace';
type ResolvedRetrievalMode = 'fast-rag' | 'context-trace' | 'issue-list';

type ChatSource = {
  issue_iid: number;
  chunk_id: string;
  title: string;
  score: number;
  source_type: string;
  web_url?: string | null;
  discussion_id?: string | null;
  note_ids?: number[];
};

type ChatResponse = {
  answer: string;
  model: string;
  mode: 'rag' | 'issue_list';
  retrieval_mode?: ResolvedRetrievalMode;
  sources: ChatSource[];
};

type RagRebuildJob = {
  job_id: string;
  status: 'queued' | 'running' | 'completed' | 'failed';
  progress: number;
  created_at: string;
  updated_at: string;
  issue_count: number;
  indexed_issues: number;
  skipped_issues: number;
  chunk_count: number;
  current_issue_iid?: number | null;
  error?: string | null;
  result?: {
    built_at: string;
    issue_count: number;
    indexed_issues: number;
    skipped_issues: number;
    chunk_count: number;
  } | null;
};

type RagIndexStatus = {
  built_at: string | null;
  issue_count: number;
  indexed_issues: number;
  skipped_issues: number;
  chunk_count: number;
};

type DiscussionJumpTarget = {
  issue_iid: number;
  discussion_id?: string | null;
  note_ids?: number[];
};

const MAX_PROJECT_REF_HISTORY = 10;
const MIN_SIDEBAR_WIDTH = 248;
const MAX_SIDEBAR_WIDTH = 360;
const LOCAL_CONFIG_CACHE_KEY = 'repo-radar:config-cache';
const UI_PREFERENCES_KEY = 'repo-radar:ui-preferences';
const ARRANGE_PROMPT_TEMPLATES_KEY = 'repo-radar:arrange-prompt-templates';
// Azure 模型（顯示名稱須與 backend/.env 的 AZURE_LLM_MODEL_* 第一欄一致）
const AZURE_LLM_MODEL_LIST = ['gpt-5.4', 'Kimi-K2.5', 'claude-opus'];
const DEFAULT_GEMINI_MODEL_LIST = [
  'gemini-2.5-pro',
  'gemini-3.5-flash',
  'gemini-2.5-flash',
  'gemma-4-31b-it',
  'gemma-4-26b-a4b-it',
  ...AZURE_LLM_MODEL_LIST,
];
const ARRANGE_GEMINI_MODEL_LIST = ['gemini-2.5-pro', 'gemini-3.5-flash', ...AZURE_LLM_MODEL_LIST];
const CHAT_RAG_GEMINI_MODEL_LIST = [
  'gemini-3.5-flash',
  'gemini-2.5-pro',
  'gemma-4-26b-a4b-it',
  ...AZURE_LLM_MODEL_LIST,
];
const PULSE_LLM_MODEL_LIST = [
  ...AZURE_LLM_MODEL_LIST,
  ...CHAT_RAG_GEMINI_MODEL_LIST.filter((model) => !AZURE_LLM_MODEL_LIST.includes(model)),
];
const DISCUSSION_SUMMARY_GEMINI_MODEL_LIST = ['gemini-2.5-flash', 'gemma-4-31b-it'];
const DEFAULT_GEMINI_MODEL = ARRANGE_GEMINI_MODEL_LIST[0];
const DEFAULT_CHAT_RAG_MODEL = CHAT_RAG_GEMINI_MODEL_LIST[0];
const DEFAULT_PULSE_LLM_MODEL = PULSE_LLM_MODEL_LIST[0];
const RETRIEVAL_MODE_LIST: RetrievalMode[] = ['auto', 'fast-rag', 'context-trace'];
const DEFAULT_RETRIEVAL_MODE: RetrievalMode = 'auto';
const RETRIEVAL_MODE_LABELS: Record<ResolvedRetrievalMode | 'auto', string> = {
  auto: '自動',
  'fast-rag': '快速檢索',
  'context-trace': '脈絡追蹤',
  'issue-list': 'Issue 清單',
};
const DEFAULT_UI_PREFERENCES = {
  theme: 'dark',
  scale: 100,
  sidebarWidth: 304,
  geminiModel: DEFAULT_GEMINI_MODEL,
  chatRagModel: DEFAULT_CHAT_RAG_MODEL,
  retrievalMode: DEFAULT_RETRIEVAL_MODE,
  geminiModelList: [...DEFAULT_GEMINI_MODEL_LIST],
  arrangePrompt: `你是一位資深技術 PM，請根據提供的 Issue 原始資料，整理成清楚、可追蹤的中文摘要。

請用以下段落輸出：
## 問題摘要
## 現況判讀
## 風險與阻塞
## 建議行動
## 驗收與追蹤

要求：
- 保留具體事實，不要猜測不存在的資訊
- 如果資訊不足，要明確寫出缺口
- 以繁體中文撰寫
- 盡量精簡但保有可執行性`,
} as const;

type DashboardResponse = {
  summary: Record<string, number | string | null>;
  weekly_new: any[];
  focus_progress: any[];
  risks: any[];
  last_sync: string | null;
  issue_count: number;
};

type IssueItem = {
  iid: number;
  provider: 'gitlab' | 'github' | 'import';
  source_ref: string | null;
  schema_version: number;
  relation_counts_known: boolean;
  title: string;
  state: string;
  module: string | null;
  labels: string[];
  assignees: string[];
  assignee_details: Array<{
    name: string;
    username: string | null;
    avatar_url: string | null;
  }>;
  milestone: string | null;
  milestone_start_date: string | null;
  milestone_due_date: string | null;
  created_at: string | null;
  updated_at: string | null;
  closed_at: string | null;
  due_date: string | null;
  web_url: string | null;
  issue_type: string | null;
  merge_requests_count: number;
  blocking_issues_count: number;
  task_total: number;
  task_completed: number;
  user_notes_count: number;
  has_new_discussions: boolean;
  note: string | null;
  reason: string | null;
};

type DiscussionNote = {
  id: number;
  body: string;
  author_name: string;
  author_username: string;
  author_avatar_url: string;
  created_at: string | null;
  updated_at: string | null;
};

type Discussion = {
  id: string;
  notes: DiscussionNote[];
};

type MergeRequestInfo = {
  id: number;
  iid: number;
  title: string;
  state: string;
  draft: boolean;
  web_url: string | null;
  created_at: string | null;
  updated_at: string | null;
  merged_at: string | null;
  merge_status: string | null;
  source_branch: string | null;
  target_branch: string | null;
  author_name: string;
  author_username: string;
  author_avatar_url: string;
  head_pipeline_status: string | null;
  kind?: 'merge_request' | 'pull_request';
  relation_kind?: string;
};

type LinkedIssueRef = {
  iid: number;
  title: string;
  state: string;
  web_url: string | null;
  labels: string[];
  assignees: string[];
  milestone: string | null;
  due_date: string | null;
};

type LinkedItemInfo = {
  id: number;
  link_type: string;
  direction: 'inbound' | 'outbound' | 'unknown';
  issue: LinkedIssueRef;
};

type IssueDetailBundle = {
  issue: IssueItem;
  discussions: Discussion[];
  merge_requests: MergeRequestInfo[];
  links: LinkedItemInfo[];
  project_ref?: string;
  source_url?: string;
};

type BurndownPoint = {
  date: string;
  open: number;
  total: number;
  closed: number;
  ideal: number;
};

type BurndownMilestone = {
  milestone: string;
  start_date: string | null;
  due_date: string | null;
  total: number;
  open: number;
  closed: number;
  series: BurndownPoint[];
};

type GanttQuickView =
  | 'custom'
  | 'overdue'
  | 'due_soon'
  | 'unassigned'
  | 'no_due_date'
  | 'active_milestones';
type GanttGroupBy = 'none' | 'milestone' | 'assignee' | 'module';
type GanttRiskFlag = 'overdue' | 'due_soon' | 'no_due_date' | 'unassigned' | 'stale';
type TimelineViewMode = 'gantt' | 'calendar';
type TimelineRangeMode = 'month' | 'week';

type WorkloadEntry = {
  assignee: string;
  avatar_url: string;
  total: number;
  opened: number;
  closed: number;
  overdue: number;
  due_soon: number;
};

type AlertEntry = IssueItem & {
  severity: 'overdue' | 'critical' | 'warning';
  days_until_due: number;
};

type LabelDistEntry = {
  label: string;
  total: number;
  open: number;
};

type LifecycleData = {
  mttr_days: number | null;
  median_days: number | null;
  p90_days: number | null;
  total_closed: number;
  histogram: { bucket: string; count: number }[];
  throughput: { month: string; count: number }[];
};

type AnalyticsResponse = {
  burndown: BurndownMilestone[];
  workload: WorkloadEntry[];
  alerts: AlertEntry[];
  label_distribution: LabelDistEntry[];
  lifecycle: LifecycleData;
};

type ThemeMode = 'dark' | 'light';
type GeminiModel = string;

type UiPreferences = {
  theme: ThemeMode;
  scale: number;
  sidebarWidth: number;
  geminiModel: GeminiModel;
  chatRagModel: GeminiModel;
  retrievalMode: RetrievalMode;
  geminiModelList: string[];
  arrangePrompt: string;
};

type ArrangePreviewIssue = {
  iid: number;
  title: string;
  web_url: string;
  state: string;
  assignees: string[];
  milestone: {
    title: string;
    due_date: string;
  } | null;
  labels: string[];
};

type ArrangeJobStatus = 'previewed' | 'running' | 'done' | 'error';
type ArrangePhaseStatus = 'waiting' | 'running' | 'success' | 'error' | 'skipped';
type ArrangePromptTemplate = {
  id: string;
  name: string;
  content: string;
  readonly?: boolean;
};

type ArrangeJob = ArrangePreviewIssue & {
  id: string;
  raw_text: string;
  result: string;
  status: ArrangeJobStatus;
  scrapeStatus: ArrangePhaseStatus;
  llmStatus: ArrangePhaseStatus;
  exportStatus: ArrangePhaseStatus;
  error: string | null;
  model: string | null;
};

type ArrangeHistoryKind = 'raw' | 'scrape' | 'result' | 'excel';
type ArrangeHistoryPreviewMode = 'markdown' | 'raw';

type ArrangeHistoryFile = {
  filename: string;
  kind: ArrangeHistoryKind;
  size: number;
  mtime: string;
  path: string;
};

type ArrangeHistoryFileResponse = {
  filename: string;
  kind: ArrangeHistoryKind;
  path: string;
  content?: string;
};

/* ── State ── */
const state = {
  currentConfig: null as AppConfig | null,
  allIssues: [] as IssueItem[],
  mergeRequestsByIid: new Map<number, MergeRequestInfo[]>(),
  issueLinksByIid: new Map<number, LinkedItemInfo[]>(),
  pendingMergeRequestLoads: new Set<number>(),
  pendingIssueLinkLoads: new Set<number>(),
  tableSort: { key: 'iid' as string, asc: false },
  analytics: null as AnalyticsResponse | null,
  ganttCollapsedGroups: new Set<string>(),
  timelineViewMode: 'gantt' as TimelineViewMode,
  timelineRangeMode: 'month' as TimelineRangeMode,
  ganttMonth: '',
  ganttWeek: '',
  currentView: 'dashboard',
  chatDockOpen: false,
  uiPreferences: createDefaultUiPreferences(),
  arrangePromptTemplates: [] as ArrangePromptTemplate[],
  selectedArrangePromptTemplateId: '' as string,
  arrangeJobs: [] as ArrangeJob[],
  selectedArrangeJobId: null as string | null,
  arrangeHistoryFiles: [] as ArrangeHistoryFile[],
  selectedArrangeHistoryFilename: null as string | null,
  selectedArrangeHistoryContent: '請從左側選一筆歷史存檔。' as string,
  arrangeHistoryPreviewMode: 'markdown' as ArrangeHistoryPreviewMode,
  arrangeHistoryRootPath: '' as string,
  arrangeBatchRunning: false,
  arrangeBatchAbortController: null as AbortController | null,
  ragUi: {
    statusChecked: false,
    hasUsableIndex: false,
    rebuildFailedWithoutIndex: false,
    rebuilding: false,
    rebuildJobId: '',
    rebuildProgress: 0,
    rebuildStatusText: '',
  },
  pendingDiscussionJump: null as DiscussionJumpTarget | null,
};

/* ── Helpers ── */
function byId<T extends HTMLElement>(id: string): T {
  return document.getElementById(id) as T;
}

function getById<T extends HTMLElement>(id: string): T | null {
  return document.getElementById(id) as T | null;
}

function ensureGanttTooltip(): HTMLDivElement {
  const existing = getById<HTMLDivElement>('gantt-tooltip');
  if (existing) return existing;

  const tooltip = document.createElement('div');
  tooltip.id = 'gantt-tooltip';
  tooltip.className = 'gantt-tooltip';
  tooltip.setAttribute('aria-hidden', 'true');
  document.body.appendChild(tooltip);
  return tooltip;
}

function setStatus(text: string, type: 'idle' | 'success' | 'warn' | 'error' = 'idle') {
  const pill = byId<HTMLDivElement>('status-pill');
  pill.textContent = text;
  pill.className = `status-pill ${type}`;

  const panel = getById<HTMLElement>('status-panel-details');
  if (panel) {
    panel.classList.remove('status-idle', 'status-success', 'status-warn', 'status-error');
    panel.classList.add(`status-${type}`);
  }
}

function clampUiScale(value: number): number {
  return Math.min(120, Math.max(90, Math.round(value / 5) * 5));
}

function clampSidebarWidth(value: number): number {
  return Math.min(MAX_SIDEBAR_WIDTH, Math.max(MIN_SIDEBAR_WIDTH, Math.round(value)));
}

function normalizeGeminiModelList(value: unknown): string[] {
  const rawValues = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(/\r?\n/g)
      : [];
  const uniqueModels: string[] = [];
  for (const rawValue of rawValues) {
    const normalized = String(rawValue || '').trim();
    if (
      normalized &&
      DEFAULT_GEMINI_MODEL_LIST.includes(normalized) &&
      !uniqueModels.includes(normalized)
    ) {
      uniqueModels.push(normalized);
    }
  }
  return uniqueModels;
}

function sanitizeGeminiModelList(value: unknown): string[] {
  const uniqueModels = normalizeGeminiModelList(value);
  for (const model of DEFAULT_GEMINI_MODEL_LIST) {
    if (!uniqueModels.includes(model)) {
      uniqueModels.push(model);
    }
  }
  return uniqueModels;
}

function coerceGeminiModel(
  value: string | undefined,
  candidates: string[],
  fallback = candidates[0] || DEFAULT_GEMINI_MODEL,
): GeminiModel {
  const normalized = String(value || '').trim();
  if (normalized && candidates.includes(normalized)) return normalized;
  return fallback;
}

function createDefaultUiPreferences(): UiPreferences {
  return {
    ...DEFAULT_UI_PREFERENCES,
    geminiModelList: [...DEFAULT_UI_PREFERENCES.geminiModelList],
  };
}

function syncGeminiModelSelect(
  select: HTMLSelectElement | null,
  selectedValue = state.uiPreferences.geminiModel,
  candidates = state.uiPreferences.geminiModelList,
): void {
  if (!select) return;
  const models = normalizeGeminiModelList(candidates);
  const selectedModel = coerceGeminiModel(selectedValue, models);
  select.replaceChildren(
    ...models.map((model) => new Option(model, model, false, model === selectedModel)),
  );
  select.value = selectedModel;
}

function readUiPreferences(): UiPreferences {
  try {
    const raw = window.localStorage.getItem(UI_PREFERENCES_KEY);
    if (!raw) return createDefaultUiPreferences();
    const parsed = JSON.parse(raw) as Partial<UiPreferences>;
    const geminiModelList = sanitizeGeminiModelList(parsed.geminiModelList);
    return {
      theme: parsed.theme === 'light' ? 'light' : 'dark',
      scale: clampUiScale(Number(parsed.scale) || DEFAULT_UI_PREFERENCES.scale),
      sidebarWidth: clampSidebarWidth(
        Number(parsed.sidebarWidth) || DEFAULT_UI_PREFERENCES.sidebarWidth,
      ),
      geminiModel: coerceGeminiModel(parsed.geminiModel, ARRANGE_GEMINI_MODEL_LIST),
      chatRagModel: coerceGeminiModel(
        parsed.chatRagModel,
        CHAT_RAG_GEMINI_MODEL_LIST,
        DEFAULT_CHAT_RAG_MODEL,
      ),
      retrievalMode: RETRIEVAL_MODE_LIST.includes(parsed.retrievalMode as RetrievalMode)
        ? (parsed.retrievalMode as RetrievalMode)
        : DEFAULT_RETRIEVAL_MODE,
      geminiModelList,
      arrangePrompt:
        typeof parsed.arrangePrompt === 'string' && parsed.arrangePrompt.trim()
          ? parsed.arrangePrompt
          : DEFAULT_UI_PREFERENCES.arrangePrompt,
    };
  } catch (error) {
    console.warn('Unable to read UI preferences', error);
    return createDefaultUiPreferences();
  }
}

function saveUiPreferences(): void {
  try {
    window.localStorage.setItem(UI_PREFERENCES_KEY, JSON.stringify(state.uiPreferences));
  } catch (error) {
    console.warn('Unable to save UI preferences', error);
  }
}

function applyUiPreferences(): void {
  document.documentElement.dataset.theme = state.uiPreferences.theme;
  document.documentElement.style.setProperty(
    '--sidebar-width',
    `${clampSidebarWidth(state.uiPreferences.sidebarWidth)}px`,
  );
  document.documentElement.style.setProperty(
    '--font-scale',
    String(state.uiPreferences.scale / 100),
  );
  document.body.style.zoom = '';

  const promptField = getById<HTMLTextAreaElement>('arrange-prompt');
  if (promptField && promptField.value !== state.uiPreferences.arrangePrompt) {
    promptField.value = state.uiPreferences.arrangePrompt;
  }

  const geminiModelListField = getById<HTMLTextAreaElement>('pref-gemini-model-list');
  const geminiModelListText = state.uiPreferences.geminiModelList.join('\n');
  if (geminiModelListField && geminiModelListField.value !== geminiModelListText) {
    geminiModelListField.value = geminiModelListText;
  }

  const modelSelect = getById<HTMLSelectElement>('pref-gemini-model');
  const arrangeModelSelect = getById<HTMLSelectElement>('arrange-model-select');
  const chatRagModelSelect = getById<HTMLSelectElement>('chat-rag-model-select');
  syncGeminiModelSelect(modelSelect);
  syncGeminiModelSelect(
    arrangeModelSelect,
    state.uiPreferences.geminiModel,
    ARRANGE_GEMINI_MODEL_LIST,
  );
  syncGeminiModelSelect(
    chatRagModelSelect,
    state.uiPreferences.chatRagModel,
    CHAT_RAG_GEMINI_MODEL_LIST,
  );
  state.uiPreferences.geminiModel = coerceGeminiModel(
    state.uiPreferences.geminiModel,
    ARRANGE_GEMINI_MODEL_LIST,
  );
  state.uiPreferences.chatRagModel = coerceGeminiModel(
    state.uiPreferences.chatRagModel,
    CHAT_RAG_GEMINI_MODEL_LIST,
    DEFAULT_CHAT_RAG_MODEL,
  );
  syncRetrievalModeSegmented();

  const arrangeModelLabel = getById<HTMLElement>('arrange-model-label');
  if (arrangeModelLabel && !getSelectedArrangeJob()) {
    arrangeModelLabel.textContent = `Model: ${state.uiPreferences.geminiModel}`;
  }

  const scaleValue = getById<HTMLElement>('pref-scale-value');
  if (scaleValue) scaleValue.textContent = `${state.uiPreferences.scale}%`;

  const scaleRange = getById<HTMLInputElement>('pref-scale-range');
  if (scaleRange) scaleRange.value = String(state.uiPreferences.scale);

  getById<HTMLButtonElement>('pref-theme-dark')?.classList.toggle(
    'active',
    state.uiPreferences.theme === 'dark',
  );
  getById<HTMLButtonElement>('pref-theme-light')?.classList.toggle(
    'active',
    state.uiPreferences.theme === 'light',
  );
}

function updateArrangePromptPreference(): void {
  const field = getById<HTMLTextAreaElement>('arrange-prompt');
  if (!field) return;
  state.uiPreferences.arrangePrompt = field.value.trim() || DEFAULT_UI_PREFERENCES.arrangePrompt;
  saveUiPreferences();
}

function updateGeminiModelPreference(): void {
  const field = getById<HTMLSelectElement>('pref-gemini-model');
  if (!field) return;
  state.uiPreferences.geminiModel = coerceGeminiModel(
    field.value,
    state.uiPreferences.geminiModelList,
  );
  applyUiPreferences();
  saveUiPreferences();
}

function updateArrangeGeminiModelPreference(): void {
  const field = getById<HTMLSelectElement>('arrange-model-select');
  if (!field) return;
  state.uiPreferences.geminiModel = coerceGeminiModel(field.value, ARRANGE_GEMINI_MODEL_LIST);
  applyUiPreferences();
  saveUiPreferences();
}

function updateChatRagGeminiModelPreference(): void {
  const field = getById<HTMLSelectElement>('chat-rag-model-select');
  if (!field) return;
  state.uiPreferences.chatRagModel = coerceGeminiModel(
    field.value,
    CHAT_RAG_GEMINI_MODEL_LIST,
    DEFAULT_CHAT_RAG_MODEL,
  );
  applyUiPreferences();
  saveUiPreferences();
}

function syncRetrievalModeSegmented(): void {
  const group = getById<HTMLElement>('chat-retrieval-mode');
  if (!group) return;
  const active = state.uiPreferences.retrievalMode;
  group.querySelectorAll<HTMLButtonElement>('.chat-mode-btn').forEach((btn) => {
    btn.classList.toggle('is-active', btn.dataset.mode === active);
  });
}

function updateRetrievalModePreference(mode: RetrievalMode): void {
  state.uiPreferences.retrievalMode = RETRIEVAL_MODE_LIST.includes(mode)
    ? mode
    : DEFAULT_RETRIEVAL_MODE;
  syncRetrievalModeSegmented();
  saveUiPreferences();
}

function updateGeminiModelListPreference(): void {
  const field = getById<HTMLTextAreaElement>('pref-gemini-model-list');
  if (!field) return;
  state.uiPreferences.geminiModelList = sanitizeGeminiModelList(field.value);
  state.uiPreferences.geminiModel = coerceGeminiModel(
    state.uiPreferences.geminiModel,
    ARRANGE_GEMINI_MODEL_LIST,
  );
  state.uiPreferences.chatRagModel = coerceGeminiModel(
    state.uiPreferences.chatRagModel,
    CHAT_RAG_GEMINI_MODEL_LIST,
    DEFAULT_CHAT_RAG_MODEL,
  );
  applyUiPreferences();
  saveUiPreferences();
}

function createDefaultArrangePromptTemplates(): ArrangePromptTemplate[] {
  const prompt = state.uiPreferences.arrangePrompt?.trim() || DEFAULT_UI_PREFERENCES.arrangePrompt;
  return [
    {
      id: 'default',
      name: '預設整理模板',
      content: prompt,
      readonly: true,
    },
  ];
}

function sanitizeArrangePromptTemplates(value: unknown): ArrangePromptTemplate[] {
  if (!Array.isArray(value)) return createDefaultArrangePromptTemplates();

  const templates: ArrangePromptTemplate[] = [];
  for (const item of value) {
    if (!item || typeof item !== 'object') continue;
    const source = item as Partial<ArrangePromptTemplate>;
    const id = String(source.id || '').trim();
    const name = String(source.name || '').trim();
    const content = String(source.content || '').trim();
    if (!id || !name || !content) continue;
    if (templates.some((template) => template.id === id)) continue;
    templates.push({
      id,
      name,
      content,
      readonly: Boolean(source.readonly),
    });
  }

  if (!templates.length) return createDefaultArrangePromptTemplates();
  if (!templates.some((template) => template.id === 'default')) {
    templates.unshift(createDefaultArrangePromptTemplates()[0]);
  }
  return templates;
}

function saveArrangePromptTemplates(): void {
  try {
    window.localStorage.setItem(
      ARRANGE_PROMPT_TEMPLATES_KEY,
      JSON.stringify({
        selectedId: state.selectedArrangePromptTemplateId,
        templates: state.arrangePromptTemplates,
      }),
    );
  } catch (error) {
    console.warn('Unable to save arrange prompt templates', error);
  }
}

function renderArrangePromptTemplates(): void {
  const select = getById<HTMLSelectElement>('arrange-prompt-template-select');
  if (!select) return;

  select.innerHTML = state.arrangePromptTemplates
    .map((template) => {
      const selected = template.id === state.selectedArrangePromptTemplateId ? ' selected' : '';
      const suffix = template.readonly ? '（預設）' : '';
      return `<option value="${escapeHtml(template.id)}"${selected}>${escapeHtml(template.name)}${suffix}</option>`;
    })
    .join('');
}

function getSelectedArrangePromptTemplate(): ArrangePromptTemplate | null {
  return (
    state.arrangePromptTemplates.find(
      (template) => template.id === state.selectedArrangePromptTemplateId,
    ) ?? null
  );
}

function applySelectedArrangePromptTemplate(): void {
  const template = getSelectedArrangePromptTemplate();
  const promptField = getById<HTMLTextAreaElement>('arrange-prompt');
  const nameField = getById<HTMLInputElement>('arrange-prompt-template-name');
  if (!template || !promptField) return;

  promptField.value = template.content;
  state.uiPreferences.arrangePrompt = template.content;
  if (nameField) nameField.value = template.readonly ? '' : template.name;
  saveUiPreferences();
}

function initArrangePromptTemplates(): void {
  const defaults = createDefaultArrangePromptTemplates();
  let templates = defaults;
  let selectedId = defaults[0].id;

  try {
    const raw = window.localStorage.getItem(ARRANGE_PROMPT_TEMPLATES_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as {
        selectedId?: string;
        templates?: ArrangePromptTemplate[];
      };
      templates = sanitizeArrangePromptTemplates(parsed.templates);
      const storedId = String(parsed.selectedId || '').trim();
      if (storedId && templates.some((template) => template.id === storedId)) {
        selectedId = storedId;
      }
    }
  } catch (error) {
    console.warn('Unable to read arrange prompt templates', error);
  }

  state.arrangePromptTemplates = templates;
  state.selectedArrangePromptTemplateId = selectedId;
  renderArrangePromptTemplates();
  applySelectedArrangePromptTemplate();
  saveArrangePromptTemplates();
}

function selectArrangePromptTemplate(templateId: string): void {
  if (!state.arrangePromptTemplates.some((template) => template.id === templateId)) return;
  state.selectedArrangePromptTemplateId = templateId;
  renderArrangePromptTemplates();
  applySelectedArrangePromptTemplate();
  saveArrangePromptTemplates();
}

function saveCurrentPromptToSelectedTemplate(silent = false): void {
  const template = getSelectedArrangePromptTemplate();
  const promptField = getById<HTMLTextAreaElement>('arrange-prompt');
  if (!template || !promptField) return;

  template.content = promptField.value.trim() || DEFAULT_UI_PREFERENCES.arrangePrompt;
  if (template.id === 'default') {
    state.uiPreferences.arrangePrompt = template.content;
    saveUiPreferences();
  }
  renderArrangePromptTemplates();
  saveArrangePromptTemplates();
  if (!silent) setArrangeStatus(`已更新模板：${template.name}`, 'success');
}

function saveCurrentPromptAsNewTemplate(): void {
  const promptField = getById<HTMLTextAreaElement>('arrange-prompt');
  const nameField = getById<HTMLInputElement>('arrange-prompt-template-name');
  if (!promptField || !nameField) return;

  const name = nameField.value.trim();
  const content = promptField.value.trim();
  if (!name) {
    setArrangeStatus('請先輸入新模板名稱。', 'warn');
    return;
  }
  if (!content) {
    setArrangeStatus('Prompt 內容不可為空。', 'warn');
    return;
  }

  const existing = state.arrangePromptTemplates.find(
    (template) => !template.readonly && template.name === name,
  );
  if (existing) {
    existing.content = content;
    state.selectedArrangePromptTemplateId = existing.id;
    renderArrangePromptTemplates();
    applySelectedArrangePromptTemplate();
    saveArrangePromptTemplates();
    nameField.value = '';
    setArrangeStatus(`已覆蓋既有模板：${name}`, 'success');
    return;
  }

  const id = `template-${Date.now().toString(36)}`;
  state.arrangePromptTemplates.push({ id, name, content });
  state.selectedArrangePromptTemplateId = id;
  renderArrangePromptTemplates();
  applySelectedArrangePromptTemplate();
  saveArrangePromptTemplates();
  nameField.value = '';
  setArrangeStatus(`已新增模板：${name}`, 'success');
}

function deleteSelectedPromptTemplate(): void {
  const template = getSelectedArrangePromptTemplate();
  if (!template) return;
  if (template.readonly || template.id === 'default') {
    setArrangeStatus('預設模板不可刪除。', 'warn');
    return;
  }

  state.arrangePromptTemplates = state.arrangePromptTemplates.filter(
    (item) => item.id !== template.id,
  );
  state.selectedArrangePromptTemplateId = 'default';
  renderArrangePromptTemplates();
  applySelectedArrangePromptTemplate();
  saveArrangePromptTemplates();
  setArrangeStatus(`已刪除模板：${template.name}`, 'success');
}

function rerenderTimelineIfVisible(): void {
  if (!state.allIssues.length) return;
  if (!getById<HTMLElement>('tab-timeline')?.classList.contains('active')) return;
  scheduleGanttRender(state.allIssues);
}

function initSidebarResizer(): void {
  const resizer = getById<HTMLDivElement>('sidebar-resizer');
  const shell = document.querySelector<HTMLElement>('.app-shell');
  if (!resizer || !shell) return;

  let dragging = false;

  const stopDragging = () => {
    if (!dragging) return;
    dragging = false;
    document.body.classList.remove('sidebar-resizing');
    saveUiPreferences();
    rerenderTimelineIfVisible();
  };

  window.addEventListener('pointermove', (event) => {
    if (!dragging || shell.classList.contains('sidebar-collapsed')) return;
    const shellRect = shell.getBoundingClientRect();
    const nextWidth = clampSidebarWidth(event.clientX - shellRect.left);
    if (nextWidth === state.uiPreferences.sidebarWidth) return;
    state.uiPreferences.sidebarWidth = nextWidth;
    applyUiPreferences();
  });

  window.addEventListener('pointerup', stopDragging);
  window.addEventListener('pointercancel', stopDragging);

  resizer.addEventListener('pointerdown', (event) => {
    if (window.innerWidth <= 900 || shell.classList.contains('sidebar-collapsed')) return;
    dragging = true;
    document.body.classList.add('sidebar-resizing');
    resizer.setPointerCapture(event.pointerId);
    event.preventDefault();
  });

  resizer.addEventListener('dblclick', () => {
    state.uiPreferences.sidebarWidth = DEFAULT_UI_PREFERENCES.sidebarWidth;
    applyUiPreferences();
    saveUiPreferences();
    rerenderTimelineIfVisible();
  });
}

function setArrangeStatus(
  text: string,
  type: 'idle' | 'success' | 'warn' | 'error' = 'idle',
): void {
  const status = getById<HTMLDivElement>('arrange-status');
  if (!status) return;
  status.textContent = text;
  status.className = `inline-status ${type}`;
}

function showToast(
  title: string,
  message: string,
  type: 'success' | 'warn' | 'error' = 'success',
  duration = 3200,
): void {
  const region = getById<HTMLDivElement>('toast-region');
  if (!region) return;

  const toast = document.createElement('div');
  toast.className = `app-toast ${type}`;
  toast.innerHTML = `
    <div class="app-toast-body">
      <div class="app-toast-title">${escapeHtml(title)}</div>
      <div class="app-toast-message">${escapeHtml(message)}</div>
    </div>
  `;

  let removed = false;
  const removeToast = () => {
    if (removed) return;
    removed = true;
    toast.classList.add('is-leaving');
    window.setTimeout(() => toast.remove(), 220);
  };

  region.appendChild(toast);
  window.setTimeout(removeToast, duration);
}

async function applyAppVersionLabel(): Promise<void> {
  const versionLabel = getById<HTMLElement>('app-version-label');
  if (!versionLabel) return;

  try {
    const version = await window.trackerBridge.getAppVersion();
    versionLabel.textContent = `v${version}`;
    document.title = `Repo Radar v${version}`;
  } catch (error) {
    console.warn('Failed to load app version', error);
  }
}

const ACTION_BTNS = ['btn-sync-now', 'btn-refresh-dashboard', 'btn-save-config'];
function setActionButtonsEnabled(enabled: boolean): void {
  for (const id of ACTION_BTNS) {
    const btn = getById<HTMLButtonElement>(id);
    if (!btn) continue;
    btn.disabled = !enabled;
    btn.style.opacity = enabled ? '' : '0.5';
    btn.style.pointerEvents = enabled ? '' : 'none';
  }
}

function fmtDate(value: string | null | undefined): string {
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString('zh-TW', { hour12: false });
}

function fmtShortDate(value: string | null | undefined): string {
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function fmtFileSize(bytes: number | null | undefined): string {
  const size = Number(bytes) || 0;
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function coerceConfig(config?: Partial<AppConfig> | null): AppConfig {
  const legacy = config as any;
  const connection = (
    provider: 'gitlab' | 'github',
    value?: Partial<AppConfig['connections']['gitlab']>,
  ): AppConfig['connections']['gitlab'] => {
    const projectRef =
      value?.project_ref || (provider === 'gitlab' ? legacy?.project_ref || '' : '');
    return {
      base_url:
        value?.base_url ||
        (provider === 'github' ? 'https://github.com' : legacy?.gitlab_url || ''),
      token: '',
      token_configured: Boolean(
        value?.token_configured || value?.token || (provider === 'gitlab' && legacy?.token),
      ),
      project_ref: projectRef,
      project_ref_history: normalizeProjectRefHistory(
        projectRef,
        value?.project_ref_history ||
          (provider === 'gitlab' ? legacy?.project_ref_history || [] : []),
      ),
      verify_ssl: value?.verify_ssl ?? provider === 'github',
    };
  };
  const merged: AppConfig = {
    active_provider: config?.active_provider === 'github' ? 'github' : 'gitlab',
    connections: {
      gitlab: connection('gitlab', config?.connections?.gitlab),
      github: connection('github', config?.connections?.github),
    },
    import_file: '',
    gemini_api_key: '',
    gemini_api_key_configured: false,
    enable_daily_sync: true,
    daily_sync_time: '09:00',
    enable_weekly_report: true,
    weekly_report_time: '17:30',
    ...config,
  };

  return {
    ...merged,
    connections: {
      gitlab: connection('gitlab', merged.connections?.gitlab),
      github: connection('github', merged.connections?.github),
    },
    gemini_api_key: '',
  };
}

function readCachedConfig(): AppConfig | null {
  try {
    const raw = window.localStorage.getItem(LOCAL_CONFIG_CACHE_KEY);
    if (!raw) return null;
    return coerceConfig(JSON.parse(raw) as Partial<AppConfig>);
  } catch (error) {
    console.warn('Unable to read cached config', error);
    return null;
  }
}

function cacheConfig(config: AppConfig): void {
  try {
    const safeConfig = coerceConfig(config);
    safeConfig.connections.gitlab.token = '';
    safeConfig.connections.github.token = '';
    safeConfig.gemini_api_key = '';
    window.localStorage.setItem(LOCAL_CONFIG_CACHE_KEY, JSON.stringify(safeConfig));
  } catch (error) {
    console.warn('Unable to cache config', error);
  }
}

function normalizeProjectRefHistory(currentValue: string, history: string[]): string[] {
  const values = [currentValue, ...history];
  const unique: string[] = [];

  for (const value of values) {
    const normalized = value.trim();
    if (normalized && !unique.includes(normalized)) {
      unique.push(normalized);
    }
  }

  return unique.slice(0, MAX_PROJECT_REF_HISTORY);
}

function getProjectRefHistoryFromUi(): string[] {
  const datalist = byId<HTMLDataListElement>('project-ref-history-list');
  return Array.from(datalist.options)
    .map((option) => option.value.trim())
    .filter(Boolean);
}

function renderProjectRefHistory(currentValue: string, history: string[]): void {
  const values = normalizeProjectRefHistory(currentValue, history);
  const datalist = byId<HTMLDataListElement>('project-ref-history-list');

  datalist.innerHTML = values
    .map((value) => `<option value="${escapeHtml(value)}"></option>`)
    .join('');
  /*

    '<option value="">從歷史紀錄快速切換</option>',
  */
}

function getStartOfWeek(value: Date): Date {
  const date = startOfDay(value) ?? new Date(value);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  return date;
}

function getIsoWeekValue(date: Date): string {
  const target = getStartOfWeek(date);
  const thursday = new Date(target);
  thursday.setDate(target.getDate() + 3);
  const firstThursday = new Date(thursday.getFullYear(), 0, 4);
  const firstWeekStart = getStartOfWeek(firstThursday);
  const week = Math.round((thursday.getTime() - firstWeekStart.getTime()) / 86400000 / 7) + 1;
  return `${thursday.getFullYear()}-W${String(week).padStart(2, '0')}`;
}

function parseIsoWeekValue(value: string): Date | null {
  const match = /^(\d{4})-W(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const week = Number(match[2]);
  if (!Number.isFinite(year) || !Number.isFinite(week) || week < 1 || week > 53) return null;

  const jan4 = new Date(year, 0, 4);
  const firstWeekStart = getStartOfWeek(jan4);
  const monday = new Date(firstWeekStart);
  monday.setDate(firstWeekStart.getDate() + (week - 1) * 7);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

function startOfDay(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? new Date(value) : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  date.setHours(0, 0, 0, 0);
  return date;
}

function daysBetween(left: Date, right: Date): number {
  return Math.round((left.getTime() - right.getTime()) / 86400000);
}

function formatGanttDate(value: Date | string | null | undefined): string {
  const date = startOfDay(value);
  if (!date) return '-';
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

type MilestoneSortEntry = {
  name: string;
  start: Date | null;
  due: Date | null;
  hasExplicitDue: boolean;
};

function compareMilestoneEntries(left: MilestoneSortEntry, right: MilestoneSortEntry): number {
  const leftPrimary = left.start?.getTime() ?? left.due?.getTime() ?? Number.NEGATIVE_INFINITY;
  const rightPrimary = right.start?.getTime() ?? right.due?.getTime() ?? Number.NEGATIVE_INFINITY;
  if (leftPrimary !== rightPrimary) return rightPrimary - leftPrimary;

  const leftSecondary = left.due?.getTime() ?? left.start?.getTime() ?? Number.NEGATIVE_INFINITY;
  const rightSecondary = right.due?.getTime() ?? right.start?.getTime() ?? Number.NEGATIVE_INFINITY;
  if (leftSecondary !== rightSecondary) return leftSecondary - rightSecondary;

  return left.name.localeCompare(right.name, 'zh-Hant');
}

function mergeEarlierDate(current: Date | null, candidate: Date | null): Date | null {
  if (!candidate) return current;
  if (!current) return candidate;
  return candidate.getTime() < current.getTime() ? candidate : current;
}

function mergeLaterDate(current: Date | null, candidate: Date | null): Date | null {
  if (!candidate) return current;
  if (!current) return candidate;
  return candidate.getTime() > current.getTime() ? candidate : current;
}

function formatMilestoneOptionLabel(milestone: MilestoneSortEntry): string {
  return milestone.name;
}

function getSortedMilestoneEntriesFromIssues(issues: IssueItem[]): MilestoneSortEntry[] {
  const milestones = new Map<string, MilestoneSortEntry>();

  for (const issue of issues) {
    if (!issue.milestone) continue;

    const existing = milestones.get(issue.milestone) ?? {
      name: issue.milestone,
      start: null,
      due: null,
      hasExplicitDue: false,
    };

    existing.start = mergeEarlierDate(existing.start, startOfDay(issue.milestone_start_date));

    const milestoneDue = startOfDay(issue.milestone_due_date);
    if (milestoneDue) {
      existing.due = mergeLaterDate(existing.due, milestoneDue);
      existing.hasExplicitDue = true;
    } else if (!existing.hasExplicitDue) {
      existing.due = mergeLaterDate(existing.due, startOfDay(issue.due_date));
    }

    milestones.set(issue.milestone, existing);
  }

  return Array.from(milestones.values()).sort(compareMilestoneEntries);
}

function getDefaultMilestoneFilterValue(
  milestones: MilestoneSortEntry[],
  currentValue: string,
): string {
  if (currentValue && milestones.some((milestone) => milestone.name === currentValue)) {
    return currentValue;
  }

  const today = startOfDay(new Date());
  if (!today) return '';

  const currentMilestone = milestones.find((milestone) => {
    if (!milestone.start && !milestone.due) return false;

    const afterStart = !milestone.start || milestone.start.getTime() <= today.getTime();
    const beforeDue = !milestone.due || today.getTime() <= milestone.due.getTime();
    return afterStart && beforeDue;
  });

  return currentMilestone?.name ?? '';
}

function populateMilestoneFilterOptions(
  select: HTMLSelectElement,
  milestones: MilestoneSortEntry[],
): void {
  const nextValue = getDefaultMilestoneFilterValue(milestones, select.value);
  select.innerHTML =
    '<option value="">全部</option>' +
    milestones
      .map(
        (milestone) =>
          `<option value="${escapeHtml(milestone.name)}">${escapeHtml(formatMilestoneOptionLabel(milestone))}</option>`,
      )
      .join('');
  select.value = nextValue;
  select.title = select.selectedOptions[0]?.textContent ?? '';
}

function compareIssuesForGantt(a: IssueItem, b: IssueItem): number {
  const aDue = startOfDay(a.due_date)?.getTime() ?? Number.POSITIVE_INFINITY;
  const bDue = startOfDay(b.due_date)?.getTime() ?? Number.POSITIVE_INFINITY;
  if (aDue !== bDue) return aDue - bDue;

  const aCreated = startOfDay(a.created_at)?.getTime() ?? Number.POSITIVE_INFINITY;
  const bCreated = startOfDay(b.created_at)?.getTime() ?? Number.POSITIVE_INFINITY;
  if (aCreated !== bCreated) return aCreated - bCreated;

  return a.iid - b.iid;
}

function getGanttRiskFlags(issue: IssueItem, today: Date): GanttRiskFlag[] {
  const flags: GanttRiskFlag[] = [];
  if (issue.state === 'closed') return flags;

  const due = startOfDay(issue.due_date);
  const updated = startOfDay(issue.updated_at);

  if (!issue.assignees?.length) flags.push('unassigned');
  if (!due) {
    flags.push('no_due_date');
  } else {
    const diff = daysBetween(due, today);
    if (diff < 0) {
      flags.push('overdue');
    } else if (diff <= 7) {
      flags.push('due_soon');
    }
  }
  if (updated && daysBetween(today, updated) >= 7) {
    flags.push('stale');
  }

  return flags;
}

function getRiskFlagLabel(flag: GanttRiskFlag): string {
  const labels: Record<GanttRiskFlag, string> = {
    overdue: '逾期',
    due_soon: '本週到期',
    no_due_date: '無到期日',
    unassigned: '未指派',
    stale: '7 天未更新',
  };
  return labels[flag];
}

type GanttStatusKind = 'open' | 'in_progress' | 'closed';

function getResolvedMergeRequestCount(issue: IssueItem): number {
  return state.mergeRequestsByIid.get(issue.iid)?.length ?? issue.merge_requests_count ?? 0;
}

function getLinkedItemCount(issue: IssueItem): number {
  return state.issueLinksByIid.get(issue.iid)?.length ?? 0;
}

function getGanttStatusKind(issue: IssueItem): GanttStatusKind {
  if (issue.state === 'closed') return 'closed';
  if (getResolvedMergeRequestCount(issue) > 0) return 'in_progress';
  return 'open';
}

function getGanttStatusLabel(status: GanttStatusKind): string {
  const labels: Record<GanttStatusKind, string> = {
    open: '開啟中',
    in_progress: '進行中',
    closed: '已關閉',
  };
  return labels[status];
}

function getIssueLinkTypeLabel(linkType: string, direction: LinkedItemInfo['direction']): string {
  const outbound: Record<string, string> = {
    relates_to: '關聯',
    blocks: '阻擋',
    is_blocked_by: '被阻擋',
  };
  const inbound: Record<string, string> = {
    relates_to: '關聯',
    blocks: '被阻擋',
    is_blocked_by: '阻擋',
  };
  const labels = direction === 'inbound' ? inbound : outbound;
  return labels[linkType] || linkType.replace(/_/g, ' ');
}

function getDeliveryHighlight(issue: IssueItem): { kind: string; label: string; value: string } {
  const dueDate = startOfDay(issue.due_date);
  const isOverdue =
    issue.state !== 'closed' && !!dueDate && dueDate < (startOfDay(new Date()) as Date);
  const status = getGanttStatusKind(issue);
  if (status === 'closed') {
    return { kind: 'done', label: '目前狀態', value: '已關閉' };
  }
  if (isOverdue) {
    return { kind: 'overdue', label: '目前狀態', value: '逾期' };
  }
  if (status === 'in_progress') {
    return {
      kind: 'review',
      label: '目前狀態',
      value: `進行中 · ${getResolvedMergeRequestCount(issue)} ${issue.provider === 'github' ? 'PR' : 'MR'}`,
    };
  }
  return { kind: 'open', label: '目前狀態', value: '開啟中' };
}

async function api<T>(
  path: string,
  method = 'GET',
  body?: unknown,
  options?: { signal?: AbortSignal },
): Promise<T> {
  const response = await fetch(`http://127.0.0.1:8765${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
    signal: options?.signal,
  });
  if (!response.ok) {
    const text = await response.text();
    let parsedMessage = '';
    try {
      const parsed = JSON.parse(text) as { detail?: string; error?: string };
      parsedMessage = parsed.detail || parsed.error || '';
    } catch {
      // Fall back to raw text below.
    }
    throw new Error(parsedMessage || text || response.statusText);
  }
  return response.json() as Promise<T>;
}

/* ══════════════════════════════════════════════
   CONFIG
   ══════════════════════════════════════════════ */
function readConfigForm(): AppConfig {
  const config = coerceConfig(state.currentConfig);
  const provider = byId<HTMLSelectElement>('active-provider').value as 'gitlab' | 'github';
  const projectRef = byId<HTMLInputElement>('project-ref').value.trim();
  const existing = config.connections[provider];

  config.active_provider = provider;
  config.connections[provider] = {
    ...existing,
    base_url: byId<HTMLInputElement>('gitlab-url').value.trim(),
    token: byId<HTMLInputElement>('gitlab-token').value.trim(),
    project_ref: projectRef,
    project_ref_history: normalizeProjectRefHistory(projectRef, getProjectRefHistoryFromUi()),
    verify_ssl: provider === 'github' ? true : existing.verify_ssl,
  };
  config.import_file =
    (document.getElementById('import-file') as HTMLInputElement | null)?.value.trim() || '';
  config.gemini_api_key = byId<HTMLInputElement>('gemini-api-key').value.trim();
  state.currentConfig = config;
  return config;
}

function providerLabel(provider = state.currentConfig?.active_provider || 'gitlab'): string {
  return provider === 'github' ? 'GitHub' : 'GitLab';
}

function fillActiveConnection(config: AppConfig): void {
  const provider = config.active_provider;
  const connection = config.connections[provider];
  byId<HTMLSelectElement>('active-provider').value = provider;
  byId<HTMLInputElement>('gitlab-url').value = connection.base_url || '';
  byId<HTMLInputElement>('gitlab-token').value = '';
  byId<HTMLInputElement>('gitlab-token').placeholder = connection.token_configured
    ? `${providerLabel(provider)} token 已設定；留空表示不變`
    : provider === 'github'
      ? 'github_pat_...（public repo 可留空）'
      : 'glpat-...';
  byId<HTMLInputElement>('project-ref').value = connection.project_ref || '';
  byId<HTMLInputElement>('project-ref').placeholder =
    provider === 'github' ? 'microsoft/markitdown' : 'group/project 或 project ID';
  renderProjectRefHistory(connection.project_ref || '', connection.project_ref_history || []);
  getById<HTMLElement>('source-base-url-label')!.textContent =
    `${providerLabel(provider)} Base URL`;
  getById<HTMLElement>('source-token-label')!.textContent = `${providerLabel(provider)} Token`;
  getById<HTMLElement>('source-project-label')!.textContent =
    provider === 'github' ? 'Repository owner/name' : 'Project Path / ID';
  const tokenHint = getById<HTMLElement>('token-hint-copy');
  if (tokenHint) {
    tokenHint.textContent =
      provider === 'github'
        ? 'Public repo 可匿名讀取；private repo 或較高 rate limit 請設定 fine-grained token。'
        : '至少需要 read_api 權限。';
  }
}

function fillConfigForm(config: AppConfig): void {
  state.currentConfig = coerceConfig(config);
  fillActiveConnection(state.currentConfig);
  const importEl = document.getElementById('import-file') as HTMLInputElement | null;
  if (importEl) importEl.value = state.currentConfig.import_file || '';
  const geminiInput = byId<HTMLInputElement>('gemini-api-key');
  geminiInput.value = '';
  geminiInput.placeholder = state.currentConfig.gemini_api_key_configured
    ? 'Gemini API Key 已設定；留空表示不變'
    : 'AIza...';
}

function switchActiveProvider(provider: 'gitlab' | 'github'): void {
  const previous = state.currentConfig?.active_provider;
  if (state.currentConfig && previous) {
    const projectRef = byId<HTMLInputElement>('project-ref').value.trim();
    state.currentConfig.connections[previous] = {
      ...state.currentConfig.connections[previous],
      base_url: byId<HTMLInputElement>('gitlab-url').value.trim(),
      token: byId<HTMLInputElement>('gitlab-token').value.trim(),
      project_ref: projectRef,
      project_ref_history: normalizeProjectRefHistory(projectRef, getProjectRefHistoryFromUi()),
    };
    state.currentConfig.active_provider = provider;
    fillActiveConnection(state.currentConfig);
  }
}

async function testActiveConnection(): Promise<void> {
  const config = readConfigForm();
  const provider = config.active_provider;
  const connection = config.connections[provider];
  const result = await api<{
    source_ref: string;
    default_branch?: string;
    rate_limit_remaining?: string;
  }>('/api/connection/test', 'POST', {
    provider,
    base_url: connection.base_url,
    token: connection.token,
    project_ref: connection.project_ref,
  });
  setStatus(
    `${providerLabel(provider)} 連線成功：${result.source_ref}${result.default_branch ? ` (${result.default_branch})` : ''}${result.rate_limit_remaining ? `，剩餘 API 額度 ${result.rate_limit_remaining}` : ''}`,
    'success',
  );
}

/* ══════════════════════════════════════════════
   TAB 1: DASHBOARD
   ══════════════════════════════════════════════ */
function renderSummary(data: DashboardResponse): void {
  byId<HTMLElement>('metric-new').textContent = String(data.summary.weekly_new_count ?? 0);
  byId<HTMLElement>('metric-updated').textContent = String(data.summary.weekly_updated_count ?? 0);
  byId<HTMLElement>('metric-opened').textContent = String(data.summary.open_issue_count ?? 0);
  byId<HTMLElement>('metric-risk').textContent = String(data.summary.risk_count ?? 0);

  const container = byId<HTMLDivElement>('weekly-summary');
  const items: [string, unknown][] = [
    ['本週新增 Issue', data.summary.weekly_new_count],
    ['本週更新 Issue', data.summary.weekly_updated_count],
    ['目前開啟中', data.summary.open_issue_count],
    ['本週關閉', data.summary.weekly_closed_count],
    ['無負責人', data.summary.unassigned_count],
    ['逾期或逼近到期', data.summary.near_due_count],
  ];

  container.innerHTML = items
    .map(
      ([label, value]) => `
    <div class="summary-item">
      <span>${escapeHtml(String(label))}</span>
      <strong>${value ?? 0}</strong>
    </div>
  `,
    )
    .join('');
}

function renderNewIssues(items: IssueItem[]): void {
  const tbody = byId<HTMLTableSectionElement>('table-new-issues');
  if (!items.length) {
    tbody.innerHTML = '<tr><td colspan="6" class="empty-state">本週沒有新增 issue。</td></tr>';
    return;
  }
  tbody.innerHTML = items
    .map(
      (item) => `
    <tr data-iid="${item.iid}" style="cursor:pointer">
      <td>#${item.iid}</td>
      <td>${escapeHtml(item.module ?? '-')}</td>
      <td>${escapeHtml(item.title)}</td>
      <td>${escapeHtml((item.assignees || []).join(', ') || '-')}</td>
      <td>${escapeHtml(item.milestone ?? '-')}</td>
      <td><span class="state-badge ${item.state}">${item.state === 'opened' ? '開啟' : '關閉'}</span></td>
    </tr>
  `,
    )
    .join('');
}

function renderRecentIssues(): void {
  const hours = Number(byId<HTMLInputElement>('recent-hours').value) || 6;
  const cutoff = new Date(Date.now() - hours * 3600_000);
  const recent = state.allIssues
    .filter((i) => i.updated_at && new Date(i.updated_at) >= cutoff)
    .sort((a, b) => new Date(b.updated_at!).getTime() - new Date(a.updated_at!).getTime());

  const tbody = byId<HTMLTableSectionElement>('table-recent-issues');
  if (!recent.length) {
    tbody.innerHTML = `<tr><td colspan="7" class="empty-state">近 ${hours} 小時內沒有更新的 Issue。</td></tr>`;
    return;
  }
  tbody.innerHTML = recent
    .map((item) => {
      const discBadge = item.has_new_discussions
        ? '<span class="disc-badge new" title="有新討論">💬 新</span>'
        : item.user_notes_count > 0
          ? `<span class="disc-badge" title="${item.user_notes_count} 則討論">💬 ${item.user_notes_count}</span>`
          : '<span class="disc-badge none">—</span>';
      return `
    <tr data-iid="${item.iid}" style="cursor:pointer">
      <td>#${item.iid}</td>
      <td>${escapeHtml(item.module ?? '-')}</td>
      <td>${escapeHtml(item.title)}</td>
      <td>${escapeHtml((item.assignees || []).join(', ') || '-')}</td>
      <td><span class="state-badge ${item.state}">${item.state === 'opened' ? '開啟' : '關閉'}</span></td>
      <td>${discBadge}</td>
      <td>${fmtDate(item.updated_at)}</td>
    </tr>
  `;
    })
    .join('');
}

function renderCards(containerId: string, items: IssueItem[], emptyText: string): void {
  const container = byId<HTMLDivElement>(containerId);
  if (!items.length) {
    container.innerHTML = `<div class="empty-state">${escapeHtml(emptyText)}</div>`;
    return;
  }
  container.innerHTML = items
    .map(
      (item) => `
    <article class="issue-card" data-iid="${item.iid}" ${item.web_url ? `data-url="${escapeHtml(item.web_url)}"` : ''} style="cursor:pointer">
      <h4>${item.web_url ? `<a class="issue-link" href="${escapeHtml(item.web_url)}" target="_blank" onclick="event.stopPropagation()">#${item.iid}</a>` : `#${item.iid}`} ${escapeHtml(item.title)}</h4>
      <p>模組：${escapeHtml(item.module ?? '-')} ｜ 狀態：<span class="state-badge ${item.state}">${item.state === 'opened' ? '開啟' : '關閉'}</span> ｜ 負責人：${escapeHtml((item.assignees || []).join(', ') || '-')}</p>
      <p>Milestone：${escapeHtml(item.milestone ?? '-')} ｜ 更新時間：${fmtDate(item.updated_at)}</p>
      ${item.note || item.reason ? `<p>${escapeHtml(item.note ?? item.reason ?? '')}</p>` : ''}
      <div class="tags">
        ${(item.labels || [])
          .slice(0, 5)
          .map((label: string) => `<span class="tag">${escapeHtml(label)}</span>`)
          .join('')}
      </div>
    </article>
  `,
    )
    .join('');
}

/* ══════════════════════════════════════════════
   TAB 2: GANTT TIMELINE
   ══════════════════════════════════════════════ */
let _ganttRafId = 0;
function scheduleGanttRender(issues: IssueItem[]): void {
  updateTimelineFilterIndicators();
  cancelAnimationFrame(_ganttRafId);
  _ganttRafId = requestAnimationFrame(() => {
    const mode = state.timelineViewMode;
    const ganttEl = byId<HTMLDivElement>('gantt-chart');
    const calEl = byId<HTMLDivElement>('calendar-chart');
    if (mode === 'calendar') {
      ganttEl.style.display = 'none';
      calEl.style.display = '';
      renderCalendarViewSafe(issues);
    } else {
      ganttEl.style.display = '';
      calEl.style.display = 'none';
      renderGanttEnhancedSafe(issues);
    }
  });
}

function enhanceTimelineControls(): void {
  const controls = document.querySelector<HTMLDivElement>('.timeline-controls');
  if (!controls || controls.dataset.enhanced === 'true') return;

  const quickLabel = byId<HTMLSelectElement>('gantt-quick-view').closest('label');
  const groupLabel = byId<HTMLSelectElement>('gantt-group-by').closest('label');
  const monthLabel = byId<HTMLInputElement>('gantt-month').closest('label');
  const viewLabel = byId<HTMLSelectElement>('gantt-view-mode').closest('label');
  const milestoneLabel = byId<HTMLSelectElement>('gantt-milestone-filter').closest('label');
  const assigneeLabel = byId<HTMLSelectElement>('gantt-assignee-filter').closest('label');
  const stateLabel = byId<HTMLSelectElement>('gantt-state-filter').closest('label');
  const legend = controls.querySelector<HTMLElement>('.timeline-legend');

  if (
    !quickLabel ||
    !groupLabel ||
    !monthLabel ||
    !viewLabel ||
    !milestoneLabel ||
    !assigneeLabel ||
    !stateLabel ||
    !legend
  ) {
    return;
  }

  const rangeLabel = document.createElement('label');
  rangeLabel.className = 'timeline-control';
  rangeLabel.innerHTML = `
    周/月
    <select id="gantt-range-mode">
      <option value="month">月</option>
      <option value="week" selected>周</option>
    </select>
  `;

  const mainControls = document.createElement('div');
  mainControls.className = 'timeline-main-controls';
  mainControls.append(quickLabel, groupLabel, viewLabel, rangeLabel);

  const periodControls = document.createElement('div');
  periodControls.className = 'timeline-period-controls';
  const periodNav = monthLabel.querySelector('div');
  if (periodNav) {
    periodNav.classList.add('timeline-period-nav');
  }
  const monthTextNode = Array.from(monthLabel.childNodes).find(
    (node) => node.nodeType === Node.TEXT_NODE,
  );
  if (monthTextNode) {
    monthTextNode.textContent = '區間';
  }
  periodControls.append(monthLabel);

  const filtersPanel = document.createElement('details');
  filtersPanel.className = 'timeline-filters-panel';
  const summary = document.createElement('summary');
  const summaryLabel = document.createElement('span');
  summaryLabel.textContent = '更多篩選';
  const summaryCount = document.createElement('span');
  summaryCount.className = 'timeline-filter-count';
  summaryCount.hidden = true;
  summary.append(summaryLabel, summaryCount);
  const filtersGrid = document.createElement('div');
  filtersGrid.className = 'timeline-filters-grid';
  filtersGrid.append(milestoneLabel, assigneeLabel, stateLabel);
  filtersPanel.append(summary, filtersGrid);

  controls.innerHTML = '';
  controls.append(mainControls, periodControls, filtersPanel, legend);
  controls.dataset.enhanced = 'true';
  updateTimelineFilterIndicators();
}

function updateTimelineFilterIndicators(): void {
  const quickView = getById<HTMLSelectElement>('gantt-quick-view');
  const milestoneFilter = getById<HTMLSelectElement>('gantt-milestone-filter');
  const assigneeFilter = getById<HTMLSelectElement>('gantt-assignee-filter');
  const stateFilter = getById<HTMLSelectElement>('gantt-state-filter');

  quickView?.closest('label')?.classList.toggle('is-active', quickView.value !== 'custom');
  milestoneFilter?.closest('label')?.classList.toggle('is-active', Boolean(milestoneFilter.value));
  assigneeFilter?.closest('label')?.classList.toggle('is-active', Boolean(assigneeFilter.value));
  stateFilter?.closest('label')?.classList.toggle('is-active', Boolean(stateFilter.value));

  const filtersPanel = document.querySelector<HTMLDetailsElement>('.timeline-filters-panel');
  const filtersSummary = filtersPanel?.querySelector<HTMLElement>('summary');
  const filtersCount = filtersSummary?.querySelector<HTMLElement>('.timeline-filter-count');
  const activeFilterCount = [milestoneFilter, assigneeFilter, stateFilter].filter((filter) =>
    Boolean(filter?.value),
  ).length;

  filtersPanel?.classList.toggle('is-active', activeFilterCount > 0);
  if (filtersSummary) {
    filtersSummary.title =
      activeFilterCount > 0 ? `已套用 ${activeFilterCount} 個篩選條件` : '更多篩選';
  }
  if (filtersCount) {
    filtersCount.hidden = activeFilterCount === 0;
    filtersCount.textContent = String(activeFilterCount);
  }
}

function getTimelineRangeMode(): TimelineRangeMode {
  const select = getById<HTMLSelectElement>('gantt-range-mode');
  return (select?.value as TimelineRangeMode) || state.timelineRangeMode;
}

function syncTimelineRangeControls(): void {
  const mode = getTimelineRangeMode();
  state.timelineRangeMode = mode;

  const monthInput = getById<HTMLInputElement>('gantt-month');
  const weekInput = getById<HTMLInputElement>('gantt-week');
  if (!monthInput || !weekInput) return;

  monthInput.hidden = mode !== 'month';
  monthInput.disabled = mode !== 'month';
  weekInput.hidden = mode !== 'week';
  weekInput.disabled = mode !== 'week';

  if (!monthInput.value) {
    const now = new Date();
    monthInput.value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }
  if (!weekInput.value) {
    weekInput.value = getIsoWeekValue(new Date());
  }

  state.ganttMonth = monthInput.value;
  state.ganttWeek = weekInput.value;
}

function getSelectedMonth(): { year: number; month: number; minDate: Date; maxDate: Date } {
  const input = byId<HTMLInputElement>('gantt-month');
  let val = input.value || state.ganttMonth;
  if (!val) {
    const now = new Date();
    val = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    input.value = val;
    state.ganttMonth = val;
  }
  const [y, m] = val.split('-').map(Number);
  const minDate = new Date(y, m - 1, 1);
  minDate.setHours(0, 0, 0, 0);
  const maxDate = new Date(y, m, 0); // last day of month
  maxDate.setHours(0, 0, 0, 0);
  return { year: y, month: m, minDate, maxDate };
}

function getSelectedTimelineWindow(): {
  mode: TimelineRangeMode;
  start: Date;
  end: Date;
  label: string;
} {
  const mode = getTimelineRangeMode();
  if (mode === 'week') {
    const input = byId<HTMLInputElement>('gantt-week');
    let value = input.value || state.ganttWeek;
    if (!value) {
      value = getIsoWeekValue(new Date());
      input.value = value;
    }
    const start = parseIsoWeekValue(value) ?? getStartOfWeek(new Date());
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    end.setHours(0, 0, 0, 0);
    state.ganttWeek = value;
    return {
      mode,
      start,
      end,
      label: `${start.getMonth() + 1}/${start.getDate()} - ${end.getMonth() + 1}/${end.getDate()}`,
    };
  }

  const { year, month, minDate, maxDate } = getSelectedMonth();
  return {
    mode,
    start: minDate,
    end: maxDate,
    label: `${year}/${String(month).padStart(2, '0')}`,
  };
}

function shiftMonth(delta: number): void {
  if (getTimelineRangeMode() === 'week') {
    const weekInput = byId<HTMLInputElement>('gantt-week');
    const baseWeek =
      parseIsoWeekValue(weekInput.value || state.ganttWeek) ?? getStartOfWeek(new Date());
    baseWeek.setDate(baseWeek.getDate() + delta * 7);
    const value = getIsoWeekValue(baseWeek);
    weekInput.value = value;
    state.ganttWeek = value;
  } else {
    const { year, month } = getSelectedMonth();
    const d = new Date(year, month - 1 + delta, 1);
    const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    byId<HTMLInputElement>('gantt-month').value = val;
    state.ganttMonth = val;
  }
  scheduleGanttRender(state.allIssues);
}

/* ══════════════════════════════════════════════
   TAB 3: EXCEL-LIKE TABLE
   ══════════════════════════════════════════════ */
function populateGanttFiltersEnhanced(issues: IssueItem[]): void {
  const milestones = getSortedMilestoneEntriesFromIssues(issues);
  const assignees = [...new Set(issues.flatMap((i) => i.assignees || []))].filter(Boolean).sort();

  const mSel = byId<HTMLSelectElement>('gantt-milestone-filter');
  const aSel = byId<HTMLSelectElement>('gantt-assignee-filter');
  const aVal = aSel.value;

  populateMilestoneFilterOptions(mSel, milestones);
  aSel.innerHTML =
    '<option value="">全部</option>' +
    assignees.map((a) => `<option value="${escapeHtml(a)}">${escapeHtml(a)}</option>`).join('');

  aSel.value = aVal;
  updateTimelineFilterIndicators();
}

function applyGanttQuickView(
  issues: IssueItem[],
  today: Date,
  quickView: GanttQuickView,
): IssueItem[] {
  switch (quickView) {
    case 'overdue':
      return issues.filter(
        (issue) =>
          issue.state !== 'closed' &&
          (startOfDay(issue.due_date)?.getTime() ?? Number.POSITIVE_INFINITY) < today.getTime(),
      );
    case 'due_soon':
      return issues.filter((issue) => {
        const due = startOfDay(issue.due_date);
        if (!due || issue.state === 'closed') return false;
        const diff = daysBetween(due, today);
        return diff >= 0 && diff <= 7;
      });
    case 'unassigned':
      return issues.filter((issue) => !issue.assignees?.length);
    case 'no_due_date':
      return issues.filter((issue) => !issue.due_date);
    case 'active_milestones':
      return issues.filter((issue) => issue.state !== 'closed' && Boolean(issue.milestone));
    default:
      return issues;
  }
}

function getGanttGroupInfo(
  issue: IssueItem,
  groupBy: GanttGroupBy,
): { key: string; label: string; avatarUrl?: string | null } {
  switch (groupBy) {
    case 'milestone':
      return { key: issue.milestone || '__none__', label: issue.milestone || '未排 Milestone' };
    case 'assignee':
      return { key: issue.assignees?.[0] || '__none__', label: issue.assignees?.[0] || '未指派' };
    case 'module':
      return { key: issue.module || '__none__', label: issue.module || '未分類 Module' };
    default:
      return { key: '__all__', label: '全部 Issue' };
  }
}

function buildGanttGroupsEnhanced(
  issues: IssueItem[],
  groupBy: GanttGroupBy,
): Array<{ key: string; label: string; items: IssueItem[] }> {
  if (groupBy === 'none') {
    return [
      { key: '__all__', label: '全部 Issue', items: [...issues].sort(compareIssuesForGantt) },
    ];
  }

  const groups = new Map<string, { key: string; label: string; items: IssueItem[] }>();
  for (const issue of issues) {
    const group = getGanttGroupInfo(issue, groupBy);
    if (!groups.has(group.key)) {
      groups.set(group.key, { ...group, items: [] });
    }
    groups.get(group.key)!.items.push(issue);
  }

  return Array.from(groups.values())
    .map((group) => ({ ...group, items: group.items.sort(compareIssuesForGantt) }))
    .sort((left, right) => left.label.localeCompare(right.label, 'zh-Hant'));
}

function getVisibleMilestoneDeadlines(
  issues: IssueItem[],
  minDate: Date,
  maxDate: Date,
): Array<{ milestone: string; dueDate: Date }> {
  function getPrimaryAssigneeAvatar(issue: IssueItem): string | null {
    return issue.assignee_details?.find((item) => item.avatar_url)?.avatar_url ?? null;
  }

  function buildGanttGroupsWithAvatar(
    sourceIssues: IssueItem[],
    groupBy: GanttGroupBy,
  ): Array<{ key: string; label: string; avatarUrl: string | null; items: IssueItem[] }> {
    if (groupBy === 'none') {
      return [
        {
          key: '__all__',
          label: '全部 Issue',
          avatarUrl: null,
          items: [...sourceIssues].sort(compareIssuesForGantt),
        },
      ];
    }

    const groups = new Map<
      string,
      { key: string; label: string; avatarUrl: string | null; items: IssueItem[] }
    >();
    for (const issue of sourceIssues) {
      const group = getGanttGroupInfo(issue, groupBy);
      if (!groups.has(group.key)) {
        groups.set(group.key, {
          key: group.key,
          label: group.label,
          avatarUrl: groupBy === 'assignee' ? getPrimaryAssigneeAvatar(issue) : null,
          items: [],
        });
      }

      const existing = groups.get(group.key)!;
      existing.items.push(issue);
      if (!existing.avatarUrl && groupBy === 'assignee') {
        existing.avatarUrl = getPrimaryAssigneeAvatar(issue);
      }
    }

    return Array.from(groups.values())
      .map((group) => ({ ...group, items: group.items.sort(compareIssuesForGantt) }))
      .sort((left, right) => left.label.localeCompare(right.label, 'zh-Hant'));
  }

  if (!state.analytics) return [];
  const visibleMilestones = new Set(
    issues.map((issue) => issue.milestone).filter(Boolean) as string[],
  );

  return state.analytics.burndown
    .filter((milestone) => visibleMilestones.has(milestone.milestone))
    .map((milestone) => ({
      milestone: milestone.milestone,
      dueDate: startOfDay(milestone.due_date),
    }))
    .filter((item): item is { milestone: string; dueDate: Date } => Boolean(item.dueDate))
    .filter((item) => item.dueDate >= minDate && item.dueDate <= maxDate)
    .sort((left, right) => left.dueDate.getTime() - right.dueDate.getTime());
}

function getMilestoneRangeMap(): Map<string, { start: Date | null; end: Date | null }> {
  return new Map(
    (state.analytics?.burndown ?? []).map((milestone) => [
      milestone.milestone,
      {
        start: startOfDay(milestone.start_date),
        end: startOfDay(milestone.due_date),
      },
    ]),
  );
}

function getIssueTimelineRange(
  issue: IssueItem,
  milestoneRanges: Map<string, { start: Date | null; end: Date | null }>,
  today: Date,
): { start: Date; end: Date } {
  const milestoneStart = startOfDay(issue.milestone_start_date);
  const milestoneEnd = startOfDay(issue.milestone_due_date);
  const mappedRange = issue.milestone ? milestoneRanges.get(issue.milestone) : undefined;
  const resolvedMilestoneStart = milestoneStart ?? mappedRange?.start;
  const resolvedMilestoneEnd = milestoneEnd ?? mappedRange?.end;

  if (issue.state === 'closed') {
    if (resolvedMilestoneStart || resolvedMilestoneEnd) {
      const closedStart =
        resolvedMilestoneStart ?? resolvedMilestoneEnd ?? startOfDay(issue.created_at) ?? today;
      const closedEnd =
        resolvedMilestoneEnd ??
        resolvedMilestoneStart ??
        startOfDay(issue.closed_at) ??
        closedStart;
      return {
        start: closedStart,
        end: closedEnd < closedStart ? closedStart : closedEnd,
      };
    }

    const closedStart = startOfDay(issue.created_at) ?? today;
    const closedEnd = startOfDay(issue.closed_at) ?? closedStart;
    return {
      start: closedStart,
      end: closedEnd < closedStart ? closedStart : closedEnd,
    };
  }

  const scheduleStart = resolvedMilestoneStart ?? startOfDay(issue.created_at) ?? today;
  const scheduleEnd =
    resolvedMilestoneEnd ??
    startOfDay(issue.due_date) ??
    (scheduleStart > today ? scheduleStart : today);

  return {
    start: scheduleStart,
    end: scheduleEnd < scheduleStart ? scheduleStart : scheduleEnd,
  };
}

function renderGanttEnhanced(issues: IssueItem[]): void {
  const container = byId<HTMLDivElement>('gantt-chart');
  const summary = byId<HTMLDivElement>('gantt-summary');

  if (!issues.length) {
    summary.textContent = '目前沒有可顯示的 Issue。';
    container.innerHTML = '<div class="empty-state">目前沒有可顯示的 Issue。</div>';
    return;
  }

  const today = startOfDay(new Date())!;
  const quickView = byId<HTMLSelectElement>('gantt-quick-view').value as GanttQuickView;
  const groupBy = byId<HTMLSelectElement>('gantt-group-by').value as GanttGroupBy;
  const milestoneFilter = byId<HTMLSelectElement>('gantt-milestone-filter').value;
  const assigneeFilter = byId<HTMLSelectElement>('gantt-assignee-filter').value;
  const stateFilter = byId<HTMLSelectElement>('gantt-state-filter').value;
  const milestoneRanges = getMilestoneRangeMap();

  let filtered = [...issues];
  if (milestoneFilter) filtered = filtered.filter((issue) => issue.milestone === milestoneFilter);
  if (assigneeFilter)
    filtered = filtered.filter((issue) => (issue.assignees || []).includes(assigneeFilter));
  if (stateFilter) filtered = filtered.filter((issue) => issue.state === stateFilter);

  filtered = applyGanttQuickView(filtered, today, quickView);

  const windowRange = getSelectedTimelineWindow();
  const minDate = windowRange.start;
  const maxDate = windowRange.end;

  // Filter issues that overlap with the selected month
  filtered = filtered.filter((issue) => {
    const { start, end } = getIssueTimelineRange(issue, milestoneRanges, today);
    return start <= maxDate && end >= minDate;
  });

  if (!filtered.length) {
    summary.textContent = '目前篩選條件下沒有符合的 Issue。';
    container.innerHTML = '<div class="empty-state">目前篩選條件下沒有符合的 Issue。</div>';
    return;
  }

  const days: Date[] = [];
  const cursor = new Date(minDate);
  while (cursor <= maxDate) {
    days.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }

  const totalDays = days.length;
  const labelWidth = 260;
  const dayWidth = totalDays <= 30 ? 40 : totalDays <= 60 ? 30 : totalDays <= 120 ? 22 : 16;
  const gridTotalWidth = totalDays * dayWidth;
  const todayStr = today.toISOString().slice(0, 10);

  function dayIndex(date: Date): number {
    return Math.round((date.getTime() - minDate.getTime()) / 86400000);
  }

  const labelInterval = Math.max(1, Math.ceil(40 / dayWidth));
  let monthHeaderHtml = '';
  let dayHeaderHtml = '';
  let prevMonth = -1;
  let monthSpanStart = 0;
  const monthSegments: { label: string; span: number }[] = [];

  for (let i = 0; i < totalDays; i++) {
    const day = days[i];
    const monthKey = day.getFullYear() * 100 + day.getMonth();
    if (monthKey !== prevMonth) {
      if (prevMonth !== -1) {
        monthSegments.push({
          label: `${days[monthSpanStart].getFullYear()}/${days[monthSpanStart].getMonth() + 1}`,
          span: i - monthSpanStart,
        });
      }
      monthSpanStart = i;
      prevMonth = monthKey;
    }

    const showLabel =
      i % labelInterval === 0 || day.getDate() === 1 || day.toISOString().slice(0, 10) === todayStr;
    const classes = [
      day.getDay() === 0 || day.getDay() === 6 ? 'weekend' : '',
      day.toISOString().slice(0, 10) === todayStr ? 'today' : '',
    ]
      .filter(Boolean)
      .join(' ');
    dayHeaderHtml += `<div class="gantt-header-day ${classes}" style="width:${dayWidth}px">${showLabel ? day.getDate() : ''}</div>`;
  }

  monthSegments.push({
    label: `${days[monthSpanStart].getFullYear()}/${days[monthSpanStart].getMonth() + 1}`,
    span: totalDays - monthSpanStart,
  });
  for (const segment of monthSegments) {
    monthHeaderHtml += `<div class="gantt-header-month" style="width:${segment.span * dayWidth}px">${segment.label}</div>`;
  }

  let bgStrips = '';
  for (let i = 0; i < totalDays; i++) {
    const day = days[i];
    const isWeekend = day.getDay() === 0 || day.getDay() === 6;
    const isToday = day.toISOString().slice(0, 10) === todayStr;
    if (isWeekend) {
      bgStrips += `<div class="gantt-bg-strip weekend" style="left:${i * dayWidth}px;width:${dayWidth}px"></div>`;
    }
    if (isToday) {
      bgStrips += `<div class="gantt-bg-strip today" style="left:${i * dayWidth}px;width:${dayWidth}px"></div>`;
    }
  }

  const groups = buildGanttGroupsForSafeRender(filtered, groupBy);
  const deadlineMarkers = getVisibleMilestoneDeadlines(filtered, minDate, maxDate)
    .map((marker) => {
      const left = dayIndex(marker.dueDate) * dayWidth + dayWidth / 2;
      return `
        <div class="gantt-deadline-marker" style="left:${left}px">
          <span class="gantt-deadline-label" title="${escapeHtml(marker.milestone)}">${escapeHtml(marker.milestone)}</span>
          <span class="gantt-deadline-line"></span>
        </div>
      `;
    })
    .join('');

  let rowsHtml = '';
  let riskIssueCount = 0;
  for (const group of groups) {
    const collapsed = state.ganttCollapsedGroups.has(group.key);
    const groupRiskCount = group.items.filter(
      (issue) => getGanttRiskFlags(issue, today).length > 0,
    ).length;

    if (groupBy !== 'none') {
      const groupAvatar =
        groupBy === 'assignee'
          ? group.avatarUrl
            ? `<span class="gantt-group-avatar-shell"><img class="gantt-group-avatar" src="${escapeHtml(group.avatarUrl)}" alt="${escapeHtml(group.label)}" /></span>`
            : `<span class="gantt-group-avatar-shell"><span class="gantt-group-avatar fallback">${escapeHtml(group.label.slice(0, 1).toUpperCase())}</span></span>`
          : '';
      rowsHtml += `
        <div class="gantt-group-header" style="grid-template-columns:${labelWidth}px ${gridTotalWidth}px" data-group-key="${escapeHtml(group.key)}">
          <div class="gantt-group-title">
            <span class="gantt-group-toggle">${collapsed ? '+' : '-'}</span>
            ${groupAvatar}
            <strong>${escapeHtml(group.label)}</strong>
            <div class="gantt-group-meta">
              <span class="gantt-group-badge">${group.items.length} issues</span>
              ${groupRiskCount ? `<span class="gantt-group-badge risk">${groupRiskCount} 風險</span>` : ''}
            </div>
          </div>
          <div class="gantt-group-spacer"></div>
        </div>
      `;
    }

    if (collapsed) continue;

    for (const issue of group.items) {
      const { start: scheduleStart, end: scheduleEnd } = getIssueTimelineRange(
        issue,
        milestoneRanges,
        today,
      );
      const riskFlags = getGanttRiskFlags(issue, today);
      if (riskFlags.length > 0) riskIssueCount += 1;

      const barStart = dayIndex(scheduleStart);
      const barEnd = dayIndex(scheduleEnd);
      const startPx = barStart * dayWidth;
      const widthPx = Math.max(dayWidth, (barEnd - barStart + 1) * dayWidth - 4);

      let barClass = issue.state === 'closed' ? 'closed' : 'opened';
      const issueDue = startOfDay(issue.due_date);
      if (issue.state !== 'closed' && issueDue && issueDue < today) {
        barClass = 'overdue';
      }

      const assigneeStr = (issue.assignees || []).join(', ') || '未指派';
      const riskClasses = riskFlags.map((flag) => `risk-${flag}`).join(' ');
      const riskTags = !riskFlags.length
        ? ''
        : `<div class="gantt-risk-tags">${riskFlags
            .slice(0, 3)
            .map((flag) => `<span class="risk-tag ${flag}">${getRiskFlagLabel(flag)}</span>`)
            .join('')}</div>`;

      rowsHtml += `
        <div class="gantt-row" style="grid-template-columns:${labelWidth}px ${gridTotalWidth}px">
          <div class="gantt-row-label" data-iid="${issue.iid}" title="#${issue.iid} ${escapeHtml(issue.title)}">
            <strong>#${issue.iid}</strong> ${escapeHtml(issue.title.length > 26 ? `${issue.title.slice(0, 26)}...` : issue.title)}
            <small>${escapeHtml(assigneeStr)} · ${escapeHtml(issue.milestone ?? '未排 Milestone')} · ${escapeHtml(issue.module ?? '未分類 Module')}</small>
            ${riskTags}
          </div>
          <div class="gantt-row-bars">
            <div class="gantt-bar ${barClass} ${riskClasses}"
                 style="left:${startPx + 2}px;width:${widthPx}px;"
                 data-iid="${issue.iid}"
                 data-title="${escapeHtml(issue.title)}"
                 data-state="${issue.state}"
                 data-assignees="${escapeHtml(assigneeStr)}"
                 data-milestone="${escapeHtml(issue.milestone ?? '-')}"
                 data-module="${escapeHtml(issue.module ?? '-')}"
                 data-created="${formatGanttDate(scheduleStart)}"
                 data-due="${formatGanttDate(scheduleEnd)}"
                 data-risk="${escapeHtml(riskFlags.map((flag) => getRiskFlagLabel(flag)).join('、') || '無')}"
                 data-url="${escapeHtml(issue.web_url ?? '')}">
              <span class="gantt-bar-label">${widthPx > 64 ? `#${issue.iid}` : ''}</span>
            </div>
          </div>
        </div>
      `;
    }
  }

  const todayIdx = dayIndex(today);
  const todayPx = todayIdx * dayWidth + dayWidth / 2;
  const groupLabel = groupBy === 'none' ? '不分組' : `依 ${groupBy} 分組`;
  const quickViewLabel =
    byId<HTMLSelectElement>('gantt-quick-view').selectedOptions[0]?.textContent || '自訂';
  summary.textContent = `顯示 ${filtered.length} / ${issues.length} 筆，${groupLabel}，快速視圖：${quickViewLabel}${riskIssueCount ? `，共 ${riskIssueCount} 筆風險` : ''}`;

  container.setAttribute('data-risk-mode', 'highlight');
  container.innerHTML = `
    <div class="gantt-scroll">
      <div class="gantt-header" style="grid-template-columns:${labelWidth}px ${gridTotalWidth}px">
        <div class="gantt-header-label">Issue</div>
        <div class="gantt-header-dates-wrap">
          <div class="gantt-header-months" style="display:flex">${monthHeaderHtml}</div>
          <div class="gantt-header-dates" style="display:flex">${dayHeaderHtml}</div>
        </div>
      </div>
      <div class="gantt-body">
        <div class="gantt-body-inner">
          <div class="gantt-bg-strips" style="left:${labelWidth}px;width:${gridTotalWidth}px">${bgStrips}</div>
          <div class="gantt-deadlines" style="left:${labelWidth}px;width:${gridTotalWidth}px">${deadlineMarkers}</div>
          ${rowsHtml}
          ${todayIdx >= 0 && todayIdx < totalDays ? `<div class="gantt-today-line" style="left:${todayPx + labelWidth}px"></div>` : ''}
        </div>
      </div>
    </div>
  `;

  const tooltip = ensureGanttTooltip();
  container.querySelectorAll<HTMLElement>('.gantt-bar').forEach((bar) => {
    bar.addEventListener('mouseenter', (event) => {
      const el = event.currentTarget as HTMLElement;
      tooltip.innerHTML = `
        <h5>#${el.dataset.iid} ${el.dataset.title}</h5>
        <p>狀態：${el.dataset.state === 'opened' ? '進行中' : '已完成'}</p>
        <p>Assignee：${el.dataset.assignees}</p>
        <p>Milestone：${el.dataset.milestone}</p>
        <p>Module：${el.dataset.module}</p>
        <p>起始：${el.dataset.created} · 到期：${el.dataset.due}</p>
        <p>風險：${el.dataset.risk}</p>
        <p>單擊開啟詳細，雙擊前往來源平台</p>
      `;
      tooltip.classList.add('visible');
    });
    bar.addEventListener('mousemove', (event) => {
      const me = event as MouseEvent;
      tooltip.style.left = `${me.clientX + 12}px`;
      tooltip.style.top = `${me.clientY + 12}px`;
    });
    bar.addEventListener('mouseleave', () => {
      tooltip.classList.remove('visible');
    });
    bar.addEventListener('click', (event) => {
      const el = event.currentTarget as HTMLElement;
      const issue = state.allIssues.find((item) => item.iid === Number(el.dataset.iid));
      if (issue) openIssueDetail(issue);
    });
    bar.addEventListener('dblclick', (event) => {
      const el = event.currentTarget as HTMLElement;
      if (el.dataset.url) {
        void window.trackerBridge.openPath(el.dataset.url);
      }
    });
  });

  container.querySelectorAll<HTMLElement>('.gantt-row-label[data-iid]').forEach((label) => {
    label.addEventListener('click', (event) => {
      const el = event.currentTarget as HTMLElement;
      const issue = state.allIssues.find((item) => item.iid === Number(el.dataset.iid));
      if (issue) openIssueDetail(issue);
    });
  });

  container
    .querySelectorAll<HTMLElement>('.gantt-group-header[data-group-key]')
    .forEach((header) => {
      header.addEventListener('click', (event) => {
        const el = event.currentTarget as HTMLElement;
        const key = el.dataset.groupKey;
        if (!key) return;
        if (state.ganttCollapsedGroups.has(key)) {
          state.ganttCollapsedGroups.delete(key);
        } else {
          state.ganttCollapsedGroups.add(key);
        }
        scheduleGanttRender(state.allIssues);
      });
    });
}

/* ══════════════════════════════════════════════
   CALENDAR VIEW
   ══════════════════════════════════════════════ */
function renderCalendarView(issues: IssueItem[]): void {
  const container = byId<HTMLDivElement>('calendar-chart');
  const summary = byId<HTMLDivElement>('gantt-summary');

  if (!issues.length) {
    summary.textContent = '目前沒有可顯示的 Issue。';
    container.innerHTML = '<div class="empty-state">目前沒有可顯示的 Issue。</div>';
    return;
  }

  const today = startOfDay(new Date())!;
  const todayStr = today.toISOString().slice(0, 10);
  const quickView = byId<HTMLSelectElement>('gantt-quick-view').value as GanttQuickView;
  const milestoneFilter = byId<HTMLSelectElement>('gantt-milestone-filter').value;
  const assigneeFilter = byId<HTMLSelectElement>('gantt-assignee-filter').value;
  const stateFilter = byId<HTMLSelectElement>('gantt-state-filter').value;
  const milestoneRanges = getMilestoneRangeMap();

  let filtered = [...issues];
  if (milestoneFilter) filtered = filtered.filter((i) => i.milestone === milestoneFilter);
  if (assigneeFilter)
    filtered = filtered.filter((i) => (i.assignees || []).includes(assigneeFilter));
  if (stateFilter) filtered = filtered.filter((i) => i.state === stateFilter);
  filtered = applyGanttQuickView(filtered, today, quickView);

  const { year, month, minDate, maxDate } = getSelectedMonth();

  // Filter issues overlapping this month
  filtered = filtered.filter((issue) => {
    const { start, end } = getIssueTimelineRange(issue, milestoneRanges, today);
    return start <= maxDate && end >= minDate;
  });

  // Build calendar grid: find the Monday before (or on) the 1st, end on Sunday after (or on) last day
  const totalDaysInMonth = maxDate.getDate();
  const firstDow = minDate.getDay(); // 0=Sun
  const startOffset = firstDow === 0 ? 6 : firstDow - 1; // days to go back to reach Monday
  const calStart = new Date(year, month - 1, 1 - startOffset);
  calStart.setHours(0, 0, 0, 0);
  // Build 6 weeks (42 cells) to always have consistent grid
  const totalCells = 42;
  const cells: Date[] = [];
  for (let i = 0; i < totalCells; i++) {
    const d = new Date(calStart);
    d.setDate(calStart.getDate() + i);
    d.setHours(0, 0, 0, 0);
    cells.push(d);
  }

  // Map issues to each day they span
  const dayIssuesMap = new Map<string, IssueItem[]>();
  for (const issue of filtered) {
    const { start, end } = getIssueTimelineRange(issue, milestoneRanges, today);
    for (const cell of cells) {
      if (cell >= start && cell <= end) {
        const key = cell.toISOString().slice(0, 10);
        if (!dayIssuesMap.has(key)) dayIssuesMap.set(key, []);
        dayIssuesMap.get(key)!.push(issue);
      }
    }
  }

  // Compute bar segments per issue: for each cell, determine if the issue
  // starts, continues, or ends on that day so we can render connected bars
  function getBarSegment(
    issue: IssueItem,
    cellDate: Date,
  ): 'start' | 'middle' | 'end' | 'single' | null {
    const { start, end } = getIssueTimelineRange(issue, milestoneRanges, today);
    const cellStr = cellDate.toISOString().slice(0, 10);
    const startStr = start.toISOString().slice(0, 10);
    const endStr = end.toISOString().slice(0, 10);
    if (cellDate < start || cellDate > end) return null;
    const isStart = cellStr === startStr || cellDate.getDay() === 1; // bar start or Monday (new row)
    const isEnd = cellStr === endStr || cellDate.getDay() === 0; // bar end or Sunday (end of row)
    if (isStart && isEnd) return 'single';
    if (isStart) return 'start';
    if (isEnd) return 'end';
    return 'middle';
  }

  const weekdayHeaders = ['一', '二', '三', '四', '五', '六', '日'];
  let html = '<div class="cal-grid">';
  // Weekday header row
  html += '<div class="cal-header-row">';
  for (const wd of weekdayHeaders) {
    html += `<div class="cal-header-cell">${wd}</div>`;
  }
  html += '</div>';

  // Calendar cells
  html += '<div class="cal-body">';
  for (let i = 0; i < totalCells; i++) {
    const cell = cells[i];
    const cellStr = cell.toISOString().slice(0, 10);
    const inMonth = cell.getMonth() === month - 1;
    const isToday = cellStr === todayStr;
    const isWeekend = cell.getDay() === 0 || cell.getDay() === 6;
    const cellIssues = dayIssuesMap.get(cellStr) || [];

    const classes = [
      'cal-cell',
      inMonth ? '' : 'other-month',
      isToday ? 'today' : '',
      isWeekend ? 'weekend' : '',
    ]
      .filter(Boolean)
      .join(' ');

    html += `<div class="${classes}">`;
    html += `<div class="cal-date">${cell.getDate()}</div>`;
    html += '<div class="cal-issues">';

    // Render bar segments for issues on this day
    const seen = new Set<number>();
    for (const issue of cellIssues) {
      if (seen.has(issue.iid)) continue;
      seen.add(issue.iid);
      const seg = getBarSegment(issue, cell);
      if (!seg) continue;

      let barClass = issue.state === 'closed' ? 'closed' : 'opened';
      const issueDue = startOfDay(issue.due_date);
      if (issue.state !== 'closed' && issueDue && issueDue < today) barClass = 'overdue';

      const showLabel = seg === 'start' || seg === 'single';
      const label = showLabel
        ? `#${issue.iid} ${issue.title.length > 12 ? issue.title.slice(0, 12) + '...' : issue.title}`
        : '';

      html += `<div class="cal-bar ${barClass} seg-${seg}"
                    data-iid="${issue.iid}"
                    data-title="${escapeHtml(issue.title)}"
                    data-state="${issue.state}"
                    data-assignees="${escapeHtml((issue.assignees || []).join(', ') || '未指派')}"
                    data-milestone="${escapeHtml(issue.milestone ?? '-')}"
                    data-module="${escapeHtml(issue.module ?? '-')}"
                    data-created="${formatGanttDate(getIssueTimelineRange(issue, milestoneRanges, today).start)}"
                    data-due="${formatGanttDate(getIssueTimelineRange(issue, milestoneRanges, today).end)}"
                    data-url="${escapeHtml(issue.web_url ?? '')}">
        ${showLabel ? `<span class="cal-bar-label">${escapeHtml(label)}</span>` : ''}
      </div>`;
    }

    html += '</div></div>';
  }
  html += '</div></div>';

  summary.textContent = `月曆模式：${year} 年 ${month} 月，顯示 ${filtered.length} / ${issues.length} 筆`;
  container.innerHTML = html;

  // Wire tooltip + click for calendar bars
  const tooltip = ensureGanttTooltip();
  container.querySelectorAll<HTMLElement>('.cal-bar').forEach((bar) => {
    bar.addEventListener('mouseenter', (event) => {
      const el = event.currentTarget as HTMLElement;
      tooltip.innerHTML = `
        <h5>#${el.dataset.iid} ${el.dataset.title}</h5>
        <p>狀態：${el.dataset.state === 'opened' ? '進行中' : '已完成'}</p>
        <p>Assignee：${el.dataset.assignees}</p>
        <p>Milestone：${el.dataset.milestone}</p>
        <p>起始：${el.dataset.created} · 到期：${el.dataset.due}</p>
      `;
      tooltip.classList.add('visible');
    });
    bar.addEventListener('mousemove', (event) => {
      const me = event as MouseEvent;
      tooltip.style.left = `${me.clientX + 12}px`;
      tooltip.style.top = `${me.clientY + 12}px`;
    });
    bar.addEventListener('mouseleave', () => tooltip.classList.remove('visible'));
    bar.addEventListener('click', (event) => {
      const el = event.currentTarget as HTMLElement;
      const issue = state.allIssues.find((item) => item.iid === Number(el.dataset.iid));
      if (issue) openIssueDetail(issue);
    });
    bar.addEventListener('dblclick', (event) => {
      const el = event.currentTarget as HTMLElement;
      if (el.dataset.url) void window.trackerBridge.openPath(el.dataset.url);
    });
  });
}

function getPrimaryAssigneeAvatarForGantt(issue: IssueItem): string | null {
  return issue.assignee_details?.find((item) => item.avatar_url)?.avatar_url ?? null;
}

function buildGanttGroupsForSafeRender(
  issues: IssueItem[],
  groupBy: GanttGroupBy,
): Array<{ key: string; label: string; avatarUrl: string | null; items: IssueItem[] }> {
  if (groupBy === 'none') {
    return [
      {
        key: '__all__',
        label: '全部 Issue',
        avatarUrl: null,
        items: [...issues].sort(compareIssuesForGantt),
      },
    ];
  }

  const groups = new Map<
    string,
    { key: string; label: string; avatarUrl: string | null; items: IssueItem[] }
  >();
  for (const issue of issues) {
    const group = getGanttGroupInfo(issue, groupBy);
    if (!groups.has(group.key)) {
      groups.set(group.key, {
        key: group.key,
        label: group.label,
        avatarUrl: groupBy === 'assignee' ? getPrimaryAssigneeAvatarForGantt(issue) : null,
        items: [],
      });
    }

    const existing = groups.get(group.key)!;
    existing.items.push(issue);
    if (!existing.avatarUrl && groupBy === 'assignee') {
      existing.avatarUrl = getPrimaryAssigneeAvatarForGantt(issue);
    }
  }

  return Array.from(groups.values())
    .map((group) => ({ ...group, items: group.items.sort(compareIssuesForGantt) }))
    .sort((left, right) => left.label.localeCompare(right.label, 'zh-Hant'));
}

function decorateGanttRowAvatars(container: HTMLDivElement, issues: IssueItem[]): void {
  const issueMap = new Map(issues.map((issue) => [String(issue.iid), issue]));

  container.querySelectorAll<HTMLElement>('.gantt-row-label[data-iid]').forEach((label) => {
    const issue = issueMap.get(label.dataset.iid ?? '');
    if (!issue) return;

    const assigneeText = (issue.assignees || []).join(', ') || 'Unassigned';
    const primaryAssignee = issue.assignee_details?.[0]?.name || issue.assignees?.[0] || 'U';
    const assigneeAvatar = getPrimaryAssigneeAvatarForGantt(issue);
    const assigneeAvatarHtml = assigneeAvatar
      ? `<img class="gantt-row-avatar" src="${escapeHtml(assigneeAvatar)}" alt="${escapeHtml(primaryAssignee)}" />`
      : `<span class="gantt-row-avatar fallback">${escapeHtml(primaryAssignee.slice(0, 1).toUpperCase())}</span>`;
    const riskTags = label.querySelector('.gantt-risk-tags')?.outerHTML ?? '';

    label.innerHTML = `
      <div class="gantt-row-head">
        ${assigneeAvatarHtml}
        <div class="gantt-row-copy">
          <div class="gantt-row-title"><strong>#${issue.iid}</strong> ${escapeHtml(issue.title.length > 34 ? `${issue.title.slice(0, 34)}...` : issue.title)}</div>
          <small>${escapeHtml(assigneeText)} 繚 ${escapeHtml(issue.milestone ?? 'No milestone')} 繚 ${escapeHtml(issue.module ?? 'No module')}</small>
        </div>
      </div>
      ${riskTags}
    `;
  });
}

function renderGanttEnhancedSafe(issues: IssueItem[]): void {
  const container = byId<HTMLDivElement>('gantt-chart');
  const summary = byId<HTMLDivElement>('gantt-summary');
  const tooltip = ensureGanttTooltip();

  if (!issues.length) {
    summary.textContent = '沒有可顯示的 issue。';
    container.innerHTML = '<div class="empty-state">沒有可顯示的 issue。</div>';
    return;
  }

  const today = startOfDay(new Date())!;
  const quickView = byId<HTMLSelectElement>('gantt-quick-view').value as GanttQuickView;
  const groupBy = byId<HTMLSelectElement>('gantt-group-by').value as GanttGroupBy;
  const milestoneFilter = byId<HTMLSelectElement>('gantt-milestone-filter').value;
  const assigneeFilter = byId<HTMLSelectElement>('gantt-assignee-filter').value;
  const stateFilter = byId<HTMLSelectElement>('gantt-state-filter').value;
  const milestoneRanges = getMilestoneRangeMap();
  const windowRange = getSelectedTimelineWindow();

  let filtered = [...issues];
  if (milestoneFilter) filtered = filtered.filter((issue) => issue.milestone === milestoneFilter);
  if (assigneeFilter)
    filtered = filtered.filter((issue) => (issue.assignees || []).includes(assigneeFilter));
  if (stateFilter) filtered = filtered.filter((issue) => issue.state === stateFilter);
  filtered = applyGanttQuickView(filtered, today, quickView);
  filtered = filtered.filter((issue) => {
    const { start, end } = getIssueTimelineRange(issue, milestoneRanges, today);
    return start <= windowRange.end && end >= windowRange.start;
  });

  if (!filtered.length) {
    summary.textContent = `這個${windowRange.mode === 'week' ? '週' : '月'}區間沒有符合條件的 issue。`;
    container.innerHTML = '<div class="empty-state">這個區間沒有符合條件的 issue。</div>';
    return;
  }

  const days: Date[] = [];
  const cursor = new Date(windowRange.start);
  while (cursor <= windowRange.end) {
    days.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }

  const totalDays = days.length;
  const labelWidth = windowRange.mode === 'week' ? 300 : 260;
  const baseDayWidth = windowRange.mode === 'week' ? 128 : totalDays <= 31 ? 36 : 24;
  const baseGridTotalWidth = totalDays * baseDayWidth;
  const availableGridWidth =
    windowRange.mode === 'week'
      ? Math.max(baseGridTotalWidth, container.clientWidth - labelWidth - 2)
      : baseGridTotalWidth;
  const dayWidth = availableGridWidth / totalDays;
  const gridTotalWidth = dayWidth * totalDays;
  const todayStr = today.toISOString().slice(0, 10);

  const dayIndex = (date: Date): number =>
    Math.round((date.getTime() - windowRange.start.getTime()) / 86400000);
  const groups = buildGanttGroupsForSafeRender(filtered, groupBy);
  const deadlineMarkers = getVisibleMilestoneDeadlines(filtered, windowRange.start, windowRange.end)
    .map((marker) => {
      const left = dayIndex(marker.dueDate) * dayWidth + dayWidth / 2;
      return `
        <div class="gantt-deadline-marker" style="left:${left}px">
          <span class="gantt-deadline-label" title="${escapeHtml(marker.milestone)}">${escapeHtml(marker.milestone)}</span>
          <span class="gantt-deadline-line"></span>
        </div>
      `;
    })
    .join('');

  let monthHeaderHtml = '';
  let dayHeaderHtml = '';
  const monthSegments: { label: string; span: number }[] = [];
  let prevMonthKey = -1;
  let monthSpanStart = 0;

  days.forEach((day, index) => {
    const monthKey = day.getFullYear() * 100 + day.getMonth();
    if (monthKey !== prevMonthKey) {
      if (prevMonthKey !== -1) {
        monthSegments.push({
          label: `${days[monthSpanStart].getFullYear()}/${days[monthSpanStart].getMonth() + 1}`,
          span: index - monthSpanStart,
        });
      }
      monthSpanStart = index;
      prevMonthKey = monthKey;
    }

    const isWeekend = day.getDay() === 0 || day.getDay() === 6;
    const isToday = day.toISOString().slice(0, 10) === todayStr;
    const weekday = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][day.getDay()];
    dayHeaderHtml += `
      <div class="gantt-header-day ${isWeekend ? 'weekend' : ''} ${isToday ? 'today' : ''}" style="width:${dayWidth}px">
        <span class="gantt-header-day-label">${weekday}</span>
        <span class="gantt-header-day-date">${day.getMonth() + 1}/${day.getDate()}</span>
      </div>
    `;
  });

  monthSegments.push({
    label: `${days[monthSpanStart].getFullYear()}/${days[monthSpanStart].getMonth() + 1}`,
    span: totalDays - monthSpanStart,
  });
  monthSegments.forEach((segment) => {
    monthHeaderHtml += `<div class="gantt-header-month" style="width:${segment.span * dayWidth}px">${segment.label}</div>`;
  });

  let bgStrips = '';
  days.forEach((day, index) => {
    const isWeekend = day.getDay() === 0 || day.getDay() === 6;
    const isToday = day.toISOString().slice(0, 10) === todayStr;
    if (isWeekend) {
      bgStrips += `<div class="gantt-bg-strip weekend" style="left:${index * dayWidth}px;width:${dayWidth}px"></div>`;
    }
    if (isToday) {
      bgStrips += `<div class="gantt-bg-strip today" style="left:${index * dayWidth}px;width:${dayWidth}px"></div>`;
    }
  });

  let rowsHtml = '';
  let riskIssueCount = 0;
  groups.forEach((group) => {
    const collapsed = state.ganttCollapsedGroups.has(group.key);
    const groupRiskCount = group.items.filter(
      (issue) => getGanttRiskFlags(issue, today).length > 0,
    ).length;

    if (groupBy !== 'none') {
      const groupAvatar =
        groupBy === 'assignee'
          ? group.avatarUrl
            ? `<span class="gantt-group-avatar-shell"><span class="gantt-group-avatar fallback">${escapeHtml(group.label.slice(0, 1).toUpperCase())}</span><img class="gantt-group-avatar" src="${escapeHtml(group.avatarUrl)}" alt="${escapeHtml(group.label)}" /></span>`
            : `<span class="gantt-group-avatar-shell"><span class="gantt-group-avatar fallback">${escapeHtml(group.label.slice(0, 1).toUpperCase())}</span></span>`
          : '';
      rowsHtml += `
        <div class="gantt-group-header" style="grid-template-columns:${labelWidth}px ${gridTotalWidth}px" data-group-key="${escapeHtml(group.key)}">
          <div class="gantt-group-title">
            <span class="gantt-group-toggle">${collapsed ? '+' : '-'}</span>
            ${groupAvatar}
            <strong>${escapeHtml(group.label)}</strong>
            <div class="gantt-group-meta">
              <span class="gantt-group-badge">${group.items.length} issues</span>
              ${groupRiskCount ? `<span class="gantt-group-badge risk">${groupRiskCount} 風險</span>` : ''}
            </div>
          </div>
          <div class="gantt-group-spacer"></div>
        </div>
      `;
    }

    if (collapsed) return;

    group.items.forEach((issue) => {
      const { start, end } = getIssueTimelineRange(issue, milestoneRanges, today);
      const riskFlags = getGanttRiskFlags(issue, today);
      const statusKind = getGanttStatusKind(issue);
      const mergeRequestCount = getResolvedMergeRequestCount(issue);
      if (riskFlags.length > 0) riskIssueCount += 1;

      const assigneeText = (issue.assignees || []).join(', ') || 'Unassigned';
      const clampedStart = start < windowRange.start ? windowRange.start : start;
      const clampedEnd = end > windowRange.end ? windowRange.end : end;
      const startPx = dayIndex(clampedStart) * dayWidth;
      const endPx = dayIndex(clampedEnd) * dayWidth;
      const widthPx = Math.max(dayWidth, endPx - startPx + dayWidth - 4);

      const barClass = issue.state === 'closed' ? 'closed' : 'opened';
      const isOverdue = issue.state !== 'closed' && riskFlags.includes('overdue');
      const effectiveBarClass = isOverdue ? 'overdue' : barClass;
      const deliveryClass =
        statusKind === 'closed'
          ? 'delivery-done'
          : statusKind === 'in_progress'
            ? 'delivery-review'
            : '';
      const riskClasses = riskFlags.map((flag) => `risk-${flag}`).join(' ');
      const primaryStatusLabel =
        issue.state === 'closed'
          ? '已關閉'
          : isOverdue
            ? '逾期'
            : mergeRequestCount > 0
              ? '進行中'
              : '開啟中';
      const primaryStatusClass =
        issue.state === 'closed'
          ? 'closed'
          : isOverdue
            ? 'overdue'
            : mergeRequestCount > 0
              ? 'in_progress'
              : 'open';
      const visibleRiskFlags = isOverdue
        ? riskFlags.filter((flag) => flag !== 'overdue')
        : riskFlags;
      const chipsHtml = [
        `<span class="gantt-status-pill ${primaryStatusClass}">${primaryStatusLabel}</span>`,
        ...visibleRiskFlags
          .slice(0, 3)
          .map((flag) => `<span class="risk-tag ${flag}">${getRiskFlagLabel(flag)}</span>`),
      ].join('');
      rowsHtml += `
        <div class="gantt-row" style="grid-template-columns:${labelWidth}px ${gridTotalWidth}px">
          <div class="gantt-row-label" data-iid="${issue.iid}" title="#${issue.iid} ${escapeHtml(issue.title)}">
            <strong>#${issue.iid}</strong> ${escapeHtml(issue.title.length > 34 ? `${issue.title.slice(0, 34)}...` : issue.title)}
            <small>${escapeHtml(assigneeText)} · ${escapeHtml(issue.milestone ?? 'No milestone')} · ${escapeHtml(issue.module ?? 'No module')}</small>
            <div class="gantt-status-pills">${chipsHtml}</div>
          </div>
          <div class="gantt-row-bars">
            <div class="gantt-bar ${effectiveBarClass} ${deliveryClass} ${riskClasses}"
                 style="left:${startPx + 2}px;width:${widthPx}px;"
                 data-iid="${issue.iid}"
                 data-title="${escapeHtml(issue.title)}"
                 data-state="${escapeHtml(primaryStatusLabel)}"
                 data-state-raw="${escapeHtml(issue.state)}"
                 data-mr-count="${mergeRequestCount}"
                 data-linked-count="${getLinkedItemCount(issue)}"
                 data-blocked="${issue.blocking_issues_count || 0}"
                 data-assignees="${escapeHtml(assigneeText)}"
                 data-milestone="${escapeHtml(issue.milestone ?? '-')}"
                 data-module="${escapeHtml(issue.module ?? '-')}"
                 data-created="${formatGanttDate(start)}"
                 data-due="${formatGanttDate(end)}"
                 data-risk="${escapeHtml(riskFlags.map((flag) => getRiskFlagLabel(flag)).join(', ') || 'None')}"
                 data-url="${escapeHtml(issue.web_url ?? '')}">
            </div>
          </div>
        </div>
      `;
    });
  });

  const todayIdx = dayIndex(today);
  const todayPx = todayIdx * dayWidth + dayWidth / 2;
  const groupLabel = groupBy === 'none' ? 'No grouping' : `Group by ${groupBy}`;
  const quickViewLabel =
    byId<HTMLSelectElement>('gantt-quick-view').selectedOptions[0]?.textContent || 'All issues';
  summary.textContent = `顯示 ${filtered.length} / ${issues.length} 筆，${windowRange.mode === 'week' ? '週檢視' : '月檢視'} ${windowRange.label}，${groupLabel}，Focus：${quickViewLabel}${riskIssueCount ? `，${riskIssueCount} 筆風險` : ''}`;
  requestIssueLinkDataForVisibleIssues(filtered);

  container.setAttribute('data-risk-mode', 'highlight');
  container.innerHTML = `
    <div class="gantt-scroll">
      <div class="gantt-header" style="grid-template-columns:${labelWidth}px ${gridTotalWidth}px">
        <div class="gantt-header-label">Issue</div>
        <div class="gantt-header-dates-wrap">
          <div class="gantt-header-months" style="display:flex">${monthHeaderHtml}</div>
          <div class="gantt-header-dates gantt-header-dates-rich" style="display:flex">${dayHeaderHtml}</div>
        </div>
      </div>
      <div class="gantt-body">
        <div class="gantt-body-inner">
          <div class="gantt-bg-strips" style="left:${labelWidth}px;width:${gridTotalWidth}px">${bgStrips}</div>
          <div class="gantt-deadlines" style="left:${labelWidth}px;width:${gridTotalWidth}px">${deadlineMarkers}</div>
          ${rowsHtml}
          ${todayIdx >= 0 && todayIdx < totalDays ? `<div class="gantt-today-line" style="left:${todayPx + labelWidth}px"></div>` : ''}
        </div>
      </div>
    </div>
  `;

  container
    .querySelectorAll<HTMLImageElement>('.gantt-group-avatar-shell .gantt-group-avatar')
    .forEach((avatar) => {
      avatar.addEventListener(
        'error',
        () => {
          avatar.remove();
        },
        { once: true },
      );
    });

  container.querySelectorAll<HTMLElement>('.gantt-bar').forEach((bar) => {
    bar.addEventListener('mouseenter', (event) => {
      const el = event.currentTarget as HTMLElement;
      tooltip.innerHTML = `
        <h5>#${el.dataset.iid} ${el.dataset.title}</h5>
        <p>開發狀態: ${el.dataset.state}</p>
        <p>Issue 狀態: ${el.dataset.stateRaw}</p>
        <p>相關 MR: ${el.dataset.mrCount}</p>
        <p>相關 Issues: ${el.dataset.linkedCount}</p>
        <p>阻擋: ${el.dataset.blocked}</p>
        <p>負責人: ${el.dataset.assignees}</p>
        <p>Milestone: ${el.dataset.milestone}</p>
        <p>模組: ${el.dataset.module}</p>
        <p>日期: ${el.dataset.created} - ${el.dataset.due}</p>
        <p>風險: ${el.dataset.risk}</p>
        <p>點擊以查看詳細資訊</p>
      `;
      tooltip.classList.add('visible');
    });
    bar.addEventListener('mousemove', (event) => {
      const mouseEvent = event as MouseEvent;
      tooltip.style.left = `${mouseEvent.clientX + 12}px`;
      tooltip.style.top = `${mouseEvent.clientY + 12}px`;
    });
    bar.addEventListener('mouseleave', () => tooltip.classList.remove('visible'));
    bar.addEventListener('click', (event) => {
      const el = event.currentTarget as HTMLElement;
      const issue = state.allIssues.find((item) => item.iid === Number(el.dataset.iid));
      if (issue) openIssueDetail(issue);
    });
    bar.addEventListener('dblclick', (event) => {
      const el = event.currentTarget as HTMLElement;
      if (el.dataset.url) {
        void window.trackerBridge.openPath(el.dataset.url);
      }
    });
  });

  container.querySelectorAll<HTMLElement>('.gantt-row-label[data-iid]').forEach((label) => {
    label.addEventListener('click', (event) => {
      const el = event.currentTarget as HTMLElement;
      const issue = state.allIssues.find((item) => item.iid === Number(el.dataset.iid));
      if (issue) openIssueDetail(issue);
    });
  });

  container
    .querySelectorAll<HTMLElement>('.gantt-group-header[data-group-key]')
    .forEach((header) => {
      header.addEventListener('click', (event) => {
        const el = event.currentTarget as HTMLElement;
        const key = el.dataset.groupKey;
        if (!key) return;
        if (state.ganttCollapsedGroups.has(key)) {
          state.ganttCollapsedGroups.delete(key);
        } else {
          state.ganttCollapsedGroups.add(key);
        }
        scheduleGanttRender(state.allIssues);
      });
    });
}

function renderCalendarViewSafe(issues: IssueItem[]): void {
  const container = byId<HTMLDivElement>('calendar-chart');
  const summary = byId<HTMLDivElement>('gantt-summary');
  const tooltip = ensureGanttTooltip();

  if (!issues.length) {
    summary.textContent = '沒有可顯示的 issue。';
    container.innerHTML = '<div class="empty-state">沒有可顯示的 issue。</div>';
    return;
  }

  const today = startOfDay(new Date())!;
  const todayStr = today.toISOString().slice(0, 10);
  const quickView = byId<HTMLSelectElement>('gantt-quick-view').value as GanttQuickView;
  const milestoneFilter = byId<HTMLSelectElement>('gantt-milestone-filter').value;
  const assigneeFilter = byId<HTMLSelectElement>('gantt-assignee-filter').value;
  const stateFilter = byId<HTMLSelectElement>('gantt-state-filter').value;
  const milestoneRanges = getMilestoneRangeMap();
  const windowRange = getSelectedTimelineWindow();

  let filtered = [...issues];
  if (milestoneFilter) filtered = filtered.filter((issue) => issue.milestone === milestoneFilter);
  if (assigneeFilter)
    filtered = filtered.filter((issue) => (issue.assignees || []).includes(assigneeFilter));
  if (stateFilter) filtered = filtered.filter((issue) => issue.state === stateFilter);
  filtered = applyGanttQuickView(filtered, today, quickView);
  filtered = filtered.filter((issue) => {
    const { start, end } = getIssueTimelineRange(issue, milestoneRanges, today);
    return start <= windowRange.end && end >= windowRange.start;
  });

  if (!filtered.length) {
    summary.textContent = `這個${windowRange.mode === 'week' ? '週' : '月'}區間沒有符合條件的 issue。`;
    container.innerHTML = '<div class="empty-state">這個區間沒有符合條件的 issue。</div>';
    return;
  }

  const cells: Date[] = [];
  let firstVisible = new Date(windowRange.start);
  if (windowRange.mode === 'month') {
    firstVisible = getStartOfWeek(new Date(windowRange.start));
    for (let index = 0; index < 42; index++) {
      const day = new Date(firstVisible);
      day.setDate(firstVisible.getDate() + index);
      day.setHours(0, 0, 0, 0);
      cells.push(day);
    }
  } else {
    for (let index = 0; index < 7; index++) {
      const day = new Date(windowRange.start);
      day.setDate(windowRange.start.getDate() + index);
      day.setHours(0, 0, 0, 0);
      cells.push(day);
    }
  }

  const getBarSegment = (
    issue: IssueItem,
    cellDate: Date,
  ): 'start' | 'middle' | 'end' | 'single' | null => {
    const { start, end } = getIssueTimelineRange(issue, milestoneRanges, today);
    if (cellDate < start || cellDate > end) return null;

    const cellKey = cellDate.toISOString().slice(0, 10);
    const startKey = start.toISOString().slice(0, 10);
    const endKey = end.toISOString().slice(0, 10);
    const isStart = cellKey === startKey || cellDate.getDay() === 1;
    const isEnd = cellKey === endKey || cellDate.getDay() === 0;

    if (isStart && isEnd) return 'single';
    if (isStart) return 'start';
    if (isEnd) return 'end';
    return 'middle';
  };

  container.classList.toggle('week-mode', windowRange.mode === 'week');

  const weekdayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const orderedWeekdays =
    windowRange.mode === 'week'
      ? cells.map((day) => weekdayNames[(day.getDay() + 6) % 7])
      : weekdayNames;

  let html = '<div class="cal-grid">';
  html += '<div class="cal-header-row">';
  if (windowRange.mode === 'week') {
    cells.forEach((day, index) => {
      html += `
        <div class="cal-header-cell">
          <span class="cal-header-weekday">${orderedWeekdays[index]}</span>
          <span class="cal-header-date">${day.getMonth() + 1}/${day.getDate()}</span>
        </div>
      `;
    });
  } else {
    orderedWeekdays.forEach((weekday) => {
      html += `
        <div class="cal-header-cell">
          <span class="cal-header-weekday">${weekday}</span>
        </div>
      `;
    });
  }
  html += '</div>';

  html += '<div class="cal-body">';
  cells.forEach((cell) => {
    const cellKey = cell.toISOString().slice(0, 10);
    const inCurrentMonth =
      cell.getMonth() === windowRange.start.getMonth() || windowRange.mode === 'week';
    const cellIssues = filtered
      .filter((issue) => {
        const { start, end } = getIssueTimelineRange(issue, milestoneRanges, today);
        return cell >= start && cell <= end;
      })
      .sort(compareIssuesForGantt);

    const visibleIssues = cellIssues.slice(0, windowRange.mode === 'week' ? 6 : 4);
    const remainingCount = cellIssues.length - visibleIssues.length;
    const isToday = cellKey === todayStr;
    const isWeekend = cell.getDay() === 0 || cell.getDay() === 6;

    html += `<div class="cal-cell ${inCurrentMonth ? '' : 'other-month'} ${isToday ? 'today' : ''} ${isWeekend ? 'weekend' : ''}">`;
    html += `
      <div class="cal-cell-head">
        <span class="cal-date">${cell.getDate()}</span>
        ${cellIssues.length ? `<span class="cal-count">${cellIssues.length}</span>` : ''}
      </div>
    `;
    html += '<div class="cal-issues">';

    visibleIssues.forEach((issue) => {
      const segment = getBarSegment(issue, cell);
      if (!segment) return;

      let barClass = issue.state === 'closed' ? 'closed' : 'opened';
      const issueDue = startOfDay(issue.due_date);
      if (issue.state !== 'closed' && issueDue && issueDue < today) {
        barClass = 'overdue';
      }

      const label =
        windowRange.mode === 'week' || segment === 'start' || segment === 'single'
          ? `#${issue.iid} ${issue.title.length > 18 ? `${issue.title.slice(0, 18)}...` : issue.title}`
          : '';

      html += `
        <div class="cal-bar ${barClass} seg-${segment}"
             data-iid="${issue.iid}"
             data-title="${escapeHtml(issue.title)}"
             data-state="${issue.state}"
             data-assignees="${escapeHtml((issue.assignees || []).join(', ') || 'Unassigned')}"
             data-milestone="${escapeHtml(issue.milestone ?? '-')}"
             data-module="${escapeHtml(issue.module ?? '-')}"
             data-created="${formatGanttDate(getIssueTimelineRange(issue, milestoneRanges, today).start)}"
             data-due="${formatGanttDate(getIssueTimelineRange(issue, milestoneRanges, today).end)}"
             data-url="${escapeHtml(issue.web_url ?? '')}">
          ${label ? `<span class="cal-bar-label">${escapeHtml(label)}</span>` : ''}
        </div>
      `;
    });

    if (remainingCount > 0) {
      html += `<div class="cal-more">+${remainingCount} more</div>`;
    }

    html += '</div></div>';
  });
  html += '</div></div>';

  summary.textContent = `顯示 ${filtered.length} / ${issues.length} 筆，${windowRange.mode === 'week' ? '週曆' : '月曆'} ${windowRange.label}`;
  container.innerHTML = html;

  container.querySelectorAll<HTMLElement>('.cal-bar').forEach((bar) => {
    bar.addEventListener('mouseenter', (event) => {
      const el = event.currentTarget as HTMLElement;
      tooltip.innerHTML = `
        <h5>#${el.dataset.iid} ${el.dataset.title}</h5>
        <p>State: ${el.dataset.state}</p>
        <p>Assignee: ${el.dataset.assignees}</p>
        <p>Milestone: ${el.dataset.milestone}</p>
        <p>Range: ${el.dataset.created} - ${el.dataset.due}</p>
      `;
      tooltip.classList.add('visible');
    });
    bar.addEventListener('mousemove', (event) => {
      const mouseEvent = event as MouseEvent;
      tooltip.style.left = `${mouseEvent.clientX + 12}px`;
      tooltip.style.top = `${mouseEvent.clientY + 12}px`;
    });
    bar.addEventListener('mouseleave', () => tooltip.classList.remove('visible'));
    bar.addEventListener('click', (event) => {
      const el = event.currentTarget as HTMLElement;
      const issue = state.allIssues.find((item) => item.iid === Number(el.dataset.iid));
      if (issue) openIssueDetail(issue);
    });
    bar.addEventListener('dblclick', (event) => {
      const el = event.currentTarget as HTMLElement;
      if (el.dataset.url) {
        void window.trackerBridge.openPath(el.dataset.url);
      }
    });
  });
}

function getFilteredSortedIssues(): IssueItem[] {
  let filtered = [...state.allIssues];

  // Search
  const search = byId<HTMLInputElement>('table-search').value.trim().toLowerCase();
  if (search) {
    filtered = filtered.filter(
      (i) =>
        String(i.iid).includes(search) ||
        (i.title || '').toLowerCase().includes(search) ||
        (i.module || '').toLowerCase().includes(search) ||
        (i.assignees || []).some((a) => a.toLowerCase().includes(search)) ||
        (i.milestone || '').toLowerCase().includes(search) ||
        (i.labels || []).some((l) => l.toLowerCase().includes(search)),
    );
  }

  // State filter
  const stateFilter = byId<HTMLSelectElement>('table-state-filter').value;
  if (stateFilter) filtered = filtered.filter((i) => i.state === stateFilter);

  // Milestone filter
  const msFilter = byId<HTMLSelectElement>('table-milestone-filter').value;
  if (msFilter) filtered = filtered.filter((i) => i.milestone === msFilter);

  // Label filter
  const labelFilter = byId<HTMLSelectElement>('table-label-filter').value;
  if (labelFilter) filtered = filtered.filter((i) => (i.labels || []).includes(labelFilter));

  // Date range filter (by created_at)
  const dateStart = byId<HTMLInputElement>('table-date-start').value;
  const dateEnd = byId<HTMLInputElement>('table-date-end').value;
  if (dateStart) {
    const ds = new Date(dateStart);
    ds.setHours(0, 0, 0, 0);
    filtered = filtered.filter((i) => {
      if (!i.created_at) return false;
      return new Date(i.created_at) >= ds;
    });
  }
  if (dateEnd) {
    const de = new Date(dateEnd);
    de.setHours(23, 59, 59, 999);
    filtered = filtered.filter((i) => {
      if (!i.created_at) return false;
      return new Date(i.created_at) <= de;
    });
  }

  // Sort
  const { key, asc } = state.tableSort;
  filtered.sort((a: any, b: any) => {
    let av = a[key];
    let bv = b[key];
    if (key === 'assignees') {
      av = (av || []).join(', ');
      bv = (bv || []).join(', ');
    }
    if (av == null) av = '';
    if (bv == null) bv = '';
    if (typeof av === 'number' && typeof bv === 'number') return asc ? av - bv : bv - av;
    const cmp = String(av).localeCompare(String(bv), 'zh-Hant');
    return asc ? cmp : -cmp;
  });

  return filtered;
}

function renderSpreadsheet(): void {
  const filtered = getFilteredSortedIssues();
  const tbody = byId<HTMLTableSectionElement>('table-all-issues');
  const info = byId<HTMLElement>('table-info');
  info.textContent = `顯示 ${filtered.length} / ${state.allIssues.length} 筆`;

  if (!filtered.length) {
    tbody.innerHTML = '<tr><td colspan="11" class="empty-state">沒有符合條件的 Issue。</td></tr>';
    return;
  }

  tbody.innerHTML = filtered
    .map(
      (item, idx) => `
    <tr data-iid="${item.iid}" data-url="${escapeHtml(item.web_url ?? '')}">
      <td class="row-num">${idx + 1}</td>
      <td><a class="issue-link" href="${escapeHtml(item.web_url ?? '#')}" target="_blank" style="color:var(--accent);text-decoration:none" onclick="event.stopPropagation()">#${item.iid}</a></td>
      <td><span class="state-badge ${item.state}">${item.state === 'opened' ? '開啟' : '關閉'}</span></td>
      <td>${escapeHtml(item.module ?? '-')}</td>
      <td title="${escapeHtml(item.title)}">${escapeHtml(item.title)}</td>
      <td>${escapeHtml((item.assignees || []).join(', ') || '-')}</td>
      <td>${escapeHtml(item.milestone ?? '-')}</td>
      <td><div class="cell-labels">${(item.labels || [])
        .slice(0, 3)
        .map((l) => `<span class="tag">${escapeHtml(l)}</span>`)
        .join('')}</div></td>
      <td>${fmtShortDate(item.created_at)}</td>
      <td>${fmtShortDate(item.updated_at)}</td>
      <td>${fmtShortDate(item.due_date)}</td>
    </tr>
  `,
    )
    .join('');

  // Update sort header styles
  document.querySelectorAll('.spreadsheet-wrap th[data-sort]').forEach((th) => {
    const el = th as HTMLElement;
    const key = el.dataset.sort!;
    el.classList.toggle('sorted', key === state.tableSort.key);
    const arrow = el.querySelector('.sort-arrow');
    if (arrow && key === state.tableSort.key) {
      arrow.textContent = state.tableSort.asc ? '\u25B2' : '\u25BC';
    }
  });
}

function populateTableFilters(issues: IssueItem[]): void {
  const milestones = getSortedMilestoneEntriesFromIssues(issues);
  const mSel = byId<HTMLSelectElement>('table-milestone-filter');
  populateMilestoneFilterOptions(mSel, milestones);

  const labels = [...new Set(issues.flatMap((i) => i.labels || []))].filter(Boolean).sort();
  const lSel = byId<HTMLSelectElement>('table-label-filter');
  const lVal = lSel.value;
  lSel.innerHTML =
    '<option value="">全部</option>' +
    labels.map((l) => `<option value="${escapeHtml(l)}">${escapeHtml(l)}</option>`).join('');
  lSel.value = lVal;
}

/* ══════════════════════════════════════════════
   VIEW NAVIGATION + ISSUE WORKSPACE
   ══════════════════════════════════════════════ */
function setActiveView(view: string): void {
  state.currentView = view;
  document.querySelectorAll<HTMLElement>('.workspace-view').forEach((panel) => {
    panel.classList.toggle('active', panel.id === `view-${view}`);
  });
  document.querySelectorAll<HTMLElement>('[data-view-target]').forEach((button) => {
    button.classList.toggle('active', button.getAttribute('data-view-target') === view);
  });

  if (view === 'dashboard' && state.allIssues.length > 0) {
    renderSpreadsheet();
  }
  if (view === 'arrange') {
    renderArrangeJobs();
    renderArrangeSelection();
    void loadArrangeHistory();
  }
  if (view === 'briefing') {
    void loadProjectPulseView().catch(handleError);
  }
  if (view === 'assistant') {
    // The full page always hosts the chat surface; reclaim it from the dock.
    mountChatSurfaceTo('assistant-mount');
    getById<HTMLElement>('chat-dock')?.classList.remove('open');
    state.chatDockOpen = false;
    renderRagStatusBadge();
    renderRagQuestionState();
    const input = getById<HTMLInputElement>('chat-input');
    if (input && !input.disabled) {
      window.setTimeout(() => input.focus(), 0);
    }
  }

  // The chat-launcher FAB is redundant while the assistant view or dock is open.
  updateChatLauncherVisibility();
}

function initViewNavigation(): void {
  document.querySelectorAll<HTMLElement>('[data-view-target]').forEach((button) => {
    button.addEventListener('click', () => {
      const target = button.getAttribute('data-view-target');
      if (target) setActiveView(target);
    });
  });
}

function isArrangeFilterUrl(value: string): boolean {
  return /\/-\/issues\?/.test(value.trim());
}

function getArrangeInputLines(): string[] {
  return (byId<HTMLTextAreaElement>('arrange-url-list').value || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function toArrangeJob(issue: ArrangePreviewIssue): ArrangeJob {
  return {
    ...issue,
    id: issue.web_url || `issue-${issue.iid}`,
    raw_text: '',
    result: '',
    status: 'previewed',
    scrapeStatus: 'waiting',
    llmStatus: 'waiting',
    exportStatus: 'waiting',
    error: null,
    model: null,
  };
}

function toIssueItemFromArrangeJob(job: ArrangeJob): IssueItem {
  return {
    iid: job.iid,
    provider: state.currentConfig?.active_provider || 'gitlab',
    source_ref:
      state.currentConfig?.connections[state.currentConfig.active_provider]?.project_ref || null,
    schema_version: 2,
    relation_counts_known: false,
    title: job.title,
    state: job.state,
    module: null,
    labels: [...job.labels],
    assignees: [...job.assignees],
    assignee_details: job.assignees.map((name) => ({
      name,
      username: null,
      avatar_url: null,
    })),
    milestone: job.milestone?.title ?? null,
    milestone_start_date: null,
    milestone_due_date: job.milestone?.due_date ?? null,
    created_at: null,
    updated_at: null,
    closed_at: null,
    due_date: job.milestone?.due_date ?? null,
    web_url: job.web_url ?? null,
    issue_type: null,
    merge_requests_count: 0,
    blocking_issues_count: 0,
    task_total: 0,
    task_completed: 0,
    user_notes_count: 0,
    has_new_discussions: false,
    note: null,
    reason: null,
  };
}

function getArrangeStatusLabel(status: ArrangeJobStatus): string {
  switch (status) {
    case 'running':
      return '處理中';
    case 'done':
      return '完成';
    case 'error':
      return '失敗';
    default:
      return '待整理';
  }
}

function getArrangePhaseLabel(status: ArrangePhaseStatus): string {
  switch (status) {
    case 'running':
      return '進行中';
    case 'success':
      return '完成';
    case 'error':
      return '失敗';
    case 'skipped':
      return '略過';
    default:
      return '等待中';
  }
}

function renderArrangeJobs(): void {
  const container = byId<HTMLDivElement>('arrange-job-list');
  const count = byId<HTMLElement>('arrange-job-count');
  count.textContent = `${state.arrangeJobs.length} 筆`;

  if (!state.arrangeJobs.length) {
    container.innerHTML =
      '<div class="empty-state">先貼上 URL 並預覽，這裡會出現待整理的 Issue。</div>';
    return;
  }

  container.innerHTML = state.arrangeJobs
    .map((job) => {
      const assignees = job.assignees.length ? job.assignees.join(', ') : '未指派';
      const milestone = job.milestone?.title || '無 Milestone';
      const phaseBadge = (label: string, status: ArrangePhaseStatus) =>
        `<span class="arrange-phase ${status}"><span class="dot"></span>${label}: ${getArrangePhaseLabel(status)}</span>`;
      return `
        <article class="arrange-job-card ${state.selectedArrangeJobId === job.id ? 'active' : ''}" data-arrange-job-id="${escapeHtml(job.id)}" title="點擊切換目前處理的 Issue">
          <div class="arrange-job-top">
            <div>
              <div class="arrange-job-title">#${job.iid} ${escapeHtml(job.title)}</div>
              <div class="arrange-job-meta">
                <span>${escapeHtml(job.state || '-')}</span>
                <span>${escapeHtml(assignees)}</span>
                <span>${escapeHtml(milestone)}</span>
              </div>
            </div>
            <div class="arrange-job-actions">
              <span class="arrange-job-status ${job.status}">${getArrangeStatusLabel(job.status)}</span>
              <button
                type="button"
                class="arrange-job-detail-btn"
                data-arrange-job-detail="${escapeHtml(job.id)}"
                title="查看 Issue 詳細資訊"
              >
                查看詳情
              </button>
            </div>
          </div>
          <div class="arrange-job-phases">
            ${phaseBadge('Scrape', job.scrapeStatus)}
            ${phaseBadge('LLM', job.llmStatus)}
            ${phaseBadge('Export', job.exportStatus)}
          </div>
          ${job.error ? `<div class="qi-error">${escapeHtml(job.error)}</div>` : ''}
        </article>
      `;
    })
    .join('');
}

function getSelectedArrangeJob(): ArrangeJob | null {
  if (!state.selectedArrangeJobId) return null;
  return state.arrangeJobs.find((job) => job.id === state.selectedArrangeJobId) ?? null;
}

async function openArrangeJobDetail(jobId: string): Promise<void> {
  const job = state.arrangeJobs.find((item) => item.id === jobId);
  if (!job) return;

  const matchedIssue = job.web_url
    ? state.allIssues.find((item) => item.web_url === job.web_url)
    : state.allIssues.find((item) => item.iid === job.iid);

  if (matchedIssue) {
    openIssueDetail(matchedIssue);
    return;
  }

  if (!job.web_url) {
    openIssueDetail(toIssueItemFromArrangeJob(job));
    return;
  }

  const bundle = await api<IssueDetailBundle>('/api/issues/detail-by-url', 'POST', {
    url: job.web_url,
  });
  openIssueDetailWithBundle(bundle);
}

function renderArrangeSelection(): void {
  const title = byId<HTMLElement>('arrange-selected-title');
  const meta = byId<HTMLElement>('arrange-selected-meta');
  const raw = byId<HTMLTextAreaElement>('arrange-raw-text');
  const result = byId<HTMLElement>('arrange-result-text');
  const modelLabel = getById<HTMLElement>('arrange-model-label');
  const job = getSelectedArrangeJob();

  if (!job) {
    title.textContent = '整理結果';
    meta.textContent = '尚未選取 Issue。';
    raw.value = '';
    result.textContent = '尚未產生整理結果。';
    if (modelLabel) modelLabel.textContent = `Model: ${state.uiPreferences.geminiModel}`;
    return;
  }

  title.textContent = `#${job.iid} ${job.title}`;
  meta.textContent = `${job.state || '-'} · ${job.assignees.join(', ') || '未指派'} · ${job.milestone?.title || '無 Milestone'}`;
  raw.value = job.raw_text || '';
  result.textContent =
    job.result ||
    (job.status === 'error' ? `處理失敗：${job.error || '未知錯誤'}` : '尚未產生整理結果。');
  if (modelLabel) modelLabel.textContent = `Model: ${job.model || state.uiPreferences.geminiModel}`;
}

function getSelectedArrangeHistoryFile(): ArrangeHistoryFile | null {
  if (!state.selectedArrangeHistoryFilename) return null;
  return (
    state.arrangeHistoryFiles.find(
      (file) => file.filename === state.selectedArrangeHistoryFilename,
    ) ?? null
  );
}

function formatArrangeHistoryMarkdown(text: string): string {
  const normalized = (text || '').replace(/\r\n/g, '\n');
  const codeBlocks: string[] = [];
  let escaped = escapeHtml(normalized).replace(/```([\s\S]*?)```/g, (_match, code) => {
    const placeholder = `@@ARRANGE_HISTORY_CODE_${codeBlocks.length}@@`;
    codeBlocks.push(`<pre class="arrange-history-md-code"><code>${code.trim()}</code></pre>`);
    return placeholder;
  });

  escaped = escaped
    .replace(/^### (.+)$/gm, '<h4>$1</h4>')
    .replace(/^## (.+)$/gm, '<h3 class="arrange-history-md-heading">$1</h3>')
    .replace(/^# (.+)$/gm, '<h2 class="arrange-history-md-title">$1</h2>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/^(\d+)\. (.+)$/gm, '<li><strong>$1.</strong> $2</li>')
    .replace(/(<li>.*<\/li>\n?)+/g, (match) => `<ul>${match}</ul>`)
    .replace(/\n{2,}/g, '<br/><br/>')
    .replace(/\n/g, '<br/>');

  codeBlocks.forEach((block, index) => {
    escaped = escaped.replace(`@@ARRANGE_HISTORY_CODE_${index}@@`, block);
  });

  return escaped;
}

function toSafeHref(url: string): string {
  const trimmed = (url || '').trim();
  const normalized = trimmed.toLowerCase();
  if (
    normalized.startsWith('http://') ||
    normalized.startsWith('https://') ||
    normalized.startsWith('mailto:') ||
    normalized.startsWith('/') ||
    normalized.startsWith('./') ||
    normalized.startsWith('../') ||
    normalized.startsWith('#')
  ) {
    return trimmed;
  }
  return '#';
}

function formatDiscussionInlineMarkdown(escaped: string): string {
  return escaped
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_match, alt, url) => {
      const safeHref = escapeHtml(toSafeHref(url));
      const safeAlt = alt.trim() ? escapeHtml(alt.trim()) : '附件圖片';
      return `<a class="discussion-md-link discussion-md-image-link" href="${safeHref}" target="_blank" rel="noreferrer">${safeAlt}</a>`;
    })
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_match, label, url) => {
      const safeHref = escapeHtml(toSafeHref(url));
      return `<a class="discussion-md-link" href="${safeHref}" target="_blank" rel="noreferrer">${label}</a>`;
    })
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code>$1</code>');
}

function isDiscussionTableDelimiter(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed.includes('|')) return false;
  const cells = trimmed
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim());
  return cells.length > 0 && cells.every((cell) => /^:?-{3,}:?$/.test(cell));
}

function parseDiscussionTableRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim());
}

function buildDiscussionTableHtml(lines: string[]): string {
  const [headerLine, _delimiterLine, ...bodyLines] = lines;
  const headers = parseDiscussionTableRow(headerLine);
  const bodyRows = bodyLines.map(parseDiscussionTableRow);

  return `
    <div class="discussion-md-table-wrap">
      <table class="discussion-md-table">
        <thead>
          <tr>${headers.map((cell) => `<th>${formatDiscussionInlineMarkdown(cell)}</th>`).join('')}</tr>
        </thead>
        <tbody>
          ${bodyRows
            .map(
              (row) =>
                `<tr>${row.map((cell) => `<td>${formatDiscussionInlineMarkdown(cell)}</td>`).join('')}</tr>`,
            )
            .join('')}
        </tbody>
      </table>
    </div>`;
}

function formatDiscussionMarkdownSection(text: string): string {
  let working = (text || '').replace(/\r\n/g, '\n');
  const codeBlocks: string[] = [];
  const detailsBlocks: string[] = [];
  const tableBlocks: string[] = [];

  working = working.replace(/```([\s\S]*?)```/g, (_match, code) => {
    const placeholder = `@@DISCUSSION_CODE_${codeBlocks.length}@@`;
    codeBlocks.push(
      `<pre class="discussion-md-code"><code>${escapeHtml(code.trim())}</code></pre>`,
    );
    return placeholder;
  });

  working = working.replace(/<details>([\s\S]*?)<\/details>/gi, (_match, inner) => {
    const placeholder = `@@DISCUSSION_DETAILS_${detailsBlocks.length}@@`;
    const summaryMatch = inner.match(/<summary>([\s\S]*?)<\/summary>/i);
    const summaryRaw = summaryMatch?.[1]?.trim() || 'Details';
    const bodyRaw = inner.replace(/<summary>[\s\S]*?<\/summary>/i, '').trim();
    const summaryHtml = formatDiscussionInlineMarkdown(escapeHtml(summaryRaw));
    const bodyHtml = bodyRaw ? formatDiscussionMarkdownSection(bodyRaw) : '';

    detailsBlocks.push(`
      <details class="discussion-md-details">
        <summary>${summaryHtml}</summary>
        <div class="discussion-md-details-body">${bodyHtml}</div>
      </details>`);
    return placeholder;
  });

  let escaped = escapeHtml(working);
  escaped = formatDiscussionInlineMarkdown(escaped);

  const lines = escaped.split('\n');
  const renderedLines: string[] = [];
  for (let index = 0; index < lines.length; index += 1) {
    const current = lines[index];
    const next = lines[index + 1];
    if (current.includes('|') && next && isDiscussionTableDelimiter(next)) {
      const tableLines = [current, next];
      index += 2;
      while (index < lines.length && lines[index].includes('|') && lines[index].trim()) {
        tableLines.push(lines[index]);
        index += 1;
      }
      index -= 1;
      const placeholder = `@@DISCUSSION_TABLE_${tableBlocks.length}@@`;
      tableBlocks.push(buildDiscussionTableHtml(tableLines));
      renderedLines.push(placeholder);
      continue;
    }
    renderedLines.push(current);
  }
  escaped = renderedLines.join('\n');

  escaped = escaped
    .replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>')
    .replace(/^### (.+)$/gm, '<h4>$1</h4>')
    .replace(/^## (.+)$/gm, '<h3>$1</h3>')
    .replace(/^# (.+)$/gm, '<h2>$1</h2>')
    .replace(
      /^- \[ \] (.+)$/gm,
      '<li class="discussion-md-task"><input type="checkbox" disabled /> <span>$1</span></li>',
    )
    .replace(
      /^- \[x\] (.+)$/gim,
      '<li class="discussion-md-task"><input type="checkbox" checked disabled /> <span>$1</span></li>',
    )
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/^(\d+)\. (.+)$/gm, '<li><strong>$1.</strong> $2</li>')
    .replace(/(<li.*<\/li>\n?)+/g, (match) => `<ul>${match}</ul>`)
    .replace(/\n{2,}/g, '<br/><br/>')
    .replace(/\n/g, '<br/>');

  codeBlocks.forEach((block, index) => {
    escaped = escaped.replace(`@@DISCUSSION_CODE_${index}@@`, block);
  });
  detailsBlocks.forEach((block, index) => {
    escaped = escaped.replace(`@@DISCUSSION_DETAILS_${index}@@`, block);
  });
  tableBlocks.forEach((block, index) => {
    escaped = escaped.replace(`@@DISCUSSION_TABLE_${index}@@`, block);
  });

  return escaped;
}

function formatDiscussionMarkdown(text: string): string {
  return formatDiscussionMarkdownSection(text);
}

function renderArrangeHistoryPreview(selectedFile: ArrangeHistoryFile | null): void {
  const previewTitle = byId<HTMLElement>('arrange-history-preview-title');
  const rawPreview = byId<HTMLElement>('arrange-history-preview');
  const markdownPreview = byId<HTMLElement>('arrange-history-preview-markdown');
  const openFileButton = byId<HTMLButtonElement>('btn-arrange-history-open-file');
  const copyTextButton = byId<HTMLButtonElement>('btn-arrange-history-copy-text');
  const markdownButton = byId<HTMLButtonElement>('btn-arrange-history-preview-md');
  const rawButton = byId<HTMLButtonElement>('btn-arrange-history-preview-raw');
  const content = state.selectedArrangeHistoryContent || '此存檔沒有可顯示的內容。';
  const canRenderMarkdown = !!selectedFile && selectedFile.kind !== 'excel';
  const canCopyText = !!selectedFile && selectedFile.kind !== 'excel' && !!content.trim();
  const effectiveMode: ArrangeHistoryPreviewMode = canRenderMarkdown
    ? state.arrangeHistoryPreviewMode
    : 'raw';

  previewTitle.textContent = selectedFile?.filename || '尚未選取歷史檔案';
  rawPreview.textContent = content;
  rawPreview.hidden = effectiveMode !== 'raw';
  markdownPreview.hidden = effectiveMode !== 'markdown';

  if (effectiveMode === 'markdown') {
    markdownPreview.innerHTML = formatArrangeHistoryMarkdown(content);
  } else if (!selectedFile) {
    markdownPreview.innerHTML = '<div class="empty-state">請從左側選一筆歷史存檔。</div>';
  } else if (!canRenderMarkdown) {
    markdownPreview.innerHTML = '<div class="empty-state">目前檔案不支援 MD 預覽。</div>';
  } else {
    markdownPreview.innerHTML = formatArrangeHistoryMarkdown(content);
  }

  openFileButton.disabled = !selectedFile?.path;
  copyTextButton.disabled = !canCopyText;
  markdownButton.disabled = !selectedFile || !canRenderMarkdown;
  rawButton.disabled = !selectedFile;
  markdownButton.classList.toggle('active', effectiveMode === 'markdown');
  rawButton.classList.toggle('active', effectiveMode === 'raw');
  markdownButton.setAttribute('aria-pressed', String(effectiveMode === 'markdown'));
  rawButton.setAttribute('aria-pressed', String(effectiveMode === 'raw'));
}

function setArrangeHistoryPreviewMode(mode: ArrangeHistoryPreviewMode): void {
  state.arrangeHistoryPreviewMode = mode;
  renderArrangeHistoryPreview(getSelectedArrangeHistoryFile());
}

async function copySelectedArrangeHistoryContent(): Promise<void> {
  const file = getSelectedArrangeHistoryFile();
  const content = state.selectedArrangeHistoryContent?.trim() || '';
  if (!file || file.kind === 'excel' || !content) {
    setArrangeStatus('目前沒有可複製的文字內容。', 'warn');
    return;
  }

  try {
    await navigator.clipboard.writeText(state.selectedArrangeHistoryContent);
    setArrangeStatus(`已複製 ${file.filename} 的文字內容。`, 'success');
  } catch (error) {
    console.error('Failed to copy arrange history content', error);
    setArrangeStatus('複製失敗，請稍後再試。', 'error');
  }
}

function renderArrangeHistoryList(): void {
  const count = byId<HTMLElement>('arrange-history-count');
  const list = byId<HTMLDivElement>('arrange-history-list');
  const query =
    getById<HTMLInputElement>('arrange-history-search')?.value.trim().toLowerCase() ?? '';
  const kindFilter =
    (getById<HTMLSelectElement>('arrange-history-kind')?.value as ArrangeHistoryKind | 'all') ??
    'all';

  const files = state.arrangeHistoryFiles.filter((file) => {
    const matchesKind = kindFilter === 'all' || file.kind === kindFilter;
    const matchesQuery = !query || file.filename.toLowerCase().includes(query);
    return matchesKind && matchesQuery;
  });

  count.textContent = `${state.arrangeHistoryFiles.length} 筆`;
  if (!files.length) {
    list.innerHTML = '<div class="empty-state">沒有符合條件的歷史存檔。</div>';
  } else {
    list.innerHTML = files
      .map((file) => {
        const kindLabel =
          file.kind === 'raw'
            ? 'Raw'
            : file.kind === 'scrape'
              ? 'Scrape'
              : file.kind === 'excel'
                ? 'Excel'
                : 'LLM 結果';
        const isActive = file.filename === state.selectedArrangeHistoryFilename;
        return `
          <button
            type="button"
            class="arrange-history-item ${isActive ? 'active' : ''}"
            data-arrange-history-file="${escapeHtml(file.filename)}"
          >
            <div class="arrange-history-name">${escapeHtml(file.filename)}</div>
            <div class="arrange-history-meta">
              <span class="arrange-history-kind-pill ${file.kind}">${kindLabel}</span>
              <span>${escapeHtml(file.mtime)}</span>
              <span>${escapeHtml(fmtFileSize(file.size))}</span>
            </div>
          </button>
        `;
      })
      .join('');
  }

  const selectedFile = getSelectedArrangeHistoryFile();
  renderArrangeHistoryPreview(selectedFile);
}

async function loadArrangeHistory(preserveSelection = true): Promise<void> {
  const response = await api<{
    files: ArrangeHistoryFile[];
    root_path: string;
  }>('/api/arrange/history');
  const previousSelection = preserveSelection ? state.selectedArrangeHistoryFilename : null;
  state.arrangeHistoryFiles = response.files || [];
  state.arrangeHistoryRootPath = response.root_path || '';

  const hasSelection =
    !!previousSelection &&
    state.arrangeHistoryFiles.some((file) => file.filename === previousSelection);
  if (!hasSelection) {
    state.selectedArrangeHistoryFilename = null;
    state.selectedArrangeHistoryContent = '請從左側選一筆歷史存檔。';
  }

  renderArrangeHistoryList();
}

async function openArrangeHistoryFile(filename: string): Promise<void> {
  const response = await api<ArrangeHistoryFileResponse>(
    `/api/arrange/history/${encodeURIComponent(filename)}`,
  );
  state.selectedArrangeHistoryFilename = response.filename;
  if (response.kind === 'excel') {
    state.selectedArrangeHistoryContent = `這是 Excel 存檔：${response.filename}\n\n請使用右上角的「開啟檔案」查看完整內容。`;
  } else {
    state.selectedArrangeHistoryContent = response.content || '此存檔沒有可顯示的內容。';
  }
  renderArrangeHistoryList();
}

async function openSelectedArrangeHistoryFile(): Promise<void> {
  const file = getSelectedArrangeHistoryFile();
  if (!file?.path) {
    setArrangeStatus('找不到可開啟的歷史檔案。', 'warn');
    return;
  }
  await window.trackerBridge.openPath(file.path);
}

async function openArrangeHistoryFolder(): Promise<void> {
  if (!state.arrangeHistoryRootPath) {
    await loadArrangeHistory(false);
  }
  if (!state.arrangeHistoryRootPath) {
    setArrangeStatus('尚未建立歷史存檔資料夾。', 'warn');
    return;
  }
  await window.trackerBridge.openPath(state.arrangeHistoryRootPath);
}

function selectArrangeJob(jobId: string): void {
  state.selectedArrangeJobId = jobId;
  renderArrangeJobs();
  renderArrangeSelection();
}

function setArrangeButtonsEnabled(enabled: boolean): void {
  [
    'btn-arrange-preview',
    'btn-arrange-run-selected',
    'btn-arrange-run-batch',
    'btn-arrange-run-scrape',
    'btn-arrange-run-llm',
    'btn-arrange-export-excel',
  ].forEach((id) => {
    const button = getById<HTMLButtonElement>(id);
    if (button) button.disabled = !enabled;
  });
  const stopButton = getById<HTMLButtonElement>('btn-arrange-stop-batch');
  if (stopButton) stopButton.disabled = !state.arrangeBatchRunning;
}

async function previewArrangeIssues(): Promise<void> {
  const lines = getArrangeInputLines();
  if (!lines.length) {
    setArrangeStatus('請先貼上至少一筆 Issue URL 或 filter URL。', 'warn');
    return;
  }

  setArrangeStatus('正在讀取 Issue 預覽...', 'idle');
  setArrangeButtonsEnabled(false);
  try {
    const response =
      lines.length === 1 && isArrangeFilterUrl(lines[0])
        ? await api<{
            issues: ArrangePreviewIssue[];
            count: number;
            errors?: Array<{ url: string; error: string }>;
          }>('/api/arrange/resolve-filter', 'POST', { filter_url: lines[0] })
        : await api<{
            issues: ArrangePreviewIssue[];
            count: number;
            errors?: Array<{ url: string; error: string }>;
          }>('/api/arrange/preview', 'POST', { urls: lines });

    state.arrangeJobs = response.issues.map(toArrangeJob);
    state.selectedArrangeJobId = state.arrangeJobs[0]?.id ?? null;
    renderArrangeJobs();
    renderArrangeSelection();

    const errorCount = response.errors?.length ?? 0;
    if (errorCount > 0) {
      setArrangeStatus(
        `已載入 ${response.count} 筆 Issue，另有 ${errorCount} 筆無法解析。`,
        'warn',
      );
    } else {
      setArrangeStatus(`已載入 ${response.count} 筆 Issue。`, 'success');
    }
  } finally {
    setArrangeButtonsEnabled(true);
  }
}

async function runArrangeJob(job: ArrangeJob): Promise<void> {
  try {
    await runArrangeScrapeJob(job);
    if (job.status === 'error') return;
    await runArrangeLlmJob(job);
  } catch (error) {
    if (!isAbortError(error)) {
      const message = error instanceof Error ? error.message : String(error);
      job.status = 'error';
      job.error = message;
    }
  }
}

async function runSelectedArrangeJob(): Promise<void> {
  const job = getSelectedArrangeJob();
  if (!job) {
    setArrangeStatus('請先從清單選擇要整理的 Issue。', 'warn');
    return;
  }

  updateArrangePromptPreference();
  setArrangeStatus(`正在整理 #${job.iid}...`, 'idle');
  setArrangeButtonsEnabled(false);
  try {
    await runArrangeJob(job);
    const success = job.status === 'done';
    setArrangeStatus(
      success ? `#${job.iid} 整理完成。` : `#${job.iid} 整理失敗。`,
      success ? 'success' : 'error',
    );
    showToast(
      success ? '整理完成' : '整理失敗',
      success ? `#${job.iid} 已完成整理。` : `#${job.iid} 處理失敗。`,
      success ? 'success' : 'error',
    );
  } finally {
    setArrangeButtonsEnabled(true);
  }
}

function isAbortError(error: unknown): boolean {
  if (error instanceof DOMException && error.name === 'AbortError') return true;
  const message = error instanceof Error ? error.message : String(error);
  return /abort/i.test(message);
}

async function runArrangeScrapeJob(job: ArrangeJob, signal?: AbortSignal): Promise<void> {
  job.status = 'running';
  job.scrapeStatus = 'running';
  job.llmStatus = 'waiting';
  job.exportStatus = 'waiting';
  job.result = '';
  job.model = null;
  job.error = null;
  renderArrangeJobs();
  renderArrangeSelection();
  try {
    const result = await api<{
      issue: ArrangePreviewIssue;
      raw_text: string;
      saved_raw_path: string;
    }>(
      '/api/arrange/scrape',
      'POST',
      {
        url: job.web_url,
        system_prompt: byId<HTMLTextAreaElement>('arrange-prompt').value.trim(),
        preferred_model: state.uiPreferences.geminiModel,
        model_candidates: ARRANGE_GEMINI_MODEL_LIST,
      },
      { signal },
    );
    Object.assign(job, result.issue, {
      raw_text: result.raw_text,
      status: 'previewed' as ArrangeJobStatus,
      scrapeStatus: 'success' as ArrangePhaseStatus,
      llmStatus: 'waiting' as ArrangePhaseStatus,
      exportStatus: 'waiting' as ArrangePhaseStatus,
      error: null,
    });
    await loadArrangeHistory();
  } catch (error) {
    if (!isAbortError(error)) {
      const message = error instanceof Error ? error.message : String(error);
      job.status = 'error';
      job.scrapeStatus = 'error';
      job.llmStatus = 'skipped';
      job.exportStatus = 'skipped';
      job.error = message;
    }
    throw error;
  } finally {
    renderArrangeJobs();
    renderArrangeSelection();
  }
}

async function runArrangeLlmJob(job: ArrangeJob, signal?: AbortSignal): Promise<void> {
  if (!job.raw_text) {
    job.status = 'error';
    job.llmStatus = 'error';
    job.error = '尚無 Scrape 資料，請先執行擷取 Issue。';
    renderArrangeJobs();
    renderArrangeSelection();
    return;
  }
  job.status = 'running';
  job.scrapeStatus = 'success';
  job.llmStatus = 'running';
  job.exportStatus = 'waiting';
  job.error = null;
  renderArrangeJobs();
  renderArrangeSelection();
  try {
    const result = await api<{
      result: string;
      model: string;
      saved_result_path: string | null;
    }>(
      '/api/arrange/llm',
      'POST',
      {
        url: job.web_url,
        raw_text: job.raw_text,
        system_prompt: byId<HTMLTextAreaElement>('arrange-prompt').value.trim(),
        preferred_model: state.uiPreferences.geminiModel,
        model_candidates: ARRANGE_GEMINI_MODEL_LIST,
      },
      { signal },
    );
    job.result = result.result;
    job.model = result.model;
    job.status = 'done';
    job.llmStatus = 'success';
    job.exportStatus = 'success';
    job.error = null;
    await loadArrangeHistory();
  } catch (error) {
    if (!isAbortError(error)) {
      const message = error instanceof Error ? error.message : String(error);
      job.status = 'error';
      job.llmStatus = 'error';
      job.exportStatus = 'skipped';
      job.error = message;
    }
    throw error;
  } finally {
    renderArrangeJobs();
    renderArrangeSelection();
  }
}

async function runArrangeBatchByMode(mode: 'all' | 'scrape' | 'llm'): Promise<void> {
  if (state.arrangeBatchRunning) {
    setArrangeStatus('批次整理進行中，請先完成或中止。', 'warn');
    return;
  }
  if (!state.arrangeJobs.length) {
    await previewArrangeIssues();
    if (!state.arrangeJobs.length) return;
  }
  updateArrangePromptPreference();
  state.arrangeBatchRunning = true;
  state.arrangeBatchAbortController = new AbortController();
  setArrangeButtonsEnabled(false);
  let successCount = 0;
  let aborted = false;
  try {
    for (const job of state.arrangeJobs) {
      state.selectedArrangeJobId = job.id;
      renderArrangeJobs();
      renderArrangeSelection();
      const label = mode === 'scrape' ? '擷取' : mode === 'llm' ? 'LLM 整理' : '整理';
      setArrangeStatus(`正在${label} #${job.iid}...`, 'idle');
      try {
        const signal = state.arrangeBatchAbortController.signal;
        if (mode === 'scrape') await runArrangeScrapeJob(job, signal);
        else if (mode === 'llm') await runArrangeLlmJob(job, signal);
        else await runArrangeJob(job);
      } catch (error) {
        if (isAbortError(error)) {
          aborted = true;
          break;
        }
      }
      const succeeded =
        mode === 'scrape'
          ? job.scrapeStatus === 'success'
          : mode === 'llm'
            ? job.llmStatus === 'success'
            : job.scrapeStatus === 'success' &&
              job.llmStatus === 'success' &&
              job.exportStatus === 'success';
      if (succeeded) successCount += 1;
    }
    const modeLabel = mode === 'all' ? '批次整理' : mode === 'scrape' ? '擷取批次' : 'LLM 批次';
    setArrangeStatus(
      aborted
        ? `${modeLabel}已中止：${successCount}/${state.arrangeJobs.length} 筆完成。`
        : `${modeLabel}完成：${successCount}/${state.arrangeJobs.length} 筆成功。`,
      aborted ? 'warn' : 'success',
    );
    showToast(
      aborted ? '批次已中止' : '批次處理完成',
      aborted
        ? `${successCount}/${state.arrangeJobs.length} 筆已完成。`
        : `${successCount}/${state.arrangeJobs.length} 筆成功。`,
      aborted ? 'warn' : 'success',
      3600,
    );
  } finally {
    state.arrangeBatchAbortController = null;
    state.arrangeBatchRunning = false;
    setArrangeButtonsEnabled(true);
  }
}

async function runArrangeBatch(): Promise<void> {
  await runArrangeBatchByMode('all');
}

function stopArrangeBatch(): void {
  if (state.arrangeBatchAbortController) {
    state.arrangeBatchAbortController.abort();
  }
}

async function exportArrangeExcel(): Promise<void> {
  const urls = state.arrangeJobs.length
    ? state.arrangeJobs.map((job) => job.web_url).filter(Boolean)
    : getArrangeInputLines();

  if (!urls.length) {
    setArrangeStatus('請先貼上 Issue URL，或先做一次預覽。', 'warn');
    return;
  }

  setArrangeStatus('正在匯出 Excel...', 'idle');
  setArrangeButtonsEnabled(false);
  try {
    const result = await api<{
      path: string;
      count: number;
      errors: Array<{ url: string; error: string }>;
    }>('/api/arrange/export-excel', 'POST', { urls });
    await loadArrangeHistory();
    await window.trackerBridge.openPath(result.path);
    setArrangeStatus(
      `Excel 已匯出，共 ${result.count} 筆。`,
      result.errors.length ? 'warn' : 'success',
    );
    showToast(
      result.errors.length ? 'Excel 匯出完成（含警告）' : 'Excel 匯出完成',
      `共匯出 ${result.count} 筆。`,
      result.errors.length ? 'warn' : 'success',
    );
  } finally {
    setArrangeButtonsEnabled(true);
  }
}

/* ══════════════════════════════════════════════
   TAB: ANALYTICS — Burndown / Workload / Alerts
   ══════════════════════════════════════════════ */
function renderBurndownChart(ms: BurndownMilestone): void {
  const container = byId<HTMLDivElement>('burndown-chart');
  const statsDiv = byId<HTMLDivElement>('burndown-stats');

  if (!ms.series.length) {
    container.innerHTML = '<div class="empty-state">此 Milestone 沒有足夠資料。</div>';
    statsDiv.innerHTML = '';
    return;
  }

  const series = ms.series;
  const W = 700;
  const H = 300;
  const pad = { top: 20, right: 20, bottom: 40, left: 45 };
  const chartW = W - pad.left - pad.right;
  const chartH = H - pad.top - pad.bottom;
  const maxY = Math.max(...series.map((p) => Math.max(p.open, p.total, p.ideal ?? 0)), 1);
  const n = series.length;

  function x(i: number): number {
    return pad.left + (i / Math.max(n - 1, 1)) * chartW;
  }
  function y(v: number): number {
    return pad.top + chartH - (v / maxY) * chartH;
  }

  function polyline(data: number[], color: string, dashed = false): string {
    const pts = data.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
    return `<polyline points="${pts}" fill="none" stroke="${color}" stroke-width="2" ${dashed ? 'stroke-dasharray="6,4"' : ''} />`;
  }

  // Grid lines
  let gridLines = '';
  const gridSteps = 5;
  for (let i = 0; i <= gridSteps; i++) {
    const yy = pad.top + (i / gridSteps) * chartH;
    const val = Math.round(maxY * (1 - i / gridSteps));
    gridLines += `<line x1="${pad.left}" y1="${yy}" x2="${W - pad.right}" y2="${yy}" stroke="rgba(255,255,255,0.06)" />`;
    gridLines += `<text x="${pad.left - 8}" y="${yy + 4}" text-anchor="end" fill="var(--text-muted)" font-size="10">${val}</text>`;
  }

  // X-axis labels (show ~8 labels max)
  let xLabels = '';
  const labelStep = Math.max(1, Math.floor(n / 8));
  for (let i = 0; i < n; i += labelStep) {
    const d = series[i].date.slice(5); // MM-DD
    xLabels += `<text x="${x(i)}" y="${H - 5}" text-anchor="middle" fill="var(--text-muted)" font-size="10">${d}</text>`;
  }

  const openData = series.map((p) => p.open);
  const idealData = series.map((p) => p.ideal ?? 0);
  const closedData = series.map((p) => p.closed);

  // Fill area under open line
  const openArea =
    `M${x(0).toFixed(1)},${y(0).toFixed(1)} ` +
    openData.map((v, i) => `L${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ') +
    ` L${x(n - 1).toFixed(1)},${y(0).toFixed(1)} Z`;

  container.innerHTML = `
    <svg viewBox="0 0 ${W} ${H}" class="burndown-svg">
      ${gridLines}
      <path d="${openArea}" fill="rgba(124,156,255,0.1)" />
      ${polyline(idealData, 'var(--text-secondary)', true)}
      ${polyline(closedData, 'var(--green-400)')}
      ${polyline(openData, 'var(--accent)')}
      ${xLabels}
      <g transform="translate(${pad.left + 10}, ${pad.top + 10})">
        <line x1="0" y1="0" x2="20" y2="0" stroke="var(--accent)" stroke-width="2" />
        <text x="24" y="4" fill="var(--text-secondary)" font-size="10">剩餘 Open</text>
        <line x1="0" y1="16" x2="20" y2="16" stroke="var(--green-400)" stroke-width="2" />
        <text x="24" y="20" fill="var(--text-secondary)" font-size="10">已完成 Closed</text>
          <line x1="0" y1="32" x2="20" y2="32" stroke="var(--text-secondary)" stroke-width="2" stroke-dasharray="6,4" />
        <text x="24" y="36" fill="var(--text-secondary)" font-size="10">理想進度</text>
      </g>
    </svg>
  `;

  const pct = ms.total > 0 ? Math.round((ms.closed / ms.total) * 100) : 0;
  statsDiv.innerHTML = `
    <div class="burndown-stat"><span>總 Issue</span><strong>${ms.total}</strong></div>
    <div class="burndown-stat"><span>已完成</span><strong class="text-green">${ms.closed}</strong></div>
    <div class="burndown-stat"><span>剩餘</span><strong class="text-accent">${ms.open}</strong></div>
    <div class="burndown-stat"><span>完成率</span><strong>${pct}%</strong></div>
    <div class="burndown-stat"><span>到期日</span><strong>${ms.due_date ?? '-'}</strong></div>
  `;
}

function renderBurndownChartSafe(ms: BurndownMilestone): void {
  const container = byId<HTMLDivElement>('burndown-chart');
  const statsDiv = byId<HTMLDivElement>('burndown-stats');

  if (!ms.series.length) {
    container.innerHTML =
      '<div class="empty-state">這個 Milestone 目前沒有可用的 burndown 資料。</div>';
    statsDiv.innerHTML = '';
    return;
  }

  const series = ms.series;
  const width = 700;
  const height = 300;
  const padding = { top: 20, right: 20, bottom: 40, left: 45 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  const maxY = Math.max(
    ms.total,
    ...series.map((point) => Math.max(point.open, point.closed, point.total, point.ideal ?? 0)),
    1,
  );
  const pointCount = series.length;

  const x = (index: number): number =>
    padding.left + (index / Math.max(pointCount - 1, 1)) * chartWidth;
  const y = (value: number): number => padding.top + chartHeight - (value / maxY) * chartHeight;
  const buildPolyline = (values: number[], color: string, dashed = false): string => {
    const points = values
      .map((value, index) => `${x(index).toFixed(1)},${y(value).toFixed(1)}`)
      .join(' ');
    return `<polyline points="${points}" fill="none" stroke="${color}" stroke-width="2" ${dashed ? 'stroke-dasharray="6,4"' : ''} />`;
  };

  let gridLines = '';
  for (let step = 0; step <= 5; step++) {
    const yy = padding.top + (step / 5) * chartHeight;
    const label = Math.round(maxY * (1 - step / 5));
    gridLines += `<line x1="${padding.left}" y1="${yy}" x2="${width - padding.right}" y2="${yy}" stroke="rgba(255,255,255,0.06)" />`;
    gridLines += `<text x="${padding.left - 8}" y="${yy + 4}" text-anchor="end" fill="var(--text-muted)" font-size="10">${label}</text>`;
  }

  let xLabels = '';
  const labelStep = Math.max(1, Math.floor(pointCount / 8));
  for (let index = 0; index < pointCount; index += labelStep) {
    xLabels += `<text x="${x(index)}" y="${height - 5}" text-anchor="middle" fill="var(--text-muted)" font-size="10">${series[index].date.slice(5)}</text>`;
  }

  const openData = series.map((point) => point.open);
  const closedData = series.map((point) => point.closed);
  const idealData = series.map((point) => point.ideal ?? 0);
  const openArea =
    `M${x(0).toFixed(1)},${y(0).toFixed(1)} ` +
    openData.map((value, index) => `L${x(index).toFixed(1)},${y(value).toFixed(1)}`).join(' ') +
    ` L${x(pointCount - 1).toFixed(1)},${y(0).toFixed(1)} Z`;

  container.innerHTML = `
    <svg viewBox="0 0 ${width} ${height}" class="burndown-svg">
      ${gridLines}
      <path d="${openArea}" fill="rgba(124,156,255,0.1)" />
      ${buildPolyline(idealData, 'var(--text-secondary)', true)}
      ${buildPolyline(closedData, 'var(--green-400)')}
      ${buildPolyline(openData, 'var(--accent)')}
      ${xLabels}
      <g transform="translate(${padding.left + 10}, ${padding.top + 10})">
        <line x1="0" y1="0" x2="20" y2="0" stroke="var(--accent)" stroke-width="2" />
        <text x="24" y="4" fill="var(--text-secondary)" font-size="10">Open</text>
        <line x1="0" y1="16" x2="20" y2="16" stroke="var(--green-400)" stroke-width="2" />
        <text x="24" y="20" fill="var(--text-secondary)" font-size="10">Closed</text>
          <line x1="0" y1="32" x2="20" y2="32" stroke="var(--text-secondary)" stroke-width="2" stroke-dasharray="6,4" />
        <text x="24" y="36" fill="var(--text-secondary)" font-size="10">Ideal</text>
      </g>
    </svg>
  `;

  const pct = ms.total > 0 ? Math.round((ms.closed / ms.total) * 100) : 0;
  statsDiv.innerHTML = `
    <div class="burndown-stat"><span>總 Issue</span><strong>${ms.total}</strong></div>
    <div class="burndown-stat"><span>已完成</span><strong class="text-green">${ms.closed}</strong></div>
    <div class="burndown-stat"><span>未完成</span><strong class="text-accent">${ms.open}</strong></div>
    <div class="burndown-stat"><span>完成率</span><strong>${pct}%</strong></div>
    <div class="burndown-stat"><span>到期日</span><strong>${ms.due_date ?? '-'}</strong></div>
  `;
}

function renderWorkloadHeatmap(workload: WorkloadEntry[]): void {
  const container = byId<HTMLDivElement>('workload-heatmap');
  if (!workload.length) {
    container.innerHTML = '<div class="empty-state">尚無工作量資料。</div>';
    return;
  }

  const maxOpened = Math.max(...workload.map((w) => w.opened), 1);

  container.innerHTML = `
    <div class="workload-table">
      <div class="workload-header">
        <span class="wl-name">負責人</span>
        <span class="wl-bar">開啟 Issue 數</span>
        <span class="wl-num">開啟</span>
        <span class="wl-num">已關</span>
        <span class="wl-num wl-warn">逾期</span>
        <span class="wl-num wl-alert">3天內</span>
      </div>
      ${workload
        .map((w) => {
          const pct = (w.opened / maxOpened) * 100;
          const hue =
            w.overdue > 0 ? 0 : w.due_soon > 0 ? 35 : w.opened > maxOpened * 0.7 ? 0 : 220;
          const barColor =
            w.overdue > 0
              ? 'var(--red-400)'
              : w.due_soon > 0
                ? 'var(--yellow-400)'
                : w.opened > maxOpened * 0.7
                  ? 'var(--orange-400)'
                  : 'var(--accent)';
          return `
          <div class="workload-row ${w.overdue > 0 ? 'has-overdue' : ''}">
            <span class="wl-name" title="${escapeHtml(w.assignee)}">
              ${
                w.avatar_url
                  ? `<img class="wl-avatar" src="${escapeHtml(w.avatar_url)}" alt="" />`
                  : `<span class="wl-avatar wl-avatar-placeholder">${escapeHtml(w.assignee.includes('未指派') ? '未' : w.assignee.charAt(0).toUpperCase())}</span>`
              }
              ${escapeHtml(w.assignee)}
            </span>
            <span class="wl-bar">
              <span class="wl-bar-fill" style="width:${pct.toFixed(1)}%;background:${barColor}"></span>
            </span>
            <span class="wl-num">${w.opened}</span>
            <span class="wl-num">${w.closed}</span>
            <span class="wl-num wl-warn">${w.overdue || '-'}</span>
            <span class="wl-num wl-alert">${w.due_soon || '-'}</span>
          </div>
        `;
        })
        .join('')}
    </div>
  `;
}

function renderOverdueAlerts(alerts: AlertEntry[]): void {
  const container = byId<HTMLDivElement>('overdue-alerts');
  if (!alerts.length) {
    container.innerHTML = '<div class="empty-state">目前沒有逾期或即將到期的 Issue。</div>';
    return;
  }

  container.innerHTML = alerts
    .map((a) => {
      const severityLabel: Record<string, string> = {
        overdue: '已逾期',
        critical: '3 天內到期',
        warning: '7 天內到期',
      };
      const severityIcon: Record<string, string> = { overdue: '🔴', critical: '🟡', warning: '🟠' };
      const daysText =
        a.days_until_due < 0
          ? `逾期 ${Math.abs(a.days_until_due)} 天`
          : a.days_until_due === 0
            ? '今天到期'
            : `${a.days_until_due} 天後到期`;
      return `
      <div class="alert-item severity-${a.severity}" data-iid="${a.iid}" style="cursor:pointer">
        <span class="alert-icon">${severityIcon[a.severity] || ''}</span>
        <div class="alert-info">
          <strong>#${a.iid} ${escapeHtml(a.title)}</strong>
          <span class="alert-meta">
            ${escapeHtml((a.assignees || []).join(', ') || '未指派')} · ${escapeHtml(a.milestone ?? '-')} · ${daysText}
          </span>
        </div>
        <span class="alert-badge ${a.severity}">${severityLabel[a.severity] || ''}</span>
      </div>
    `;
    })
    .join('');
}

async function loadAnalytics(): Promise<void> {
  try {
    const data = await api<AnalyticsResponse>('/api/analytics');
    state.analytics = data;
    const sortedBurndown = [...data.burndown].sort((left, right) =>
      compareMilestoneEntries(
        {
          name: left.milestone,
          start: startOfDay(left.start_date),
          due: startOfDay(left.due_date),
          hasExplicitDue: Boolean(left.due_date),
        },
        {
          name: right.milestone,
          start: startOfDay(right.start_date),
          due: startOfDay(right.due_date),
          hasExplicitDue: Boolean(right.due_date),
        },
      ),
    );
    const burndownMilestones: MilestoneSortEntry[] = sortedBurndown.map((milestone) => ({
      name: milestone.milestone,
      start: startOfDay(milestone.start_date),
      due: startOfDay(milestone.due_date),
      hasExplicitDue: Boolean(milestone.due_date),
    }));

    // Populate milestone selector
    const sel = byId<HTMLSelectElement>('burndown-milestone-select');
    const nextValue = getDefaultMilestoneFilterValue(burndownMilestones, sel.value);
    sel.innerHTML =
      '<option value="">選擇 Milestone</option>' +
      burndownMilestones
        .map(
          (milestone) =>
            `<option value="${escapeHtml(milestone.name)}">${escapeHtml(formatMilestoneOptionLabel(milestone))}</option>`,
        )
        .join('');
    sel.value = nextValue;
    sel.title = sel.selectedOptions[0]?.textContent ?? '';

    // Auto-select first milestone if none selected
    if (!sel.value && sortedBurndown.length) {
      sel.value = sortedBurndown[0].milestone;
      sel.title = sel.selectedOptions[0]?.textContent ?? '';
    }

    // Render burndown for selected milestone
    const selectedMs = data.burndown.find((b) => b.milestone === sel.value);
    if (selectedMs) {
      renderBurndownChartSafe(selectedMs);
    }

    // Render workload
    renderWorkloadHeatmap(data.workload);

    // Render alerts on dashboard
    renderOverdueAlerts(data.alerts);

    // Render label distribution
    renderLabelDistribution(data.label_distribution);

    // Render lifecycle
    renderLifecycle(data.lifecycle);

    // Render milestone progress
    renderMilestoneProgressSafe(data.burndown);

    if (
      document.getElementById('tab-timeline')?.classList.contains('active') &&
      state.allIssues.length > 0
    ) {
      scheduleGanttRender(state.allIssues);
    }
  } catch (err) {
    console.error('loadAnalytics failed', err);
  }
}

/* ── Label Distribution Donut Chart ── */
function renderLabelDistribution(labels: LabelDistEntry[]): void {
  const container = byId<HTMLDivElement>('label-distribution');
  if (!labels.length) {
    container.innerHTML = '<div class="empty-state">尚無 Label 資料。</div>';
    return;
  }

  const top = labels.slice(0, 12);
  const total = top.reduce((s, l) => s + l.total, 0) || 1;

  // Donut chart SVG
  const size = 200;
  const cx = size / 2;
  const cy = size / 2;
  const R = 80;
  const r = 50;
  const colors = [
    '#7c9cff',
    '#8d72ff',
    '#4ade80',
    '#f87171',
    '#facc15',
    '#fb923c',
    '#38bdf8',
    '#a78bfa',
    '#34d399',
    '#f472b6',
    '#94a3b8',
    '#e879f9',
  ];

  let segments = '';
  let angle = -90;
  top.forEach((item, i) => {
    const sweep = (item.total / total) * 360;
    const startAngle = angle;
    const endAngle = angle + sweep;
    const largeArc = sweep > 180 ? 1 : 0;
    const toRad = (a: number) => (a * Math.PI) / 180;

    const x1 = cx + R * Math.cos(toRad(startAngle));
    const y1 = cy + R * Math.sin(toRad(startAngle));
    const x2 = cx + R * Math.cos(toRad(endAngle));
    const y2 = cy + R * Math.sin(toRad(endAngle));
    const x3 = cx + r * Math.cos(toRad(endAngle));
    const y3 = cy + r * Math.sin(toRad(endAngle));
    const x4 = cx + r * Math.cos(toRad(startAngle));
    const y4 = cy + r * Math.sin(toRad(startAngle));

    segments += `<path d="M${x1},${y1} A${R},${R} 0 ${largeArc},1 ${x2},${y2} L${x3},${y3} A${r},${r} 0 ${largeArc},0 ${x4},${y4} Z" fill="${colors[i % colors.length]}" opacity="0.85" />`;
    angle = endAngle;
  });

  // Legend
  const legend = top
    .map((item, i) => {
      const pct = ((item.total / total) * 100).toFixed(1);
      return `<div class="label-legend-item">
      <span class="label-legend-dot" style="background:${colors[i % colors.length]}"></span>
      <span class="label-legend-name">${escapeHtml(item.label)}</span>
      <span class="label-legend-count">${item.total} (${pct}%)</span>
    </div>`;
    })
    .join('');

  container.innerHTML = `
    <div class="label-chart-layout">
      <svg viewBox="0 0 ${size} ${size}" class="donut-svg">
        ${segments}
        <text x="${cx}" y="${cy - 6}" text-anchor="middle" fill="var(--text-primary)" font-size="18" font-weight="700">${total}</text>
        <text x="${cx}" y="${cy + 12}" text-anchor="middle" fill="var(--text-muted)" font-size="10">Issues</text>
      </svg>
      <div class="label-legend">${legend}</div>
    </div>
  `;
}

/* ── Issue Lifecycle (MTTR + Histogram + Throughput) ── */
function renderLifecycle(lc: LifecycleData): void {
  const container = byId<HTMLDivElement>('lifecycle-stats');
  if (!lc.total_closed) {
    container.innerHTML = '<div class="empty-state">尚無已結案 Issue 資料（無法計算 MTTR）。</div>';
    return;
  }

  // KPI cards
  const kpis = `
    <div class="lifecycle-kpi-row">
      <div class="burndown-stat"><span>平均解決 (MTTR)</span><strong>${lc.mttr_days ?? '-'} 天</strong></div>
      <div class="burndown-stat"><span>中位數</span><strong>${lc.median_days ?? '-'} 天</strong></div>
      <div class="burndown-stat"><span>P90</span><strong>${lc.p90_days ?? '-'} 天</strong></div>
      <div class="burndown-stat"><span>已結案總數</span><strong>${lc.total_closed}</strong></div>
    </div>
  `;

  // Histogram SVG
  const hist = lc.histogram;
  const maxH = Math.max(...hist.map((b) => b.count), 1);
  const barW = 60;
  const barGap = 8;
  const chartH = 140;
  const svgW = hist.length * (barW + barGap);

  let histBars = '';
  hist.forEach((b, i) => {
    const h = (b.count / maxH) * (chartH - 20);
    const bx = i * (barW + barGap);
    const by = chartH - h;
    histBars += `
      <rect x="${bx}" y="${by}" width="${barW}" height="${h}" rx="4" fill="var(--accent)" opacity="0.8" />
      <text x="${bx + barW / 2}" y="${by - 4}" text-anchor="middle" fill="var(--text-secondary)" font-size="11">${b.count}</text>
      <text x="${bx + barW / 2}" y="${chartH + 14}" text-anchor="middle" fill="var(--text-muted)" font-size="10">${b.bucket}</text>
    `;
  });

  // Throughput line chart
  const tp = lc.throughput;
  let throughputHtml = '';
  if (tp.length > 1) {
    const tpW = 500;
    const tpH = 140;
    const tpPad = { top: 15, right: 10, bottom: 25, left: 35 };
    const tpChartW = tpW - tpPad.left - tpPad.right;
    const tpChartH = tpH - tpPad.top - tpPad.bottom;
    const maxTp = Math.max(...tp.map((t) => t.count), 1);

    const tpX = (i: number) => tpPad.left + (i / Math.max(tp.length - 1, 1)) * tpChartW;
    const tpY = (v: number) => tpPad.top + tpChartH - (v / maxTp) * tpChartH;

    const pts = tp.map((t, i) => `${tpX(i).toFixed(1)},${tpY(t.count).toFixed(1)}`).join(' ');
    const area =
      `M${tpX(0).toFixed(1)},${tpY(0).toFixed(1)} ` +
      tp.map((t, i) => `L${tpX(i).toFixed(1)},${tpY(t.count).toFixed(1)}`).join(' ') +
      ` L${tpX(tp.length - 1).toFixed(1)},${tpY(0).toFixed(1)} Z`;

    // Grid
    let tpGrid = '';
    for (let i = 0; i <= 4; i++) {
      const yy = tpPad.top + (i / 4) * tpChartH;
      const val = Math.round(maxTp * (1 - i / 4));
      tpGrid += `<line x1="${tpPad.left}" y1="${yy}" x2="${tpW - tpPad.right}" y2="${yy}" stroke="rgba(255,255,255,0.06)" />`;
      tpGrid += `<text x="${tpPad.left - 6}" y="${yy + 4}" text-anchor="end" fill="var(--text-muted)" font-size="10">${val}</text>`;
    }

    // X labels
    let tpLabels = '';
    const tpStep = Math.max(1, Math.floor(tp.length / 6));
    tp.forEach((t, i) => {
      if (i % tpStep === 0 || i === tp.length - 1) {
        tpLabels += `<text x="${tpX(i)}" y="${tpH - 3}" text-anchor="middle" fill="var(--text-muted)" font-size="10">${t.month.slice(2)}</text>`;
      }
    });

    throughputHtml = `
      <h4 class="chart-subtitle">每月結案趨勢</h4>
      <svg viewBox="0 0 ${tpW} ${tpH}" class="throughput-svg">
        ${tpGrid}
        <path d="${area}" fill="rgba(74,222,128,0.1)" />
        <polyline points="${pts}" fill="none" stroke="var(--green-400)" stroke-width="2" />
        ${tp.map((t, i) => `<circle cx="${tpX(i).toFixed(1)}" cy="${tpY(t.count).toFixed(1)}" r="3" fill="var(--green-400)" />`).join('')}
        ${tpLabels}
      </svg>
    `;
  }

  container.innerHTML = `
    ${kpis}
    <h4 class="chart-subtitle">解決時間分佈</h4>
    <div class="histogram-scroll">
      <svg viewBox="0 0 ${svgW} ${chartH + 20}" class="histogram-svg">${histBars}</svg>
    </div>
    ${throughputHtml}
  `;
}

/* ── Milestone Progress Overview ── */
function renderMilestoneProgress(burndown: BurndownMilestone[]): void {
  const container = byId<HTMLDivElement>('milestone-progress');
  if (!burndown.length) {
    container.innerHTML = '<div class="empty-state">尚無 Milestone 資料。</div>';
    return;
  }

  // Sort: in-progress first (has open), then by due date
  const sorted = [...burndown].sort((a, b) => {
    if (a.open > 0 && b.open === 0) return -1;
    if (a.open === 0 && b.open > 0) return 1;
    return (a.due_date ?? '9999').localeCompare(b.due_date ?? '9999');
  });

  container.innerHTML = `
    <div class="ms-progress-list">
      ${sorted
        .map((ms) => {
          const pct = ms.total > 0 ? Math.round((ms.closed / ms.total) * 100) : 0;
          const isComplete = ms.open === 0 && ms.total > 0;
          const isOverdue = ms.due_date && new Date(ms.due_date) < new Date() && !isComplete;
          const barColor = isComplete
            ? 'var(--green-400)'
            : isOverdue
              ? 'var(--red-400)'
              : 'var(--accent)';
          const statusClass = isComplete ? 'complete' : isOverdue ? 'overdue' : 'active';
          const dueText = ms.due_date ?? '-';
          return `
          <div class="ms-progress-item ${statusClass}">
            <div class="ms-progress-header">
              <span class="ms-progress-name" title="${escapeHtml(ms.milestone)}">${escapeHtml(ms.milestone)}</span>
              <span class="ms-progress-pct">${pct}%</span>
            </div>
            <div class="ms-progress-bar-track">
              <div class="ms-progress-bar-fill" style="width:${pct}%;background:${barColor}"></div>
            </div>
            <div class="ms-progress-meta">
              <span>${ms.closed}/${ms.total} 完成</span>
              <span>到期：${escapeHtml(dueText)}</span>
            </div>
          </div>
        `;
        })
        .join('')}
    </div>
  `;
}

function renderMilestoneProgressSafe(burndown: BurndownMilestone[]): void {
  const container = byId<HTMLDivElement>('milestone-progress');
  if (!burndown.length) {
    container.innerHTML = '<div class="empty-state">目前沒有 Milestone 進度資料。</div>';
    return;
  }

  const sorted = [...burndown].sort((left, right) => {
    if (left.open > 0 && right.open === 0) return -1;
    if (left.open === 0 && right.open > 0) return 1;
    return (left.due_date ?? '9999').localeCompare(right.due_date ?? '9999');
  });

  container.innerHTML = `
    <div class="ms-progress-list">
      ${sorted
        .map((milestone) => {
          const pct =
            milestone.total > 0 ? Math.round((milestone.closed / milestone.total) * 100) : 0;
          const isComplete = milestone.open === 0 && milestone.total > 0;
          const isOverdue = Boolean(
            milestone.due_date && new Date(milestone.due_date) < new Date() && !isComplete,
          );
          const barColor = isComplete
            ? 'var(--green-400)'
            : isOverdue
              ? 'var(--red-400)'
              : 'var(--accent)';
          const statusClass = isComplete ? 'complete' : isOverdue ? 'overdue' : 'active';
          const dueText = milestone.due_date ?? '-';

          return `
          <div class="ms-progress-item ${statusClass}">
            <div class="ms-progress-header">
              <span class="ms-progress-name" title="${escapeHtml(milestone.milestone)}">${escapeHtml(milestone.milestone)}</span>
              <span class="ms-progress-pct">${pct}%</span>
            </div>
            <div class="ms-progress-bar-track">
              <div class="ms-progress-bar-fill" style="width:${pct}%;background:${barColor}"></div>
            </div>
            <div class="ms-progress-meta">
              <span>${milestone.closed}/${milestone.total} 已完成</span>
              <span>到期日：${escapeHtml(dueText)}</span>
            </div>
          </div>
        `;
        })
        .join('')}
    </div>
  `;
}

/* ══════════════════════════════════════════════
   TAB SWITCHING
   ══════════════════════════════════════════════ */
function initTabs(): void {
  const tabBtns = document.querySelectorAll<HTMLButtonElement>('.tab-btn');
  tabBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab!;
      tabBtns.forEach((b) => {
        b.classList.toggle('active', b === btn);
        b.setAttribute('aria-selected', b === btn ? 'true' : 'false');
      });
      document.querySelectorAll<HTMLDivElement>('.tab-content').forEach((panel) => {
        panel.classList.toggle('active', panel.id === `tab-${tab}`);
      });

      // Lazy load data for tabs
      if (tab === 'analytics' && state.analytics) {
        const sel = byId<HTMLSelectElement>('burndown-milestone-select');
        const ms = state.analytics.burndown.find((b) => b.milestone === sel.value);
        if (ms) renderBurndownChartSafe(ms);
        renderWorkloadHeatmap(state.analytics.workload);
        renderLabelDistribution(state.analytics.label_distribution);
        renderLifecycle(state.analytics.lifecycle);
        renderMilestoneProgressSafe(state.analytics.burndown);
      }
      if (tab === 'timeline' && state.allIssues.length > 0) {
        scheduleGanttRender(state.allIssues);
      }
      if (tab === 'table' && state.allIssues.length > 0) {
        renderSpreadsheet();
      }
    });
  });
}

/* ══════════════════════════════════════════════
   API ACTIONS
   ══════════════════════════════════════════════ */
async function loadConfig(): Promise<void> {
  setStatus('讀取設定中...');
  const config = coerceConfig(await api<AppConfig>('/api/config'));
  fillConfigForm(config);
  cacheConfig(config);
  setStatus('設定已載入', 'success');
}

async function saveConfig(): Promise<void> {
  setStatus('儲存設定中...');
  const payload = readConfigForm();
  const config = coerceConfig(await api<AppConfig>('/api/config', 'POST', payload));
  fillConfigForm(config);
  cacheConfig(config);
  setStatus('設定已儲存', 'success');
}

// ── Daily Issue Briefing ────────────────────────────────────────────────────
interface BriefingSettings {
  enabled: boolean;
  has_teams_webhook_url: boolean;
  teams_webhook_url_masked: string;
  send_time: string;
  timezone: string;
  workdays: number[];
  updated_issue_window: string;
  include_risks: boolean;
  include_next_steps: boolean;
  include_source_links: boolean;
}

interface BriefingResult {
  ok: boolean;
  date: string;
  issue_count: number;
  title: string;
  message: string;
  index_built_at: string | null;
  mode: string;
}

interface BriefingHistoryItem {
  at: string;
  date: string;
  trigger: string;
  channel?: string;
  ok: boolean;
  issue_count: number;
  mode: string;
  status_code: number | null;
  error: string | null;
  index_built_at?: string | null;
  title?: string;
}

function fillBriefingForm(settings: BriefingSettings): void {
  const enabled = getById<HTMLInputElement>('briefing-enabled');
  if (enabled) enabled.checked = Boolean(settings.enabled);

  const webhook = getById<HTMLInputElement>('briefing-webhook');
  if (webhook) webhook.value = ''; // never echo the secret; show status separately
  const webhookStatus = getById<HTMLElement>('briefing-webhook-status');
  if (webhookStatus) {
    webhookStatus.textContent = settings.has_teams_webhook_url
      ? `已設定：${settings.teams_webhook_url_masked}`
      : '尚未設定';
  }
  const clear = getById<HTMLInputElement>('briefing-webhook-clear');
  if (clear) clear.checked = false;

  const sendTime = getById<HTMLInputElement>('briefing-send-time');
  if (sendTime) sendTime.value = settings.send_time || '18:30';
  const timezone = getById<HTMLInputElement>('briefing-timezone');
  if (timezone) timezone.value = settings.timezone || 'Asia/Taipei';

  const workdays = new Set(settings.workdays || []);
  document
    .querySelectorAll<HTMLInputElement>('#briefing-workdays input[data-workday]')
    .forEach((box) => {
      box.checked = workdays.has(Number(box.dataset.workday));
    });

  const risks = getById<HTMLInputElement>('briefing-include-risks');
  if (risks) risks.checked = Boolean(settings.include_risks);
  const nextSteps = getById<HTMLInputElement>('briefing-include-next-steps');
  if (nextSteps) nextSteps.checked = Boolean(settings.include_next_steps);
  const links = getById<HTMLInputElement>('briefing-include-links');
  if (links) links.checked = Boolean(settings.include_source_links);
}

function readBriefingForm(): Record<string, unknown> {
  const workdays: number[] = [];
  document
    .querySelectorAll<HTMLInputElement>('#briefing-workdays input[data-workday]')
    .forEach((box) => {
      if (box.checked) workdays.push(Number(box.dataset.workday));
    });

  const webhook = getById<HTMLInputElement>('briefing-webhook')?.value.trim() || '';
  const clear = getById<HTMLInputElement>('briefing-webhook-clear')?.checked || false;

  return {
    enabled: getById<HTMLInputElement>('briefing-enabled')?.checked || false,
    teams_webhook_url: webhook, // '' keeps the stored URL on the backend
    clear_teams_webhook_url: clear,
    send_time: getById<HTMLInputElement>('briefing-send-time')?.value || '18:30',
    timezone: getById<HTMLInputElement>('briefing-timezone')?.value.trim() || 'Asia/Taipei',
    workdays,
    updated_issue_window: 'today',
    include_risks: getById<HTMLInputElement>('briefing-include-risks')?.checked || false,
    include_next_steps: getById<HTMLInputElement>('briefing-include-next-steps')?.checked || false,
    include_source_links: getById<HTMLInputElement>('briefing-include-links')?.checked || false,
  };
}

async function loadBriefingSettings(): Promise<void> {
  const settings = await api<BriefingSettings>('/api/briefing/settings');
  fillBriefingForm(settings);
}

async function saveBriefingSettings(): Promise<void> {
  const payload = readBriefingForm();
  const settings = await api<BriefingSettings>('/api/briefing/settings', 'POST', payload);
  fillBriefingForm(settings);
  showToast('Daily Briefing', '設定已儲存', 'success');
}

async function testBriefingWebhook(): Promise<void> {
  const result = await api<{ ok: boolean; message: string }>(
    '/api/briefing/test-teams',
    'POST',
    {},
  );
  showToast('Test Teams Webhook', result.message, result.ok ? 'success' : 'error');
  void loadBriefingHistory();
}

async function previewBriefing(): Promise<void> {
  const output = getById<HTMLTextAreaElement>('briefing-preview-output');
  if (output) output.value = '產生預覽中…';
  const result = await api<BriefingResult>('/api/briefing/preview', 'POST', {});
  if (output) output.value = result.message;
  showToast(
    'Generate Preview',
    `今日有更新的 Issue：${result.issue_count} 件（模式：${result.mode}）`,
    'success',
  );
}

async function sendBriefingNow(): Promise<void> {
  const result = await api<{ ok: boolean; issue_count: number; message: string }>(
    '/api/briefing/send-now',
    'POST',
    {},
  );
  showToast('Send Now', result.message, result.ok ? 'success' : 'error');
  void loadBriefingHistory();
}

async function loadBriefingHistory(): Promise<void> {
  const container = getById<HTMLElement>('briefing-history');
  if (!container) return;
  const data = await api<{ items: BriefingHistoryItem[] }>('/api/briefing/history');
  const items = data.items || [];
  if (!items.length) {
    container.innerHTML = '<div class="briefing-history-empty">尚無發送紀錄。</div>';
    return;
  }
  container.innerHTML = items
    .map((item) => {
      const when = fmtDate(item.at);
      const dateLabel = item.date ? `${item.date}・` : '';
      const detail = item.ok
        ? `${item.trigger}・${dateLabel}${item.issue_count} 件・${item.mode || '-'}`
        : `${item.trigger}・${escapeHtml(item.error || '失敗')}`;
      return `
        <div class="briefing-history-row">
          <span class="dot ${item.ok ? 'ok' : 'fail'}"></span>
          <span>${escapeHtml(when)}</span>
          <span class="meta">${escapeHtml(detail)}</span>
        </div>`;
    })
    .join('');
}

// ── Project Pulse (專案脈搏) ─────────────────────────────────────────────────
interface PulseSchedule {
  id: string;
  enabled: boolean;
  repo_id: string;
  repo_name: string;
  provider: string;
  name: string;
  report_type: string;
  custom_instruction: string;
  preferred_model: string;
  send_time: string;
  timezone: string;
  workdays: number[];
  channel_type: string;
  has_teams_webhook_url: boolean;
  teams_webhook_url_masked: string;
  updated_issue_window: string;
  issue_state: string;
  labels: string[];
  assignees: string[];
  include_risks: boolean;
  include_next_steps: boolean;
  include_source_links: boolean;
  rebuild_index_before_send: boolean;
  last_run_at: string | null;
  last_run_status: string | null;
  last_run_error: string | null;
  next_run_at: string | null;
}

interface PulseJobResult {
  ok: boolean;
  title: string;
  date: string;
  issue_count: number;
  mode: string;
  message: string;
  generated_at?: string | null;
  requested_model?: string | null;
  model?: string | null;
  sent_ok: boolean | null;
  sent_error: string | null;
}

interface PulseJob {
  job_id: string;
  schedule_id: string;
  run_type: string;
  do_send: boolean;
  status: string; // queued / running / completed / failed
  phase: string; // syncing / indexing / generating / sending / completed
  progress: number;
  result: PulseJobResult | null;
  error: string | null;
}

interface PulseSummary {
  enabled_count: number;
  next_run_at: string | null;
  recent_failures: number;
  monitored_repos: number;
}

interface PulseListResponse {
  items: PulseSchedule[];
  summary: PulseSummary;
}

interface PulseRepo {
  repo_id: string;
  repo_name: string;
  provider: string;
  source_ref: string;
  issue_count: number;
  index_built_at: string | null;
}

interface PulseReport {
  ok: boolean;
  schedule_id: string;
  repo_id: string;
  date: string;
  issue_count: number;
  title: string;
  message: string;
  index_built_at: string | null;
  mode: string;
  generated_at?: string | null;
  requested_model?: string | null;
  model?: string | null;
}

interface PulseHistoryItem {
  id: string;
  schedule_id: string;
  repo_id: string;
  repo_name: string;
  report_type: string;
  run_type: string;
  issue_count: number;
  ok: boolean;
  error_message: string;
  started_at: string;
  finished_at: string;
}

// Must match backend project_pulse_store defaults verbatim.
const PULSE_LEGACY_DAILY_INSTRUCTION = `請整理「選定範圍內今天有任何變動的 Issue」。

請只列出今天有變動的 Issue，變動類型包含但不限於：
- 新增留言 / 回覆
- Description / 標題調整
- Issue 被關閉、重開，或狀態變更
- Label / Milestone / Assignee / Priority 變更
- Due date / Estimate / Weight 等欄位變更
- 其他 metadata 或 issue 內容更新

請使用繁體中文輸出，並避免重述完整歷史。
若需要背景，最多補一句即可。

每個 Issue 請整理以下內容：

1. Issue 標題與來源連結
2. 今日變動摘要
   - 說明今天實際變動了什麼
   - 若有多種變動，請分點列出
3. 目前狀態
   - Open / Closed / Reopened / In Progress 等
   - 若能判斷目前卡在哪裡，也請簡述
4. 風險與阻塞
   - 是否有未解問題、等待他人回覆、需求不明、技術風險或交付風險
   - 若沒有明顯風險，請寫「目前未見明顯阻塞」
5. 建議下一步
   - 給出具體可執行的下一步，而不是籠統建議

最後請附上一段「今日總結」，包含：
- 今天變動的 Issue 數量
- 已關閉 / 仍開啟 / 有阻塞的數量
- 最需要優先追蹤的 1～3 個 Issue

請不要列出今天沒有變動的 Issue。`;

const PULSE_DEFAULT_INSTRUCTIONS: Record<string, string> = {
  'daily-briefing': PULSE_LEGACY_DAILY_INSTRUCTION,

  'custom-report':
    '請根據選定時間範圍內的 Issue 更新，產生一份清楚、可行動的專案報告。請依照重要性整理重點，列出需要追蹤的事項、風險與建議下一步。請使用繁體中文，並附上來源連結。',
};

let pulseSchedules: PulseSchedule[] = [];
let pulseRepos: PulseRepo[] = [];
let pulsePreviewAbort: AbortController | null = null;
let pulsePreviewRunId = 0;

const PULSE_GENERATION_STAGES = [
  { phase: 'syncing', label: '同步最新資訊' },
  { phase: 'indexing', label: '同步留言' },
  { phase: 'generating', label: '產生結果' },
];

function pulseDefaultInstruction(reportType: string): string {
  return PULSE_DEFAULT_INSTRUCTIONS[reportType] || PULSE_DEFAULT_INSTRUCTIONS['custom-report'];
}

function normalizePulseInstruction(instruction: string, reportType: string): string {
  if (reportType === 'daily-briefing' && instruction === PULSE_LEGACY_DAILY_INSTRUCTION) {
    return PULSE_DEFAULT_INSTRUCTIONS['daily-briefing'];
  }
  return instruction;
}

function pulseReportTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    'daily-briefing': '每日簡報',
    'custom-report': '自訂報告',
  };
  return labels[type] || type;
}

function pulseRunTypeLabel(runType: string): string {
  const labels: Record<string, string> = {
    scheduled: '排程',
    manual: '手動',
    test: '測試',
    preview: '預覽',
  };
  return labels[runType] || runType;
}

function pulseWorkdaysLabel(days: number[]): string {
  if (!days || !days.length) return '—';
  const sorted = [...days].sort((a, b) => a - b);
  if (sorted.join(',') === '1,2,3,4,5') return 'Mon-Fri';
  const names = ['一', '二', '三', '四', '五', '六', '日'];
  return sorted.map((d) => names[d - 1] || String(d)).join('');
}

function pulseLastRunCell(schedule: PulseSchedule): string {
  const status = schedule.last_run_status;
  if (!status) return '—';
  if (status === 'success') return '<span class="pulse-run-ok">成功</span>';
  if (status === 'failed') return '<span class="pulse-run-fail">失敗</span>';
  if (status === 'skipped') return '已略過';
  return escapeHtml(status);
}

function pulseOverlay(id: string, open: boolean): void {
  const overlay = getById<HTMLElement>(id);
  if (!overlay) return;
  overlay.classList.toggle('open', open);
  overlay.setAttribute('aria-hidden', open ? 'false' : 'true');
}

function pulsePhaseLabel(job: PulseJob): string {
  const labels: Record<string, string> = {
    queued: '排隊中…',
    syncing: '同步最新資訊…',
    indexing: `同步留言… ${Math.round(job.progress)}%`,
    generating: '產生報告中…',
    sending: '發送中…',
    completed: '完成',
    failed: '失敗',
  };
  return labels[job.phase] || '處理中…';
}

function pulseGenerationStageIndex(phase: string): number {
  if (phase === 'queued' || phase === 'syncing') return 0;
  if (phase === 'indexing') return 1;
  if (phase === 'generating' || phase === 'sending' || phase === 'completed') return 2;
  return 0;
}

function renderPulseStageLoader(phase: string, progress = 0): string {
  const activeIndex = pulseGenerationStageIndex(phase);
  const activeStage = PULSE_GENERATION_STAGES[activeIndex] || PULSE_GENERATION_STAGES[0];
  const progressText = phase === 'indexing' ? ` ${Math.round(progress)}%` : '';
  const blocks = PULSE_GENERATION_STAGES.map((stage, index) => {
    const state = index < activeIndex ? 'done' : index === activeIndex ? 'active' : 'pending';
    const label = stage.phase === activeStage.phase ? `${stage.label}${progressText}` : stage.label;
    return `<span class="pulse-stage-block is-${state}"><span class="pulse-stage-label">${escapeHtml(label)}</span></span>`;
  }).join('<span class="pulse-stage-arrow">→</span>');
  const currentLabel =
    phase === 'queued'
      ? '排隊中'
      : `${activeStage.label}${progressText ? ` ${progressText.trim()}` : ''}`;
  return `
    <div class="pulse-stage-loader" role="status" aria-live="polite" aria-label="${escapeHtml(currentLabel)}">
      ${blocks}
    </div>`;
}

function pulseAbortableDelay(ms: number, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) return Promise.reject(new DOMException('Aborted', 'AbortError'));
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(resolve, ms);
    signal?.addEventListener(
      'abort',
      () => {
        window.clearTimeout(timer);
        reject(new DOMException('Aborted', 'AbortError'));
      },
      { once: true },
    );
  });
}

// Poll a background pulse job until it finishes; onTick fires every poll.
async function pollPulseJob(
  jobId: string,
  onTick: (job: PulseJob) => void,
  signal?: AbortSignal,
): Promise<PulseJob> {
  for (;;) {
    const job = await api<PulseJob>(`/api/project-pulse/jobs/${jobId}`, 'GET', undefined, {
      signal,
    });
    onTick(job);
    if (job.status === 'completed' || job.status === 'failed') return job;
    await pulseAbortableDelay(1200, signal);
  }
}

function setPulseRowStatus(scheduleId: string, text: string): void {
  const cell = document.querySelector<HTMLElement>(
    `[data-pulse-id="${scheduleId}"] .pulse-lastrun`,
  );
  if (cell) cell.textContent = text;
}

function setPulseRowBusy(scheduleId: string, text: string): void {
  const cell = document.querySelector<HTMLElement>(
    `[data-pulse-id="${scheduleId}"] .pulse-lastrun`,
  );
  if (cell) cell.innerHTML = `<span class="pulse-spinner"></span> ${escapeHtml(text)}`;
}

// Disable a button and show a spinner while an async action runs, then restore.
async function runWithButtonBusy(
  buttonId: string,
  busyLabel: string,
  fn: () => Promise<void>,
): Promise<void> {
  const button = getById<HTMLButtonElement>(buttonId);
  const original = button?.innerHTML;
  if (button) {
    button.disabled = true;
    button.innerHTML = `<span class="pulse-spinner"></span> ${escapeHtml(busyLabel)}`;
  }
  try {
    await fn();
  } finally {
    if (button) {
      button.disabled = false;
      if (original !== undefined) button.innerHTML = original;
    }
  }
}

function setPulsePreviewMeta(html: string): void {
  const meta = getById<HTMLElement>('pulse-preview-meta');
  if (meta) meta.innerHTML = html;
}

function setPulsePreviewLoadingPhase(phase: string, progress = 0): void {
  setPulsePreviewMeta(renderPulseStageLoader(phase, progress));
}

function openPulsePreviewLoading(phase: string): void {
  const output = getById<HTMLTextAreaElement>('pulse-preview-output');
  if (output) output.value = '';
  setPulsePreviewLoadingPhase(phase);
  pulseOverlay('pulse-preview-overlay', true);
}

function closePulsePreview(): void {
  pulsePreviewRunId += 1;
  pulsePreviewAbort?.abort();
  pulsePreviewAbort = null;
  pulseOverlay('pulse-preview-overlay', false);
}

function setPulsePreviewError(message: string): void {
  setPulsePreviewMeta('');
  const output = getById<HTMLTextAreaElement>('pulse-preview-output');
  if (output) output.value = message;
}

function renderPulsePreviewMeta(report: PulseReport): string {
  const generatedAt = report.generated_at || report.date;
  const timeLabel = generatedAt ? escapeHtml(fmtDate(generatedAt)) : '';
  const requestedModel = (report.requested_model || '').trim();
  const usedModel = (report.model || '').trim();
  const modelLabel = usedModel || (requestedModel ? '規則產生' : '');
  const isFallback = Boolean(requestedModel && usedModel && requestedModel !== usedModel);
  const metaParts = [
    timeLabel,
    isFallback
      ? `已自動切換：${escapeHtml(requestedModel)} → ${escapeHtml(usedModel)}`
      : escapeHtml(modelLabel),
  ].filter(Boolean);
  const detailParts = [
    `${escapeHtml(String(report.issue_count))} 件`,
    `模式：${escapeHtml(report.mode)}`,
  ];
  const metaClass = isFallback ? 'pulse-preview-meta pulse-preview-fallback' : 'pulse-preview-meta';
  const metaTitle = isFallback ? ' title="原選模型過載或限流，已自動改用可用模型"' : '';
  return `
    <span class="${metaClass}"${metaTitle}>${metaParts.join(' · ')}</span>
    <span class="pulse-preview-detail">${detailParts.join(' · ')}</span>`;
}

async function loadPulse(): Promise<void> {
  const data = await api<PulseListResponse>('/api/project-pulse/schedules');
  pulseSchedules = data.items || [];
  renderPulseSummary(data.summary);
  renderPulseTable(pulseSchedules);
}

function renderPulseSummary(summary: PulseSummary | undefined): void {
  const enabled = getById<HTMLElement>('pulse-summary-enabled');
  if (enabled) enabled.textContent = String(summary?.enabled_count ?? 0);
  const next = getById<HTMLElement>('pulse-summary-next');
  if (next) next.textContent = summary?.next_run_at ? fmtDate(summary.next_run_at) : '—';
  const failures = getById<HTMLElement>('pulse-summary-failures');
  if (failures) failures.textContent = String(summary?.recent_failures ?? 0);
  const repos = getById<HTMLElement>('pulse-summary-repos');
  if (repos) repos.textContent = String(summary?.monitored_repos ?? 0);
}

function renderPulseTable(items: PulseSchedule[]): void {
  const tbody = getById<HTMLElement>('pulse-rows');
  if (!tbody) return;
  if (!items.length) {
    tbody.innerHTML =
      '<tr><td colspan="10" class="pulse-empty">尚無報告任務，按「新增報告任務」建立第一筆。</td></tr>';
    return;
  }
  tbody.innerHTML = items
    .map((s) => {
      const statusDot = s.enabled ? 'on' : 'off';
      const statusText = s.enabled ? '啟用中' : '已停用';
      const toggleLabel = s.enabled ? '停用' : '啟用';
      return `
        <tr data-pulse-id="${escapeHtml(s.id)}">
          <td><span class="pulse-status"><span class="dot ${statusDot}"></span>${statusText}</span></td>
          <td>${escapeHtml(s.repo_name || s.repo_id || '—')}</td>
          <td>${escapeHtml(s.name)}</td>
          <td>${escapeHtml(pulseReportTypeLabel(s.report_type))}</td>
          <td>${escapeHtml(s.send_time)}</td>
          <td>${escapeHtml(pulseWorkdaysLabel(s.workdays))}</td>
          <td>Teams</td>
          <td class="pulse-lastrun">${pulseLastRunCell(s)}</td>
          <td>${s.next_run_at ? escapeHtml(fmtDate(s.next_run_at)) : '—'}</td>
          <td>
            <div class="pulse-row-actions">
              <button class="ghost-btn" data-pulse-action="edit">編輯</button>
              <button class="ghost-btn" data-pulse-action="preview">結果</button>
              <button class="ghost-btn" data-pulse-action="send">發送</button>
              <button class="ghost-btn" data-pulse-action="toggle">${toggleLabel}</button>
              <button class="ghost-btn danger" data-pulse-action="delete">刪除</button>
            </div>
          </td>
        </tr>`;
    })
    .join('');
}

async function loadPulseRepos(): Promise<void> {
  const data = await api<{ items: PulseRepo[] }>('/api/project-pulse/repos');
  pulseRepos = data.items || [];
}

function fillPulseRepoSelect(schedule: PulseSchedule | null): void {
  const select = getById<HTMLSelectElement>('pulse-form-repo');
  if (!select) return;
  const options = [...pulseRepos];
  // Keep an editable schedule's repo selectable even if its snapshot is gone.
  if (schedule && schedule.repo_id && !options.some((r) => r.repo_id === schedule.repo_id)) {
    options.push({
      repo_id: schedule.repo_id,
      repo_name: schedule.repo_name || schedule.repo_id,
      provider: schedule.provider || '',
      source_ref: '',
      issue_count: 0,
      index_built_at: null,
    });
  }
  if (!options.length) {
    select.innerHTML = '<option value="">尚無已同步的 Repo，請先在 Connections 同步</option>';
    return;
  }
  select.innerHTML = options
    .map(
      (r) =>
        `<option value="${escapeHtml(r.repo_id)}">${escapeHtml(r.repo_name)}${r.provider ? ` (${escapeHtml(r.provider)})` : ''}</option>`,
    )
    .join('');
  if (schedule && schedule.repo_id) select.value = schedule.repo_id;
}

function fillPulseForm(schedule: PulseSchedule | null): void {
  const setVal = (id: string, value: string) => {
    const el = getById<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(id);
    if (el) el.value = value;
  };
  const setChecked = (id: string, value: boolean) => {
    const el = getById<HTMLInputElement>(id);
    if (el) el.checked = value;
  };

  getById<HTMLInputElement>('pulse-form-id')!.value = schedule?.id || '';
  const title = getById<HTMLElement>('pulse-form-title');
  if (title) title.textContent = schedule ? '編輯報告任務' : '新增報告任務';

  setChecked('pulse-form-enabled', schedule ? schedule.enabled : true);
  setVal('pulse-form-name', schedule?.name || '每日 Issue 摘要');
  setVal('pulse-form-type', schedule?.report_type || 'daily-briefing');
  setVal('pulse-form-send-time', schedule?.send_time || '18:30');
  // Keep a stored timezone selectable even if it isn't one of the presets.
  const tz = schedule?.timezone || 'Asia/Taipei';
  const tzSelect = getById<HTMLSelectElement>('pulse-form-timezone');
  if (tzSelect && !Array.from(tzSelect.options).some((opt) => opt.value === tz)) {
    tzSelect.add(new Option(tz, tz));
  }
  setVal('pulse-form-timezone', tz);
  setVal('pulse-form-window', schedule?.updated_issue_window || 'today');
  setVal('pulse-form-state', schedule?.issue_state || 'all');
  syncGeminiModelSelect(
    getById<HTMLSelectElement>('pulse-form-model'),
    schedule?.preferred_model || DEFAULT_PULSE_LLM_MODEL,
    PULSE_LLM_MODEL_LIST,
  );
  setChecked('pulse-form-risks', schedule ? schedule.include_risks : true);
  setChecked('pulse-form-next', schedule ? schedule.include_next_steps : true);
  setChecked('pulse-form-links', schedule ? schedule.include_source_links : true);
  setChecked('pulse-form-rebuild', schedule ? schedule.rebuild_index_before_send : false);
  setVal(
    'pulse-form-instruction',
    normalizePulseInstruction(
      schedule?.custom_instruction ||
        pulseDefaultInstruction(schedule?.report_type || 'daily-briefing'),
      schedule?.report_type || 'daily-briefing',
    ),
  );

  const workdays = new Set(schedule?.workdays || [1, 2, 3, 4, 5]);
  document
    .querySelectorAll<HTMLInputElement>('#pulse-form-workdays input[data-workday]')
    .forEach((box) => {
      box.checked = workdays.has(Number(box.dataset.workday));
    });

  const webhook = getById<HTMLInputElement>('pulse-form-webhook');
  if (webhook) webhook.value = '';
  const status = getById<HTMLElement>('pulse-form-webhook-status');
  if (status) {
    status.textContent = schedule?.has_teams_webhook_url
      ? `已設定：${schedule.teams_webhook_url_masked}`
      : '尚未設定';
  }
  setChecked('pulse-form-webhook-clear', false);

  fillPulseRepoSelect(schedule);
}

function openPulseForm(schedule: PulseSchedule | null): void {
  fillPulseForm(schedule);
  pulseOverlay('pulse-form-overlay', true);
}

function closePulseForm(): void {
  pulseOverlay('pulse-form-overlay', false);
}

function splitCsv(value: string): string[] {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function readPulseForm(): Record<string, unknown> {
  const workdays: number[] = [];
  document
    .querySelectorAll<HTMLInputElement>('#pulse-form-workdays input[data-workday]')
    .forEach((box) => {
      if (box.checked) workdays.push(Number(box.dataset.workday));
    });

  const repoId = getById<HTMLSelectElement>('pulse-form-repo')?.value || '';
  const repo = pulseRepos.find((r) => r.repo_id === repoId);

  return {
    enabled: getById<HTMLInputElement>('pulse-form-enabled')?.checked ?? true,
    repo_id: repoId,
    repo_name: repo?.repo_name || '',
    provider: repo?.provider || '',
    name: getById<HTMLInputElement>('pulse-form-name')?.value.trim() || '每日 Issue 摘要',
    report_type: getById<HTMLSelectElement>('pulse-form-type')?.value || 'daily-briefing',
    custom_instruction: getById<HTMLTextAreaElement>('pulse-form-instruction')?.value || '',
    preferred_model:
      getById<HTMLSelectElement>('pulse-form-model')?.value || DEFAULT_PULSE_LLM_MODEL,
    send_time: getById<HTMLInputElement>('pulse-form-send-time')?.value || '18:30',
    timezone: getById<HTMLSelectElement>('pulse-form-timezone')?.value.trim() || 'Asia/Taipei',
    workdays,
    channel_type: 'teams-webhook',
    teams_webhook_url: getById<HTMLInputElement>('pulse-form-webhook')?.value.trim() || '',
    clear_teams_webhook_url:
      getById<HTMLInputElement>('pulse-form-webhook-clear')?.checked || false,
    updated_issue_window: getById<HTMLSelectElement>('pulse-form-window')?.value || 'today',
    issue_state: getById<HTMLSelectElement>('pulse-form-state')?.value || 'all',
    include_risks: getById<HTMLInputElement>('pulse-form-risks')?.checked || false,
    include_next_steps: getById<HTMLInputElement>('pulse-form-next')?.checked || false,
    include_source_links: getById<HTMLInputElement>('pulse-form-links')?.checked || false,
    rebuild_index_before_send: getById<HTMLInputElement>('pulse-form-rebuild')?.checked || false,
  };
}

function currentPulseFormId(): string {
  return getById<HTMLInputElement>('pulse-form-id')?.value || '';
}

async function savePulseForm(): Promise<void> {
  const payload = readPulseForm();
  if (!payload.repo_id) {
    showToast('專案脈搏', '請先選擇一個 Repo。', 'warn');
    return;
  }
  const id = currentPulseFormId();
  if (id) {
    await api<PulseSchedule>(`/api/project-pulse/schedules/${id}`, 'PUT', payload);
  } else {
    await api<PulseSchedule>('/api/project-pulse/schedules', 'POST', payload);
  }
  showToast('專案脈搏', '報告任務已儲存', 'success');
  closePulseForm();
  await loadPulse();
}

function restorePulseDefaultInstruction(): void {
  const type = getById<HTMLSelectElement>('pulse-form-type')?.value || 'daily-briefing';
  const textarea = getById<HTMLTextAreaElement>('pulse-form-instruction');
  if (textarea) textarea.value = pulseDefaultInstruction(type);
}

function openPulsePreview(report: PulseReport): void {
  const meta = getById<HTMLElement>('pulse-preview-meta');
  if (meta) {
    meta.innerHTML = renderPulsePreviewMeta(report);
  }
  const output = getById<HTMLTextAreaElement>('pulse-preview-output');
  if (output) output.value = report.message;
  pulseOverlay('pulse-preview-overlay', true);
}

async function previewPulse(scheduleId: string): Promise<void> {
  if (!scheduleId) {
    showToast('產生結果', '請先儲存任務再產生結果。', 'warn');
    return;
  }
  pulsePreviewAbort?.abort();
  const runId = pulsePreviewRunId + 1;
  pulsePreviewRunId = runId;
  const controller = new AbortController();
  pulsePreviewAbort = controller;
  // Open the modal with a loading state right away — generation uses the LLM and
  // can take a while, so the user needs immediate feedback.
  openPulsePreviewLoading('syncing');
  try {
    const res = await api<PulseReport & { job_id?: string }>(
      `/api/project-pulse/schedules/${scheduleId}/preview`,
      'POST',
      {},
      { signal: controller.signal },
    );
    if (runId !== pulsePreviewRunId || controller.signal.aborted) return;
    if (!res.job_id) {
      openPulsePreview(res);
      return;
    }
    // Async rebuild-then-generate: reflect live phase/progress in the modal.
    const job = await pollPulseJob(
      res.job_id,
      (j) => {
        if (runId !== pulsePreviewRunId || controller.signal.aborted) return;
        setPulsePreviewLoadingPhase(j.phase, j.progress);
      },
      controller.signal,
    );
    if (runId !== pulsePreviewRunId || controller.signal.aborted) return;
    if (job.status === 'failed' || !job.result) {
      setPulsePreviewError(job.error || '重建索引失敗。');
      showToast('產生結果', job.error || '重建索引失敗。', 'error');
      return;
    }
    openPulsePreview({
      ok: job.result.ok,
      schedule_id: scheduleId,
      repo_id: '',
      date: job.result.date,
      issue_count: job.result.issue_count,
      title: job.result.title,
      message: job.result.message,
      index_built_at: null,
      mode: job.result.mode,
      generated_at: job.result.generated_at,
      requested_model: job.result.requested_model,
      model: job.result.model,
    });
  } catch (err) {
    if (controller.signal.aborted) return;
    const message = err instanceof Error ? err.message : '產生失敗。';
    setPulsePreviewError(message);
    showToast('產生結果', message, 'error');
  } finally {
    if (pulsePreviewAbort === controller) {
      pulsePreviewAbort = null;
    }
  }
}

async function sendPulseNow(scheduleId: string): Promise<void> {
  if (!scheduleId) {
    showToast('立即發送', '請先儲存任務再發送。', 'warn');
    return;
  }
  // Immediate feedback in the row — the request runs the LLM (and possibly a
  // full reindex) before returning.
  setPulseRowBusy(scheduleId, '產生並發送中…');
  const res = await api<{
    ok?: boolean;
    message?: string;
    job_id?: string;
  }>(`/api/project-pulse/schedules/${scheduleId}/send-now`, 'POST', {});

  if (!res.job_id) {
    showToast('立即發送', res.message || '已送出', res.ok ? 'success' : 'error');
    await loadPulse();
    await loadPulseHistory();
    return;
  }

  // Async rebuild-then-send: close the form (if open) so the row's progress is
  // visible, then poll. The webhook only fires after the rebuild completes.
  closePulseForm();
  showToast('立即發送', '已開始重建索引，完成後才會發送到 Teams。', 'success');
  const job = await pollPulseJob(res.job_id, (j) => {
    setPulseRowBusy(scheduleId, pulsePhaseLabel(j));
  });
  if (job.status === 'failed' || !job.result) {
    showToast('立即發送', job.error || '處理失敗。', 'error');
  } else {
    const sentOk = job.result.sent_ok;
    showToast(
      '立即發送',
      sentOk ? '報告已發送到 Teams。' : job.result.sent_error || '發送失敗。',
      sentOk ? 'success' : 'error',
    );
  }
  await loadPulse();
  await loadPulseHistory();
}

async function testPulseWebhook(scheduleId: string): Promise<void> {
  if (!scheduleId) {
    showToast('測試 Webhook', '請先儲存任務再測試 Webhook。', 'warn');
    return;
  }
  const result = await api<{ ok: boolean; message: string }>(
    `/api/project-pulse/schedules/${scheduleId}/test-webhook`,
    'POST',
    {},
  );
  showToast('測試 Webhook', result.message, result.ok ? 'success' : 'error');
  await loadPulseHistory();
}

function pulsePayloadFrom(
  schedule: PulseSchedule,
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    enabled: schedule.enabled,
    repo_id: schedule.repo_id,
    repo_name: schedule.repo_name,
    provider: schedule.provider,
    name: schedule.name,
    report_type: schedule.report_type,
    custom_instruction: schedule.custom_instruction,
    send_time: schedule.send_time,
    timezone: schedule.timezone,
    workdays: schedule.workdays,
    channel_type: 'teams-webhook',
    teams_webhook_url: '', // keep the stored webhook
    clear_teams_webhook_url: false,
    updated_issue_window: schedule.updated_issue_window,
    issue_state: schedule.issue_state,
    labels: schedule.labels,
    assignees: schedule.assignees,
    include_risks: schedule.include_risks,
    include_next_steps: schedule.include_next_steps,
    include_source_links: schedule.include_source_links,
    rebuild_index_before_send: schedule.rebuild_index_before_send,
    ...overrides,
  };
}

async function togglePulseSchedule(schedule: PulseSchedule): Promise<void> {
  await api<PulseSchedule>(
    `/api/project-pulse/schedules/${schedule.id}`,
    'PUT',
    pulsePayloadFrom(schedule, { enabled: !schedule.enabled }),
  );
  showToast('專案脈搏', schedule.enabled ? '任務已暫停' : '任務已啟用', 'success');
  await loadPulse();
}

async function deletePulseSchedule(schedule: PulseSchedule): Promise<void> {
  if (!window.confirm(`確定要刪除報告任務「${schedule.name}」？`)) return;
  await api<{ ok: boolean }>(`/api/project-pulse/schedules/${schedule.id}`, 'DELETE');
  showToast('專案脈搏', '報告任務已刪除', 'success');
  await loadPulse();
}

async function copyPulseReport(): Promise<void> {
  const output = getById<HTMLTextAreaElement>('pulse-preview-output');
  if (!output || !output.value) return;
  try {
    await navigator.clipboard.writeText(output.value);
    showToast('複製報告', '已複製到剪貼簿', 'success');
  } catch {
    output.select();
    document.execCommand('copy');
    showToast('複製報告', '已複製到剪貼簿', 'success');
  }
}

function handlePulseRowAction(event: Event): void {
  const target = event.target as HTMLElement;
  const button = target.closest<HTMLButtonElement>('[data-pulse-action]');
  if (!button) return;
  const row = button.closest<HTMLElement>('[data-pulse-id]');
  const id = row?.dataset.pulseId || '';
  const schedule = pulseSchedules.find((s) => s.id === id);
  if (!schedule) return;
  const action = button.dataset.pulseAction;
  if (action === 'edit') openPulseForm(schedule);
  else if (action === 'preview') void previewPulse(id).catch(handleError);
  else if (action === 'send') void sendPulseNow(id).catch(handleError);
  else if (action === 'test') void testPulseWebhook(id).catch(handleError);
  else if (action === 'toggle') void togglePulseSchedule(schedule).catch(handleError);
  else if (action === 'delete') void deletePulseSchedule(schedule).catch(handleError);
}

async function loadPulseHistory(): Promise<void> {
  const container = getById<HTMLElement>('pulse-history');
  if (!container) return;
  const data = await api<{ items: PulseHistoryItem[] }>('/api/project-pulse/history');
  const items = data.items || [];
  if (!items.length) {
    container.innerHTML = '<div class="briefing-history-empty">尚無執行紀錄。</div>';
    return;
  }
  container.innerHTML = items
    .map((item) => {
      const when = fmtDate(item.finished_at || item.started_at);
      const repo = item.repo_name || item.repo_id || '—';
      const runType = pulseRunTypeLabel(item.run_type);
      const detail = item.ok
        ? `${repo}・${runType}・${item.issue_count} 件`
        : `${repo}・${runType}・${escapeHtml(item.error_message || '失敗')}`;
      return `
        <div class="briefing-history-row">
          <span class="dot ${item.ok ? 'ok' : 'fail'}"></span>
          <span>${escapeHtml(when)}</span>
          <span class="meta">${escapeHtml(detail)}</span>
        </div>`;
    })
    .join('');
}

async function loadProjectPulseView(): Promise<void> {
  await loadPulseRepos().catch(() => {
    pulseRepos = [];
  });
  await loadPulse();
  await loadPulseHistory();
}

async function loadAllIssues(): Promise<void> {
  const issues = await api<IssueItem[]>('/api/issues');
  state.allIssues = issues;
  await refreshRagIndexAvailability();
  const activeProvider = state.currentConfig?.active_provider || 'gitlab';
  const activeConnection = state.currentConfig?.connections[activeProvider];
  if (
    state.allIssues.length > 0 &&
    (activeProvider !== 'github' || Boolean(activeConnection?.token_configured))
  ) {
    void startRagRebuild();
  }
  state.mergeRequestsByIid.clear();
  state.issueLinksByIid.clear();
  state.pendingMergeRequestLoads.clear();
  state.pendingIssueLinkLoads.clear();
  populateGanttFiltersEnhanced(issues);
  populateTableFilters(issues);
  renderRecentIssues();
}

function renderDashboardData(data: DashboardResponse): void {
  renderSummary(data);
  renderNewIssues(data.weekly_new);
  renderCards('focus-progress', data.focus_progress, '本週暫無特別標記的重點推進。');
  renderCards('risk-blockers', data.risks, '目前沒有明顯風險或阻塞。');
  byId<HTMLElement>('last-sync').textContent = fmtDate(data.last_sync);
  byId<HTMLElement>('issue-count').textContent = String(data.issue_count ?? 0);
}

async function loadDashboard(): Promise<void> {
  setStatus('刷新儀表板中...');
  const data = await api<DashboardResponse>('/api/dashboard');
  renderDashboardData(data);
  await loadAllIssues();
  await loadAnalytics();
  setStatus('儀表板已更新', 'success');
}

async function syncNow(): Promise<void> {
  setStatus(`同步中…（從 ${providerLabel()} 抓取，請稍候）`);
  setActionButtonsEnabled(false);
  try {
    await saveConfig();
    await api('/api/fetch', 'POST', {});
    await loadDashboard();
    setStatus('同步完成', 'success');
  } finally {
    setActionButtonsEnabled(true);
  }
}

function renderIssueDeliverySummary(
  issue: IssueItem,
  overrides?: { linkedCount?: number; mergeRequestCount?: number },
): void {
  const container = byId<HTMLDivElement>('detail-delivery');
  const linkedCount = overrides?.linkedCount ?? getLinkedItemCount(issue);
  const mergeRequestCount = overrides?.mergeRequestCount ?? getResolvedMergeRequestCount(issue);
  const highlight = getDeliveryHighlight(issue);
  const dueDate = startOfDay(issue.due_date);
  const isOverdue =
    issue.state !== 'closed' && !!dueDate && dueDate < (startOfDay(new Date()) as Date);
  const cards = [
    { kind: highlight.kind, label: highlight.label, value: highlight.value },
    {
      kind: 'review',
      label: issue.provider === 'github' ? '相關 PRs' : '相關 MRs',
      value:
        issue.relation_counts_known || mergeRequestCount > 0
          ? String(mergeRequestCount)
          : '詳情載入',
    },
    { kind: 'ready', label: '相關 Issues', value: String(linkedCount) },
  ];
  const primaryStatusLabel =
    issue.state === 'closed'
      ? '已關閉'
      : isOverdue
        ? '逾期'
        : mergeRequestCount > 0
          ? '進行中'
          : '開啟中';
  const primaryStatusClass =
    issue.state === 'closed'
      ? 'closed'
      : isOverdue
        ? 'overdue'
        : mergeRequestCount > 0
          ? 'review'
          : 'open';
  const chips = [
    `<span class="detail-chip ${primaryStatusClass}">${primaryStatusLabel}</span>`,
    mergeRequestCount > 0
      ? `<span class="detail-chip review">${issue.provider === 'github' ? 'PR' : 'MR'} ${mergeRequestCount}</span>`
      : '',
    linkedCount > 0 ? `<span class="detail-chip related">Linked ${linkedCount}</span>` : '',
  ]
    .filter(Boolean)
    .join('');

  container.innerHTML = `
    <div class="detail-delivery-grid">
      ${cards
        .map(
          (card) => `
        <div class="detail-delivery-card ${card.kind}">
          <span>${card.label}</span>
          <strong>${card.value}</strong>
        </div>
      `,
        )
        .join('')}
    </div>
    ${chips ? `<div class="detail-delivery-progress"><div class="detail-chip-row">${chips}</div></div>` : ''}
  `;
}

function renderDiscussions(target: HTMLDivElement, discussions: Discussion[]): void {
  const nonEmpty = discussions.filter((discussion) => discussion.notes.length > 0);
  if (!nonEmpty.length) {
    target.innerHTML = '<div class="empty-state">此 Issue 尚無討論留言。</div>';
    return;
  }

  target.innerHTML = nonEmpty
    .map((discussion) => {
      const isThread = discussion.notes.length > 1;
      return `
        <div
          class="discussion-thread ${isThread ? 'has-replies' : ''}"
          data-discussion-id="${escapeHtml(String(discussion.id || ''))}"
        >
          ${discussion.notes
            .map(
              (note, index) => `
            <div
              class="discussion-note ${index > 0 ? 'reply' : 'root'}"
              data-note-id="${escapeHtml(String(note.id || ''))}"
            >
              <div class="note-avatar" title="${escapeHtml(note.author_name)}">
                ${
                  note.author_avatar_url
                    ? `<img src="${escapeHtml(note.author_avatar_url)}" alt="" />`
                    : `<span>${escapeHtml(note.author_name.charAt(0).toUpperCase())}</span>`
                }
              </div>
              <div class="note-content">
                <div class="note-header">
                  <strong class="note-author">${escapeHtml(note.author_name)}</strong>
                  <span class="note-username">@${escapeHtml(note.author_username)}</span>
                  <time class="note-time">${fmtDate(note.created_at)}</time>
                </div>
                <div class="note-body">${formatDiscussionMarkdown(note.body)}</div>
              </div>
            </div>
          `,
            )
            .join('')}
        </div>
      `;
    })
    .join('');

  applyPendingDiscussionJump(target);
}

function applyPendingDiscussionJump(container: HTMLElement): void {
  const jump = state.pendingDiscussionJump;
  if (!jump) return;

  const allNotes = Array.from(container.querySelectorAll<HTMLElement>('.discussion-note'));
  const allThreads = Array.from(container.querySelectorAll<HTMLElement>('.discussion-thread'));

  allNotes.forEach((el) => el.classList.remove('rag-evidence-hit'));
  allThreads.forEach((el) => el.classList.remove('rag-evidence-hit'));

  let targetEl: HTMLElement | null = null;

  if (jump.note_ids?.length) {
    for (const noteId of jump.note_ids) {
      const noteEl = container.querySelector<HTMLElement>(
        `.discussion-note[data-note-id="${noteId}"]`,
      );
      if (noteEl) {
        noteEl.classList.add('rag-evidence-hit');
        targetEl = targetEl || noteEl;
      }
    }
  }

  if (!targetEl && jump.discussion_id) {
    const threadEl = container.querySelector<HTMLElement>(
      `.discussion-thread[data-discussion-id="${jump.discussion_id}"]`,
    );
    if (threadEl) {
      threadEl.classList.add('rag-evidence-hit');
      targetEl = threadEl;
    }
  }

  if (targetEl) {
    targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    window.setTimeout(() => {
      targetEl?.classList.remove('rag-evidence-hit');
      allNotes.forEach((el) => el.classList.remove('rag-evidence-hit'));
      allThreads.forEach((el) => el.classList.remove('rag-evidence-hit'));
    }, 3500);
  }

  state.pendingDiscussionJump = null;
}

function renderMergeRequests(target: HTMLDivElement, mergeRequests: MergeRequestInfo[]): void {
  if (!mergeRequests.length) {
    target.innerHTML = '<div class="empty-state">這張 Issue 目前沒有 linked change。</div>';
    return;
  }
  target.innerHTML = mergeRequests
    .map(
      (mr) => `
    <div class="mr-card">
      <div class="mr-card-header">
        <div class="mr-card-title">
          <span class="state-badge ${escapeHtml(mr.state || 'opened')}">${escapeHtml(mr.state || 'opened')}</span>
          <a href="${escapeHtml(mr.web_url || '#')}" target="_blank" rel="noreferrer">${mr.kind === 'pull_request' ? '#' : '!'}${mr.iid} ${escapeHtml(mr.title)}</a>
          ${mr.draft ? '<span class="detail-chip blocked">Draft</span>' : ''}
        </div>
      </div>
      <div class="mr-card-meta">
        <span>Author: ${escapeHtml(mr.author_name || '-')}</span>
        <span>Updated: ${escapeHtml(fmtDate(mr.updated_at))}</span>
        <span>Pipeline: ${escapeHtml(mr.head_pipeline_status || '-')}</span>
        <span>${escapeHtml(mr.source_branch || '-')} → ${escapeHtml(mr.target_branch || '-')}</span>
      </div>
    </div>
  `,
    )
    .join('');
}

function renderLinkedItems(target: HTMLDivElement, links: LinkedItemInfo[]): void {
  if (!links.length) {
    target.innerHTML = '<div class="empty-state">這張 Issue 目前沒有 linked items。</div>';
    return;
  }
  target.innerHTML = links
    .map(
      (link) => `
    <div class="linked-item-card">
      <div class="linked-item-header">
        <div class="linked-item-title">
          <span class="detail-chip ${link.link_type === 'blocks' || link.link_type === 'is_blocked_by' ? 'blocked' : 'related'}">${escapeHtml(getIssueLinkTypeLabel(link.link_type, link.direction))}</span>
          <a href="${escapeHtml(link.issue.web_url || '#')}" target="_blank" rel="noreferrer">${link.issue.iid ? `#${link.issue.iid}` : 'Linked Issue'} ${escapeHtml(link.issue.title || '')}</a>
        </div>
        <span class="state-badge ${escapeHtml(link.issue.state || 'opened')}">${escapeHtml(link.issue.state || 'opened')}</span>
      </div>
      <div class="linked-item-meta">
        <span>Assignee: ${escapeHtml((link.issue.assignees || []).join(', ') || '-')}</span>
        <span>Milestone: ${escapeHtml(link.issue.milestone || '-')}</span>
        <span>Due: ${escapeHtml(fmtDate(link.issue.due_date))}</span>
      </div>
    </div>
  `,
    )
    .join('');
}

async function loadIssueRelations(issue: IssueItem): Promise<void> {
  const mergeTarget = byId<HTMLDivElement>('detail-merge-requests');
  const linksTarget = byId<HTMLDivElement>('detail-linked-items');
  mergeTarget.innerHTML = `<div class="empty-state">載入 linked ${issue.provider === 'github' ? 'PR' : 'MR'} 中...</div>`;
  linksTarget.innerHTML = '<div class="empty-state">載入 linked items 中...</div>';

  const mergeRequestsPromise = state.mergeRequestsByIid.has(issue.iid)
    ? Promise.resolve(state.mergeRequestsByIid.get(issue.iid) || [])
    : api<MergeRequestInfo[]>(`/api/issues/${issue.iid}/merge-requests`);
  const linksPromise = state.issueLinksByIid.has(issue.iid)
    ? Promise.resolve(state.issueLinksByIid.get(issue.iid) || [])
    : api<LinkedItemInfo[]>(`/api/issues/${issue.iid}/links`);

  const [mergeResult, linkResult] = await Promise.allSettled([mergeRequestsPromise, linksPromise]);

  if (mergeResult.status === 'fulfilled') {
    state.mergeRequestsByIid.set(issue.iid, mergeResult.value);
    renderMergeRequests(mergeTarget, mergeResult.value);
  } else {
    mergeTarget.innerHTML = '<div class="empty-state">Linked MR 資訊載入失敗。</div>';
  }

  if (linkResult.status === 'fulfilled') {
    state.issueLinksByIid.set(issue.iid, linkResult.value);
    renderLinkedItems(linksTarget, linkResult.value);
    scheduleGanttRender(state.allIssues);
  } else {
    linksTarget.innerHTML = '<div class="empty-state">Linked items 資訊載入失敗。</div>';
  }

  renderIssueDeliverySummary(issue);
}

function prepareIssueDetailOverlay(issue: IssueItem): {
  discussionsDiv: HTMLDivElement;
  mergeTarget: HTMLDivElement;
  linksTarget: HTMLDivElement;
  summaryBtn: HTMLButtonElement;
  summaryBox: HTMLDivElement;
} {
  const overlay = byId<HTMLDivElement>('issue-detail-overlay');
  byId<HTMLElement>('detail-iid').textContent = `#${issue.iid}`;

  const stateBadge = byId<HTMLElement>('detail-state');
  stateBadge.textContent = issue.state === 'opened' ? '開啟中' : '已關閉';
  stateBadge.className = `state-badge ${issue.state}`;

  byId<HTMLElement>('detail-title').textContent = issue.title;
  byId<HTMLElement>('detail-assignees').textContent = (issue.assignees || []).join(', ') || '-';
  byId<HTMLElement>('detail-milestone').textContent = issue.milestone ?? '-';
  byId<HTMLElement>('detail-module').textContent = issue.module ?? '-';
  byId<HTMLElement>('detail-created').textContent = fmtDate(issue.created_at);
  byId<HTMLElement>('detail-updated').textContent = fmtDate(issue.updated_at);
  byId<HTMLElement>('detail-due').textContent = issue.due_date ? fmtDate(issue.due_date) : '-';
  if (issue.provider === 'github' && !issue.due_date) {
    byId<HTMLElement>('detail-due').textContent = 'GitHub 未提供';
  }

  const labelsDiv = byId<HTMLDivElement>('detail-labels');
  labelsDiv.innerHTML = (issue.labels || [])
    .map((label) => `<span class="tag">${escapeHtml(label)}</span>`)
    .join('');

  const link = byId<HTMLAnchorElement>('detail-link');
  link.textContent = `前往 ${issue.provider === 'github' ? 'GitHub' : 'GitLab'}`;
  const changeTitle = getById<HTMLElement>('detail-related-change-title');
  if (changeTitle) changeTitle.textContent = issue.provider === 'github' ? '相關 PRs' : '相關 MRs';
  if (issue.web_url) {
    link.href = issue.web_url;
    link.style.display = '';
  } else {
    link.style.display = 'none';
  }

  const discussionsDiv = byId<HTMLDivElement>('detail-discussions');
  const mergeTarget = byId<HTMLDivElement>('detail-merge-requests');
  const linksTarget = byId<HTMLDivElement>('detail-linked-items');
  const summaryBtn = byId<HTMLButtonElement>('btn-ai-summary');
  const summaryBox = byId<HTMLDivElement>('ai-summary-box');
  summaryBox.style.display = 'none';
  summaryBox.innerHTML = '';

  overlay.classList.add('open');
  document.body.classList.add('detail-open');
  document.body.style.overflow = 'hidden';

  return { discussionsDiv, mergeTarget, linksTarget, summaryBtn, summaryBox };
}

function wireIssueSummaryButton(
  summaryBtn: HTMLButtonElement,
  summaryBox: HTMLDivElement,
  options: { iid?: number; enabled?: boolean; disabledTitle?: string },
): void {
  const newBtn = summaryBtn.cloneNode(true) as HTMLButtonElement;
  summaryBtn.replaceWith(newBtn);

  if (options.enabled === false || options.iid == null) {
    newBtn.disabled = true;
    newBtn.title = options.disabledTitle || '此 Issue 目前無法使用 AI 摘要。';
    return;
  }

  newBtn.disabled = false;
  newBtn.title = '使用 AI 摘要';
  newBtn.addEventListener('click', () => loadAISummary(options.iid as number, newBtn, summaryBox));
}

function requestIssueLinkDataForVisibleIssues(issues: IssueItem[]): void {
  if ((state.currentConfig?.active_provider || 'gitlab') === 'github') return;
  const issuesForLinks = issues
    .filter(
      (issue) =>
        !state.issueLinksByIid.has(issue.iid) && !state.pendingIssueLinkLoads.has(issue.iid),
    )
    .slice(0, 24);
  const issuesForMergeRequests = issues
    .filter(
      (issue) =>
        !state.mergeRequestsByIid.has(issue.iid) && !state.pendingMergeRequestLoads.has(issue.iid),
    )
    .slice(0, 24);

  if (!issuesForLinks.length && !issuesForMergeRequests.length) return;

  issuesForLinks.forEach((issue) => state.pendingIssueLinkLoads.add(issue.iid));
  issuesForMergeRequests.forEach((issue) => state.pendingMergeRequestLoads.add(issue.iid));

  const requests: Promise<unknown>[] = [];

  if (issuesForLinks.length) {
    requests.push(
      Promise.allSettled(
        issuesForLinks.map(async (issue) => {
          try {
            const links = await api<LinkedItemInfo[]>(`/api/issues/${issue.iid}/links`);
            state.issueLinksByIid.set(issue.iid, links);
          } catch {
            state.issueLinksByIid.set(issue.iid, []);
          } finally {
            state.pendingIssueLinkLoads.delete(issue.iid);
          }
        }),
      ),
    );
  }

  if (issuesForMergeRequests.length) {
    requests.push(
      Promise.allSettled(
        issuesForMergeRequests.map(async (issue) => {
          try {
            const mergeRequests = await api<MergeRequestInfo[]>(
              `/api/issues/${issue.iid}/merge-requests`,
            );
            state.mergeRequestsByIid.set(issue.iid, mergeRequests);
          } catch {
            state.mergeRequestsByIid.set(issue.iid, []);
          } finally {
            state.pendingMergeRequestLoads.delete(issue.iid);
          }
        }),
      ),
    );
  }

  void Promise.allSettled(requests).then(() => scheduleGanttRender(state.allIssues));
}

/* ══════════════════════════════════════════════
   ISSUE DETAIL PANEL
   ══════════════════════════════════════════════ */
function openIssueDetail(issue: IssueItem): void {
  const { discussionsDiv, summaryBtn, summaryBox } = prepareIssueDetailOverlay(issue);
  renderIssueDeliverySummary(issue);
  discussionsDiv.innerHTML = '<div class="empty-state">載入討論中...</div>';
  void loadDiscussions(issue.iid, discussionsDiv);
  void loadIssueRelations(issue);
  wireIssueSummaryButton(summaryBtn, summaryBox, { iid: issue.iid });
}

function openIssueDetailWithBundle(bundle: IssueDetailBundle): void {
  const { issue, discussions, merge_requests, links } = bundle;
  const { discussionsDiv, mergeTarget, linksTarget, summaryBtn, summaryBox } =
    prepareIssueDetailOverlay(issue);

  renderDiscussions(discussionsDiv, discussions);
  renderMergeRequests(mergeTarget, merge_requests);
  renderLinkedItems(linksTarget, links);
  renderIssueDeliverySummary(issue, {
    linkedCount: links.length,
    mergeRequestCount: merge_requests.length,
  });
  wireIssueSummaryButton(summaryBtn, summaryBox, {
    enabled: false,
    disabledTitle: 'AI 摘要目前僅支援目前設定專案的 Issue。',
  });
}

function closeIssueDetail(): void {
  const overlay = byId<HTMLDivElement>('issue-detail-overlay');
  overlay.classList.remove('open');
  document.body.classList.remove('detail-open');
  document.body.style.overflow = '';
}

async function loadAISummary(
  iid: number,
  btn: HTMLButtonElement,
  box: HTMLDivElement,
): Promise<void> {
  btn.disabled = true;
  btn.textContent = '⏳ 摘要產生中...';
  box.style.display = 'block';
  box.innerHTML = '<div class="ai-summary-loading">正在呼叫 Gemini AI 產生摘要，請稍候...</div>';
  try {
    const result = await api<{ summary: string }>(`/api/issues/${iid}/discussions/summary`, 'POST');
    box.innerHTML = `<div class="ai-summary-content">${formatSummaryMarkdown(result.summary)}</div>`;
  } catch (err: any) {
    const msg = err?.message || '未知錯誤';
    box.innerHTML = `<div class="ai-summary-error">摘要產生失敗：${escapeHtml(msg)}</div>`;
  } finally {
    btn.disabled = false;
    btn.textContent = '✨ AI 摘要';
  }
}

function formatSummaryMarkdown(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/^### (.+)$/gm, '<h4>$1</h4>')
    .replace(/^## (.+)$/gm, '<h3 class="ai-heading">$1</h3>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/^(\d+)\. (.+)$/gm, '<li><strong>$1.</strong> $2</li>')
    .replace(/(<li>.*<\/li>\n?)+/g, (match) => `<ul>${match}</ul>`)
    .replace(/\n{2,}/g, '<br/><br/>')
    .replace(/\n/g, '<br/>');
}

async function loadDiscussions(iid: number, container: HTMLDivElement): Promise<void> {
  try {
    const discussions = await api<Discussion[]>(`/api/issues/${iid}/discussions`);
    renderDiscussions(container, discussions);
  } catch (err: any) {
    const msg = err?.message || '';
    if (msg.includes('401') || msg.includes('invalid_token') || msg.includes('revoked')) {
      container.innerHTML =
        '<div class="empty-state">Token 已失效或被撤銷，請重新產生 Personal Access Token。</div>';
    } else {
      container.innerHTML =
        '<div class="empty-state">無法載入討論（請確認 provider 連線設定）。</div>';
    }
  }
}

/* ══════════════════════════════════════════════
   COLUMN RESIZE
   ══════════════════════════════════════════════ */
function initColumnResize(): void {
  const table = document.querySelector('.spreadsheet-wrap table') as HTMLTableElement | null;
  if (!table) return;

  const ths = table.querySelectorAll<HTMLTableCellElement>('thead th');
  ths.forEach((th) => {
    // Skip row-number header
    if (th.classList.contains('row-num-header')) return;

    const handle = document.createElement('div');
    handle.className = 'col-resize-handle';
    th.appendChild(handle);

    let startX = 0;
    let startW = 0;

    const onMouseMove = (e: MouseEvent) => {
      const newW = Math.max(40, startW + (e.clientX - startX));
      th.style.width = newW + 'px';
    };

    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    handle.addEventListener('mousedown', (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      startX = e.clientX;
      startW = th.offsetWidth;
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    });
  });
}

/* ══════════════════════════════════════════════
   AI CHAT PANEL
   ══════════════════════════════════════════════ */
const chatHistory: { role: string; content: string }[] = [];

// The chat lives in a single DOM node (#chat-surface) that is physically moved
// between the floating dock and the full assistant page, so the conversation and
// all listeners persist across both surfaces with no duplicated markup.
function mountChatSurfaceTo(containerId: string): void {
  const surface = document.getElementById('chat-surface');
  const container = document.getElementById(containerId);
  if (surface && container && surface.parentElement !== container) {
    container.appendChild(surface);
  }
}

function updateChatLauncherVisibility(): void {
  const hidden = state.currentView === 'assistant' || state.chatDockOpen;
  getById<HTMLElement>('chat-fab')?.classList.toggle('hidden', hidden);
}

function openChatDock(): void {
  mountChatSurfaceTo('chat-dock-body');
  getById<HTMLElement>('chat-dock')?.classList.add('open');
  state.chatDockOpen = true;
  updateChatLauncherVisibility();
  renderRagStatusBadge();
  renderRagQuestionState();
  const input = getById<HTMLInputElement>('chat-input');
  if (input && !input.disabled) {
    window.setTimeout(() => input.focus(), 0);
  }
}

function closeChatDock(): void {
  mountChatSurfaceTo('assistant-mount');
  getById<HTMLElement>('chat-dock')?.classList.remove('open');
  state.chatDockOpen = false;
  updateChatLauncherVisibility();
  renderRagStatusBadge();
}

function expandChatToPage(): void {
  // Reclaim the surface into the page, then switch to the assistant view.
  getById<HTMLElement>('chat-dock')?.classList.remove('open');
  state.chatDockOpen = false;
  setActiveView('assistant');
}

function initChat(): void {
  const fab = document.getElementById('chat-fab');
  const clearBtn = document.getElementById('chat-clear');
  const input = document.getElementById('chat-input') as HTMLInputElement | null;
  const sendBtn = document.getElementById('chat-send');

  if (!input || !sendBtn || !clearBtn) return;

  // FAB opens the floating dock; the dock can expand into the full assistant page.
  fab?.addEventListener('click', () => openChatDock());
  document.getElementById('chat-expand')?.addEventListener('click', () => expandChatToPage());
  document.getElementById('chat-dock-close')?.addEventListener('click', () => closeChatDock());

  clearBtn.addEventListener('click', () => {
    chatHistory.length = 0;
    const msgs = document.getElementById('chat-messages');
    if (msgs) {
      msgs.innerHTML = `
        <div class="chat-msg assistant">
          <div class="chat-msg-content">對話已清除。有什麼想問的嗎？
            <div class="chat-suggestions">
              <button class="chat-suggestion-btn">這週最危險的是什麼？</button>
              <button class="chat-suggestion-btn">誰的 issue 最久沒動？</button>
              <button class="chat-suggestion-btn">目前逾期的 issue 有哪些？</button>
              <button class="chat-suggestion-btn">各模組負責人的工作量？</button>
            </div>
          </div>
        </div>`;
      wireSuggestionBtns(msgs);
      renderRagQuestionState();
    }
  });

  sendBtn.addEventListener('click', () => sendChatMessage(input));
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendChatMessage(input);
    }
  });

  const modeGroup = document.getElementById('chat-retrieval-mode');
  if (modeGroup) {
    modeGroup.querySelectorAll<HTMLButtonElement>('.chat-mode-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        updateRetrievalModePreference(
          (btn.dataset.mode as RetrievalMode) || DEFAULT_RETRIEVAL_MODE,
        );
      });
    });
  }
  syncRetrievalModeSegmented();

  const msgs = document.getElementById('chat-messages');
  if (msgs) wireSuggestionBtns(msgs);
  renderRagQuestionState();
}

function wireSuggestionBtns(container: HTMLElement): void {
  container.querySelectorAll('.chat-suggestion-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const input = document.getElementById('chat-input') as HTMLInputElement;
      if (input) {
        input.value = btn.textContent || '';
        sendChatMessage(input);
      }
    });
  });
}

function isRagQuestionLocked(): boolean {
  // Never hard-lock the chat: without a usable index we still answer via the
  // Issue-list fallback, so the user can always ask.
  return false;
}

function getRagQuestionNotice(): {
  tone: 'pending' | 'syncing' | 'fallback';
  title: string;
  body: string;
} | null {
  if (!state.ragUi.statusChecked) {
    return {
      tone: 'pending',
      title: '知識索引準備中',
      body: '正在確認 RAG 索引狀態，你仍可直接提問。',
    };
  }

  if (!state.ragUi.hasUsableIndex && state.ragUi.rebuildFailedWithoutIndex) {
    return {
      tone: 'fallback',
      title: '索引暫時不可用',
      body: '目前使用 Issue 清單模式，留言索引建立後會更準。',
    };
  }

  if (!state.ragUi.hasUsableIndex) {
    return {
      tone: 'fallback',
      title: state.ragUi.rebuilding ? '正在建立知識索引' : '尚未建立留言索引',
      body: state.ragUi.rebuilding
        ? `目前使用 Issue 清單模式回答，待索引完成後（${Math.round(
            state.ragUi.rebuildProgress,
          )}%）會包含更多 Issue 細節，回答會更準確。`
        : '目前使用 Issue 清單模式，留言索引建立後會更準。',
    };
  }

  if (state.ragUi.rebuilding) {
    return {
      tone: 'syncing',
      title: '正在同步最新索引',
      body: '你可以先繼續提問，回答會先依目前可用索引產生。',
    };
  }

  return null;
}

function renderRagQuestionState(): void {
  const panel = getById<HTMLElement>('chat-surface');
  const notice = getById<HTMLElement>('chat-rag-state');
  const input = getById<HTMLInputElement>('chat-input');
  const sendBtn = getById<HTMLButtonElement>('chat-send');
  if (!panel || !notice || !input || !sendBtn) return;

  const locked = isRagQuestionLocked();
  const hint = getRagQuestionNotice();
  const isSending = sendBtn.dataset.busy === 'true';

  panel.classList.toggle('chat-surface-rag-locked', locked);
  notice.className = hint ? `chat-rag-state ${hint.tone} is-visible` : 'chat-rag-state';
  notice.innerHTML = hint
    ? `
      <div class="chat-rag-state__card">
        <strong>${escapeHtml(hint.title)}</strong>
        <span>${escapeHtml(hint.body)}</span>
      </div>`
    : '';

  input.disabled = locked;
  input.placeholder = locked ? '知識索引建立完成後即可提問' : '想問哪一筆 Issue、風險或進度？';
  sendBtn.disabled = locked || isSending;

  panel.querySelectorAll<HTMLButtonElement>('.chat-suggestion-btn').forEach((btn) => {
    btn.disabled = locked;
  });

  if (locked && document.activeElement === input) {
    input.blur();
  }
}

function chatSourceTypeLabel(sourceType: string): string {
  switch (sourceType) {
    case 'discussion':
      return '留言';
    case 'related_change':
      return 'MR';
    case 'issue_link':
      return '關聯';
    default:
      return '';
  }
}

// When the model answers that it can't conclude from the retrieved Sources
// (insufficient info / out-of-scope), the source chips are misleading: they
// imply those issues backed an answer that was never actually given. Detect
// those replies so we can suppress the "來源依據" block for them.
const INCONCLUSIVE_ANSWER_RE =
  /資訊不足|資料不足|內容不足|無法得知|無法回答|無法判斷|無法回應|找不到(相關|對應)|沒有(相關|足夠)|不足以(完整)?判斷|只(能|負責).{0,6}Issue/;

function isInconclusiveAnswer(answer?: string): boolean {
  return INCONCLUSIVE_ANSWER_RE.test(answer || '');
}

function renderChatSources(sources?: ChatSource[]): string {
  if (!sources?.length) return '';

  const items = sources
    .slice(0, 6)
    .map((source, index) => {
      const discussionId = source.discussion_id ? String(source.discussion_id) : '';
      const noteIds = JSON.stringify(source.note_ids || []);
      const webUrl = source.web_url ? String(source.web_url) : '';
      const typeLabel = chatSourceTypeLabel(source.source_type);
      return `
        <button
          class="chat-source-ref"
          type="button"
          data-iid="${source.issue_iid}"
          data-discussion-id="${escapeHtml(discussionId)}"
          data-note-ids='${escapeHtml(noteIds)}'
          data-url="${escapeHtml(webUrl)}"
          title="${escapeHtml(source.title || '')}"
        >
          <span class="chat-source-num">${index + 1}</span>
          <span class="chat-source-id">#${source.issue_iid}</span>
          ${typeLabel ? `<span class="chat-source-type">${typeLabel}</span>` : ''}
        </button>`;
    })
    .join('');

  return `
    <div class="chat-msg-sources" style="margin-top:10px;">
      <div class="chat-msg-meta">來源依據</div>
      <div>${items}</div>
    </div>`;
}

async function sendChatMessage(input: HTMLInputElement): Promise<void> {
  if (isRagQuestionLocked()) return;

  const question = input.value.trim();
  if (!question) return;

  const msgs = document.getElementById('chat-messages');
  const sendBtn = document.getElementById('chat-send') as HTMLButtonElement | null;
  if (!msgs || !sendBtn) return;

  input.value = '';
  sendBtn.dataset.busy = 'true';
  renderRagQuestionState();
  chatHistory.push({ role: 'user', content: question });
  appendChatMsg(msgs, 'user', escapeHtml(question));

  const typingEl = document.createElement('div');
  typingEl.className = 'chat-msg assistant';
  typingEl.innerHTML = `
    <div class="chat-typing">
      <span class="chat-typing-dot"></span>
      <span class="chat-typing-dot"></span>
      <span class="chat-typing-dot"></span>
    </div>`;
  msgs.appendChild(typingEl);
  msgs.scrollTop = msgs.scrollHeight;

  const requestedModel = state.uiPreferences.chatRagModel;
  try {
    const result = await api<ChatResponse>('/api/chat', 'POST', {
      question,
      history: chatHistory.slice(0, -1),
      preferred_model: requestedModel,
      model_candidates: CHAT_RAG_GEMINI_MODEL_LIST,
      use_rag: true,
      top_k: 6,
      retrieval_mode: state.uiPreferences.retrievalMode,
    });

    chatHistory.push({ role: 'assistant', content: result.answer });
    typingEl.remove();

    const isContextTrace = result.retrieval_mode === 'context-trace';
    const formattedAnswer = isContextTrace
      ? formatContextTraceAnswer(result.answer)
      : formatChatAnswer(result.answer);

    // For a fast-rag/issue-list reply that concludes "資訊不足"/out-of-scope, the
    // retrieved chunks didn't actually support an answer, so drop the chips.
    // Context-trace keeps them: its sections can be partially inconclusive while
    // the full issue context shown is still genuinely relevant.
    const sources =
      !isContextTrace && isInconclusiveAnswer(result.answer) ? undefined : result.sources;

    appendChatMsg(
      msgs,
      'assistant',
      formattedAnswer,
      result.model,
      sources,
      result.retrieval_mode,
      requestedModel,
    );
  } catch (err: any) {
    typingEl.remove();
    const errMsg = err?.message || '未知錯誤';
    appendChatMsg(
      msgs,
      'assistant',
      `<span style="color:var(--red-400)">發生錯誤：${escapeHtml(errMsg)}</span>`,
    );
  } finally {
    delete sendBtn.dataset.busy;
    renderRagQuestionState();
    if (!input.disabled) {
      input.focus();
    }
  }
}

function appendChatMsg(
  container: HTMLElement,
  role: string,
  html: string,
  model?: string,
  sources?: ChatSource[],
  retrievalMode?: ResolvedRetrievalMode,
  requestedModel?: string,
): void {
  const el = document.createElement('div');
  el.className = `chat-msg ${role}`;

  const modeLabel = retrievalMode ? RETRIEVAL_MODE_LABELS[retrievalMode] : '';
  let modelLabel = '';
  let isFallback = false;
  if (model) {
    if (requestedModel && requestedModel !== model) {
      isFallback = true;
      modelLabel = `已自動切換：${escapeHtml(requestedModel)} → ${escapeHtml(model)}`;
    } else {
      modelLabel = escapeHtml(model);
    }
  }
  const metaParts = [modeLabel ? `使用模式：${modeLabel}` : '', modelLabel].filter(Boolean);
  const metaClass = isFallback ? 'chat-msg-meta chat-msg-fallback' : 'chat-msg-meta';
  const metaTitle = isFallback ? ' title="原選模型過載或限流，已自動改用可用模型"' : '';
  const metaHtml = metaParts.length
    ? `<div class="${metaClass}"${metaTitle}>${metaParts.join(' · ')}</div>`
    : '';
  const sourcesHtml = renderChatSources(sources);

  el.innerHTML = `<div class="chat-msg-content">${html}${sourcesHtml}</div>${metaHtml}`;

  el.querySelectorAll('.chat-source-ref').forEach((ref) => {
    ref.addEventListener('click', async () => {
      const target = ref as HTMLElement;
      const iid = Number(target.dataset.iid);
      const discussionId = target.dataset.discussionId || null;

      let noteIds: number[] = [];
      try {
        noteIds = JSON.parse(target.dataset.noteIds || '[]');
      } catch {
        noteIds = [];
      }

      state.pendingDiscussionJump = {
        issue_iid: iid,
        discussion_id: discussionId,
        note_ids: noteIds,
      };

      const matchedIssue = state.allIssues.find((i) => i.iid === iid);
      if (matchedIssue) {
        openIssueDetail(matchedIssue);
        return;
      }

      try {
        const bundle = await api<IssueDetailBundle>(`/api/issues/detail-by-url`, 'POST', {
          url: target.getAttribute('data-url') || '',
        });
        openIssueDetailWithBundle(bundle);
      } catch (err) {
        console.error('Open source issue failed', err);
      }
    });
  });

  el.querySelectorAll('.issue-ref:not(.chat-source-ref)').forEach((ref) => {
    ref.addEventListener('click', () => {
      const iid = Number((ref as HTMLElement).dataset.iid);
      const issue = state.allIssues.find((i) => i.iid === iid);
      if (issue) openIssueDetail(issue);
    });
  });

  el.querySelectorAll<HTMLButtonElement>('.chat-copy-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const markdown = decodeURIComponent(btn.dataset.copy || '');
      if (!markdown) return;
      try {
        await navigator.clipboard.writeText(markdown);
      } catch {
        // Clipboard API can fail without focus/permission; fall back to a textarea.
        const ta = document.createElement('textarea');
        ta.value = markdown;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        ta.remove();
      }
      const label = btn.querySelector('.chat-copy-label');
      if (label) {
        const original = label.textContent;
        label.textContent = '已複製';
        btn.classList.add('is-copied');
        window.setTimeout(() => {
          label.textContent = original;
          btn.classList.remove('is-copied');
        }, 1600);
      }
    });
  });

  container.appendChild(el);
  container.scrollTop = container.scrollHeight;
}

function formatChatAnswer(text: string): string {
  // Models often emit numbered lists inline ("1. … 2. … 3. …") in one paragraph.
  // Put each item on its own line so the list formatting below can pick it up.
  // The lookbehind for a non-"." char avoids splitting version numbers like 2.0.0.
  let html = text
    .replace(/\r\n/g, '\n')
    .replace(/(^|[^\d.])\s*(\d{1,2})\.\s+(?=\S)/g, '$1\n$2. ')
    .replace(/\s+[•●]\s+(?=\S)/g, '\n- ')
    .replace(/^\s*[•●]\s+/gm, '- ');

  // Convert markdown to HTML
  html = html
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/^### (.+)$/gm, '<h4>$1</h4>')
    .replace(/^## (.+)$/gm, '<h3>$1</h3>')
    .replace(/^- (.+)$/gm, '<li class="chat-subitem">$1</li>')
    .replace(/^(\d+)\. (.+)$/gm, '<li><strong>$1.</strong> $2</li>')
    .replace(/(<li>.*<\/li>\n?)+/g, (match) => `<ul>${match}</ul>`)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\n{2,}/g, '<br/><br/>')
    .replace(/\n/g, '<br/>');

  return linkifyIssueRefs(html);
}

// Convert #123 issue references into clickable buttons (shared by all renderers).
function linkifyIssueRefs(html: string): string {
  return html.replace(/#(\d+)/g, (_match, iid) => {
    const issue = state.allIssues.find((i) => i.iid === Number(iid));
    if (issue) {
      return `<button type="button" class="issue-ref" data-iid="${iid}" title="查看 ${escapeHtml(issue.title)}">#${iid}</button>`;
    }
    return `#${iid}`;
  });
}

// Context Trace answers carry fixed sections. Render "## 時間線" as a node/line
// timeline and "## 建議下一步" as an interactive checklist with a copy-as-Markdown
// button; format every other section normally.
function formatContextTraceAnswer(text: string): string {
  let working = text;
  const fragments: Array<[string, string]> = [];

  // Timeline: keep the heading, swap the body for a node/line timeline.
  const timelineRe = /##\s*時間線\s*\n([\s\S]*?)(?=\n##\s|$)/;
  const timelineMatch = working.match(timelineRe);
  if (timelineMatch) {
    const ph = '@@CHAT_TIMELINE@@';
    fragments.push([ph, renderChatTimeline(timelineMatch[1])]);
    working = working.replace(timelineRe, `## 時間線\n${ph}`);
  }

  // Next steps: replace the whole section (heading + body) with a checklist block.
  const nextRe = /##\s*建議下一步\s*\n([\s\S]*?)(?=\n##\s|$)/;
  const nextMatch = working.match(nextRe);
  if (nextMatch) {
    const ph = '@@CHAT_CHECKLIST@@';
    fragments.push([ph, renderChecklistBlock('建議下一步', nextMatch[1])]);
    working = working.replace(nextRe, ph);
  }

  let html = formatChatAnswer(working);
  for (const [ph, fragment] of fragments) {
    html = html.replace(ph, fragment);
  }
  return html;
}

// Render a "## 建議下一步" section as a tickable checklist plus a button that
// copies the items as a Markdown task list (paste-ready into a GitLab/GitHub issue).
function renderChecklistBlock(title: string, body: string): string {
  const entries = body
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => /^[-*]\s+/.test(line))
    .map((line) =>
      line
        .replace(/^[-*]\s+/, '')
        .replace(/^\[[ xX]\]\s*/, '')
        .trim(),
    )
    .filter(Boolean);

  if (!entries.length) {
    return `<h3>${escapeHtml(title)}</h3>${formatChatAnswer(body)}`;
  }

  const items = entries
    .map(
      (entry) =>
        `<label class="chat-check-item"><input type="checkbox" class="chat-check-box" /><span class="chat-check-text">${linkifyIssueRefs(
          escapeHtml(entry),
        )}</span></label>`,
    )
    .join('');

  const markdown = entries.map((entry) => `- [ ] ${entry}`).join('\n');
  const copyData = encodeURIComponent(markdown);

  return `
    <div class="chat-checklist-block">
      <div class="chat-checklist-head">
        <h3>${escapeHtml(title)}</h3>
        <button
          type="button"
          class="chat-copy-btn"
          data-copy="${copyData}"
          title="複製為 Markdown 清單"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>
          <span class="chat-copy-label">複製 Markdown</span>
        </button>
      </div>
      <div class="chat-checklist">${items}</div>
    </div>`;
}

function renderChatTimeline(body: string): string {
  const entries = body
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => /^[-*]\s+/.test(line))
    .map((line) => line.replace(/^[-*]\s+/, ''));

  if (!entries.length) {
    // No parseable bullet entries: fall back to normal formatting.
    return formatChatAnswer(body);
  }

  const items = entries
    .map((entry) => {
      // Expected shape: "日期｜事件描述（#IID）"; tolerate other delimiters.
      const parts = entry.split(/[｜|]/);
      const hasDate = parts.length >= 2;
      const date = hasDate ? parts[0].trim() : '';
      const rawText = hasDate ? parts.slice(1).join('｜').trim() : entry.trim();
      const dateHtml = date
        ? `<span class="chat-timeline-date">${linkifyIssueRefs(escapeHtml(date))}</span>`
        : '';
      const textHtml = linkifyIssueRefs(escapeHtml(rawText));
      return `
        <li class="chat-timeline-item">
          <span class="chat-timeline-node" aria-hidden="true"></span>
          <div class="chat-timeline-body">
            ${dateHtml}
            <span class="chat-timeline-text">${textHtml}</span>
          </div>
        </li>`;
    })
    .join('');

  return `<ol class="chat-timeline">${items}</ol>`;
}

let ragPollTimer: number | null = null;

function ensureRagStatusBadge(): HTMLElement {
  let badge = document.getElementById('rag-status-badge');
  if (badge) return badge;

  badge = document.createElement('section');
  badge.id = 'rag-status-badge';
  badge.className = 'rag-status-badge';
  badge.setAttribute('aria-live', 'polite');
  document.body.appendChild(badge);
  return badge;
}

function renderRagStatusBadge(): void {
  const badge = ensureRagStatusBadge();
  // The assistant view and the floating dock both show rebuild status inline,
  // so the separate floating badge is redundant while either is open.
  const hideForOpenChat = state.currentView === 'assistant' || state.chatDockOpen;

  if (hideForOpenChat || (!state.ragUi.rebuilding && !state.ragUi.rebuildStatusText)) {
    badge.className = 'rag-status-badge';
    badge.innerHTML = '';
    renderRagQuestionState();
    return;
  }

  const tone = state.ragUi.rebuilding
    ? 'syncing'
    : state.ragUi.rebuildStatusText.startsWith('同步留言失敗')
      ? 'error'
      : 'ready';
  const progress = Math.max(0, Math.min(100, Math.round(state.ragUi.rebuildProgress)));
  const title = state.ragUi.rebuilding
    ? '同步留言中'
    : tone === 'error'
      ? '同步失敗'
      : '已同步留言';

  badge.className = `rag-status-badge is-visible is-${tone}`;
  badge.innerHTML = `
    <div class="rag-status-badge__copy">
      <strong>${escapeHtml(title)}</strong>
      <span>${escapeHtml(state.ragUi.rebuildStatusText || '處理中')}</span>
    </div>
    ${
      state.ragUi.rebuilding
        ? `
          <div class="rag-status-badge__progress">
            <div class="rag-status-badge__bar"><span style="width:${progress}%"></span></div>
            <div class="rag-status-badge__meta">${progress}%</div>
          </div>`
        : ''
    }
  `;
  renderRagQuestionState();
}

async function refreshRagIndexAvailability(): Promise<void> {
  try {
    const status = await api<RagIndexStatus>('/api/rag/status');
    state.ragUi.statusChecked = true;
    state.ragUi.hasUsableIndex = Boolean(status.built_at && status.chunk_count > 0);
    if (state.ragUi.hasUsableIndex) {
      state.ragUi.rebuildFailedWithoutIndex = false;
    }
  } catch (err) {
    console.error('Load rag status failed', err);
    state.ragUi.statusChecked = true;
  }
  renderRagStatusBadge();
}

async function startRagRebuild(): Promise<void> {
  if (state.ragUi.rebuilding) return;

  state.ragUi.statusChecked = true;
  state.ragUi.rebuildFailedWithoutIndex = false;
  state.ragUi.rebuilding = true;
  state.ragUi.rebuildProgress = 0;
  state.ragUi.rebuildStatusText = '正在排入背景重建...';
  renderRagStatusBadge();

  try {
    const result = await api<{ job_id: string; status: string }>('/api/rag/reindex', 'POST', {});
    state.ragUi.rebuildJobId = result.job_id;
    state.ragUi.rebuildStatusText = 'RAG index 背景重建中';
    renderRagStatusBadge();
    beginPollRagJob(result.job_id);
  } catch (err: any) {
    state.ragUi.rebuilding = false;
    state.ragUi.rebuildStatusText = `重建失敗：${err?.message || '未知錯誤'}`;
    renderRagStatusBadge();
    window.setTimeout(() => {
      state.ragUi.rebuildStatusText = '';
      renderRagStatusBadge();
    }, 3500);
  }
}

function beginPollRagJob(jobId: string): void {
  if (ragPollTimer) {
    window.clearInterval(ragPollTimer);
    ragPollTimer = null;
  }

  const tick = async () => {
    try {
      const job = await api<RagRebuildJob>(`/api/rag/jobs/${jobId}`);

      state.ragUi.rebuildProgress = job.progress || 0;

      if (job.status === 'queued') {
        state.ragUi.rebuildStatusText = '等待背景工作啟動...';
      } else if (job.status === 'running') {
        state.ragUi.rebuildStatusText = `同步中：#${job.current_issue_iid ?? '-'} · ${job.chunk_count} chunks`;
      } else if (job.status === 'completed') {
        state.ragUi.rebuilding = false;
        state.ragUi.hasUsableIndex = true;
        state.ragUi.rebuildFailedWithoutIndex = false;
        state.ragUi.rebuildProgress = 100;
        state.ragUi.rebuildStatusText = `完成，共 ${job.result?.chunk_count ?? job.chunk_count} chunks`;
        renderRagStatusBadge();

        if (ragPollTimer) {
          window.clearInterval(ragPollTimer);
          ragPollTimer = null;
        }

        window.setTimeout(async () => {
          try {
            const status = await api<{
              built_at: string | null;
              issue_count: number;
              indexed_issues: number;
              skipped_issues: number;
              chunk_count: number;
            }>('/api/rag/status');
            state.ragUi.rebuildStatusText = `最新索引 ${status.chunk_count} chunks`;
            renderRagStatusBadge();
            window.setTimeout(() => {
              state.ragUi.rebuildStatusText = '';
              renderRagStatusBadge();
            }, 2500);
          } catch {
            state.ragUi.rebuildStatusText = '';
            renderRagStatusBadge();
          }
        }, 800);

        return;
      } else if (job.status === 'failed') {
        state.ragUi.rebuilding = false;
        if (!state.ragUi.hasUsableIndex) {
          state.ragUi.rebuildFailedWithoutIndex = true;
        }
        state.ragUi.rebuildStatusText = `同步留言失敗：${job.error || '未知錯誤'}`;
        renderRagStatusBadge();

        if (ragPollTimer) {
          window.clearInterval(ragPollTimer);
          ragPollTimer = null;
        }

        window.setTimeout(() => {
          state.ragUi.rebuildStatusText = '';
          renderRagStatusBadge();
        }, 4000);
        return;
      }

      renderRagStatusBadge();
    } catch (err) {
      console.error('Poll rag job failed', err);
    }
  };

  void tick();
  ragPollTimer = window.setInterval(() => {
    void tick();
  }, 1000);
}

/* ══════════════════════════════════════════════
   EVENT WIRING
   ══════════════════════════════════════════════ */
function wireEvents(): void {
  enhanceTimelineControls();
  syncTimelineRangeControls();
  initChat();
  initViewNavigation();
  initSidebarResizer();

  const bind = <T extends HTMLElement>(
    id: string,
    eventName: string,
    listener: EventListenerOrEventListenerObject,
  ): T | null => {
    const element = getById<T>(id);
    if (!element) {
      console.warn(`Missing element during event binding: ${id}`);
      return null;
    }
    element.addEventListener(eventName, listener);
    return element;
  };

  // Keep tab switching available even if a later optional control is missing.
  initTabs();

  // Sidebar toggle
  bind<HTMLButtonElement>('sidebar-toggle', 'click', () => {
    const shell = document.querySelector('.app-shell')!;
    shell.classList.toggle('sidebar-collapsed');
    requestAnimationFrame(() => rerenderTimelineIfVisible());
  });

  let timelineResizeTimer: number | undefined;
  window.addEventListener('resize', () => {
    clearTimeout(timelineResizeTimer);
    timelineResizeTimer = window.setTimeout(() => rerenderTimelineIfVisible(), 120);
  });

  // Sidebar config buttons
  document.getElementById('btn-pick-file')?.addEventListener('click', async () => {
    const filePath = await window.trackerBridge.openFileDialog();
    const imp = document.getElementById('import-file') as HTMLInputElement | null;
    if (filePath && imp) imp.value = filePath;
  });

  // Token hint link
  document.getElementById('token-hint-link')?.addEventListener('click', (e) => {
    e.preventDefault();
    const provider = state.currentConfig?.active_provider || 'gitlab';
    if (provider === 'github') {
      window.trackerBridge.openPath('https://github.com/settings/personal-access-tokens');
      return;
    }
    const base = byId<HTMLInputElement>('gitlab-url').value.replace(/\/+$/, '');
    if (base) {
      window.trackerBridge.openPath(`${base}/-/user_settings/personal_access_tokens`);
    }
  });

  // Gemini hint link – open Google AI Studio
  document.getElementById('gemini-hint-link')?.addEventListener('click', (e) => {
    e.preventDefault();
    window.trackerBridge.openPath('https://aistudio.google.com/apikey');
  });

  bind<HTMLButtonElement>('btn-load-config', 'click', () => loadConfig().catch(handleError));
  bind<HTMLButtonElement>('btn-save-config', 'click', () => saveConfig().catch(handleError));
  bind<HTMLButtonElement>('btn-test-connection', 'click', () =>
    testActiveConnection().catch(handleError),
  );
  // Project Pulse (專案脈搏)
  bind<HTMLButtonElement>('pulse-new', 'click', () => openPulseForm(null));
  bind<HTMLButtonElement>('pulse-form-close', 'click', () => closePulseForm());
  bind<HTMLButtonElement>('pulse-form-save', 'click', () =>
    runWithButtonBusy('pulse-form-save', '儲存中…', savePulseForm).catch(handleError),
  );
  bind<HTMLButtonElement>('pulse-form-restore', 'click', () => restorePulseDefaultInstruction());
  bind<HTMLButtonElement>('pulse-form-preview', 'click', () =>
    runWithButtonBusy('pulse-form-preview', '產生中…', () =>
      previewPulse(currentPulseFormId()),
    ).catch(handleError),
  );
  bind<HTMLButtonElement>('pulse-form-send', 'click', () =>
    runWithButtonBusy('pulse-form-send', '發送中…', () => sendPulseNow(currentPulseFormId())).catch(
      handleError,
    ),
  );
  bind<HTMLButtonElement>('pulse-form-test', 'click', () =>
    runWithButtonBusy('pulse-form-test', '測試中…', () =>
      testPulseWebhook(currentPulseFormId()),
    ).catch(handleError),
  );
  bind<HTMLSelectElement>('pulse-form-type', 'change', (event) => {
    // Bringing in the new type's default instruction only when the box is empty
    // or still holds another type's default avoids clobbering custom edits.
    const textarea = getById<HTMLTextAreaElement>('pulse-form-instruction');
    if (!textarea) return;
    const current = textarea.value.trim();
    const isDefault =
      current === '' ||
      current === PULSE_LEGACY_DAILY_INSTRUCTION ||
      Object.values(PULSE_DEFAULT_INSTRUCTIONS).some((value) => value === current);
    if (isDefault) {
      textarea.value = pulseDefaultInstruction((event.currentTarget as HTMLSelectElement).value);
    }
  });
  bind<HTMLButtonElement>('pulse-preview-close', 'click', () => closePulsePreview());
  bind<HTMLButtonElement>('pulse-preview-copy', 'click', () =>
    copyPulseReport().catch(handleError),
  );
  bind<HTMLButtonElement>('pulse-history-refresh', 'click', () =>
    loadPulseHistory().catch(handleError),
  );
  getById<HTMLAnchorElement>('pulse-webhook-guide')?.addEventListener('click', (event) => {
    event.preventDefault();
    void window.trackerBridge.openPath('https://make.powerautomate.com/');
  });
  getById<HTMLElement>('pulse-rows')?.addEventListener('click', handlePulseRowAction);
  bind<HTMLSelectElement>('active-provider', 'change', (event) =>
    switchActiveProvider((event.currentTarget as HTMLSelectElement).value as 'gitlab' | 'github'),
  );
  bind<HTMLButtonElement>('btn-sync-now', 'click', () => syncNow().catch(handleError));
  bind<HTMLButtonElement>('btn-refresh-dashboard', 'click', () => syncNow().catch(handleError));
  bind<HTMLButtonElement>('btn-arrange-preview', 'click', () =>
    previewArrangeIssues().catch(handleError),
  );
  bind<HTMLButtonElement>('btn-arrange-run-selected', 'click', () =>
    runSelectedArrangeJob().catch(handleError),
  );
  bind<HTMLButtonElement>('btn-arrange-run-batch', 'click', () =>
    runArrangeBatch().catch(handleError),
  );
  bind<HTMLButtonElement>('btn-arrange-run-scrape', 'click', () =>
    runArrangeBatchByMode('scrape').catch(handleError),
  );
  bind<HTMLButtonElement>('btn-arrange-run-llm', 'click', () =>
    runArrangeBatchByMode('llm').catch(handleError),
  );
  bind<HTMLButtonElement>('btn-arrange-stop-batch', 'click', () => stopArrangeBatch());
  bind<HTMLButtonElement>('btn-arrange-export-excel', 'click', () =>
    exportArrangeExcel().catch(handleError),
  );
  bind<HTMLSelectElement>('arrange-prompt-template-select', 'change', () => {
    const value = byId<HTMLSelectElement>('arrange-prompt-template-select').value;
    selectArrangePromptTemplate(value);
  });
  bind<HTMLButtonElement>('btn-arrange-template-save', 'click', () =>
    saveCurrentPromptToSelectedTemplate(),
  );
  bind<HTMLButtonElement>('btn-arrange-template-save-as', 'click', () =>
    saveCurrentPromptAsNewTemplate(),
  );
  bind<HTMLButtonElement>('btn-arrange-template-delete', 'click', () =>
    deleteSelectedPromptTemplate(),
  );
  bind<HTMLButtonElement>('btn-arrange-history-refresh', 'click', () =>
    loadArrangeHistory(false).catch(handleError),
  );
  bind<HTMLButtonElement>('btn-arrange-history-open-folder', 'click', () =>
    openArrangeHistoryFolder().catch(handleError),
  );
  bind<HTMLButtonElement>('btn-arrange-history-open-file', 'click', () =>
    openSelectedArrangeHistoryFile().catch(handleError),
  );
  bind<HTMLButtonElement>('btn-arrange-history-copy-text', 'click', () =>
    copySelectedArrangeHistoryContent().catch(handleError),
  );
  bind<HTMLButtonElement>('btn-arrange-history-preview-md', 'click', () =>
    setArrangeHistoryPreviewMode('markdown'),
  );
  bind<HTMLButtonElement>('btn-arrange-history-preview-raw', 'click', () =>
    setArrangeHistoryPreviewMode('raw'),
  );
  bind<HTMLTextAreaElement>('arrange-prompt', 'input', () => updateArrangePromptPreference());
  bind<HTMLTextAreaElement>('pref-gemini-model-list', 'input', () =>
    updateGeminiModelListPreference(),
  );
  bind<HTMLInputElement>('arrange-history-search', 'input', () => renderArrangeHistoryList());
  bind<HTMLSelectElement>('arrange-history-kind', 'change', () => renderArrangeHistoryList());
  bind<HTMLSelectElement>('pref-gemini-model', 'change', () => updateGeminiModelPreference());
  bind<HTMLSelectElement>('arrange-model-select', 'change', () =>
    updateArrangeGeminiModelPreference(),
  );
  bind<HTMLSelectElement>('chat-rag-model-select', 'change', () =>
    updateChatRagGeminiModelPreference(),
  );
  bind<HTMLButtonElement>('pref-theme-dark', 'click', () => {
    state.uiPreferences.theme = 'dark';
    applyUiPreferences();
    saveUiPreferences();
  });
  bind<HTMLButtonElement>('pref-theme-light', 'click', () => {
    state.uiPreferences.theme = 'light';
    applyUiPreferences();
    saveUiPreferences();
  });
  bind<HTMLInputElement>('pref-scale-range', 'input', () => {
    state.uiPreferences.scale = clampUiScale(
      Number(byId<HTMLInputElement>('pref-scale-range').value),
    );
    applyUiPreferences();
    saveUiPreferences();
  });
  bind<HTMLButtonElement>('pref-scale-reset', 'click', () => {
    state.uiPreferences.scale = DEFAULT_UI_PREFERENCES.scale;
    applyUiPreferences();
    saveUiPreferences();
  });

  // Recent hours input
  bind<HTMLInputElement>('recent-hours', 'change', () => renderRecentIssues());

  // Burndown milestone selector
  bind<HTMLSelectElement>('burndown-milestone-select', 'change', () => {
    if (!state.analytics) return;
    const ms = state.analytics.burndown.find(
      (b) => b.milestone === byId<HTMLSelectElement>('burndown-milestone-select').value,
    );
    if (ms) renderBurndownChartSafe(ms);
  });

  // Gantt filters
  bind<HTMLSelectElement>('gantt-quick-view', 'change', () => scheduleGanttRender(state.allIssues));
  bind<HTMLSelectElement>('gantt-group-by', 'change', () => scheduleGanttRender(state.allIssues));
  bind<HTMLSelectElement>('gantt-milestone-filter', 'change', () =>
    scheduleGanttRender(state.allIssues),
  );
  bind<HTMLSelectElement>('gantt-assignee-filter', 'change', () =>
    scheduleGanttRender(state.allIssues),
  );
  bind<HTMLSelectElement>('gantt-state-filter', 'change', () =>
    scheduleGanttRender(state.allIssues),
  );
  bind<HTMLSelectElement>('gantt-range-mode', 'change', () => {
    syncTimelineRangeControls();
    scheduleGanttRender(state.allIssues);
  });
  bind<HTMLInputElement>('gantt-month', 'change', () => {
    state.ganttMonth = byId<HTMLInputElement>('gantt-month').value;
    scheduleGanttRender(state.allIssues);
  });
  bind<HTMLInputElement>('gantt-week', 'change', () => {
    state.ganttWeek = byId<HTMLInputElement>('gantt-week').value;
    scheduleGanttRender(state.allIssues);
  });
  bind<HTMLButtonElement>('gantt-month-prev', 'click', () => shiftMonth(-1));
  bind<HTMLButtonElement>('gantt-month-next', 'click', () => shiftMonth(1));
  bind<HTMLSelectElement>('gantt-view-mode', 'change', () => {
    state.timelineViewMode = byId<HTMLSelectElement>('gantt-view-mode').value as TimelineViewMode;
    scheduleGanttRender(state.allIssues);
  });

  // Table filters & search
  let searchTimer: number | undefined;
  bind<HTMLInputElement>('table-search', 'input', () => {
    clearTimeout(searchTimer);
    searchTimer = window.setTimeout(() => renderSpreadsheet(), 200);
  });
  bind<HTMLSelectElement>('table-state-filter', 'change', () => renderSpreadsheet());
  bind<HTMLSelectElement>('table-milestone-filter', 'change', () => renderSpreadsheet());
  bind<HTMLSelectElement>('table-label-filter', 'change', () => renderSpreadsheet());
  bind<HTMLInputElement>('table-date-start', 'change', () => renderSpreadsheet());
  bind<HTMLInputElement>('table-date-end', 'change', () => renderSpreadsheet());

  // Sort headers
  document.querySelectorAll('.spreadsheet-wrap th[data-sort]').forEach((th) => {
    th.addEventListener('click', () => {
      const key = (th as HTMLElement).dataset.sort!;
      if (state.tableSort.key === key) {
        state.tableSort.asc = !state.tableSort.asc;
      } else {
        state.tableSort.key = key;
        state.tableSort.asc = true;
      }
      renderSpreadsheet();
    });
  });

  // Column resize handles
  initColumnResize();

  // Close detail panel
  bind<HTMLButtonElement>('detail-close', 'click', closeIssueDetail);
  bind<HTMLDivElement>('issue-detail-overlay', 'click', (e) => {
    if (e.target === e.currentTarget) closeIssueDetail();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeIssueDetail();
  });

  // Clickable issue cards → open detail panel
  document.addEventListener('click', (e) => {
    const card = (e.target as HTMLElement).closest(
      '.issue-card[data-iid], .alert-item[data-iid]',
    ) as HTMLElement | null;
    if (card && card.dataset.iid && !(e.target as HTMLElement).closest('a')) {
      const iid = Number(card.dataset.iid);
      const issue = state.allIssues.find((i) => i.iid === iid);
      if (issue) openIssueDetail(issue);
    }
  });

  // Clickable table rows → open detail panel (any table with data-iid rows)
  document.addEventListener('click', (e) => {
    const row = (e.target as HTMLElement).closest('tr[data-iid]') as HTMLElement | null;
    if (row && row.dataset.iid && !(e.target as HTMLElement).closest('a')) {
      const iid = Number(row.dataset.iid);
      const issue = state.allIssues.find((i) => i.iid === iid);
      if (issue) openIssueDetail(issue);
    }
  });

  document.addEventListener('click', (e) => {
    const detailButton = (e.target as HTMLElement).closest(
      '[data-arrange-job-detail]',
    ) as HTMLElement | null;
    const detailJobId = detailButton?.dataset.arrangeJobDetail;
    if (detailJobId) {
      selectArrangeJob(detailJobId);
      void openArrangeJobDetail(detailJobId).catch(handleError);
      return;
    }
  });

  document.addEventListener('click', (e) => {
    const jobCard = (e.target as HTMLElement).closest(
      '[data-arrange-job-id]',
    ) as HTMLElement | null;
    const jobId = jobCard?.dataset.arrangeJobId;
    if (jobId) selectArrangeJob(jobId);
  });

  document.addEventListener('click', (e) => {
    const historyItem = (e.target as HTMLElement).closest(
      '[data-arrange-history-file]',
    ) as HTMLElement | null;
    const filename = historyItem?.dataset.arrangeHistoryFile;
    if (filename) {
      void openArrangeHistoryFile(filename).catch(handleError);
    }
  });

  getById<HTMLDetailsElement>('arrange-history-panel')?.addEventListener('toggle', (event) => {
    if ((event.currentTarget as HTMLDetailsElement).open) {
      void loadArrangeHistory().catch(handleError);
    }
  });
}

function handleError(error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  console.error(error);
  setStatus(message, 'error');
  if (state.currentView === 'arrange') {
    setArrangeStatus(message, 'error');
  }
}

/* ══════════════════════════════════════════════
   BOOT
   ══════════════════════════════════════════════ */
async function boot(): Promise<void> {
  state.uiPreferences = readUiPreferences();
  initArrangePromptTemplates();
  applyUiPreferences();
  await applyAppVersionLabel();
  const cachedConfig = readCachedConfig();
  if (cachedConfig) {
    fillConfigForm(cachedConfig);
  }
  wireEvents();
  setActiveView('dashboard');
  try {
    await loadConfig();
  } catch (error) {
    if (!cachedConfig) throw error;
    console.warn('Falling back to cached config after loadConfig failure', error);
    setStatus('設定讀取失敗，已先載入上次快取', 'warn');
  }
  await loadDashboard();
}

boot().catch(handleError);
