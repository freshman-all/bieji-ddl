"use strict";

const THEMES_KEY = "bieji-ddl-v4-themes";
const EVENTS_KEY = "bieji-ddl-v4-events";
const MODE_KEY = "bieji-ddl-v4-mode";
const AI_CONFIG_KEY = "bieji-ddl-v4-ai-config";
const AI_KEY_SESSION = "bieji-ddl-v4-ai-key";
const KEYWORD_RULES_KEY = "bieji-ddl-v4-keyword-rules";
const PET_SETTINGS_KEY = "bieji-ddl-v4-pet";
const MINIMAL_SPLIT_KEY = "bieji-ddl-v4-minimal-split";
const ALL_THEME_ID = "all";
const DESIGN_KEY = "bieji-ddl-design-theme";
const FOCUS_KEY = "bieji-ddl-focus-session";
const REMINDER_SETTINGS_KEY = "bieji-ddl-reminder-settings";
const PERIOD_LABELS = { today: "今天", tomorrow: "明天", week: "本周", month: "本月", history: "历史" };
const PERIOD_HINTS = {
  today: "先完成红色事项，再处理其余安排。",
  tomorrow: "提前安排明天的节奏，避免临时救火。",
  week: "未来 7 天的任务集中在这里。",
  month: "本月剩余任务，适合做长期安排。",
  history: "已完成和已过期的事项都保存在这里。"
};
const BASIC_CATEGORIES = ["上课", "作业", "打卡", "表单", "网课", "考试", "运动", "游戏", "生活"];
const CATEGORY_ICONS = {
  "上课": "◫", "作业": "✎", "打卡": "✓", "表单": "▤", "网课": "▷", "考试": "◎", "运动": "⚑", "游戏": "◇", "生活": "✦"
};
const PRIORITY_META = {
  red: { label: "先做", color: "#d74c47", hint: "24 小时内截止，或临近的重要事项" },
  yellow: { label: "再做", color: "#d79a28", hint: "3 天内需要处理" },
  green: { label: "可以等等", color: "#3e8e69", hint: "还有较充足的准备时间" },
  gray: { label: "已完成", color: "#89928d", hint: "这件事已经处理完成" }
};
const THEME_COLORS = {
  green: { accent: "#174f45", soft: "#dceee6", caption: "FOREST FLOW" },
  orange: { accent: "#b95f2f", soft: "#f7e3d4", caption: "WARM PACE" },
  blue: { accent: "#4a6288", soft: "#e6ecf5", caption: "BLUE HOUR" },
  rose: { accent: "#9b5157", soft: "#f6e3e3", caption: "ROSE NOTE" },
  brown: { accent: "#79603d", soft: "#eee5d5", caption: "SLOW MORNING" },
  slate: { accent: "#3f5265", soft: "#e7edf2", caption: "ALL IN ONE" }
};
const SAMPLE_NOTICE = {
  study: "【课程通知】同学们，明天晚上8点前提交小组展示PPT；后天9点英语学习打卡；下周一14:00填写奖学金信息表，地点在博学楼B203。",
  sport: "【篮球社】明天下午4点篮球友谊赛，地点在体育馆；本周五晚上7点操场夜跑打卡；下周一前填写体测项目选择表。"
};
const DEFAULT_KEYWORD_RULES = [
  { label: "考试", keywords: "考试, 测验, 测试, 闭卷, 开卷" },
  { label: "打卡", keywords: "打卡, 签到" },
  { label: "表单", keywords: "填表, 表单, 信息表, 问卷, 登记, 选择表" },
  { label: "网课", keywords: "网课, MOOC, 慕课, 视频, 讨论区, 结业" },
  { label: "运动", keywords: "篮球, 足球, 跑步, 夜跑, 训练, 体测, 比赛, 运动" },
  { label: "游戏", keywords: "游戏, 开黑, 赛季, 公会, 副本, 排位" },
  { label: "生活", keywords: "快递, 账单, 值日, 充值, 宿舍" },
  { label: "作业", keywords: "作业, 报告, PPT, 提交, 截止, 课程设计" }
];
const DEFAULT_PET = { enabled: true, name: "小别", emoji: "🐱", preset: "default", image: "", position: null };

const state = {
  themes: [],
  events: [],
  activeThemeId: "study",
  period: "today",
  sort: "priority",
  query: "",
  filters: { category: "", source: "", urgency: "", location: "", status: "" },
  preview: [],
  activeEventId: null,
  mode: "detail",
  keywordRules: [],
  aiConfig: { baseUrl: "", model: "", apiKey: "", urgentKeywords: "紧急, 今天, 今晚, 马上, 立刻, 截止", ignoredKeywords: "广告, 自愿, 可选" },
  editingThemeId: null,
  themeBackgroundDraft: "",
  overviewType: "todo",
  pet: { ...DEFAULT_PET },
  petImageDraft: "",
  petOriginalDraft: "",
  petDragged: false,
  minimalIndex: 0,
  minimalSplit: 50,
  minimalImageData: "",
  minimalHash: "",
  importTextHash: "",
  designTheme: "apex",
  focusSky: "day",
  focusSession: null,
  reminderSettings: { enabled: true, minutes: 15 },
  profileAvatar: ""
};

let focusTimer = null;
let notificationTimers = new Map();
let petClickTimer = null;

let cloudReady = false;
let cloudHydrating = false;
let cloudSaveTimer = null;
let lastAppliedCloudSignature = "";
let cloudSyncErrorShown = false;
let cloudDirty = false;

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
const dom = {};
const USER_STORAGE_PREFIX = "bieji-ddl-v17-user:";
const LEGACY_MIGRATION_KEY = "bieji-ddl-v17-storage-scope-migrated";
let activeStorageScope = "";

function normalizeStorageScope(user) {
  const raw = user?.email || user?.user_metadata?.username || user?.user_metadata?.display_name || "";
  return String(raw).trim().toLowerCase().replace(/[^a-z0-9_@.-]/g, "_").slice(0, 96);
}

function storageKey(key) {
  return activeStorageScope ? `${USER_STORAGE_PREFIX}${activeStorageScope}:${key}` : key;
}

function storageGet(key) {
  return localStorage.getItem(storageKey(key));
}

function storageSet(key, value) {
  if (!activeStorageScope) return;
  localStorage.setItem(storageKey(key), value);
}

function storageRemove(key) {
  if (!activeStorageScope) return;
  localStorage.removeItem(storageKey(key));
}

function migrateLegacyStorageForUser() {
  if (!activeStorageScope || localStorage.getItem(LEGACY_MIGRATION_KEY)) return;
  const keys = [THEMES_KEY, EVENTS_KEY, MODE_KEY, KEYWORD_RULES_KEY, PET_SETTINGS_KEY, DESIGN_KEY, REMINDER_SETTINGS_KEY, MINIMAL_SPLIT_KEY, FOCUS_KEY];
  let copied = false;
  keys.forEach((key) => {
    const legacy = localStorage.getItem(key);
    if (legacy !== null && localStorage.getItem(storageKey(key)) === null) {
      localStorage.setItem(storageKey(key), legacy);
      copied = true;
    }
  });
  if (copied) localStorage.setItem(LEGACY_MIGRATION_KEY, "1");
}

function activateUserStorage(user) {
  const scope = normalizeStorageScope(user);
  if (!scope || scope === activeStorageScope) return false;
  activeStorageScope = scope;
  migrateLegacyStorageForUser();
  return true;
}

function clearActiveUserStorage() {
  activeStorageScope = "";
}


function pad(value) { return String(value).padStart(2, "0"); }
function startOfDay(date = new Date()) { const result = new Date(date); result.setHours(0, 0, 0, 0); return result; }
function addDays(date, days) { const result = new Date(date); result.setDate(result.getDate() + days); return result; }
function dateAt(offsetDays, hours = 23, minutes = 59) { const result = addDays(startOfDay(new Date()), offsetDays); result.setHours(hours, minutes, 0, 0); return result; }
function isSameDay(left, right) { return left.getFullYear() === right.getFullYear() && left.getMonth() === right.getMonth() && left.getDate() === right.getDate(); }
function toDate(value) { if (!value) return null; const date = value instanceof Date ? value : new Date(value); return Number.isNaN(date.getTime()) ? null : date; }
function toLocalInputValue(value) { const date = toDate(value); if (!date) return ""; return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`; }
function toISOStringFromLocal(value) { if (!value) return ""; const date = new Date(value); return Number.isNaN(date.getTime()) ? "" : date.toISOString(); }
function uid() { return `item-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`; }
function escapeHTML(value) { return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;"); }
function weekdayName(date) { return ["周日", "周一", "周二", "周三", "周四", "周五", "周六"][date.getDay()]; }
function formatShortTime(date) { return `${pad(date.getHours())}:${pad(date.getMinutes())}`; }
function formatFullDateTime(value) { const date = toDate(value); return date ? `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日 ${weekdayName(date)} ${formatShortTime(date)}` : "未设置"; }
function formatEventTime(event) {
  const due = toDate(event.dueTime);
  if (!due) return { text: "待确认时间", overdue: false };
  const diff = Math.round((startOfDay(due) - startOfDay(new Date())) / 86400000);
  let prefix;
  if (diff === 0) prefix = "今天";
  else if (diff === 1) prefix = "明天";
  else if (diff === 2) prefix = "后天";
  else if (diff > 2 && diff < 7) prefix = weekdayName(due);
  else prefix = `${due.getMonth() + 1}月${due.getDate()}日`;
  return { text: `${prefix} ${formatShortTime(due)}`, overdue: event.status !== "done" && due.getTime() < Date.now() };
}

function getTheme(themeId = state.activeThemeId) {
  if (themeId === ALL_THEME_ID) return { id: ALL_THEME_ID, name: "综合主题", icon: "◎", color: "slate", description: "汇总学习、运动、游戏和生活的全部安排", backgroundImage: "" };
  return state.themes.find((theme) => theme.id === themeId) || state.themes[0];
}
function getPalette(theme) { return THEME_COLORS[theme?.color] || THEME_COLORS.green; }

function getDefaultThemes() {
  return [
    { id: "study", name: "学习", icon: "📚", color: "green", description: "课程、作业、考试和成长计划", backgroundImage: "" },
    { id: "sport", name: "运动", icon: "🏀", color: "orange", description: "球局、跑步、训练和体能目标", backgroundImage: "" },
    { id: "game", name: "游戏", icon: "🎮", color: "blue", description: "开黑、赛事、赛季任务和游戏活动", backgroundImage: "" },
    { id: "life", name: "生活", icon: "🌱", color: "brown", description: "快递、账单、社交和日常杂事", backgroundImage: "" }
  ];
}

function eventBase(themeId, title, category, dueTime, source, location, nextAction, requirements, urgency = "auto", status = "todo") {
  return { id: uid(), themeId, title, category, dueTime: dueTime ? dueTime.toISOString() : "", source, location, nextAction, requirements, urgency, status };
}

function getDemoEvents() {
  return [
    eventBase("study", "高等数学课", "上课", dateAt(0, 18, 0), "教务系统", "博学楼 A201", "带教材和习题本，提前 10 分钟到教室", "课程内容：极限与连续。", "auto"),
    eventBase("study", "提交物理实验报告", "作业", dateAt(0, 23, 59), "课程群", "实验楼 A305", "打开报告模板，先补齐结果分析", "提交 PDF，包含实验数据、结果分析和误差讨论。", "red"),
    eventBase("study", "英语学习打卡", "打卡", dateAt(1, 9, 0), "学习通", "线上", "确认打卡入口，完成今天听力任务", "上传学习截图并在班级小程序打卡。", "auto"),
    eventBase("study", "小组展示 PPT", "作业", dateAt(2, 20, 0), "课程群", "线上提交", "先确定三个核心观点，再分配页面", "每组 8 分钟展示，提交 PPT 和分工说明。", "auto"),
    eventBase("study", "专业导论网课讨论", "网课", dateAt(3, 18, 0), "超星学习通", "线上", "查看讨论区要求，先回复一个观点", "完成视频观看并参与讨论。", "yellow"),
    eventBase("study", "线性代数单元测验", "考试", dateAt(5, 14, 0), "教务处", "博学楼 B203", "确认范围，整理矩阵与行列式公式", "闭卷考试，携带学生证。", "auto"),
    eventBase("study", "填写奖学金信息表", "表单", dateAt(-1, 18, 0), "辅导员通知", "线上", "已核对并提交", "已提交。", "auto", "done"),
    eventBase("sport", "晚上操场慢跑", "运动", dateAt(0, 20, 30), "跑步群", "东区操场", "换好跑鞋，先慢跑 15 分钟", "完成 3 公里轻松跑。", "auto"),
    eventBase("sport", "篮球友谊赛", "运动", dateAt(1, 16, 0), "篮球社", "体育馆 2 号场", "确认队服和集合时间", "提前 20 分钟热身。", "yellow"),
    eventBase("sport", "体测项目选择", "表单", dateAt(3, 23, 59), "体育学院", "线上", "检查可选项目并提交", "需要在本周内完成项目选择。", "auto"),
    eventBase("game", "公会周常活动", "游戏", dateAt(1, 21, 0), "游戏群", "线上", "提前更新客户端，20:50 上线", "需要语音沟通，预计 90 分钟。", "yellow"),
    eventBase("game", "赛季通行证任务", "游戏", dateAt(4, 23, 59), "游戏公告", "线上", "先完成每日任务，再看周常进度", "本周结束前领取奖励。", "green"),
    eventBase("life", "取快递", "生活", dateAt(0, 18, 30), "短信通知", "菜鸟驿站", "带手机取件码", "有两个包裹，注意不要漏拿。", "auto"),
    eventBase("life", "宿舍值日", "生活", dateAt(1, 19, 0), "宿舍群", "宿舍", "清理桌面和垃圾", "轮到本周值日。", "auto"),
    eventBase("life", "充值校园卡", "生活", dateAt(7, 12, 0), "校园卡通知", "线上", "检查余额后充值", "建议保留至少一周餐费。", "green")
  ];
}

function loadThemes() {
  try { const raw = storageGet(THEMES_KEY); const parsed = raw ? JSON.parse(raw) : null; return Array.isArray(parsed) && parsed.length ? parsed : getDefaultThemes(); }
  catch (error) { return getDefaultThemes(); }
}
function loadEvents() {
  try { const raw = storageGet(EVENTS_KEY); const parsed = raw ? JSON.parse(raw) : null; return Array.isArray(parsed) ? parsed : getDemoEvents(); }
  catch (error) { return getDemoEvents(); }
}
function saveThemes() { try { storageSet(THEMES_KEY, JSON.stringify(state.themes)); } catch (error) { showToast("浏览器无法保存主题"); } scheduleCloudSave(); }
function saveEvents() { try { storageSet(EVENTS_KEY, JSON.stringify(state.events)); } catch (error) { showToast("浏览器无法保存任务"); } scheduleCloudSave(); }


function loadMode() { return storageGet(MODE_KEY) === "minimal" ? "minimal" : "detail"; }
function saveMode(mode) { storageSet(MODE_KEY, mode); }
function applyMode(mode) {
  state.mode = mode === "minimal" ? "minimal" : "detail";
  document.body.classList.toggle("minimal-mode", state.mode === "minimal");
  $$(".mode-button").forEach((button) => button.classList.toggle("is-active", button.dataset.mode === state.mode));
  saveMode(state.mode);
  scheduleCloudSave();
  if (dom.minimalScreen) renderMinimalScreen();
}
function loadAIConfig() {
  try {
    const saved = JSON.parse(storageGet(AI_CONFIG_KEY) || "{}");
    return { baseUrl: saved.baseUrl || "", model: saved.model || "", apiKey: sessionStorage.getItem(AI_KEY_SESSION) || "", urgentKeywords: saved.urgentKeywords || "紧急, 今天, 今晚, 马上, 立刻, 截止", ignoredKeywords: saved.ignoredKeywords || "广告, 自愿, 可选" };
  } catch (error) {
    return { baseUrl: "", model: "", apiKey: "" };
  }
}
function saveAIConfig(config) {
  state.aiConfig = { ...config };
  storageSet(AI_CONFIG_KEY, JSON.stringify({ baseUrl: config.baseUrl, model: config.model, urgentKeywords: config.urgentKeywords, ignoredKeywords: config.ignoredKeywords }));
  if (config.apiKey) sessionStorage.setItem(AI_KEY_SESSION, config.apiKey);
  else sessionStorage.removeItem(AI_KEY_SESSION);
  updateAIStatus();
  scheduleCloudSave();
}
function loadKeywordRules() {
  try {
    const parsed = JSON.parse(storageGet(KEYWORD_RULES_KEY) || "null");
    return Array.isArray(parsed) && parsed.length ? parsed : DEFAULT_KEYWORD_RULES.map((rule) => ({ ...rule }));
  } catch (error) {
    return DEFAULT_KEYWORD_RULES.map((rule) => ({ ...rule }));
  }
}
function saveKeywordRules(rules) {
  state.keywordRules = rules;
  storageSet(KEYWORD_RULES_KEY, JSON.stringify(rules));
  scheduleCloudSave();
}
function loadPetSettings() {
  try {
    const parsed = JSON.parse(storageGet(PET_SETTINGS_KEY) || "null");
    return parsed && typeof parsed === "object" ? { ...DEFAULT_PET, ...parsed } : { ...DEFAULT_PET };
  } catch (error) {
    return { ...DEFAULT_PET };
  }
}
function savePetSettings(settings) {
  state.pet = { ...settings };
  storageSet(PET_SETTINGS_KEY, JSON.stringify(state.pet));
  scheduleCloudSave();
}

function updateAIStatus() {
  if (!dom.aiStatus) return;
  if (window.BiejiCloud?.isReady() && window.BiejiCloud.aiEnabled) {
    dom.aiStatus.textContent = "云端 AI 模式";
    dom.aiStatus.classList.add("is-live");
    return;
  }
  const live = Boolean(state.aiConfig.baseUrl && state.aiConfig.model && state.aiConfig.apiKey);
  dom.aiStatus.textContent = live ? `大模型模式 · ${state.aiConfig.model}` : "本地关键词模式";
  dom.aiStatus.classList.toggle("is-live", live);
}
function resizeImageFile(file, maxWidth = 1200, maxHeight = 720, quality = 0.8, outputType = "image/jpeg") {
  return new Promise((resolve, reject) => {
    if (!file || !file.type.startsWith("image/")) { reject(new Error("请选择图片文件")); return; }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("图片读取失败"));
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => reject(new Error("图片加载失败"));
      image.onload = () => {
        const ratio = Math.min(1, maxWidth / image.width, maxHeight / image.height);
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(image.width * ratio));
        canvas.height = Math.max(1, Math.round(image.height * ratio));
        const context = canvas.getContext("2d");
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL(outputType, quality));
      };
      image.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}


function buildCloudPayload() {
  return {
    themes: state.themes,
    tasks: state.events,
    profile: {
      mode: state.mode,
      pet: state.pet,
      keywordRules: state.keywordRules,
      avatar: state.profileAvatar || window.BiejiCloud?.getAvatar?.() || "",
      designTheme: state.designTheme,
      reminderSettings: state.reminderSettings,
      aiSettings: {
        urgentKeywords: state.aiConfig.urgentKeywords,
        ignoredKeywords: state.aiConfig.ignoredKeywords
      }
    }
  };
}

function scheduleCloudSave() {
  if (!cloudReady || cloudHydrating || !window.BiejiCloud?.isReady()) return;
  window.clearTimeout(cloudSaveTimer);
  cloudSaveTimer = window.setTimeout(async () => {
    try {
      await window.BiejiCloud.saveSnapshot(buildCloudPayload());
      cloudSyncErrorShown = false;
      cloudDirty = false;
      updatePersonalPanel();
    } catch (error) {
      cloudDirty = true;
      updatePersonalPanel();
      if (!cloudSyncErrorShown) {
        cloudSyncErrorShown = true;
        showToast("当前离线，修改已保存在本机，联网后会自动同步");
      }
    }
  }, 650);
}

function normalizeCloudTheme(theme) {
  return {
    id: String(theme.id),
    name: theme.name || "未命名主题",
    icon: theme.icon || "✦",
    color: theme.color || "green",
    description: theme.description || "",
    backgroundImage: theme.backgroundImage || theme.background_image || ""
  };
}

function normalizeCloudTask(task) {
  return {
    id: String(task.id),
    themeId: task.themeId || task.theme_id || "study",
    title: task.title || "未命名任务",
    category: task.category || "作业",
    source: task.source || "",
    dueTime: task.dueTime || task.due_time || "",
    location: task.location || "",
    nextAction: task.nextAction || task.next_action || "",
    requirements: task.requirements || "",
    urgency: task.urgency || "auto",
    status: task.status || "todo",
    reminder15: Boolean(task.reminder15 ?? task.reminder_15 ?? false),
    reminderMinutes: Number(task.reminderMinutes ?? task.reminder_minutes ?? 15),
    deleted: Boolean(task.deleted || false),
    rawTextHash: task.rawTextHash || task.raw_text_hash || ""
  };
}

function applyCloudSnapshot(snapshot) {
  if (!snapshot) return;
  const signature = JSON.stringify(snapshot);
  if (signature === lastAppliedCloudSignature) return;
  lastAppliedCloudSignature = signature;
  const rawThemes = Array.isArray(snapshot.themes) ? snapshot.themes : [];
  const rawTasks = Array.isArray(snapshot.tasks) ? snapshot.tasks : [];
  const profile = snapshot.profile || {};
  const firstRun = rawThemes.length === 0 && rawTasks.length === 0;
  cloudHydrating = true;
  state.themes = firstRun ? getDefaultThemes() : rawThemes.map(normalizeCloudTheme);
  state.events = rawTasks.map(normalizeCloudTask);
  state.mode = profile.mode === "minimal" ? "minimal" : "detail";
  state.pet = { ...DEFAULT_PET, ...(profile.pet || {}) };
  state.profileAvatar = profile.avatar || window.BiejiCloud?.getAvatar?.() || state.profileAvatar || "";
  const profileDesign = ["apex", "pixel", "orbit"].includes(profile.designTheme) ? profile.designTheme : "";
  state.designTheme = profileDesign || storageGet(DESIGN_KEY) || "apex";
  state.reminderSettings = { enabled: true, minutes: 15, ...(profile.reminderSettings || {}) };
  state.keywordRules = Array.isArray(profile.keywordRules) ? profile.keywordRules : DEFAULT_KEYWORD_RULES.map((rule) => ({ ...rule }));
  const aiSettings = profile.aiSettings || {};
  state.aiConfig = {
    ...state.aiConfig,
    urgentKeywords: aiSettings.urgentKeywords || state.aiConfig.urgentKeywords,
    ignoredKeywords: aiSettings.ignoredKeywords || state.aiConfig.ignoredKeywords
  };
  if (!state.themes.some((theme) => theme.id === state.activeThemeId)) state.activeThemeId = state.themes[0]?.id || "study";
  try {
    storageSet(THEMES_KEY, JSON.stringify(state.themes));
    storageSet(EVENTS_KEY, JSON.stringify(state.events));
    storageSet(KEYWORD_RULES_KEY, JSON.stringify(state.keywordRules));
    storageSet(PET_SETTINGS_KEY, JSON.stringify(state.pet));
    storageSet(MODE_KEY, state.mode);
  } catch (error) { /* Cloud data remains available in memory. */ }
  cloudHydrating = false;
  cloudDirty = false;
  applyMode(state.mode);
  applyDesignTheme(state.designTheme, false);
  updateAIStatus();
  renderAll();
  updatePersonalPanel();
  if (firstRun) window.setTimeout(scheduleCloudSave, 300);
  showToast("云端数据已同步");
}

function setAvatarElement(element, avatar, initial) {
  if (!element) return;
  if (avatar) element.innerHTML = `<img src="${avatar}" alt="个人头像">`;
  else element.textContent = initial;
}

function updatePersonalPanel() {
  if (!dom.personalName) return;
  const cloudEnabled = Boolean(window.BiejiCloud?.enabled);
  const signedIn = Boolean(window.BiejiCloud?.isReady?.());
  const username = signedIn ? window.BiejiCloud.getUsername() : "未登录";
  const initial = String(username || "本").slice(0, 1).toUpperCase();
  const offline = window.BiejiCloud?.isOffline?.() || false;
  const status = !signedIn ? "请先登录" : !cloudEnabled ? "本地账号 · 离线可用" : offline ? (cloudDirty ? "离线修改待同步" : "离线可用") : cloudDirty ? "本地修改待同步" : "云端已同步";
  const avatar = window.BiejiCloud?.getAvatar?.() || state.profileAvatar || "";
  dom.personalName.textContent = username;
  setAvatarElement(dom.personalAvatar, avatar, initial);
  dom.personalSyncStatus.textContent = status;
  if (dom.accountDisplayName) {
    dom.accountDisplayName.textContent = username;
    setAvatarElement(dom.accountAvatar, avatar, initial);
    dom.accountStatusText.textContent = !signedIn ? "尚未登录" : !cloudEnabled ? "本地账号 · 离线数据已保存" : offline ? "离线模式 · 本地副本可用" : "云账号已连接";
    dom.localTaskCount.textContent = String(state.events.filter((event) => !event.deleted).length);
    dom.cloudStateText.textContent = !cloudEnabled ? "本地" : offline ? "离线" : cloudDirty ? "待同步" : "已同步";
    dom.accountModeLabel.textContent = cloudEnabled ? "账号" : "离线";
  }
}

function openAccountManager() {
  updatePersonalPanel();
  openModal("accountModal");
}

function exportBackup() {
  const payload = buildCloudPayload();
  const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), ...payload }, null, 2)], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `bieji-ddl-backup-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  showToast("本地备份已导出");
}

