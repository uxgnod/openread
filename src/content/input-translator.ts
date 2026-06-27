import { t, type UiLocale } from "@/shared/i18n"
import { sendRuntimeMessage } from "@/shared/messages"
import { sanitizeRichHtml } from "@/shared/sanitize"
import type { ProgressPosition, TranslateFragmentResponse } from "@/shared/types"
import {
  injectBaseStyles,
  removeInputStatus,
  renderInputStatus,
} from "./translation-renderer"

const TRIGGER_SPACE_COUNT = 3
const TRIGGER_WINDOW_MS = 1_200
const TEXT_INPUT_TYPES = new Set(["text", "search", "url", "tel"])
export const DEFAULT_INPUT_TRANSLATION_TARGET_LANGUAGE = "English"

type EditableTextControl = HTMLInputElement | HTMLTextAreaElement
type TranslateInputText = (sourceText: string, providerId: string | undefined) => Promise<string>

interface InputUndoRecord {
  control: EditableTextControl
  id: string
  sourceText: string
  translatedText: string
}

export class InputTranslator {
  private installed = false
  private inputTranslationEnabled = true
  private progressPosition: ProgressPosition = "bottom-center"
  private providerId: string | undefined
  private uiLocale: UiLocale = "en"
  private triggerTarget: EditableTextControl | null = null
  private spaceCount = 0
  private lastSpaceAt = 0
  private readonly activeTranslations = new WeakMap<EditableTextControl, number>()
  private lastUndoRecord: InputUndoRecord | null = null
  private translationToken = 0

  constructor(private readonly translateText: TranslateInputText = translatePlainTextWithRuntime) {}

  start(): void {
    if (this.installed) {
      return
    }

    document.addEventListener("keydown", this.handleKeyDown, true)
    document.addEventListener("blur", this.handleBlur, true)
    this.installed = true
  }

  stop(): void {
    if (!this.installed) {
      return
    }

    document.removeEventListener("keydown", this.handleKeyDown, true)
    document.removeEventListener("blur", this.handleBlur, true)
    this.resetTrigger()
    this.installed = false
  }

  setPageProvider(
    providerId: string | undefined,
    uiLocale: UiLocale,
    inputTranslationEnabled = this.inputTranslationEnabled,
    progressPosition: ProgressPosition = this.progressPosition,
  ): void {
    this.providerId = providerId
    this.uiLocale = uiLocale
    this.inputTranslationEnabled = inputTranslationEnabled
    this.progressPosition = progressPosition
    if (!inputTranslationEnabled) {
      this.resetTrigger()
      this.lastUndoRecord = null
      removeInputStatus()
    }
  }

  private readonly handleKeyDown = (event: KeyboardEvent): void => {
    if (!this.inputTranslationEnabled) {
      this.resetTrigger()
      return
    }

    const target = event.target
    if (!isEditableTextControl(target)) {
      this.resetTrigger()
      return
    }

    if (event.defaultPrevented || event.isComposing || event.ctrlKey || event.metaKey || event.altKey) {
      this.resetTrigger()
      return
    }

    if (!isSpaceKey(event)) {
      this.resetTrigger()
      return
    }

    const now = Date.now()
    if (this.triggerTarget !== target || now - this.lastSpaceAt > TRIGGER_WINDOW_MS) {
      this.spaceCount = 0
      this.triggerTarget = target
    }

    this.spaceCount += 1
    this.lastSpaceAt = now

    if (this.spaceCount < TRIGGER_SPACE_COUNT) {
      return
    }

    event.preventDefault()
    event.stopPropagation()
    this.resetTrigger()

    const sourceText = removeTriggerSpaces(target)
    if (!sourceText.trim()) {
      return
    }

    void this.translateControl(target, sourceText)
  }

  private readonly handleBlur = (): void => {
    this.resetTrigger()
  }

  private async translateControl(control: EditableTextControl, sourceText: string): Promise<void> {
    const token = this.translationToken + 1
    this.translationToken = token
    this.activeTranslations.set(control, token)
    this.lastUndoRecord = null
    control.dataset.openreadInputState = "loading"
    control.setAttribute("aria-busy", "true")
    injectBaseStyles()
    renderInputStatus({
      progressPosition: this.progressPosition,
      status: "loading",
      uiLocale: this.uiLocale,
    })

    try {
      const translatedText = await this.translateText(sourceText, this.providerId)
      if (!isLatestControlTranslation(this.activeTranslations, control, token)) {
        return
      }
      if (!control.isConnected || getControlValue(control) !== sourceText) {
        return
      }

      setControlValue(control, translatedText)
      const undoId = crypto.randomUUID()
      control.dataset.openreadInputUndoId = undoId
      this.lastUndoRecord = {
        control,
        id: undoId,
        sourceText,
        translatedText,
      }

      renderInputStatus({
        onUndo: () => this.undoLastInputTranslation(undoId),
        progressPosition: this.progressPosition,
        status: "complete",
        uiLocale: this.uiLocale,
      })
    }
    catch (error) {
      if (!isLatestControlTranslation(this.activeTranslations, control, token)) {
        return
      }
      renderInputStatus(
        {
          message: t(this.uiLocale, "translationFailed", {
            message: error instanceof Error ? error.message : String(error),
          }),
          progressPosition: this.progressPosition,
          status: "error",
          uiLocale: this.uiLocale,
        },
      )
      window.setTimeout(removeInputStatus, 4_000)
    }
    finally {
      if (isLatestControlTranslation(this.activeTranslations, control, token)) {
        this.activeTranslations.delete(control)
        delete control.dataset.openreadInputState
        control.removeAttribute("aria-busy")
      }
    }
  }

