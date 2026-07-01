import { useMemo } from "react"
import type { UiLocale } from "@/shared/i18n"
import type { SiteRulePack } from "@/shared/site-rules"
import { optionsCopy, scopeKindLabel } from "./options-copy"
import { EmptyState, Field, SettingsSection } from "./options-ui"

export function SiteRulesView({
  locale,
  query,
  rules,
  onQueryChange,
}: {
  locale: UiLocale
  query: string
  rules: SiteRulePack[]
  onQueryChange: (query: string) => void
}) {
  const filteredRules = useMemo(() => filterRules(rules, query), [query, rules])
  const groupedRules = useMemo(() => groupRules(filteredRules), [filteredRules])

  return (
    <section className="settings-content" aria-label={optionsCopy(locale, "translationRules")}>
      <SettingsSection
        description={optionsCopy(locale, "rulesDescription")}
        title={optionsCopy(locale, "translationRules")}
      >
        <Field label={optionsCopy(locale, "filterRules")}>
          <input
            value={query}
            placeholder={optionsCopy(locale, "filterRulesPlaceholder")}
            onChange={event => onQueryChange(event.target.value)}
          />
        </Field>

        {rules.length === 0
          ? <EmptyState title={optionsCopy(locale, "noRules")} description={optionsCopy(locale, "noRulesDescription")} />
          : groupedRules.length === 0
            ? <EmptyState title={optionsCopy(locale, "noMatchingRules")} description={optionsCopy(locale, "noMatchingRulesDescription")} />
            : (
                <div className="rule-groups">
                  {groupedRules.map(group => (
                    <section className="rule-group" key={group.name}>
                      <div className="rule-group-heading">
                        <h3>{group.name}</h3>
                        <span>{optionsCopy(locale, "ruleCount").replace("{count}", String(group.rules.length))}</span>
                      </div>
                      <div className="rule-list">
                        {group.rules.map(rule => (
                          <RuleCard key={rule.id} locale={locale} rule={rule} />
                        ))}
                      </div>
                    </section>
                  ))}
                </div>
              )}
      </SettingsSection>
    </section>
  )
}

function RuleCard({ locale, rule }: { locale: UiLocale; rule: SiteRulePack }) {
  const scope = rule.scope.url
  const pathSummary = [
    ...(scope.pathPatterns ?? []),
    ...(scope.excludePathPatterns ?? []).map(pattern => `exclude ${pattern}`),
  ].slice(0, 4)
  const regionSummary = optionsCopy(locale, "regionsAndExcludes")
    .replace("{regions}", String(rule.regions.length))
    .replace("{excludes}", String(rule.excludes.length))

  return (
    <article className="rule-card">
      <div className="rule-card-header">
        <div>
          <h4>{rule.name}</h4>
          <p>{rule.metadata?.humanScopeSummary || scopeSummary(rule)}</p>
        </div>
        <span className={rule.enabled ? "rule-status enabled" : "rule-status"}>
          {rule.enabled ? optionsCopy(locale, "enabled") : optionsCopy(locale, "disabled")}
        </span>
      </div>

      <div className="rule-meta">
        <span>{scopeKindLabel(locale, rule.scope.kind)}</span>
        <span>{optionsCopy(locale, "priority").replace("{priority}", String(rule.priority))}</span>
        <span>{regionSummary}</span>
      </div>

      {pathSummary.length > 0 && (
        <div className="rule-paths">
          {pathSummary.map(path => <code key={path}>{path}</code>)}
        </div>
      )}

      {rule.metadata?.humanRegionSummary && (
        <p className="rule-summary">{rule.metadata.humanRegionSummary}</p>
      )}

      <p className="rule-updated">
        {optionsCopy(locale, "updatedAt").replace("{time}", new Date(rule.updatedAt).toLocaleString())}
      </p>
    </article>
  )
}

function filterRules(rules: SiteRulePack[], query: string): SiteRulePack[] {
  const normalizedQuery = query.trim().toLowerCase()
  if (!normalizedQuery) {
    return rules
  }

  return rules.filter(rule => searchableRuleText(rule).includes(normalizedQuery))
}

function searchableRuleText(rule: SiteRulePack): string {
  const url = rule.scope.url
  return [
    rule.name,
    rule.description,
    rule.scope.label,
    url.host,
    url.hostGlob,
    url.exactUrl,
    ...(url.pathPatterns ?? []),
    ...(url.excludePathPatterns ?? []),
    rule.metadata?.humanScopeSummary,
    rule.metadata?.humanRegionSummary,
  ].filter(Boolean).join(" ").toLowerCase()
}

function groupRules(rules: SiteRulePack[]): Array<{ name: string; rules: SiteRulePack[] }> {
  const groups = new Map<string, SiteRulePack[]>()
  for (const rule of rules) {
    const key = ruleGroupName(rule)
    groups.set(key, [...(groups.get(key) ?? []), rule])
  }
  return [...groups.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([name, groupRules]) => ({ name, rules: groupRules }))
}

function ruleGroupName(rule: SiteRulePack): string {
  const url = rule.scope.url
  if (url.host) {
    return url.host
  }
  if (url.hostGlob) {
    return url.hostGlob
  }
  if (url.exactUrl) {
    try {
      return new URL(url.exactUrl).host
    }
    catch {
      return "Custom"
    }
  }
  return "Custom"
}

function scopeSummary(rule: SiteRulePack): string {
  const url = rule.scope.url
  return url.host ?? url.hostGlob ?? url.exactUrl ?? rule.scope.label ?? "Custom"
}
