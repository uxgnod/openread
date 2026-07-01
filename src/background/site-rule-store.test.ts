import { beforeEach, describe, expect, it, vi } from "vitest"
import { SITE_RULE_PACKS_STORAGE_KEY } from "@/shared/storage-keys"
import { SITE_RULE_SCHEMA_VERSION, type SiteRulePack } from "@/shared/site-rules"
import {
  deleteSiteRule,
  exportRulePack,
  importRulePack,
  readSiteRules,
  writeSiteRule,
} from "./site-rule-store"

describe("site rule store", () => {
  let storage: Record<string, unknown>

  beforeEach(() => {
    storage = {}
    vi.stubGlobal("chrome", {
      storage: {
        local: {
          get: vi.fn(async (key: string) => ({ [key]: storage[key] })),
          set: vi.fn(async (value: Record<string, unknown>) => {
            storage = { ...storage, ...value }
          }),
        },
      },
    })
  })

  it("writes, reads, exports, imports, and deletes rules", async () => {
    const saved = await writeSiteRule(siteRule({ id: "one", name: "One" }))

    expect(saved.id).toBe("one")
    expect((await readSiteRules()).map(rule => rule.id)).toEqual(["one"])

    const exported = await exportRulePack({ id: "one" })
    expect(exported.text).toContain("\"name\": \"One\"")

    await importRulePack({ text: exported.text.replace("\"id\": \"one\"", "\"id\": \"two\"") })
    expect((await readSiteRules()).map(rule => rule.id)).toEqual(["two", "one"])

    await deleteSiteRule({ id: "one" })
    expect((await readSiteRules()).map(rule => rule.id)).toEqual(["two"])
  })

  it("ignores malformed stored rules", async () => {
    storage[SITE_RULE_PACKS_STORAGE_KEY] = [siteRule({ id: "valid" }), { nope: true }]

    expect((await readSiteRules()).map(rule => rule.id)).toEqual(["valid"])
  })
})

function siteRule(overrides: Partial<SiteRulePack> = {}): SiteRulePack {
  return {
    schemaVersion: SITE_RULE_SCHEMA_VERSION,
    id: "rule",
    name: "Rule",
    enabled: true,
    priority: 0,
    scope: {
      kind: "site",
      url: {
        host: "example.com",
        pathPatterns: ["/*"],
      },
    },
    regions: [{
      id: "body",
      action: "translate",
      mode: "auto",
      rootSelectors: ["main"],
      blockSelectors: ["p"],
    }],
    excludes: [],
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
  }
}
