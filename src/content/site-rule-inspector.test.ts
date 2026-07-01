import { waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { SITE_RULE_SCHEMA_VERSION, type SiteRulePack } from "@/shared/site-rules"
import { SiteRuleInspector } from "./site-rule-inspector"

describe("SiteRuleInspector", () => {
  afterEach(() => {
    document.body.innerHTML = ""
    document.querySelectorAll("[class*='openread-site-rule-inspector'],#openread-site-rule-inspector-style")
      .forEach(node => node.remove())
    vi.unstubAllGlobals()
  })

  it("selects page regions, previews them, and saves a rule", async () => {
    window.history.replaceState({}, "", "/articles/one")
    document.body.innerHTML = `
      <main>
        <article id="readme"><p>Readable article content should be selected for translation.</p></article>
      </main>
    `
    const sendMessage = vi.fn(async (message: { payload?: unknown; type: string }) => {
      if (message.type === "SAVE_SITE_RULE") {
        return { ok: true, data: message.payload }
      }
      return { ok: true, data: {} }
    })
    vi.stubGlobal("chrome", {
      runtime: { sendMessage },
      i18n: { getUILanguage: () => "en" },
    })

    const inspector = new SiteRuleInspector()
    await inspector.start({ uiLocale: "en" })
    document.getElementById("readme")?.dispatchEvent(new MouseEvent("click", {
      bubbles: true,
      cancelable: true,
    }))

    const panel = document.querySelector<HTMLElement>(".openread-site-rule-inspector")
    expect(panel?.textContent).toContain("Will translate 1 text blocks")

    const saveButton = [...panel!.querySelectorAll("button")]
      .find(button => button.textContent === "Save rule")
    saveButton?.click()
    await Promise.resolve()

    expect(sendMessage).toHaveBeenCalledWith(expect.objectContaining({
      payload: expect.objectContaining({
        regions: [expect.objectContaining({ rootSelectors: ["#readme"] })],
      }),
      type: "SAVE_SITE_RULE",
    }))

    inspector.stop()
  })

  it("loads the current rule, marks selected translation regions, preserves excludes, and exits after save", async () => {
    window.history.replaceState({}, "", "/rails/rails")
    document.body.innerHTML = `
      <main>
        <article id="readme"><p>Readable README content should be selected.</p></article>
        <aside id="summary"><p>Repository summary should be added.</p></aside>
      </main>
    `
    const refreshSiteRule = vi.fn(async () => ({ isActive: false }))
    window.__OPENREAD_TRANSLATOR__ = { refreshSiteRule } as never
    const sendMessage = vi.fn(async (message: { payload?: unknown; type: string }) => {
      if (message.type === "GET_SITE_RULES") {
        return { ok: true, data: [siteRule()] }
      }
      if (message.type === "SAVE_SITE_RULE") {
        return { ok: true, data: message.payload }
      }
      return { ok: true, data: {} }
    })
    vi.stubGlobal("chrome", {
      runtime: { sendMessage },
      i18n: { getUILanguage: () => "en" },
    })

    const inspector = new SiteRuleInspector()
    await inspector.start({ uiLocale: "en" })

    expect(document.querySelectorAll(".openread-site-rule-inspector__selected-highlight")).toHaveLength(1)
    expect(document.body.textContent).not.toContain("Excluded regions")
    expect(document.documentElement.textContent).toContain("Translation region")

    document.getElementById("summary")?.dispatchEvent(new MouseEvent("click", {
      bubbles: true,
      cancelable: true,
    }))
    expect(document.querySelectorAll(".openread-site-rule-inspector__selected-highlight")).toHaveLength(2)

    const panel = document.querySelector<HTMLElement>(".openread-site-rule-inspector")
    const saveButton = [...panel!.querySelectorAll("button")]
      .find(button => button.textContent === "Save rule")
    saveButton?.click()

    await waitFor(() => {
      expect(sendMessage).toHaveBeenCalledWith(expect.objectContaining({
        payload: expect.objectContaining({
          excludes: [{ label: "Ads", selectors: [".ad"] }],
          id: "github-readme",
          regions: [
            expect.objectContaining({ rootSelectors: ["#readme"] }),
            expect.objectContaining({ rootSelectors: ["#summary"] }),
          ],
        }),
        type: "SAVE_SITE_RULE",
      }))
      expect(refreshSiteRule).toHaveBeenCalledOnce()
      expect(document.querySelector(".openread-site-rule-inspector")).toBeNull()
      expect(document.documentElement.textContent).toContain("Rule saved.")
    })
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
        host: "localhost",
        pathPatterns: ["/:owner/:repo"],
      },
      pageTraits: [{ selector: "#readme", required: true }],
    },
    regions: [{
      id: "readme",
      label: "README",
      action: "translate",
      mode: "auto",
      rootSelectors: ["#readme"],
      blockSelectors: ["p"],
    }],
    excludes: [{ label: "Ads", selectors: [".ad"] }],
    metadata: {
      createdBy: "manual",
      humanRegionSummary: "README",
      humanScopeSummary: "Same page type",
    },
    createdAt: 1,
    updatedAt: 1,
  }
}
