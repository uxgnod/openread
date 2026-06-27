import {
  OPENREAD_ERROR_CLASS,
  OPENREAD_INPUT_STATUS_CLASS,
  OPENREAD_LOADING_CLASS,
  OPENREAD_PROGRESS_CLASS,
  OPENREAD_SOURCE_CLASS,
  OPENREAD_WRAPPER_CLASS,
} from "@/shared/dom-rules"
import { t, type UiLocale } from "@/shared/i18n"
import { htmlToText, sanitizeRichHtml } from "@/shared/sanitize"
import { TRANSLATION_DISPLAY_MODES, type ProgressPosition, type TranslationDisplayMode } from "@/shared/types"
import type { InlineCodeHint, InlineCodeStyleHint } from "./rich-fragment"

const COPIED_STYLE_PROPERTIES = [
  "fontFamily",
  "fontSize",
  "fontWeight",
  "fontStyle",
  "lineHeight",
  "letterSpacing",
  "color",
  "textAlign",
  "direction",
  "wordBreak",
  "overflowWrap",
] as const

interface TranslationProgress {
  isActive: boolean
  pendingCount: number
  displayMode: TranslationDisplayMode
  onDisplayModeChange: (mode: TranslationDisplayMode) => void
  progressPosition: ProgressPosition
  remainingCount: number
  totalCount: number
  translatedCount: number
  uiLocale: UiLocale
}

interface InputTranslationStatus {
  message?: string
  onUndo?: () => void
  progressPosition: ProgressPosition
  status: "loading" | "complete" | "error"
  uiLocale: UiLocale
}

