---
name: OpenRead
version: 0.1.0
description: Design system and product principles for OpenRead, an open-source bilingual web translation extension.
status: draft
tokens:
  color:
    canvas: "#f8fafc"
    surface: "#ffffff"
    text: "#111827"
    text_muted: "#667085"
    text_subtle: "#344054"
    border: "#e5e7eb"
    border_strong: "#d0d5dd"
    primary: "#111827"
    primary_text: "#ffffff"
    accent_surface: "#eef2ff"
    accent: "#3730a3"
    success_surface: "#ecfdf3"
    success: "#027a48"
    warning_surface: "#fff7ed"
    warning: "#9a3412"
    danger_surface: "#fef3f2"
    danger: "#b42318"
  typography:
    family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif
    title_size: 30px
    panel_title_size: 18px
    body_size: 14px
    compact_size: 12px
    label_weight: 650
  spacing:
    xs: 4px
    sm: 8px
    md: 12px
    lg: 16px
    xl: 24px
    page: 40px
  radius:
    control: 8px
    chip: 6px
    pill: 999px
  translation:
    pair_gap: 0.22em
    wrapper_class: openread-translation-wrapper
    loading_class: openread-translation-loading
    error_class: openread-translation-error
    progress_class: openread-progress-chip
    progress_position_default: bottom-center
    progress_positions:
      - bottom-center
      - top-center
      - top-left
      - top-right
      - bottom-left
      - bottom-right
    display_modes:
      - original
      - translation
      - bilingual
  i18n:
    default_locale: auto
    supported_locales:
      - en
      - zh-CN
      - zh-TW
      - ru
      - ja
      - ko
      - es
      - fr
      - de
      - vi
---

# OpenRead Design

This file is the durable design contract for OpenRead. It follows the spirit of Google's DESIGN.md approach: keep machine-readable design tokens near human-readable rationale so future agents and maintainers can preserve the product's intent, not just its current CSS.

## Overview

OpenRead is a reading tool before it is a translation widget. Its job is to make a web page bilingual without making the page feel rebuilt, decorated, or interrupted.

The core experience should feel like the translation belongs to the original page. The user should be able to keep reading in place, trust the original structure, stop translation cleanly, and understand provider errors without losing the page.

## Product Principles

1. Translation belongs to the original DOM unit.
   A paragraph translation belongs to that paragraph. A list item translation belongs to that list item. A navigation label translation belongs to that link. Avoid creating a second visual structure beside the page unless no valid DOM placement exists.

2. Preserve reading rhythm.
   The source and translation should sit close together. The distance between one translated pair and the next should mostly come from the original page's own layout rhythm. Do not solve pair spacing by globally rewriting page margins.

3. Preserve meaning-bearing structure.
   Keep safe inline structure whenever possible: links, emphasis, spans, line breaks, small text, superscript, subscript, and inline code tags. If a model drops a source link or inline code marker but the translated text still contains that phrase, prefer a safe repair that restores the original affordance.

4. Be reversible.
   Every injected node must be identifiable, removable, and excluded from future translation scans. Stopping translation should remove OpenRead wrappers without leaving layout, class, or inline-style residue.

5. Prefer local control.
   Provider profiles are global settings, but the active provider for a translation run is chosen from the popup for the current page. Do not make one tab's provider choice silently change another tab's active run.

6. Keep reading controls small and local.
   A compact progress chip is allowed while a page translation run is active. It reports total progress, stays visible after completion, turns the spinner into a green success check, and includes only the display-mode switch needed for reading: original, translation, or bilingual. It must respect the configured screen position and disappear on stop.

## Translation Experience

OpenRead should learn from immersive bilingual translation products: the strongest experience comes from placing the target language inside the same semantic container as the source. This keeps lists, headings, paragraphs, and navigation cohesive.

For V1, use these placement rules:

- Simple navigation links and simple list links append an inline translation inside the original `a`.
- Paragraphs, headings, blockquotes, figcaptions, and non-simple list items append an internal translation wrapper inside the source element when that is valid.
- A fallback after-element wrapper is acceptable only when internal insertion would create invalid or unstable DOM.
- A translated `li` must remain one `li`, not become one source `li` followed by one translation `li`.
- A translated paragraph with links should keep those links in the translated HTML when the provider returns them, and safely repair obvious dropped links when possible.
- Inline code-like content such as `code`, `kbd`, `samp`, and `var` should remain visually distinct in the translation when it appears in the source.
- A translation run shows a small fixed progress chip with a spinning circle and percentage, such as `25%`. The percentage must be based only on completed translated fragments; queued or pending requests must not count as done. The default position is bottom center, with settings for top center and the four viewport corners. The chip stays visible for the active run. At `100%`, the percentage label should visually collapse into the spinner and the spinner should animate into a green success check, following the quiet confirmation feel of iOS system feedback.
- The progress chip may include a segmented display switch: original, translation, bilingual. This switch affects only the current page's injected OpenRead wrappers and source wrappers.

The translation provider receives one sanitized fragment at a time, not the full page HTML. This keeps prompts focused, reduces cost, and makes failures local to one visible fragment.

## DOM Fidelity Rules

