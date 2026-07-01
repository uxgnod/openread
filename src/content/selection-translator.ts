import { OPENREAD_SELECTION_CARD_CLASS } from "@/shared/dom-rules"
import { t, type UiLocale } from "@/shared/i18n"
import { sendRuntimeMessage } from "@/shared/messages"
import { htmlToText, sanitizeRichHtml } from "@/shared/sanitize"
import {
  DEFAULT_USER_CONFIG,
  type OpenSelectionTranslationRequest,
  type OpenSelectionTranslationResponse,
  type TranslateFragmentResponse,
  type UserConfig,
} from "@/shared/types"
import { injectBaseStyles } from "./translation-renderer"

const AUTO_TRANSLATE_DEBOUNCE_MS = 420
const CARD_GAP = 10
const VIEWPORT_MARGIN = 12
const FALLBACK_CARD_WIDTH = 380
const FALLBACK_CARD_HEIGHT = 168

type TranslateSelectionText = (
  sourceText: string,
  providerId: string | undefined,
) => Promise<TranslateFragmentResponse>

type ReadUserConfig = () => Promise<UserConfig>

interface SelectionSnapshot {
  rect: SelectionRect
  text: string
}

export interface SelectionRect {
  bottom: number
  height: number
  left: number
  right: number
  top: number
  width: number
}

export interface CardSize {
  height: number
  width: number
}

export interface ViewportSize {
  height: number
  width: number
}

export interface SelectionCardPosition {
  left: number
  placement: "above" | "below" | "fallback"
  top: number
}

interface SelectionCardParts {
  body: HTMLElement
  card: HTMLElement
  languagePair: HTMLElement
  pinButton: HTMLButtonElement
  tip: HTMLElement
}

interface SelectionCardRecord extends SelectionCardParts {
  anchorRect: SelectionRect | null
  id: string
  manualPosition?: { left: number; top: number }
  providerId: string | undefined
  sourceText: string
  targetLanguage: string
  translationToken: number
}

export class SelectionTranslator {
  private installed = false
  private providerId: string | undefined
  private uiLocale: UiLocale = "en"
  private lastSelection: SelectionSnapshot | null = null
  private pinnedSelectionTimer: number | undefined
  private readonly cards = new Map<string, SelectionCardRecord>()

  constructor(
    private readonly translateText: TranslateSelectionText = translateSelectionTextWithRuntime,
    private readonly readConfig: ReadUserConfig = readConfigWithRuntime,
  ) {}

  start(): void {
    if (this.installed) {
      return
    }

    document.addEventListener("selectionchange", this.handleSelectionChange, true)
    document.addEventListener("keyup", this.handleSelectionChange, true)
    document.addEventListener("mouseup", this.handleSelectionChange, true)
    document.addEventListener("pointerdown", this.handleDocumentPointerDown, true)
    this.installed = true
  }

  stop(): void {
    if (!this.installed) {
      return
    }

    document.removeEventListener("selectionchange", this.handleSelectionChange, true)
    document.removeEventListener("keyup", this.handleSelectionChange, true)
    document.removeEventListener("mouseup", this.handleSelectionChange, true)
    document.removeEventListener("pointerdown", this.handleDocumentPointerDown, true)
    if (this.pinnedSelectionTimer !== undefined) {
      window.clearTimeout(this.pinnedSelectionTimer)
      this.pinnedSelectionTimer = undefined
    }
    this.installed = false
  }

  setPageProvider(providerId: string | undefined, uiLocale: UiLocale): void {
    this.providerId = providerId
    this.uiLocale = uiLocale
  }

  async openSelectionTranslation(
    request: OpenSelectionTranslationRequest,
  ): Promise<OpenSelectionTranslationResponse> {
    const sourceText = request.sourceText.trim()
    if (!sourceText) {
      throw new Error("Selection text is empty.")
    }

    const config = await this.readConfig().catch(() => DEFAULT_USER_CONFIG)
    const providerId = this.providerId ?? config.activeProviderId ?? config.providers[0]?.id
    const targetLanguage = config.targetLanguage.trim() || DEFAULT_USER_CONFIG.targetLanguage
    const anchorRect = this.resolveAnchorRect(sourceText)
    const pinnedRecord = this.getPinnedRecord()

    if (pinnedRecord) {
      this.updateCardTranslation(pinnedRecord, {
        anchorRect,
        providerId,
        sourceText,
        targetLanguage,
      })
      return { cardId: pinnedRecord.id }
    }

    const record = this.createCardRecord({
      anchorRect,
      providerId,
      sourceText,
      targetLanguage,
    })
    this.cards.set(record.id, record)
    document.documentElement.appendChild(record.card)
    this.updateCardTranslation(record, {
      anchorRect,
      providerId,
      sourceText,
      targetLanguage,
    })

    return { cardId: record.id }
  }

