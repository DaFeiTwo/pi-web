import type { Locale } from "@/lib/i18n/types";

/**
 * The memory viewer's own words, kept beside the feature instead of in the
 * shared lib/i18n message files, so upstream merges never touch them.
 */
const MESSAGES = {
  en: {
    entry: "Memory",
    title: "Memory",
    subtitle: "What pi-hermes-memory has learned, read-only",
    back: "Back to chat",
    refresh: "Refresh",
    refreshing: "Refreshing…",
    "tab.memory": "Memory",
    "tab.user": "User profile",
    "tab.failures": "Failures",
    "description.memory": "The agent's notes: environment facts, project conventions, tool quirks and lessons.",
    "description.user": "Who you are: name, preferences, communication style and habits.",
    "description.failures": "What did not work and why, so the agent avoids it next time.",
    entries: "{count} entries",
    entryOne: "1 entry",
    updatedAt: "Updated {time}",
    viewEntries: "Entries",
    viewRaw: "Raw",
    notInstalled: "No pi-hermes-memory data directory was found. Check that the plugin is installed and has finished at least one conversation.",
    missingFile: "The plugin has not written {file} yet.",
    emptyFile: "{file} is empty.",
    tooLarge: "{file} is larger than 1 MiB and is not shown here.",
    unreadable: "{file} could not be read.",
    loadFailed: "Could not load memory: {error}",
    readAt: "Read at {time}",
  },
  "zh-CN": {
    entry: "记忆",
    title: "记忆",
    subtitle: "pi-hermes-memory 自动积累的记忆（只读）",
    back: "返回对话",
    refresh: "刷新",
    refreshing: "刷新中…",
    "tab.memory": "长期记忆",
    "tab.user": "用户画像",
    "tab.failures": "失败记录",
    "description.memory": "Agent 的笔记：环境信息、项目约定、工具特性和经验教训。",
    "description.user": "关于你：称呼、偏好、沟通风格和习惯。",
    "description.failures": "做过但没成功的事和原因，下次避免重犯。",
    entries: "{count} 条",
    entryOne: "1 条",
    updatedAt: "更新于 {time}",
    viewEntries: "条目",
    viewRaw: "原文",
    notInstalled: "没有找到 pi-hermes-memory 的数据目录。请确认插件已安装，并至少完成过一次对话。",
    missingFile: "插件还没有生成 {file}。",
    emptyFile: "{file} 是空的。",
    tooLarge: "{file} 超过 1 MiB，页面中不显示。",
    unreadable: "{file} 无法读取。",
    loadFailed: "记忆加载失败：{error}",
    readAt: "读取于 {time}",
  },
  "zh-TW": {
    entry: "記憶",
    title: "記憶",
    subtitle: "pi-hermes-memory 自動累積的記憶（唯讀）",
    back: "返回對話",
    refresh: "重新整理",
    refreshing: "重新整理中…",
    "tab.memory": "長期記憶",
    "tab.user": "使用者輪廓",
    "tab.failures": "失敗紀錄",
    "description.memory": "Agent 的筆記：環境資訊、專案慣例、工具特性和經驗教訓。",
    "description.user": "關於你：稱呼、偏好、溝通風格和習慣。",
    "description.failures": "做過但沒成功的事和原因，下次避免重犯。",
    entries: "{count} 則",
    entryOne: "1 則",
    updatedAt: "更新於 {time}",
    viewEntries: "條目",
    viewRaw: "原文",
    notInstalled: "找不到 pi-hermes-memory 的資料目錄。請確認外掛已安裝，並至少完成過一次對話。",
    missingFile: "外掛還沒有產生 {file}。",
    emptyFile: "{file} 是空的。",
    tooLarge: "{file} 超過 1 MiB，頁面中不顯示。",
    unreadable: "{file} 無法讀取。",
    loadFailed: "記憶載入失敗：{error}",
    readAt: "讀取於 {time}",
  },
} satisfies Record<Locale, Record<string, string>>;

export type HermesMemoryMessageKey = keyof typeof MESSAGES.en;

export function hermesMemoryText(
  locale: Locale,
  key: HermesMemoryMessageKey,
  params?: Record<string, string | number>,
): string {
  const template: string = (MESSAGES[locale] as Record<string, string>)[key] ?? MESSAGES.en[key];
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) => (
    name in params ? String(params[name]) : match
  ));
}