async function importBackupFile(file) {
  if (!file) return;
  const raw = await file.text();
  const data = JSON.parse(raw);
  if (!Array.isArray(data.themes) || !(Array.isArray(data.tasks) || Array.isArray(data.events))) throw new Error("备份文件格式不正确");
  const profile = data.profile || {};
  applyCloudSnapshot({ themes: data.themes, tasks: data.tasks || data.events, profile });
  showToast("备份已导入");
}

async function syncNow() {
  if (!window.BiejiCloud?.isReady()) { showToast("当前没有可同步的云账号"); return; }
  try {
    await window.BiejiCloud.saveSnapshot(buildCloudPayload());
    cloudDirty = false;
    updatePersonalPanel();
    showToast("同步完成");
  } catch (error) {
    showToast("网络不可用，数据已保存在本机");
  }
}

function clearLocalCache() {
  if (!window.confirm("清理这个账号在本机的缓存？如果已连接云端，会从云端恢复。")) return;
  [THEMES_KEY, EVENTS_KEY, MODE_KEY, KEYWORD_RULES_KEY, PET_SETTINGS_KEY, DESIGN_KEY, REMINDER_SETTINGS_KEY, MINIMAL_SPLIT_KEY, FOCUS_KEY, AI_CONFIG_KEY].forEach(storageRemove);
  showToast("这个账号的本地缓存已清理");
  if (window.BiejiCloud?.isReady()) window.BiejiCloud.refreshNow().then((snapshot) => snapshot && applyCloudSnapshot(snapshot));
}

function resetCloudUserState() {
  cloudReady = false;
  cloudHydrating = true;
  clearActiveUserStorage();
  state.themes = getDefaultThemes();
  state.events = [];
  state.keywordRules = DEFAULT_KEYWORD_RULES.map((rule) => ({ ...rule }));
  state.pet = { ...DEFAULT_PET };
  state.profileAvatar = "";
  state.activeThemeId = "study";
  state.mode = "detail";
  state.query = "";
  state.filters = { category: "", source: "", urgency: "", location: "", status: "" };
  cloudHydrating = false;
  renderAll();
}

function loadActiveUserState() {
  cloudHydrating = true;
  state.themes = loadThemes();
  state.events = loadEvents();
  state.keywordRules = loadKeywordRules();
  state.aiConfig = loadAIConfig();
  state.pet = loadPetSettings();
  state.mode = loadMode();
  state.minimalSplit = Number(storageGet(MINIMAL_SPLIT_KEY) || 50);
  state.designTheme = storageGet(DESIGN_KEY) || "apex";
  state.profileAvatar = window.BiejiCloud?.getAvatar?.() || "";
  state.query = "";
  state.filters = { category: "", source: "", urgency: "", location: "", status: "" };
  state.period = "today";
  state.overviewType = "todo";
  try { state.reminderSettings = { enabled: true, minutes: 15, ...(JSON.parse(storageGet(REMINDER_SETTINGS_KEY) || "{}")) }; } catch (error) { state.reminderSettings = { enabled: true, minutes: 15 }; }
  state.focusSession = null;
  loadFocusSession();
  if (!state.themes.some((theme) => theme.id === state.activeThemeId)) state.activeThemeId = state.themes[0]?.id || "study";
  populateThemeSelects();
  dom.sortSelect.value = state.sort;
  cloudHydrating = false;
  applyMode(state.mode);
  applyDesignTheme(state.designTheme, false);
  updateAIStatus();
  renderAll();
  updatePersonalPanel();
}

function autoUrgency(event) {
  const due = toDate(event.dueTime);
  if (!due) return "green";
  const hours = (due.getTime() - Date.now()) / 3600000;
  if (hours <= 24) return "red";
  if (["考试", "打卡", "表单"].includes(event.category) && hours <= 72) return "red";
  if (hours <= 72) return "yellow";
  return "green";
}
function getUrgencyValue(event) { return ["red", "yellow", "green"].includes(event.urgency) ? event.urgency : autoUrgency(event); }
function getDisplayPriority(event) { return event.status === "done" ? "gray" : getUrgencyValue(event); }
function priorityRank(priority) { return { red: 0, yellow: 1, green: 2, gray: 3 }[priority] ?? 9; }
function getEventDate(event) { return toDate(event.dueTime); }
function isOverdue(event) { const due = toDate(event.dueTime); return event.status !== "done" && Boolean(due && due.getTime() < Date.now()); }
function themeEvents(themeId = state.activeThemeId) { return state.events.filter((event) => !event.deleted && (themeId === ALL_THEME_ID || event.themeId === themeId)); }

function periodMatches(event, period) {
  const due = getEventDate(event);
  if (period === "history") return event.status === "done" || isOverdue(event);
  if (event.status === "done") return false;
  if (!due) return period === "month";
  const today = startOfDay(new Date());
  const day = startOfDay(due);
  const diff = Math.round((day - today) / 86400000);
  if (period === "today") return diff === 0;
  if (period === "tomorrow") return diff === 1;
  if (period === "week") return diff >= 0 && diff < 7;
  if (period === "month") return diff >= 0 && day.getMonth() === today.getMonth() && day.getFullYear() === today.getFullYear();
  return false;
}

function matchesFilters(event) {
  const query = state.query.trim().toLowerCase();
  const searchable = [event.title, event.category, event.source, event.location, event.nextAction, event.requirements].join(" ").toLowerCase();
  if (query && !searchable.includes(query)) return false;

  if (state.filters.category && event.category !== state.filters.category) return false;
  const source = event.source || "未标注来源";
  if (state.filters.source && source !== state.filters.source) return false;
  if (state.filters.urgency && getUrgencyValue(event) !== state.filters.urgency) return false;
  if (state.filters.location && !(event.location || "").toLowerCase().includes(state.filters.location.toLowerCase())) return false;
  if (state.filters.status === "done" && event.status !== "done") return false;
  if (state.filters.status === "todo" && event.status !== "todo") return false;
  if (state.filters.status === "overdue" && !isOverdue(event)) return false;
  return true;
}

function getVisibleEvents() {
  return themeEvents().filter((event) => periodMatches(event, state.period) && matchesFilters(event));
}

function compareEvents(left, right, sortMode) {
  const leftDue = toDate(left.dueTime);
  const rightDue = toDate(right.dueTime);
  const leftTime = leftDue ? leftDue.getTime() : Number.POSITIVE_INFINITY;
  const rightTime = rightDue ? rightDue.getTime() : Number.POSITIVE_INFINITY;
  const leftPriority = priorityRank(getDisplayPriority(left));
  const rightPriority = priorityRank(getDisplayPriority(right));
  if (sortMode === "deadline") return leftTime - rightTime || leftPriority - rightPriority;
  return leftPriority - rightPriority || leftTime - rightTime;
}

function renderThemes() {
  const allTheme = getTheme(ALL_THEME_ID);
  const allPalette = getPalette(allTheme);
  const allPending = state.events.filter((event) => !event.deleted && event.status !== "done").length;
  const allItem = `
    <button class="theme-item ${state.activeThemeId === ALL_THEME_ID ? "is-active" : ""}" type="button"
      data-theme-id="${ALL_THEME_ID}" title="综合主题"
      style="--item-accent:${allPalette.accent};--item-soft:${allPalette.soft}">
      <span class="theme-item-icon" aria-hidden="true">◎</span>
      <span class="theme-item-copy"><strong>综合主题</strong><small>查看所有主题任务</small></span>
      <span class="theme-item-count">${allPending}</span>
    </button>`;
  dom.themeList.innerHTML = allItem + state.themes.map((theme) => {
    const palette = getPalette(theme);
    const pending = themeEvents(theme.id).filter((event) => event.status !== "done").length;
    return `
      <button class="theme-item ${theme.id === state.activeThemeId ? "is-active" : ""}" type="button"
        data-theme-id="${escapeHTML(theme.id)}"
        title="${escapeHTML(theme.name)}"
        style="--item-accent:${palette.accent};--item-soft:${palette.soft}">
        <span class="theme-item-icon" aria-hidden="true">${escapeHTML(theme.icon)}</span>
        <span class="theme-item-copy"><strong>${escapeHTML(theme.name)}</strong><small>${escapeHTML(theme.description || "自定义主题")}</small></span>
        <span class="theme-item-count">${pending}</span>
      </button>
    `;
  }).join("");
}

