import { describe, expect, it } from "vitest"
import {
  OPENREAD_INPUT_STATUS_CLASS,
  OPENREAD_PROGRESS_CLASS,
  OPENREAD_SOURCE_CLASS,
  OPENREAD_WRAPPER_CLASS,
} from "@/shared/dom-rules"
import {
  applyTranslationDisplayMode,
  createLoadingWrapper,
  removeAllWrappers,
  removeInputStatus,
  removeTranslationProgress,
  renderInputStatus,
  renderTranslation,
  renderTranslationProgress,
} from "./translation-renderer"
import type { InlineCodeHint } from "./rich-fragment"

describe("translation renderer", () => {
  it("renders block translations inside the original source element", () => {
    document.body.innerHTML = `<main><p id="source" style="margin-bottom: 24px">Hello world</p></main>`
    const source = document.getElementById("source") as HTMLElement

    const wrapper = createLoadingWrapper(source)

    expect(source.style.marginBottom).toBe("24px")
    expect(wrapper.tagName).toBe("SPAN")
    expect(wrapper.dataset.openreadPlacement).toBe("inside-block")
    expect(wrapper.classList.contains(OPENREAD_WRAPPER_CLASS)).toBe(true)
    expect(source.contains(wrapper)).toBe(true)
    expect(source.querySelector(`.${OPENREAD_SOURCE_CLASS}`)?.textContent).toBe("Hello world")

    removeAllWrappers()

    expect(source.style.marginBottom).toBe("24px")
    expect(document.querySelector(`.${OPENREAD_WRAPPER_CLASS}`)).toBeNull()
    expect(document.querySelector(`.${OPENREAD_SOURCE_CLASS}`)).toBeNull()
    expect(source.textContent).toBe("Hello world")
  })

  it("renders navigation links inline inside the original link", () => {
    document.body.innerHTML = `<header><a id="source" href="/source">Source</a></header>`
    const source = document.getElementById("source") as HTMLElement

    const wrapper = createLoadingWrapper(source)

    expect(wrapper.tagName).toBe("SPAN")
    expect(wrapper.dataset.openreadPlacement).toBe("inline")
    expect(source.contains(wrapper)).toBe(true)
  })

  it("repairs dropped source links when translated text still contains the linked phrase", () => {
    document.body.innerHTML = `<main><p id="source">The fourth edition of <a href="/world/2026">Rails World</a>.</p></main>`
    const source = document.getElementById("source") as HTMLElement
    const wrapper = createLoadingWrapper(source)

    renderTranslation(
      wrapper,
      "第四届 Rails World 大会即将到来。",
      undefined,
      `The fourth edition of <a href="/world/2026">Rails World</a>.`,
    )

    const repairedLink = wrapper.querySelector("a")
    expect(repairedLink?.getAttribute("href")).toBe("/world/2026")
    expect(repairedLink?.textContent).toBe("Rails World")
  })

  it("renders and removes page translation progress", () => {
    renderTranslationProgress({
      isActive: true,
      displayMode: "bilingual",
      onDisplayModeChange: () => {},
      pendingCount: 0,
      progressPosition: "bottom-center",
      remainingCount: 3,
      totalCount: 4,
      translatedCount: 1,
      uiLocale: "en",
    })

    const chip = document.querySelector(`.${OPENREAD_PROGRESS_CLASS}`)
    expect(chip?.querySelector(`.${OPENREAD_PROGRESS_CLASS}__status`)).not.toBeNull()
    expect(chip?.querySelector(`.${OPENREAD_PROGRESS_CLASS}__label`)?.textContent).toBe("25%")
    expect((chip as HTMLElement | null)?.dataset.openreadProgressPercent).toBe("25")
    expect(chip?.textContent).not.toContain("left")
    expect(chip?.classList.contains("notranslate")).toBe(true)

    removeTranslationProgress()

    expect(document.querySelector(`.${OPENREAD_PROGRESS_CLASS}`)).toBeNull()
  })

  it("keeps completed progress visible with a success state", () => {
    renderTranslationProgress({
      isActive: true,
      displayMode: "bilingual",
      onDisplayModeChange: () => {},
      pendingCount: 0,
      progressPosition: "bottom-center",
      remainingCount: 0,
      totalCount: 4,
      translatedCount: 4,
      uiLocale: "en",
    })

    const chip = document.querySelector<HTMLElement>(`.${OPENREAD_PROGRESS_CLASS}`)

    expect(chip?.dataset.openreadComplete).toBe("true")
    expect(chip?.querySelector(`.${OPENREAD_PROGRESS_CLASS}__status-icon`)).not.toBeNull()
    expect(chip?.querySelector(`.${OPENREAD_PROGRESS_CLASS}__check-path`)).not.toBeNull()
    expect(chip?.dataset.openreadProgressPercent).toBe("100")
    expect(chip?.querySelector(`.${OPENREAD_PROGRESS_CLASS}__label`)?.textContent).toBe("100%")

    removeTranslationProgress()
  })

  it("does not count pending translations as completed progress", () => {
    renderTranslationProgress({
      isActive: true,
      displayMode: "bilingual",
      onDisplayModeChange: () => {},
      pendingCount: 2,
      progressPosition: "bottom-center",
      remainingCount: 3,
      totalCount: 4,
      translatedCount: 1,
      uiLocale: "en",
    })

    const chip = document.querySelector<HTMLElement>(`.${OPENREAD_PROGRESS_CLASS}`)

    expect(chip?.dataset.openreadComplete).toBe("false")
    expect(chip?.dataset.openreadProgressPercent).toBe("25")
    expect(chip?.querySelector(`.${OPENREAD_PROGRESS_CLASS}__label`)?.textContent).toBe("25%")

    removeTranslationProgress()
  })

  it("renders display mode switch and calls back with selected mode", () => {
    let selectedMode = "bilingual"

    renderTranslationProgress({
      isActive: true,
      displayMode: "bilingual",
      onDisplayModeChange: mode => {
        selectedMode = mode
      },
      pendingCount: 0,
      progressPosition: "bottom-center",
      remainingCount: 1,
      totalCount: 2,
      translatedCount: 1,
      uiLocale: "en",
    })

    const translationButton = document.querySelector<HTMLButtonElement>(
      `.${OPENREAD_PROGRESS_CLASS}__mode-button[data-openread-mode="translation"]`,
    )
    translationButton?.click()

    expect(selectedMode).toBe("translation")
    expect(translationButton?.textContent).toBe("Translation")
  })

  it("sets progress chip position for every supported position", () => {
    const positions = [
      "bottom-center",
      "top-center",
      "top-left",
      "top-right",
      "bottom-left",
      "bottom-right",
    ] as const

    for (const progressPosition of positions) {
      renderTranslationProgress({
        isActive: true,
        displayMode: "bilingual",
        onDisplayModeChange: () => {},
        pendingCount: 0,
        progressPosition,
        remainingCount: 1,
        totalCount: 2,
        translatedCount: 1,
        uiLocale: "en",
      })

      expect(document.querySelector<HTMLElement>(`.${OPENREAD_PROGRESS_CLASS}`)?.dataset.openreadPosition)
        .toBe(progressPosition)
    }

    removeTranslationProgress()
  })

  it("renders input translation status using the configured floating position", () => {
    renderInputStatus({
      progressPosition: "bottom-right",
      status: "loading",
      uiLocale: "en",
    })

    const chip = document.querySelector<HTMLElement>(`.${OPENREAD_INPUT_STATUS_CLASS}`)

    expect(chip?.dataset.openreadPosition).toBe("bottom-right")
    expect(chip?.dataset.openreadStatus).toBe("loading")
    expect(chip?.textContent).toContain("Translating input")
    expect(chip?.querySelector(`.${OPENREAD_INPUT_STATUS_CLASS}__status-icon`)).not.toBeNull()

    removeInputStatus()
  })

  it("renders completed input translation status with undo action", () => {
    let undone = false

    renderInputStatus({
      onUndo: () => {
        undone = true
      },
      progressPosition: "top-center",
      status: "complete",
      uiLocale: "en",
    })

    const chip = document.querySelector<HTMLElement>(`.${OPENREAD_INPUT_STATUS_CLASS}`)
    const undoButton = chip?.querySelector<HTMLButtonElement>(`.${OPENREAD_INPUT_STATUS_CLASS}__undo-button`)

    expect(chip?.dataset.openreadStatus).toBe("complete")
    expect(chip?.textContent).toContain("Input translation complete")
    expect(chip?.querySelector(`.${OPENREAD_INPUT_STATUS_CLASS}__check-path`)).not.toBeNull()
    expect(undoButton?.textContent).toBe("Undo")

    undoButton?.click()
    expect(undone).toBe(true)

    removeInputStatus()
  })

  it("applies translation display mode on the document element", () => {
    applyTranslationDisplayMode("translation")

    expect(document.documentElement.dataset.openreadDisplayMode).toBe("translation")

    removeAllWrappers()

    expect(document.documentElement.dataset.openreadDisplayMode).toBeUndefined()
  })

  it("repairs dropped inline code and applies source code style hints", () => {
    document.body.innerHTML = `<main><p id="source">Calling <code>to_i</code> is useful.</p></main>`
    const source = document.getElementById("source") as HTMLElement
    const wrapper = createLoadingWrapper(source)
    const hints: InlineCodeHint[] = [{
      tagName: "code",
      text: "to_i",
      style: codeStyleHint(),
    }]

    renderTranslation(wrapper, "调用 to_i 很有用。", undefined, source.innerHTML, hints)

    const code = wrapper.querySelector("code") as HTMLElement | null
    expect(code?.textContent).toBe("to_i")
    expect(code?.style.backgroundColor).toBe("rgb(38, 27, 35)")
    expect(code?.style.fontFamily).toBe("IBM Plex Mono, monospace")
    expect(code?.style.borderRadius).toBe("4px")
  })

  it("styles existing inline code without wrapping it again", () => {
    document.body.innerHTML = `<main><p id="source">Calling <code>to_i</code> is useful.</p></main>`
    const source = document.getElementById("source") as HTMLElement
    const wrapper = createLoadingWrapper(source)

    renderTranslation(
      wrapper,
      "调用 <code>to_i</code> 很有用。",
      undefined,
      source.innerHTML,
      [{ tagName: "code", text: "to_i", style: codeStyleHint() }],
    )

    const codes = wrapper.querySelectorAll("code")
    expect(codes).toHaveLength(1)
    expect((codes[0] as HTMLElement).style.backgroundColor).toBe("rgb(38, 27, 35)")
  })
})

function codeStyleHint() {
  return {
    backgroundColor: "rgb(38, 27, 35)",
    borderRadius: "4px",
    color: "rgb(255, 255, 255)",
    display: "inline-block",
    fontFamily: "IBM Plex Mono, monospace",
    fontSize: "13px",
    fontWeight: "400",
    lineHeight: "23px",
    padding: "0px 6px",
  }
}
