import { afterEach, describe, expect, it, vi } from "vitest"
import { OPENREAD_INPUT_STATUS_CLASS } from "@/shared/dom-rules"
import { DEFAULT_USER_CONFIG } from "@/shared/types"
import {
  DEFAULT_INPUT_TRANSLATION_TARGET_LANGUAGE,
  InputTranslator,
  isEditableTextControl,
  plainTextFromTranslationResponse,
  plainTextToHtml,
  translatePlainTextWithRuntime,
} from "./input-translator"

describe("input translator", () => {
  afterEach(() => {
    document.body.innerHTML = ""
    document.querySelector(`.${OPENREAD_INPUT_STATUS_CLASS}`)?.remove()
    vi.unstubAllGlobals()
  })

  it("treats only editable text inputs and textareas as supported controls", () => {
    document.body.innerHTML = `
      <input id="text" type="text" />
      <input id="email" type="email" />
      <textarea id="textarea"></textarea>
      <textarea id="readonly" readonly></textarea>
    `

    expect(isEditableTextControl(document.getElementById("text"))).toBe(true)
    expect(isEditableTextControl(document.getElementById("textarea"))).toBe(true)
    expect(isEditableTextControl(document.getElementById("email"))).toBe(false)
    expect(isEditableTextControl(document.getElementById("readonly"))).toBe(false)
  })

  it("converts plain text to safe html and back to plain text", () => {
    expect(plainTextToHtml("Hello\nworld")).toBe("Hello<br>world")
    expect(plainTextFromTranslationResponse({ id: "1", translatedHtml: "Hello<br>world" })).toBe("Hello\nworld")
  })

  it("sends input translations to English regardless of the page target language", async () => {
    let sentPayload: unknown
    const sendMessage = vi.fn(async (message: { type: string; payload?: unknown }) => {
      if (message.type === "GET_CONFIG") {
        return {
          ok: true,
          data: {
            ...DEFAULT_USER_CONFIG,
            targetLanguage: "Simplified Chinese",
            providers: [{ ...DEFAULT_USER_CONFIG.providers[0], apiKey: "test-key" }],
          },
        }
      }

      if (message.type === "TRANSLATE_FRAGMENT") {
        sentPayload = message.payload
        return { ok: true, data: { id: "1", translatedHtml: "Hello" } }
      }

      throw new Error(`Unexpected message ${message.type}`)
    })

    vi.stubGlobal("chrome", {
      runtime: { sendMessage },
    })

    const translated = await translatePlainTextWithRuntime("你好", DEFAULT_USER_CONFIG.providers[0].id)

    expect(translated).toBe("Hello")
    expect(sentPayload).toMatchObject({
      sourceHtml: "你好",
      sourceText: "你好",
      targetLanguage: DEFAULT_INPUT_TRANSLATION_TARGET_LANGUAGE,
    })
  })

  it("translates a focused textarea after three spaces and removes trigger spaces", async () => {
    let resolveTranslation: ((value: string) => void) | undefined
    const translateText = vi.fn(() => new Promise<string>(resolve => {
      resolveTranslation = resolve
    }))
    const translator = new InputTranslator(translateText)
    document.body.innerHTML = `<textarea id="target"></textarea>`
    const textarea = document.getElementById("target") as HTMLTextAreaElement
    textarea.value = "你好"
    textarea.setSelectionRange(textarea.value.length, textarea.value.length)

    translator.setPageProvider("provider-a", "en")
    translator.start()
    pressSpace(textarea)
    pressSpace(textarea)
    pressSpace(textarea)

    expect(textarea.value).toBe("你好")
    expect(translateText).toHaveBeenCalledWith("你好", "provider-a")

    resolveTranslation?.("Hello")
    await flushPromises()

    expect(textarea.value).toBe("Hello")

    const status = document.querySelector<HTMLElement>(`.${OPENREAD_INPUT_STATUS_CLASS}`)
    expect(status?.dataset.openreadStatus).toBe("complete")
    expect(status?.dataset.openreadPosition).toBe("bottom-center")

    textarea.value = "Hello and a follow-up edit"
    status?.querySelector<HTMLButtonElement>(`.${OPENREAD_INPUT_STATUS_CLASS}__undo-button`)?.click()
    expect(textarea.value).toBe("你好")
    translator.stop()
  })

  it("does not intercept three spaces when input translation is disabled", () => {
    const translateText = vi.fn(async () => "Hello")
    const translator = new InputTranslator(translateText)
    document.body.innerHTML = `<textarea id="target"></textarea>`
    const textarea = document.getElementById("target") as HTMLTextAreaElement
    textarea.value = "你好"
    textarea.setSelectionRange(textarea.value.length, textarea.value.length)

    translator.setPageProvider("provider-a", "en", false)
    translator.start()
    pressSpace(textarea)
    pressSpace(textarea)
    pressSpace(textarea)

    expect(textarea.value).toBe("你好   ")
    expect(translateText).not.toHaveBeenCalled()
    translator.stop()
  })

  it("does not call the provider when stored config disables input translation", async () => {
    const sendMessage = vi.fn(async (message: { type: string }) => {
      if (message.type === "GET_CONFIG") {
        return {
          ok: true,
          data: {
            ...DEFAULT_USER_CONFIG,
            inputTranslationEnabled: false,
          },
        }
      }

      throw new Error(`Unexpected message ${message.type}`)
    })

    vi.stubGlobal("chrome", {
      runtime: { sendMessage },
    })

    await expect(translatePlainTextWithRuntime("你好", DEFAULT_USER_CONFIG.providers[0].id))
      .rejects.toThrow("Input translation is disabled.")
    expect(sendMessage).toHaveBeenCalledTimes(1)
  })

  it("does not overwrite the control when the user edits during translation", async () => {
    let resolveTranslation: ((value: string) => void) | undefined
    const translateText = vi.fn(() => new Promise<string>(resolve => {
      resolveTranslation = resolve
    }))
    const translator = new InputTranslator(translateText)
    document.body.innerHTML = `<textarea id="target"></textarea>`
    const textarea = document.getElementById("target") as HTMLTextAreaElement
    textarea.value = "你好"
    textarea.setSelectionRange(textarea.value.length, textarea.value.length)

    translator.start()
    pressSpace(textarea)
    pressSpace(textarea)
    pressSpace(textarea)
    textarea.value = "你好，继续写"

    resolveTranslation?.("Hello")
    await flushPromises()

    expect(textarea.value).toBe("你好，继续写")
    translator.stop()
  })

  it("undo restores the translated control even when another field is focused", async () => {
    let resolveTranslation: ((value: string) => void) | undefined
    const translateText = vi.fn(() => new Promise<string>(resolve => {
      resolveTranslation = resolve
    }))
    const translator = new InputTranslator(translateText)
    document.body.innerHTML = `
      <textarea id="source"></textarea>
      <textarea id="other"></textarea>
    `
    const source = document.getElementById("source") as HTMLTextAreaElement
    const other = document.getElementById("other") as HTMLTextAreaElement
    source.value = "你好"
    other.value = "keep me"
    source.setSelectionRange(source.value.length, source.value.length)

    translator.start()
    pressSpace(source)
    pressSpace(source)
    pressSpace(source)

    resolveTranslation?.("Hello")
    await flushPromises()
    other.focus()
    document.querySelector<HTMLButtonElement>(`.${OPENREAD_INPUT_STATUS_CLASS}__undo-button`)?.click()

    expect(source.value).toBe("你好")
    expect(other.value).toBe("keep me")
    translator.stop()
  })
})

function spaceKeyDown(): KeyboardEvent {
  return new KeyboardEvent("keydown", {
    bubbles: true,
    cancelable: true,
    code: "Space",
    key: " ",
  })
}

function pressSpace(textarea: HTMLTextAreaElement): void {
  const event = spaceKeyDown()
  const shouldInsertSpace = textarea.dispatchEvent(event)
  if (shouldInsertSpace) {
    const selectionStart = textarea.selectionStart ?? textarea.value.length
    const selectionEnd = textarea.selectionEnd ?? selectionStart
    textarea.value = `${textarea.value.slice(0, selectionStart)} ${textarea.value.slice(selectionEnd)}`
    textarea.setSelectionRange(selectionStart + 1, selectionStart + 1)
  }
}

async function flushPromises(): Promise<void> {
  await Promise.resolve()
  await Promise.resolve()
}