function renderThemeHero() {
  const theme = getTheme();
  const palette = getPalette(theme);
  const events = themeEvents();
  const todo = events.filter((event) => event.status !== "done");
  const urgent = todo.filter((event) => getUrgencyValue(event) === "red");
  const done = events.filter((event) => event.status === "done");

  document.documentElement.style.setProperty("--theme-accent", palette.accent);
  document.documentElement.style.setProperty("--theme-soft", palette.soft);
  if (theme.backgroundImage) {
    dom.themeHero.classList.add("has-theme-image");
    dom.themeHero.style.backgroundImage = `linear-gradient(90deg, rgba(12, 35, 30, 0.72), rgba(12, 35, 30, 0.16)), url("${theme.backgroundImage}")`;
    dom.themeHero.style.backgroundSize = "cover";
    dom.themeHero.style.backgroundPosition = "center";
  } else {
    dom.themeHero.classList.remove("has-theme-image");
    dom.themeHero.style.backgroundImage = "";
    dom.themeHero.style.backgroundSize = "";
    dom.themeHero.style.backgroundPosition = "";
  }
  dom.themeName.textContent = theme.name;
  dom.themeDescription.textContent = theme.description || "自由整理你的时间和计划";
  dom.editThemeButton.hidden = state.activeThemeId === ALL_THEME_ID;
  dom.themeIcon.textContent = theme.icon || "✦";
  dom.themeVisualCaption.textContent = palette.caption;
  dom.themeTodoCount.textContent = String(todo.length);
  dom.themeUrgentCount.textContent = String(urgent.length);
  dom.themeDoneCount.textContent = String(done.length);
  dom.breadcrumb.textContent = theme.name;
}

function renderFilterControls() {
  const events = themeEvents();
  const categories = Array.from(new Set(events.map((event) => event.category).filter(Boolean))).sort();
  const sources = Array.from(new Set(events.map((event) => event.source || "未标注来源"))).sort();

  const categoryOptions = ['<option value="">全部类型</option>', ...categories.map((category) => `<option value="${escapeHTML(category)}">${escapeHTML(category)}</option>`)].join("");
  const sourceOptions = ['<option value="">全部来源</option>', ...sources.map((source) => `<option value="${escapeHTML(source)}">${escapeHTML(source)}</option>`)].join("");

  if (dom.categoryFilter.innerHTML !== categoryOptions) dom.categoryFilter.innerHTML = categoryOptions;
  if (dom.sourceFilter.innerHTML !== sourceOptions) dom.sourceFilter.innerHTML = sourceOptions;
  dom.categoryFilter.value = categories.includes(state.filters.category) ? state.filters.category : "";
  dom.sourceFilter.value = sources.includes(state.filters.source) ? state.filters.source : "";
  dom.locationFilter.value = state.filters.location;
  dom.statusFilter.value = state.filters.status;
  dom.searchInput.value = state.query;

  $$(".filter-chip", dom.urgencyChips).forEach((button) => {
    button.classList.toggle("is-active", button.dataset.urgency === state.filters.urgency);
  });
}

function eventCardMarkup(event) {
  const priority = getDisplayPriority(event);
  const priorityInfo = PRIORITY_META[priority];
  const timeInfo = formatEventTime(event);
  const overdue = isOverdue(event);
  const done = event.status === "done";
  const icon = CATEGORY_ICONS[event.category] || "•";
  const source = event.source || "未标注来源";
  const locationMarkup = event.location ? `<span>⌖ ${escapeHTML(event.location)}</span>` : "";
  const nextMarkup = event.nextAction ? `<p class="next-action"><span>下一步</span>${escapeHTML(event.nextAction)}</p>` : "";
  const themeChip = state.activeThemeId === ALL_THEME_ID ? `<span class="theme-chip">${escapeHTML(getTheme(event.themeId).icon)} ${escapeHTML(getTheme(event.themeId).name)}</span>` : "";
  const action = done
    ? `<button class="undo-button" type="button" data-undo="${escapeHTML(event.id)}">撤销完成</button>`
    : `<button class="complete-button" type="button" data-complete="${escapeHTML(event.id)}" aria-label="标记完成：${escapeHTML(event.title)}">✓</button>`;

  return `
    <article class="task-card priority-${priority} ${done ? "is-done" : ""}" data-event-id="${escapeHTML(event.id)}" tabindex="0" role="button" aria-label="${escapeHTML(event.title)}，${priorityInfo.label}，点击查看详情">
      <div class="task-main">
        <div class="task-topline">
          <span class="priority-pill">${priorityInfo.label}</span>
          ${themeChip}
          <span class="category-chip"><span aria-hidden="true">${icon}</span>${escapeHTML(event.category)}</span>
          <span class="source-chip" title="信息来源：${escapeHTML(source)}">来源 · ${escapeHTML(source)}</span>
          <span class="task-time">${escapeHTML(timeInfo.text)}${overdue ? '<span class="overdue-badge">已逾期</span>' : ""}</span>
        </div>
        <h3>${escapeHTML(event.title)}</h3>
        ${locationMarkup ? `<div class="task-meta">${locationMarkup}</div>` : ""}
        ${nextMarkup}
      </div>
      <div class="task-actions">${action}<span class="detail-hint">详情 →</span></div>
    </article>
  `;
}

function renderTimeline(events) {
  const timed = events
    .filter((event) => event.dueTime)
    .sort((left, right) => new Date(left.dueTime) - new Date(right.dueTime));

  dom.timelineSection.hidden = events.length === 0;
  if (!timed.length) {
    dom.timelineTrack.innerHTML = '<div class="timeline-empty">这个时间范围内还没有带具体时间的事项。</div>';
    return;
  }

  dom.timelineTrack.innerHTML = timed.map((event) => {
    const due = new Date(event.dueTime);
    const priority = getDisplayPriority(event);
    return `
      <div class="timeline-item" style="--priority-color:${PRIORITY_META[priority].color}">
        <div class="timeline-date"><strong>${due.getMonth() + 1}.${pad(due.getDate())}</strong><span>${weekdayName(due)}</span></div>
        <div class="timeline-dot"></div>
        <div class="timeline-card">
          <strong title="${escapeHTML(event.title)}">${escapeHTML(event.title)}</strong>
          <small>${formatShortTime(due)} · ${escapeHTML(event.category)}</small>
          <span>${PRIORITY_META[priority].label}</span>
        </div>
      </div>
    `;
  }).join("");
}

function renderTasks() {
  renderFilterControls();
  const visible = getVisibleEvents().sort((left, right) => compareEvents(left, right, state.sort));
  const filterCount = [state.query.trim(), state.filters.category, state.filters.source, state.filters.urgency, state.filters.location, state.filters.status].filter(Boolean).length;

  $$(".period-tab", dom.periodTabs).forEach((tab) => {
    const active = tab.dataset.period === state.period;
    tab.classList.toggle("is-active", active);
    tab.setAttribute("aria-selected", active ? "true" : "false");
  });

  dom.listTitle.textContent = PERIOD_LABELS[state.period];
  dom.listCount.textContent = `${visible.length} 件`;
  dom.listSubtitle.textContent = state.sort === "priority" ? PERIOD_HINTS[state.period] : "按截止时间从近到远排列，没有时间的放在最后。";
  dom.activeFilterSummary.hidden = filterCount === 0;
  dom.activeFilterSummary.textContent = `已筛选 · ${filterCount} 个条件`;

  dom.eventList.innerHTML = visible.map(eventCardMarkup).join("");
  dom.eventList.hidden = visible.length === 0;
  dom.emptyState.hidden = visible.length !== 0;
  if (!visible.length) {
    dom.emptyTitle.textContent = state.period === "history" ? "历史里还没有事项" : "这个时间范围没有任务";
    dom.emptyCopy.textContent = filterCount ? "可以调整右侧的搜索和筛选条件。" : "新建一件事，或粘贴一段通知自动整理。";
  }
  renderTimeline(visible);
}


function getMinimalTasks() {
  return themeEvents().filter((event) => event.status !== "done")
    .sort((left, right) => compareEvents(left, right, "deadline"));
}

function getConflictGroup(event, list) {
  const due = toDate(event.dueTime);
  if (!due) return [event];
  const group = [event];
  let changed = true;
  while (changed) {
    changed = false;
    for (const other of list) {
      if (other.id === event.id || other.status === "done" || group.some((item) => item.id === other.id)) continue;
      const otherDue = toDate(other.dueTime);
      if (!otherDue) continue;
      const overlaps = group.some((item) => {
        const itemDue = toDate(item.dueTime);
        return itemDue && Math.abs(itemDue.getTime() - otherDue.getTime()) < 15 * 60000;
      });
      if (overlaps) { group.push(other); changed = true; }
    }
  }
  return group.sort((left, right) => new Date(left.dueTime) - new Date(right.dueTime));
}

function dueConflict(event, list) {
  const group = getConflictGroup(event, list);
  return group.length > 1 ? group.find((item) => item.id !== event.id) || group[0] : null;
}

function conflictBoardMarkup(group) {
  return `
    <div class="minimal-conflict-board">
      <div class="minimal-conflict-head"><strong>检测到 ${group.length} 个时间重叠任务</strong><span>全部展开显示，请删除一项或修改时间后再设置提醒</span></div>
      <div class="minimal-conflict-list">
        ${group.map((event) => {
          const info = PRIORITY_META[getDisplayPriority(event)];
          return `<article class="minimal-conflict-item" style="--priority-color:${info.color}">
            <div><span class="priority-pill">${info.label}</span><span class="category-chip">${escapeHTML(event.category)}</span></div>
            <h3>${escapeHTML(event.title)}</h3>
            <p>${escapeHTML(formatEventTime(event).text)}${event.location ? ` · ${escapeHTML(event.location)}` : ""}</p>
            <div class="minimal-conflict-actions"><button type="button" data-conflict-edit="${escapeHTML(event.id)}">修改时间</button><button type="button" data-conflict-delete="${escapeHTML(event.id)}">删除</button></div>
          </article>`;
        }).join("")}
      </div>
    </div>`;
}

function minimalCardMarkup(event, list, current = false, backIndex = 0) {
  const priority = getDisplayPriority(event);
  const info = PRIORITY_META[priority];
  const timeInfo = formatEventTime(event);
  const conflict = dueConflict(event, list);
  const theme = getTheme(event.themeId);
  return `
    <article class="minimal-task-card ${current ? "is-current" : `deck-back-${backIndex}`} ${conflict ? "has-conflict" : ""}"
      data-task-id="${escapeHTML(event.id)}" style="--priority-color:${info.color}">
      <div class="minimal-card-topline">
        <span class="priority-pill">${info.label}</span>
        <span class="category-chip">${escapeHTML(event.category)}</span>
        ${state.activeThemeId === ALL_THEME_ID ? `<span class="minimal-card-theme">${escapeHTML(theme.icon)} ${escapeHTML(theme.name)}</span>` : ""}
      </div>
      <h3>${escapeHTML(event.title)}</h3>
      <div class="minimal-card-time">${escapeHTML(timeInfo.text)}</div>
      <div class="minimal-card-meta">${event.location ? `<span>⌖ ${escapeHTML(event.location)}</span>` : ""}${event.source ? `<span>来源 · ${escapeHTML(event.source)}</span>` : ""}</div>
      <div class="minimal-card-notes">${escapeHTML(event.nextAction || event.requirements || "暂无补充要求")}</div>
      <div class="minimal-card-badges">
        ${event.reminder15 ? '<span class="minimal-badge reminder">已设置提前 15 分钟提醒</span>' : ""}
        ${conflict ? '<span class="minimal-badge conflict">时间冲突，请删除或修改时间</span>' : ""}
      </div>
    </article>`;
}

function renderMinimalScreen() {
  if (!dom.minimalScreen) return;
  dom.minimalScreen.hidden = state.mode !== "minimal";
  if (state.mode !== "minimal") return;
  updateMinimalSplit(state.minimalSplit);
  const list = getMinimalTasks();
  if (state.minimalIndex >= list.length) state.minimalIndex = Math.max(0, list.length - 1);
  if (state.minimalIndex < 0) state.minimalIndex = 0;
  dom.minimalRangeLabel.textContent = `${getTheme().name} · 全部待办`;
  dom.minimalPageCount.textContent = list.length ? `${state.minimalIndex + 1} / ${list.length}` : "0 / 0";
  dom.minimalEmpty.hidden = list.length > 0;
  dom.minimalDeck.hidden = list.length === 0;
  if (!list.length) {
    dom.minimalDeck.innerHTML = "";
    return;
  }
  const current = list[state.minimalIndex];
  const conflictGroup = getConflictGroup(current, list);
  dom.minimalDeck.classList.toggle("conflict-mode", conflictGroup.length > 1);
  if (conflictGroup.length > 1) {
    dom.minimalPageCount.textContent = `${conflictGroup.length} 个冲突`;
    dom.minimalDeck.innerHTML = conflictBoardMarkup(conflictGroup);
    return;
  }
  const indices = [state.minimalIndex, (state.minimalIndex + 1) % list.length, (state.minimalIndex + 2) % list.length];
  dom.minimalDeck.innerHTML = indices.map((index, position) => minimalCardMarkup(list[index], list, position === 0, position)).join("");
}

function updateMinimalSplit(value) {
  const numeric = Math.max(26, Math.min(74, Number(value) || 50));
  state.minimalSplit = numeric;
  if (dom.minimalScreen) dom.minimalScreen.style.setProperty("--minimal-split", `${numeric}%`);
  if (dom.minimalDivider) dom.minimalDivider.setAttribute("aria-orientation", window.matchMedia("(orientation: portrait)").matches ? "horizontal" : "vertical");
  storageSet(MINIMAL_SPLIT_KEY, String(numeric));
}

function changeMinimalPage(direction) {
  const list = getMinimalTasks();
  if (!list.length) return;
  state.minimalIndex = (state.minimalIndex + direction + list.length) % list.length;
  renderMinimalScreen();
}

function deleteMinimalCurrent() {
  const list = getMinimalTasks();
  const event = list[state.minimalIndex];
  if (!event) return;
  event.deleted = true;
  saveEvents();
  if (state.minimalIndex >= Math.max(0, list.length - 1)) state.minimalIndex = Math.max(0, list.length - 2);
  renderAll();
  showToast("卡片已删除，可重新粘贴恢复");
}

function setMinimalReminder() {
  const list = getMinimalTasks();
  const event = list[state.minimalIndex];
  if (!event) return;
  if (dueConflict(event, list)) {
    showToast("时间存在重叠，请先删除或长按修改时间");
    return;
  }
  if (!event.dueTime) {
    showToast("请先长按卡片补充时间");
    return;
  }
  const minutes = Number(state.reminderSettings.minutes ?? 15);
  if (minutes <= 0) { showToast("请先在提醒设置中选择提前时间"); return; }
  event.reminderMinutes = minutes;
  event.reminder15 = minutes === 15;
  saveEvents();
  downloadReminder(event, minutes);
  renderMinimalScreen();
  showToast(`已标记并生成提前 ${minutes} 分钟提醒`);
}

async function analyzeMinimalInput() {
  const text = dom.minimalInputText.value.trim();
  const imageData = state.minimalImageData;
  if (!text && !imageData) { showToast("请先粘贴通知或上传图片"); return; }
  const inputHash = `minimal-${hashText(imageData && !text ? imageData : text)}`;
  if (state.events.some((event) => !event.deleted && event.rawTextHash === inputHash)) {
    showToast("这段内容已经整理过，已忽略重复输入");
    return;
  }
  const themeId = state.activeThemeId === ALL_THEME_ID ? (state.themes[0]?.id || "study") : state.activeThemeId;
  dom.minimalAnalyzeButton.disabled = true;
  dom.minimalAnalyzeButton.textContent = "正在整理…";
  let tasks;
  try {
    if (isAIConfigured()) {
      tasks = imageData && !text
        ? await analyzeImageWithAI(imageData, themeId)
        : await analyzeWithAI(text, themeId);
    } else {
      await new Promise((resolve) => window.setTimeout(resolve, 420));
      tasks = parseNotice(text || SAMPLE_NOTICE.study, themeId);
      if (imageData && !text) tasks = tasks.map((task) => ({ ...task, source: "图片演示识别" }));
    }
    tasks = (tasks || []).map((task) => ({ ...task, rawTextHash: inputHash }));
    if (!tasks.length) { showToast("没有识别到明确待办"); return; }
    state.events.push(...tasks);
    saveEvents();
    state.minimalIndex = 0;
    dom.minimalInputText.value = "";
    state.minimalImageData = "";
    dom.minimalImagePreviewWrap.hidden = true;
    dom.minimalImageInput.value = "";
    renderAll();
    showToast(`已整理 ${tasks.length} 张待办卡片`);
  } catch (error) {
    showToast(error.message || "整理失败，请稍后再试");
  } finally {
    dom.minimalAnalyzeButton.disabled = false;
    dom.minimalAnalyzeButton.textContent = "整理成待办";
  }
}


function updateDesignPreview() {
  const descriptions = {
    apex: "深色航站 · 绿色强调与专注玻璃面板",
    pixel: "像素田园 · 暖色农场与方块手账质感",
    orbit: "轨道画廊 · 衬线大字与滚动轨道视觉"
  };
  $$(".design-option").forEach((button) => {
    const active = button.dataset.design === state.designTheme;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", active ? "true" : "false");
    button.title = descriptions[button.dataset.design] || "";
  });
  document.documentElement.dataset.design = state.designTheme;
}

function updateScrollThemeMotion() {
  const maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
  const progress = Math.min(1, Math.max(0, window.scrollY / maxScroll));
  document.documentElement.style.setProperty("--page-scroll", String(progress));
  document.documentElement.style.setProperty("--scroll-progress-width", (progress * 100).toFixed(2) + "%");
  document.documentElement.style.setProperty("--scroll-y", Math.min(window.scrollY, 720) + "px");
  document.body.classList.toggle("has-scrolled", window.scrollY > 28);
}

