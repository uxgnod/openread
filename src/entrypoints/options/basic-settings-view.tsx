import {
  SUPPORTED_UI_LOCALES,
  t,
  type UiLocale,
  type UiLocalePreference,
} from "@/shared/i18n"
import {
  PROGRESS_POSITIONS,
  type ProgressPosition,
  type ProviderConfig,
  type UserConfig,
} from "@/shared/types"
import { optionsCopy } from "./options-copy"
import { Field, SettingsSection, SwitchField } from "./options-ui"

export type ProviderTestState = {
  providerId?: string
  status: "idle" | "testing" | "success" | "error"
  message: string
}

export function BasicSettingsView({
  activeProvider,
  config,
  locale,
  providerTest,
  onAddProvider,
  onBlurAutoSave,
  onCopyProviderTestError,
  onProviderBlur,
  onProviderChange,
  onProviderSelect,
  onProviderTest,
  onRemoveProvider,
  onUpdateField,
}: {
  activeProvider: ProviderConfig
  config: UserConfig
  locale: UiLocale
  providerTest: ProviderTestState
  onAddProvider: () => void
  onBlurAutoSave: () => void
  onCopyProviderTestError: () => void
  onProviderBlur: () => void
  onProviderChange: <K extends keyof ProviderConfig>(key: K, value: ProviderConfig[K]) => void
  onProviderSelect: (providerId: string) => void
  onProviderTest: () => void
  onRemoveProvider: () => void
  onUpdateField: <K extends keyof UserConfig>(key: K, value: UserConfig[K], saveNow?: boolean) => void
}) {
  return (
    <section className="settings-content" aria-label={optionsCopy(locale, "basicSettings")}>
      <SettingsSection
        action={(
          <button type="button" className="secondary-button" onClick={onAddProvider}>
            {t(locale, "addProvider")}
          </button>
        )}
        description={t(locale, "providersDescription")}
        title={optionsCopy(locale, "providerConnection")}
      >
        <div className="provider-tabs">
          {config.providers.map(provider => (
            <button
              type="button"
              key={provider.id}
              className={provider.id === config.activeProviderId ? "provider-tab active" : "provider-tab"}
              onClick={() => onProviderSelect(provider.id)}
            >
              <strong>{provider.name || t(locale, "providerFallback")}</strong>
              <span>{provider.model || t(locale, "noModel")}</span>
            </button>
          ))}
        </div>

        <ProviderEditor
          provider={activeProvider}
          canRemove={config.providers.length > 1}
          testState={providerTest}
          onBlur={onProviderBlur}
          onChange={onProviderChange}
          onRemove={onRemoveProvider}
          onTest={onProviderTest}
          onCopyTestError={onCopyProviderTestError}
          locale={locale}
        />
      </SettingsSection>

      <SettingsSection
        description={optionsCopy(locale, "pageTranslationDescription")}
        title={optionsCopy(locale, "pageTranslation")}
      >
        <div className="two-column">
          <Field label={t(locale, "targetLanguage")}>
            <input
              value={config.targetLanguage}
              placeholder={t(locale, "targetLanguagePlaceholder")}
              onBlur={onBlurAutoSave}
              onChange={event => onUpdateField("targetLanguage", event.target.value)}
            />
          </Field>

          <Field label={t(locale, "progressPosition")}>
            <select
              value={config.progressPosition}
              onChange={event => onUpdateField("progressPosition", event.target.value as ProgressPosition, true)}
            >
              {PROGRESS_POSITIONS.map(position => (
                <option key={position} value={position}>
                  {progressPositionLabel(position, locale)}
                </option>
              ))}
            </select>
          </Field>
        </div>
      </SettingsSection>

      <SettingsSection
        description={optionsCopy(locale, "inputTranslationSectionDescription")}
        title={optionsCopy(locale, "inputTranslation")}
      >
        <SwitchField
          label={t(locale, "inputTranslationSwitch")}
          description={t(locale, "inputTranslationDescription")}
          checked={config.inputTranslationEnabled}
          onChange={checked => onUpdateField("inputTranslationEnabled", checked, true)}
        />
      </SettingsSection>

      <SettingsSection
        description={optionsCopy(locale, "interfaceDescription")}
        title={optionsCopy(locale, "interface")}
      >
        <Field label={t(locale, "interfaceLanguage")}>
          <select
            value={config.uiLocale}
            onChange={event => onUpdateField("uiLocale", event.target.value as UiLocalePreference, true)}
          >
            <option value="auto">{t(locale, "automaticBrowserLanguage")}</option>
            {SUPPORTED_UI_LOCALES.map(option => (
              <option key={option.code} value={option.code}>
                {option.nativeName} · {option.englishName}
              </option>
            ))}
          </select>
        </Field>
      </SettingsSection>

      <SettingsSection
        description={optionsCopy(locale, "advancedPromptDescription")}
        title={optionsCopy(locale, "advancedPrompt")}
      >
        <div className="two-column">
          <Field label={t(locale, "systemPrompt")}>
            <textarea
              value={config.systemPrompt}
              rows={8}
              onBlur={onBlurAutoSave}
              onChange={event => onUpdateField("systemPrompt", event.target.value)}
            />
          </Field>

          <Field label={t(locale, "userPrompt")}>
            <textarea
              value={config.userPrompt}
              rows={8}
              onBlur={onBlurAutoSave}
              onChange={event => onUpdateField("userPrompt", event.target.value)}
            />
          </Field>
        </div>

        <section className="variables">
          <strong>{t(locale, "promptVariables")}</strong>
          <code>{"{{targetLanguage}}"}</code>
          <code>{"{{sourceHtml}}"}</code>
          <code>{"{{sourceText}}"}</code>
        </section>
      </SettingsSection>
    </section>
  )
}