  private readonly handleSelectionChange = (): void => {
    const snapshot = readSelectionSnapshot()
    if (!snapshot) {
      return
    }

    this.lastSelection = snapshot
    this.schedulePinnedSelectionTranslation(snapshot)
  }

  private readonly handleDocumentPointerDown = (event: PointerEvent): void => {
    if (event.button !== 0) {
      return
    }

    const target = event.target
    if (target instanceof Element && target.closest(`.${OPENREAD_SELECTION_CARD_CLASS}`)) {
      return
    }

    for (const record of [...this.cards.values()]) {
      if (record.card.dataset.openreadPinned !== "true") {
        this.closeCard(record.id)
      }
    }
  }

  private schedulePinnedSelectionTranslation(snapshot: SelectionSnapshot): void {
    const pinnedRecord = this.getPinnedRecord()
    if (!pinnedRecord || selectionTextMatches(pinnedRecord.sourceText, snapshot.text)) {
      return
    }

    if (this.pinnedSelectionTimer !== undefined) {
      window.clearTimeout(this.pinnedSelectionTimer)
    }

    this.pinnedSelectionTimer = window.setTimeout(() => {
      this.pinnedSelectionTimer = undefined
      const latestSnapshot = this.lastSelection
      const record = this.getPinnedRecord()
      if (!record || !latestSnapshot || selectionTextMatches(record.sourceText, latestSnapshot.text)) {
        return
      }

      void this.readConfig().then(config => {
        const providerId = this.providerId ?? config.activeProviderId ?? config.providers[0]?.id
        const targetLanguage = config.targetLanguage.trim() || DEFAULT_USER_CONFIG.targetLanguage
        this.updateCardTranslation(record, {
          anchorRect: latestSnapshot.rect,
          providerId,
          sourceText: latestSnapshot.text,
          targetLanguage,
        })
      }).catch(() => {
        this.updateCardTranslation(record, {
          anchorRect: latestSnapshot.rect,
          providerId: this.providerId,
          sourceText: latestSnapshot.text,
          targetLanguage: record.targetLanguage,
        })
      })
    }, AUTO_TRANSLATE_DEBOUNCE_MS)
  }

  private createCardRecord({
    anchorRect,
    providerId,
    sourceText,
    targetLanguage,
  }: {
    anchorRect: SelectionRect | null
    providerId: string | undefined
    sourceText: string
    targetLanguage: string
  }): SelectionCardRecord {
    injectBaseStyles()

    const id = crypto.randomUUID()
    const parts = createSelectionCard({
      id,
      onClose: () => this.closeCard(id),
      onDrag: position => {
        const record = this.cards.get(id)
        if (record) {
          record.manualPosition = position
        }
      },
      onPinChange: pinned => this.setPinned(id, pinned),
      sourceLanguage: detectSourceLanguage(sourceText).code,
      targetLanguage,
      uiLocale: this.uiLocale,
    })

    return {
      ...parts,
      anchorRect,
      id,
      providerId,
      sourceText,
      targetLanguage,
      translationToken: 0,
    }
  }

  private updateCardTranslation(
    record: SelectionCardRecord,
    next: {
      anchorRect: SelectionRect | null
      providerId: string | undefined
      sourceText: string
      targetLanguage: string
    },
  ): void {
    record.anchorRect = next.anchorRect
    record.providerId = next.providerId
    record.sourceText = next.sourceText
    record.targetLanguage = next.targetLanguage
    record.translationToken += 1
    renderLanguagePair(record.languagePair, detectSourceLanguage(next.sourceText).code, next.targetLanguage, this.uiLocale)
    renderSelectionTip(record.tip, record.card.dataset.openreadPinned === "true", this.uiLocale)
    this.renderLoading(record)
    this.repositionCard(record.id)
    void this.translateIntoCard(record, record.translationToken)
  }

