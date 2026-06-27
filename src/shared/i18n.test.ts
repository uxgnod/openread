import { describe, expect, it } from "vitest"
import { SUPPORTED_UI_LOCALES, resolveUiLocale, t } from "./i18n"

describe("i18n", () => {
  it("ships ten interface locales including Chinese, English, and Russian", () => {
    expect(SUPPORTED_UI_LOCALES).toHaveLength(10)
    expect(SUPPORTED_UI_LOCALES.map(locale => locale.code)).toEqual([
      "en",
      "zh-CN",
      "zh-TW",
      "ru",
      "ja",
      "ko",
      "es",
      "fr",
      "de",
      "vi",
    ])
  })

  it("resolves automatic locale from browser language", () => {
    expect(resolveUiLocale("auto", "zh-Hant-TW")).toBe("zh-TW")
    expect(resolveUiLocale("auto", "zh-Hans-CN")).toBe("zh-CN")
    expect(resolveUiLocale("auto", "ru-RU")).toBe("ru")
    expect(resolveUiLocale("auto", "pl-PL")).toBe("en")
  })

  it("formats localized messages with variables", () => {
    expect(t("zh-CN", "progressLabel", { percent: 25 })).toBe("25%")
    expect(t("en", "translationFailed", { message: "timeout" })).toBe("Translation failed: timeout")
  })
})