function initScrollThemeMotion() {
  let ticking = false;
  const requestUpdate = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => { updateScrollThemeMotion(); ticking = false; });
  };
  window.addEventListener("scroll", requestUpdate, { passive: true });
  window.addEventListener("resize", requestUpdate);
  updateScrollThemeMotion();
}

function applyDesignTheme(name, persist = true) {
  const allowed = ["apex", "pixel", "orbit"];
  state.designTheme = allowed.includes(name) ? name : "apex";
  document.body.dataset.design = state.designTheme;
  if (activeStorageScope) storageSet(DESIGN_KEY, state.designTheme);
  updateDesignPreview();
  if (persist) scheduleCloudSave();
}

function openDesignModal() {
  $$(".design-option").forEach((button) => button.classList.toggle("is-active", button.dataset.design === state.designTheme));
  openModal("designModal");
}

function updateNotificationStatus() {
  if (!dom.notificationPermissionStatus) return;
  if (!("Notification" in window)) { dom.notificationPermissionStatus.textContent = "当前浏览器不支持通知"; return; }
  const labels = { granted: "已授权", denied: "已拒绝，请在浏览器设置中修改", default: "尚未授权" };
  dom.notificationPermissionStatus.textContent = labels[Notification.permission] || "未知状态";
}

async function requestNotificationPermission() {
  if (!("Notification" in window)) { showToast("当前浏览器不支持通知权限"); return false; }
  const permission = await Notification.requestPermission();
  updateNotificationStatus();
  showToast(permission === "granted" ? "通知权限已开启" : "通知权限未开启");
  return permission === "granted";
}

function scheduleTaskNotifications() {
  notificationTimers.forEach((timer) => window.clearTimeout(timer));
  notificationTimers.clear();
  if (!state.reminderSettings.enabled || !("Notification" in window) || Notification.permission !== "granted") return;
  const now = Date.now();
  state.events.filter((event) => !event.deleted && event.status !== "done" && event.dueTime && Number(event.reminderMinutes) > 0)
    .forEach((event) => {
      const due = new Date(event.dueTime).getTime();
      const triggerAt = due - Number(event.reminderMinutes) * 60000;
      const delay = triggerAt - now;
      if (delay > 0 && delay < 24 * 60 * 60 * 1000) {
        const timer = window.setTimeout(() => {
          try {
            new Notification("别急 DDL 任务提醒", { body: `${event.title} · ${event.location || "查看任务详情"}`, tag: event.id });
          } catch (error) { /* Notification can fail in background-restricted browsers. */ }
        }, delay);
        notificationTimers.set(event.id, timer);
      }
    });
}

function openReminderSettings() {
  dom.reminderEnabled.checked = Boolean(state.reminderSettings.enabled);
  dom.defaultReminderMinutes.value = String(state.reminderSettings.minutes ?? 15);
  updateNotificationStatus();
  openModal("reminderModal");
}

function saveReminderSettings() {
  state.reminderSettings = {
    enabled: dom.reminderEnabled.checked,
    minutes: Number(dom.defaultReminderMinutes.value || 0)
  };
  storageSet(REMINDER_SETTINGS_KEY, JSON.stringify(state.reminderSettings));
  scheduleCloudSave();
  scheduleTaskNotifications();
  closeModal("reminderModal");
  showToast("提醒设置已保存");
}


function saveFocusSession() {
  if (state.focusSession) storageSet(FOCUS_KEY, JSON.stringify(state.focusSession));
  else storageRemove(FOCUS_KEY);
}

function loadFocusSession() {
  try {
    const saved = JSON.parse(storageGet(FOCUS_KEY) || "null");
    if (saved && saved.status !== "done") {
      state.focusSession = saved;
      if (saved.status === "running" && saved.endAt) saved.remainingSeconds = Math.max(0, Math.ceil((saved.endAt - Date.now()) / 1000));
    }
  } catch (error) { state.focusSession = null; }
}

function formatFocusTime(seconds) {
  const safe = Math.max(0, Math.floor(seconds || 0));
  return `${String(Math.floor(safe / 60)).padStart(2, "0")}:${String(safe % 60).padStart(2, "0")}`;
}

function openFocusModal() {
  if (!dom.focusStartTime.value) {
    const date = new Date(Date.now() + 30 * 60000);
    date.setSeconds(0, 0);
    dom.focusStartTime.value = toLocalInputValue(date);
  }
  dom.focusSetup.hidden = Boolean(state.focusSession);
  dom.focusFlight.hidden = !state.focusSession;
  dom.focusSky.dataset.sky = state.focusSky;
  $$(".focus-preset").forEach((button) => button.classList.toggle("is-active", button.dataset.focusSky === state.focusSky));
  renderFocusSession();
  openModal("focusModal");
}

function renderFocusSession() {
  if (!state.focusSession) return;
  const session = state.focusSession;
  if (session.status === "running" && session.endAt) session.remainingSeconds = Math.max(0, Math.ceil((session.endAt - Date.now()) / 1000));
  const total = Math.max(1, Number(session.durationSeconds || 1));
  const progress = Math.min(1, Math.max(0, 1 - Number(session.remainingSeconds || 0) / total));
  dom.focusSessionTitle.textContent = session.title || "专注中";
  dom.focusRemaining.textContent = formatFocusTime(session.remainingSeconds);
  dom.focusRouteFill.style.width = `${progress * 100}%`;
  const skyWidth = dom.focusSky.clientWidth || 500;
  dom.focusPlane.style.left = `${28 + progress * Math.max(0, skyWidth - 82)}px`;
  dom.focusPlane.classList.toggle("is-flying", session.status === "running");
  dom.focusPauseButton.textContent = session.status === "paused" ? "继续" : "暂停";
  dom.focusSetup.hidden = true;
  dom.focusFlight.hidden = false;
}

function playFocusChime() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const context = new AudioContext();
    [523.25, 659.25, 783.99].forEach((frequency, index) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.frequency.value = frequency;
      oscillator.type = "sine";
      gain.gain.setValueAtTime(0.0001, context.currentTime + index * 0.18);
      gain.gain.exponentialRampToValueAtTime(0.14, context.currentTime + index * 0.18 + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + index * 0.18 + 0.5);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start(context.currentTime + index * 0.18);
      oscillator.stop(context.currentTime + index * 0.18 + 0.55);
    });
  } catch (error) { /* Audio may be blocked until user interaction. */ }
}

function finishFocusSession() {
  const session = state.focusSession;
  if (!session) return;
  window.clearInterval(focusTimer);
  focusTimer = null;
  playFocusChime();
  if ("Notification" in window && Notification.permission === "granted") {
    try { new Notification("专注完成", { body: `${session.title || "专注练习"}已完成，休息一下。`, tag: "bieji-focus" }); } catch (error) {}
  }
  state.focusSession = null;
  saveFocusSession();
  dom.focusSetup.hidden = false;
  dom.focusFlight.hidden = true;
  showToast("专注完成，休息一下");
}

function startFocusTimer() {
  const minutes = Number(dom.focusDuration.value || 25);
  const title = dom.focusTaskTitle.value.trim() || "专注练习";
  state.focusSession = { title, durationMinutes: minutes, durationSeconds: minutes * 60, remainingSeconds: minutes * 60, startAt: Date.now(), endAt: Date.now() + minutes * 60000, status: "running" };
  saveFocusSession();
  window.clearInterval(focusTimer);
  focusTimer = window.setInterval(() => {
    if (!state.focusSession || state.focusSession.status !== "running") return;
    state.focusSession.remainingSeconds = Math.max(0, Math.ceil((state.focusSession.endAt - Date.now()) / 1000));
    if (state.focusSession.remainingSeconds <= 0) finishFocusSession();
    else renderFocusSession();
  }, 1000);
  renderFocusSession();
  showToast("专注航线已起飞");
}

function toggleFocusPause() {
  if (!state.focusSession) return;
  if (state.focusSession.status === "running") {
    state.focusSession.remainingSeconds = Math.max(0, Math.ceil((state.focusSession.endAt - Date.now()) / 1000));
    state.focusSession.status = "paused";
    state.focusSession.endAt = null;
    showToast("专注已暂停");
  } else {
    state.focusSession.status = "running";
    state.focusSession.endAt = Date.now() + state.focusSession.remainingSeconds * 1000;
    showToast("继续专注");
  }
  saveFocusSession();
  renderFocusSession();
}

function stopFocusTimer() {
  if (!state.focusSession) return;
  if (!window.confirm("结束本次专注？")) return;
  window.clearInterval(focusTimer);
  focusTimer = null;
  state.focusSession = null;
  saveFocusSession();
  dom.focusSetup.hidden = false;
  dom.focusFlight.hidden = true;
}

function addFocusToTimeline() {
  const title = dom.focusTaskTitle.value.trim() || "专注练习";
  const minutes = Number(dom.focusDuration.value || 25);
  const dueValue = dom.focusStartTime.value || toLocalInputValue(new Date());
  const themeId = state.activeThemeId === ALL_THEME_ID ? (state.themes[0]?.id || "study") : state.activeThemeId;
  const event = { id: uid(), themeId, title, category: "专注", source: "专注航线", dueTime: toISOStringFromLocal(dueValue), location: "专注模式", nextAction: `开始 ${minutes} 分钟专注`, requirements: `本次计划专注 ${minutes} 分钟。`, urgency: "auto", reminderMinutes: Number(state.reminderSettings.minutes || 15), status: "todo" };
  state.events.push(event);
  saveEvents();
  setPeriodForDate(event.dueTime);
  closeModal("focusModal");
  renderAll();
  showToast("专注安排已加入时间线");
}

function renderAll() {
  renderThemes();
  renderThemeHero();
  renderTasks();
  updateAIStatus();
  if (dom.desktopPet) renderPet();
  if (dom.minimalScreen) renderMinimalScreen();
  scheduleTaskNotifications();
  updatePersonalPanel();
}

let toastTimer = null;
function showToast(message) {
  dom.toast.textContent = message;
  dom.toast.classList.add("is-visible");
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => dom.toast.classList.remove("is-visible"), 2300);
}
function openModal(id) {
  const modal = document.getElementById(id);
  if (!modal) return;
  modal.classList.add("is-open");
  modal.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
  window.setTimeout(() => {
    const field = $("input:not([type='file']), textarea, select", modal);
    if (field) field.focus();
  }, 100);
}

function closeModal(id) {
  const modal = document.getElementById(id);
  if (!modal) return;
  modal.classList.remove("is-open");
  modal.setAttribute("aria-hidden", "true");
  if (!document.querySelector(".modal.is-open")) document.body.style.overflow = "";
}

function closeAllModals() {
  $$(".modal.is-open").forEach((modal) => {
    modal.classList.remove("is-open");
    modal.setAttribute("aria-hidden", "true");
  });
  document.body.style.overflow = "";
}

function updateScrim() {
  const open = document.body.classList.contains("left-open") || document.body.classList.contains("right-open");
  dom.sidebarScrim.hidden = !open;
}

function closeMobileSidebars() {
  document.body.classList.remove("left-open", "right-open");
  updateScrim();
}

function populateThemeSelects() {
  const options = state.themes.map((theme) => `<option value="${escapeHTML(theme.id)}">${escapeHTML(theme.icon)} ${escapeHTML(theme.name)}</option>`).join("");
  dom.taskTheme.innerHTML = options;
  dom.importTheme.innerHTML = options;
  dom.taskTheme.value = state.activeThemeId;
  dom.importTheme.value = state.activeThemeId;
}

function populateTaskCategories(selected = "作业") {
  const custom = Array.from(new Set(themeEvents().map((event) => event.category).filter((category) => category && !BASIC_CATEGORIES.includes(category)))).sort();
  const standard = BASIC_CATEGORIES.map((category) => `<option value="${escapeHTML(category)}">${escapeHTML(category)}</option>`).join("");
  const extra = custom.map((category) => `<option value="${escapeHTML(category)}">${escapeHTML(category)}</option>`).join("");
  dom.taskCategory.innerHTML = `${standard}${extra}<option value="custom">自定义类型</option>`;
  dom.taskCategory.value = selected;
}

function setPeriodForDate(value) {
  const date = toDate(value);
  if (!date) return;
  const diff = Math.round((startOfDay(date) - startOfDay(new Date())) / 86400000);
  state.period = diff <= 0 ? "today" : diff === 1 ? "tomorrow" : diff < 7 ? "week" : "month";
}

function switchTheme(themeId) {
  if (themeId !== ALL_THEME_ID && !state.themes.some((theme) => theme.id === themeId)) return;
  state.activeThemeId = themeId;
  state.query = "";
  state.filters = { category: "", source: "", urgency: "", location: "", status: "" };
  closeMobileSidebars();
  renderAll();
}

function openTaskModal(themeId = state.activeThemeId) {
  dom.taskForm.reset();
  populateThemeSelects();
  if (themeId === ALL_THEME_ID) themeId = state.themes[0]?.id || "";
  dom.taskTheme.value = themeId;
  populateTaskCategories("作业");
  dom.taskCategory.value = "作业";
  dom.taskDueTime.value = toLocalInputValue(dateAt(1, 20, 0));
  dom.taskUrgency.value = "auto";
  dom.taskReminderMinutes.value = String(state.reminderSettings.minutes ?? 15);
  dom.customCategoryField.hidden = true;
  openModal("taskModal");
}

function handleTaskSubmit(event) {
  event.preventDefault();
  const title = dom.taskTitle.value.trim();
  if (!title) { dom.taskTitle.focus(); return; }
  const category = dom.taskCategory.value === "custom"
    ? (dom.taskCustomCategory.value.trim() || "自定义")
    : dom.taskCategory.value;
  const themeId = dom.taskTheme.value;
  const dueTime = toISOStringFromLocal(dom.taskDueTime.value);
  const newEvent = {
    id: uid(),
    themeId,
    title,
    category,
    source: dom.taskSource.value.trim() || "手动添加",
    dueTime,
    location: dom.taskLocation.value.trim(),
    nextAction: dom.taskNextAction.value.trim() || "先确认要求和截止时间",
    requirements: dom.taskRequirements.value.trim(),
    urgency: dom.taskUrgency.value,
    reminderMinutes: Number(dom.taskReminderMinutes.value || 0),
    status: "todo"
  };
  state.events.push(newEvent);
  saveEvents();
  state.activeThemeId = themeId;
  setPeriodForDate(dueTime);
  closeModal("taskModal");
  renderAll();
  showToast(`已加入“${getTheme().name}”主题`);
}

function openThemeEditor(themeId = null) {
  const theme = themeId ? state.themes.find((item) => item.id === themeId) : null;
  state.editingThemeId = theme ? theme.id : null;
  state.themeBackgroundDraft = theme?.backgroundImage || "";
  dom.themeForm.reset();
  dom.themeModalTitle.textContent = theme ? "编辑主题" : "新建一个主题";
  dom.themeForm.querySelector('button[type="submit"]').textContent = theme ? "保存主题" : "创建主题";
  dom.themeFormName.value = theme?.name || "";
  dom.themeFormIcon.value = theme?.icon || "📚";
  dom.themeFormColor.value = theme?.color || "green";
  dom.themeFormDescription.value = theme?.description || "";
  dom.themeImagePreview.src = state.themeBackgroundDraft;
  dom.themeImagePreviewWrap.hidden = !state.themeBackgroundDraft;
  openModal("themeModal");
}

function handleThemeSubmit(event) {
  event.preventDefault();
  const name = dom.themeFormName.value.trim();
  if (!name) { dom.themeFormName.focus(); return; }
  const existing = state.editingThemeId ? state.themes.find((theme) => theme.id === state.editingThemeId) : null;
  const theme = {
    id: existing?.id || `custom-${Date.now()}`,
    name,
    icon: dom.themeFormIcon.value,
    color: dom.themeFormColor.value,
    description: dom.themeFormDescription.value.trim() || existing?.description || "自定义主题空间",
    backgroundImage: state.themeBackgroundDraft
  };
  if (existing) Object.assign(existing, theme);
  else state.themes.push(theme);
  saveThemes();
  state.activeThemeId = theme.id;
  if (!existing) { state.period = "today"; state.query = ""; state.filters = { category: "", source: "", urgency: "", location: "", status: "" }; }
  state.editingThemeId = null;
  dom.themeForm.reset();
  closeModal("themeModal");
  renderAll();
  showToast(existing ? `主题“${theme.name}”已更新` : `主题“${theme.name}”已创建`);
}

function toggleComplete(id) {
  const event = state.events.find((item) => item.id === id);
  if (!event) return;
  event.status = event.status === "done" ? "todo" : "done";
  saveEvents();
  renderAll();
  showToast(event.status === "done" ? "已移入历史" : "已恢复为待处理");
}
function categoryFromText(text) {
  for (const rule of state.keywordRules) {
    const terms = String(rule.keywords || "").split(/[,，、\s]+/).filter(Boolean);
    if (terms.some((term) => text.includes(term))) return rule.label || "自定义";
  }
  return "上课";
}
function splitKeywords(value) {
  return String(value || "").split(/[,，、\s]+/).map((item) => item.trim()).filter(Boolean);
}
function urgencyFromText(text) {
  const urgent = splitKeywords(state.aiConfig.urgentKeywords);
  return urgent.some((keyword) => text.includes(keyword)) ? "red" : "auto";
}

