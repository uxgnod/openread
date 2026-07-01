# OpenRead

OpenRead is an open-source browser extension for painless reading across languages. It translates foreign-language web pages in place, keeps the original context visible, and lets you use your own OpenAI-compatible LLM provider instead of being locked into a bundled subscription.

OpenRead 是一个开源浏览器插件，让阅读外语网页更无痛：它在原网页内进行双语翻译，尽量保留原始上下文，并允许你使用自己的 OpenAI-compatible LLM provider，而不是绑定某个内置订阅套餐。完整中文说明见 [中文版](README.zh-CN.md)。

<p align="center">
  <img src="docs/branding/openread-readme-banner.svg" alt="OpenRead turns foreign-language pages into bilingual reading with your own LLM provider." width="100%">
</p>

<p align="center">
  <strong>Open the web. Read every language. Bring your own key.</strong>
</p>

<p align="center">
  <a href="README.zh-CN.md">中文版</a>
  ·
  <a href="docs/site-rules-and-agent-tools.md">Site Rules</a>
  ·
  <a href="docs/architecture.md">Architecture</a>
  ·
  <a href="docs/store-listing.md">Store listing draft</a>
</p>

<p align="center">
  <img alt="Version 0.2.0" src="https://img.shields.io/badge/version-0.2.0-D97757?style=flat-square">
  <img alt="License Apache 2.0" src="https://img.shields.io/badge/license-Apache--2.0-141413?style=flat-square">
  <img alt="Chrome MV3" src="https://img.shields.io/badge/Chrome-MV3-5F7F3F?style=flat-square">
  <img alt="BYOK" src="https://img.shields.io/badge/BYOK-OpenAI--compatible-8F3F2B?style=flat-square">
</p>

## What Is OpenRead?

OpenRead is a Chrome MV3 extension for careful bilingual web reading. It is built for articles, documentation, research pages, technical posts, GitHub READMEs, Substack essays, and other pages where keeping the original layout and context matters.

The project is still early developer-mode software. It works for the core reading loop, but complex pages can still expose DOM fidelity issues, awkward spacing, missed blocks, or site-specific edge cases.

## Why BYOK?

OpenRead is intentionally bring-your-own-key:

- You configure your own OpenAI-compatible `/chat/completions` provider.
- You can choose the model, endpoint, target language, and prompts.
- Translation requests go directly to the provider you configure, not through an OpenRead subscription service.
- The extension stays inspectable, hackable, and suitable for personal reading workflows.

## Features

- Page translation in place, triggered from the popup.
- Original, translation-only, and bilingual display modes.
- Lazy fragment translation with `IntersectionObserver`.
- One sanitized DOM fragment per provider request, rather than sending the whole page HTML at once.
- OpenAI-compatible provider profiles with Base URL, API key, model, target language, system prompt, and user prompt.
- Per-page provider selection from the popup.
- Local translation cache, queueing, retries, and timeout handling.
- Right-click selection translation with a draggable, pinnable floating result card.
- Optional triple-space input translation for text inputs and textareas.
- Progress chip with configurable position, percentage progress, and completion animation.
- UI localization for 10 interface languages.
- Settings page with sidebar navigation, autosave, provider test feedback, and a searchable saved Site Rules view.
- JSON Site Rules for page-specific translation regions, including popup rule status, manual multi-region selection, saved rule loading, and generic fallback when no rule matches.

## How It Works

OpenRead keeps translation local to page structure:

1. The content script collects translatable blocks from the current page.
2. If a saved Site Rule matches the current page, the rule defines the translation boundaries.
3. Large selected containers, such as a GitHub README area, are treated as boundaries; internal paragraphs, list items, headings, and blockquotes are still translated at normal block granularity.
4. Each sanitized fragment is translated through your configured provider.
5. The translated content is inserted back into the original DOM unit so reading rhythm and links remain as intact as possible.

Provider calls, cache, prompt rendering, stop cleanup, and rich text rendering stay shared across generic translation and rule-based translation.