export function injectBaseStyles(): void {
  if (document.getElementById("openread-style")) {
    return
  }

  const style = document.createElement("style")
  style.id = "openread-style"
  style.textContent = `
    .${OPENREAD_WRAPPER_CLASS} {
      box-sizing: border-box;
      opacity: 0.88;
    }

    .${OPENREAD_SOURCE_CLASS} {
      display: contents;
    }

    .${OPENREAD_WRAPPER_CLASS}[data-openread-placement="inline"] {
      margin-left: 0.35em;
    }

    .${OPENREAD_WRAPPER_CLASS}[data-openread-placement="inside-block"] {
      display: block;
      margin-top: var(--openread-pair-gap, 0.22em);
    }

    .${OPENREAD_WRAPPER_CLASS}[data-openread-placement="after-block"] {
      display: block;
      margin-top: var(--openread-pair-gap, 0.22em);
      margin-bottom: 0.75em;
    }

    .${OPENREAD_WRAPPER_CLASS} a {
      color: inherit;
      text-decoration: underline;
      text-underline-offset: 0.14em;
    }

    .${OPENREAD_LOADING_CLASS} {
      color: #667085;
      font-style: italic;
    }

    .${OPENREAD_ERROR_CLASS} {
      color: #b42318;
      border-left: 3px solid #f97066;
      padding-left: 0.65em;
    }

    .${OPENREAD_ERROR_CLASS} button {
      margin-left: 0.65em;
      border: 1px solid currentColor;
      border-radius: 6px;
      background: transparent;
      color: inherit;
      font: inherit;
      padding: 0.1em 0.45em;
      cursor: pointer;
    }

    :root[data-openread-display-mode="original"] .${OPENREAD_WRAPPER_CLASS} {
      display: none !important;
    }

    :root[data-openread-display-mode="translation"] .${OPENREAD_SOURCE_CLASS} {
      display: none !important;
    }

    :root[data-openread-display-mode="translation"] .${OPENREAD_WRAPPER_CLASS}[data-openread-placement="inline"] {
      margin-left: 0;
    }

    .${OPENREAD_PROGRESS_CLASS} {
      align-items: center;
      background: rgba(255, 255, 255, 0.94);
      border: 1px solid rgba(229, 231, 235, 0.92);
      border-radius: 999px;
      box-shadow: 0 12px 32px rgba(15, 23, 42, 0.1);
      color: #5b6472;
      display: flex;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      font-size: 16px;
      font-weight: 650;
      gap: 10px;
      line-height: 1.2;
      min-height: 44px;
      padding: 6px 8px 6px 16px;
      pointer-events: auto;
      position: fixed;
      white-space: nowrap;
      z-index: 2147483647;
    }

    .${OPENREAD_PROGRESS_CLASS}[data-openread-position="top-center"],
    .${OPENREAD_INPUT_STATUS_CLASS}[data-openread-position="top-center"] {
      left: 50%;
      top: max(16px, env(safe-area-inset-top));
      transform: translateX(-50%);
    }

    .${OPENREAD_PROGRESS_CLASS}[data-openread-position="bottom-center"],
    .${OPENREAD_INPUT_STATUS_CLASS}[data-openread-position="bottom-center"] {
      bottom: max(16px, env(safe-area-inset-bottom));
      left: 50%;
      transform: translateX(-50%);
    }

    .${OPENREAD_PROGRESS_CLASS}[data-openread-position="top-left"],
    .${OPENREAD_INPUT_STATUS_CLASS}[data-openread-position="top-left"] {
      left: max(16px, env(safe-area-inset-left));
      top: max(16px, env(safe-area-inset-top));
      transform: none;
    }

    .${OPENREAD_PROGRESS_CLASS}[data-openread-position="top-right"],
    .${OPENREAD_INPUT_STATUS_CLASS}[data-openread-position="top-right"] {
      right: max(16px, env(safe-area-inset-right));
      top: max(16px, env(safe-area-inset-top));
      transform: none;
    }

    .${OPENREAD_PROGRESS_CLASS}[data-openread-position="bottom-left"],
    .${OPENREAD_INPUT_STATUS_CLASS}[data-openread-position="bottom-left"] {
      bottom: max(16px, env(safe-area-inset-bottom));
      left: max(16px, env(safe-area-inset-left));
      transform: none;
    }

    .${OPENREAD_PROGRESS_CLASS}[data-openread-position="bottom-right"],
    .${OPENREAD_INPUT_STATUS_CLASS}[data-openread-position="bottom-right"] {
      bottom: max(16px, env(safe-area-inset-bottom));
      right: max(16px, env(safe-area-inset-right));
      transform: none;
    }

    .${OPENREAD_PROGRESS_CLASS}__status-icon {
      border: 3px solid #dbeafe;
      border-top-color: #93c5fd;
      border-radius: 999px;
      box-sizing: border-box;
      display: inline-block;
      flex: 0 0 auto;
      height: 22px;
      position: relative;
      transition:
        background-color 220ms ease,
        border-color 220ms ease,
        box-shadow 260ms ease,
        transform 260ms cubic-bezier(0.2, 0.8, 0.2, 1);
      width: 22px;
    }

    .${OPENREAD_PROGRESS_CLASS}[data-openread-complete="false"] .${OPENREAD_PROGRESS_CLASS}__status-icon {
      animation: openread-progress-spin 0.9s linear infinite;
    }

    .${OPENREAD_PROGRESS_CLASS}[data-openread-complete="true"] .${OPENREAD_PROGRESS_CLASS}__status-icon {
      animation: none;
      background: #34c759;
      border-color: #34c759;
      box-shadow: 0 0 0 4px rgba(52, 199, 89, 0.14);
      animation: openread-progress-complete 520ms cubic-bezier(0.2, 0.8, 0.2, 1);
    }

    .${OPENREAD_PROGRESS_CLASS}[data-openread-complete="true"] .${OPENREAD_PROGRESS_CLASS}__status-icon::after {
      content: none;
    }

    .${OPENREAD_PROGRESS_CLASS}__status-icon svg,
    .${OPENREAD_INPUT_STATUS_CLASS}__status-icon svg {
      display: block;
      height: 100%;
      inset: 0;
      overflow: visible;
      position: absolute;
      width: 100%;
    }

    .${OPENREAD_PROGRESS_CLASS}__check-path,
    .${OPENREAD_INPUT_STATUS_CLASS}__check-path {
      animation: openread-check-draw 360ms 140ms cubic-bezier(0.2, 0.8, 0.2, 1) forwards;
      fill: none;
      stroke: #ffffff;
      stroke-dasharray: 18;
      stroke-dashoffset: 18;
      stroke-linecap: round;
      stroke-linejoin: round;
      stroke-width: 2.6;
    }

    .${OPENREAD_PROGRESS_CLASS}__status {
      align-items: center;
      display: flex;
      gap: 8px;
      min-width: 70px;
      transition:
        gap 260ms ease,
        min-width 320ms cubic-bezier(0.2, 0.8, 0.2, 1);
    }

    .${OPENREAD_PROGRESS_CLASS}[data-openread-complete="true"] .${OPENREAD_PROGRESS_CLASS}__status {
      gap: 0;
      min-width: 22px;
    }

    .${OPENREAD_PROGRESS_CLASS}__label {
      display: inline-block;
      font-variant-numeric: tabular-nums;
      max-width: 4em;
      opacity: 1;
      overflow: hidden;
      text-align: center;
      transform: translateX(0) scale(1);
      transition:
        max-width 320ms cubic-bezier(0.2, 0.8, 0.2, 1),
        opacity 200ms ease,
        transform 260ms cubic-bezier(0.2, 0.8, 0.2, 1);
    }

    .${OPENREAD_PROGRESS_CLASS}[data-openread-complete="true"] .${OPENREAD_PROGRESS_CLASS}__label {
      max-width: 0;
      opacity: 0;
      transform: translateX(-8px) scale(0.78);
    }

    .${OPENREAD_PROGRESS_CLASS}__divider {
      background: #e5e7eb;
      height: 24px;
      width: 1px;
    }

    .${OPENREAD_PROGRESS_CLASS}__mode-switch {
      align-items: center;
      background: #f2f4f7;
      border: 1px solid #e5e7eb;
      border-radius: 999px;
      display: flex;
      gap: 2px;
      padding: 2px;
    }

    .${OPENREAD_PROGRESS_CLASS}__mode-button {
      background: transparent;
      border: 0;
      border-radius: 999px;
      color: #667085;
      cursor: pointer;
      font: inherit;
      font-size: 12px;
      font-weight: 650;
      line-height: 1.2;
      min-width: 44px;
      padding: 6px 9px;
    }

    .${OPENREAD_PROGRESS_CLASS}__mode-button[data-openread-active="true"] {
      background: #ffffff;
      box-shadow: 0 1px 3px rgba(15, 23, 42, 0.12);
      color: #111827;
    }

    .${OPENREAD_INPUT_STATUS_CLASS} {
      align-items: center;
      background: rgba(255, 255, 255, 0.96);
      border: 1px solid rgba(229, 231, 235, 0.92);
      border-radius: 999px;
      box-shadow: 0 12px 32px rgba(15, 23, 42, 0.12);
      color: #5b6472;
      display: flex;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      font-size: 15px;
      font-weight: 650;
      gap: 10px;
      line-height: 1.2;
      max-width: min(520px, calc(100vw - 32px));
      min-height: 44px;
      padding: 7px 9px 7px 15px;
      pointer-events: auto;
      position: fixed;
      white-space: nowrap;
      z-index: 2147483647;
    }

    .${OPENREAD_INPUT_STATUS_CLASS}__status-icon {
      border: 3px solid #dbeafe;
      border-top-color: #93c5fd;
      border-radius: 999px;
      box-sizing: border-box;
      display: inline-block;
      flex: 0 0 auto;
      height: 22px;
      position: relative;
      transition:
        background-color 220ms ease,
        border-color 220ms ease,
        box-shadow 260ms ease,
        transform 260ms cubic-bezier(0.2, 0.8, 0.2, 1);
      width: 22px;
    }

    .${OPENREAD_INPUT_STATUS_CLASS}[data-openread-status="loading"] .${OPENREAD_INPUT_STATUS_CLASS}__status-icon {
      animation: openread-progress-spin 0.9s linear infinite;
    }

    .${OPENREAD_INPUT_STATUS_CLASS}[data-openread-status="complete"] .${OPENREAD_INPUT_STATUS_CLASS}__status-icon {
      animation: openread-progress-complete 520ms cubic-bezier(0.2, 0.8, 0.2, 1);
      background: #34c759;
      border-color: #34c759;
      box-shadow: 0 0 0 4px rgba(52, 199, 89, 0.14);
    }

    .${OPENREAD_INPUT_STATUS_CLASS}[data-openread-status="complete"] .${OPENREAD_INPUT_STATUS_CLASS}__status-icon::after {
      content: none;
    }

    .${OPENREAD_INPUT_STATUS_CLASS}[data-openread-status="error"] {
      background: #fef3f2;
      border-color: #fecdca;
      color: #b42318;
    }

    .${OPENREAD_INPUT_STATUS_CLASS}[data-openread-status="error"] .${OPENREAD_INPUT_STATUS_CLASS}__status-icon {
      border-color: #f97066;
    }

    .${OPENREAD_INPUT_STATUS_CLASS}__label {
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .${OPENREAD_INPUT_STATUS_CLASS}__undo-button {
      background: #111827;
      border: 0;
      border-radius: 999px;
      color: #ffffff;
      cursor: pointer;
      flex: 0 0 auto;
      font: inherit;
      font-size: 12px;
      font-weight: 650;
      line-height: 1.2;
      padding: 7px 11px;
    }

    @keyframes openread-progress-spin {
      to {
        transform: rotate(360deg);
      }
    }

    @keyframes openread-progress-complete {
      0% {
        transform: scale(0.78);
        box-shadow: 0 0 0 0 rgba(52, 199, 89, 0);
      }

      55% {
        transform: scale(1.18);
        box-shadow: 0 0 0 7px rgba(52, 199, 89, 0.16);
      }

      100% {
        transform: scale(1);
        box-shadow: 0 0 0 4px rgba(52, 199, 89, 0.14);
      }
    }

    @keyframes openread-check-draw {
      to {
        stroke-dashoffset: 0;
      }
    }
  `
  document.documentElement.appendChild(style)
}

