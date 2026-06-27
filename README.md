# OpenRead

> WIP: OpenRead is still an early, rough browser extension. It works for the core reading loop, but there are many bugs, edge cases, and site-specific optimizations still to do.
>
> 进行中：OpenRead 仍然是一个很早期、很粗糙的浏览器扩展。核心阅读链路已经可以跑通，但还有很多 bug、边界情况和针对具体网站的优化要做。

OpenRead is an open-source, BYOK browser extension for bilingual web translation. It is inspired by Immersive Translate, but it is intentionally simpler: an open, hackable version built around my own reading needs, without being tied to a membership subscription or bundled provider plan.

OpenRead 是一个开源、开放 BYOK（Bring Your Own Key）的双语网页翻译浏览器扩展。它受沉浸式翻译启发，但目标更简单：基于我自己的阅读需求，做一个可修改、可自托管配置、不和会员订阅或内置服务商套餐绑定的简化版本。

## Current Status / 当前状态

Already implemented:

- Chrome MV3 extension built with WXT, React, TypeScript, and pnpm.
- Popup starts and stops translation for the active tab.
- Options page stores multiple OpenAI-compatible providers.
- Each page translation run chooses its provider from the popup, so different tabs can use different providers.
- OpenAI-compatible `/chat/completions` provider with queueing, retries, timeout handling, and local cache.
- BYOK configuration: Base URL, API key, model, target language, system prompt, and user prompt.
- Fragment-based translation: OpenRead sends one sanitized DOM fragment at a time, not the full page HTML.
- Lazy page translation using `IntersectionObserver`.
- Best-effort bilingual DOM rendering with links, emphasis, spans, inline code, and some source styles preserved.
- Reading display modes: original, translation-only, and bilingual.
- Progress chip with position settings, percentage progress, and completion animation.
- Toggleable triple-space input translation for text inputs and textareas, currently translating input content to English by default, with floating status and undo.
- Built-in UI i18n for 10 interface languages.
- Stop translation cleanup for injected wrappers and page state.

已经实现：

- 基于 WXT、React、TypeScript、pnpm 的 Chrome MV3 扩展。
- Popup 支持对当前标签页开始/停止翻译。
- Options 页面支持保存多个 OpenAI-compatible provider。
- 每个页面翻译运行时从 popup 选择 provider，不同标签页可以使用不同 provider。
- OpenAI-compatible `/chat/completions` provider，包含队列、重试、超时处理和本地缓存。
- BYOK 配置：Base URL、API key、模型、目标语言、system prompt、user prompt。
- 按片段翻译：OpenRead 每次只发送一个 sanitized DOM fragment，不发送整页 HTML。
- 基于 `IntersectionObserver` 的懒翻译。
- 尽力保留 DOM 语义和样式的双语渲染，包括链接、强调、span、inline code 和部分源样式。
- 阅读显示模式：原文、仅译文、双语。
- 支持位置设置、百分比进度和完成动画的进度 chip。
- 可开关的输入框三击空格翻译：支持 text input 和 textarea，目前默认把输入内容翻译成英文，并提供浮动状态和撤销。
- 内置界面文本 i18n，当前支持 10 种界面语言。
- 停止翻译时清理注入 wrapper 和页面状态。

## Important Warnings / 重要说明

- This is not production-ready.
- DOM fidelity is best-effort and will break on some complex pages.
- The translation selection rules are still generic and need many site-specific improvements.
- Some pages may produce awkward spacing, duplicated candidates, missed elements, or imperfect inline style preservation.
- Provider errors are surfaced, but the user experience still needs polish.
- API keys are stored locally in `chrome.storage.local`; do not commit keys or put them in environment variables.

- 这不是生产可用版本。
- DOM 保真只是尽力而为，复杂页面上一定会有破损。
- 当前翻译区域选择规则仍然比较通用，需要大量针对具体网站的优化。
- 一些页面可能出现间距不自然、候选块重复、漏翻、inline 样式保留不完整等问题。
- Provider 错误已经会展示出来，但整体体验还需要打磨。
- API key 只存储在本地 `chrome.storage.local`，不要提交 key，也不要把 key 写进环境变量。

## Why / 为什么做

Immersive Translate is a great product and the main inspiration for this project. OpenRead is not trying to clone every feature. The goal is to explore a smaller open-source path:

- open code
- open BYOK provider configuration
- no forced subscription bundle
- easier experimentation with prompts, agents, DOM rules, and site-specific plans
- a translation tool shaped by real personal reading workflows

