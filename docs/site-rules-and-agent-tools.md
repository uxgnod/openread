# Site Rules and Agent Tools

OpenRead Site Rules are deterministic JSON rule packs that decide which page regions are translated. They are designed for three entry points that share the same engine:

- manual selection in the page inspector
- future agent or voice-driven rule creation
- page translation execution

LLMs and agents may propose or edit rule JSON, but they must not directly manipulate the live DOM. Matching, preview, execution, import, and export are handled by OpenRead tools.

## Rule Pack JSON

Rules are stored locally under `openread.siteRulePacks` in `chrome.storage.local`. Each rule pack is plain JSON and can be exported or imported as text.

```json
{
  "schemaVersion": 1,
  "id": "github-repo-readme",
  "name": "GitHub repo README",
  "description": "Translate README and repository description on repo home pages.",
  "enabled": true,
  "priority": 10,
  "scope": {
    "kind": "same-page-type",
    "label": "GitHub repository home",
    "url": {
      "protocols": ["https"],
      "host": "github.com",
      "pathPatterns": ["/:owner/:repo"],
      "excludePathPatterns": [
        "/:owner/:repo/blob/*",
        "/:owner/:repo/tree/*",
        "/:owner/:repo/issues*",
        "/:owner/:repo/pulls*"
      ]
    },
    "pageTraits": [
      { "selector": "#readme, article.markdown-body", "required": true }
    ]
  },
  "regions": [
    {
      "id": "readme",
      "label": "README",
      "action": "translate",
      "mode": "auto",
      "rootSelectors": ["#readme", "article.markdown-body"],
      "blockSelectors": ["h1", "h2", "h3", "h4", "h5", "h6", "p", "li", "blockquote", "figcaption", "td", "th"]
    },
    {
      "id": "repo-about",
      "label": "Repository description",
      "action": "translate",
      "mode": "auto",
      "rootSelectors": ["[itemprop='about']"],
      "blockSelectors": ["p", "span", "a"]
    }
  ],
  "excludes": [
    {
      "label": "Chrome and repository files",
      "selectors": ["header", "nav", "[aria-label='Repository files']"]
    }
  ],
  "metadata": {
    "createdBy": "manual",
    "sourceUrl": "https://github.com/owner/repo",
    "humanScopeSummary": "Same GitHub repository home pages",
    "humanRegionSummary": "Translate README and repository description"
  },
  "createdAt": 1760000000000,
  "updatedAt": 1760000000000
}
```

### Scope Kinds

- `exact-url`: only the exact current URL without hash.
- `same-page-type`: same host and path pattern, optionally confirmed by DOM `pageTraits`.
- `site`: all pages on a host.
- `host-glob`: matching host pattern such as `*.substack.com`.
- `custom`: advanced URL pattern chosen by the user or agent.

URL path patterns support `:segment` for one path segment and `*` for wildcards. Exclude patterns always win over include patterns.

### Regions

Each region has `rootSelectors` and optional `blockSelectors`.

- `mode: "element"` translates the selected root element.
- `mode: "descendants"` translates matching descendant blocks.
- `mode: "auto"` translates the root if it is a translatable block and also scans matching descendants.

In the manual inspector, a selected large container such as a README `article` is treated as a boundary. Translation still uses the normal inner block granularity (`p`, `li`, headings, blockquotes, and similar blocks) instead of translating the whole container as one fragment.

Default block selectors are:

```json
["h1", "h2", "h3", "h4", "h5", "h6", "p", "li", "blockquote", "figcaption", "td", "th"]
```

`metadata` is for humans, export, and sharing only. It does not affect execution.

## Tool Functions and Messages

The implementation exposes these capabilities through shared TypeScript functions and extension messages.

### Storage

- `GET_SITE_RULES`: read all valid rules, ranked by priority and update time.
- `SAVE_SITE_RULE`: validate and upsert a rule.
- `DELETE_SITE_RULE`: delete a rule by id.
- `EXPORT_SITE_RULE`: return a rule as formatted JSON text.
- `IMPORT_SITE_RULE`: parse JSON text, validate it, and save the rule.

Failure modes: invalid JSON, unsupported `schemaVersion`, missing required fields, unsupported region action, or unknown rule id for export.

### Page Inspection

- `GET_CURRENT_PAGE_CONTEXT`: returns current URL, host, path, and title.
- `SNAPSHOT_PAGE_STRUCTURE`: returns visible semantic blocks with role, selector, text sample, and rect.
- `INSPECT_ELEMENT`: inspects a selector and returns the same element snapshot shape.
- `deriveStableSelector(element)`: prefers unique id, stable data attributes, stable class selectors, then `nth-of-type` fallback.

Failure modes: invalid selectors are ignored and return no element instead of throwing.

### Rule Execution

- `matchRuleForUrl(url, rules)`: pure URL matching and priority ranking.
- `EXPLAIN_SITE_RULE_MATCH`: explains whether a rule matches the current page and why.
- `PREVIEW_SITE_RULE`: evaluates regions and excludes, returning matched count, region counts, samples, and excluded count.
- `evaluateRule(rule)`: content-side DOM evaluation used by preview and translation.

Failure modes: disabled rules do not match; required page traits must exist; invalid selectors are ignored.

### Translation

- `START_TRANSLATION`: normal page translation; automatically uses the best matching saved rule when available.
- `START_TRANSLATION_WITH_RULE`: starts translation with a saved rule id.
- `START_TRANSLATION_WITH_INLINE_RULE`: starts translation with an unsaved rule pack for "use once".
- `STOP_TRANSLATION`: stops observers and removes injected wrappers.

Provider selection, prompt rendering, queueing, cache, and rich rendering still use the existing translation pipeline.

## Manual Workflow

1. The popup sends `START_RULE_SELECTION`.
2. The content script opens the page inspector and loads the best matching saved rule for the current page, if one exists.
3. Existing translation regions are shown with persistent selected-region overlays.
4. The user clicks page blocks to add more translation regions.
5. The inspector creates or updates a draft rule with a user-visible scope: exact page, same page type, entire site, matching subdomains, or custom.
6. The inspector previews locally and shows matched count and sample text.
7. The user chooses "Use once" for `START_TRANSLATION_WITH_INLINE_RULE` or "Save rule" for `SAVE_SITE_RULE`.

The first inspector UI only adds translation regions. `excludes` are still supported by the JSON schema and execution engine, and existing excludes are preserved when a loaded rule is saved, but the UI does not currently create or edit exclude regions.

The inspector is intentionally a small workflow, not a full rule-management app. Rule management can be added later on top of the same storage and import/export messages.

## Agent Workflow

Example voice request:

> For GitHub repo pages, only translate the README and the repository description on the right. Do not translate anything else.

Recommended agent sequence:

1. Call `GET_CURRENT_PAGE_CONTEXT`.
2. Call `SNAPSHOT_PAGE_STRUCTURE` to understand visible regions and selectors.
3. Build a candidate rule pack from the user's instruction.
4. Call `PREVIEW_SITE_RULE`.
5. Explain the scope and matched regions to the user.
6. If confirmed, call `SAVE_SITE_RULE` or `START_TRANSLATION_WITH_INLINE_RULE`.

The agent should always preview and explain before saving or executing a generated rule.
