import { describe, expect, it } from "vitest"
import { sanitizeRichHtml } from "./sanitize"

describe("sanitizeRichHtml", () => {
  it("keeps safe inline tags and link hrefs", () => {
    const html = sanitizeRichHtml(
      `Hello <a href="https://example.com" onclick="x()">link</a> <strong>bold</strong>`,
    )

    expect(html).toContain(`<a href="https://example.com" target="_blank" rel="noreferrer noopener">link</a>`)
    expect(html).toContain("<strong>bold</strong>")
    expect(html).not.toContain("onclick")
  })

  it("unwraps unsupported tags and removes unsafe hrefs", () => {
    const html = sanitizeRichHtml(`<div>Text <script>alert(1)</script><a href="javascript:alert(1)">bad</a></div>`)

    expect(html).toContain("Text")
    expect(html).toContain("<a>bad</a>")
    expect(html).not.toContain("script")
    expect(html).not.toContain("javascript")
  })

  it("keeps safe inline code tags and removes unsafe attributes", () => {
    const html = sanitizeRichHtml(
      `<code class="language-plaintext" onclick="x()" style="background-color: rgb(38, 27, 35); border-radius: 4px; display: inline-block; position: fixed">to_i</code>`,
    )

    expect(html).toContain("<code")
    expect(html).toContain("to_i</code>")
    expect(html).toContain("background-color: rgb(38, 27, 35)")
    expect(html).toContain("border-radius: 4px")
    expect(html).toContain("display: inline-block")
    expect(html).not.toContain("onclick")
    expect(html).not.toContain("class")
    expect(html).not.toContain("position")
  })
})
