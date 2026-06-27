import { describe, expect, it, vi, beforeEach } from "vitest"
import { CONFIG_STORAGE_KEY } from "@/shared/storage-keys"
import { DEFAULT_USER_CONFIG } from "@/shared/types"
import { assertUsableConfig, getConfig, saveConfig } from "./config-store"

describe("config store", () => {
  let storage: Record<string, unknown>

  beforeEach(() => {
    storage = {}
    vi.stubGlobal("chrome", {
      storage: {
        local: {
          get: vi.fn(async (key: string) => ({ [key]: storage[key] })),
          set: vi.fn(async (value: Record<string, unknown>) => {
            storage = { ...storage, ...value }
          }),
        },
      },
    })
  })

  it("preserves input translation, progress position, and interface locale when saving and reading config", async () => {
    const saved = await saveConfig({
      ...DEFAULT_USER_CONFIG,
      inputTranslationEnabled: false,
      progressPosition: "top-right",
      uiLocale: "ru",
    })

    expect(saved.inputTranslationEnabled).toBe(false)
    expect(saved.progressPosition).toBe("top-right")
    expect(saved.uiLocale).toBe("ru")
    expect((storage[CONFIG_STORAGE_KEY] as typeof DEFAULT_USER_CONFIG).inputTranslationEnabled).toBe(false)
    expect((storage[CONFIG_STORAGE_KEY] as typeof DEFAULT_USER_CONFIG).progressPosition).toBe("top-right")
    expect((storage[CONFIG_STORAGE_KEY] as typeof DEFAULT_USER_CONFIG).uiLocale).toBe("ru")

    const loaded = await getConfig()

    expect(loaded.inputTranslationEnabled).toBe(false)
    expect(loaded.progressPosition).toBe("top-right")
    expect(loaded.uiLocale).toBe("ru")
  })

  it("allows a request-level target language override for input translation", () => {
    expect(() => assertUsableConfig(
      {
        ...DEFAULT_USER_CONFIG,
        targetLanguage: "",
        providers: [{ ...DEFAULT_USER_CONFIG.providers[0], apiKey: "test-key" }],
      },
      DEFAULT_USER_CONFIG.providers[0].id,
      "English",
    )).not.toThrow()
  })
})