  private resolveAnchorRect(sourceText: string): SelectionRect | null {
    const currentSelection = readSelectionSnapshot()
    if (currentSelection && selectionTextMatches(currentSelection.text, sourceText)) {
      this.lastSelection = currentSelection
      return currentSelection.rect
    }

    if (this.lastSelection && selectionTextMatches(this.lastSelection.text, sourceText)) {
      return this.lastSelection.rect
    }

    return currentSelection?.rect ?? this.lastSelection?.rect ?? null
  }

  private async translateIntoCard(record: SelectionCardRecord, token: number): Promise<void> {
    try {
      const response = await this.translateText(record.sourceText, record.providerId)
      if (!this.isCurrentRecordTranslation(record, token)) {
        return
      }
      renderSelectionCardTranslation(record.body, response)
      record.card.dataset.openreadStatus = "complete"
      this.repositionCard(record.id)
    }
    catch (error) {
      if (!this.isCurrentRecordTranslation(record, token)) {
        return
      }
      renderSelectionCardError(record.body, error instanceof Error ? error.message : String(error), () => {
        record.translationToken += 1
        this.renderLoading(record)
        void this.translateIntoCard(record, record.translationToken)
      }, this.uiLocale)
      record.card.dataset.openreadStatus = "error"
      this.repositionCard(record.id)
    }
  }

  private renderLoading(record: SelectionCardRecord): void {
    record.card.dataset.openreadStatus = "loading"
    record.body.textContent = t(this.uiLocale, "translating")
  }

  private closeCard(cardId: string): void {
    this.cards.get(cardId)?.card.remove()
    this.cards.delete(cardId)
  }

  private setPinned(cardId: string, pinned: boolean): void {
    const targetRecord = this.cards.get(cardId)
    if (!targetRecord) {
      return
    }

    if (pinned) {
      for (const record of this.cards.values()) {
        if (record.id !== cardId) {
          applyPinnedState(record, false, this.uiLocale)
        }
      }
    }

    applyPinnedState(targetRecord, pinned, this.uiLocale)
    this.repositionCard(cardId)
  }

  private getPinnedRecord(): SelectionCardRecord | undefined {
    return [...this.cards.values()].find(record => record.card.dataset.openreadPinned === "true")
  }

  private isCurrentRecordTranslation(record: SelectionCardRecord, token: number): boolean {
    return record.card.isConnected && this.cards.get(record.id) === record && record.translationToken === token
  }

  private repositionCard(cardId: string): void {
    const record = this.cards.get(cardId)
    if (!record) {
      return
    }

    const calculatedPosition = calculateSelectionCardPosition(
      record.anchorRect,
      measureCard(record.card),
      { height: window.innerHeight, width: window.innerWidth },
    )
    const position = record.manualPosition ?? calculatedPosition
    const clampedPosition = clampCardPosition(position, measureCard(record.card), {
      height: window.innerHeight,
      width: window.innerWidth,
    })

    record.card.dataset.openreadPlacement = record.manualPosition ? "manual" : calculatedPosition.placement
    record.card.style.left = `${clampedPosition.left}px`
    record.card.style.top = `${clampedPosition.top}px`
  }
}

export async function translateSelectionTextWithRuntime(
  sourceText: string,
  providerId: string | undefined,
): Promise<TranslateFragmentResponse> {
  const config = await sendRuntimeMessage("GET_CONFIG")
  const selectedProviderId = providerId ?? config.activeProviderId ?? config.providers[0]?.id
  if (!selectedProviderId) {
    throw new Error("Provider is not configured.")
  }

  return sendRuntimeMessage("TRANSLATE_FRAGMENT", {
    id: crypto.randomUUID(),
    providerId: selectedProviderId,
    sourceHtml: plainTextToHtml(sourceText),
    sourceText,
  })
}

