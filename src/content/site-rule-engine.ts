import { collectTranslatableBlocks, isTranslatableBlock, shouldSkipElement } from "./dom-walker"
import {
  DEFAULT_SITE_RULE_BLOCK_SELECTORS,
  doesRuleUrlMatch,
  explainRuleMatchForUrl,
  normalizeExactUrl,
  scopeKindLabel,
  validateSiteRulePack,
  type CurrentPageContext,
  type InspectElementRequest,
  type InspectElementResponse,
  type PageElementSnapshot,
  type PageStructureSnapshot,
  type SiteRuleMatchExplanation,
  type SiteRulePack,
  type SiteRulePreviewRegion,
  type SiteRulePreviewResponse,
  type SiteRuleRegion,
  type SnapshotPageStructureRequest,
} from "@/shared/site-rules"

const STRUCTURE_SELECTOR = [
  "header",
  "nav",
  "main",
  "article",
  "aside",
  "footer",
  "section",
  "[role='main']",
  "[role='complementary']",
  "h1",
  "h2",
  "h3",
  "p",
  "li",
  "blockquote",
  "figcaption",
].join(",")

export interface RuleEvaluation {
  elements: HTMLElement[]
  excludedCount: number
  regions: SiteRulePreviewRegion[]
  samples: string[]
}

export function getCurrentPageContext(): CurrentPageContext {
  return {
    host: window.location.hostname,
    pathname: window.location.pathname,
    title: document.title,
    url: normalizeExactUrl(window.location.href),
  }
}

export function snapshotPageStructure(
  request: SnapshotPageStructureRequest | undefined = {},
): PageStructureSnapshot {
  const maxElements = Math.max(1, Math.min(request.maxElements ?? 80, 160))
  const elements = uniqueElements([...document.querySelectorAll<HTMLElement>(STRUCTURE_SELECTOR)])
    .filter(isInspectableElement)
    .slice(0, maxElements)
    .map((element, index) => snapshotElement(element, `element-${index + 1}`))

  return {
    context: getCurrentPageContext(),
    elements,
  }
}

export function inspectElement(request: InspectElementRequest): InspectElementResponse {
  const element = queryOne(request.selector)
  return {
    element: element ? snapshotElement(element, "inspected") : null,
  }
}

export function explainRuleMatch(rule: SiteRulePack): SiteRuleMatchExplanation {
  const normalized = validateSiteRulePack(rule)
  const urlExplanation = explainRuleMatchForUrl(normalized, window.location.href)
  if (!urlExplanation.matched) {
    return urlExplanation
  }

  const missingTrait = normalized.scope.pageTraits?.find(trait => {
    const element = queryOne(trait.selector)
    if (!element) {
      return trait.required !== false
    }
    if (trait.textIncludes) {
      return !elementText(element).includes(trait.textIncludes)
    }
    return false
  })

  if (missingTrait) {
    return {
      ...urlExplanation,
      matched: false,
      reason: `Required page trait was not found: ${missingTrait.selector}.`,
    }
  }

  return {
    ...urlExplanation,
    reason: normalized.scope.label || scopeKindLabel(normalized.scope.kind),
  }
}

export function previewRule(rule: SiteRulePack): SiteRulePreviewResponse {
  const matchExplanation = explainRuleMatch(rule)
  if (!matchExplanation.matched) {
    return {
      excludedCount: 0,
      matched: false,
      matchExplanation,
      regions: [],
      samples: [],
      totalCount: 0,
    }
  }

  const evaluation = evaluateRule(rule)
  return {
    excludedCount: evaluation.excludedCount,
    matched: true,
    matchExplanation,
    regions: evaluation.regions,
    samples: evaluation.samples,
    totalCount: evaluation.elements.length,
  }
}

export function selectRuleForCurrentPage(rules: SiteRulePack[]): SiteRulePack | undefined {
  return rankRulesForCurrentPage(rules)
    .find(rule => explainRuleMatch(rule).matched)
}

