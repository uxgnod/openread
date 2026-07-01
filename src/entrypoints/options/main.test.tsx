import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { SITE_RULE_SCHEMA_VERSION, type SiteRulePack } from "@/shared/site-rules"
import { DEFAULT_USER_CONFIG, type UserConfig } from "@/shared/types"
import { OptionsApp } from "./main"

describe("OptionsApp", () => {
  let sendMessage: ReturnType<typeof vi.fn>
  let config: UserConfig
  let siteRules: SiteRulePack[]

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
    siteRules = []
    sendMessage = vi.fn(async (message: { payload?: unknown; type: string }) => {
      switch (message.type) {
        case "GET_CONFIG":
          return { ok: true, data: config }
        case "GET_SITE_RULES":
          return { ok: true, data: siteRules }
        case "SAVE_CONFIG":
          config = message.payload as UserConfig
          return { ok: true, data: config }
        case "TEST_PROVIDER":
          return { ok: true, data: { providerId: (message.payload as UserConfig).activeProviderId, message: "Provider responded successfully." } }
        default:
          return { ok: true, data: {} }
      }
    })
    vi.stubGlobal("chrome", {
      i18n: { getUILanguage: () => "en" },
      runtime: { sendMessage },
    })
    vi.stubGlobal("crypto", {
      randomUUID: vi.fn(() => "new-provider-id"),
    })
  })

  it("renders sidebar navigation and switches to the rules view", async () => {
    siteRules = [siteRule()]
    render(<OptionsApp />)

    expect(await screen.findByRole("heading", { name: "OpenRead Settings" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Basic settings" })).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Translation rules" }))

    expect(await screen.findByText("github.com")).toBeInTheDocument()
    expect(screen.getByText("GitHub README")).toBeInTheDocument()
  })

  it("autosaves text fields on blur and shows a toast", async () => {
    render(<OptionsApp />)
    const input = await screen.findByLabelText("Target language")

    fireEvent.change(input, { target: { value: "Traditional Chinese" } })
    fireEvent.blur(input)

    await waitFor(() => {
      expect(sendMessage).toHaveBeenCalledWith(expect.objectContaining({
        payload: expect.objectContaining({ targetLanguage: "Traditional Chinese" }),
        type: "SAVE_CONFIG",
      }))
    })
    expect(await screen.findByText("Settings saved.")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Save settings" })).not.toBeInTheDocument()
  })

  it("shows save errors in a toast", async () => {
    sendMessage.mockImplementation(async (message: { type: string }) => {
      if (message.type === "GET_CONFIG") {
        return { ok: true, data: config }
      }
      if (message.type === "GET_SITE_RULES") {
        return { ok: true, data: [] }
      }
      if (message.type === "SAVE_CONFIG") {
        return { ok: false, error: "Save failed." }
      }
      return { ok: true, data: {} }
    })
    render(<OptionsApp />)
    const input = await screen.findByLabelText("Target language")

    fireEvent.change(input, { target: { value: "Japanese" } })
    fireEvent.blur(input)

    expect(await screen.findByText("Save failed.")).toBeInTheDocument()
  })

  it("saves select and switch changes immediately", async () => {
    render(<OptionsApp />)

    fireEvent.change(await screen.findByLabelText("Progress position"), { target: { value: "top-right" } })
    fireEvent.click(screen.getByLabelText("Triple-space input translation"))

    await waitFor(() => {
      expect(sendMessage).toHaveBeenCalledWith(expect.objectContaining({
        payload: expect.objectContaining({ progressPosition: "top-right" }),
        type: "SAVE_CONFIG",
      }))
      expect(sendMessage).toHaveBeenCalledWith(expect.objectContaining({
        payload: expect.objectContaining({ inputTranslationEnabled: false }),
        type: "SAVE_CONFIG",
      }))
    })
  })

  it("auto-tests a newly added provider once after it is ready and saved", async () => {
    render(<OptionsApp />)

    fireEvent.click(await screen.findByRole("button", { name: "Add provider" }))
    fireEvent.change(screen.getByLabelText("API Key"), { target: { value: "sk-new" } })
    fireEvent.blur(screen.getByLabelText("API Key"))

    await waitFor(() => {
      expect(sendMessage.mock.calls.filter(([message]) => message.type === "TEST_PROVIDER")).toHaveLength(1)
    })
    expect(await screen.findByText("Provider responded successfully.")).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText("Provider name"), { target: { value: "OpenAI Updated" } })
    fireEvent.blur(screen.getByLabelText("Provider name"))

    await waitFor(() => {
      expect(sendMessage.mock.calls.filter(([message]) => message.type === "SAVE_CONFIG").length).toBeGreaterThanOrEqual(2)
    })
    expect(sendMessage.mock.calls.filter(([message]) => message.type === "TEST_PROVIDER")).toHaveLength(1)
  })

  it("filters rules by metadata and shows an empty match state", async () => {
    siteRules = [siteRule()]
    render(<OptionsApp />)
    fireEvent.click(await screen.findByRole("button", { name: "Translation rules" }))

    fireEvent.change(await screen.findByLabelText("Search rules"), { target: { value: "repository description" } })
    expect(await screen.findByText("GitHub README")).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText("Search rules"), { target: { value: "substack" } })
    expect(await screen.findByText("No matching rules")).toBeInTheDocument()
  })
})

function siteRule(): SiteRulePack {
  return {
    schemaVersion: SITE_RULE_SCHEMA_VERSION,
    id: "github-readme",
    name: "GitHub README",
    enabled: true,
    priority: 10,
    scope: {
      kind: "same-page-type",
      label: "GitHub repository home",
      url: {
        host: "github.com",
        pathPatterns: ["/:owner/:repo"],
        excludePathPatterns: ["/:owner/:repo/blob/*"],
      },
    },
    regions: [{
      id: "readme",
      action: "translate",
      mode: "auto",
      rootSelectors: ["#readme"],
      blockSelectors: ["p"],
    }],
    excludes: [{ label: "Navigation", selectors: ["header", "nav"] }],
    metadata: {
      humanRegionSummary: "README and repository description",
      humanScopeSummary: "GitHub repository home pages",
    },
    createdAt: 1,
    updatedAt: 1,
  }
}