export function detectSourceLanguage(text: string): { code: string; label: string } {
  const hiraganaKatakanaCount = countMatches(text, /[\p{Script=Hiragana}\p{Script=Katakana}]/gu)
  const hangulCount = countMatches(text, /\p{Script=Hangul}/gu)
  const hanCount = countMatches(text, /\p{Script=Han}/gu)
  const latinCount = countMatches(text, /\p{Script=Latin}/gu)

  if (hiraganaKatakanaCount > 0) {
    return { code: "ja", label: "Japanese" }
  }
  if (hangulCount > 0) {
    return { code: "ko", label: "Korean" }
  }
  if (hanCount >= 2 && hanCount >= latinCount) {
    return { code: "zh", label: "Chinese" }
  }
  if (latinCount >= 2) {
    return { code: "en", label: "English" }
  }

  return { code: "auto", label: "Auto" }
}

export function displayLanguageName(language: string, locale: UiLocale): string {
  const normalized = language.trim().toLowerCase()
  const useChineseNames = locale === "zh-CN" || locale === "zh-TW"
  const names = useChineseNames ? CHINESE_LANGUAGE_NAMES : ENGLISH_LANGUAGE_NAMES
  return names[normalized] ?? (language.trim() || names.auto)
}

export function calculateSelectionCardPosition(
  anchorRect: SelectionRect | null,
  cardSize: CardSize,
  viewport: ViewportSize,
): SelectionCardPosition {
  const width = Math.min(cardSize.width || FALLBACK_CARD_WIDTH, Math.max(viewport.width - (VIEWPORT_MARGIN * 2), 0))
  const height = Math.min(cardSize.height || FALLBACK_CARD_HEIGHT, Math.max(viewport.height - (VIEWPORT_MARGIN * 2), 0))

  if (!anchorRect) {
    return {
      left: clamp(viewport.width - width - 24, VIEWPORT_MARGIN, Math.max(viewport.width - width - VIEWPORT_MARGIN, VIEWPORT_MARGIN)),
      placement: "fallback",
      top: clamp(72, VIEWPORT_MARGIN, Math.max(viewport.height - height - VIEWPORT_MARGIN, VIEWPORT_MARGIN)),
    }
  }

  const preferredLeft = anchorRect.left + (anchorRect.width / 2) - (width / 2)
  const left = clamp(preferredLeft, VIEWPORT_MARGIN, Math.max(viewport.width - width - VIEWPORT_MARGIN, VIEWPORT_MARGIN))
  const belowTop = anchorRect.bottom + CARD_GAP
  const aboveTop = anchorRect.top - CARD_GAP - height
  const maxTop = Math.max(viewport.height - height - VIEWPORT_MARGIN, VIEWPORT_MARGIN)

  if (belowTop + height <= viewport.height - VIEWPORT_MARGIN) {
    return { left, placement: "below", top: belowTop }
  }

  if (aboveTop >= VIEWPORT_MARGIN) {
    return { left, placement: "above", top: aboveTop }
  }

  return {
    left,
    placement: belowTop <= viewport.height / 2 ? "below" : "above",
    top: clamp(belowTop, VIEWPORT_MARGIN, maxTop),
  }
}

function createSelectionCard({
  id,
  onClose,
  onDrag,
  onPinChange,
  sourceLanguage,
  targetLanguage,
  uiLocale,
}: {
  id: string
  onClose: () => void
  onDrag: (position: { left: number; top: number }) => void
  onPinChange: (pinned: boolean) => void
  sourceLanguage: string
  targetLanguage: string
  uiLocale: UiLocale
}): SelectionCardParts {
  const card = document.createElement("section")
  card.className = `${OPENREAD_SELECTION_CARD_CLASS} notranslate`
  card.dataset.openreadCardId = id
  card.dataset.openreadPinned = "false"
  card.dataset.openreadStatus = "loading"
  card.setAttribute("aria-live", "polite")

  const topbar = document.createElement("div")
  topbar.className = `${OPENREAD_SELECTION_CARD_CLASS}__topbar`

  const languagePair = document.createElement("div")
  languagePair.className = `${OPENREAD_SELECTION_CARD_CLASS}__language-pair`
  renderLanguagePair(languagePair, sourceLanguage, targetLanguage, uiLocale)

  const actions = document.createElement("div")
  actions.className = `${OPENREAD_SELECTION_CARD_CLASS}__actions`

  const pinButton = createIconButton("Pin translation", createPinSvg())
  pinButton.setAttribute("aria-pressed", "false")
  pinButton.addEventListener("click", event => {
    event.stopPropagation()
    onPinChange(card.dataset.openreadPinned !== "true")
  })

  const closeButton = createIconButton("Close translation", createCloseSvg())
  closeButton.addEventListener("click", event => {
    event.stopPropagation()
    onClose()
  })

  installDragHandlers(topbar, card, onDrag)

  actions.append(pinButton, closeButton)
  topbar.append(languagePair, actions)

  const body = document.createElement("div")
  body.className = `${OPENREAD_SELECTION_CARD_CLASS}__body`

  const tip = document.createElement("p")
  tip.className = `${OPENREAD_SELECTION_CARD_CLASS}__tip`
  renderSelectionTip(tip, false, uiLocale)

  card.append(topbar, body, tip)
  return { body, card, languagePair, pinButton, tip }
}