export function createLoadingWrapper(target: HTMLElement, locale: UiLocale = "en"): HTMLElement {
  const placement = getTranslationPlacement(target)
  ensureSourceWrapper(target)
  const wrapper = document.createElement(getWrapperTag(target, placement))
  wrapper.className = `${OPENREAD_WRAPPER_CLASS} ${OPENREAD_LOADING_CLASS} notranslate`
  wrapper.dataset.openreadState = "loading"
  wrapper.dataset.openreadPlacement = placement
  wrapper.textContent = placement === "inline" ? "" : t(locale, "translating")
  copyReadableStyle(target, wrapper)

  if (placement === "inline" || placement === "inside-block") {
    target.appendChild(wrapper)
  }
  else {
    target.insertAdjacentElement("afterend", wrapper)
  }

  return wrapper
}

export function renderTranslation(
  wrapper: HTMLElement,
  translatedHtml: string | undefined,
  translatedText: string | undefined,
  sourceHtml?: string,
  inlineCodeHints: InlineCodeHint[] = [],
): void {
  const sanitized = translatedHtml
    ? repairTranslatedHtml(sanitizeRichHtml(translatedHtml), sourceHtml, inlineCodeHints)
    : ""
  const text = sanitized ? htmlToText(sanitized) : translatedText?.trim()

  wrapper.classList.remove(OPENREAD_LOADING_CLASS, OPENREAD_ERROR_CLASS)
  wrapper.dataset.openreadState = "translated"

  if (sanitized && text) {
    wrapper.innerHTML = sanitized
    return
  }

  wrapper.textContent = text || ""
}

