import type { ProviderPrompt, UserConfig } from "./types"

export function renderPromptTemplate(
  template: string,
  values: {
    targetLanguage: string
    sourceHtml: string
    sourceText: string
  },
): string {
  return template
    .replaceAll("{{targetLanguage}}", values.targetLanguage)
    .replaceAll("{{sourceHtml}}", values.sourceHtml)
    .replaceAll("{{sourceText}}", values.sourceText)
}

export function buildProviderPrompt(
  config: UserConfig,
  fragment: { sourceHtml: string; sourceText: string },
): ProviderPrompt {
  const values = {
    targetLanguage: config.targetLanguage,
    sourceHtml: fragment.sourceHtml,
    sourceText: fragment.sourceText,
  }

  return {
    system: renderPromptTemplate(config.systemPrompt, values),
    user: renderPromptTemplate(config.userPrompt, values),
  }
}