export function evaluateRule(rule: SiteRulePack): RuleEvaluation {
  const normalized = validateSiteRulePack(rule)
  const excludeMatcher = createExcludeMatcher(normalized)
  const regionCounts = new Map<string, SiteRulePreviewRegion>()
  const excludedElements = new Set<HTMLElement>()
  const candidates: HTMLElement[] = []

  for (const region of normalized.regions) {
    const regionCandidates = collectRegionCandidates(region)
    regionCounts.set(region.id, {
      id: region.id,
      label: region.label,
      matchedCount: 0,
      rootSelectors: region.rootSelectors,
    })

    for (const candidate of regionCandidates) {
      if (excludeMatcher(candidate)) {
        excludedElements.add(candidate)
        continue
      }
      candidates.push(candidate)
      const current = regionCounts.get(region.id)
      if (current) {
        current.matchedCount += 1
      }
    }
  }

  const elements = removeCandidateAncestors(uniqueElements(candidates))
  return {
    elements,
    excludedCount: excludedElements.size,
    regions: [...regionCounts.values()],
    samples: elements.slice(0, 5).map(element => truncateSample(elementText(element))),
  }
}

export function collectRuleTranslatableBlocks(rule: SiteRulePack): HTMLElement[] {
  if (!doesRuleUrlMatch(rule, window.location.href) || !explainRuleMatch(rule).matched) {
    return []
  }
  return evaluateRule(rule).elements
}

export function deriveStableSelector(element: HTMLElement): string {
  if (element.id && isUniqueSelector(`#${cssEscape(element.id)}`)) {
    return `#${cssEscape(element.id)}`
  }

  for (const attribute of ["data-testid", "data-test", "data-qa", "itemprop", "aria-label"]) {
    const value = element.getAttribute(attribute)
    if (value) {
      const selector = `${element.tagName.toLowerCase()}[${attribute}="${cssEscapeAttribute(value)}"]`
      if (isUniqueSelector(selector)) {
        return selector
      }
    }
  }

  const classSelector = stableClassSelector(element)
  if (classSelector && isUniqueSelector(classSelector)) {
    return classSelector
  }

  const path: string[] = []
  let current: HTMLElement | null = element
  while (current && current !== document.body && current !== document.documentElement) {
    const segment = selectorSegment(current)
    path.unshift(segment)
    const selector = path.join(" > ")
    if (isUniqueSelector(selector)) {
      return selector
    }
    current = current.parentElement
  }

  path.unshift("body")
  return path.join(" > ")
}

function collectRegionCandidates(region: SiteRuleRegion): HTMLElement[] {
  const roots = region.rootSelectors.flatMap(selector => queryAll(selector))
  const selectors = region.blockSelectors?.length
    ? region.blockSelectors
    : [...DEFAULT_SITE_RULE_BLOCK_SELECTORS]
  const blockSelector = selectors.join(",")
  const candidates: HTMLElement[] = []

  for (const root of roots) {
    if (region.mode === "element") {
      if (isInspectableElement(root) && !shouldSkipElement(root)) {
        candidates.push(root)
      }
      continue
    }

    if (region.mode === "auto" && matchesSelector(root, blockSelector) && isTranslatableBlock(root)) {
      candidates.push(root)
    }

    candidates.push(...queryAll(blockSelector, root).filter(isTranslatableBlock))
  }

  return candidates
}

function rankRulesForCurrentPage(rules: SiteRulePack[]): SiteRulePack[] {
  return rules
    .filter(rule => rule.enabled && doesRuleUrlMatch(rule, window.location.href))
    .sort((left, right) => {
      const scoreDifference = scopePrecisionScore(right) - scopePrecisionScore(left)
      if (scoreDifference !== 0) {
        return scoreDifference
      }
      if (right.priority !== left.priority) {
        return right.priority - left.priority
      }
      return right.updatedAt - left.updatedAt
    })
}

function scopePrecisionScore(rule: SiteRulePack): number {
  switch (rule.scope.kind) {
    case "exact-url":
      return 50
    case "same-page-type":
      return 40
    case "custom":
      return 30
    case "site":
      return 20
    case "host-glob":
      return 10
  }
}

