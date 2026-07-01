import { SITE_RULE_PACKS_STORAGE_KEY } from "@/shared/storage-keys"
import {
  parseSiteRulePack,
  rankSiteRules,
  serializeSiteRulePack,
  validateSiteRulePack,
  type SiteRuleExport,
  type SiteRuleIdRequest,
  type SiteRuleIdResponse,
  type SiteRuleImport,
  type SiteRulePack,
} from "@/shared/site-rules"

export async function readSiteRules(): Promise<SiteRulePack[]> {
  const result = await chrome.storage.local.get(SITE_RULE_PACKS_STORAGE_KEY)
  const rawRules = Array.isArray(result[SITE_RULE_PACKS_STORAGE_KEY])
    ? result[SITE_RULE_PACKS_STORAGE_KEY] as unknown[]
    : []
  const rules: SiteRulePack[] = []

  for (const rawRule of rawRules) {
    try {
      rules.push(validateSiteRulePack(rawRule))
    }
    catch {
      // Ignore malformed historical records instead of breaking translation.
    }
  }

  return rankSiteRules(rules)
}

export async function writeSiteRule(rule: SiteRulePack): Promise<SiteRulePack> {
  const now = Date.now()
  const normalized = validateSiteRulePack({
    ...rule,
    createdAt: rule.createdAt || now,
    updatedAt: now,
  })
  const rules = await readSiteRules()
  const nextRules = rankSiteRules([
    normalized,
    ...rules.filter(existing => existing.id !== normalized.id),
  ])
  await chrome.storage.local.set({ [SITE_RULE_PACKS_STORAGE_KEY]: nextRules })
  return normalized
}

export async function deleteSiteRule(request: SiteRuleIdRequest): Promise<SiteRuleIdResponse> {
  const rules = await readSiteRules()
  await chrome.storage.local.set({
    [SITE_RULE_PACKS_STORAGE_KEY]: rules.filter(rule => rule.id !== request.id),
  })
  return { id: request.id }
}

export async function exportRulePack(request: SiteRuleIdRequest): Promise<SiteRuleExport> {
  const rule = (await readSiteRules()).find(candidate => candidate.id === request.id)
  if (!rule) {
    throw new Error("Site rule was not found.")
  }

  return { text: serializeSiteRulePack(rule) }
}

export async function importRulePack(request: SiteRuleImport): Promise<SiteRulePack> {
  const parsed = parseSiteRulePack(request.text)
  return writeSiteRule({
    ...parsed,
    metadata: {
      ...parsed.metadata,
      createdBy: parsed.metadata?.createdBy ?? "import",
    },
  })
}
