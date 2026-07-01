export const SITE_RULE_SCHEMA_VERSION = 1

export const SITE_RULE_SCOPE_KINDS = [
  "exact-url",
  "same-page-type",
  "site",
  "host-glob",
  "custom",
] as const

export type SiteRuleScopeKind = typeof SITE_RULE_SCOPE_KINDS[number]

export const DEFAULT_SITE_RULE_BLOCK_SELECTORS = [
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "p",
  "li",
  "blockquote",
  "figcaption",
  "td",
  "th",
] as const

export type SiteRuleRegionMode = "element" | "descendants" | "auto"
export type SiteRuleRegionAction = "translate"

export interface SiteRuleUrlScope {
  exactUrl?: string
  protocols?: string[]
  host?: string
  hostGlob?: string
  pathPatterns?: string[]
  excludePathPatterns?: string[]
}

export interface SiteRulePageTrait {
  selector: string
  required?: boolean
  textIncludes?: string
}

export interface SiteRuleScope {
  kind: SiteRuleScopeKind
  label?: string
  url: SiteRuleUrlScope
  pageTraits?: SiteRulePageTrait[]
}

export interface SiteRuleRegion {
  id: string
  label?: string
  action: SiteRuleRegionAction
  mode: SiteRuleRegionMode
  rootSelectors: string[]
  blockSelectors?: string[]
}

export interface SiteRuleExclude {
  id?: string
  label?: string
  selectors: string[]
}

export interface SiteRuleMetadata {
  createdBy?: "manual" | "agent" | "template" | "import"
  sourceUrl?: string
  humanScopeSummary?: string
  humanRegionSummary?: string
}

export interface SiteRulePack {
  schemaVersion: typeof SITE_RULE_SCHEMA_VERSION
  id: string
  name: string
  description?: string
  enabled: boolean
  priority: number
  scope: SiteRuleScope
  regions: SiteRuleRegion[]
  excludes: SiteRuleExclude[]
  metadata?: SiteRuleMetadata
  createdAt: number
  updatedAt: number
}

export interface SiteRuleExport {
  text: string
}

export interface SiteRuleImport {
  text: string
}

export interface SiteRuleIdRequest {
  id: string
}

export interface SiteRuleIdResponse {
  id: string
}

export interface SiteRuleMatchExplanation {
  matched: boolean
  ruleId?: string
  ruleName?: string
  scopeKind?: SiteRuleScopeKind
  scopeLabel?: string
  reason: string
}

export interface CurrentPageContext {
  host: string
  pathname: string
  title: string
  url: string
}

export interface PageElementSnapshot {
  id: string
  role: string
  selector: string
  tagName: string
  textSample: string
  childElementCount: number
  rect: {
    height: number
    left: number
    top: number
    width: number
  }
}

export interface PageStructureSnapshot {
  context: CurrentPageContext
  elements: PageElementSnapshot[]
}

export interface SnapshotPageStructureRequest {
  maxElements?: number
}

export interface InspectElementRequest {
  selector: string
}

export interface InspectElementResponse {
  element: PageElementSnapshot | null
}

export interface SiteRulePreviewRequest {
  rule: SiteRulePack
}

export interface SiteRulePreviewRegion {
  id: string
  label?: string
  matchedCount: number
  rootSelectors: string[]
}

export interface SiteRulePreviewResponse {
  excludedCount: number
  matched: boolean
  matchExplanation: SiteRuleMatchExplanation
  regions: SiteRulePreviewRegion[]
  samples: string[]
  totalCount: number
}

export interface PageSiteRuleStatus {
  hasRule: boolean
  ruleId?: string
  ruleName?: string
  scopeKind?: SiteRuleScopeKind
}

export interface StartRuleSelectionRequest {
  providerId?: string
  progressPosition?: string
  uiLocale?: string
}

export interface StartRuleSelectionResponse {
  isActive: boolean
}

export function serializeSiteRulePack(rule: SiteRulePack): string {
  return `${JSON.stringify(validateSiteRulePack(rule), null, 2)}\n`
}

export function parseSiteRulePack(text: string): SiteRulePack {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  }
  catch {
    throw new Error("Rule pack must be valid JSON.")
  }

  return validateSiteRulePack(parsed)
}