function repairTranslatedHtml(
  translatedHtml: string,
  sourceHtml: string | undefined,
  inlineCodeHints: InlineCodeHint[],
): string {
  const withLinks = repairDroppedSourceLinks(translatedHtml, sourceHtml)
  return repairInlineCode(withLinks, inlineCodeHints)
}

export function renderError(
  wrapper: HTMLElement,
  message: string,
  onRetry: () => void,
  locale: UiLocale = "en",
): void {
  wrapper.classList.remove(OPENREAD_LOADING_CLASS)
  wrapper.classList.add(OPENREAD_ERROR_CLASS)
  wrapper.dataset.openreadState = "error"
  wrapper.textContent = t(locale, "translationFailed", { message })

  const button = document.createElement("button")
  button.type = "button"
  button.textContent = t(locale, "retry")
  button.addEventListener("click", () => onRetry())
  wrapper.appendChild(button)
}

export function removeAllWrappers(): void {
  document.querySelectorAll(`.${OPENREAD_WRAPPER_CLASS}`).forEach(node => node.remove())
  unwrapAllSourceWrappers()
  clearTranslationDisplayMode()
}

export function renderTranslationProgress(progress: TranslationProgress): void {
  if (!progress.isActive) {
    removeTranslationProgress()
    return
  }

  const completedCount = Math.min(Math.max(progress.translatedCount, 0), progress.totalCount)
  const progressPercent = progress.totalCount > 0
    ? Math.min(100, Math.round((completedCount / progress.totalCount) * 100))
    : 0
  const isComplete = progress.totalCount > 0 && completedCount >= progress.totalCount
  const chip = getOrCreateProgressChip()
  chip.dataset.openreadComplete = String(isComplete)
  chip.dataset.openreadProgressPercent = String(progressPercent)
  chip.dataset.openreadPosition = progress.progressPosition
  chip.dataset.openreadDisplayMode = progress.displayMode
  chip.setAttribute(
    "aria-label",
    t(progress.uiLocale, "progressAria", { translated: progress.translatedCount, total: progress.totalCount }),
  )

  const statusIcon = document.createElement("span")
  statusIcon.className = `${OPENREAD_PROGRESS_CLASS}__status-icon`
  statusIcon.setAttribute("aria-hidden", "true")
  if (isComplete) {
    statusIcon.appendChild(createCheckSvg(`${OPENREAD_PROGRESS_CLASS}__check-path`))
  }

  const label = document.createElement("span")
  label.className = `${OPENREAD_PROGRESS_CLASS}__label`
  label.setAttribute("aria-live", "polite")
  label.textContent = t(progress.uiLocale, "progressLabel", {
    percent: progressPercent,
  })

  const status = document.createElement("span")
  status.className = `${OPENREAD_PROGRESS_CLASS}__status`
  status.append(statusIcon, label)

  const divider = document.createElement("span")
  divider.className = `${OPENREAD_PROGRESS_CLASS}__divider`
  divider.setAttribute("aria-hidden", "true")

  chip.replaceChildren(
    status,
    divider,
    createDisplayModeSwitch(progress.uiLocale, progress.displayMode, progress.onDisplayModeChange),
  )
}

