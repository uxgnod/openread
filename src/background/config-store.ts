import { CONFIG_STORAGE_KEY } from "@/shared/storage-keys"
import { isUiLocalePreference } from "@/shared/i18n"
import {
  DEFAULT_PROVIDER_CONFIG,
  DEFAULT_USER_CONFIG,
  PROGRESS_POSITIONS,
  getProviderById,
  type ProviderConfig,
  type ProgressPosition,
  type UserConfig,
} from "@/shared/types"

type LegacyStoredConfig = Partial<UserConfig> & Partial<ProviderConfig>

export async function getConfig(): Promise<UserConfig> {
  const result = await chrome.storage.local.get(CONFIG_STORAGE_KEY)
  return normalizeConfig(result[CONFIG_STORAGE_KEY] as LegacyStoredConfig | undefined)
}

export async function saveConfig(config: UserConfig): Promise<UserConfig> {
  const normalized = normalizeConfig(config)

  await chrome.storage.local.set({ [CONFIG_STORAGE_KEY]: normalized })
  return normalized
}

export function assertUsableConfig(config: UserConfig, providerId?: string): void {
  const provider = getProviderById(config, providerId)
  if (!provider.baseUrl.trim()) {
    throw new Error("Base URL is required.")
  }
  if (!provider.model.trim()) {
    throw new Error("Model is required.")
  }
  if (!config.targetLanguage.trim()) {
    throw new Error("Target language is required.")
  }
  if (!provider.apiKey.trim()) {
    throw new Error("API key is required before translating.")
  }
}

function normalizeConfig(raw: LegacyStoredConfig | undefined): UserConfig {
  const providers = normalizeProviders(raw)
  const activeProviderId = providers.some(provider => provider.id === raw?.activeProviderId)
    ? raw!.activeProviderId!
    : providers[0].id

  return {
    providers,
    activeProviderId,
    targetLanguage: (raw?.targetLanguage ?? DEFAULT_USER_CONFIG.targetLanguage).trim(),
    systemPrompt: raw?.systemPrompt ?? DEFAULT_USER_CONFIG.systemPrompt,
    userPrompt: raw?.userPrompt ?? DEFAULT_USER_CONFIG.userPrompt,
    progressPosition: normalizeProgressPosition(raw?.progressPosition),
    uiLocale: isUiLocalePreference(raw?.uiLocale) ? raw.uiLocale : DEFAULT_USER_CONFIG.uiLocale,
  }
}

function normalizeProgressPosition(value: unknown): ProgressPosition {
  return typeof value === "string" && PROGRESS_POSITIONS.includes(value as ProgressPosition)
    ? value as ProgressPosition
    : DEFAULT_USER_CONFIG.progressPosition
}

function normalizeProviders(raw: LegacyStoredConfig | undefined): ProviderConfig[] {
  const rawProviders = Array.isArray(raw?.providers) ? raw.providers : []
  const providers = rawProviders
    .map(normalizeProvider)
    .filter((provider): provider is ProviderConfig => !!provider)

  if (providers.length > 0) {
    return providers
  }

  return [
    normalizeProvider({
      ...DEFAULT_PROVIDER_CONFIG,
      name: raw?.name ?? DEFAULT_PROVIDER_CONFIG.name,
      baseUrl: raw?.baseUrl ?? DEFAULT_PROVIDER_CONFIG.baseUrl,
      apiKey: raw?.apiKey ?? DEFAULT_PROVIDER_CONFIG.apiKey,
      model: raw?.model ?? DEFAULT_PROVIDER_CONFIG.model,
    })!,
  ]
}

function normalizeProvider(provider: Partial<ProviderConfig> | undefined): ProviderConfig | null {
  if (!provider) {
    return null
  }

  return {
    id: provider.id?.trim() || crypto.randomUUID(),
    name: provider.name?.trim() || "Provider",
    baseUrl: provider.baseUrl?.trim() ?? "",
    apiKey: provider.apiKey?.trim() ?? "",
    model: provider.model?.trim() ?? "",
  }
}
