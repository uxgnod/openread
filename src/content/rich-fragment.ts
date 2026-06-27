import { sanitizeRichHtml, htmlToText } from "@/shared/sanitize"
import { OPENREAD_SOURCE_CLASS } from "@/shared/dom-rules"

export interface RichFragment {
  sourceHtml: string
  sourceText: string
  inlineCodeHints: InlineCodeHint[]
}

export interface InlineCodeHint {
  tagName: "code" | "kbd" | "samp" | "var"
  text: string
  style: InlineCodeStyleHint
}

export interface InlineCodeStyleHint {
  backgroundColor: string
  borderRadius: string
  color: string
  display: string
  fontFamily: string
  fontSize: string
  fontWeight: string
  lineHeight: string
  padding: string
}

export function extractRichFragment(element: HTMLElement): RichFragment | null {
  const inlineCodeHints = extractInlineCodeHints(element)
  const sourceElement = getSourceElement(element)
  const sourceHtml = sanitizeRichHtml(sourceElement.innerHTML)
  const sourceText = (htmlToText(sourceHtml) || element.innerText || element.textContent || "").trim()

  if (!sourceHtml || !sourceText) {
    return null
  }

  return {
    sourceHtml,
    sourceText,
    inlineCodeHints,
  }
}

function getSourceElement(element: HTMLElement): HTMLElement {
  return [...element.children].find((child): child is HTMLElement =>
    child instanceof HTMLElement && child.classList.contains(OPENREAD_SOURCE_CLASS),
  ) ?? element
}

function extractInlineCodeHints(element: HTMLElement): InlineCodeHint[] {
  const hints: InlineCodeHint[] = []

  for (const node of [...element.querySelectorAll<HTMLElement>("code,kbd,samp,var")]) {
    const text = node.textContent?.replace(/\s+/g, " ").trim()
    if (!text) {
      continue
    }

    const tagName = node.tagName.toLowerCase() as InlineCodeHint["tagName"]
    const style = window.getComputedStyle(node)
    hints.push({
      tagName,
      text,
      style: {
        backgroundColor: style.backgroundColor,
        borderRadius: style.borderRadius,
        color: style.color,
        display: style.display,
        fontFamily: style.fontFamily,
        fontSize: style.fontSize,
        fontWeight: style.fontWeight,
        lineHeight: style.lineHeight,
        padding: style.padding,
      },
    })
  }

  return hints
}