function applyPinnedState(record: SelectionCardRecord, pinned: boolean, locale: UiLocale): void {
  record.card.dataset.openreadPinned = String(pinned)
  record.pinButton.dataset.openreadActive = String(pinned)
  record.pinButton.setAttribute("aria-pressed", String(pinned))
  record.pinButton.title = pinned ? "Unpin translation" : "Pin translation"
  record.pinButton.setAttribute("aria-label", record.pinButton.title)
  renderSelectionTip(record.tip, pinned, locale)
}

function renderLanguagePair(
  languagePair: HTMLElement,
  sourceLanguage: string,
  targetLanguage: string,
  locale: UiLocale,
): void {
  languagePair.replaceChildren(
    createLanguagePill(displayLanguageName(sourceLanguage, locale), "source"),
    createArrowSvg(),
    createLanguagePill(displayLanguageName(targetLanguage, locale), "target"),
  )
}

function renderSelectionTip(tip: HTMLElement, pinned: boolean, locale: UiLocale): void {
  if (locale === "zh-CN" || locale === "zh-TW") {
    tip.textContent = pinned
      ? "已固定：选中其他文字会自动在这里继续翻译。拖动顶部可调整位置。"
      : "点击页面其他位置会关闭；点击图钉后，选中其他文字会继续翻译。"
    return
  }

  tip.textContent = pinned
    ? "Pinned: select other text to translate it here. Drag the top bar to move."
    : "Click the page to close. Pin this card to keep translating new selections here."
}

function renderSelectionCardTranslation(body: HTMLElement, response: TranslateFragmentResponse): void {
  const sanitized = response.translatedHtml ? sanitizeRichHtml(response.translatedHtml) : ""
  const text = sanitized ? htmlToText(sanitized) : response.translatedText?.trim()

  if (sanitized && text) {
    body.innerHTML = sanitized
    return
  }

  body.textContent = text || ""
}

function renderSelectionCardError(
  body: HTMLElement,
  message: string,
  onRetry: () => void,
  locale: UiLocale,
): void {
  body.textContent = t(locale, "translationFailed", { message })

  const retryButton = document.createElement("button")
  retryButton.type = "button"
  retryButton.className = `${OPENREAD_SELECTION_CARD_CLASS}__retry-button`
  retryButton.textContent = t(locale, "retry")
  retryButton.addEventListener("click", event => {
    event.stopPropagation()
    onRetry()
  })
  body.appendChild(retryButton)
}

function readConfigWithRuntime(): Promise<UserConfig> {
  return sendRuntimeMessage("GET_CONFIG")
}

function readSelectionSnapshot(): SelectionSnapshot | null {
  const selection = window.getSelection()
  if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
    return null
  }

  const text = selection.toString().trim()
  if (!text) {
    return null
  }

  const range = selection.getRangeAt(0)
  if (isRangeInsideOpenReadCard(range)) {
    return null
  }

  const rect = rectFromRange(range)
  return rect ? { rect, text } : null
}

function rectFromRange(range: Range): SelectionRect | null {
  const rects = [...range.getClientRects()]
    .map(domRectToSelectionRect)
    .filter(rect => rect.width > 0 || rect.height > 0)

  if (rects.length > 0) {
    return unionRects(rects)
  }

  const boundingRect = domRectToSelectionRect(range.getBoundingClientRect())
  return boundingRect.width > 0 || boundingRect.height > 0 ? boundingRect : null
}