- Never translate OpenRead wrappers, `.notranslate`, `[translate="no"]`, hidden controls, scripts, styles, media, code, or form inputs.
- Preserve original DOM ownership: prefer adding children to the translated element over inserting siblings.
- Use `notranslate` on all injected translation wrappers to prevent recursive translation.
- Wrap original child nodes in a reversible `openread-source-wrapper` when needed for display modes. The wrapper should use `display: contents` by default and must be unwrapped on stop.
- Keep wrapper tags valid for their parent. Prefer `span` with block display for internal paragraph or heading translations.
- Do not move source nodes unless a future Site Plan feature explicitly owns that transformation.
- Do not copy arbitrary source attributes into translated HTML. Only allow the sanitizer's safe inline subset.

## Rich Text Preservation

LLM output is helpful but not trusted. Treat returned HTML as untrusted input:

- Sanitize before insertion.
- Allow only safe inline tags and safe attributes.
- Keep `a[href]` only for safe hrefs.
- Strip scriptable, embedded, event-handler, and layout-breaking content.
- Fall back to plain text when returned HTML is empty or unusable.
- Show fragment-level retry errors without breaking surrounding content.

OpenRead should preserve more structure than products that convert paragraph translations to plain text. In particular, links inside source content are part of the reading affordance and should remain clickable in the translated text when possible.

Inline code is also meaning-bearing structure. For technical pages, method names, constants, params, and route examples should keep code semantics and the source page's safe visual treatment whenever possible. Preserve `code`, `kbd`, `samp`, and `var`; repair obvious dropped code wrappers using the source text and safe computed style hints.

## UI Design

The extension UI is a compact utility surface. It should feel calm, precise, and trustworthy.

- Use restrained neutral surfaces, small radii, and clear borders.
- Keep popup actions direct: provider selector, translate, stop, settings.
- Keep options dense but readable: provider profiles, target language, prompts, and validation messages.
- Built-in extension text should resolve through the shared i18n dictionary. The default should follow the browser language, with an explicit options-page override.
- Show raw provider error summaries when useful; do not hide the reason a translation failed.
- Avoid marketing layouts, oversized hero treatments, decorative gradients, and visual noise.
- Prefer stable controls over clever controls: native selects, inputs, textareas, and explicit buttons are fine.

## Colors

The palette is mostly neutral so translated pages remain visually owned by the website, not by OpenRead. Accent colors should appear in extension UI and error states, not as a page-wide theme.

- Primary text and actions use `#111827`.
- Muted explanatory text uses `#667085`.
- Borders use `#e5e7eb` and `#d0d5dd`.
- Status colors are reserved for real status: success, warning, and danger.

## Typography

Use the system sans stack defined in tokens. Do not scale UI type with viewport width. Use compact labels in popup and options forms, and let translated page text inherit from the source element wherever possible.

Translated content should copy readable typography from the source element only where it improves fidelity: font family, size, weight, style, line height, letter spacing, color, text alignment, direction, word breaking, and wrapping.

## Layout

Extension UI should be compact and predictable:

- Popup width should remain small enough for Chrome's extension surface.
- Options should use a constrained single-column layout.
- Cards are allowed for repeated provider forms and settings groups.
- Do not nest cards inside cards.

Translated page layout should be conservative:

- Do not override page-wide CSS.
- Do not introduce floating controls or toolbars in V1.
- A compact interactive progress chip is allowed while translation is active.
- Do not globally reset margins.
- Use internal translation wrappers to preserve semantic grouping.

## Components

- Popup provider selector: chooses the provider for the current page's translation run only.
- Translate button: starts the current tab's translation using the popup-selected provider.
- Stop button: removes wrappers and stops observers for the current page.
- Options provider profiles: stores reusable OpenAI-compatible base URL, API key, model, and display name locally.
- Prompt fields: support `{{targetLanguage}}`, `{{sourceHtml}}`, and `{{sourceText}}`.
- Translation wrapper: marked with `openread-translation-wrapper notranslate`, carries state, and is removed on stop.
- Source wrapper: marked with `openread-source-wrapper`, wraps original child nodes for display-mode control, uses `display: contents`, and is unwrapped on stop.
- Progress chip: marked with `openread-progress-chip notranslate`, reports current/total fragments, supports six configured viewport positions, remains visible for the active run, shows a green success check when complete, contains the original/translation/bilingual display switch, and is removed on stop.

## Do's And Don'ts

Do:

- Keep the original page recognizable.
- Keep source and translation visually paired.
- Keep links and emphasis when safe.
- Keep translation failures local and retryable.
- Add tests for DOM shape, not only text output.

Don't:

- Split one source list item into two list items.
- Insert block translations as siblings when an internal wrapper is valid.
- Translate the same text twice through parent and child candidates.
- Trust model-returned HTML without sanitizing.
- Let one tab's provider choice silently mutate another tab's active translation.
- Bring V2 features such as floating toolbar, DOM inspector, and Site Plans into V1 rendering rules.

## References

- Google Labs DESIGN.md specification: https://github.com/google-labs-code/design.md/blob/main/docs/spec.md
- Google Labs DESIGN.md releases: https://github.com/google-labs-code/design.md/releases
- Google Labs introduction to DESIGN.md: https://blog.google/innovation-and-ai/models-and-research/google-labs/stitch-design-md/
