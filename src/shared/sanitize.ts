const ALLOWED_TAGS = new Set([
  "A",
  "STRONG",
  "B",
  "EM",
  "I",
  "SPAN",
  "BR",
  "SMALL",
  "SUP",
  "SUB",
  "CODE",
  "KBD",
  "SAMP",
  "VAR",
])
const DROP_TAGS = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "IFRAME", "OBJECT", "EMBED"])
const VOID_TAGS = new Set(["BR"])
const ALLOWED_STYLE_PROPERTIES = new Set([
  "color",
  "background-color",
  "font-weight",
  "font-style",
  "font-family",
  "font-size",
  "line-height",
  "text-decoration",
  "vertical-align",
  "white-space",
  "border-radius",
  "padding",
  "display",
])

export function htmlToText(html: string): string {
  const container = document.createElement("div")
  container.innerHTML = html
  return container.textContent?.trim() ?? ""
}

export function sanitizeRichHtml(input: string): string {
  const template = document.createElement("template")
  template.innerHTML = input

  sanitizeChildren(template.content)
  return template.innerHTML.trim()
}

function sanitizeChildren(parent: ParentNode): void {
  for (const child of [...parent.childNodes]) {
    if (child.nodeType === Node.TEXT_NODE) {
      continue
    }

    if (child.nodeType !== Node.ELEMENT_NODE) {
      child.remove()
      continue
    }

    const element = child as HTMLElement
    if (!ALLOWED_TAGS.has(element.tagName)) {
      if (DROP_TAGS.has(element.tagName)) {
        element.remove()
      }
      else {
        unwrapElement(element)
      }
      continue
    }

    sanitizeElement(element)
    if (!VOID_TAGS.has(element.tagName)) {
      sanitizeChildren(element)
    }
  }
}

function unwrapElement(element: HTMLElement): void {
  const parent = element.parentNode
  if (!parent) {
    element.remove()
    return
  }

  const fragment = document.createDocumentFragment()
  while (element.firstChild) {
    fragment.appendChild(element.firstChild)
  }
  sanitizeChildren(fragment)
  parent.insertBefore(fragment, element)
  parent.removeChild(element)
}

function sanitizeElement(element: HTMLElement): void {
  for (const attribute of [...element.attributes]) {
    const name = attribute.name.toLowerCase()
    if (element.tagName === "A" && name === "href") {
      if (!isSafeHref(attribute.value)) {
        element.removeAttribute(attribute.name)
      }
      continue
    }

    if (name === "style") {
      const style = sanitizeStyle(attribute.value)
      if (style) {
        element.setAttribute("style", style)
      }
      else {
        element.removeAttribute(attribute.name)
      }
      continue
    }

    element.removeAttribute(attribute.name)
  }

  if (element.tagName === "A" && element.hasAttribute("href")) {
    element.setAttribute("target", "_blank")
    element.setAttribute("rel", "noreferrer noopener")
  }
}

function isSafeHref(value: string): boolean {
  const trimmed = value.trim().toLowerCase()
  return (
    trimmed.startsWith("http://")
    || trimmed.startsWith("https://")
    || trimmed.startsWith("mailto:")
    || trimmed.startsWith("#")
    || trimmed.startsWith("/")
  )
}

function sanitizeStyle(value: string): string {
  const probe = document.createElement("span")
  probe.setAttribute("style", value)
  const safe: string[] = []

  for (const property of ALLOWED_STYLE_PROPERTIES) {
    const propertyValue = probe.style.getPropertyValue(property)
    if (!propertyValue) {
      continue
    }
    if (/url\s*\(/i.test(propertyValue) || /expression\s*\(/i.test(propertyValue)) {
      continue
    }
    if (property === "display" && !["inline", "inline-block"].includes(propertyValue)) {
      continue
    }
    safe.push(`${property}: ${propertyValue}`)
  }

  return safe.join("; ")
}
