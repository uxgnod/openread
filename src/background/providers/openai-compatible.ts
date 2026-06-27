import { buildProviderPrompt } from "@/shared/prompt"
import {
  getProviderById,
  type TestProviderResponse,
  type TranslateFragmentRequest,
  type TranslateFragmentResponse,
  type UserConfig,
} from "@/shared/types"

interface ChatCompletionsResponse {
  choices?: Array<{
    message?: {
      content?: string
    }
  }>
  error?: {
    message?: string
  }
}

export async function translateWithOpenAICompatible(
  config: UserConfig,
  fragment: TranslateFragmentRequest,
  fetcher: typeof fetch = fetch,
): Promise<TranslateFragmentResponse> {
  const provider = getProviderById(config, fragment.providerId)
  const prompt = buildProviderPrompt(config, fragment)
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 30_000)

  try {
    const response = await fetcher(`${normalizeBaseUrl(provider.baseUrl)}/chat/completions`, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${provider.apiKey}`,
      },
      body: JSON.stringify({
        model: provider.model,
        temperature: 0.2,
        messages: [
          { role: "system", content: prompt.system },
          { role: "user", content: prompt.user },
        ],
      }),
    })

    const payload = (await response.json().catch(() => ({}))) as ChatCompletionsResponse

    if (!response.ok) {
      throw new Error(
        payload.error?.message
          ? `Provider returned HTTP ${response.status}: ${payload.error.message}`
          : `Provider returned HTTP ${response.status}.`,
      )
    }

    const content = payload.choices?.[0]?.message?.content?.trim()
    if (!content) {
      throw new Error("Provider returned an empty translation.")
    }

    return {
      id: fragment.id,
      translatedHtml: stripCodeFence(content),
    }
  }
  catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("Translation request timed out after 30 seconds.")
    }
    throw error
  }
  finally {
    clearTimeout(timeoutId)
  }
}

export async function testOpenAICompatibleProvider(
  config: UserConfig,
  fetcher: typeof fetch = fetch,
): Promise<TestProviderResponse> {
  const provider = getProviderById(config, config.activeProviderId)
  const response = await translateWithOpenAICompatible(
    config,
    {
      id: "provider-test",
      providerId: provider.id,
      sourceHtml: "OpenRead provider test.",
      sourceText: "OpenRead provider test.",
    },
    fetcher,
  )
  const sample = (response.translatedHtml ?? response.translatedText ?? "").trim()

  return {
    providerId: provider.id,
    message: sample
      ? `Provider responded successfully. Sample: ${truncateSample(sample)}`
      : "Provider responded successfully.",
  }
}

export function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.trim().replace(/\/+$/, "")
}

function stripCodeFence(value: string): string {
  const trimmed = value.trim()
  const match = trimmed.match(/^```(?:html)?\s*([\s\S]*?)\s*```$/i)
  return match?.[1]?.trim() ?? trimmed
}

function truncateSample(value: string): string {
  return value.length > 120 ? `${value.slice(0, 117)}...` : value
}