function nextActionFor(category) {
  return {
    "上课": "确认教室，带齐课程材料",
    "作业": "打开任务要求，先完成最小的一部分",
    "打卡": "确认打卡入口，设置提前提醒",
    "表单": "核对所需材料，预留填写时间",
    "网课": "查看平台要求，标记必须完成的节点",
    "考试": "确认考试范围和地点，安排复习",
    "运动": "确认时间和场地，提前做好准备",
    "游戏": "确认活动时间，提前更新并上线",
    "生活": "先处理最小的一步，避免继续拖延"
  }[category] || "先确认要求和截止时间";
}

function extractSource(text) {
  const match = text.match(/【([^】]+)】/);
  return match ? match[1] : "粘贴通知";
}

function extractTitle(segment) {
  const clean = segment.replace(/【[^】]+】/g, "").replace(/^(同学们|大家|请注意|提醒)[，,：:\s]*/, "").trim();
  const parts = clean.split(/[，,]/).map((part) => part.trim()).filter(Boolean);
  let candidate = parts.find((part) => /提交|交|打卡|填写|考试|测验|完成|复习|作业|报告|PPT|讨论|比赛|夜跑|训练|游戏|快递|值日/.test(part)) || parts[0] || clean;
  candidate = candidate.replace(/^(今天|明天|后天|本周[一二三四五六日天]|下周[一二三四五六日天]|周[一二三四五六日天]|星期[一二三四五六日天])?(上午|中午|下午|晚上|晚)?\s*\d{1,2}(?:[:：点时]\d{0,2})?\s*(?:前|之前)?\s*/, "").replace(/^(请|需要|记得)?\s*/, "").trim();
  return candidate || clean.slice(0, 48) || "待确认事项";
}

function extractLocation(text) {
  const match = text.match(/(?:地点|教室|考场)(?:在|是|[:：])?\s*([^\s，,。；;]+)/);
  return match ? match[1] : "";
}

function weekdayTarget(char) { return { "一": 1, "二": 2, "三": 3, "四": 4, "五": 5, "六": 6, "日": 0, "天": 0 }[char] ?? 1; }
function resolveWeekday(target, mode = "upcoming") {
  const today = startOfDay(new Date());
  const current = today.getDay();
  const monday = addDays(today, current === 0 ? -6 : 1 - current);
  const index = target === 0 ? 6 : target - 1;
  let date = addDays(monday, index);
  if (mode === "nextWeek") date = addDays(date, 7);
  if (mode === "upcoming" && date < today) date = addDays(date, 7);
  return date;
}

function inferDueTime(text) {
  let date = startOfDay(new Date());
  let matchedDate = false;
  if (/今天/.test(text)) { date = dateAt(0, 23, 59); matchedDate = true; }
  else if (/明天/.test(text)) { date = dateAt(1, 23, 59); matchedDate = true; }
  else if (/后天/.test(text)) { date = dateAt(2, 23, 59); matchedDate = true; }
  else {
    const nextWeekMatch = text.match(/下周([一二三四五六日天])/);
    const thisWeekMatch = text.match(/本周([一二三四五六日天])/);
    const upcomingMatch = text.match(/(?:周|星期)([一二三四五六日天])/);
    if (nextWeekMatch) { date = resolveWeekday(weekdayTarget(nextWeekMatch[1]), "nextWeek"); matchedDate = true; }
    else if (thisWeekMatch) { date = resolveWeekday(weekdayTarget(thisWeekMatch[1]), "thisWeek"); matchedDate = true; }
    else if (upcomingMatch) { date = resolveWeekday(weekdayTarget(upcomingMatch[1]), "upcoming"); matchedDate = true; }
  }
  const timeMatch = text.match(/(\d{1,2})(?:[:：点时](\d{1,2})?)/);
  let hours = 23;
  let minutes = 59;
  if (timeMatch) {
    hours = Number(timeMatch[1]);
    minutes = timeMatch[2] ? Number(timeMatch[2]) : 0;
    const prefix = text.slice(Math.max(0, timeMatch.index - 4), timeMatch.index);
    if (/(晚|下午|傍晚)/.test(prefix) && hours < 12) hours += 12;
    if (hours > 23) hours = 23;
    if (minutes > 59) minutes = 0;
  }
  if (!matchedDate) date = startOfDay(new Date());
  date.setHours(hours, minutes, 0, 0);
  return date;
}

function parseNotice(text, themeId) {
  const segments = text.replace(/\r/g, "").split(/[。；;\n]+/).map((segment) => segment.replace(/^[，,\s]+|[，,\s]+$/g, "").trim()).filter((segment) => segment.length > 3);
  const source = extractSource(text);
  const ignored = splitKeywords(state.aiConfig.ignoredKeywords);
  const tasks = [];
  for (const segment of segments.slice(0, 4)) {
    if (ignored.some((keyword) => segment.includes(keyword))) continue;
    const category = categoryFromText(segment);
    if (category === "上课" && !/课|教室|课程/.test(segment)) continue;
    tasks.push({
      title: extractTitle(segment),
      themeId,
      category,
      source,
      dueTime: inferDueTime(segment).toISOString(),
      location: extractLocation(segment),
      nextAction: nextActionFor(category),
      requirements: segment,
      urgency: urgencyFromText(segment),
      status: "todo"
    });
  }
  if (!tasks.length && text.trim()) {
    const category = categoryFromText(text);
    tasks.push({ title: text.trim().slice(0, 48), themeId, category, source, dueTime: "", location: extractLocation(text), nextAction: nextActionFor(category), requirements: text.trim(), urgency: "auto", status: "todo" });
  }
  return tasks;
}

function renderPreview() {
  dom.previewTitle.textContent = `识别到 ${state.preview.length} 件事`;
  dom.previewList.innerHTML = state.preview.map((item, index) => `
    <div class="preview-item" data-preview-index="${index}">
      <input class="preview-title" type="text" value="${escapeHTML(item.title)}" aria-label="事项标题">
      <input class="preview-due" type="datetime-local" value="${escapeHTML(toLocalInputValue(item.dueTime))}" aria-label="事项时间">
      <button class="preview-remove" type="button" data-remove-preview="${index}" aria-label="移除这一项">×</button>
    </div>
  `).join("");
  dom.previewPanel.hidden = false;
}

function isAIConfigured() {
  const cloudAI = Boolean(window.BiejiCloud?.isReady() && window.BiejiCloud.aiEnabled);
  return cloudAI || Boolean(state.aiConfig.baseUrl && state.aiConfig.model && state.aiConfig.apiKey);
}

function buildAIPrompt(text) {
  const rules = state.keywordRules.map((rule) => `${rule.label}: ${rule.keywords}`).join("\n");
  return `你是校园任务整理助手。请从通知中提取任务，只输出 JSON 对象，不要输出 Markdown 或解释。
当前时间：${new Date().toISOString()}
用户自定义任务类型关键词：
${rules}
紧急词：${state.aiConfig.urgentKeywords}
忽略词：${state.aiConfig.ignoredKeywords}

输出格式：
{
  "tasks": [
    {
      "title": "任务名",
      "category": "任务类型",
      "source": "信息来源",
      "due": "YYYY-MM-DDTHH:mm 或空字符串",
      "urgency": "auto|red|yellow|green",
      "location": "地点或空字符串",
      "firstStep": "下一步行动",
      "requirements": "原始要求摘要"
    }
  ]
}
规则：最多 6 项；不要编造日期；忽略广告和自愿内容；只输出 JSON。
通知：
${text}`;
}

async function analyzeWithAI(text, themeId, imageData = "") {
  if (window.BiejiCloud?.isReady() && window.BiejiCloud.aiEnabled) {
    const cloudResult = await window.BiejiCloud.parseNotice({
      text,
      imageData,
      themeId,
      keywordRules: state.keywordRules,
      urgentKeywords: state.aiConfig.urgentKeywords,
      ignoredKeywords: state.aiConfig.ignoredKeywords
    });
    const items = Array.isArray(cloudResult.tasks) ? cloudResult.tasks : [];
    if (!items.length) throw new Error("云端 AI 没有返回任务");
    return items.slice(0, 6).map((item) => {
      const date = toDate(item.due || item.dueTime || "");
      return {
        title: String(item.title || "待确认事项").slice(0, 80),
        themeId,
        category: String(item.category || "作业").slice(0, 30),
        source: String(item.source || extractSource(text)).slice(0, 40),
        dueTime: date ? date.toISOString() : "",
        location: String(item.location || "").slice(0, 80),
        nextAction: String(item.firstStep || item.nextAction || nextActionFor(item.category || "作业")).slice(0, 100),
        requirements: String(item.requirements || "").slice(0, 300),
        urgency: ["red", "yellow", "green"].includes(item.urgency) ? item.urgency : "auto",
        status: "todo"
      };
    });
  }
  const base = state.aiConfig.baseUrl.replace(/\/$/, "");
  const endpoint = base.endsWith("/chat/completions") ? base : `${base}/chat/completions`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${state.aiConfig.apiKey}` },
    body: JSON.stringify({
      model: state.aiConfig.model,
      temperature: 0.2,
      messages: [
        { role: "system", content: "你只输出合法 JSON。" },
        { role: "user", content: imageData ? [
          { type: "text", text: buildAIPrompt(text) },
          { type: "image_url", image_url: { url: imageData } }
        ] : buildAIPrompt(text) }
      ]
    })
  });
  if (!response.ok) throw new Error(`AI 接口返回 ${response.status}`);
  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || "";
  const clean = content.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "").trim();
  const parsed = JSON.parse(clean);
  if (!Array.isArray(parsed.tasks) || !parsed.tasks.length) throw new Error("AI 没有返回任务");
  return parsed.tasks.slice(0, 6).map((item) => {
    const due = item.due || item.dueTime || "";
    const date = toDate(due);
    return {
      title: String(item.title || "待确认事项").slice(0, 80),
      themeId,
      category: String(item.category || "作业").slice(0, 30),
      source: String(item.source || extractSource(text)).slice(0, 40),
      dueTime: date ? date.toISOString() : "",
      location: String(item.location || "").slice(0, 80),
      nextAction: String(item.firstStep || item.nextAction || nextActionFor(item.category || "作业")).slice(0, 100),
      requirements: String(item.requirements || "").slice(0, 300),
      urgency: ["red", "yellow", "green"].includes(item.urgency) ? item.urgency : "auto",
      status: "todo"
    };
  });
}

function hashText(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16);
}

async function analyzeImageWithAI(imageData, themeId) {
  return analyzeWithAI("请识别图片中的课程通知、作业要求、考试安排或活动信息，并整理成待办。", themeId, imageData);
}

async function analyzeNotice() {
  const text = dom.noticeInput.value.trim();
  if (!text) { showToast("请先粘贴一段通知"); dom.noticeInput.focus(); return; }
  dom.previewPanel.hidden = true;
  dom.analysisLoading.hidden = false;
  dom.analyzeButton.disabled = true;
  dom.analyzeButton.textContent = "正在整理…";
  let notice = "";
  try {
    if (isAIConfigured()) {
      try {
        state.preview = await analyzeWithAI(text, dom.importTheme.value);
        notice = "大模型识别完成";
      } catch (error) {
        state.preview = parseNotice(text, dom.importTheme.value);
        notice = "大模型不可用，已使用本地关键词规则";
      }
    } else {
      await new Promise((resolve) => window.setTimeout(resolve, 520));
      state.preview = parseNotice(text, dom.importTheme.value);
      notice = "本地关键词识别完成";
    }
    state.importTextHash = hashText(text);
    state.preview = state.preview.map((item) => ({ ...item, rawTextHash: state.importTextHash }));
    if (!state.preview.length) { showToast("没有识别到明确事项，请调整关键词或通知内容"); return; }
    renderPreview();
    showToast(notice);
  } finally {
    dom.analysisLoading.hidden = true;
    dom.analyzeButton.disabled = false;
    dom.analyzeButton.textContent = "AI 帮我整理";
  }
}

function confirmImport() {
  const rows = $$(".preview-item", dom.previewList);
  const themeId = dom.importTheme.value;
  if (state.importTextHash && state.events.some((event) => !event.deleted && event.rawTextHash === state.importTextHash)) {
    showToast("这段通知已经整理过，已忽略重复输入");
    return;
  }
  const imported = rows.map((row) => {
    const item = state.preview[Number(row.dataset.previewIndex)];
    return {
      ...item,
      id: uid(),
      themeId,
      title: $(".preview-title", row).value.trim() || item.title,
      dueTime: toISOStringFromLocal($(".preview-due", row).value),
      rawTextHash: state.importTextHash
    };
  }).filter((item) => item.title);
  if (!imported.length) { showToast("至少保留一件事项"); return; }

  state.events.push(...imported);
  saveEvents();
  state.activeThemeId = themeId;
  const firstDate = imported.map((item) => toDate(item.dueTime)).find(Boolean);
  if (firstDate) setPeriodForDate(firstDate);
  state.preview = [];
  dom.noticeInput.value = "";
  dom.previewPanel.hidden = true;
  closeModal("importModal");
  renderAll();
  showToast(`已加入 ${imported.length} 件事项`);
}
function getReminderMinutes(event) {
  const own = Number(event.reminderMinutes);
  if (Number.isFinite(own) && own >= 0) return own;
  return { "上课": 30, "作业": 120, "打卡": 30, "表单": 30, "网课": 120, "考试": 1440, "运动": 30, "游戏": 30, "生活": 30, "专注": 5 }[event.category] || 30;
}
function reminderText(minutes) {
  if (Number(minutes) === 0) return "不提醒";
  if (minutes >= 1440) return `提前 ${minutes / 1440} 天`;
  if (minutes >= 60) return `提前 ${minutes / 60} 小时`;
  return `提前 ${minutes} 分钟`;
}

function openDetail(id) {
  const event = state.events.find((item) => item.id === id);
  if (!event) return;
  state.activeEventId = id;
  const priority = getDisplayPriority(event);
  const info = PRIORITY_META[priority];
  const manual = event.urgency && event.urgency !== "auto" ? " · 手动设置" : " · 自动判断";
  dom.detailCategory.textContent = `${event.category} · 事项详情`;
  dom.detailTitle.textContent = event.title;
  dom.detailPriority.innerHTML = `<span class="priority-bubble" style="background:${info.color}"></span><span>${info.label}${manual} · ${info.hint} · 建议${reminderText(getReminderMinutes(event))}提醒</span>`;
  dom.detailPriority.style.background = priority === "red" ? "var(--red-soft)" : priority === "yellow" ? "var(--yellow-soft)" : priority === "green" ? "var(--green-soft)" : "var(--gray-soft)";
  dom.detailTime.textContent = formatFullDateTime(event.dueTime);
  dom.detailLocation.textContent = event.location || "未设置";
  dom.detailSource.textContent = event.source || "未标注来源";
  dom.detailType.textContent = event.category || "未设置";
  dom.detailNextAction.textContent = event.nextAction || "还没有填写下一步行动";
  dom.detailRequirements.textContent = event.requirements || "还没有填写详细要求";
  dom.detailCompleteButton.textContent = event.status === "done" ? "撤销完成" : "标记完成";
  dom.detailReminderButton.disabled = !event.dueTime;
  dom.detailEditPanel.hidden = true;
  openModal("detailModal");
}

function icsEscape(value) { return String(value || "").replaceAll("\\", "\\\\").replaceAll("\n", "\\n").replaceAll(",", "\\,").replaceAll(";", "\\;"); }
function toICSDate(value) { const date = toDate(value); return date ? date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z") : ""; }
function downloadReminder(event, overrideMinutes = null) {
  const due = toDate(event.dueTime);
  if (!due) { showToast("请先补充事项时间"); return; }
  const minutes = overrideMinutes ?? getReminderMinutes(event);
  if (Number(minutes) === 0) { showToast("这个任务设置为不提醒"); return; }
  const end = new Date(due.getTime() + 30 * 60000);
  const lines = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Bieji DDL 2//Campus Timeline//ZH-CN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
    "BEGIN:VEVENT", `UID:${icsEscape(event.id)}@bieji-ddl.v2`, `DTSTAMP:${toICSDate(new Date())}`, `DTSTART:${toICSDate(due)}`, `DTEND:${toICSDate(end)}`,
    `SUMMARY:${icsEscape(event.title)}`, `LOCATION:${icsEscape(event.location || "")}`,
    `DESCRIPTION:${icsEscape(`${event.nextAction || ""}\n${event.requirements || ""}\n来源：${event.source || "未标注来源"}`)}`,
    "BEGIN:VALARM", `TRIGGER:-PT${minutes}M`, "ACTION:DISPLAY", `DESCRIPTION:${icsEscape(`别急 DDL：${event.title}`)}`, "END:VALARM",
    "END:VEVENT", "END:VCALENDAR"
  ];
  const blob = new Blob([lines.join("\r\n")], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${event.title.replace(/[\\/:*?"<>|]/g, "").slice(0, 30) || "事项提醒"}.ics`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  showToast(`已生成日历提醒，${reminderText(minutes)}`);
}
function handleCardClick(event) {
  const completeButton = event.target.closest("[data-complete]");
  if (completeButton) { event.stopPropagation(); toggleComplete(completeButton.dataset.complete); return; }
  const undoButton = event.target.closest("[data-undo]");
  if (undoButton) { event.stopPropagation(); toggleComplete(undoButton.dataset.undo); return; }
  const card = event.target.closest("[data-event-id]");
  if (card) openDetail(card.dataset.eventId);
}
function handleCardKeydown(event) {
  if (event.key !== "Enter" && event.key !== " ") return;
  if (event.target.closest("button")) return;
  const card = event.target.closest("[data-event-id]");
  if (!card) return;
  event.preventDefault();
  openDetail(card.dataset.eventId);
}

