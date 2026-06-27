import { describe, expect, it } from "vitest"
import { collectTranslatableBlocks } from "./dom-walker"

describe("collectTranslatableBlocks", () => {
  it("skips code, form, hidden, and notranslate content", () => {
    document.body.innerHTML = `
      <main>
        <nav>
          <a href="/source">Source</a>
          <a href="/docs">Docs</a>
        </nav>
        <p>This paragraph should be translated because it has enough readable text.</p>
        <h6>Posted by Rails Foundation</h6>
        <p class="notranslate">This paragraph should not be translated.</p>
        <pre><code>This code should not be translated.</code></pre>
        <textarea>This textarea should not be translated.</textarea>
        <p style="display:none">This hidden paragraph should not be translated.</p>
      </main>
    `

    const blocks = collectTranslatableBlocks(document.body)

    expect(blocks).toHaveLength(4)
    expect(blocks[0].textContent).toContain("Source")
    expect(blocks[1].textContent).toContain("Docs")
    expect(blocks[2].textContent).toContain("This paragraph should be translated")
    expect(blocks[3].textContent).toContain("Posted by Rails Foundation")
  })

  it("translates simple linked list items through the link instead of the li", () => {
    document.body.innerHTML = `
      <main>
        <ul>
          <li id="speaker-item"><a id="speaker-link" href="/speaker">Aaron Patterson</a></li>
          <li id="plain-item">A plain list item with enough readable text.</li>
        </ul>
      </main>
    `

    const blocks = collectTranslatableBlocks(document.body)

    expect(blocks).toContain(document.getElementById("speaker-link"))
    expect(blocks).not.toContain(document.getElementById("speaker-item"))
    expect(blocks).toContain(document.getElementById("plain-item"))
  })
})
