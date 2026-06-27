import { OPENREAD_WRAPPER_CLASS, SKIP_TAGS, TRANSLATABLE_BLOCK_SELECTOR } from "@/shared/dom-rules"

const MIN_TEXT_LENGTH = 8
const MIN_NAVIGATION_TEXT_LENGTH = 2

export function collectTranslatableBlocks(root: ParentNode = document.body): HTMLElement[] {
  const candidates = [...root.querySelectorAll<HTMLElement>(TRANSLATABLE_BLOCK_SELECTOR)]
  return candidates.filter(isTranslatableBlock)
}

export function isTranslatableBlock(element: HTMLElement): boolean {
  if (shouldSkipElement(element)) {
    return false
  }

  if (element.closest(`.${OPENREAD_WRAPPER_CLASS}`)) {
    return false
  }

  if (isSimpleLinkedListItem(element)) {
    return false
  }

  const text = getElementText(element)
  const minLength = isShortInlineTextElement(element) ? MIN_NAVIGATION_TEXT_LENGTH : MIN_TEXT_LENGTH
  if (text.length < minLength) {
    return false
  }

  if (/^[\d\s.,:%/+\-()]+$/.test(text)) {
    return false
  }

  return true
}

export function isNavigationTextElement(element: HTMLElement): boolean {
  return element.tagName === "A" && !!element.closest("header,nav,footer")
}

export function isSimpleListLinkElement(element: HTMLElement): boolean {
  if (element.tagName !== "A" || element.parentElement?.tagName !== "LI") {
    return false
  }

  return getOnlyElementChild(element.parentElement) === element
}

function getElementText(element: HTMLElement): string {
  return (element.innerText || element.textContent || "").replace(/\s+/g, " ").trim()
}

function isShortInlineTextElement(element: HTMLElement): boolean {
  return isNavigationTextElement(element) || isSimpleListLinkElement(element)
}

function isSimpleLinkedListItem(element: HTMLElement): boolean {
  return element.tagName === "LI" && getOnlyElementChild(element)?.tagName === "A"
}

function getOnlyElementChild(element: HTMLElement): Element | null {
  const meaningfulChildren = [...element.childNodes].filter(node => {
    if (node.nodeType === Node.TEXT_NODE) {
      return !!node.textContent?.trim()
    }
    return node.nodeType === Node.ELEMENT_NODE
  })

  if (meaningfulChildren.length !== 1) {
    return null
  }

  const child = meaningfulChildren[0]
  return child.nodeType === Node.ELEMENT_NODE ? child as Element : null
}

export function shouldSkipElement(element: HTMLElement): boolean {
  if (SKIP_TAGS.has(element.tagName)) {
    return true
  }

  if (element.closest(".notranslate,[translate='no']")) {
    return true
  }

  if (!element.isConnected) {
    return true
  }

  const style = window.getComputedStyle(element)
  if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") {
    return true
  }

  return false
}