function isRangeInsideOpenReadCard(range: Range): boolean {
  const container = range.commonAncestorContainer
  const element = container.nodeType === Node.ELEMENT_NODE
    ? container as Element
    : container.parentElement
  return Boolean(element?.closest(`.${OPENREAD_SELECTION_CARD_CLASS}`))
}

function measureCard(card: HTMLElement): CardSize {
  const rect = card.getBoundingClientRect()
  return {
    height: rect.height || FALLBACK_CARD_HEIGHT,
    width: rect.width || FALLBACK_CARD_WIDTH,
  }
}

function unionRects(rects: SelectionRect[]): SelectionRect {
  const left = Math.min(...rects.map(rect => rect.left))
  const top = Math.min(...rects.map(rect => rect.top))
  const right = Math.max(...rects.map(rect => rect.right))
  const bottom = Math.max(...rects.map(rect => rect.bottom))

  return {
    bottom,
    height: bottom - top,
    left,
    right,
    top,
    width: right - left,
  }
}

function domRectToSelectionRect(rect: DOMRect): SelectionRect {
  return {
    bottom: rect.bottom,
    height: rect.height,
    left: rect.left,
    right: rect.right,
    top: rect.top,
    width: rect.width,
  }
}

function selectionTextMatches(a: string, b: string): boolean {
  return normalizeSelectionText(a) === normalizeSelectionText(b)
}

function normalizeSelectionText(text: string): string {
  return text.replace(/\s+/g, " ").trim()
}

function plainTextToHtml(text: string): string {
  const container = document.createElement("div")
  const lines = text.split(/\r?\n/)

  lines.forEach((line, index) => {
    if (index > 0) {
      container.appendChild(document.createElement("br"))
    }
    container.appendChild(document.createTextNode(line))
  })

  return container.innerHTML
}

function createLanguagePill(text: string, role: "source" | "target"): HTMLElement {
  const span = document.createElement("span")
  span.className = `${OPENREAD_SELECTION_CARD_CLASS}__language`
  span.dataset.openreadLanguageRole = role
  span.textContent = text
  return span
}

function createArrowSvg(): SVGSVGElement {
  const svg = createStrokeSvg("0 0 42 16")
  svg.classList.add(`${OPENREAD_SELECTION_CARD_CLASS}__arrow`)

  const line = document.createElementNS("http://www.w3.org/2000/svg", "path")
  line.setAttribute("d", "M4 8h28")
  const chevron = document.createElementNS("http://www.w3.org/2000/svg", "path")
  chevron.setAttribute("d", "M27 3l6 5-6 5")
  svg.append(line, chevron)
  return svg
}

function createIconButton(label: string, icon: SVGSVGElement): HTMLButtonElement {
  const button = document.createElement("button")
  button.type = "button"
  button.className = `${OPENREAD_SELECTION_CARD_CLASS}__icon-button`
  button.title = label
  button.setAttribute("aria-label", label)
  button.appendChild(icon)
  return button
}

function createPinSvg(): SVGSVGElement {
  const svg = createStrokeSvg("0 0 24 24")
  const head = document.createElementNS("http://www.w3.org/2000/svg", "path")
  head.setAttribute("d", "M15.8 3.8l4.4 4.4-2.6 2.6 1.4 1.4-2.8 2.8-7.2-7.2 2.8-2.8 1.4 1.4 2.6-2.6z")
  const needle = document.createElementNS("http://www.w3.org/2000/svg", "path")
  needle.setAttribute("d", "M10.2 13.8L4.8 19.2")
  svg.append(head, needle)
  return svg
}

function createCloseSvg(): SVGSVGElement {
  const svg = createStrokeSvg("0 0 20 20")
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path")
  path.setAttribute("d", "M5.3 5.3l9.4 9.4M14.7 5.3l-9.4 9.4")
  svg.appendChild(path)
  return svg
}