function ProviderEditor({
  provider,
  canRemove,
  testState,
  onBlur,
  onChange,
  onRemove,
  onTest,
  onCopyTestError,
  locale,
}: {
  provider: ProviderConfig
  canRemove: boolean
  testState: ProviderTestState
  onBlur: () => void
  onChange: <K extends keyof ProviderConfig>(key: K, value: ProviderConfig[K]) => void
  onRemove: () => void
  onTest: () => void
  onCopyTestError: () => void
  locale: UiLocale
}) {
  return (
    <section className="provider-editor">
      <div className="section-heading compact">
        <h3>{t(locale, "activeProviderTitle")}</h3>
        <div className="provider-actions">
          <button type="button" className="secondary-button" disabled={testState.status === "testing"} onClick={onTest}>
            {testState.status === "testing" ? t(locale, "testing") : t(locale, "testProvider")}
          </button>
          <button type="button" className="danger-button" disabled={!canRemove} onClick={onRemove}>
            {t(locale, "remove")}
          </button>
        </div>
      </div>

      {testState.status !== "idle" && (
        <section className={`provider-test ${testState.status}`}>
          <div>
            <strong>{t(locale, "providerTest")}</strong>
            <p>{testState.message}</p>
          </div>
          {testState.status === "error" && (
            <button type="button" className="secondary-button" onClick={onCopyTestError}>
              {t(locale, "copyError")}
            </button>
          )}
        </section>
      )}

      <div className="two-column">
        <Field label={t(locale, "providerName")}>
          <input
            value={provider.name}
            placeholder="OpenAI"
            onBlur={onBlur}
            onChange={event => onChange("name", event.target.value)}
          />
        </Field>

        <Field label={t(locale, "model")}>
          <input
            value={provider.model}
            placeholder="gpt-4o-mini"
            onBlur={onBlur}
            onChange={event => onChange("model", event.target.value)}
          />
        </Field>
      </div>

      <Field label={t(locale, "baseUrl")}>
        <input
          value={provider.baseUrl}
          placeholder="https://api.openai.com/v1"
          onBlur={onBlur}
          onChange={event => onChange("baseUrl", event.target.value)}
        />
      </Field>

      <Field label={t(locale, "apiKey")}>
        <input
          value={provider.apiKey}
          type="password"
          placeholder="sk-..."
          onBlur={onBlur}
          onChange={event => onChange("apiKey", event.target.value)}
        />
      </Field>
    </section>
  )
}

function progressPositionLabel(position: ProgressPosition, locale: UiLocale): string {
  switch (position) {
    case "bottom-center":
      return t(locale, "progressPositionBottomCenter")
    case "top-center":
      return t(locale, "progressPositionTopCenter")
    case "top-left":
      return t(locale, "progressPositionTopLeft")
    case "top-right":
      return t(locale, "progressPositionTopRight")
    case "bottom-left":
      return t(locale, "progressPositionBottomLeft")
    case "bottom-right":
      return t(locale, "progressPositionBottomRight")
  }
}
