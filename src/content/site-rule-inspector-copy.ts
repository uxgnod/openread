import type { UiLocale } from "@/shared/i18n"
import type { SiteRuleScopeKind } from "@/shared/site-rules"

type InspectorLabelKey =
  | "close"
  | "empty"
  | "hint"
  | "include"
  | "preview"
  | "previewCount"
  | "previewEmpty"
  | "ruleSaved"
  | "ruleSaveFailed"
  | "save"
  | "scope"
  | "title"
  | "translationRegionLabel"
  | "useOnce"

export function label(locale: UiLocale, key: InspectorLabelKey): string {
  const zhCN: Record<InspectorLabelKey, string> = {
    close: "关闭",
    empty: "点击页面区块添加",
    hint: "点击页面区块添加翻译区域。按 Esc 退出。",
    include: "翻译区域",
    preview: "预览命中",
    previewCount: "将翻译 {count} 个文本块",
    previewEmpty: "还没有预览。",
    ruleSaved: "规则已保存",
    ruleSaveFailed: "规则保存失败",
    save: "保存规则",
    scope: "匹配范围",
    title: "选择翻译区域",
    translationRegionLabel: "翻译区",
    useOnce: "仅本次使用",
  }
  const en: Record<InspectorLabelKey, string> = {
    close: "Close",
    empty: "Click page blocks to add",
    hint: "Click page blocks to translate. Press Esc to exit.",
    include: "Translation regions",
    preview: "Preview",
    previewCount: "Will translate {count} text blocks",
    previewEmpty: "No preview yet.",
    ruleSaved: "Rule saved.",
    ruleSaveFailed: "Rule could not be saved.",
    save: "Save rule",
    scope: "Scope",
    title: "Select translation regions",
    translationRegionLabel: "Translation region",
    useOnce: "Use once",
  }

  return locale === "zh-CN" || locale === "zh-TW" ? zhCN[key] : en[key]
}

export function scopeLabel(locale: UiLocale, kind: SiteRuleScopeKind): string {
  const zhCN: Record<SiteRuleScopeKind, string> = {
    "custom": "自定义范围",
    "exact-url": "仅当前页面",
    "host-glob": "匹配子域名",
    "same-page-type": "同类页面",
    "site": "整个网站",
  }
  const en: Record<SiteRuleScopeKind, string> = {
    "custom": "Custom scope",
    "exact-url": "Only this page",
    "host-glob": "Matching subdomains",
    "same-page-type": "Same page type",
    "site": "Entire site",
  }

  return locale === "zh-CN" || locale === "zh-TW" ? zhCN[kind] : en[kind]
}
