import { defineContentScript } from "#imports"
import { resolveUiLocale } from "@/shared/i18n"
import { isOpenReadMessage, messageError, sendRuntimeMessage, type OpenReadResponse } from "@/shared/messages"
import { CONFIG_STORAGE_KEY } from "@/shared/storage-keys"
import { InputTranslator } from "@/content/input-translator"
import { PageTranslator } from "@/content/page-translator"

declare global {
  interface Window {
    __OPENREAD_TRANSLATOR__?: PageTranslator
    __OPENREAD_INPUT_TRANSLATOR__?: InputTranslator
  }
}

export default defineContentScript({
  matches: ["*://*/*"],
  main() {
    const translator = window.__OPENREAD_TRANSLATOR__ ?? new PageTranslator()
    const inputTranslator = window.__OPENREAD_INPUT_TRANSLATOR__ ?? new InputTranslator()
    window.__OPENREAD_TRANSLATOR__ = translator
    window.__OPENREAD_INPUT_TRANSLATOR__ = inputTranslator
    inputTranslator.start()
    void refreshInputTranslatorConfig(inputTranslator)

    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName === "local" && CONFIG_STORAGE_KEY in changes) {
        void refreshInputTranslatorConfig(inputTranslator)
      }
    })

    chrome.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
      if (!isOpenReadMessage(message)) {
        return false
      }

      if (
        message.type !== "SET_PAGE_PROVIDER"
        && message.type !== "START_TRANSLATION"
        && message.type !== "STOP_TRANSLATION"
        && message.type !== "GET_PAGE_TRANSLATION_STATE"
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
            return translator.getState()
          case "START_TRANSLATION":
            inputTranslator.setPageProvider(
              message.payload.providerId,
              message.payload.uiLocale,
              message.payload.inputTranslationEnabled,
              message.payload.progressPosition,
            )
            return translator.start(message.payload)
          case "STOP_TRANSLATION":
            return translator.stop()
          case "GET_PAGE_TRANSLATION_STATE":
            return translator.getState()
        }
      })()
        .then(data => sendResponse({ ok: true, data } satisfies OpenReadResponse<unknown>))
        .catch(error => sendResponse({ ok: false, error: messageError(error) } satisfies OpenReadResponse<unknown>))

      return true
    })
  },
})

async function refreshInputTranslatorConfig(inputTranslator: InputTranslator): Promise<void> {
  try {
    const config = await sendRuntimeMessage("GET_CONFIG")
    inputTranslator.setPageProvider(
      config.activeProviderId,
      resolveUiLocale(config.uiLocale),
      config.inputTranslationEnabled,
      config.progressPosition,
    )
  }
  catch {
    // Keep the default local state on browser-owned pages or early runtime races.
  }
}
