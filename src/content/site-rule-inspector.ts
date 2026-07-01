import { isUiLocalePreference, resolveUiLocale, type UiLocale } from "@/shared/i18n"
import { sendRuntimeMessage } from "@/shared/messages"
import {
  DEFAULT_SITE_RULE_BLOCK_SELECTORS,
  normalizeExactUrl,
  SITE_RULE_SCHEMA_VERSION,
  type SiteRulePack,
  type SiteRulePreviewResponse,
  type SiteRuleScopeKind,
  type StartRuleSelectionRequest,
  type StartRuleSelectionResponse,
} from "@/shared/site-rules"
import type { ProgressPosition } from "@/shared/types"
import { deriveStableSelector, previewRule as previewRulePack, selectRuleForCurrentPage } from "./site-rule-engine"
import { label, scopeLabel } from "./site-rule-inspector-copy"
import { INSPECTOR_CLASS, injectInspectorStyles } from "./site-rule-inspector-styles"

const DEFAULT_PROGRESS_POSITION: ProgressPosition = "bottom-center"

interface SelectedRegion {
  label: string
  selector: string
  textSample: string
}

export class SiteRuleInspector {
  private active = false
  private hoverElement: HTMLElement | null = null
  private highlight: HTMLElement | null = null
  private panel: HTMLElement | null = null
  private selectedHighlights: HTMLElement[] = []
  private scopeKind: SiteRuleScopeKind = "same-page-type"
  private includes: SelectedRegion[] = []
  private excludes: SiteRulePack["excludes"] = []
  private lastPreview: SiteRulePreviewResponse | null = null
  private draftCreatedAt = Date.now()
  private draftId: string = crypto.randomUUID()
  private loadedRule: SiteRulePack | null = null
  private providerId: string | undefined
  private progressPosition: ProgressPosition = DEFAULT_PROGRESS_POSITION
  private uiLocale: UiLocale = "en"

  async start(request: StartRuleSelectionRequest = {}): Promise<StartRuleSelectionResponse> {
    this.providerId = request.providerId
    this.progressPosition = isProgressPosition(request.progressPosition)
      ? request.progressPosition
      : DEFAULT_PROGRESS_POSITION
    this.uiLocale = resolveUiLocale(isUiLocalePreference(request.uiLocale) ? request.uiLocale : "auto")

    if (this.active) {
      this.renderPanel()
      return { isActive: true }
    }

    this.resetDraft()
    await this.loadCurrentRuleDraft()
    injectInspectorStyles()
    this.highlight = document.createElement("div")
    this.highlight.className = `${INSPECTOR_CLASS}__highlight notranslate`
    document.documentElement.appendChild(this.highlight)

    this.panel = document.createElement("div")
    this.panel.className = `${INSPECTOR_CLASS} notranslate`
    document.documentElement.appendChild(this.panel)

    document.addEventListener("mouseover", this.handleMouseOver, true)
    document.addEventListener("mouseout", this.handleMouseOut, true)
    document.addEventListener("click", this.handleClick, true)
    document.addEventListener("keydown", this.handleKeyDown, true)
    document.addEventListener("scroll", this.handleViewportChange, true)
    window.addEventListener("resize", this.handleViewportChange, true)
    this.active = true
    this.renderSelectedHighlights()
    this.renderPanel()
    return { isActive: true }
  }

  stop(): StartRuleSelectionResponse {
    if (!this.active) {
      return { isActive: false }
    }

    document.removeEventListener("mouseover", this.handleMouseOver, true)
    document.removeEventListener("mouseout", this.handleMouseOut, true)
    document.removeEventListener("click", this.handleClick, true)
    document.removeEventListener("keydown", this.handleKeyDown, true)
    document.removeEventListener("scroll", this.handleViewportChange, true)
    window.removeEventListener("resize", this.handleViewportChange, true)
    this.highlight?.remove()
    this.panel?.remove()
    this.clearSelectedHighlights()
    this.highlight = null
    this.panel = null
    this.hoverElement = null
    this.active = false
    this.includes = []
    this.excludes = []
    this.lastPreview = null
    this.loadedRule = null
    return { isActive: false }
  }

