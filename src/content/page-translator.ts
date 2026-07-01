import { sendRuntimeMessage } from "@/shared/messages"
import type { UiLocale } from "@/shared/i18n"
import type {
  PageTranslationState,
  ProgressPosition,
  StartTranslationRequest,
  TranslationDisplayMode,
} from "@/shared/types"
import type { SiteRulePack } from "@/shared/site-rules"
import { collectTranslatableBlocks } from "./dom-walker"
import { extractRichFragment } from "./rich-fragment"
import { collectRuleTranslatableBlocks, selectRuleForCurrentPage } from "./site-rule-engine"
import {
  applyTranslationDisplayMode,
  createLoadingWrapper,
  injectBaseStyles,
  removeAllWrappers,
  removeTranslationProgress,
  renderError,
  renderTranslationProgress,
  renderTranslation,
} from "./translation-renderer"

interface TranslationRecord {
  element: HTMLElement
  wrapper: HTMLElement
}

export class PageTranslator {
  private isActive = false
  private providerId: string | undefined
  private progressPosition: ProgressPosition = "bottom-center"
  private uiLocale: UiLocale = "en"
  private displayMode: TranslationDisplayMode = "bilingual"
  private activeSiteRule: SiteRulePack | undefined
  private translatedCount = 0
  private observedElements = new Set<HTMLElement>()
  private translatedElements = new Set<HTMLElement>()
  private readonly records = new Map<string, TranslationRecord>()
  private intersectionObserver: IntersectionObserver | null = null
  private mutationObserver: MutationObserver | null = null

  setProviderId(providerId: string | undefined): void {
    if (this.isActive) {
      return
    }

    this.providerId = providerId
  }

  async start(options: StartTranslationRequest): Promise<PageTranslationState> {
    if (this.isActive) {
      return this.getState()
    }

    this.isActive = true
    this.providerId = options.providerId
    this.progressPosition = options.progressPosition
    this.uiLocale = options.uiLocale
    this.displayMode = "bilingual"
    this.activeSiteRule = await this.resolveSiteRule(options)
    this.translatedCount = 0
    this.observedElements = new Set()
    this.translatedElements = new Set()
    this.records.clear()
    injectBaseStyles()
    applyTranslationDisplayMode(this.displayMode)
    this.updateProgress()

    this.intersectionObserver = new IntersectionObserver(
      entries => {
        for (const entry of entries) {
          if (entry.isIntersecting && entry.target instanceof HTMLElement) {
            this.intersectionObserver?.unobserve(entry.target)
            void this.translateElement(entry.target)
          }
        }
      },
      { rootMargin: "600px 0px", threshold: 0.01 },
    )

    this.mutationObserver = new MutationObserver(records => {
      for (const record of records) {
        for (const node of [...record.addedNodes]) {
          if (node instanceof HTMLElement) {
            this.observeBlocks(node)
          }
        }
      }
    })

    this.mutationObserver.observe(document.body, {
      childList: true,
      subtree: true,
    })

    this.observeBlocks(document.body)
    this.updateProgress()
    return this.getState()
  }

  stop(): PageTranslationState {
    this.isActive = false
    this.providerId = undefined
    this.progressPosition = "bottom-center"
    this.uiLocale = "en"
    this.displayMode = "bilingual"
    this.activeSiteRule = undefined
    this.intersectionObserver?.disconnect()
    this.mutationObserver?.disconnect()
    this.intersectionObserver = null
    this.mutationObserver = null
    this.records.clear()
    this.observedElements = new Set()
    this.translatedElements = new Set()
    removeAllWrappers()
    removeTranslationProgress()
    return this.getState()
  }

  getState(): PageTranslationState {
    return {
      isActive: this.isActive,
      activeSiteRuleId: this.activeSiteRule?.id,
      activeSiteRuleName: this.activeSiteRule?.name,
      providerId: this.providerId,
      translatedCount: this.translatedCount,
      pendingCount: this.records.size,
      totalCount: this.observedElements.size,
      remainingCount: Math.max(this.observedElements.size - this.translatedCount, 0),
    }
  }

  private observeBlocks(root: ParentNode): void {
    if (!this.isActive || !this.intersectionObserver) {
      return
    }

    let observedNewElement = false
    for (const element of this.collectBlocks(root)) {
      if (this.observedElements.has(element) || this.translatedElements.has(element)) {
        continue
      }

      this.observedElements.add(element)
      this.intersectionObserver.observe(element)
      observedNewElement = true
    }

    if (observedNewElement) {
      this.updateProgress()
    }
  }

  private async translateElement(element: HTMLElement): Promise<void> {
    if (!this.isActive || this.translatedElements.has(element)) {
      return
    }

    const fragment = extractRichFragment(element)
    if (!fragment) {
      this.observedElements.delete(element)
      this.updateProgress()
      return
    }

    const id = crypto.randomUUID()
    const providerId = this.providerId
    if (!providerId) {
      return
    }
    const wrapper = createLoadingWrapper(element, this.uiLocale)
    this.records.set(id, { element, wrapper })
    this.updateProgress()

    try {
      const response = await sendRuntimeMessage("TRANSLATE_FRAGMENT", {
        id,
        providerId,
        sourceHtml: fragment.sourceHtml,
        sourceText: fragment.sourceText,
      })

      if (!this.isActive || !wrapper.isConnected) {
        return
      }

      renderTranslation(
        wrapper,
        response.translatedHtml,
        response.translatedText,
        fragment.sourceHtml,
        fragment.inlineCodeHints,
      )
      this.translatedElements.add(element)
      this.translatedCount += 1
    }
    catch (error) {
      if (!wrapper.isConnected) {
        return
      }
      renderError(wrapper, error instanceof Error ? error.message : String(error), () => {
        wrapper.remove()
        this.records.delete(id)
        this.updateProgress()
        void this.translateElement(element)
      }, this.uiLocale)
    }
    finally {
      this.records.delete(id)
      this.updateProgress()
    }
  }

  private collectBlocks(root: ParentNode): HTMLElement[] {
    if (this.activeSiteRule) {
      return collectRuleTranslatableBlocks(this.activeSiteRule)
    }

    return collectTranslatableBlocks(root)
  }

  async refreshSiteRule(): Promise<PageTranslationState> {
    if (!this.isActive) {
      return this.getState()
    }

    this.activeSiteRule = await this.resolveCurrentSiteRule()
    this.updateProgress()
    return this.getState()
  }

  private async resolveSiteRule(options: StartTranslationRequest): Promise<SiteRulePack | undefined> {
    if (options.inlineSiteRule) {
      return options.inlineSiteRule
    }

    try {
      const rules = await sendRuntimeMessage("GET_SITE_RULES")
      if (options.siteRuleId) {
        return rules.find(rule => rule.id === options.siteRuleId && rule.enabled)
      }
      return selectRuleForCurrentPage(rules)
    }
    catch {
      return undefined
    }
  }

  private async resolveCurrentSiteRule(): Promise<SiteRulePack | undefined> {
    try {
      return selectRuleForCurrentPage(await sendRuntimeMessage("GET_SITE_RULES"))
    }
    catch {
      return undefined
    }
  }

  private updateProgress(): void {
    renderTranslationProgress({
      ...this.getState(),
      displayMode: this.displayMode,
      onDisplayModeChange: mode => this.setDisplayMode(mode),
      progressPosition: this.progressPosition,
      uiLocale: this.uiLocale,
    })
  }

  private setDisplayMode(mode: TranslationDisplayMode): void {
    this.displayMode = mode
    applyTranslationDisplayMode(mode)
    this.updateProgress()
  }
}
