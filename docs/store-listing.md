# OpenRead Store Listing Draft

This is a draft for future Chrome Web Store submission. It is not a claim that OpenRead has already been reviewed or published by the Chrome Web Store.

## Short Description

Open-source BYOK web translation for painless bilingual reading.

## Detailed Description

OpenRead is an open-source browser extension for people who want painless foreign-language web reading without giving up provider control.

It translates web pages in place, supports quick right-click selection translation, and lets you configure your own OpenAI-compatible provider instead of relying on a bundled subscription plan. It is designed for careful reading: articles, documentation, research pages, technical posts, GitHub READMEs, Substack essays, and other long-form web content where preserving context matters.

Current features:

- Bilingual page translation with original, translation-only, and bilingual display modes.
- Bring-your-own-key provider setup for OpenAI-compatible `/chat/completions` APIs.
- Fragment-based lazy translation instead of sending the full page HTML at once.
- Right-click selected text and translate it in a draggable floating card.
- Pin the selection translation card to keep translating new selections into the same card.
- Optional triple-space input translation for text inputs and textareas.
- JSON Site Rules for selecting only the page regions you want translated.
- Popup rule status so you can see whether the current page uses a saved Site Rule or generic translation.
- Settings autosave, provider test feedback, and a searchable saved Site Rules view.
- Local configuration stored in the browser.
- Interface text available in multiple languages.

OpenRead is still early software. Some complex pages may render imperfectly, and site-specific optimizations are still being improved. GitHub Release builds are developer-mode packages until the extension is ready for Chrome Web Store review. The project is intended to stay open, inspectable, and hackable.

## 中文简介

OpenRead 是一个开源、BYOK 的网页翻译浏览器扩展，面向需要无痛阅读外文网页、技术文档、文章和资料的用户。

它支持网页内双语翻译，也支持选中文字后通过浏览器原生右键菜单快速翻译。用户可以配置自己的 OpenAI-compatible provider，不绑定内置服务商套餐或会员订阅。

当前功能：

- 网页双语翻译，支持原文、仅译文、双语模式。
- 用户自带 key，配置 OpenAI-compatible `/chat/completions` provider。
- 按网页片段懒翻译，不一次性发送整页 HTML。
- 右键划词翻译，结果显示在可拖动浮窗中。
- 固定划词翻译浮窗后，继续选中文字会复用同一张卡片。
- 可选的输入框三击空格翻译。
- 基于 JSON Site Rules 选择真正需要翻译的页面区域。
- Popup 显示当前页面使用已保存规则，还是使用通用翻译逻辑。
- 设置页自动保存、Provider 测试反馈，以及可搜索的已保存 Site Rules 浏览页。
- 配置保存在浏览器本地。
- 扩展界面支持多语言。

OpenRead 目前仍是早期版本，复杂页面可能存在渲染不完美或漏翻问题。GitHub Release 构建包仍是开发者模式测试包，正式面向普通用户分发需要等待 Chrome Web Store 审核。项目目标是保持开放、可检查、可修改。

## Permission Rationale

- `storage`: saves provider profiles, prompts, language settings, display settings, Site Rules, and local translation cache.
- `tabs` and `activeTab`: sends commands from the popup or context menu to the current tab.
- `contextMenus`: adds the native right-click selected-text translation action.
- `scripting`: injects the content script on demand when the page has no active receiver yet.
- `<all_urls>` host permission: allows page translation, selection translation, and Site Rule inspection across ordinary webpages.

## Privacy Notes

OpenRead stores configuration locally in `chrome.storage.local`. API keys are not committed, bundled, or sent to an OpenRead server.

When translation is requested, selected text or page fragments are sent to the provider configured by the user. Users should review the privacy policy and data handling terms of their chosen provider.

## Release Positioning

OpenRead is currently an early developer-focused extension. GitHub Release builds are developer-mode packages for manual testing, not Chrome Web Store one-click installs. The Chrome Web Store should become the recommended channel only after review and broader usability testing.