  private readonly handleMouseOver = (event: MouseEvent): void => {
    const target = event.target
    if (!(target instanceof HTMLElement) || this.isInspectorElement(target)) {
      return
    }

    this.hoverElement = target
    this.positionHighlight(target)
  }

  private readonly handleMouseOut = (event: MouseEvent): void => {
    const target = event.target
    if (target === this.hoverElement) {
      this.hoverElement = null
      if (this.highlight) {
        this.highlight.style.display = "none"
      }
    }
  }

  private readonly handleClick = (event: MouseEvent): void => {
    const target = event.target
    if (!(target instanceof HTMLElement) || this.isInspectorElement(target)) {
      return
    }

    event.preventDefault()
    event.stopPropagation()
    const selected = selectedRegionFromElement(target)
    if (!this.includes.some(item => item.selector === selected.selector)) {
      this.includes.push(selected)
    }
    this.refreshPreview()
    this.renderSelectedHighlights()
    this.renderPanel()
  }

  private readonly handleKeyDown = (event: KeyboardEvent): void => {
    if (event.key === "Escape") {
      this.stop()
    }
  }

  private readonly handleViewportChange = (): void => {
    if (this.hoverElement) {
      this.positionHighlight(this.hoverElement)
    }
    this.positionSelectedHighlights()
  }

  private positionHighlight(element: HTMLElement): void {
    if (!this.highlight) {
      return
    }

    const rect = element.getBoundingClientRect()
    this.highlight.style.display = "block"
    this.highlight.style.height = `${Math.max(rect.height, 4)}px`
    this.highlight.style.left = `${rect.left}px`
    this.highlight.style.top = `${rect.top}px`
    this.highlight.style.width = `${Math.max(rect.width, 4)}px`
  }

  private renderPanel(): void {
    if (!this.panel) {
      return
    }

    this.panel.replaceChildren(
      element("h2", {}, text(label(this.uiLocale, "title"))),
      element("p", { className: `${INSPECTOR_CLASS}__hint` }, text(label(this.uiLocale, "hint"))),
      this.renderScopeSelect(),
      this.renderSelectionList(label(this.uiLocale, "include"), this.includes, item => {
        this.includes = this.includes.filter(candidate => candidate.selector !== item.selector)
        this.refreshPreview()
        this.renderSelectedHighlights()
        this.renderPanel()
      }),
      this.renderPreview(),
      this.renderActions(),
    )
  }

  private renderScopeSelect(): HTMLElement {
    const wrapper = element("label", { className: `${INSPECTOR_CLASS}__field` })
    const select = document.createElement("select")
    for (const kind of ["exact-url", "same-page-type", "site", "host-glob", "custom"] as const) {
      const option = document.createElement("option")
      option.value = kind
      option.textContent = scopeLabel(this.uiLocale, kind)
      select.appendChild(option)
    }
    select.value = this.scopeKind
    select.addEventListener("change", event => {
      this.scopeKind = (event.target as HTMLSelectElement).value as SiteRuleScopeKind
      this.refreshPreview()
      this.renderPanel()
    })
    wrapper.append(text(label(this.uiLocale, "scope")), select)
    return wrapper
  }

  private renderSelectionList(
    title: string,
    items: SelectedRegion[],
    onRemove: (item: SelectedRegion) => void,
  ): HTMLElement {
    const section = element("section", { className: `${INSPECTOR_CLASS}__section` })
    section.appendChild(element("strong", {}, text(`${title} (${items.length})`)))
    if (items.length === 0) {
      section.appendChild(element("p", { className: `${INSPECTOR_CLASS}__empty` }, text(label(this.uiLocale, "empty"))))
      return section
    }

    for (const item of items) {
      const row = element("div", { className: `${INSPECTOR_CLASS}__row` })
      const copy = element("span", {}, text(`${item.label}: ${item.textSample || item.selector}`))
      const remove = element("button", { type: "button", className: `${INSPECTOR_CLASS}__icon-button` }, text("x"))
      remove.addEventListener("click", event => {
        event.stopPropagation()
        onRemove(item)
      })
      row.append(copy, remove)
      section.appendChild(row)
    }

    return section
  }