export function removeTranslationProgress(): void {
  document.querySelector(`.${OPENREAD_PROGRESS_CLASS}`)?.remove()
}

export function renderInputStatus(status: InputTranslationStatus): HTMLElement {
  const chip = getOrCreateInputStatus()
  chip.dataset.openreadPosition = status.progressPosition
  chip.dataset.openreadStatus = status.status
  chip.setAttribute("aria-live", "polite")

  const icon = document.createElement("span")
  icon.className = `${OPENREAD_INPUT_STATUS_CLASS}__status-icon`
  icon.setAttribute("aria-hidden", "true")
  if (status.status === "complete") {
    icon.appendChild(createCheckSvg(`${OPENREAD_INPUT_STATUS_CLASS}__check-path`))
  }

  const label = document.createElement("span")
  label.className = `${OPENREAD_INPUT_STATUS_CLASS}__label`
  label.textContent = inputStatusLabel(status)

  chip.replaceChildren(icon, label)

  if (status.status === "complete" && status.onUndo) {
    const undoButton = document.createElement("button")
    undoButton.type = "button"
    undoButton.className = `${OPENREAD_INPUT_STATUS_CLASS}__undo-button`
    undoButton.textContent = t(status.uiLocale, "undoInputTranslation")
    undoButton.addEventListener("click", event => {
      event.stopPropagation()
      status.onUndo?.()
    })
    chip.appendChild(undoButton)
  }

  return chip
}

