import { describe, expect, it, vi, beforeEach } from "vitest"
import { CONFIG_STORAGE_KEY } from "@/shared/storage-keys"
import { DEFAULT_USER_CONFIG } from "@/shared/types"
import { getConfig, saveConfig } from "./config-store"

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

  it("preserves progress position and interface locale when saving and reading config", async () => {
    const saved = await saveConfig({
      ...DEFAULT_USER_CONFIG,
      progressPosition: "top-right",
      uiLocale: "ru",
    })

    expect(saved.progressPosition).toBe("top-right")
    expect(saved.uiLocale).toBe("ru")
    expect((storage[CONFIG_STORAGE_KEY] as typeof DEFAULT_USER_CONFIG).progressPosition).toBe("top-right")
    expect((storage[CONFIG_STORAGE_KEY] as typeof DEFAULT_USER_CONFIG).uiLocale).toBe("ru")

    const loaded = await getConfig()

    expect(loaded.progressPosition).toBe("top-right")
    expect(loaded.uiLocale).toBe("ru")
  })
})