## Install From GitHub Release

GitHub Release builds are early developer-mode packages. They are not Chrome Web Store one-click installs.

1. Download the release zip, for example `openread-chrome-mv3-v0.2.0.zip`.
2. Unzip it locally.
3. Open `chrome://extensions`.
4. Enable Developer mode.
5. Click Load unpacked.
6. Select the unzipped extension directory.

For regular users, the intended distribution channel will be the Chrome Web Store after review.

## Configure Your Provider

Open the extension options page and set:

- Provider name
- Base URL, for example `https://api.openai.com/v1`
- API Key
- Model, for example `gpt-4o-mini`
- Target language
- Interface language
- Progress chip position
- System prompt
- User prompt

Prompt variables:

- `{{targetLanguage}}`
- `{{sourceHtml}}`
- `{{sourceText}}`

## Site Rules

Site Rules are deterministic JSON rule packs that decide which page regions are translated. They are designed for:

- manual multi-region selection in the page inspector
- future agent or voice-driven rule creation
- page translation execution

The first UI lets users add translation regions and save a rule for the current page, same page type, entire site, matching subdomains, or a custom scope. Existing excludes are preserved by the schema and engine, while full exclude editing is planned for a later rule-management UI.

See [Site Rules and Agent Tools](docs/site-rules-and-agent-tools.md) for the JSON shape, matching behavior, tool messages, and agent workflow.

## Roadmap

Planned:

- Better visibility rules so hidden or irrelevant DOM is not counted or translated.
- Faster concurrent translation with smarter batching, request scheduling, and cache reuse.
- Configurable input translation target language.
- Automatic dialog/input language detection for chat, comments, and reply boxes.
- Automatic page-language detection for choosing page translation targets.
- Dark-mode-aware styling for the floating page progress chip and input translation status chip.
- Automatic translation for video websites, including subtitles and possibly transcript panels.
- Floating page toolbar for quick translation controls.
- Full rule management UI for editing, deleting, importing, and exporting Site Rules.
- Reusable site templates for known websites.
- Agent-style or voice-driven flows that generate, preview, and apply deterministic Site Rules.
- Explore a future provider path for users who prefer using a ChatGPT subscription, if a stable and compliant integration path exists.
- Better inline style preservation, especially for code, links, and technical documents.
- PDF, subtitle, and image/OCR translation experiments.
- More provider adapters beyond OpenAI-compatible APIs.
- More real-world page tests and visual regression checks.

## Development

```bash
pnpm install
pnpm dev
```

Load the generated extension from `.output/chrome-mv3` as an unpacked Chrome extension.

Production build:

```bash
pnpm build
```

Package a Chrome MV3 zip for manual testing or GitHub Releases:

```bash
pnpm zip
```

Validation:

```bash
pnpm test
pnpm type-check
pnpm lint
pnpm build
```

## Privacy And Permissions

OpenRead stores configuration locally in `chrome.storage.local`. API keys are not committed, bundled, or sent to an OpenRead server.

When translation is requested, selected text or page fragments are sent to the provider configured by the user. Users should review the privacy policy and data handling terms of their chosen provider.

Permissions:

- `storage`: saves provider profiles, prompts, language settings, display settings, Site Rules, and local translation cache.
- `tabs` and `activeTab`: sends popup or context-menu commands to the current tab.
- `contextMenus`: adds the native right-click selected-text translation action.
- `scripting`: injects the content script on demand when a page has no active receiver yet.
- `<all_urls>` host permission: allows page translation, selection translation, and Site Rule inspection across ordinary webpages.

## Docs

- [Architecture](docs/architecture.md)
- [Site Rules and Agent Tools](docs/site-rules-and-agent-tools.md)
- [Store Listing Draft](docs/store-listing.md)
- [Branding](BRANDING.md)
- [Design Notes](DESIGN.md)
- [Contributing](CONTRIBUTING.md)