  private renderPreview(): HTMLElement {
    const section = element("section", { className: `${INSPECTOR_CLASS}__preview` })
    const preview = this.lastPreview
    if (!preview) {
      section.appendChild(element("p", {}, text(label(this.uiLocale, "previewEmpty"))))
      return section
    }

    section.appendChild(element(
      "strong",
      {},
      text(label(this.uiLocale, "previewCount").replace("{count}", String(preview.totalCount))),
    ))
    section.appendChild(element("p", {}, text(preview.matchExplanation.reason)))
    if (preview.samples.length > 0) {
      const list = element("ul", {})
      for (const sample of preview.samples) {
        list.appendChild(element("li", {}, text(sample)))
      }
      section.appendChild(list)
    }
    return section
  }

  private renderActions(): HTMLElement {
    const actions = element("div", { className: `${INSPECTOR_CLASS}__actions` })
    const previewButton = element("button", { type: "button" }, text(label(this.uiLocale, "preview")))
    previewButton.addEventListener("click", event => {
      event.stopPropagation()
      this.refreshPreview()
      this.renderPanel()
    })
    const useOnceButton = element("button", { type: "button" }, text(label(this.uiLocale, "useOnce")))
    useOnceButton.disabled = this.includes.length === 0
    useOnceButton.addEventListener("click", event => {
      event.stopPropagation()
      void this.useOnce()
    })
    const saveButton = element("button", { type: "button" }, text(label(this.uiLocale, "save")))
    saveButton.disabled = this.includes.length === 0
    saveButton.addEventListener("click", event => {
      event.stopPropagation()
      void this.saveRule()
    })
    const closeButton = element("button", { type: "button", className: `${INSPECTOR_CLASS}__secondary` }, text(label(this.uiLocale, "close")))
    closeButton.addEventListener("click", event => {
      event.stopPropagation()
      this.stop()
    })
    actions.append(previewButton, useOnceButton, saveButton, closeButton)
    return actions
  }

  private refreshPreview(): void {
    if (this.includes.length === 0) {
      this.lastPreview = null
      return
    }

    this.lastPreview = previewRulePack(this.createRuleDraft())
  }

  private async useOnce(): Promise<void> {
    const config = await sendRuntimeMessage("GET_CONFIG")
    const providerId = this.providerId ?? config.activeProviderId ?? config.providers[0]?.id
    if (!providerId) {
      return
    }

    window.__OPENREAD_TRANSLATOR__?.stop()
    await window.__OPENREAD_TRANSLATOR__?.start({
      providerId,
      inputTranslationEnabled: config.inputTranslationEnabled,
      inlineSiteRule: this.createRuleDraft(),
      progressPosition: this.progressPosition,
      uiLocale: this.uiLocale,
    })
    this.stop()
  }

  private async saveRule(): Promise<void> {
    const draft = this.createRuleDraft()
    try {
      await sendRuntimeMessage("SAVE_SITE_RULE", draft)
      await window.__OPENREAD_TRANSLATOR__?.refreshSiteRule()
      if (!this.active) {
        return
      }
      this.stop()
      showToast(label(this.uiLocale, "ruleSaved"), "success")
    }
    catch {
      showToast(label(this.uiLocale, "ruleSaveFailed"), "error")
    }
  }

