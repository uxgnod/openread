import { describe, expect, it } from "vitest"
import { SITE_RULE_SCHEMA_VERSION, type SiteRulePack } from "@/shared/site-rules"
import {
  collectRuleTranslatableBlocks,
  deriveStableSelector,
  explainRuleMatch,
  previewRule,
  selectRuleForCurrentPage,
  snapshotPageStructure,
} from "./site-rule-engine"

describe("site rule engine", () => {
  it("previews translated regions and excluded blocks", () => {
    window.history.replaceState({}, "", "/rails/rails")
    document.body.innerHTML = `
      <header><p>Navigation should not be translated.</p></header>
      <main>
        <div id="readme">
          <p>README paragraph should be translated because it is useful.</p>
          <p class="ad">Sponsor copy should be excluded from translation.</p>
        </div>
        <aside><p itemprop="about">Repository description should be translated.</p></aside>
      </main>
    `

    const preview = previewRule(githubRule())

    expect(preview.matched).toBe(true)
    expect(preview.totalCount).toBe(2)
    expect(preview.excludedCount).toBe(1)
    expect(preview.samples.join(" ")).toContain("README paragraph")
    expect(preview.samples.join(" ")).toContain("Repository description")
  })

  it("explains required page-trait misses", () => {
    window.history.replaceState({}, "", "/rails/rails")
    document.body.innerHTML = `<main><p>No readme here.</p></main>`

    expect(explainRuleMatch(githubRule()).matched).toBe(false)
    expect(explainRuleMatch(githubRule()).reason).toContain("#readme")
  })

  it("treats selected containers as boundaries and translates descendant blocks", () => {
    window.history.replaceState({}, "", "/rails/rails")
    document.body.innerHTML = `
      <main>
        <article id="readme" class="markdown-body">
          <h2>Installation guide</h2>
          <p>README paragraph should be translated as its own block.</p>
          <ul><li>List item should also be translated separately.</li></ul>
        </article>
      </main>
    `

    const blocks = collectRuleTranslatableBlocks(githubRule({
      regions: [{
        id: "readme",
        label: "README",
        action: "translate",
        mode: "auto",
        rootSelectors: ["#readme"],
        blockSelectors: ["h2", "p", "li"],
      }],
    }))

    expect(blocks).not.toContain(document.getElementById("readme"))
    expect(blocks.map(block => block.tagName)).toEqual(["H2", "P", "LI"])
  })

  it("still translates the selected root when it is a matching text block", () => {
    window.history.replaceState({}, "", "/rails/rails")
    document.body.innerHTML = `<main><p id="summary">This paragraph root should be translated directly.</p></main>`

    const blocks = collectRuleTranslatableBlocks(githubRule({
      scope: {
        kind: "same-page-type",
        label: "GitHub repository home",
        url: {
          host: "localhost",
          pathPatterns: ["/:owner/:repo"],
        },
        pageTraits: [{ selector: "#summary", required: true }],
      },
      regions: [{
        id: "summary",
        label: "Summary",
        action: "translate",
        mode: "auto",
        rootSelectors: ["#summary"],
        blockSelectors: ["p"],
      }],
    }))

    expect(blocks).toEqual([document.getElementById("summary")])
  })

  it("selects the most specific current-page rule and skips missing page traits", () => {
    window.history.replaceState({}, "", "/rails/rails")
    document.body.innerHTML = `<main><article id="readme"><p>README content.</p></article></main>`

    const siteRule = githubRule({
      id: "site-rule",
      name: "Site rule",
      priority: 100,
      scope: {
        kind: "site",
        label: "Site",
        url: {
          host: "localhost",
          pathPatterns: ["/*"],
        },
      },
    })
    const missingExactRule = githubRule({
      id: "missing-exact",
      name: "Missing exact",
      priority: 1,
      scope: {
        kind: "exact-url",
        label: "Exact",
        url: { exactUrl: "http://localhost/rails/rails" },
        pageTraits: [{ selector: "#missing", required: true }],
      },
    })
    const samePageTypeRule = githubRule({
      id: "same-page-type",
      name: "Same page type",
      priority: 0,
    })

    expect(selectRuleForCurrentPage([siteRule, missingExactRule, samePageTypeRule])?.id).toBe("same-page-type")
  })

  it("derives stable selectors from id, data attributes, classes, and nth-of-type fallback", () => {
    document.body.innerHTML = `
      <main>
        <article id="readme">README</article>
        <section data-testid="repo-about">About</section>
        <aside class="Layout-sidebar color-fg-muted">Sidebar</aside>
        <div><span>First</span><span id="">Second</span></div>
      </main>
    `

    expect(deriveStableSelector(document.getElementById("readme")!)).toBe("#readme")
    expect(deriveStableSelector(document.querySelector<HTMLElement>("[data-testid]")!)).toBe("section[data-testid=\"repo-about\"]")
    expect(deriveStableSelector(document.querySelector<HTMLElement>("aside")!)).toBe("aside.Layout-sidebar.color-fg-muted")
    expect(deriveStableSelector(document.querySelectorAll<HTMLElement>("span")[1])).toContain("nth-of-type(2)")
  })

  it("snapshots visible page structure for agent tools", () => {
    document.body.innerHTML = `<main><article><h1>Title</h1><p>Readable content for the snapshot.</p></article></main>`

    const snapshot = snapshotPageStructure({ maxElements: 3 })

    expect(snapshot.context.url).toContain("localhost")
    expect(snapshot.elements.length).toBeGreaterThan(0)
    expect(snapshot.elements[0]).toHaveProperty("selector")
    expect(snapshot.elements[0]).toHaveProperty("textSample")
  })
})

function githubRule(overrides: Partial<SiteRulePack> = {}): SiteRulePack {
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
        excludePathPatterns: ["/:owner/:repo/blob/*", "/:owner/:repo/tree/*"],
      },
      pageTraits: [{ selector: "#readme", required: true }],
    },
    regions: [
      {
        id: "readme",
        label: "README",
        action: "translate",
        mode: "auto",
        rootSelectors: ["#readme"],
        blockSelectors: ["p"],
      },
      {
        id: "about",
        label: "About",
        action: "translate",
        mode: "auto",
        rootSelectors: ["[itemprop='about']"],
        blockSelectors: ["p,span"],
      },
    ],
    excludes: [{ label: "Ads", selectors: [".ad"] }],
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
  }
}
