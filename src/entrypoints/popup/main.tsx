import React, { useCallback, useEffect, useMemo, useState } from "react"
import { createRoot } from "react-dom/client"
import { resolveUiLocale, t } from "@/shared/i18n"
import { sendRuntimeMessage, sendTabMessage } from "@/shared/messages"
import { getProviderById, type PageTranslationState, type UserConfig } from "@/shared/types"
import "./style.css"

function PopupApp() {
  const [config, setConfig] = useState<UserConfig | null>(null)
  const [status, setStatus] = useState<PageTranslationState | null>(null)
  const [message, setMessage] = useState("")
  const [busy, setBusy] = useState(false)
  const [selectedProviderId, setSelectedProviderId] = useState("")
  const locale = useMemo(() => resolveUiLocale(config?.uiLocale ?? "auto"), [config?.uiLocale])

  const selectedProvider = useMemo(() => {
    return config ? getProviderById(config, selectedProviderId) : null
  }, [config, selectedProviderId])
  const isReady = useMemo(() => {
    return Boolean(
      config?.targetLanguage
      && selectedProvider?.baseUrl
      && selectedProvider.model
      && selectedProvider.apiKey,
    )
  }, [config, selectedProvider])

  const syncPageProvider = useCallback(async (providerId: string) => {
    try {
      const tab = await getActiveTab()
      if (tab?.id) {
        await sendTabMessage(tab.id, "SET_PAGE_PROVIDER", {
          providerId,
          inputTranslationEnabled: config?.inputTranslationEnabled ?? true,
          progressPosition: config?.progressPosition ?? "bottom-center",
          uiLocale: locale,
        })
      }
    }
    catch {
      // Browser-owned pages may not have a content script. Translation actions
      // still surface real failures when the user explicitly starts them.
    }
  }, [config?.inputTranslationEnabled, config?.progressPosition, locale])

  useEffect(() => {
    void refresh()
  }, [])

  useEffect(() => {
    if (!config || !selectedProviderId || status?.isActive) {
      return
    }

    void syncPageProvider(selectedProviderId)
  }, [config, selectedProviderId, status?.isActive, syncPageProvider])

  async function refresh() {
    const nextConfig = await sendRuntimeMessage("GET_CONFIG")
    setConfig(nextConfig)

    const tab = await getActiveTab()
    let nextStatus: PageTranslationState | null = null
    if (tab?.id) {
      try {
        nextStatus = await sendTabMessage(tab.id, "GET_PAGE_TRANSLATION_STATE")
        setStatus(nextStatus)
      }
      catch {
        setStatus(null)
      }
    }

    setSelectedProviderId(nextStatus?.providerId ?? nextConfig.activeProviderId ?? nextConfig.providers[0]?.id ?? "")
  }

  async function translatePage() {
    await runTabAction("START_TRANSLATION")
  }

  async function stopTranslation() {
    await runTabAction("STOP_TRANSLATION")
  }

  async function runTabAction(type: "START_TRANSLATION" | "STOP_TRANSLATION") {
    setBusy(true)
    setMessage("")
    try {
      const tab = await getActiveTab()
      if (!tab?.id) {
        throw new Error(t(locale, "noActiveTabFound"))
      }
      const nextStatus = type === "START_TRANSLATION"
        ? await sendTabMessage(tab.id, type, {
            providerId: selectedProviderId,
            inputTranslationEnabled: config?.inputTranslationEnabled ?? true,
            progressPosition: config?.progressPosition ?? "bottom-center",
            uiLocale: locale,
          })
        : await sendTabMessage(tab.id, type)
      setStatus(nextStatus)
    }
    catch (error) {
      setMessage(error instanceof Error ? error.message : String(error))
    }
    finally {
      setBusy(false)
    }
  }

  async function openSettings() {
    await chrome.tabs.create({ url: chrome.runtime.getURL("options.html") })
  }

  return (
    <main className="popup-shell">
      <header className="popup-header">
        <div>
          <h1>OpenRead</h1>
          <p>{t(locale, "appTagline")}</p>
        </div>
        <span className={isReady ? "status-dot ready" : "status-dot"} />
      </header>

      <section className="status-panel">
        <div>
          <span className="label">{t(locale, "provider")}</span>
          <strong>{selectedProvider?.name || t(locale, "notConfigured")}</strong>
        </div>
        {config && (
          <label className="provider-select">
            <span className="label">{t(locale, "useForThisPage")}</span>
            <select
              value={selectedProviderId}
              disabled={busy || status?.isActive}
              onChange={event => {
                const providerId = event.target.value
                setSelectedProviderId(providerId)
                void syncPageProvider(providerId)
              }}
            >
              {config.providers.map(provider => (
                <option key={provider.id} value={provider.id}>
                  {provider.name} · {provider.model || t(locale, "noModel")}
                </option>
              ))}
            </select>
          </label>
        )}
        <div>
          <span className="label">{t(locale, "target")}</span>
          <strong>{config?.targetLanguage || t(locale, "notConfigured")}</strong>
        </div>
        <div>
          <span className="label">{t(locale, "page")}</span>
          <strong>
            {status?.isActive
              ? t(locale, "pageActive", { translated: status.translatedCount, total: status.totalCount })
              : t(locale, "idle")}
          </strong>
        </div>
      </section>

      {!isReady && (
        <p className="warning">{t(locale, "readinessWarning")}</p>
      )}

      {message && <p className="error">{message}</p>}

      <div className="actions">
        <button type="button" disabled={busy || !isReady} onClick={translatePage}>
          {t(locale, "translatePage")}
        </button>
        <button type="button" disabled={busy} className="secondary" onClick={stopTranslation}>
          {t(locale, "stop")}
        </button>
        <button type="button" className="ghost" onClick={openSettings}>
          {t(locale, "openSettings")}
        </button>
      </div>
    </main>
  )
}

async function getActiveTab(): Promise<chrome.tabs.Tab | undefined> {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true })
  return tabs[0]
}

createRoot(document.getElementById("root")!).render(<PopupApp />)