function handleSidebarToggle() {
  if (window.matchMedia("(max-width: 900px)").matches) {
    const opening = !document.body.classList.contains("left-open");
    document.body.classList.toggle("left-open", opening);
    document.body.classList.remove("right-open");
    dom.sidebarToggle.setAttribute("aria-expanded", opening ? "true" : "false");
    updateScrim();
    return;
  }
  document.body.classList.toggle("left-collapsed");
  dom.sidebarToggle.setAttribute("aria-expanded", document.body.classList.contains("left-collapsed") ? "false" : "true");
  document.body.classList.remove("right-open");
  updateScrim();
}

function handleMobileFilter() {
  const opening = !document.body.classList.contains("right-open");
  document.body.classList.toggle("right-open", opening);
  document.body.classList.remove("left-open");
  updateScrim();
}

function bindSidebars() {
  dom.sidebarToggle.addEventListener("click", handleSidebarToggle);
  dom.sidebarCollapseButton.addEventListener("click", () => {
    if (window.matchMedia("(max-width: 900px)").matches) {
      document.body.classList.remove("left-open");
      updateScrim();
    } else {
      document.body.classList.toggle("left-collapsed");
      dom.sidebarToggle.setAttribute("aria-expanded", document.body.classList.contains("left-collapsed") ? "false" : "true");
    }
  });
  dom.mobileFilterButton.addEventListener("click", handleMobileFilter);
  dom.closeFilterButton.addEventListener("click", () => { document.body.classList.remove("right-open"); updateScrim(); });
  dom.sidebarScrim.addEventListener("click", closeMobileSidebars);
  window.addEventListener("resize", () => {
    if (window.innerWidth > 900) document.body.classList.remove("left-open");
    if (window.innerWidth > 1280) document.body.classList.remove("right-open");
    updateScrim();
  });
}

function bindFilters() {
  dom.searchInput.addEventListener("input", () => { state.query = dom.searchInput.value; renderTasks(); });
  dom.categoryFilter.addEventListener("change", () => { state.filters.category = dom.categoryFilter.value; renderTasks(); });
  dom.sourceFilter.addEventListener("change", () => { state.filters.source = dom.sourceFilter.value; renderTasks(); });
  dom.locationFilter.addEventListener("input", () => { state.filters.location = dom.locationFilter.value; renderTasks(); });
  dom.statusFilter.addEventListener("change", () => { state.filters.status = dom.statusFilter.value; renderTasks(); });
  dom.urgencyChips.addEventListener("click", (event) => {
    const button = event.target.closest("[data-urgency]");
    if (!button) return;
    state.filters.urgency = button.dataset.urgency;
    renderTasks();
  });
  dom.clearFiltersButton.addEventListener("click", () => {
    state.query = "";
    state.filters = { category: "", source: "", urgency: "", location: "", status: "" };
    renderTasks();
  });
  dom.periodTabs.addEventListener("click", (event) => {
    const button = event.target.closest("[data-period]");
    if (!button) return;
    state.period = button.dataset.period;
    renderTasks();
  });
  dom.sortSelect.addEventListener("change", () => { state.sort = dom.sortSelect.value; renderTasks(); });
}

function bindThemeAndTaskActions() {
  dom.themeList.addEventListener("click", (event) => {
    const button = event.target.closest("[data-theme-id]");
    if (button) switchTheme(button.dataset.themeId);
  });
  [dom.openAddButton, dom.newTaskSideButton, dom.floatingAddButton, dom.emptyAddButton].forEach((button) => {
    button.addEventListener("click", () => openTaskModal(state.activeThemeId));
  });
  dom.newThemeButton.addEventListener("click", () => openThemeEditor(null));
  dom.taskForm.addEventListener("submit", handleTaskSubmit);
  dom.themeForm.addEventListener("submit", handleThemeSubmit);
  dom.taskCategory.addEventListener("change", () => {
    const custom = dom.taskCategory.value === "custom";
    dom.customCategoryField.hidden = !custom;
    if (custom) window.setTimeout(() => dom.taskCustomCategory.focus(), 50);
  });
  dom.taskTheme.addEventListener("change", () => populateTaskCategories("作业"));
}

function bindImportActions() {
  dom.openImportButton.addEventListener("click", () => {
    populateThemeSelects();
    dom.previewPanel.hidden = true;
    dom.analysisLoading.hidden = true;
    updateAIStatus();
    openModal("importModal");
  });
  dom.aiSettingsButton.addEventListener("click", openAISettings);
  $$(".sample-chip").forEach((button) => {
    button.addEventListener("click", () => {
      dom.noticeInput.value = SAMPLE_NOTICE[button.dataset.sample] || SAMPLE_NOTICE.study;
      dom.noticeInput.focus();
      showToast("示例通知已填入");
    });
  });
  dom.screenshotInput.addEventListener("change", () => {
    if (!dom.screenshotInput.files?.[0]) return;
    dom.noticeInput.value = SAMPLE_NOTICE.study;
    showToast("演示版已使用内置示例识别结果");
  });
  dom.analyzeButton.addEventListener("click", analyzeNotice);
  dom.confirmImportButton.addEventListener("click", confirmImport);
  dom.previewList.addEventListener("click", (event) => {
    const button = event.target.closest("[data-remove-preview]");
    if (!button) return;
    state.preview.splice(Number(button.dataset.removePreview), 1);
    if (!state.preview.length) { dom.previewPanel.hidden = true; showToast("已移除全部识别项"); return; }
    renderPreview();
  });
}

function renderKeywordRuleEditor(rules = state.keywordRules) {
  dom.keywordRuleList.innerHTML = rules.map((rule, index) => `
    <div class="keyword-rule-row" data-rule-index="${index}">
      <input class="keyword-rule-label" type="text" value="${escapeHTML(rule.label)}" placeholder="类型名称" aria-label="类型名称">
      <input class="keyword-rule-words" type="text" value="${escapeHTML(rule.keywords)}" placeholder="关键词1, 关键词2" aria-label="关键词">
      <button class="keyword-rule-remove" type="button" data-remove-keyword-rule="${index}" aria-label="删除">×</button>
    </div>
  `).join("");
}

function openAISettings() {
  dom.aiBaseUrl.value = state.aiConfig.baseUrl;
  dom.aiModel.value = state.aiConfig.model;
  dom.aiApiKey.value = state.aiConfig.apiKey;
  dom.urgentKeywords.value = state.aiConfig.urgentKeywords;
  dom.ignoredKeywords.value = state.aiConfig.ignoredKeywords;
  dom.aiTestStatus.textContent = isAIConfigured() ? "接口已配置" : "尚未测试";
  renderKeywordRuleEditor();
  openModal("aiSettingsModal");
}

function collectKeywordRules() {
  return $$(".keyword-rule-row", dom.keywordRuleList).map((row) => ({
    label: $(".keyword-rule-label", row).value.trim(),
    keywords: $(".keyword-rule-words", row).value.trim()
  })).filter((rule) => rule.label && rule.keywords);
}

function handleAISettingsSubmit(event) {
  event.preventDefault();
  const rules = collectKeywordRules();
  if (!rules.length) { showToast("至少保留一组有效关键词"); return; }
  saveKeywordRules(rules);
  saveAIConfig({
    baseUrl: dom.aiBaseUrl.value.trim(),
    model: dom.aiModel.value.trim(),
    apiKey: dom.aiApiKey.value.trim(),
    urgentKeywords: dom.urgentKeywords.value.trim(),
    ignoredKeywords: dom.ignoredKeywords.value.trim()
  });
  closeModal("aiSettingsModal");
  renderAll();
  showToast("关键词与 AI 设置已保存");
}

async function testAIConnection() {
  const baseUrl = dom.aiBaseUrl.value.trim().replace(/\/$/, "");
  const model = dom.aiModel.value.trim();
  const apiKey = dom.aiApiKey.value.trim();
  if (!baseUrl || !model || !apiKey) {
    dom.aiTestStatus.textContent = "请先填写接口地址、模型和 API Key";
    return;
  }
  dom.aiTestStatus.textContent = "正在测试…";
  try {
    const response = await fetch(`${baseUrl}/models`, { headers: { Authorization: `Bearer ${apiKey}` } });
    dom.aiTestStatus.textContent = response.ok ? "接口连接成功" : `接口返回 ${response.status}，仍可尝试保存`;
  } catch (error) {
    dom.aiTestStatus.textContent = "连接失败，可能被跨域策略拦截";
  }
}

function overviewEvents(type) {
  const events = themeEvents();
  if (type === "urgent") return events.filter((event) => event.status !== "done" && getUrgencyValue(event) === "red");
  if (type === "done") return events.filter((event) => event.status === "done");
  return events.filter((event) => event.status !== "done");
}

function openOverview(type) {
  state.overviewType = type;
  const theme = getTheme();
  const labels = { todo: "待处理任务", urgent: "先做任务", done: "历史完成" };
  const list = overviewEvents(type).sort((left, right) => compareEvents(left, right, "deadline"));
  const urgent = list.filter((event) => event.status !== "done" && getUrgencyValue(event) === "red").length;
  dom.overviewTitle.textContent = labels[type] || "任务总览";
  dom.overviewThemeIcon.textContent = theme.icon || "✦";
  dom.overviewThemeName.textContent = theme.name;
  dom.overviewCount.textContent = String(list.length);
  dom.overviewLabel.textContent = labels[type] || "任务";
  dom.overviewUrgent.textContent = String(urgent);
  dom.overviewRows.innerHTML = list.length ? list.map((event) => {
    const priority = getDisplayPriority(event);
    const timeInfo = formatEventTime(event);
    return `
      <div class="overview-row" style="--row-color:${PRIORITY_META[priority].color}">
        <i class="overview-row-dot"></i>
        <div class="overview-row-copy"><strong>${escapeHTML(event.title)}</strong><small>${escapeHTML(event.category)} · ${escapeHTML(event.source || "未标注来源")}</small></div>
        <time>${escapeHTML(timeInfo.text)}</time>
      </div>`;
  }).join("") : '<div class="overview-empty">这个分类下暂时没有任务。</div>';
  openModal("overviewModal");
}

function downloadOverviewImage() {
  const list = overviewEvents(state.overviewType).sort((left, right) => compareEvents(left, right, "deadline"));
  const theme = getTheme();
  const palette = getPalette(theme);
  const canvas = document.createElement("canvas");
  const width = 1000;
  const rows = list.slice(0, 18);
  const height = 520 + rows.length * 54;
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#f4efe5";
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = palette.accent;
  ctx.fillRect(0, 0, width, 210);
  ctx.fillStyle = "rgba(255,255,255,0.14)";
  ctx.beginPath();
  ctx.arc(900, 30, 180, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#fffdf8";
  ctx.font = '700 30px "Microsoft YaHei"';
  ctx.fillText(`${theme.name} · ${dom.overviewTitle.textContent}`, 58, 86);
  ctx.font = '400 18px "Microsoft YaHei"';
  ctx.fillStyle = "rgba(255,253,248,0.72)";
  ctx.fillText(`别急 DDL 主题总览 · ${new Date().toLocaleDateString("zh-CN")}`, 58, 122);
  ctx.font = '800 72px "Microsoft YaHei"';
  ctx.fillStyle = "#fffdf8";
  ctx.fillText(String(list.length), 58, 195);
  ctx.font = '400 16px "Microsoft YaHei"';
  ctx.fillStyle = "rgba(255,253,248,0.72)";
  ctx.fillText("项任务", 118, 194);
  let y = 270;
  rows.forEach((event) => {
    const priority = getDisplayPriority(event);
    ctx.fillStyle = "rgba(255,255,255,0.82)";
    ctx.fillRect(46, y - 25, 908, 42);
    ctx.fillStyle = PRIORITY_META[priority].color;
    ctx.beginPath();
    ctx.arc(68, y - 4, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#18352e";
    ctx.font = '700 18px "Microsoft YaHei"';
    const title = event.title.length > 36 ? `${event.title.slice(0, 36)}…` : event.title;
    ctx.fillText(title, 88, y);
    ctx.fillStyle = "#6a776f";
    ctx.font = '400 14px "Microsoft YaHei"';
    ctx.fillText(`${event.category} · ${formatEventTime(event).text}`, 690, y);
    y += 54;
  });
  if (!rows.length) {
    ctx.fillStyle = "#6a776f";
    ctx.font = '400 20px "Microsoft YaHei"';
    ctx.fillText("这个分类下暂时没有任务", 46, 300);
  }
  const link = document.createElement("a");
  link.download = `${theme.name}-${dom.overviewTitle.textContent}.png`;
  link.href = canvas.toDataURL("image/png");
  link.click();
  showToast("总结图片已生成");
}


function openDetailEdit(field = "time") {
  const event = state.events.find((item) => item.id === state.activeEventId);
  if (!event) return;
  dom.editTaskTitle.value = event.title;
  dom.editTaskCategory.value = event.category;
  dom.editTaskSource.value = event.source || "";
  dom.editTaskDueTime.value = toLocalInputValue(event.dueTime);
  dom.editTaskUrgency.value = event.urgency || "auto";
  dom.editTaskReminderMinutes.value = String(event.reminderMinutes ?? state.reminderSettings.minutes ?? 15);
  dom.editTaskLocation.value = event.location || "";
  dom.editTaskNextAction.value = event.nextAction || "";
  dom.editTaskRequirements.value = event.requirements || "";
  dom.detailEditPanel.hidden = false;
  dom.detailEditPanel.style.display = "block";
  const fieldMap = { time: dom.editTaskDueTime, location: dom.editTaskLocation, source: dom.editTaskSource, category: dom.editTaskCategory };
  window.setTimeout(() => (fieldMap[field] || dom.editTaskTitle).focus(), 80);
}

function handleDetailEditSubmit(event) {
  event.preventDefault();
  const target = state.events.find((item) => item.id === state.activeEventId);
  if (!target) return;
  target.title = dom.editTaskTitle.value.trim() || target.title;
  target.category = dom.editTaskCategory.value.trim() || "自定义";
  target.source = dom.editTaskSource.value.trim() || "未标注来源";
  target.dueTime = toISOStringFromLocal(dom.editTaskDueTime.value);
  target.urgency = dom.editTaskUrgency.value;
  target.location = dom.editTaskLocation.value.trim();
  target.nextAction = dom.editTaskNextAction.value.trim();
  target.requirements = dom.editTaskRequirements.value.trim();
  target.reminderMinutes = Number(dom.editTaskReminderMinutes.value || 0);
  saveEvents();
  renderAll();
  openDetail(target.id);
  showToast("卡片关键词已更新");
}

function updatePetPreview() {
  const image = state.petImageDraft;
  dom.petPreviewImage.hidden = !image;
  dom.petPreviewEmoji.hidden = Boolean(image);
  if (image) dom.petPreviewImage.src = image;
  dom.petPreviewEmoji.textContent = dom.petEmoji.value || "🐱";
}

function openPetSettings() {
  state.petImageDraft = state.pet.image || "";
  state.petOriginalDraft = state.pet.image || "";
  dom.petEnabled.checked = state.pet.enabled;
  dom.petName.value = state.pet.name || "小别";
  dom.petEmoji.value = state.pet.emoji || "🐱";
  dom.petPreset.value = state.pet.preset || "default";
  updatePetPreview();
  openModal("petSettingsModal");
}

function renderPet() {
  const enabled = Boolean(state.pet.enabled);
  dom.desktopPet.classList.toggle("is-hidden", !enabled);
  dom.petNameLabel.textContent = state.pet.name || "小别";
  const hasImage = Boolean(state.pet.image);
  const preset = state.pet.preset || "default";
  const showOriginalPet = !hasImage && (preset === "dragon" || preset === "dumpling");
  dom.petImage.hidden = !hasImage;
  dom.petFallback.hidden = hasImage || showOriginalPet;
  dom.petFallback.textContent = state.pet.emoji || "🐱";
  dom.desktopPet.classList.remove("preset-dragon", "preset-dumpling", "is-dancing", "is-laughing");
  if (preset === "dragon") dom.desktopPet.classList.add("preset-dragon");
  if (preset === "dumpling") dom.desktopPet.classList.add("preset-dumpling");
  if (hasImage) dom.petImage.src = state.pet.image;
  const position = state.pet.position;
  if (position && Number.isFinite(position.x) && Number.isFinite(position.y)) {
    const width = dom.desktopPet.offsetWidth || 104;
    const height = dom.desktopPet.offsetHeight || 116;
    dom.desktopPet.style.left = `${Math.max(0, Math.min(window.innerWidth - width, position.x * window.innerWidth))}px`;
    dom.desktopPet.style.top = `${Math.max(0, Math.min(window.innerHeight - height, position.y * window.innerHeight))}px`;
    dom.desktopPet.style.right = "auto";
    dom.desktopPet.style.bottom = "auto";
  } else {
    dom.desktopPet.style.left = "";
    dom.desktopPet.style.top = "";
    dom.desktopPet.style.right = "";
    dom.desktopPet.style.bottom = "";
  }
  renderPetSchedule();
}

function renderPetSchedule() {
  const today = startOfDay(new Date());
  const list = themeEvents().filter((event) => event.status !== "done" && getEventDate(event) && isSameDay(getEventDate(event), today))
    .sort((left, right) => compareEvents(left, right, "deadline")).slice(0, 5);
  dom.petSchedule.innerHTML = `<strong>${escapeHTML(getTheme().name)} · 今日简表</strong>` + (list.length ? list.map((event) => {
    const priority = getDisplayPriority(event);
    return `<div class="pet-schedule-row" style="--dot:${PRIORITY_META[priority].color}"><i></i><span>${escapeHTML(event.title)}</span><time>${escapeHTML(formatShortTime(getEventDate(event)))}</time></div>`;
  }).join("") : '<div class="pet-schedule-row"><span>今天暂时没有待办</span></div>');
}

function handlePetSettingsSubmit(event) {
  event.preventDefault();
  savePetSettings({
    enabled: dom.petEnabled.checked,
    name: dom.petName.value.trim() || "小别",
    emoji: dom.petEmoji.value,
    preset: dom.petPreset.value,
    image: state.petImageDraft
  });
  closeModal("petSettingsModal");
  renderPet();
  showToast("桌宠设置已保存");
}

function showPetMenu(x, y) {
  dom.petContextMenu.hidden = false;
  const width = 156;
  const height = 112;
  dom.petContextMenu.style.left = `${Math.min(x, window.innerWidth - width - 10)}px`;
  dom.petContextMenu.style.top = `${Math.max(10, Math.min(y, window.innerHeight - height - 10))}px`;
}

function handlePetClick() {
  window.scrollTo({ top: 0, behavior: "smooth" });
  window.focus();
  dom.desktopPet.classList.toggle("schedule-open");
  renderPetSchedule();
}

function resetDemoData() {
  if (!window.confirm("恢复最初的主题和演示任务？你新增的数据会被清除。")) return;
  state.themes = getDefaultThemes();
  state.events = getDemoEvents();
  state.activeThemeId = "study";
  state.period = "today";
  state.query = "";
  state.filters = { category: "", source: "", urgency: "", location: "", status: "" };
  saveThemes();
  saveEvents();
  renderAll();
  showToast("演示数据已恢复");
}

function triggerPetSpecial() {
  if (state.pet.preset === "dragon") {
    dom.desktopPet.classList.remove("is-dancing");
    void dom.desktopPet.offsetWidth;
    dom.desktopPet.classList.add("is-dancing");
    window.setTimeout(() => dom.desktopPet.classList.remove("is-dancing"), 3200);
    showToast("云龙开始跳一段原创节奏舞");
    return;
  }
  if (state.pet.preset === "dumpling") {
    playDumplingLaugh();
    dom.desktopPet.classList.remove("is-laughing");
    void dom.desktopPet.offsetWidth;
    dom.desktopPet.classList.add("is-laughing");
    window.setTimeout(() => dom.desktopPet.classList.remove("is-laughing"), 1900);
    showToast("团子笑出了声");
    return;
  }
  handlePetClick();
}

function playDumplingLaugh() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const context = new AudioContext();
    const notes = [660, 820, 740, 880, 700];
    notes.forEach((frequency, index) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = "triangle";
      oscillator.frequency.setValueAtTime(frequency, context.currentTime + index * 0.12);
      oscillator.frequency.exponentialRampToValueAtTime(frequency * 1.18, context.currentTime + index * 0.12 + 0.07);
      gain.gain.setValueAtTime(0.0001, context.currentTime + index * 0.12);
      gain.gain.exponentialRampToValueAtTime(0.08, context.currentTime + index * 0.12 + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + index * 0.12 + 0.22);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start(context.currentTime + index * 0.12);
      oscillator.stop(context.currentTime + index * 0.12 + 0.24);
    });
  } catch (error) { /* Audio requires user interaction. */ }
}

