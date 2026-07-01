import { afterEach, describe, expect, it, vi } from "vitest"
import { CONFIG_STORAGE_KEY } from "@/shared/storage-keys"
import { DEFAULT_USER_CONFIG } from "@/shared/types"
import {
  SELECTION_CONTEXT_MENU_ID,
  createSelectionContextMenuTitle,
  refreshSelectionContextMenu,
  registerSelectionContextMenu,
} from "./context-menu"

describe("selection context menu", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("creates a selection-only menu with the configured target language", async () => {
    const chromeMock = stubChrome({ targetLanguage: "Japanese", updateFails: true })

    await refreshSelectionContextMenu()

    expect(chromeMock.contextMenus.update).toHaveBeenCalledWith(
      SELECTION_CONTEXT_MENU_ID,
      { title: "使用 OpenRead 翻译为 Japanese" },
      expect.any(Function),
    )
    expect(chromeMock.contextMenus.create).toHaveBeenCalledWith(
      {
        contexts: ["selection"],
        id: SELECTION_CONTEXT_MENU_ID,
        title: "使用 OpenRead 翻译为 Japanese",
      },
      expect.any(Function),
    )
  })

  it("updates the menu title when the menu already exists", async () => {
    const chromeMock = stubChrome({ targetLanguage: "French", updateFails: false })

    await refreshSelectionContextMenu()

    expect(chromeMock.contextMenus.update).toHaveBeenCalledWith(
      SELECTION_CONTEXT_MENU_ID,
      { title: "使用 OpenRead 翻译为 French" },
      expect.any(Function),
    )
    expect(chromeMock.contextMenus.create).not.toHaveBeenCalled()
  })

  it("sends selected text to the active tab when the menu is clicked", async () => {
    const chromeMock = stubChrome({ targetLanguage: "Simplified Chinese", updateFails: false })
    registerSelectionContextMenu()

    chromeMock.clickContextMenu({
      editable: false,
      menuItemId: SELECTION_CONTEXT_MENU_ID,
      pageUrl: "https://example.com",
      selectionText: "  Hello world  ",
    }, { id: 42 } as chrome.tabs.Tab)
    await flushPromises()

    expect(chromeMock.tabs.sendMessage).toHaveBeenCalledWith(42, {
      payload: { sourceText: "Hello world" },
      type: "OPEN_SELECTION_TRANSLATION",
    })
  })

  it("injects the content script and retries when the page has no receiver yet", async () => {
    const chromeMock = stubChrome({ targetLanguage: "Simplified Chinese", updateFails: false })
    chromeMock.tabs.sendMessage
      .mockRejectedValueOnce(new Error("Could not establish connection. Receiving end does not exist."))
      .mockResolvedValueOnce({ ok: true, data: { cardId: "card-1" } })
    registerSelectionContextMenu()

    chromeMock.clickContextMenu({
      editable: false,
      menuItemId: SELECTION_CONTEXT_MENU_ID,
      pageUrl: "https://example.com",
      selectionText: "Hello world",
    }, { id: 42 } as chrome.tabs.Tab)
    await flushPromises()

    expect(chromeMock.scripting.executeScript).toHaveBeenCalledWith({
      files: ["content-scripts/content.js"],
      target: { tabId: 42 },
    })
    expect(chromeMock.tabs.sendMessage).toHaveBeenCalledTimes(2)
  })

  it("falls back to the default target language in the menu title", () => {
    expect(createSelectionContextMenuTitle("  ")).toBe("使用 OpenRead 翻译为 Simplified Chinese")
  })
})

function stubChrome({
  targetLanguage,
  updateFails,
}: {
  targetLanguage: string
  updateFails: boolean
}) {
  let onClicked: ((info: chrome.contextMenus.OnClickData, tab?: chrome.tabs.Tab) => void) | undefined
  const runtime = {
    lastError: undefined as chrome.runtime.LastError | undefined,
    onInstalled: { addListener: vi.fn() },
    onStartup: { addListener: vi.fn() },
  }
  const contextMenus = {
    create: vi.fn((_props: chrome.contextMenus.CreateProperties, callback?: () => void) => {
      callback?.()
    }),
    onClicked: {
      addListener: vi.fn((callback: (info: chrome.contextMenus.OnClickData, tab?: chrome.tabs.Tab) => void) => {
        onClicked = callback
      }),
    },
    update: vi.fn((_id: string, _props: chrome.contextMenus.UpdateProperties, callback?: () => void) => {
      runtime.lastError = updateFails ? { message: "Menu not found." } : undefined
      callback?.()
      runtime.lastError = undefined
    }),
  }
  const tabs = {
    sendMessage: vi.fn(async () => ({ ok: true, data: { cardId: "card-1" } })),
  }
  const scripting = {
    executeScript: vi.fn(async () => []),
  }
  const chromeMock = {
    contextMenus,
    runtime,
    scripting,
    storage: {
      local: {
        get: vi.fn(async () => ({
          [CONFIG_STORAGE_KEY]: {
            ...DEFAULT_USER_CONFIG,
            targetLanguage,
          },
        })),
      },
      onChanged: { addListener: vi.fn() },
    },
    tabs,
  }

  vi.stubGlobal("chrome", chromeMock)

  return {
    ...chromeMock,
    clickContextMenu(info: chrome.contextMenus.OnClickData, tab?: chrome.tabs.Tab) {
      onClicked?.(info, tab)
    },
  }
}

async function flushPromises(): Promise<void> {
  await Promise.resolve()
  await Promise.resolve()
}
