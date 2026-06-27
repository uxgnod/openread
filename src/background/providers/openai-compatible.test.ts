import { describe, expect, it, vi } from "vitest"
import { DEFAULT_USER_CONFIG } from "@/shared/types"
import { normalizeBaseUrl, testOpenAICompatibleProvider, translateWithOpenAICompatible } from "./openai-compatible"

describe("openai compatible provider", () => {
  it("normalizes base url", () => {
    expect(normalizeBaseUrl("https://api.example.com/v1///")).toBe("https://api.example.com/v1")
  })

  it("returns translated html content", async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({
      choices: [{ message: { content: "<strong>Bonjour</strong>" } }],
    }), { status: 200 }))

    const response = await translateWithOpenAICompatible(
      {
        ...DEFAULT_USER_CONFIG,
        providers: [{ ...DEFAULT_USER_CONFIG.providers[0], apiKey: "test-key" }],
      },
      { id: "1", providerId: DEFAULT_USER_CONFIG.providers[0].id, sourceHtml: "<strong>Hello</strong>", sourceText: "Hello" },
      fetcher as unknown as typeof fetch,
    )

    expect(response.translatedHtml).toBe("<strong>Bonjour</strong>")
    expect(fetcher).toHaveBeenCalledOnce()
  })

  it("uses a request-level target language override in provider prompts", async () => {
    let requestBody: unknown
    const fetcher = vi.fn(async (_url, init) => {
      requestBody = JSON.parse(String(init?.body))
      return new Response(JSON.stringify({
        choices: [{ message: { content: "Hello" } }],
      }), { status: 200 })
    })

    await translateWithOpenAICompatible(
      {
        ...DEFAULT_USER_CONFIG,
        targetLanguage: "Simplified Chinese",
        systemPrompt: "Translate to {{targetLanguage}}",
        providers: [{ ...DEFAULT_USER_CONFIG.providers[0], apiKey: "test-key" }],
      },
      {
        id: "1",
        providerId: DEFAULT_USER_CONFIG.providers[0].id,
        sourceHtml: "你好",
        sourceText: "你好",
        targetLanguage: "English",
      },
      fetcher as unknown as typeof fetch,
    )

    expect((requestBody as { messages: Array<{ content: string; role: string }> }).messages[0])
      .toMatchObject({ role: "system", content: "Translate to English" })
  })

  it("surfaces provider errors", async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({
      error: { message: "bad key" },
    }), { status: 401 }))

    await expect(translateWithOpenAICompatible(
      {
        ...DEFAULT_USER_CONFIG,
        providers: [{ ...DEFAULT_USER_CONFIG.providers[0], apiKey: "bad" }],
      },
      { id: "1", providerId: DEFAULT_USER_CONFIG.providers[0].id, sourceHtml: "Hello", sourceText: "Hello" },
      fetcher as unknown as typeof fetch,
    )).rejects.toThrow("bad key")
  })

  it("tests provider connectivity with the active provider", async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({
      choices: [{ message: { content: "测试成功" } }],
    }), { status: 200 }))
    const config = {
      ...DEFAULT_USER_CONFIG,
      providers: [{ ...DEFAULT_USER_CONFIG.providers[0], apiKey: "test-key" }],
    }

    const response = await testOpenAICompatibleProvider(config, fetcher as unknown as typeof fetch)

    expect(response.providerId).toBe(DEFAULT_USER_CONFIG.providers[0].id)
    expect(response.message).toContain("Provider responded successfully")
    expect(response.message).toContain("测试成功")
    expect(fetcher).toHaveBeenCalledOnce()
  })
})
