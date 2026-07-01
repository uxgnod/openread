import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { createRoot } from "react-dom/client"
import { resolveUiLocale, t } from "@/shared/i18n"
import { sendRuntimeMessage } from "@/shared/messages"
import type { SiteRulePack } from "@/shared/site-rules"
import {
  DEFAULT_PROVIDER_CONFIG,
  DEFAULT_USER_CONFIG,
  getActiveProvider,
  type ProviderConfig,
  type UserConfig,
} from "@/shared/types"
import { BasicSettingsView, type ProviderTestState } from "./basic-settings-view"
import { optionsCopy } from "./options-copy"
import { Toast, type ToastState } from "./options-ui"
import { SiteRulesView } from "./rules-view"
import "./style.css"

type SettingsView = "basic" | "rules"

export function OptionsApp() {
  const [activeSettingsView, setActiveSettingsView] = useState<SettingsView>("basic")
  const [config, setConfig] = useState<UserConfig>(DEFAULT_USER_CONFIG)
  const [providerTest, setProviderTest] = useState<ProviderTestState>({ status: "idle", message: "" })
  const [toast, setToast] = useState<ToastState | null>(null)
  const [pendingAutoTestProviderIds, setPendingAutoTestProviderIds] = useState<Set<string>>(new Set())
  const [siteRules, setSiteRules] = useState<SiteRulePack[]>([])
  const [ruleSearchQuery, setRuleSearchQuery] = useState("")
  const toastTimerRef = useRef<number | undefined>(undefined)

  const activeProvider = useMemo(() => getActiveProvider(config), [config])
  const locale = useMemo(() => resolveUiLocale(config.uiLocale), [config.uiLocale])

  useEffect(() => {
    return () => {
      if (toastTimerRef.current !== undefined) {
        window.clearTimeout(toastTimerRef.current)
      }
    }
  }, [])

  const showToast = useCallback((nextToast: ToastState): void => {
    if (toastTimerRef.current !== undefined) {
      window.clearTimeout(toastTimerRef.current)
    }
    setToast(nextToast)
    toastTimerRef.current = window.setTimeout(() => {
      setToast(null)
      toastTimerRef.current = undefined
    }, nextToast.type === "error" ? 5200 : 2600)
  }, [])

  const loadSiteRules = useCallback(async (): Promise<void> => {
    try {
      setSiteRules(await sendRuntimeMessage("GET_SITE_RULES"))
    }
    catch (error) {
      showToast({
        type: "error",
        message: error instanceof Error ? error.message : String(error),
      })
    }
  }, [showToast])

  useEffect(() => {
    void sendRuntimeMessage("GET_CONFIG").then(setConfig)
    void loadSiteRules()
  }, [loadSiteRules])

  useEffect(() => {
    if (activeSettingsView === "rules") {
      void loadSiteRules()
    }
  }, [activeSettingsView, loadSiteRules])

  function validateConfig(nextConfig: UserConfig): string | null {
    const provider = getActiveProvider(nextConfig)
    if (
      !provider.name.trim()
      || !provider.baseUrl.trim()
      || !provider.model.trim()
      || !nextConfig.targetLanguage.trim()
    ) {
      return t(locale, "providerValidationError")
    }
    return null
  }

  async function autoSave(nextConfig: UserConfig, options: { providerIdToAutoTest?: string } = {}): Promise<void> {
    const validationError = validateConfig(nextConfig)
    if (validationError) {
      showToast({ type: "error", message: validationError })
      return
    }

    try {
      const saved = await sendRuntimeMessage("SAVE_CONFIG", nextConfig)
      setConfig(saved)
      showToast({ type: "success", message: t(locale, "settingsSaved") })
      await maybeAutoTestProvider(saved, options.providerIdToAutoTest)
    }
    catch (error) {
      showToast({ type: "error", message: error instanceof Error ? error.message : String(error) })
    }
  }

  async function maybeAutoTestProvider(saved: UserConfig, providerId?: string): Promise<void> {
    if (!providerId || !pendingAutoTestProviderIds.has(providerId)) {
      return
    }

    const provider = saved.providers.find(candidate => candidate.id === providerId)
    if (!provider || !isProviderReadyForTest(saved, provider)) {
      return
    }

    setPendingAutoTestProviderIds(current => {
      const next = new Set(current)
      next.delete(providerId)
      return next
    })
    await runProviderTest(saved, providerId)
  }

  function updateField<K extends keyof UserConfig>(key: K, value: UserConfig[K], saveNow = false): void {
    const nextConfig = { ...config, [key]: value }
    setConfig(nextConfig)
    if (saveNow) {
      void autoSave(nextConfig)
    }
  }

  function updateProviderField<K extends keyof ProviderConfig>(key: K, value: ProviderConfig[K]): void {
    setConfig({
      ...config,
      providers: config.providers.map(provider =>
        provider.id === config.activeProviderId ? { ...provider, [key]: value } : provider,
      ),
    })
  }

  function selectProvider(providerId: string): void {
    updateField("activeProviderId", providerId, true)
    setProviderTest({ status: "idle", message: "" })
  }

  function addProvider(): void {
    const provider: ProviderConfig = {
      ...DEFAULT_PROVIDER_CONFIG,
      id: crypto.randomUUID(),
      name: `${t(locale, "providerFallback")} ${config.providers.length + 1}`,
      apiKey: "",
    }
    const nextConfig = {
      ...config,
      providers: [...config.providers, provider],
      activeProviderId: provider.id,
    }

    setPendingAutoTestProviderIds(current => new Set([...current, provider.id]))
    setProviderTest({ providerId: provider.id, status: "idle", message: "" })
    setConfig(nextConfig)
  }

  function removeActiveProvider(): void {
    if (config.providers.length <= 1) {
      return
    }

    const providers = config.providers.filter(provider => provider.id !== config.activeProviderId)
    const nextConfig = {
      ...config,
      providers,
      activeProviderId: providers[0].id,
    }
    setPendingAutoTestProviderIds(current => {
      const next = new Set(current)
      next.delete(config.activeProviderId)
      return next
    })
    setProviderTest({ status: "idle", message: "" })
    setConfig(nextConfig)
    void autoSave(nextConfig)
  }

  function saveActiveProviderOnBlur(): void {
    void autoSave(config, { providerIdToAutoTest: activeProvider.id })
  }

  async function testActiveProvider(): Promise<void> {
    await runProviderTest(config, activeProvider.id)
  }

  async function runProviderTest(nextConfig: UserConfig, providerId: string): Promise<void> {
    setProviderTest({ providerId, status: "testing", message: t(locale, "testingProvider") })

    try {
      const response = await sendRuntimeMessage("TEST_PROVIDER", {
        ...nextConfig,
        activeProviderId: providerId,
      })
      setProviderTest({ providerId, status: "success", message: response.message })
    }
    catch (testError) {
      setProviderTest({
        providerId,
        status: "error",
        message: testError instanceof Error ? testError.message : String(testError),
      })
    }
  }

  async function copyProviderTestError(): Promise<void> {
    try {
      await navigator.clipboard.writeText(providerTest.message)
      showToast({ type: "success", message: t(locale, "providerTestErrorCopied") })
    }
    catch (copyError) {
      showToast({ type: "error", message: copyError instanceof Error ? copyError.message : String(copyError) })
    }
  }

  return (
    <main className="settings-page">
      {toast && <Toast toast={toast} />}

      <aside className="settings-sidebar">
        <section className="intro">
          <h1>{t(locale, "optionsTitle")}</h1>
        </section>
        <nav className="settings-nav" aria-label="OpenRead settings">
          <button
            type="button"
            className={activeSettingsView === "basic" ? "settings-nav-button active" : "settings-nav-button"}
            onClick={() => setActiveSettingsView("basic")}
          >
            {optionsCopy(locale, "basicSettings")}
          </button>
          <button
            type="button"
            className={activeSettingsView === "rules" ? "settings-nav-button active" : "settings-nav-button"}
            onClick={() => setActiveSettingsView("rules")}
          >
            {optionsCopy(locale, "translationRules")}
          </button>
        </nav>
      </aside>

      {activeSettingsView === "basic"
        ? (
            <BasicSettingsView
              activeProvider={activeProvider}
              config={config}
              locale={locale}
              providerTest={providerTest.providerId === activeProvider.id ? providerTest : { status: "idle", message: "" }}
              onAddProvider={addProvider}
              onBlurAutoSave={() => void autoSave(config, { providerIdToAutoTest: activeProvider.id })}
              onCopyProviderTestError={copyProviderTestError}
              onProviderBlur={saveActiveProviderOnBlur}
              onProviderChange={updateProviderField}
              onProviderSelect={selectProvider}
              onProviderTest={testActiveProvider}
              onRemoveProvider={removeActiveProvider}
              onUpdateField={updateField}
            />
          )
        : (
            <SiteRulesView
              locale={locale}
              query={ruleSearchQuery}
              rules={siteRules}
              onQueryChange={setRuleSearchQuery}
            />
          )}
    </main>
  )
}

function isProviderReadyForTest(config: UserConfig, provider: ProviderConfig): boolean {
  return Boolean(
    provider.baseUrl.trim()
    && provider.model.trim()
    && provider.apiKey.trim()
    && config.targetLanguage.trim()
  )
}

const root = document.getElementById("root")
if (root) {
  createRoot(root).render(<OptionsApp />)
}