function createExcludeMatcher(rule: SiteRulePack): (element: HTMLElement) => boolean {
  const selectors = rule.excludes.flatMap(exclude => exclude.selectors)
  if (selectors.length === 0) {
    return () => false
  }

  return element => selectors.some(selector => {
    try {
      return !!element.closest(selector) || queryAll(selector).some(excluded => excluded.contains(element))
    }
    catch {
      return false
    }
  })
}

function snapshotElement(element: HTMLElement, id: string): PageElementSnapshot {
  const rect = element.getBoundingClientRect()
  return {
    id,
    role: inferElementRole(element),
    selector: deriveStableSelector(element),
    tagName: element.tagName.toLowerCase(),
    textSample: truncateSample(elementText(element)),
    childElementCount: element.childElementCount,
    rect: {
      height: Math.round(rect.height),
      left: Math.round(rect.left),
      top: Math.round(rect.top),
      width: Math.round(rect.width),
    },
  }
}

function inferElementRole(element: HTMLElement): string {
  const explicitRole = element.getAttribute("role")
  if (explicitRole) {
    return explicitRole
  }

  switch (element.tagName) {
    case "HEADER":
      return "header"
    case "NAV":
      return "navigation"
    case "MAIN":
      return "main"
    case "ARTICLE":
      return "article"
    case "ASIDE":
      return "sidebar"
    case "FOOTER":
      return "footer"
    default:
      return "content"
  }
}

function isInspectableElement(element: HTMLElement): boolean {
  if (!element.isConnected || shouldSkipElement(element)) {
    return false
  }

  if (element.closest(".openread-translation-wrapper,.openread-progress-chip,.openread-site-rule-inspector")) {
    return false
  }

  return elementText(element).length > 0
}

function removeCandidateAncestors(elements: HTMLElement[]): HTMLElement[] {
  const elementSet = new Set(elements)
  return elements.filter(element => {
    let current = element.parentElement
    while (current) {
      if (elementSet.has(current)) {
        return false
      }
      current = current.parentElement
    }
    return true
  })
}

function uniqueElements(elements: HTMLElement[]): HTMLElement[] {
  return [...new Set(elements)]
}

function queryAll(selector: string, root: ParentNode = document): HTMLElement[] {
  try {
    return [...root.querySelectorAll<HTMLElement>(selector)]
  }
  catch {
    return []
  }
}

function queryOne(selector: string): HTMLElement | null {
  try {
    return document.querySelector<HTMLElement>(selector)
  }
  catch {
    return null
  }
}

function matchesSelector(element: HTMLElement, selector: string): boolean {
  try {
    return element.matches(selector)
  }
  catch {
    return false
  }
}

function isUniqueSelector(selector: string): boolean {
  return queryAll(selector).length === 1
}

function stableClassSelector(element: HTMLElement): string | null {
  const stableClasses = [...element.classList]
    .filter(className => /^[a-z0-9_-]+$/i.test(className))
    .filter(className => !className.startsWith("openread-"))
    .slice(0, 3)

  if (stableClasses.length === 0) {
    return null
  }

  return `${element.tagName.toLowerCase()}.${stableClasses.map(cssEscape).join(".")}`
}

function selectorSegment(element: HTMLElement): string {
  const classSelector = stableClassSelector(element)
  if (classSelector) {
    return `${classSelector}:nth-of-type(${elementIndex(element)})`
  }
  return `${element.tagName.toLowerCase()}:nth-of-type(${elementIndex(element)})`
}

function elementIndex(element: HTMLElement): number {
  let index = 1
  let previous = element.previousElementSibling
  while (previous) {
    if (previous.tagName === element.tagName) {
      index += 1
    }
    previous = previous.previousElementSibling
  }
  return index
}

function elementText(element: HTMLElement): string {
  return (element.innerText || element.textContent || "").replace(/\s+/g, " ").trim()
}

function truncateSample(value: string): string {
  return value.length > 140 ? `${value.slice(0, 137)}...` : value
}

function cssEscape(value: string): string {
  return globalThis.CSS?.escape ? globalThis.CSS.escape(value) : value.replace(/[^a-zA-Z0-9_-]/g, "\\$&")
}

function cssEscapeAttribute(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, "\\\"")
}

export function fallbackTranslatableBlocks(): HTMLElement[] {
  return collectTranslatableBlocks(document.body)
}