  private createRuleDraft(): SiteRulePack {
    const now = Date.now()
    const existing = this.loadedRule
    const scope = existing && existing.scope.kind === this.scopeKind
      ? existing.scope
      : createScope(this.scopeKind, this.includes)
    return {
      schemaVersion: SITE_RULE_SCHEMA_VERSION,
      id: existing?.id ?? this.draftId,
      name: existing?.name ?? `${window.location.hostname} translation regions`,
      description: existing?.description,
      enabled: true,
      priority: existing?.priority ?? 0,
      scope,
      regions: this.includes.map((item, index) => ({
        id: `region-${index + 1}`,
        label: item.label,
        action: "translate",
        mode: "auto",
        rootSelectors: [item.selector],
        blockSelectors: [...DEFAULT_SITE_RULE_BLOCK_SELECTORS],
      })),
      excludes: existing?.excludes ?? this.excludes,
      metadata: {
        ...existing?.metadata,
        createdBy: "manual",
        sourceUrl: normalizeExactUrl(window.location.href),
        humanScopeSummary: scopeLabel(this.uiLocale, this.scopeKind),
        humanRegionSummary: this.includes.map(item => item.label).join(", "),
      },
      createdAt: existing?.createdAt ?? this.draftCreatedAt,
      updatedAt: now,
    }
  }

  private async loadCurrentRuleDraft(): Promise<void> {
    try {
      const rule = selectRuleForCurrentPage(await sendRuntimeMessage("GET_SITE_RULES"))
      if (!rule) {
        return
      }

      this.loadedRule = rule
      this.draftId = rule.id
      this.draftCreatedAt = rule.createdAt
      this.scopeKind = rule.scope.kind
      this.excludes = [...rule.excludes]
      this.includes = selectedRegionsFromRule(rule, this.uiLocale)
      this.refreshPreview()
    }
    catch {
      this.loadedRule = null
    }
  }

  private renderSelectedHighlights(): void {
    this.clearSelectedHighlights()
    for (let index = 0; index < this.includes.length; index += 1) {
      const highlight = document.createElement("div")
      highlight.className = `${INSPECTOR_CLASS}__selected-highlight notranslate`
      const badge = document.createElement("span")
      badge.textContent = label(this.uiLocale, "translationRegionLabel")
      highlight.appendChild(badge)
      document.documentElement.appendChild(highlight)
      this.selectedHighlights.push(highlight)
    }
    this.positionSelectedHighlights()
  }

  private positionSelectedHighlights(): void {
    this.includes.forEach((item, index) => {
      const highlight = this.selectedHighlights[index]
      if (!highlight) {
        return
      }
      const target = queryOne(item.selector)
      if (!target) {
        highlight.style.display = "none"
        return
      }
      const rect = target.getBoundingClientRect()
      highlight.style.display = "block"
      highlight.style.height = `${Math.max(rect.height, 4)}px`
      highlight.style.left = `${rect.left}px`
      highlight.style.top = `${rect.top}px`
      highlight.style.width = `${Math.max(rect.width, 4)}px`
    })
  }

  private clearSelectedHighlights(): void {
    this.selectedHighlights.forEach(highlight => highlight.remove())
    this.selectedHighlights = []
  }

  private isInspectorElement(element: HTMLElement): boolean {
    return !!element.closest(`.${INSPECTOR_CLASS},.${INSPECTOR_CLASS}__highlight`)
  }

  private resetDraft(): void {
    this.draftCreatedAt = Date.now()
    this.draftId = crypto.randomUUID()
    this.includes = []
    this.excludes = []
    this.lastPreview = null
    this.scopeKind = "same-page-type"
    this.loadedRule = null
  }
}

function selectedRegionsFromRule(rule: SiteRulePack, locale: UiLocale): SelectedRegion[] {
  const regions: SelectedRegion[] = []
  for (const region of rule.regions) {
    for (const selector of region.rootSelectors) {
      if (regions.some(item => item.selector === selector)) {
        continue
      }
      const element = queryOne(selector)
      regions.push({
        label: region.label ?? label(locale, "translationRegionLabel"),
        selector,
        textSample: element ? elementText(element).slice(0, 90) : selector,
      })
    }
  }
  return regions
}

