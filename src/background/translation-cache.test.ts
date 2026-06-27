import { describe, expect, it } from "vitest"
import { DEFAULT_USER_CONFIG } from "@/shared/types"
import { translationCacheKey } from "./translation-cache"

describe("translation cache", () => {
  it("changes cache key when a fragment target language override changes", async () => {
    const baseFragment = {
      providerId: DEFAULT_USER_CONFIG.providers[0].id,
      sourceHtml: "你好",
      sourceText: "你好",
    }

    const chineseKey = await translationCacheKey(DEFAULT_USER_CONFIG, baseFragment)
    const englishKey = await translationCacheKey(DEFAULT_USER_CONFIG, {
      ...baseFragment,
      targetLanguage: "English",
    })

    expect(englishKey).not.toBe(chineseKey)
  })
})