export function validateSiteRulePack(value: unknown): SiteRulePack {
  if (!isRecord(value)) {
    throw new Error("Rule pack must be a JSON object.")
  }

  if (value.schemaVersion !== SITE_RULE_SCHEMA_VERSION) {
    throw new Error(`Unsupported site rule schemaVersion: ${String(value.schemaVersion)}.`)
  }

  const id = requiredString(value.id, "id")
  const name = requiredString(value.name, "name")
  const scope = validateScope(value.scope)
  const regions = arrayValue(value.regions, "regions").map(validateRegion)
  const excludes = arrayValue(value.excludes ?? [], "excludes").map(validateExclude)

  if (regions.length === 0) {
    throw new Error("Rule pack must include at least one region.")
  }

  return {
    schemaVersion: SITE_RULE_SCHEMA_VERSION,
    id,
    name,
    description: optionalString(value.description),
    enabled: typeof value.enabled === "boolean" ? value.enabled : true,
    priority: typeof value.priority === "number" && Number.isFinite(value.priority) ? value.priority : 0,
    scope,
    regions,
    excludes,
    metadata: validateMetadata(value.metadata),
    createdAt: numberValue(value.createdAt, Date.now()),
    updatedAt: numberValue(value.updatedAt, Date.now()),
  }
}

export function matchRuleForUrl(url: string, rules: SiteRulePack[]): SiteRulePack | undefined {
  return rankSiteRules(rules).find(rule => rule.enabled && doesRuleUrlMatch(rule, url))
}

export function explainRuleMatchForUrl(rule: SiteRulePack, url: string): SiteRuleMatchExplanation {
  if (!rule.enabled) {
    return {
      matched: false,
      ruleId: rule.id,
      ruleName: rule.name,
      scopeKind: rule.scope.kind,
      scopeLabel: rule.scope.label,
      reason: "Rule is disabled.",
    }
  }

  if (!doesRuleUrlMatch(rule, url)) {
    return {
      matched: false,
      ruleId: rule.id,
      ruleName: rule.name,
      scopeKind: rule.scope.kind,
      scopeLabel: rule.scope.label,
      reason: "URL does not match this rule scope.",
    }
  }

  return {
    matched: true,
    ruleId: rule.id,
    ruleName: rule.name,
    scopeKind: rule.scope.kind,
    scopeLabel: rule.scope.label,
    reason: scopeKindLabel(rule.scope.kind),
  }
}

export function doesRuleUrlMatch(rule: SiteRulePack, urlValue: string): boolean {
  const parsed = parseUrl(urlValue)
  if (!parsed) {
    return false
  }

  const scope = rule.scope.url
  const protocol = parsed.protocol.replace(/:$/, "")
  if (scope.protocols?.length && !scope.protocols.map(item => item.replace(/:$/, "").toLowerCase()).includes(protocol)) {
    return false
  }

  if (scope.exactUrl && normalizeExactUrl(scope.exactUrl) !== normalizeExactUrl(parsed.href)) {
    return false
  }

  if (scope.host && parsed.hostname !== scope.host.toLowerCase()) {
    return false
  }

  if (scope.hostGlob && !matchesGlob(parsed.hostname, scope.hostGlob.toLowerCase())) {
    return false
  }

  const path = `${parsed.pathname}${parsed.search}`
  if (scope.excludePathPatterns?.some(pattern => matchesPathPattern(path, pattern))) {
    return false
  }

  if (scope.pathPatterns?.length && !scope.pathPatterns.some(pattern => matchesPathPattern(path, pattern))) {
    return false
  }

  return true
}

export function rankSiteRules(rules: SiteRulePack[]): SiteRulePack[] {
  return [...rules].sort((left, right) => {
    if (right.priority !== left.priority) {
      return right.priority - left.priority
    }
    return right.updatedAt - left.updatedAt
  })
}

export function scopeKindLabel(kind: SiteRuleScopeKind): string {
  switch (kind) {
    case "exact-url":
      return "Only this exact page URL."
    case "same-page-type":
      return "Same page type on this site."
    case "site":
      return "Every page on this site."
    case "host-glob":
      return "Matching host pattern."
    case "custom":
      return "Custom URL scope."
  }
}

export function normalizeExactUrl(urlValue: string): string {
  const parsed = parseUrl(urlValue)
  if (!parsed) {
    return urlValue.trim()
  }

  return `${parsed.origin}${parsed.pathname}${parsed.search}`
}

export function matchesPathPattern(pathValue: string, pattern: string): boolean {
  const normalizedPath = pathValue.startsWith("/") ? pathValue : `/${pathValue}`
  const normalizedPattern = pattern.startsWith("/") ? pattern : `/${pattern}`
  return patternToRegExp(normalizedPattern).test(normalizedPath)
}