async function removePetBackgroundAI() {
  const source = state.petOriginalDraft || state.petImageDraft;
  if (!source) { showToast("请先上传桌宠图片"); return; }
  if (!window.BiejiCloud?.isReady()) { showToast("请先登录云账号后再使用 AI 抠图"); return; }
  const button = dom.removePetBackgroundAIButton;
  button.disabled = true;
  button.textContent = "AI 抠图中…";
  try {
    const result = await window.BiejiCloud.removeBackground(source);
    if (!result.imageData) throw new Error("AI 没有返回图片");
    state.petImageDraft = result.imageData;
    state.petOriginalDraft = result.imageData;
    updatePetPreview();
    showToast("AI 抠图完成");
  } catch (error) {
    showToast(error.message || "AI 抠图失败，可改用本地抠图");
  } finally {
    button.disabled = false;
    button.textContent = "AI 智能抠图";
  }
}

function updatePetImageFile(file) {
  if (!file) return;
  resizeImageFile(file, 420, 420, 0.9, "image/png")
    .then((dataUrl) => { state.petOriginalDraft = dataUrl; state.petImageDraft = dataUrl; updatePetPreview(); })
    .catch((error) => showToast(error.message || "图片处理失败"));
}

function removePetBackground() {
  const source = state.petOriginalDraft || state.petImageDraft;
  if (!source) { showToast("请先上传桌宠图片"); return; }
  const tolerance = Number(dom.petBgTolerance.value || 38) * 1.8;
  const image = new Image();
  image.onload = () => {
    const canvas = document.createElement("canvas");
    canvas.width = image.width;
    canvas.height = image.height;
    const context = canvas.getContext("2d");
    context.drawImage(image, 0, 0);
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
    const data = pixels.data;
    const width = canvas.width;
    const height = canvas.height;
    const corners = [0, (width - 1) * 4, (height - 1) * width * 4, ((height - 1) * width + width - 1) * 4];
    const ref = corners.reduce((acc, index) => ({ r: acc.r + data[index], g: acc.g + data[index + 1], b: acc.b + data[index + 2] }), { r: 0, g: 0, b: 0 });
    ref.r /= 4; ref.g /= 4; ref.b /= 4;
    const distance = (index) => Math.sqrt((data[index] - ref.r) ** 2 + (data[index + 1] - ref.g) ** 2 + (data[index + 2] - ref.b) ** 2);
    const visited = new Uint8Array(width * height);
    const queue = [];
    for (let x = 0; x < width; x += 1) { queue.push(x, (height - 1) * width + x); }
    for (let y = 0; y < height; y += 1) { queue.push(y * width, y * width + width - 1); }
    let cursor = 0;
    while (cursor < queue.length) {
      const pixel = queue[cursor++];
      if (visited[pixel]) continue;
      visited[pixel] = 1;
      const index = pixel * 4;
      if (data[index + 3] === 0 || distance(index) > tolerance) continue;
      data[index + 3] = 0;
      const x = pixel % width;
      const y = Math.floor(pixel / width);
      if (x > 0) queue.push(pixel - 1);
      if (x < width - 1) queue.push(pixel + 1);
      if (y > 0) queue.push(pixel - width);
      if (y < height - 1) queue.push(pixel + width);
    }
    context.putImageData(pixels, 0, 0);
    state.petImageDraft = canvas.toDataURL("image/png");
    updatePetPreview();
    showToast("已移除与边缘相近的背景，可调整强度后重试");
  };
  image.onerror = () => showToast("抠图失败，请重新上传图片");
  image.src = source;
}

function bindModalsAndCards() {
  $$("[data-close-modal]").forEach((button) => {
    button.addEventListener("click", () => closeModal(button.dataset.closeModal));
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeAllModals();
  });
  dom.eventList.addEventListener("click", handleCardClick);
  dom.eventList.addEventListener("keydown", handleCardKeydown);
  dom.detailReminderButton.addEventListener("click", () => {
    const event = state.events.find((item) => item.id === state.activeEventId);
    if (event) downloadReminder(event);
  });
  dom.detailCompleteButton.addEventListener("click", () => {
    if (!state.activeEventId) return;
    toggleComplete(state.activeEventId);
    closeModal("detailModal");
  });
}



function bindMinimalActions() {
  dom.minimalSampleButton.addEventListener("click", () => {
    dom.minimalInputText.value = SAMPLE_NOTICE.study;
    dom.minimalInputText.focus();
  });
  dom.minimalImageInput.addEventListener("change", () => {
    const file = dom.minimalImageInput.files?.[0];
    if (!file) return;
    resizeImageFile(file, 1200, 900, 0.82)
      .then((dataUrl) => {
        state.minimalImageData = dataUrl;
        dom.minimalImagePreview.src = dataUrl;
        dom.minimalImagePreviewWrap.hidden = false;
        showToast("图片已载入");
      })
      .catch((error) => showToast(error.message || "图片处理失败"));
  });
  dom.removeMinimalImageButton.addEventListener("click", () => {
    state.minimalImageData = "";
    dom.minimalImagePreview.src = "";
    dom.minimalImagePreviewWrap.hidden = true;
    dom.minimalImageInput.value = "";
  });
  dom.minimalAnalyzeButton.addEventListener("click", analyzeMinimalInput);

  dom.minimalDeck.addEventListener("click", (event) => {
    const editButton = event.target.closest("[data-conflict-edit]");
    if (editButton) { openDetail(editButton.dataset.conflictEdit); openDetailEdit("time"); return; }
    const deleteButton = event.target.closest("[data-conflict-delete]");
    if (deleteButton) {
      const target = state.events.find((item) => item.id === deleteButton.dataset.conflictDelete);
      if (target) { target.deleted = true; saveEvents(); state.minimalIndex = 0; renderAll(); showToast("冲突卡片已删除"); }
    }
  });

  let gesture = null;
  let longPressTimer = null;
  dom.minimalDeck.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    const card = event.target.closest(".minimal-task-card.is-current");
    if (!card) return;
    const taskId = card.dataset.taskId;
    gesture = { card, taskId, startX: event.clientX, startY: event.clientY, dx: 0, dy: 0, moved: false, longTriggered: false };
    card.classList.add("is-dragging");
    card.setPointerCapture(event.pointerId);
    longPressTimer = window.setTimeout(() => {
      if (!gesture || gesture.moved) return;
      gesture.longTriggered = true;
      openDetail(taskId);
      openDetailEdit("time");
    }, 620);
  });
  dom.minimalDeck.addEventListener("pointermove", (event) => {
    if (!gesture) return;
    gesture.dx = event.clientX - gesture.startX;
    gesture.dy = event.clientY - gesture.startY;
    if (Math.hypot(gesture.dx, gesture.dy) > 7) {
      gesture.moved = true;
      window.clearTimeout(longPressTimer);
    }
    if (!gesture.longTriggered) {
      gesture.card.style.transform = `translate(${gesture.dx}px, ${gesture.dy}px) rotate(${gesture.dx * 0.035}deg)`;
    }
  });
  const finishGesture = (event) => {
    if (!gesture) return;
    const current = gesture;
    gesture = null;
    window.clearTimeout(longPressTimer);
    current.card.classList.remove("is-dragging");
    current.card.style.transform = "";
    if (current.longTriggered) return;
    if (Math.abs(current.dx) > 55 && Math.abs(current.dx) > Math.abs(current.dy)) {
      changeMinimalPage(current.dx < 0 ? 1 : -1);
      return;
    }
    if (current.dy < -65 && Math.abs(current.dy) > Math.abs(current.dx)) {
      deleteMinimalCurrent();
    }
  };
  dom.minimalDeck.addEventListener("pointerup", finishGesture);
  dom.minimalDeck.addEventListener("pointercancel", finishGesture);
  dom.minimalDeck.addEventListener("dblclick", (event) => {
    const card = event.target.closest(".minimal-task-card.is-current");
    if (card) setMinimalReminder();
  });

  let resizing = false;
  dom.minimalDivider.addEventListener("pointerdown", (event) => {
    resizing = true;
    dom.minimalDivider.setPointerCapture(event.pointerId);
    event.preventDefault();
  });
  dom.minimalDivider.addEventListener("pointermove", (event) => {
    if (!resizing) return;
    const rect = dom.minimalScreen.getBoundingClientRect();
    const portrait = window.matchMedia("(orientation: portrait)").matches;
    const ratio = portrait ? ((event.clientY - rect.top) / rect.height) * 100 : ((event.clientX - rect.left) / rect.width) * 100;
    updateMinimalSplit(ratio);
  });
  const stopResize = () => { resizing = false; };
  dom.minimalDivider.addEventListener("pointerup", stopResize);
  dom.minimalDivider.addEventListener("pointercancel", stopResize);
  window.addEventListener("resize", () => { updateMinimalSplit(state.minimalSplit); if (dom.desktopPet) renderPet(); });
}

function bindV3Actions() {
  dom.accountManageButton.addEventListener("click", openAccountManager);
  dom.exportBackupButton.addEventListener("click", exportBackup);
  dom.accountExportButton.addEventListener("click", exportBackup);
  dom.importBackupButton.addEventListener("click", () => dom.backupFileInput.click());
  dom.accountAvatarInput.addEventListener("change", () => {
    const file = dom.accountAvatarInput.files?.[0];
    if (!file) return;
    resizeImageFile(file, 256, 256, 0.88, "image/png").then(async (avatar) => {
      state.profileAvatar = avatar;
      try { await window.BiejiCloud?.updateAvatar?.(avatar); } catch (error) {}
      updatePersonalPanel();
      scheduleCloudSave();
      showToast("头像已更新");
    }).catch((error) => showToast(error.message || "头像处理失败"));
  });
  dom.backupFileInput.addEventListener("change", () => { importBackupFile(dom.backupFileInput.files?.[0]).catch((error) => showToast(error.message || "备份导入失败")); dom.backupFileInput.value = ""; });
  dom.syncNowButton.addEventListener("click", syncNow);
  dom.clearLocalButton.addEventListener("click", clearLocalCache);
  dom.openAccountSignOutButton.addEventListener("click", () => window.BiejiCloud?.signOut());
  dom.heroFocusButton.addEventListener("click", openFocusModal);
  dom.heroImportAction.addEventListener("click", () => dom.openImportButton.click());
  dom.focusButton.addEventListener("click", openFocusModal);
  dom.designButton.addEventListener("click", openDesignModal);
  dom.reminderSettingsButton.addEventListener("click", openReminderSettings);
  dom.designGrid.addEventListener("click", (event) => {
    const button = event.target.closest("[data-design]");
    if (button) applyDesignTheme(button.dataset.design, true);
  });
  dom.focusStartButton.addEventListener("click", startFocusTimer);
  dom.focusPauseButton.addEventListener("click", toggleFocusPause);
  dom.focusStopButton.addEventListener("click", stopFocusTimer);
  dom.focusScheduleButton.addEventListener("click", addFocusToTimeline);
  dom.focusNotificationButton.addEventListener("click", requestNotificationPermission);
  dom.requestNotificationPermissionButton.addEventListener("click", requestNotificationPermission);
  dom.saveReminderSettingsButton.addEventListener("click", saveReminderSettings);
  $$(".focus-preset").forEach((button) => {
    button.addEventListener("click", () => {
      state.focusSky = button.dataset.focusSky || "day";
      dom.focusSky.dataset.sky = state.focusSky;
      $$(".focus-preset").forEach((item) => item.classList.toggle("is-active", item === button));
    });
  });
  dom.modeSwitch.addEventListener("click", (event) => {
    const button = event.target.closest("[data-mode]");
    if (button) applyMode(button.dataset.mode);
  });

  dom.editThemeButton.addEventListener("click", () => openThemeEditor(state.activeThemeId));
  dom.themeBackgroundInput.addEventListener("change", () => {
    const file = dom.themeBackgroundInput.files?.[0];
    if (!file) return;
    resizeImageFile(file, 1400, 760, 0.8).then((dataUrl) => {
      state.themeBackgroundDraft = dataUrl;
      dom.themeImagePreview.src = dataUrl;
      dom.themeImagePreviewWrap.hidden = false;
      showToast("主题背景已载入，保存后生效");
    }).catch((error) => showToast(error.message || "背景图片处理失败"));
  });
  dom.clearThemeBackgroundButton.addEventListener("click", () => {
    state.themeBackgroundDraft = "";
    dom.themeImagePreview.src = "";
    dom.themeImagePreviewWrap.hidden = true;
  });

  dom.themeHero.addEventListener("click", (event) => {
    const button = event.target.closest("[data-overview]");
    if (button) openOverview(button.dataset.overview);
  });

  dom.detailEditButton.addEventListener("click", () => openDetailEdit("time"));
  $$(".editable-detail", dom.detailModal).forEach((button) => {
    button.addEventListener("click", () => openDetailEdit(button.dataset.editField));
  });
  dom.detailEditForm.addEventListener("submit", handleDetailEditSubmit);
  dom.detailEditCancelButton.addEventListener("click", () => { dom.detailEditPanel.hidden = true; });

  dom.aiSettingsForm.addEventListener("submit", handleAISettingsSubmit);
  dom.addKeywordRuleButton.addEventListener("click", () => {
    state.keywordRules = [...collectKeywordRules(), { label: "", keywords: "" }];
    renderKeywordRuleEditor(state.keywordRules);
  });
  dom.keywordRuleList.addEventListener("click", (event) => {
    const button = event.target.closest("[data-remove-keyword-rule]");
    if (!button) return;
    const rules = collectKeywordRules();
    rules.splice(Number(button.dataset.removeKeywordRule), 1);
    renderKeywordRuleEditor(rules);
  });
  dom.testAIConnectionButton.addEventListener("click", testAIConnection);

  dom.downloadOverviewButton.addEventListener("click", downloadOverviewImage);

  dom.petSettingsButton.addEventListener("click", openPetSettings);
  dom.petSettingsMenuButton.addEventListener("click", () => { dom.petContextMenu.hidden = true; openPetSettings(); });
  dom.petSettingsForm.addEventListener("submit", handlePetSettingsSubmit);
  dom.petImageInput.addEventListener("change", () => updatePetImageFile(dom.petImageInput.files?.[0]));
  dom.petEmoji.addEventListener("change", updatePetPreview);
  dom.petPreset.addEventListener("change", () => {
    if (dom.petPreset.value === "dragon") dom.petEmoji.value = "🐲";
    if (dom.petPreset.value === "dumpling") dom.petEmoji.value = "👶";
    updatePetPreview();
  });
  dom.clearPetImageButton.addEventListener("click", () => { state.petImageDraft = ""; state.petOriginalDraft = ""; updatePetPreview(); });
  dom.removePetBackgroundButton.addEventListener("click", removePetBackground);
  dom.removePetBackgroundAIButton.addEventListener("click", removePetBackgroundAI);
  let petDrag = null;
  dom.desktopPet.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    const rect = dom.desktopPet.getBoundingClientRect();
    petDrag = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, offsetX: event.clientX - rect.left, offsetY: event.clientY - rect.top, moved: false };
    dom.desktopPet.setPointerCapture(event.pointerId);
    dom.desktopPet.classList.add("is-dragging");
  });
  dom.desktopPet.addEventListener("pointermove", (event) => {
    if (!petDrag) return;
    if (Math.hypot(event.clientX - petDrag.startX, event.clientY - petDrag.startY) > 5) petDrag.moved = true;
    if (!petDrag.moved) return;
    const x = Math.max(0, Math.min(window.innerWidth - dom.desktopPet.offsetWidth, event.clientX - petDrag.offsetX));
    const y = Math.max(0, Math.min(window.innerHeight - dom.desktopPet.offsetHeight, event.clientY - petDrag.offsetY));
    dom.desktopPet.style.left = `${x}px`;
    dom.desktopPet.style.top = `${y}px`;
    dom.desktopPet.style.right = "auto";
    dom.desktopPet.style.bottom = "auto";
  });
  const finishPetDrag = () => {
    if (!petDrag) return;
    const moved = petDrag.moved;
    petDrag = null;
    dom.desktopPet.classList.remove("is-dragging");
    if (moved) {
      const rect = dom.desktopPet.getBoundingClientRect();
      savePetSettings({ ...state.pet, position: { x: rect.left / window.innerWidth, y: rect.top / window.innerHeight } });
      showToast("桌宠位置已保存");
    } else {
      window.clearTimeout(petClickTimer);
      petClickTimer = window.setTimeout(() => handlePetClick(), 300);
    }
  };
  dom.desktopPet.addEventListener("pointerup", finishPetDrag);
  dom.desktopPet.addEventListener("pointercancel", finishPetDrag);
  dom.desktopPet.addEventListener("dblclick", (event) => {
    event.preventDefault();
    window.clearTimeout(petClickTimer);
    triggerPetSpecial();
  });
  dom.desktopPet.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") { event.preventDefault(); handlePetClick(); }
  });
  dom.desktopPet.addEventListener("contextmenu", (event) => {
    event.preventDefault();
    showPetMenu(event.clientX, event.clientY);
  });
  dom.petOpenMainButton.addEventListener("click", () => {
    dom.petContextMenu.hidden = true;
    handlePetClick();
  });
  dom.petCloseButton.addEventListener("click", () => {
    savePetSettings({ ...state.pet, enabled: false });
    dom.petContextMenu.hidden = true;
    renderPet();
    showToast("桌宠已关闭，可在主题栏重新打开");
  });
  document.addEventListener("click", (event) => {
    if (!event.target.closest("#petContextMenu") && !event.target.closest("#desktopPet")) dom.petContextMenu.hidden = true;
  });
}