export function removeInputStatus(): void {
  document.querySelector(`.${OPENREAD_INPUT_STATUS_CLASS}`)?.remove()
}

export function applyTranslationDisplayMode(mode: TranslationDisplayMode): void {
  document.documentElement.dataset.openreadDisplayMode = mode
}

export function clearTranslationDisplayMode(): void {
  delete document.documentElement.dataset.openreadDisplayMode
}

function copyReadableStyle(source: HTMLElement, target: HTMLElement): void {
  if (target.dataset.openreadPlacement === "inline") {
    return
  }

  const style = window.getComputedStyle(source)
  for (const property of COPIED_STYLE_PROPERTIES) {
    target.style[property] = style[property]
  }

  const marginLeft = style.marginLeft
  const marginRight = style.marginRight
  if (marginLeft !== "0px") {
    target.style.marginLeft = marginLeft
  }
  if (marginRight !== "0px") {
    target.style.marginRight = marginRight
  }
}

function getOrCreateProgressChip(): HTMLElement {
  const existing = document.querySelector<HTMLElement>(`.${OPENREAD_PROGRESS_CLASS}`)
  if (existing) {
    return existing
  }

  const chip = document.createElement("div")
  chip.className = `${OPENREAD_PROGRESS_CLASS} notranslate`
  chip.dataset.openreadComplete = "false"
  chip.setAttribute("role", "group")
  document.documentElement.appendChild(chip)
  return chip
}

function getOrCreateInputStatus(): HTMLElement {
  const existing = document.querySelector<HTMLElement>(`.${OPENREAD_INPUT_STATUS_CLASS}`)
  if (existing) {
    return existing
  }

  const chip = document.createElement("div")
  chip.className = `${OPENREAD_INPUT_STATUS_CLASS} notranslate`
  chip.setAttribute("role", "group")
  document.documentElement.appendChild(chip)
  return chip
}

function createCheckSvg(pathClassName: string): SVGSVGElement {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg")
  svg.setAttribute("viewBox", "0 0 22 22")
  svg.setAttribute("focusable", "false")

  const path = document.createElementNS("http://www.w3.org/2000/svg", "path")
  path.setAttribute("class", pathClassName)
  path.setAttribute("d", "M6.2 11.2l3.2 3.2 6.6-7.1")
  svg.appendChild(path)

  return svg
}

function inputStatusLabel(status: InputTranslationStatus): string {
  if (status.message) {
    return status.message
  }

  switch (status.status) {
    case "loading":
      return t(status.uiLocale, "inputTranslating")
    case "complete":
      return t(status.uiLocale, "inputTranslationComplete")
    case "error":
      return t(status.uiLocale, "translationFailed", { message: "" }).trim()
  }
}

function getTranslationPlacement(target: HTMLElement): "inline" | "inside-block" | "after-block" {
  if (target.tagName === "A") {
    return "inline"
  }

  return canAppendTranslationInside(target) ? "inside-block" : "after-block"
}

