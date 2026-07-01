import { afterEach, describe, expect, it, vi } from "vitest"
import { OPENREAD_SELECTION_CARD_CLASS } from "@/shared/dom-rules"
import { DEFAULT_USER_CONFIG } from "@/shared/types"
import {
  SelectionTranslator,
  calculateSelectionCardPosition,
  detectSourceLanguage,
  displayLanguageName,
  translateSelectionTextWithRuntime,
  type SelectionRect,
} from "./selection-translator"

describe("selection translator", () => {
  afterEach(() => {
    document.querySelectorAll(`.${OPENREAD_SELECTION_CARD_CLASS}`).forEach(card => card.remove())
    document.getElementById("openread-style")?.remove()
    vi.unstubAllGlobals()
  })

  it("detects common source languages with local rules", () => {
    expect(detectSourceLanguage("Hello world").label).toBe("English")
    expect(detectSourceLanguage("你好，世界").label).toBe("Chinese")
    expect(detectSourceLanguage("こんにちは世界").label).toBe("Japanese")
    expect(detectSourceLanguage("안녕하세요").label).toBe("Korean")
    expect(detectSourceLanguage("12345").label).toBe("Auto")
  })

  it("displays language names in the user's Chinese interface language", () => {
    expect(displayLanguageName("en", "zh-CN")).toBe("英语")
    expect(displayLanguageName("Simplified Chinese", "zh-CN")).toBe("中文")
    expect(displayLanguageName("ja", "zh-CN")).toBe("日语")
    expect(displayLanguageName("en", "en")).toBe("English")
  })

  it("positions the card near the selection without covering it when space allows", () => {
    const below = calculateSelectionCardPosition(
      { bottom: 140, height: 30, left: 260, right: 420, top: 110, width: 160 },
      { height: 120, width: 260 },
      { height: 720, width: 960 },
    )

    expect(below.placement).toBe("below")
    expect(below.top).toBe(150)
    expect(below.top).toBeGreaterThan(140)

    const above = calculateSelectionCardPosition(
      { bottom: 700, height: 30, left: 260, right: 420, top: 670, width: 160 },
      { height: 120, width: 260 },
      { height: 720, width: 960 },
    )

    expect(above.placement).toBe("above")
    expect(above.top + 120).toBeLessThan(670)
  })

  it("clamps card position to the viewport", () => {
    const position = calculateSelectionCardPosition(
      { bottom: 40, height: 20, left: -80, right: -20, top: 20, width: 60 },
      { height: 120, width: 260 },
      { height: 420, width: 320 },
    )

    expect(position.left).toBeGreaterThanOrEqual(12)
    expect(position.top).toBeGreaterThanOrEqual(12)
  })

  it("creates a loading card and renders the translated selection", async () => {
    let resolveTranslation: ((value: { id: string; translatedHtml: string }) => void) | undefined
    const translateText = vi.fn(() => new Promise<{ id: string; translatedHtml: string }>(resolve => {
      resolveTranslation = resolve
    }))
    const translator = new SelectionTranslator(
      translateText,
      async () => ({
        ...DEFAULT_USER_CONFIG,
        targetLanguage: "Simplified Chinese",
      }),
    )
    translator.setPageProvider("provider-a", "en")

    const response = await translator.openSelectionTranslation({ sourceText: "Hello world" })

    const card = document.querySelector<HTMLElement>(`.${OPENREAD_SELECTION_CARD_CLASS}`)
    expect(response.cardId).toBeTruthy()
    expect(card?.dataset.openreadStatus).toBe("loading")
    expect(card?.textContent).toContain("English")
    expect(card?.textContent).toContain("Simplified Chinese")
    expect(card?.textContent).toContain("Translating")
    expect(translateText).toHaveBeenCalledWith("Hello world", "provider-a")

    resolveTranslation?.({ id: "1", translatedHtml: "<strong>你好，世界</strong>" })
    await flushPromises()

    expect(card?.dataset.openreadStatus).toBe("complete")
    expect(card?.querySelector(`.${OPENREAD_SELECTION_CARD_CLASS}__body`)?.innerHTML).toBe("<strong>你好，世界</strong>")
  })

  it("keeps multiple cards independent and lets pin and close operate on one card", async () => {
    const translator = new SelectionTranslator(
      async sourceText => ({ id: crypto.randomUUID(), translatedText: `Translated: ${sourceText}` }),
      async () => ({
        ...DEFAULT_USER_CONFIG,
        targetLanguage: "Simplified Chinese",
      }),
    )

    await translator.openSelectionTranslation({ sourceText: "First" })
    await translator.openSelectionTranslation({ sourceText: "Second" })
    await flushPromises()

    const cards = [...document.querySelectorAll<HTMLElement>(`.${OPENREAD_SELECTION_CARD_CLASS}`)]
    expect(cards).toHaveLength(2)
    expect(cards[0].textContent).toContain("Translated: First")
    expect(cards[1].textContent).toContain("Translated: Second")

    const firstPin = cards[0].querySelector<HTMLButtonElement>(`.${OPENREAD_SELECTION_CARD_CLASS}__icon-button`)
    firstPin?.click()

    expect(cards[0].dataset.openreadPinned).toBe("true")
    expect(cards[1].dataset.openreadPinned).toBe("false")

    const firstClose = cards[0].querySelectorAll<HTMLButtonElement>(`.${OPENREAD_SELECTION_CARD_CLASS}__icon-button`)[1]
    firstClose?.click()

    expect(document.querySelectorAll(`.${OPENREAD_SELECTION_CARD_CLASS}`)).toHaveLength(1)
    expect(document.querySelector(`.${OPENREAD_SELECTION_CARD_CLASS}`)?.textContent).toContain("Translated: Second")
  })

  it("reuses the pinned card when a new context-menu translation is requested", async () => {
    const translator = new SelectionTranslator(
      async sourceText => ({ id: crypto.randomUUID(), translatedText: `Translated: ${sourceText}` }),
      async () => ({
        ...DEFAULT_USER_CONFIG,
        targetLanguage: "Simplified Chinese",
      }),
    )
    translator.setPageProvider("provider-a", "zh-CN")

    const first = await translator.openSelectionTranslation({ sourceText: "First" })
    await flushPromises()

    const card = document.querySelector<HTMLElement>(`.${OPENREAD_SELECTION_CARD_CLASS}`)
    card?.querySelector<HTMLButtonElement>(`.${OPENREAD_SELECTION_CARD_CLASS}__icon-button`)?.click()

    const second = await translator.openSelectionTranslation({ sourceText: "Second" })
    await flushPromises()

    expect(second.cardId).toBe(first.cardId)
    expect(document.querySelectorAll(`.${OPENREAD_SELECTION_CARD_CLASS}`)).toHaveLength(1)
    expect(card?.textContent).not.toContain("Translated: First")
    expect(card?.textContent).toContain("Translated: Second")
    expect(card?.textContent).toContain("已固定")
    expect(card?.textContent).toContain("英语")
    expect(card?.textContent).toContain("中文")
    expect(card?.querySelector(`.${OPENREAD_SELECTION_CARD_CLASS}__arrow svg, .${OPENREAD_SELECTION_CARD_CLASS}__arrow`))
      .not.toBeNull()
  })

  it("auto-translates a new selection into the pinned card", async () => {
    vi.useFakeTimers()
    const translator = new SelectionTranslator(
      async sourceText => ({ id: crypto.randomUUID(), translatedText: `Translated: ${sourceText}` }),
      async () => ({
        ...DEFAULT_USER_CONFIG,
        targetLanguage: "Simplified Chinese",
      }),
    )
    translator.setPageProvider("provider-a", "zh-CN")
    translator.start()

    await translator.openSelectionTranslation({ sourceText: "First" })
    await flushPromises()

    const card = document.querySelector<HTMLElement>(`.${OPENREAD_SELECTION_CARD_CLASS}`)
    card?.querySelector<HTMLButtonElement>(`.${OPENREAD_SELECTION_CARD_CLASS}__icon-button`)?.click()

    stubSelection("Second", { bottom: 100, height: 20, left: 80, right: 180, top: 80, width: 100 })
    document.dispatchEvent(new Event("selectionchange"))
    vi.runOnlyPendingTimers()
    await flushPromises()

    expect(card?.textContent).toContain("Translated: Second")
    expect(document.querySelectorAll(`.${OPENREAD_SELECTION_CARD_CLASS}`)).toHaveLength(1)

    translator.stop()
    vi.useRealTimers()
  })

  it("closes unpinned cards when the user clicks the page", async () => {
    const translator = new SelectionTranslator(
      async sourceText => ({ id: crypto.randomUUID(), translatedText: `Translated: ${sourceText}` }),
      async () => DEFAULT_USER_CONFIG,
    )
    translator.start()

    await translator.openSelectionTranslation({ sourceText: "First" })
    await flushPromises()
    document.body.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true, button: 0 }))

    expect(document.querySelectorAll(`.${OPENREAD_SELECTION_CARD_CLASS}`)).toHaveLength(0)
    translator.stop()
  })

  it("sends plain selected text through the runtime translation message", async () => {
    let sentPayload: unknown
    const sendMessage = vi.fn(async (message: { type: string; payload?: unknown }) => {
      if (message.type === "GET_CONFIG") {
        return {
          ok: true,
          data: {
            ...DEFAULT_USER_CONFIG,
            activeProviderId: "provider-a",
          },
        }
      }

      if (message.type === "TRANSLATE_FRAGMENT") {
        sentPayload = message.payload
        return { ok: true, data: { id: "1", translatedHtml: "你好<br>世界" } }
      }

      throw new Error(`Unexpected message ${message.type}`)
    })

    vi.stubGlobal("chrome", {
      runtime: { sendMessage },
    })

    const response = await translateSelectionTextWithRuntime("Hello\nworld", undefined)

    expect(response.translatedHtml).toBe("你好<br>世界")
    expect(sentPayload).toMatchObject({
      providerId: "provider-a",
      sourceHtml: "Hello<br>world",
      sourceText: "Hello\nworld",
    })
  })
})

async function flushPromises(): Promise<void> {
  await Promise.resolve()
  await Promise.resolve()
}

function stubSelection(text: string, rect: SelectionRect): void {
  const range = {
    commonAncestorContainer: document.body,
    getBoundingClientRect: () => rect,
    getClientRects: () => [rect],
  } as unknown as Range

  vi.spyOn(window, "getSelection").mockReturnValue({
    getRangeAt: () => range,
    isCollapsed: false,
    rangeCount: 1,
    toString: () => text,
  } as unknown as Selection)
}