function validateScope(value: unknown): SiteRuleScope {
  if (!isRecord(value)) {
    throw new Error("Rule scope must be an object.")
  }

  const kind = value.kind
  if (typeof kind !== "string" || !SITE_RULE_SCOPE_KINDS.includes(kind as SiteRuleScopeKind)) {
    throw new Error("Rule scope.kind is invalid.")
  }

  const url = validateUrlScope(value.url)
  return {
    kind: kind as SiteRuleScopeKind,
    label: optionalString(value.label),
    url,
    pageTraits: arrayValue(value.pageTraits ?? [], "pageTraits").map(validatePageTrait),
  }
}

function validateUrlScope(value: unknown): SiteRuleUrlScope {
  if (!isRecord(value)) {
    throw new Error("Rule scope.url must be an object.")
  }

  return {
    exactUrl: optionalString(value.exactUrl),
    protocols: stringArray(value.protocols ?? []),
    host: optionalString(value.host)?.toLowerCase(),
    hostGlob: optionalString(value.hostGlob)?.toLowerCase(),
    pathPatterns: stringArray(value.pathPatterns ?? []),
    excludePathPatterns: stringArray(value.excludePathPatterns ?? []),
  }
}

function validatePageTrait(value: unknown): SiteRulePageTrait {
  if (!isRecord(value)) {
    throw new Error("Page trait must be an object.")
  }

  return {
    selector: requiredString(value.selector, "pageTrait.selector"),
    required: typeof value.required === "boolean" ? value.required : true,
    textIncludes: optionalString(value.textIncludes),
  }
}

function validateRegion(value: unknown): SiteRuleRegion {
  if (!isRecord(value)) {
    throw new Error("Rule region must be an object.")
  }

  const action = optionalString(value.action) ?? "translate"
  if (action !== "translate") {
    throw new Error("Only translate regions are supported.")
  }

  const mode = optionalString(value.mode) ?? "descendants"
  if (mode !== "element" && mode !== "descendants" && mode !== "auto") {
    throw new Error("Rule region mode is invalid.")
  }

  return {
    id: requiredString(value.id, "region.id"),
    label: optionalString(value.label),
    action,
    mode,
    rootSelectors: stringArray(value.rootSelectors),
    blockSelectors: stringArray(value.blockSelectors ?? DEFAULT_SITE_RULE_BLOCK_SELECTORS),
  }
}

function validateExclude(value: unknown): SiteRuleExclude {
  if (!isRecord(value)) {
    throw new Error("Rule exclude must be an object.")
  }

  return {
    id: optionalString(value.id),
    label: optionalString(value.label),
    selectors: stringArray(value.selectors),
  }
}

function validateMetadata(value: unknown): SiteRuleMetadata | undefined {
  if (value === undefined) {
    return undefined
  }
  if (!isRecord(value)) {
    return undefined
  }

  const createdBy = optionalString(value.createdBy)
  return {
    createdBy: createdBy === "manual" || createdBy === "agent" || createdBy === "template" || createdBy === "import"
      ? createdBy
      : undefined,
    sourceUrl: optionalString(value.sourceUrl),
    humanScopeSummary: optionalString(value.humanScopeSummary),
    humanRegionSummary: optionalString(value.humanRegionSummary),
  }
}

function patternToRegExp(pattern: string): RegExp {
  const escaped = pattern
    .split("/")
    .map(segment => {
      if (segment === "*") {
        return ".*"
      }
      if (segment.startsWith(":")) {
        return "[^/]+"
      }
      return escapeRegExp(segment).replaceAll("\\*", ".*")
    })
    .join("/")
  return new RegExp(`^${escaped}$`)
}

function matchesGlob(value: string, pattern: string): boolean {
  return new RegExp(`^${escapeRegExp(pattern).replaceAll("\\*", ".*")}$`).test(value)
}

function parseUrl(urlValue: string): URL | null {
  try {
    return new URL(urlValue)
  }
  catch {
    return null
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function arrayValue(value: unknown, field: string): unknown[] {
  if (!Array.isArray(value)) {
    throw new Error(`${field} must be an array.`)
  }
  return value
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    throw new Error("Expected an array of strings.")
  }
  return value
    .filter((item): item is string => typeof item === "string")
    .map(item => item.trim())
    .filter(Boolean)
}

function requiredString(value: unknown, field: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${field} is required.`)
  }
  return value.trim()
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined
}

function numberValue(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}
