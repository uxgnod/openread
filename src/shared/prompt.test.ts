import { describe, expect, it } from "vitest"
import { buildProviderPrompt } from "./prompt"
import { DEFAULT_USER_CONFIG } from "./types"

describe("buildProviderPrompt", () => {
  it("renders configured variables", () => {
    const prompt = buildProviderPrompt(
      {
        ...DEFAULT_USER_CONFIG,
        targetLanguage: "French",
        systemPrompt: "Translate to {{targetLanguage}}",
        userPrompt: "HTML={{sourceHtml}} TEXT={{sourceText}}",
      },
      {
        sourceHtml: "<strong>Hello</strong>",
        sourceText: "Hello",
      },
    )

    expect(prompt.system).toBe("Translate to French")
    expect(prompt.user).toBe("HTML=<strong>Hello</strong> TEXT=Hello")
  })
})
