# OpenRead Architecture

OpenRead V1 is intentionally small: deterministic page extraction, configurable OpenAI-compatible translation, and best-effort rich bilingual rendering.

## Runtime Split

- `background`: owns configuration, cache, queueing, retries, and provider calls.
- `content`: owns page traversal, safe rich fragment extraction, injected translation UI, observers, and cleanup.
- `popup`: starts and stops translation for the active tab, and chooses the provider for that page's translation session.
- `options`: edits reusable provider profiles, language, and prompt settings.
- `shared`: owns message contracts, types, prompt rendering, sanitizing, DOM constants, and hashing.

## Page Translation Flow

1. The popup sends `START_TRANSLATION` with the selected `providerId` to the active tab.
2. The content script scans eligible page blocks and observes them with `IntersectionObserver`.
3. When a block becomes visible, content extracts a sanitized inline HTML fragment.
4. Content sends `TRANSLATE_FRAGMENT` with the session `providerId` to background.
5. Background validates the selected provider, checks cache, queues the request, and calls `/chat/completions`.
6. Content sanitizes returned HTML and inserts a `.openread-translation-wrapper.notranslate` after the source block.
7. `STOP_TRANSLATION` disconnects observers and removes injected wrappers.

## Selection Translation Flow

1. Background registers a browser-native context menu item for selected text.
2. When the user chooses the menu item, background sends `OPEN_SELECTION_TRANSLATION` to the active tab with the selected plain text.
3. If the tab has no receiver yet, background injects the content script and retries once.
4. Content resolves the latest selection rect, translates the text through the existing `TRANSLATE_FRAGMENT` provider path, and renders a floating selection card near the selection.
5. Unpinned cards close when the user clicks elsewhere; pinned cards stay visible and reuse the same card for newly selected text on the page.

## Design Boundaries

- The model translates fragments; it does not decide which DOM nodes to translate.
- OpenRead never sends full page HTML in V1.
- API keys are stored only in `chrome.storage.local`.
- Rich HTML support is safe-list based and deliberately conservative.
- Provider profiles are global configuration, but provider selection is per page translation session. Do not route translation through a single global "last selected" provider.
- Selection translation is session-local page UI. Pinned cards are not persisted across refreshes in V1.

## V2 Direction

The next product layer should add a page floating toolbar, DOM inspector, multi-select translation regions, and reusable site plans. That layer should generate or edit deterministic site plans rather than letting an LLM directly manipulate the live DOM.
