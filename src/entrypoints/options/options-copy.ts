import type { UiLocale } from "@/shared/i18n"
import type { SiteRuleScopeKind } from "@/shared/site-rules"

export function optionsCopy(locale: UiLocale, key: string): string {
  const zhCN: Record<string, string> = {
    advancedPrompt: "高级 Prompt",
    advancedPromptDescription: "调整发送给 provider 的提示词。普通使用可以保持默认。",
    basicSettings: "基本设置",
    disabled: "停用",
    enabled: "启用",
    filterRules: "搜索规则",
    filterRulesPlaceholder: "按名称、host、URL、路径或说明过滤",
    inputTranslation: "输入框翻译",
    inputTranslationSectionDescription: "这是写作辅助功能，独立于网页阅读翻译。",
    interface: "界面",
    interfaceDescription: "设置 OpenRead 自身界面的显示语言。",
    noMatchingRules: "没有匹配的规则",
    noMatchingRulesDescription: "换一个关键词，或清空搜索条件。",
    noRules: "还没有翻译规则",
    noRulesDescription: "在 popup 中选择翻译区域并保存后，规则会显示在这里。",
    pageTranslation: "网页翻译",
    pageTranslationDescription: "设置网页阅读翻译的默认目标语言和页面进度提示位置。",
    priority: "优先级 {priority}",
    providerConnection: "Provider 连接",
    regionsAndExcludes: "{regions} 个区域，{excludes} 个排除项",
    ruleCount: "{count} 条规则",
    rulesDescription: "查看已保存的 Site Rules。规则决定哪些页面区域会被翻译。",
    translationRules: "翻译规则",
    updatedAt: "更新于 {time}",
  }
  const en: Record<string, string> = {
    advancedPrompt: "Advanced Prompt",
    advancedPromptDescription: "Tune the prompts sent to the provider. Most users can keep the defaults.",
    basicSettings: "Basic settings",
    disabled: "Disabled",
    enabled: "Enabled",
    filterRules: "Search rules",
    filterRulesPlaceholder: "Filter by name, host, URL, path, or description",
    inputTranslation: "Input translation",
    inputTranslationSectionDescription: "This writing aid is separate from page reading translation.",
    interface: "Interface",
    interfaceDescription: "Set the display language for OpenRead's own UI.",
    noMatchingRules: "No matching rules",
    noMatchingRulesDescription: "Try another keyword or clear the search.",
    noRules: "No translation rules yet",
    noRulesDescription: "Saved region rules from the popup will appear here.",
    pageTranslation: "Page translation",
    pageTranslationDescription: "Set the default target language and progress indicator position for page reading.",
    priority: "Priority {priority}",
    providerConnection: "Provider connection",
    regionsAndExcludes: "{regions} regions, {excludes} excludes",
    ruleCount: "{count} rules",
    rulesDescription: "Review saved Site Rules. Rules decide which page regions are translated.",
    translationRules: "Translation rules",
    updatedAt: "Updated {time}",
  }
  return locale === "zh-CN" || locale === "zh-TW" ? zhCN[key] ?? en[key] ?? key : en[key] ?? key
}

export function scopeKindLabel(locale: UiLocale, kind: SiteRuleScopeKind): string {
  const zhCN: Record<SiteRuleScopeKind, string> = {
    "custom": "自定义",
    "exact-url": "当前 URL",
    "host-glob": "子域名",
    "same-page-type": "同类页面",
    "site": "整站",
  }
  const en: Record<SiteRuleScopeKind, string> = {
    "custom": "Custom",
    "exact-url": "Exact URL",
    "host-glob": "Host glob",
    "same-page-type": "Same page type",
    "site": "Site",
  }
  return locale === "zh-CN" || locale === "zh-TW" ? zhCN[kind] : en[kind]
}
