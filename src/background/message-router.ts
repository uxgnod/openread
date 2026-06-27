import { messageError, type OpenReadMessage, type OpenReadResponse, isOpenReadMessage } from "@/shared/messages"
import type { ResponseMap } from "@/shared/messages"
import { getConfig, saveConfig, assertUsableConfig } from "./config-store"
import { testOpenAICompatibleProvider, translateWithOpenAICompatible } from "./providers/openai-compatible"
import { getCachedTranslation, setCachedTranslation, translationCacheKey } from "./translation-cache"
import { TranslationQueue, withRetries } from "./translation-queue"

const queue = new TranslationQueue(3)

export function registerMessageRouter(): void {
  chrome.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
    if (!isOpenReadMessage(message)) {
      return false
    }

    void handleRuntimeMessage(message)
      .then(data => sendResponse({ ok: true, data } satisfies OpenReadResponse<unknown>))
      .catch(error => sendResponse({ ok: false, error: messageError(error) } satisfies OpenReadResponse<unknown>))

    return true
  })
}

async function handleRuntimeMessage(message: OpenReadMessage): Promise<ResponseMap[keyof ResponseMap]> {
  switch (message.type) {
    case "GET_CONFIG":
      return getConfig()
    case "SAVE_CONFIG":
      return saveConfig(message.payload)
    case "TEST_PROVIDER":
      assertUsableConfig(message.payload, message.payload.activeProviderId)
      return testOpenAICompatibleProvider(message.payload)
    case "TRANSLATE_FRAGMENT":
      return queue.enqueue(async () => {
        const config = await getConfig()
        assertUsableConfig(config, message.payload.providerId)
        const key = await translationCacheKey(config, message.payload)
        const cached = await getCachedTranslation(key)
        if (cached) {
          return cached
        }

        const translated = await withRetries(
          () => translateWithOpenAICompatible(config, message.payload),
          { retries: 2, baseDelayMs: 800 },
        )
        await setCachedTranslation(key, translated)
        return translated
      })
    default:
      throw new Error(`Unsupported runtime message: ${(message as OpenReadMessage).type}`)
  }
}
