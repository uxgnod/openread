import { sha256 } from "@/shared/hash"
import { buildProviderPrompt } from "@/shared/prompt"
import { TRANSLATION_CACHE_STORAGE_KEY } from "@/shared/storage-keys"
import { getProviderById, type TranslateFragmentRequest, type TranslateFragmentResponse, type TranslationCacheEntry, type UserConfig } from "@/shared/types"

type CacheMap = Record<string, TranslationCacheEntry>

export async function translationCacheKey(
  config: UserConfig,
  fragment: Pick<TranslateFragmentRequest, "providerId" | "sourceHtml" | "sourceText" | "targetLanguage">,
): Promise<string> {
  const provider = getProviderById(config, fragment.providerId)
  const prompt = buildProviderPrompt(config, fragment)
  const targetLanguage = fragment.targetLanguage?.trim() || config.targetLanguage
  return sha256(JSON.stringify({
    providerId: provider.id,
    baseUrl: provider.baseUrl,
    model: provider.model,
    targetLanguage,
    sourceHtml: fragment.sourceHtml,
    systemPrompt: prompt.system,
    userPrompt: prompt.user,
  }))
}

export async function getCachedTranslation(key: string): Promise<TranslateFragmentResponse | undefined> {
  const cache = await readCache()
  return cache[key]?.value
}

export async function setCachedTranslation(
  key: string,
  value: TranslateFragmentResponse,
): Promise<void> {
  const cache = await readCache()
  cache[key] = {
    value,
    createdAt: Date.now(),
  }
  await chrome.storage.local.set({ [TRANSLATION_CACHE_STORAGE_KEY]: pruneCache(cache) })
}

async function readCache(): Promise<CacheMap> {
  const result = await chrome.storage.local.get(TRANSLATION_CACHE_STORAGE_KEY)
  return (result[TRANSLATION_CACHE_STORAGE_KEY] as CacheMap | undefined) ?? {}
}

function pruneCache(cache: CacheMap): CacheMap {
  const entries = Object.entries(cache)
    .sort(([, a], [, b]) => b.createdAt - a.createdAt)
    .slice(0, 500)
  return Object.fromEntries(entries)
}
