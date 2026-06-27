import React, { useEffect, useMemo, useState } from "react"
import { createRoot } from "react-dom/client"
import { SUPPORTED_UI_LOCALES, resolveUiLocale, t, type UiLocale, type UiLocalePreference } from "@/shared/i18n"
import { sendRuntimeMessage } from "@/shared/messages"
import {
  DEFAULT_PROVIDER_CONFIG,
  DEFAULT_USER_CONFIG,
  PROGRESS_POSITIONS,
  getActiveProvider,
  type ProviderConfig,
  type ProgressPosition,
  type UserConfig,
} from "@/shared/types"
import "./style.css"

type ProviderTestState = {
  status: "idle" | "testing" | "success" | "error"
  message: string
}

function OptionsApp() {
  const [config, setConfig] = useState<UserConfig>(DEFAULT_USER_CONFIG)
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")
  const [saving, setSaving] = useState(false)
  const [providerTest, setProviderTest] = useState<ProviderTestState>({ status: "idle", message: "" })

  const activeProvider = useMemo(() => getActiveProvider(config), [config])
  const locale = useMemo(() => resolveUiLocale(config.uiLocale), [config.uiLocale])

  useEffect(() => {
    void sendRuntimeMessage("GET_CONFIG").then(setConfig)
  }, [])

  useEffect(() => {
    setProviderTest({ status: "idle", message: "" })
  }, [
    activeProvider.id,
    activeProvider.baseUrl,
    activeProvider.apiKey,
    activeProvider.model,
    config.targetLanguage,
    config.systemPrompt,
    config.userPrompt,
  ])

  function updateField<K extends keyof UserConfig>(key: K, value: UserConfig[K]) {
    setConfig(current => ({ ...current, [key]: value }))
  }

  function updateProviderField<K extends keyof ProviderConfig>(key: K, value: ProviderConfig[K]) {
    setConfig(current => ({
      ...current,
      providers: current.providers.map(provider =>
        provider.id === current.activeProviderId ? { ...provider, [key]: value } : provider,
      ),
    }))
  }

  function selectProvider(providerId: string) {
    setConfig(current => ({ ...current, activeProviderId: providerId }))
  }

  function addProvider() {
    const provider: ProviderConfig = {
      ...DEFAULT_PROVIDER_CONFIG,
      id: crypto.randomUUID(),
      name: `${t(locale, "providerFallback")} ${config.providers.length + 1}`,
      apiKey: "",
    }

    setConfig(current => ({
      ...current,
      providers: [...current.providers, provider],
      activeProviderId: provider.id,
    }))
  }

  function removeActiveProvider() {
    setConfig(current => {
      if (current.providers.length <= 1) {
        return current
      }

      const providers = current.providers.filter(provider => provider.id !== current.activeProviderId)
      return {
        ...current,
        providers,
        activeProviderId: providers[0].id,
      }
    })
  }

  async function save(event: React.FormEvent) {
    event.preventDefault()
    setMessage("")
    setError("")

    if (
      !activeProvider.name.trim()
      || !activeProvider.baseUrl.trim()
      || !activeProvider.model.trim()
      || !config.targetLanguage.trim()
    ) {
      setError(t(locale, "providerValidationError"))
      return
    }

    setSaving(true)
    try {
      const saved = await sendRuntimeMessage("SAVE_CONFIG", config)
      setConfig(saved)
      setMessage(t(locale, "settingsSaved"))
    }
    catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : String(saveError))
    }
    finally {
      setSaving(false)
    }
  }

  async function testActiveProvider() {
    setMessage("")
    setError("")
    setProviderTest({ status: "testing", message: t(locale, "testingProvider") })

    try {
      const response = await sendRuntimeMessage("TEST_PROVIDER", config)
      setProviderTest({ status: "success", message: response.message })
    }
    catch (testError) {
      setProviderTest({
        status: "error",
        message: testError instanceof Error ? testError.message : String(testError),
      })
    }
  }

  async function copyProviderTestError() {
    try {
      await navigator.clipboard.writeText(providerTest.message)
      setMessage(t(locale, "providerTestErrorCopied"))
    }
    catch (copyError) {
      setError(copyError instanceof Error ? copyError.message : String(copyError))
    }
  }

  return (
    <main className="settings-page">
      <section className="intro">
        <h1>{t(locale, "optionsTitle")}</h1>
        <p>
          {t(locale, "optionsIntro")}
        </p>
      </section>

      <form className="settings-form" onSubmit={save}>
        <section className="provider-section">
          <div className="section-heading">
            <div>
              <h2>{t(locale, "providersTitle")}</h2>
              <p>{t(locale, "providersDescription")}</p>
            </div>
            <button type="button" className="secondary-button" onClick={addProvider}>
              {t(locale, "addProvider")}
            </button>
          </div>

          <div className="provider-tabs">
            {config.providers.map(provider => (
              <button
                type="button"
                key={provider.id}
                className={provider.id === config.activeProviderId ? "provider-tab active" : "provider-tab"}
                onClick={() => selectProvider(provider.id)}
              >
                <strong>{provider.name || t(locale, "providerFallback")}</strong>
                <span>{provider.model || t(locale, "noModel")}</span>
              </button>
            ))}
          </div>
        </section>

        <ProviderEditor
          provider={activeProvider}
          canRemove={config.providers.length > 1}
          testState={providerTest}
          onChange={updateProviderField}
          onRemove={removeActiveProvider}
          onTest={testActiveProvider}
          onCopyTestError={copyProviderTestError}
          locale={locale}
        />

        <Field label={t(locale, "targetLanguage")}>
          <input
            value={config.targetLanguage}
            placeholder={t(locale, "targetLanguagePlaceholder")}
            onChange={event => updateField("targetLanguage", event.target.value)}
          />
        </Field>

        <Field label={t(locale, "interfaceLanguage")}>
          <select
            value={config.uiLocale}
            onChange={event => updateField("uiLocale", event.target.value as UiLocalePreference)}
          >
            <option value="auto">{t(locale, "automaticBrowserLanguage")}</option>
            {SUPPORTED_UI_LOCALES.map(option => (
              <option key={option.code} value={option.code}>
                {option.nativeName} · {option.englishName}
              </option>
            ))}
          </select>
        </Field>

        <Field label={t(locale, "progressPosition")}>
          <select
            value={config.progressPosition}
            onChange={event => updateField("progressPosition", event.target.value as ProgressPosition)}
          >
            {PROGRESS_POSITIONS.map(position => (
              <option key={position} value={position}>
                {progressPositionLabel(position, locale)}
              </option>
            ))}
          </select>
        </Field>

        <div className="two-column">
          <Field label={t(locale, "systemPrompt")}>
            <textarea
              value={config.systemPrompt}
              rows={8}
              onChange={event => updateField("systemPrompt", event.target.value)}
            />
          </Field>

          <Field label={t(locale, "userPrompt")}>
            <textarea
              value={config.userPrompt}
              rows={8}
              onChange={event => updateField("userPrompt", event.target.value)}
            />
          </Field>
        </div>

        <section className="variables">
          <strong>{t(locale, "promptVariables")}</strong>
          <code>{"{{targetLanguage}}"}</code>
          <code>{"{{sourceHtml}}"}</code>
          <code>{"{{sourceText}}"}</code>
        </section>

        {message && <p className="success">{message}</p>}
        {error && <p className="error">{error}</p>}

        <button type="submit" disabled={saving}>
          {saving ? t(locale, "saving") : t(locale, "saveSettings")}
        </button>
      </form>
    </main>
  )
}

