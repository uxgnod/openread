import { defineContentScript } from "#imports"
import { resolveUiLocale } from "@/shared/i18n"
import { isOpenReadMessage, messageError, sendRuntimeMessage, type OpenReadResponse } from "@/shared/messages"
import { CONFIG_STORAGE_KEY } from "@/shared/storage-keys"
import { InputTranslator } from "@/content/input-translator"
import { PageTranslator } from "@/content/page-translator"
import { SelectionTranslator } from "@/content/selection-translator"
import { SiteRuleInspector } from "@/content/site-rule-inspector"
import {
  explainRuleMatch,
  getCurrentPageContext,
  inspectElement,
  previewRule,
  selectRuleForCurrentPage,
  snapshotPageStructure,
} from "@/content/site-rule-engine"
import type { PageSiteRuleStatus } from "@/shared/site-rules"

declare global {
  interface Window {
    __OPENREAD_TRANSLATOR__?: PageTranslator
    __OPENREAD_INPUT_TRANSLATOR__?: InputTranslator
    __OPENREAD_SELECTION_TRANSLATOR__?: SelectionTranslator
    __OPENREAD_SITE_RULE_INSPECTOR__?: SiteRuleInspector
  }
}

export default defineContentScript({
  matches: ["*://*/*"],
  main() {
    const translator = window.__OPENREAD_TRANSLATOR__ ?? new PageTranslator()
    const inputTranslator = window.__OPENREAD_INPUT_TRANSLATOR__ ?? new InputTranslator()
    const selectionTranslator = window.__OPENREAD_SELECTION_TRANSLATOR__ ?? new SelectionTranslator()
    const siteRuleInspector = window.__OPENREAD_SITE_RULE_INSPECTOR__ ?? new SiteRuleInspector()
    window.__OPENREAD_TRANSLATOR__ = translator
    window.__OPENREAD_INPUT_TRANSLATOR__ = inputTranslator
    window.__OPENREAD_SELECTION_TRANSLATOR__ = selectionTranslator
    window.__OPENREAD_SITE_RULE_INSPECTOR__ = siteRuleInspector
    inputTranslator.start()
    selectionTranslator.start()
    void refreshContentTranslatorConfig(inputTranslator, selectionTranslator)

    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName === "local" && CONFIG_STORAGE_KEY in changes) {
        void refreshContentTranslatorConfig(inputTranslator, selectionTranslator)
      }
    })

    chrome.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
      if (!isOpenReadMessage(message)) {
        return false
      }

      if (
        message.type !== "SET_PAGE_PROVIDER"
        && message.type !== "START_RULE_SELECTION"
        && message.type !== "START_TRANSLATION"
        && message.type !== "START_TRANSLATION_WITH_INLINE_RULE"
        && message.type !== "START_TRANSLATION_WITH_RULE"
        && message.type !== "OPEN_SELECTION_TRANSLATION"
        && message.type !== "GET_CURRENT_PAGE_CONTEXT"
        && message.type !== "STOP_TRANSLATION"
        && message.type !== "STOP_RULE_SELECTION"
        && message.type !== "GET_PAGE_TRANSLATION_STATE"
        && message.type !== "GET_PAGE_SITE_RULE_STATUS"
        && message.type !== "SNAPSHOT_PAGE_STRUCTURE"
        && message.type !== "INSPECT_ELEMENT"
        && message.type !== "PREVIEW_SITE_RULE"
        && message.type !== "EXPLAIN_SITE_RULE_MATCH"
      ) {
        return false
      }

      void (async () => {
        switch (message.type) {
          case "SET_PAGE_PROVIDER":
            translator.setProviderId(message.payload.providerId)
            inputTranslator.setPageProvider(
              message.payload.providerId,
              message.payload.uiLocale,
              message.payload.inputTranslationEnabled,
              message.payload.progressPosition,
            )
            selectionTranslator.setPageProvider(message.payload.providerId, message.payload.uiLocale)
            return translator.getState()
          case "START_TRANSLATION":
            inputTranslator.setPageProvider(
              message.payload.providerId,
              message.payload.uiLocale,
              message.payload.inputTranslationEnabled,
              message.payload.progressPosition,
            )
            selectionTranslator.setPageProvider(message.payload.providerId, message.payload.uiLocale)
            return translator.start(message.payload)
          case "START_TRANSLATION_WITH_RULE":
            return translator.start(message.payload)
          case "START_TRANSLATION_WITH_INLINE_RULE":
            return translator.start(message.payload)
          case "START_RULE_SELECTION":
            if (message.payload.providerId) {
              translator.setProviderId(message.payload.providerId)
            }
            return siteRuleInspector.start(message.payload)
          case "OPEN_SELECTION_TRANSLATION":
            return selectionTranslator.openSelectionTranslation(message.payload)
          case "GET_CURRENT_PAGE_CONTEXT":
            return getCurrentPageContext()
          case "SNAPSHOT_PAGE_STRUCTURE":
            return snapshotPageStructure(message.payload)
          case "INSPECT_ELEMENT":
            return inspectElement(message.payload)
          case "PREVIEW_SITE_RULE":
            return previewRule(message.payload.rule)
          case "EXPLAIN_SITE_RULE_MATCH":
            return explainRuleMatch(message.payload.rule)
          case "STOP_RULE_SELECTION":
            return siteRuleInspector.stop()
          case "STOP_TRANSLATION":
            return translator.stop()
          case "GET_PAGE_TRANSLATION_STATE":
            return translator.getState()
          case "GET_PAGE_SITE_RULE_STATUS":
            return getPageSiteRuleStatus()
        }
      })()
        .then(data => sendResponse({ ok: true, data } satisfies OpenReadResponse<unknown>))
        .catch(error => sendResponse({ ok: false, error: messageError(error) } satisfies OpenReadResponse<unknown>))

      return true
    })
  },
})

async function getPageSiteRuleStatus(): Promise<PageSiteRuleStatus> {
  const rule = selectRuleForCurrentPage(await sendRuntimeMessage("GET_SITE_RULES"))
  if (!rule) {
    return { hasRule: false }
  }
  return {
    hasRule: true,
    ruleId: rule.id,
    ruleName: rule.name,
    scopeKind: rule.scope.kind,
  }
}

async function refreshContentTranslatorConfig(
  inputTranslator: InputTranslator,
  selectionTranslator: SelectionTranslator,
): Promise<void> {
  try {
    const config = await sendRuntimeMessage("GET_CONFIG")
    const uiLocale = resolveUiLocale(config.uiLocale)
    inputTranslator.setPageProvider(
      config.activeProviderId,
      uiLocale,
      config.inputTranslationEnabled,
      config.progressPosition,
    )
    selectionTranslator.setPageProvider(config.activeProviderId, uiLocale)
  }
  catch {
    // Keep the default local state on browser-owned pages or early runtime races.
  }
}
