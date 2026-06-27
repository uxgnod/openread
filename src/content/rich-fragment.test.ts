import { describe, expect, it } from "vitest"
import { extractRichFragment } from "./rich-fragment"

describe("extractRichFragment", () => {
  it("keeps inline code in source html and captures style hints", () => {
    document.body.innerHTML = `
      <p id="source">
        Calling
        <code
          class="language-plaintext highlighter-rouge"
          style="background-color: rgb(38, 27, 35); border-radius: 4px; color: rgb(255, 255, 255); display: inline-block; font-family: IBM Plex Mono, monospace; font-size: 13px; font-weight: 400; line-height: 23px; padding: 0px 6px;"
        >to_i</code>
        is useful.
      </p>
    `
    const source = document.getElementById("source") as HTMLElement

    const fragment = extractRichFragment(source)

    expect(fragment?.sourceHtml).toContain("<code")
    expect(fragment?.sourceHtml).toContain("to_i</code>")
    expect(fragment?.sourceHtml).not.toContain("language-plaintext")
    expect(fragment?.inlineCodeHints).toHaveLength(1)
    expect(fragment?.inlineCodeHints[0]).toMatchObject({
      tagName: "code",
      text: "to_i",
      style: {
        backgroundColor: "rgb(38, 27, 35)",
        borderRadius: "4px",
        color: "rgb(255, 255, 255)",
      },
    })
  })
})
