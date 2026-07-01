import { describe, expect, it } from "vitest"
import {
  doesRuleUrlMatch,
  matchRuleForUrl,
  matchesPathPattern,
  parseSiteRulePack,
  serializeSiteRulePack,
  SITE_RULE_SCHEMA_VERSION,
  validateSiteRulePack,
  type SiteRulePack,
} from "./site-rules"

describe("site rules", () => {
  it("matches exact URL scopes without the hash fragment", () => {
    const rule = siteRule({
      scope: {
        kind: "exact-url",
        url: { exactUrl: "https://example.com/articles/one?view=full#intro" },
      },
    })

    expect(doesRuleUrlMatch(rule, "https://example.com/articles/one?view=full#comments")).toBe(true)
    expect(doesRuleUrlMatch(rule, "https://example.com/articles/two?view=full")).toBe(false)
  })

  it("matches site, host glob, and excluded path patterns", () => {
    const site = siteRule({
      scope: {
        kind: "site",
        url: {
          host: "github.com",
          pathPatterns: ["/*"],
          excludePathPatterns: ["/:owner/:repo/blob/*"],
        },
      },
    })
    const hostGlob = siteRule({
      id: "substack",
      priority: 10,
      scope: {
        kind: "host-glob",
        url: {
          hostGlob: "*.substack.com",
          pathPatterns: ["/p/*"],
        },
      },
    })

    expect(doesRuleUrlMatch(site, "https://github.com/rails/rails")).toBe(true)
    expect(doesRuleUrlMatch(site, "https://github.com/rails/rails/blob/main/README.md")).toBe(false)
    expect(doesRuleUrlMatch(hostGlob, "https://example.substack.com/p/hello")).toBe(true)
    expect(doesRuleUrlMatch(hostGlob, "https://substack.com/p/hello")).toBe(false)
  })

  it("ranks matching rules by priority and update time", () => {
    const oldRule = siteRule({ id: "old", priority: 1, updatedAt: 1 })
    const newRule = siteRule({ id: "new", priority: 2, updatedAt: 2 })

    expect(matchRuleForUrl("https://example.com/articles/one", [oldRule, newRule])?.id).toBe("new")
  })

  it("supports colon path segments and globs", () => {
    expect(matchesPathPattern("/rails/rails", "/:owner/:repo")).toBe(true)
    expect(matchesPathPattern("/rails/rails/tree/main", "/:owner/:repo")).toBe(false)
    expect(matchesPathPattern("/rails/rails/tree/main", "/:owner/:repo/tree/*")).toBe(true)
  })

  it("exports and imports a valid JSON rule pack", () => {
    const rule = siteRule({ id: "exported-rule" })
    const exported = serializeSiteRulePack(rule)

    expect(parseSiteRulePack(exported)).toEqual(validateSiteRulePack(rule))
    expect(() => parseSiteRulePack("{")).toThrow("valid JSON")
    expect(() => parseSiteRulePack(JSON.stringify({ schemaVersion: 999 }))).toThrow("Unsupported")
  })
})

function siteRule(overrides: Partial<SiteRulePack> = {}): SiteRulePack {
  return {
    schemaVersion: SITE_RULE_SCHEMA_VERSION,
    id: "example",
    name: "Example",
    enabled: true,
    priority: 0,
    scope: {
      kind: "same-page-type",
      url: {
        host: "example.com",
        pathPatterns: ["/articles/:slug"],
      },
    },
    regions: [{
      id: "article",
      action: "translate",
      mode: "auto",
      rootSelectors: ["article"],
      blockSelectors: ["p"],
    }],
    excludes: [],
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
  }
}
