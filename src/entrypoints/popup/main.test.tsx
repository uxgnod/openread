import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { DEFAULT_USER_CONFIG, type PageTranslationState, type UserConfig } from "@/shared/types"
import { PopupApp } from "./main"

describe("PopupApp site-rule status", () => {
  let config: UserConfig
  let runtimeSendMessage: ReturnType<typeof vi.fn>
  let tabSendMessage: ReturnType<typeof vi.fn>

  beforeEach(() => {
    config = {
      ...DEFAULT_USER_CONFIG,
      providers: [{
        id: "openai-default",
        name: "OpenAI",
        baseUrl: "https://api.openai.com/v1",
        apiKey: "sk-existing",
        model: "gpt-4o-mini",
      }],
    }
    runtimeSendMessage = vi.fn(async (message: { type: string }) => {
      if (message.type === "GET_CONFIG") {
        return { ok: true, data: config }
      }
      return { ok: true, data: {} }
    })
    tabSendMessage = vi.fn(async (_tabId: number, message: { payload?: unknown; type: string }) => {
      if (message.type === "GET_PAGE_TRANSLATION_STATE") {
        return { ok: true, data: idleState() }
      }
      if (message.type === "GET_PAGE_SITE_RULE_STATUS") {
        return {
          ok: true,
          data: {
            hasRule: true,
            ruleId: "github-readme",
            ruleName: "GitHub README",
            scopeKind: "same-page-type",
          },
        }
      }
      if (message.type === "START_TRANSLATION") {
        return { ok: true, data: { ...idleState(), isActive: true, providerId: "openai-default" } }
      }
      return { ok: true, data: idleState() }
    })
    vi.stubGlobal("chrome", {
      i18n: { getUILanguage: () => "en" },
      runtime: {
        getURL: (path: string) => `chrome-extension://openread/${path}`,
        sendMessage: runtimeSendMessage,
      },
      tabs: {
        create: vi.fn(),
        query: vi.fn(async () => [{ id: 123 }]),
        sendMessage: tabSendMessage,
      },
    })
  })

  it("shows the matching site rule for the current page", async () => {
    render(<PopupApp />)

    expect(await screen.findByText("Rule available · GitHub README")).toBeInTheDocument()
  })

  it("falls back to generic rules when the page has no matching rule status", async () => {
    tabSendMessage.mockImplementation(async (_tabId: number, message: { type: string }) => {
      if (message.type === "GET_PAGE_SITE_RULE_STATUS") {
        return { ok: false, error: "No content script response." }
      }
      if (message.type === "GET_PAGE_TRANSLATION_STATE") {
        return { ok: true, data: idleState() }
      }
      return { ok: true, data: idleState() }
    })

    render(<PopupApp />)

    expect(await screen.findByText("Use generic rules")).toBeInTheDocument()
  })

  it("starts page translation without passing a popup-selected rule id", async () => {
    render(<PopupApp />)

    fireEvent.click(await screen.findByRole("button", { name: "Translate page" }))

    await waitFor(() => {
      expect(tabSendMessage).toHaveBeenCalledWith(123, expect.objectContaining({
        payload: expect.not.objectContaining({ siteRuleId: expect.any(String) }),
        type: "START_TRANSLATION",
      }))
    })
  })
})

function idleState(): PageTranslationState {
  return {
    isActive: false,
    pendingCount: 0,
    providerId: "openai-default",
    remainingCount: 0,
    totalCount: 0,
    translatedCount: 0,
  }
}