沉浸式翻译是一个很好的产品，也是这个项目的主要灵感来源。OpenRead 并不是要完整复刻它的所有功能，而是想探索一个更小的开源路线：

- 代码开放
- Provider 配置开放，用户自带 key
- 不绑定会员订阅套餐
- 更容易实验 prompt、agent、多步流程、DOM 规则和站点模板
- 从真实个人阅读工作流出发，慢慢打磨翻译工具

## Roadmap / 路线图

Implemented in the current MVP:

- Configurable OpenAI-compatible provider profiles.
- Popup-triggered page translation.
- Fragment-level lazy translation.
- Bilingual rendering with best-effort DOM fidelity.
- Original / translation / bilingual display modes.
- Progress chip with percentage and completion animation.
- Toggleable triple-space input and textarea translation to English, including floating progress/completion status and undo.
- Basic i18n for extension UI.

当前 MVP 已实现：

- 可配置的 OpenAI-compatible provider profiles。
- 从 popup 触发页面翻译。
- 按 fragment 懒翻译。
- 尽力保留 DOM 的双语渲染。
- 原文 / 译文 / 双语显示模式。
- 百分比进度 chip 和完成动画。
- 可开关的输入框和 textarea 三击空格翻译成英文，包含浮动进度/完成状态和撤销。
- 扩展 UI 的基础 i18n。

Planned:

- Better visibility rules so hidden or irrelevant DOM is not counted or translated.
- Faster concurrent translation with smarter batching, request scheduling, and cache reuse.
- Configurable input translation target language.
- Automatic dialog/input language detection for chat, comments, and reply boxes.
- Automatic page-language detection for choosing page translation targets.
- Dark-mode-aware styling for the floating page progress chip and input translation status chip.
- Automatic translation for video websites, including subtitles and possibly transcript panels.
- Floating page toolbar for quick translation controls.
- DOM inspector and multi-select translation regions.
- Reusable site plans/templates for known websites.
- Agent-style translation plans for multi-step page adaptation.
- Better inline style preservation, especially for code, links, and technical documents.
- PDF, subtitle, image/OCR, and selection translation experiments.
- More provider adapters beyond OpenAI-compatible APIs.
- Better tests with real-world pages and visual regression checks.

计划中：

- 更严格的可见性判断，避免隐藏或无关 DOM 进入统计和翻译流程。
- 更快的并发翻译：更智能的 batching、请求调度和缓存复用。
- 可配置的输入框翻译目标语言。
- 针对聊天、评论、回复框等场景的对话/输入语言自动识别。
- 自动识别页面语言，并据此选择网页翻译目标语言。
- 为页面进度提示框和输入翻译状态框补充 dark mode 适配。
- 视频网站自动翻译，包括字幕，未来也可能支持 transcript 面板。
- 页面浮动工具栏，用于快速控制翻译。
- DOM inspector 和多选翻译区域。
- 针对常见网站的可复用 site plans/templates。
- 面向 agent 的多步翻译计划，用于适配复杂页面。
- 更好的 inline 样式保留，尤其是代码、链接和技术文档。
- PDF、字幕、图片/OCR、划词翻译等实验。
- OpenAI-compatible 之外的更多 provider adapter。
- 更多真实网页测试和视觉回归检查。

## Development / 开发

```bash
pnpm install
pnpm dev
```

Load the generated extension from `.output/chrome-mv3` as an unpacked Chrome extension.

在 Chrome 扩展管理页中加载 `.output/chrome-mv3` 作为 unpacked extension。

Production build:

```bash
pnpm build
```

## Validation / 验证

```bash
pnpm test
pnpm type-check
pnpm lint
pnpm build
```

## Configuration / 配置

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

打开扩展设置页，配置：

- Provider 名称
- Base URL，例如 `https://api.openai.com/v1`
- API Key
- 模型，例如 `gpt-4o-mini`
- 目标语言
- 界面语言
- 进度 chip 位置
- System prompt
- User prompt

Prompt variables:

- `{{targetLanguage}}`
- `{{sourceHtml}}`
- `{{sourceText}}`

Interface languages:

- English (`en`)
- Simplified Chinese (`zh-CN`)
- Traditional Chinese (`zh-TW`)
- Russian (`ru`)
- Japanese (`ja`)
- Korean (`ko`)
- Spanish (`es`)
- French (`fr`)
- German (`de`)
- Vietnamese (`vi`)

## Architecture / 架构

See [docs/architecture.md](docs/architecture.md).

## License / 许可证

Apache-2.0