function ensureSourceWrapper(target: HTMLElement): void {
  if ([...target.childNodes].some(node =>
    node instanceof HTMLElement && node.classList.contains(OPENREAD_SOURCE_CLASS),
  )) {
    return
  }

  const sourceWrapper = document.createElement("span")
  sourceWrapper.className = OPENREAD_SOURCE_CLASS
  sourceWrapper.dataset.openreadSource = "true"

  while (target.firstChild) {
    sourceWrapper.appendChild(target.firstChild)
  }

  target.appendChild(sourceWrapper)
}

function unwrapAllSourceWrappers(): void {
  for (const wrapper of [...document.querySelectorAll<HTMLElement>(`.${OPENREAD_SOURCE_CLASS}`)]) {
    const parent = wrapper.parentNode
    if (!parent) {
      wrapper.remove()
      continue
    }

    while (wrapper.firstChild) {
      parent.insertBefore(wrapper.firstChild, wrapper)
    }
    wrapper.remove()
  }
}

function createDisplayModeSwitch(
  locale: UiLocale,
  activeMode: TranslationDisplayMode,
  onDisplayModeChange: (mode: TranslationDisplayMode) => void,
): HTMLElement {
  const switcher = document.createElement("div")
  switcher.className = `${OPENREAD_PROGRESS_CLASS}__mode-switch`
  switcher.setAttribute("role", "radiogroup")
  switcher.setAttribute("aria-label", t(locale, "displayModeLabel"))

  for (const mode of TRANSLATION_DISPLAY_MODES) {
    const button = document.createElement("button")
    button.type = "button"
    button.className = `${OPENREAD_PROGRESS_CLASS}__mode-button`
    button.dataset.openreadMode = mode
    button.dataset.openreadActive = String(mode === activeMode)
    button.setAttribute("role", "radio")
    button.setAttribute("aria-checked", String(mode === activeMode))
    button.textContent = displayModeLabel(locale, mode)
    button.addEventListener("click", event => {
      event.stopPropagation()
      onDisplayModeChange(mode)
    })
    switcher.appendChild(button)
  }

  return switcher
}

function displayModeLabel(locale: UiLocale, mode: TranslationDisplayMode): string {
  switch (mode) {
    case "original":
      return t(locale, "displayModeOriginal")
    case "translation":
      return t(locale, "displayModeTranslation")
    case "bilingual":
      return t(locale, "displayModeBilingual")
  }
}

function getWrapperTag(target: HTMLElement, placement: "inline" | "inside-block" | "after-block"): string {
  if (placement === "inline" || placement === "inside-block") {
    return "span"
  }

  return "div"
}

function canAppendTranslationInside(target: HTMLElement): boolean {
  return ["P", "H1", "H2", "H3", "H4", "H5", "H6", "BLOCKQUOTE", "FIGCAPTION", "LI"].includes(target.tagName)
}

function repairDroppedSourceLinks(translatedHtml: string, sourceHtml: string | undefined): string {
  if (!translatedHtml || !sourceHtml) {
    return translatedHtml
  }

  const links = extractSourceLinks(sourceHtml)
  if (links.length === 0) {
    return translatedHtml
  }

  const template = document.createElement("template")
  template.innerHTML = translatedHtml

  for (const link of links) {
    if (hasEquivalentLink(template.content, link)) {
      continue
    }
    wrapFirstTextOccurrence(template.content, link.text, link.href)
  }

  return sanitizeRichHtml(template.innerHTML)
}

function repairInlineCode(translatedHtml: string, hints: InlineCodeHint[]): string {
  if (!translatedHtml || hints.length === 0) {
    return translatedHtml
  }

  const template = document.createElement("template")
  template.innerHTML = translatedHtml

  for (const hint of hints) {
    const existing = findUnstyledInlineCode(template.content, hint)
    const inlineCode = existing ?? wrapFirstInlineCodeOccurrence(template.content, hint)

    if (inlineCode) {
      inlineCode.dataset.openreadCodeStyleApplied = "true"
      applyInlineCodeStyle(inlineCode, hint.style)
    }
  }

  return sanitizeRichHtml(template.innerHTML)
}

