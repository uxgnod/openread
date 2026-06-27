import type { UiLocale, UiLocalePreference } from "./i18n"

export interface ProviderConfig {
  id: string
  name: string
  baseUrl: string
  apiKey: string
  model: string
}

export interface UserConfig {
  providers: ProviderConfig[]
  activeProviderId: string
  targetLanguage: string
  systemPrompt: string
  userPrompt: string
  progressPosition: ProgressPosition
  uiLocale: UiLocalePreference
}

export interface TranslateFragmentRequest {
  id: string
  providerId: string
  sourceHtml: string
  sourceText: string
}

export interface StartTranslationRequest {
  providerId: string
  progressPosition: ProgressPosition
  uiLocale: UiLocale
}

export interface TranslateFragmentResponse {
  id: string
  translatedHtml?: string
  translatedText?: string
}

export interface TestProviderResponse {
  providerId: string
  message: string
}

export interface PageTranslationState {
  isActive: boolean
  providerId?: string
  translatedCount: number
  pendingCount: number
  totalCount: number
  remainingCount: number
}

export interface TranslationCacheEntry {
  value: TranslateFragmentResponse
  createdAt: number
}

export interface ProviderPrompt {
  system: string
  user: string
}

export const PROGRESS_POSITIONS = [
  "bottom-center",
  "top-center",
  "top-left",
  "top-right",
  "bottom-left",
  "bottom-right",
] as const

export type ProgressPosition = typeof PROGRESS_POSITIONS[number]

export const TRANSLATION_DISPLAY_MODES = [
  "original",
  "translation",
  "bilingual",
] as const

export type TranslationDisplayMode = typeof TRANSLATION_DISPLAY_MODES[number]

export const DEFAULT_SYSTEM_PROMPT = `You are a careful bilingual web translation engine.
Translate the user's HTML fragment into {{targetLanguage}}.
Keep the original HTML tag structure, links, emphasis, line breaks, safe inline spans, and inline code tags such as code, kbd, samp, and var.
Only translate human-readable text nodes.
Do not translate text inside code, kbd, samp, or var tags.
Do not add explanations, markdown fences, or surrounding commentary.
Return only the translated HTML fragment.`

export const DEFAULT_USER_PROMPT = `Target language: {{targetLanguage}}

Source text:
{{sourceText}}

Source HTML fragment:
{{sourceHtml}}`

export const DEFAULT_PROVIDER_CONFIG: ProviderConfig = {
  id: "openai-default",
  name: "OpenAI",
  baseUrl: "https://api.openai.com/v1",
  apiKey: "",
  model: "gpt-4o-mini",
}

export const DEFAULT_USER_CONFIG: UserConfig = {
  providers: [DEFAULT_PROVIDER_CONFIG],
  activeProviderId: DEFAULT_PROVIDER_CONFIG.id,
  targetLanguage: "Simplified Chinese",
  systemPrompt: DEFAULT_SYSTEM_PROMPT,
  userPrompt: DEFAULT_USER_PROMPT,
  progressPosition: "bottom-center",
  uiLocale: "auto",
}

export function getActiveProvider(config: UserConfig): ProviderConfig {
  return getProviderById(config, config.activeProviderId)
}

export function getProviderById(config: UserConfig, providerId: string | undefined): ProviderConfig {
  return (
    config.providers.find(provider => provider.id === providerId)
    ?? config.providers[0]
    ?? DEFAULT_PROVIDER_CONFIG
  )
}
