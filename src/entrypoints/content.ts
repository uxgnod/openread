import { defineContentScript } from "#imports"
import { isOpenReadMessage, messageError, type OpenReadResponse } from "@/shared/messages"
import { PageTranslator } from "@/content/page-translator"

declare global {
  interface Window {
    __OPENREAD_TRANSLATOR__?: PageTranslator
  }
}

export default defineContentScript({
  matches: ["*://*/*"],
  main() {
    const translator = window.__OPENREAD_TRANSLATOR__ ?? new PageTranslator()
    window.__OPENREAD_TRANSLATOR__ = translator

    chrome.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
      if (!isOpenReadMessage(message)) {
        return false
      }

      if (
        message.type !== "START_TRANSLATION"
        && message.type !== "STOP_TRANSLATION"
        && message.type !== "GET_PAGE_TRANSLATION_STATE"
      ) {
        return false
      }

      void (async () => {
        switch (message.type) {
          case "START_TRANSLATION":
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