function findUnstyledInlineCode(fragment: DocumentFragment, hint: InlineCodeHint): HTMLElement | null {
  return [...fragment.querySelectorAll<HTMLElement>(hint.tagName)].find(element =>
    !element.dataset.openreadCodeStyleApplied
    && element.textContent?.replace(/\s+/g, " ").trim() === hint.text,
  ) ?? null
}

function wrapFirstInlineCodeOccurrence(fragment: DocumentFragment, hint: InlineCodeHint): HTMLElement | null {
  const walker = document.createTreeWalker(fragment, NodeFilter.SHOW_TEXT)
  let node = walker.nextNode()

  while (node) {
    const textNode = node as Text
    const parent = textNode.parentElement
    const value = textNode.textContent ?? ""
    const index = value.indexOf(hint.text)

    if ((!parent || !parent.closest("code,kbd,samp,var")) && index >= 0) {
      const replacement = document.createDocumentFragment()
      const before = value.slice(0, index)
      const after = value.slice(index + hint.text.length)

      if (before) {
        replacement.append(before)
      }

      const inlineCode = document.createElement(hint.tagName)
      inlineCode.textContent = hint.text
      replacement.append(inlineCode)

      if (after) {
        replacement.append(after)
      }

      textNode.replaceWith(replacement)
      return inlineCode
    }

    node = walker.nextNode()
  }

  return null
}

function applyInlineCodeStyle(element: HTMLElement, style: InlineCodeStyleHint): void {
  element.style.backgroundColor = style.backgroundColor
  element.style.borderRadius = style.borderRadius
  element.style.color = style.color
  element.style.display = normalizeInlineCodeDisplay(style.display)
  element.style.fontFamily = style.fontFamily
  element.style.fontSize = style.fontSize
  element.style.fontWeight = style.fontWeight
  element.style.lineHeight = style.lineHeight
  element.style.padding = style.padding
}

function normalizeInlineCodeDisplay(display: string): string {
  return display === "inline-block" ? "inline-block" : "inline"
}

function extractSourceLinks(sourceHtml: string): Array<{ href: string; text: string }> {
  const template = document.createElement("template")
  template.innerHTML = sourceHtml
  const seen = new Set<string>()
  const links: Array<{ href: string; text: string }> = []

  for (const anchor of [...template.content.querySelectorAll("a[href]")]) {
    const href = anchor.getAttribute("href")?.trim()
    const text = anchor.textContent?.replace(/\s+/g, " ").trim()
    if (!href || !text) {
      continue
    }

    const key = `${href}\n${text}`
    if (seen.has(key)) {
      continue
    }
    seen.add(key)
    links.push({ href, text })
  }

  return links
}

function hasEquivalentLink(fragment: DocumentFragment, link: { href: string; text: string }): boolean {
  return [...fragment.querySelectorAll("a[href]")].some(anchor =>
    anchor.getAttribute("href") === link.href
    || anchor.textContent?.replace(/\s+/g, " ").trim() === link.text,
  )
}

function wrapFirstTextOccurrence(fragment: DocumentFragment, text: string, href: string): void {
  const walker = document.createTreeWalker(fragment, NodeFilter.SHOW_TEXT)
  let node = walker.nextNode()

  while (node) {
    const textNode = node as Text
    const parent = textNode.parentElement
    const value = textNode.textContent ?? ""
    const index = value.indexOf(text)

    if ((!parent || !parent.closest("a")) && index >= 0) {
      const replacement = document.createDocumentFragment()
      const before = value.slice(0, index)
      const after = value.slice(index + text.length)

      if (before) {
        replacement.append(before)
      }

      const anchor = document.createElement("a")
      anchor.setAttribute("href", href)
      anchor.textContent = text
      anchor.target = "_blank"
      anchor.rel = "noreferrer noopener"
      replacement.append(anchor)

      if (after) {
        replacement.append(after)
      }

      textNode.replaceWith(replacement)
      return
    }

    node = walker.nextNode()
  }
}