function ProviderEditor({
  provider,
  canRemove,
  testState,
  onChange,
  onRemove,
  onTest,
  onCopyTestError,
  locale,
}: {
  provider: ProviderConfig
  canRemove: boolean
  testState: ProviderTestState
  onChange: <K extends keyof ProviderConfig>(key: K, value: ProviderConfig[K]) => void
  onRemove: () => void
  onTest: () => void
  onCopyTestError: () => void
  locale: UiLocale
}) {
  return (
    <section className="provider-editor">
      <div className="section-heading compact">
        <h2>{t(locale, "activeProviderTitle")}</h2>
        <div className="provider-actions">
          <button type="button" className="secondary-button" disabled={testState.status === "testing"} onClick={onTest}>
            {testState.status === "testing" ? t(locale, "testing") : t(locale, "testProvider")}
          </button>
          <button type="button" className="danger-button" disabled={!canRemove} onClick={onRemove}>
            {t(locale, "remove")}
          </button>
        </div>
      </div>

      <div className="two-column">
        <Field label={t(locale, "providerName")}>
          <input
            value={provider.name}
            placeholder="OpenAI"
            onChange={event => onChange("name", event.target.value)}
          />
        </Field>

        <Field label={t(locale, "model")}>
          <input
            value={provider.model}
            placeholder="gpt-4o-mini"
            onChange={event => onChange("model", event.target.value)}
          />
        </Field>
      </div>

      <Field label={t(locale, "baseUrl")}>
        <input
          value={provider.baseUrl}
          placeholder="https://api.openai.com/v1"
          onChange={event => onChange("baseUrl", event.target.value)}
        />
      </Field>

      <Field label={t(locale, "apiKey")}>
        <input
          value={provider.apiKey}
          type="password"
          placeholder="sk-..."
          onChange={event => onChange("apiKey", event.target.value)}
        />
      </Field>

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
    </section>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
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

createRoot(document.getElementById("root")!).render(<OptionsApp />)
