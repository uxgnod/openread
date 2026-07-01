import { sendTabMessage } from "@/shared/messages"
import { CONFIG_STORAGE_KEY } from "@/shared/storage-keys"
import { DEFAULT_USER_CONFIG } from "@/shared/types"
import { getConfig } from "./config-store"

export const SELECTION_CONTEXT_MENU_ID = "openread-translate-selection"

export function registerSelectionContextMenu(): void {
  void refreshSelectionContextMenu()

  chrome.runtime.onInstalled.addListener(() => {
    void refreshSelectionContextMenu()
  })

  chrome.runtime.onStartup.addListener(() => {
    void refreshSelectionContextMenu()
  })

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === "local" && CONFIG_STORAGE_KEY in changes) {
      void refreshSelectionContextMenu()
    }
  })

  chrome.contextMenus.onClicked.addListener((info, tab) => {
    void handleSelectionContextMenuClick(info, tab)
  })
}

export async function refreshSelectionContextMenu(): Promise<void> {
  const config = await getConfig().catch(() => DEFAULT_USER_CONFIG)
  await ensureSelectionContextMenu(createSelectionContextMenuTitle(config.targetLanguage))
}

export function createSelectionContextMenuTitle(targetLanguage: string): string {
  const normalizedTargetLanguage = targetLanguage.trim() || DEFAULT_USER_CONFIG.targetLanguage
  return `使用 OpenRead 翻译为 ${normalizedTargetLanguage}`
}

async function handleSelectionContextMenuClick(
  info: chrome.contextMenus.OnClickData,
  tab?: chrome.tabs.Tab,
): Promise<void> {
  if (info.menuItemId !== SELECTION_CONTEXT_MENU_ID) {
    return
  }

  const sourceText = info.selectionText?.trim()
  if (!sourceText || !tab?.id) {
    return
  }

  await sendSelectionTranslationMessage(tab.id, sourceText).catch(error => {
    console.warn("OpenRead could not open the selection translation card.", error)
  })
}

async function sendSelectionTranslationMessage(tabId: number, sourceText: string): Promise<void> {
  try {
    await sendTabMessage(tabId, "OPEN_SELECTION_TRANSLATION", { sourceText })
  }
  catch (error) {
    if (!isMissingContentScriptError(error)) {
      throw error
    }

    await chrome.scripting.executeScript({
      files: ["content-scripts/content.js"],
      target: { tabId },
    })
    await sendTabMessage(tabId, "OPEN_SELECTION_TRANSLATION", { sourceText })
  }
}

function isMissingContentScriptError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error)
  return message.includes("Receiving end does not exist")
    || message.includes("Could not establish connection")
    || message.includes("No response received from OpenRead extension runtime")
}

async function ensureSelectionContextMenu(title: string): Promise<void> {
  await new Promise<void>(resolve => {
    chrome.contextMenus.update(SELECTION_CONTEXT_MENU_ID, { title }, () => {
      const updateError = chrome.runtime.lastError
      if (!updateError) {
        resolve()
        return
      }

      chrome.contextMenus.create({
        contexts: ["selection"],
        id: SELECTION_CONTEXT_MENU_ID,
        title,
      }, () => {
        resolve()
      })
    })
  })
}