  private resetTrigger(): void {
    this.triggerTarget = null
    this.spaceCount = 0
    this.lastSpaceAt = 0
  }

  private undoLastInputTranslation(undoId: string): void {
    const record = this.lastUndoRecord
    if (!record || record.id !== undoId) {
      removeInputStatus()
      return
    }

    const control = resolveUndoControl(record)
    if (control) {
      setControlValue(control, record.sourceText)
      control.focus()
      delete control.dataset.openreadInputUndoId
    }

    this.lastUndoRecord = null
    removeInputStatus()
  }
}

export async function translatePlainTextWithRuntime(
  sourceText: string,
  providerId: string | undefined,
): Promise<string> {
  const config = await sendRuntimeMessage("GET_CONFIG")
  if (!config.inputTranslationEnabled) {
    throw new Error("Input translation is disabled.")
  }

  const selectedProviderId = providerId ?? config.activeProviderId ?? config.providers[0]?.id
  if (!selectedProviderId) {
    throw new Error("Provider is not configured.")
  }

  const response = await sendRuntimeMessage("TRANSLATE_FRAGMENT", {
    id: crypto.randomUUID(),
    providerId: selectedProviderId,
    sourceHtml: plainTextToHtml(sourceText),
    sourceText,
    targetLanguage: DEFAULT_INPUT_TRANSLATION_TARGET_LANGUAGE,
  })

  const translated = plainTextFromTranslationResponse(response)
  if (!translated) {
    throw new Error("Provider returned an empty translation.")
  }

  return translated
}

export function isEditableTextControl(value: EventTarget | null): value is EditableTextControl {
  if (value instanceof HTMLTextAreaElement) {
    return !value.disabled && !value.readOnly
  }

  if (!(value instanceof HTMLInputElement)) {
    return false
  }

  return !value.disabled && !value.readOnly && TEXT_INPUT_TYPES.has(value.type)
}

export function plainTextToHtml(text: string): string {
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

export function plainTextFromTranslationResponse(response: TranslateFragmentResponse): string {
  if (response.translatedText?.trim()) {
    return response.translatedText.trim()
  }

  if (!response.translatedHtml?.trim()) {
    return ""
  }

  return plainTextFromHtml(response.translatedHtml)
}

function isSpaceKey(event: KeyboardEvent): boolean {
  return event.key === " " || event.key === "Spacebar" || event.code === "Space"
}

function removeTriggerSpaces(control: EditableTextControl): string {
  const value = getControlValue(control)
  const selectionStart = control.selectionStart ?? value.length
  const selectionEnd = control.selectionEnd ?? selectionStart

  if (
    selectionStart === selectionEnd
    && selectionStart >= TRIGGER_SPACE_COUNT - 1
    && value.slice(selectionStart - (TRIGGER_SPACE_COUNT - 1), selectionStart) === " ".repeat(TRIGGER_SPACE_COUNT - 1)
  ) {
    const nextValue = [
      value.slice(0, selectionStart - (TRIGGER_SPACE_COUNT - 1)),
      value.slice(selectionEnd),
    ].join("")
    const nextSelection = selectionStart - (TRIGGER_SPACE_COUNT - 1)
    setControlValue(control, nextValue, nextSelection)
    return nextValue
  }

  return value
}

function getControlValue(control: EditableTextControl): string {
  return control.value
}

function setControlValue(control: EditableTextControl, value: string, selectionStart = value.length): void {
  const prototype = control instanceof HTMLTextAreaElement
    ? HTMLTextAreaElement.prototype
    : HTMLInputElement.prototype
  const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set

  if (setter) {
    setter.call(control, value)
  }
  else {
    control.value = value
  }

  try {
    control.setSelectionRange(selectionStart, selectionStart)
  }
  catch {
    // Some input types do not support selection APIs. They are already filtered out,
    // but keeping this defensive makes host-page quirks less risky.
  }

  control.dispatchEvent(new Event("input", { bubbles: true }))
}

function plainTextFromHtml(html: string): string {
  const template = document.createElement("template")
  template.innerHTML = sanitizeRichHtml(html)

  for (const br of [...template.content.querySelectorAll("br")]) {
    br.replaceWith(document.createTextNode("\n"))
  }

  return template.content.textContent?.trim() ?? ""
}

function isLatestControlTranslation(
  activeTranslations: WeakMap<EditableTextControl, number>,
  control: EditableTextControl,
  token: number,
): boolean {
  return activeTranslations.get(control) === token
}

function resolveUndoControl(record: InputUndoRecord): EditableTextControl | null {
  if (record.control.isConnected) {
    return record.control
  }

  const selector = `[data-openread-input-undo-id="${CSS.escape(record.id)}"]`
  const matchingControl = document.querySelector(selector)
  if (isEditableTextControl(matchingControl)) {
    return matchingControl
  }

  return null
}