async function init() {
  Object.assign(dom, {
    sidebarToggle: $("#sidebarToggle"),
    sidebarCollapseButton: $("#sidebarCollapseButton"),
    modeSwitch: $("#modeSwitch"),
    mobileFilterButton: $("#mobileFilterButton"),
    closeFilterButton: $("#closeFilterButton"),
    sidebarScrim: $("#sidebarScrim"),
    themeList: $("#themeList"),
    themeHero: $("#themeHero"),
    breadcrumb: $("#breadcrumb"),
    themeName: $("#themeName"),
    themeDescription: $("#themeDescription"),
    themeIcon: $("#themeIcon"),
    themeVisualCaption: $("#themeVisualCaption"),
    themeTodoCount: $("#themeTodoCount"),
    themeUrgentCount: $("#themeUrgentCount"),
    themeDoneCount: $("#themeDoneCount"),
    periodTabs: $("#periodTabs"),
    sortSelect: $("#sortSelect"),
    categoryFilter: $("#categoryFilter"),
    sourceFilter: $("#sourceFilter"),
    urgencyChips: $("#urgencyChips"),
    locationFilter: $("#locationFilter"),
    statusFilter: $("#statusFilter"),
    searchInput: $("#searchInput"),
    clearFiltersButton: $("#clearFiltersButton"),
    listTitle: $("#listTitle"),
    listCount: $("#listCount"),
    listSubtitle: $("#listSubtitle"),
    activeFilterSummary: $("#activeFilterSummary"),
    eventList: $("#eventList"),
    emptyState: $("#emptyState"),
    emptyTitle: $("#emptyTitle"),
    emptyCopy: $("#emptyCopy"),
    emptyAddButton: $("#emptyAddButton"),
    timelineSection: $("#timelineSection"),
    timelineTrack: $("#timelineTrack"),
    openAddButton: $("#openAddButton"),
    openImportButton: $("#openImportButton"),
    newTaskSideButton: $("#newTaskSideButton"),
    newThemeButton: $("#newThemeButton"),
    petSettingsButton: $("#petSettingsButton"),
    editThemeButton: $("#editThemeButton"),
    floatingAddButton: $("#floatingAddButton"),
    themeModal: $("#themeModal"),
    themeModalTitle: $("#themeModalTitle"),
    taskModal: $("#taskModal"),
    importModal: $("#importModal"),
    detailModal: $("#detailModal"),
    themeForm: $("#themeForm"),
    themeFormName: $("#themeFormName"),
    themeFormIcon: $("#themeFormIcon"),
    themeFormColor: $("#themeFormColor"),
    themeFormDescription: $("#themeFormDescription"),
    themeBackgroundInput: $("#themeBackgroundInput"),
    themeImagePreviewWrap: $("#themeImagePreviewWrap"),
    themeImagePreview: $("#themeImagePreview"),
    clearThemeBackgroundButton: $("#clearThemeBackgroundButton"),
    taskForm: $("#taskForm"),
    taskTheme: $("#taskTheme"),
    taskSource: $("#taskSource"),
    taskTitle: $("#taskTitle"),
    taskCategory: $("#taskCategory"),
    taskCustomCategory: $("#taskCustomCategory"),
    customCategoryField: $("#customCategoryField"),
    taskDueTime: $("#taskDueTime"),
    taskUrgency: $("#taskUrgency"),
    taskReminderMinutes: $("#taskReminderMinutes"),
    taskLocation: $("#taskLocation"),
    taskNextAction: $("#taskNextAction"),
    taskRequirements: $("#taskRequirements"),
    importTheme: $("#importTheme"),
    noticeInput: $("#noticeInput"),
    screenshotInput: $("#screenshotInput"),
    analyzeButton: $("#analyzeButton"),
    analysisLoading: $("#analysisLoading"),
    previewPanel: $("#previewPanel"),
    previewTitle: $("#previewTitle"),
    previewList: $("#previewList"),
    confirmImportButton: $("#confirmImportButton"),
    detailCategory: $("#detailCategory"),
    detailTitle: $("#detailTitle"),
    detailPriority: $("#detailPriority"),
    detailTime: $("#detailTime"),
    detailLocation: $("#detailLocation"),
    detailSource: $("#detailSource"),
    detailType: $("#detailType"),
    detailNextAction: $("#detailNextAction"),
    detailRequirements: $("#detailRequirements"),
    detailReminderButton: $("#detailReminderButton"),
    detailCompleteButton: $("#detailCompleteButton"),
    detailEditButton: $("#detailEditButton"),
    detailEditPanel: $("#detailEditPanel"),
    detailEditForm: $("#detailEditForm"),
    detailEditCancelButton: $("#detailEditCancelButton"),
    editTaskTitle: $("#editTaskTitle"),
    editTaskCategory: $("#editTaskCategory"),
    editTaskSource: $("#editTaskSource"),
    editTaskDueTime: $("#editTaskDueTime"),
    editTaskUrgency: $("#editTaskUrgency"),
    editTaskReminderMinutes: $("#editTaskReminderMinutes"),
    editTaskLocation: $("#editTaskLocation"),
    editTaskNextAction: $("#editTaskNextAction"),
    editTaskRequirements: $("#editTaskRequirements"),
    aiStatus: $("#aiStatus"),
    aiSettingsButton: $("#aiSettingsButton"),
    aiSettingsModal: $("#aiSettingsModal"),
    aiSettingsForm: $("#aiSettingsForm"),
    aiBaseUrl: $("#aiBaseUrl"),
    aiModel: $("#aiModel"),
    aiApiKey: $("#aiApiKey"),
    keywordRuleList: $("#keywordRuleList"),
    addKeywordRuleButton: $("#addKeywordRuleButton"),
    urgentKeywords: $("#urgentKeywords"),
    ignoredKeywords: $("#ignoredKeywords"),
    testAIConnectionButton: $("#testAIConnectionButton"),
    aiTestStatus: $("#aiTestStatus"),
    overviewModal: $("#overviewModal"),
    overviewTitle: $("#overviewTitle"),
    overviewThemeIcon: $("#overviewThemeIcon"),
    overviewThemeName: $("#overviewThemeName"),
    overviewCount: $("#overviewCount"),
    overviewLabel: $("#overviewLabel"),
    overviewUrgent: $("#overviewUrgent"),
    overviewRows: $("#overviewRows"),
    downloadOverviewButton: $("#downloadOverviewButton"),
    minimalScreen: $("#minimalScreen"),
    minimalRangeLabel: $("#minimalRangeLabel"),
    minimalPageCount: $("#minimalPageCount"),
    minimalDeck: $("#minimalDeck"),
    minimalEmpty: $("#minimalEmpty"),
    minimalDivider: $("#minimalDivider"),
    minimalInputText: $("#minimalInputText"),
    minimalImageInput: $("#minimalImageInput"),
    minimalSampleButton: $("#minimalSampleButton"),
    minimalImagePreviewWrap: $("#minimalImagePreviewWrap"),
    minimalImagePreview: $("#minimalImagePreview"),
    removeMinimalImageButton: $("#removeMinimalImageButton"),
    minimalAnalyzeButton: $("#minimalAnalyzeButton"),
    focusButton: $("#focusButton"),
    heroFocusButton: $("#heroFocusButton"),
    heroImportAction: $("#heroImportAction"),
    designButton: $("#designButton"),
    reminderSettingsButton: $("#reminderSettingsButton"),
    focusModal: $("#focusModal"),
    focusSetup: $("#focusSetup"),
    focusFlight: $("#focusFlight"),
    focusTaskTitle: $("#focusTaskTitle"),
    focusDuration: $("#focusDuration"),
    focusStartTime: $("#focusStartTime"),
    focusSky: $("#focusSky"),
    focusRouteFill: $("#focusRouteFill"),
    focusPlane: $("#focusPlane"),
    focusSessionTitle: $("#focusSessionTitle"),
    focusRemaining: $("#focusRemaining"),
    focusStartButton: $("#focusStartButton"),
    focusPauseButton: $("#focusPauseButton"),
    focusStopButton: $("#focusStopButton"),
    focusScheduleButton: $("#focusScheduleButton"),
    focusNotificationButton: $("#focusNotificationButton"),
    designModal: $("#designModal"),
    designGrid: $("#designGrid"),
    reminderModal: $("#reminderModal"),
    reminderEnabled: $("#reminderEnabled"),
    defaultReminderMinutes: $("#defaultReminderMinutes"),
    requestNotificationPermissionButton: $("#requestNotificationPermissionButton"),
    notificationPermissionStatus: $("#notificationPermissionStatus"),
    saveReminderSettingsButton: $("#saveReminderSettingsButton"),
    personalName: $("#personalName"),
    personalAvatar: $("#personalAvatar"),
    personalSyncStatus: $("#personalSyncStatus"),
    accountManageButton: $("#accountManageButton"),
    exportBackupButton: $("#exportBackupButton"),
    accountExportButton: $("#accountExportButton"),
    accountModal: $("#accountModal"),
    accountDisplayName: $("#accountDisplayName"),
    accountAvatar: $("#accountAvatar"),
    accountStatusText: $("#accountStatusText"),
    localTaskCount: $("#localTaskCount"),
    cloudStateText: $("#cloudStateText"),
    accountModeLabel: $("#accountModeLabel"),
    accountAvatarInput: $("#accountAvatarInput"),
    syncNowButton: $("#syncNowButton"),
    importBackupButton: $("#importBackupButton"),
    clearLocalButton: $("#clearLocalButton"),
    openAccountSignOutButton: $("#openAccountSignOutButton"),
    backupFileInput: $("#backupFileInput"),
    petSettingsModal: $("#petSettingsModal"),
    petSettingsForm: $("#petSettingsForm"),
    petEnabled: $("#petEnabled"),
    petName: $("#petName"),
    petEmoji: $("#petEmoji"),
    petPreset: $("#petPreset"),
    petImageInput: $("#petImageInput"),
    petPreviewImage: $("#petPreviewImage"),
    petPreviewEmoji: $("#petPreviewEmoji"),
    petBgTolerance: $("#petBgTolerance"),
    removePetBackgroundButton: $("#removePetBackgroundButton"),
    removePetBackgroundAIButton: $("#removePetBackgroundAIButton"),
    clearPetImageButton: $("#clearPetImageButton"),
    desktopPet: $("#desktopPet"),
    petImage: $("#petImage"),
    petFallback: $("#petFallback"),
    petNameLabel: $("#petNameLabel"),
    petSchedule: $("#petSchedule"),
    petContextMenu: $("#petContextMenu"),
    petSettingsMenuButton: $("#petSettingsMenuButton"),
    petOpenMainButton: $("#petOpenMainButton"),
    petCloseButton: $("#petCloseButton"),
    toast: $("#toast")
  });

  state.themes = loadThemes();
  state.events = loadEvents();
  state.keywordRules = loadKeywordRules();
  state.aiConfig = loadAIConfig();
  state.pet = loadPetSettings();
  state.mode = loadMode();
  state.minimalSplit = Number(storageGet(MINIMAL_SPLIT_KEY) || 50);
  state.designTheme = storageGet(DESIGN_KEY) || "apex";
  try { state.reminderSettings = { enabled: true, minutes: 15, ...(JSON.parse(storageGet(REMINDER_SETTINGS_KEY) || "{}")) }; } catch (error) {}
  loadFocusSession();
  if (!state.themes.some((theme) => theme.id === state.activeThemeId)) state.activeThemeId = state.themes[0].id;

  populateThemeSelects();
  dom.sortSelect.value = state.sort;
  bindSidebars();
  bindFilters();
  bindThemeAndTaskActions();
  bindImportActions();
  bindModalsAndCards();
  bindV3Actions();
  bindMinimalActions();
  applyMode(state.mode);
  applyDesignTheme(state.designTheme, false);
  initScrollThemeMotion();
  updateScrim();
  updateAIStatus();
  renderAll();
  if (state.focusSession) {
    focusTimer = window.setInterval(() => {
      if (!state.focusSession) return;
      if (state.focusSession.status === "running") {
        state.focusSession.remainingSeconds = Math.max(0, Math.ceil((state.focusSession.endAt - Date.now()) / 1000));
        if (state.focusSession.remainingSeconds <= 0) finishFocusSession();
        else renderFocusSession();
      }
    }, 1000);
  }

  if (window.BiejiCloud) {
    window.BiejiCloud.onAuth(({ authenticated, user }) => {
      cloudReady = Boolean(authenticated && window.BiejiCloud.enabled);
      if (authenticated) {
        const scopeChanged = activateUserStorage(user);
        if (scopeChanged) loadActiveUserState();
      } else {
        resetCloudUserState();
      }
      updateAIStatus();
      updatePersonalPanel();
    });
    window.BiejiCloud.onSnapshot((snapshot) => {
      if (!cloudReady) return;
      if (cloudDirty) { syncNow(); return; }
      applyCloudSnapshot(snapshot);
      updatePersonalPanel();
    });
    window.addEventListener("online", () => {
      if (cloudReady && cloudDirty) syncNow();
      updatePersonalPanel();
    });
    window.addEventListener("offline", updatePersonalPanel);
    try {
      const cloud = await window.BiejiCloud.init();
      cloudReady = Boolean(cloud.authenticated && cloud.enabled);
      if (cloud.authenticated && cloud.snapshot) applyCloudSnapshot(cloud.snapshot);
      updatePersonalPanel();
    } catch (error) {
      showToast("云端初始化失败，当前使用本地数据");
    }
  }
}

init().catch((error) => {
  console.error(error);
  showToast("页面初始化失败，请刷新重试");
});
