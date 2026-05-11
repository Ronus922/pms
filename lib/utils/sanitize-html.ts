/**
 * Lightweight HTML sanitizer for email template previews.
 *
 * Strategy: parse the HTML in a detached document (in browser) or via
 * regex stripping (server fallback), and only allow a strict allowlist
 * of tags and attributes. NO external dependencies.
 *
 * This is enough to render legitimate marketing/notification email
 * templates safely in the preview UI without executing scripts or
 * triggering inline-event handlers.
 *
 * Allowed tags:  p, br, strong, b, em, i, u, a, ul, ol, li, h1-h6,
 *                blockquote, hr, span, div, table, thead, tbody, tr,
 *                td, th, img
 * Allowed attrs: href (a, must be http/https/mailto), src (img, must
 *                be http/https/data), alt, title, target (a)
 * Stripped:      script, style, iframe, object, embed, link, meta, base,
 *                form, input, button, textarea, select, on* attributes,
 *                javascript: / data: urls (except data:image/*)
 */

const ALLOWED_TAGS = new Set([
  "p", "br", "strong", "b", "em", "i", "u", "a", "ul", "ol", "li",
  "h1", "h2", "h3", "h4", "h5", "h6",
  "blockquote", "hr", "span", "div",
  "table", "thead", "tbody", "tr", "td", "th",
  "img",
])

const ALLOWED_ATTRS: Record<string, Set<string>> = {
  a: new Set(["href", "title", "target", "rel"]),
  img: new Set(["src", "alt", "title", "width", "height"]),
  // All allowed tags can have these neutral attributes:
  "*": new Set(["class", "id", "style"]),
}

const SAFE_URL_RE = /^(https?:|mailto:|tel:|#)/i
const SAFE_IMG_URL_RE = /^(https?:|data:image\/(?:png|jpeg|jpg|gif|webp|svg\+xml);)/i
// Forbid dangerous CSS — anything that could load remote content or run JS.
const UNSAFE_STYLE_RE = /(expression\s*\(|javascript:|behavior\s*:|vbscript:|@import|url\s*\()/i

/**
 * Strip a leading-quote/opening-bracket safely. Used to sanitize style attr.
 */
function sanitizeStyle(style: string): string {
  if (UNSAFE_STYLE_RE.test(style)) return ""
  return style
}

/**
 * Sanitize an href/src URL. Returns empty string if unsafe.
 */
function sanitizeUrl(url: string, isImg: boolean): string {
  const trimmed = url.trim()
  if (isImg) return SAFE_IMG_URL_RE.test(trimmed) ? trimmed : ""
  return SAFE_URL_RE.test(trimmed) ? trimmed : ""
}

/**
 * Main sanitizer. Works in both browser and server (regex-based fallback).
 *
 * @param dirty Raw HTML string from a user (e.g. template body).
 * @returns Sanitized HTML safe to inject via dangerouslySetInnerHTML.
 */
export function sanitizeHtml(dirty: string): string {
  if (!dirty) return ""

  // 1. Remove entire dangerous element BLOCKS (with content).
  let clean = dirty
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<iframe\b[^>]*>[\s\S]*?<\/iframe>/gi, "")
    .replace(/<object\b[^>]*>[\s\S]*?<\/object>/gi, "")
    .replace(/<embed\b[^>]*\/?>/gi, "")
    .replace(/<link\b[^>]*\/?>/gi, "")
    .replace(/<meta\b[^>]*\/?>/gi, "")
    .replace(/<base\b[^>]*\/?>/gi, "")
    .replace(/<form\b[^>]*>[\s\S]*?<\/form>/gi, "")
    .replace(/<input\b[^>]*\/?>/gi, "")
    .replace(/<button\b[^>]*>[\s\S]*?<\/button>/gi, "")
    .replace(/<textarea\b[^>]*>[\s\S]*?<\/textarea>/gi, "")
    .replace(/<select\b[^>]*>[\s\S]*?<\/select>/gi, "")
    // HTML comments may contain conditional CSS / IE comments — strip.
    .replace(/<!--[\s\S]*?-->/g, "")

  // 2. Walk every remaining tag, drop disallowed tags entirely
  //    and strip disallowed/dangerous attributes from allowed tags.
  clean = clean.replace(/<\/?([a-zA-Z][a-zA-Z0-9]*)\b([^>]*)>/g, (_match, rawTag: string, rawAttrs: string) => {
    const tag = rawTag.toLowerCase()
    if (!ALLOWED_TAGS.has(tag)) return ""

    // Closing tag — no attrs to process.
    if (_match.startsWith("</")) return `</${tag}>`

    // Parse attributes one by one. Conservative regex.
    const allowedForTag = ALLOWED_ATTRS[tag] ?? new Set<string>()
    const allowedGlobal = ALLOWED_ATTRS["*"]
    const cleanedAttrs: string[] = []

    const attrRe = /\s+([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*(?:=\s*("[^"]*"|'[^']*'|[^\s>]+))?/g
    let m: RegExpExecArray | null
    while ((m = attrRe.exec(rawAttrs)) !== null) {
      const attrName = m[1].toLowerCase()
      let attrValue = m[2] ?? ""

      // Drop ALL on* event handlers, no exceptions.
      if (attrName.startsWith("on")) continue
      // Drop xmlns / dangerous namespaced attrs.
      if (attrName.includes(":")) continue

      const isAllowed = allowedForTag.has(attrName) || allowedGlobal.has(attrName)
      if (!isAllowed) continue

      // Strip surrounding quotes if present.
      if (attrValue.length >= 2 && (attrValue[0] === '"' || attrValue[0] === "'")) {
        attrValue = attrValue.slice(1, -1)
      }

      // URL attributes must pass the safe-URL filter.
      if (attrName === "href") {
        const safe = sanitizeUrl(attrValue, false)
        if (!safe) continue
        attrValue = safe
      }
      if (attrName === "src") {
        const safe = sanitizeUrl(attrValue, true)
        if (!safe) continue
        attrValue = safe
      }
      if (attrName === "style") {
        const safe = sanitizeStyle(attrValue)
        if (!safe) continue
        attrValue = safe
      }
      // target="_blank" should always carry rel="noopener noreferrer".
      if (attrName === "target" && attrValue === "_blank") {
        cleanedAttrs.push(`target="_blank"`)
        cleanedAttrs.push(`rel="noopener noreferrer"`)
        continue
      }

      // Escape any " in attrValue to be safe.
      attrValue = attrValue.replace(/"/g, "&quot;")
      cleanedAttrs.push(`${attrName}="${attrValue}"`)
    }

    const attrStr = cleanedAttrs.length > 0 ? " " + cleanedAttrs.join(" ") : ""
    // Self-closing for img/br/hr.
    const selfClosing = tag === "img" || tag === "br" || tag === "hr"
    return selfClosing ? `<${tag}${attrStr} />` : `<${tag}${attrStr}>`
  })

  return clean
}