function createStrokeSvg(viewBox: string): SVGSVGElement {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg")
  svg.setAttribute("viewBox", viewBox)
  svg.setAttribute("aria-hidden", "true")
  svg.setAttribute("focusable", "false")
  svg.setAttribute("fill", "none")
  svg.setAttribute("stroke", "currentColor")
  svg.setAttribute("stroke-linecap", "round")
  svg.setAttribute("stroke-linejoin", "round")
  svg.setAttribute("stroke-width", "2")
  return svg
}

function installDragHandlers(
  handle: HTMLElement,
  card: HTMLElement,
  onDrag: (position: { left: number; top: number }) => void,
): void {
  handle.addEventListener("pointerdown", event => {
    const target = event.target
    if (target instanceof Element && target.closest(`.${OPENREAD_SELECTION_CARD_CLASS}__icon-button`)) {
      return
    }

    event.preventDefault()
    event.stopPropagation()

    const startRect = card.getBoundingClientRect()
    const offsetX = event.clientX - startRect.left
    const offsetY = event.clientY - startRect.top
    card.dataset.openreadDragging = "true"

    const moveCard = (moveEvent: PointerEvent) => {
      const nextPosition = clampCardPosition(
        { left: moveEvent.clientX - offsetX, top: moveEvent.clientY - offsetY },
        measureCard(card),
        { height: window.innerHeight, width: window.innerWidth },
      )
      card.style.left = `${nextPosition.left}px`
      card.style.top = `${nextPosition.top}px`
      onDrag(nextPosition)
    }

    const stopDragging = () => {
      delete card.dataset.openreadDragging
      window.removeEventListener("pointermove", moveCard, true)
      window.removeEventListener("pointerup", stopDragging, true)
      window.removeEventListener("pointercancel", stopDragging, true)
    }

    window.addEventListener("pointermove", moveCard, true)
    window.addEventListener("pointerup", stopDragging, true)
    window.addEventListener("pointercancel", stopDragging, true)
  })
}

function clampCardPosition(
  position: { left: number; top: number },
  cardSize: CardSize,
  viewport: ViewportSize,
): { left: number; top: number } {
  const width = Math.min(cardSize.width || FALLBACK_CARD_WIDTH, Math.max(viewport.width - (VIEWPORT_MARGIN * 2), 0))
  const height = Math.min(cardSize.height || FALLBACK_CARD_HEIGHT, Math.max(viewport.height - (VIEWPORT_MARGIN * 2), 0))

  return {
    left: clamp(position.left, VIEWPORT_MARGIN, Math.max(viewport.width - width - VIEWPORT_MARGIN, VIEWPORT_MARGIN)),
    top: clamp(position.top, VIEWPORT_MARGIN, Math.max(viewport.height - height - VIEWPORT_MARGIN, VIEWPORT_MARGIN)),
  }
}

function countMatches(text: string, pattern: RegExp): number {
  return [...text.matchAll(pattern)].length
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

const CHINESE_LANGUAGE_NAMES: Record<string, string> = {
  auto: "自动检测",
  chinese: "中文",
  "simplified chinese": "中文",
  "traditional chinese": "繁体中文",
  zh: "中文",
  "zh-cn": "中文",
  "zh-tw": "繁体中文",
  english: "英语",
  en: "英语",
  japanese: "日语",
  ja: "日语",
  korean: "韩语",
  ko: "韩语",
  russian: "俄语",
  ru: "俄语",
  spanish: "西班牙语",
  es: "西班牙语",
  french: "法语",
  fr: "法语",
  german: "德语",
  de: "德语",
  vietnamese: "越南语",
  vi: "越南语",
}

const ENGLISH_LANGUAGE_NAMES: Record<string, string> = {
  auto: "Auto",
  chinese: "Chinese",
  "simplified chinese": "Simplified Chinese",
  "traditional chinese": "Traditional Chinese",
  zh: "Chinese",
  "zh-cn": "Simplified Chinese",
  "zh-tw": "Traditional Chinese",
  english: "English",
  en: "English",
  japanese: "Japanese",
  ja: "Japanese",
  korean: "Korean",
  ko: "Korean",
  russian: "Russian",
  ru: "Russian",
  spanish: "Spanish",
  es: "Spanish",
  french: "French",
  fr: "French",
  german: "German",
  de: "German",
  vietnamese: "Vietnamese",
  vi: "Vietnamese",
}
