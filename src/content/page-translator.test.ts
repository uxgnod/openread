import { beforeEach, describe, expect, it, vi } from "vitest"
import { SITE_RULE_SCHEMA_VERSION, type SiteRulePack } from "@/shared/site-rules"
import { PageTranslator } from "./page-translator"

describe("PageTranslator site rules", () => {
  beforeEach(() => {
    window.history.replaceState({}, "", "/articles/one")
  })

  it("uses matching site-rule candidates instead of generic page candidates", async () => {
    const observed: HTMLElement[] = []
    vi.stubGlobal("IntersectionObserver", class {
      constructor() {}
      disconnect() {}
      observe(element: HTMLElement) {
        observed.push(element)
      }
      unobserve() {}
    })
    vi.stubGlobal("chrome", {
      runtime: {
        sendMessage: vi.fn(async (message: { type: string }) => {
          if (message.type === "GET_SITE_RULES") {
            return { ok: true, data: [siteRule()] }
          }
          return { ok: true, data: {} }
        }),
      },
    })
    document.body.innerHTML = `
      <main>
        <p>Generic body paragraph should not be observed when a rule matches.</p>
        <article id="target"><p>Rule paragraph should be observed for translation.</p></article>
      </main>
    `

    const state = await new PageTranslator().start({
      providerId: "provider",
      inputTranslationEnabled: true,
      progressPosition: "bottom-center",
      uiLocale: "en",
    })

    expect(state.activeSiteRuleId).toBe("article-rule")
    expect(state.totalCount).toBe(1)
    expect(observed).toHaveLength(1)
    expect(observed[0].textContent).toContain("Rule paragraph")
  })
})

function siteRule(): SiteRulePack {
  return {
    schemaVersion: SITE_RULE_SCHEMA_VERSION,
    id: "article-rule",
    name: "Article rule",
    enabled: true,
    priority: 0,
    scope: {
      kind: "same-page-type",
      url: {
        host: "localhost",
        pathPatterns: ["/articles/:slug"],
      },
      pageTraits: [{ selector: "#target", required: true }],
    },
    regions: [{
      id: "article",
      action: "translate",
      mode: "auto",
      rootSelectors: ["#target"],
      blockSelectors: ["p"],
    }],
    excludes: [],
    createdAt: 1,
    updatedAt: 1,
  }
}