function createScope(kind: SiteRuleScopeKind, includes: SelectedRegion[]): SiteRulePack["scope"] {
  const host = window.location.hostname
  const pathname = window.location.pathname
  const pageTraits = kind === "same-page-type"
    ? includes.slice(0, 1).map(item => ({ selector: item.selector, required: true }))
    : []

  switch (kind) {
    case "exact-url":
      return {
        kind,
        label: "Exact page URL",
        url: { exactUrl: normalizeExactUrl(window.location.href) },
      }
    case "same-page-type":
      return {
        kind,
        label: "Same page type",
        url: {
          protocols: [window.location.protocol.replace(/:$/, "")],
          host,
          pathPatterns: [inferPathPattern(pathname)],
        },
        pageTraits,
      }
    case "site":
      return {
        kind,
        label: "Entire site",
        url: {
          protocols: [window.location.protocol.replace(/:$/, "")],
          host,
          pathPatterns: ["/*"],
        },
      }
    case "host-glob":
      return {
        kind,
        label: "Host pattern",
        url: {
          protocols: [window.location.protocol.replace(/:$/, "")],
          hostGlob: inferHostGlob(host),
          pathPatterns: ["/*"],
        },
      }
    case "custom":
      return {
        kind,
        label: "Custom scope",
        url: {
          protocols: [window.location.protocol.replace(/:$/, "")],
          host,
          pathPatterns: [`${pathname}*`],
        },
      }
  }
}

function selectedRegionFromElement(element: HTMLElement): SelectedRegion {
  return {
    label: elementLabel(element),
    selector: deriveStableSelector(element),
    textSample: elementText(element).slice(0, 90),
  }
}

function elementLabel(element: HTMLElement): string {
  const role = element.getAttribute("role")
  if (role) {
    return role
  }
  return element.tagName.toLowerCase()
}

function elementText(element: HTMLElement): string {
  return (element.innerText || element.textContent || "").replace(/\s+/g, " ").trim()
}

function queryOne(selector: string): HTMLElement | null {
  try {
    return document.querySelector<HTMLElement>(selector)
  }
  catch {
    return null
  }
}

function inferPathPattern(pathname: string): string {
  const parts = pathname.split("/").filter(Boolean)
  if (parts.length === 0) {
    return "/"
  }
  if (window.location.hostname === "github.com" && parts.length === 2) {
    return "/:owner/:repo"
  }
  return `/${parts.map(part => likelyIdentifier(part) ? ":slug" : part).join("/")}`
}

function inferHostGlob(host: string): string {
  const parts = host.split(".").filter(Boolean)
  if (parts.length <= 2) {
    return host
  }
  return `*.${parts.slice(-2).join(".")}`
}

function likelyIdentifier(value: string): boolean {
  return /^[a-z0-9_-]{2,}$/i.test(value)
}

function element<K extends keyof HTMLElementTagNameMap>(
  tagName: K,
  props: Partial<HTMLElementTagNameMap[K]> = {},
  ...children: Node[]
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tagName)
  Object.assign(node, props)
  node.append(...children)
  return node
}

function text(value: string): Text {
  return document.createTextNode(value)
}

function showToast(message: string, type: "error" | "success"): void {
  injectInspectorStyles()
  const toast = document.createElement("div")
  toast.className = `${INSPECTOR_CLASS}__toast ${INSPECTOR_CLASS}__toast--${type} notranslate`
  toast.textContent = message
  document.documentElement.appendChild(toast)
  window.setTimeout(() => {
    toast.remove()
  }, type === "error" ? 5200 : 2600)
}

function isProgressPosition(value: unknown): value is ProgressPosition {
  return typeof value === "string"
    && ["bottom-center", "top-center", "top-left", "top-right", "bottom-left", "bottom-right"].includes(value)
}
