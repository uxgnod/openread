import { describe, expect, it } from "vitest"
import { DEFAULT_USER_CONFIG, PROGRESS_POSITIONS } from "./types"

describe("default user config", () => {
  it("defaults progress chip to bottom center", () => {
    expect(DEFAULT_USER_CONFIG.progressPosition).toBe("bottom-center")
    expect(PROGRESS_POSITIONS).toContain(DEFAULT_USER_CONFIG.progressPosition)
    expect(DEFAULT_USER_CONFIG.uiLocale).toBe("auto")
    expect(DEFAULT_USER_CONFIG.inputTranslationEnabled).toBe(true)
  })
})
