/**
 * Freebuff RTL Injector — rtl.js
 *
 * Runs inside the renderer (injected via executeJavaScript by loader.cjs).
 * `window.__freebuffRtlConfig` is set right before this file by the loader.
 *
 * Freebuff has no RTL awareness at all, so instead of relying on Freebuff
 * to set dir/lang attributes, this script:
 *   1. Scans text nodes for RTL scripts (Persian/Arabic/Hebrew Unicode
 *      ranges) and tags their nearest reasonable block ancestor with
 *      data-freebuff-rtl="true"/"false".
 *   2. Re-runs on every DOM mutation (MutationObserver) since Freebuff is
 *      a React SPA — messages, tabs, and panels mount/unmount constantly.
 *   3. Watches focused <input>/<textarea> content live (input event) so
 *      the composer flips as the user types, not just after send.
 *   4. Is idempotent and cheap: a WeakSet tracks already-tagged nodes so
 *      the observer doesn't re-scan the whole DOM on every keystroke.
 */

;(function () {
  if (window.__freebuffRtlInstalled) return
  window.__freebuffRtlInstalled = true

  const config = window.__freebuffRtlConfig || { enabled: true, mode: 'auto', forceDir: null }
  if (!config.enabled) return

  // Persian, Arabic, Hebrew, and their presentation-form/extended blocks.
  const RTL_RE =
    /[\u0591-\u07FF\u200F\u202B\u202E\uFB1D-\uFDFD\uFE70-\uFEFC]/

  // A "run" that should stay LTR even inside an RTL block: URLs, file
  // paths, and bare numbers. Used to wrap spans so bidi doesn't reorder
  // them visually (see rtl.css section 2).
  const LTR_RUN_RE = /(\bhttps?:\/\/\S+|\b[A-Za-z]:\\[^\s]+|\B\/[\w./-]+|\b\d[\d,.:]*\b)/g

  function scriptDirection(text) {
    // Ignore whitespace-only / pure-symbol text — not a signal either way.
    const meaningful = text.replace(/[\s\d.,!?;:()[\]{}'"@#$%^&*_+=<>/\\|~`-]/g, '')
    if (!meaningful) return null
    return RTL_RE.test(meaningful) ? 'rtl' : 'ltr'
  }

  // Elements we should never tag directly (their content dir is handled
  // by rtl.css exceptions, or tagging them would break layout/functionality).
  const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'PRE', 'CODE', 'SVG', 'CANVAS', 'IFRAME'])

  function nearestTaggableAncestor(node) {
    let el = node.nodeType === Node.TEXT_NODE ? node.parentElement : node
    let depth = 0
    while (el && depth < 6) {
      if (SKIP_TAGS.has(el.tagName)) return null
      // Prefer a block-ish ancestor over the immediate <span> a framework
      // might re-render every keystroke — reduces DOM churn from this script.
      const display = window.getComputedStyle(el).display
      if (display === 'block' || display === 'flex' || display === 'list-item') {
        return el
      }
      el = el.parentElement
      depth++
    }
    return node.nodeType === Node.TEXT_NODE ? node.parentElement : node
  }

  function tag(el, dir) {
    if (!el || el.getAttribute('data-freebuff-rtl') === String(dir === 'rtl')) return
    el.setAttribute('data-freebuff-rtl', dir === 'rtl' ? 'true' : 'false')
    if (dir === 'rtl') el.setAttribute('dir', 'rtl')
    else if (el.getAttribute('dir') === 'rtl') el.removeAttribute('dir')
  }

  function wrapLtrRuns(el) {
    // Only bother inside elements we just marked RTL — cheap guard.
    if (el.getAttribute('data-freebuff-rtl') !== 'true') return
    if (el.querySelector('pre, code, input, textarea')) return // don't touch code/inputs
    if (el.dataset.freebuffRtlWrapped === '1') return
    el.dataset.freebuffRtlWrapped = '1'
    // Walk direct text nodes only — shallow, cheap, avoids re-wrapping
    // nested already-tagged children.
    Array.from(el.childNodes).forEach((child) => {
      if (child.nodeType !== Node.TEXT_NODE) return
      if (!LTR_RUN_RE.test(child.textContent)) return
      const frag = document.createDocumentFragment()
      let lastIndex = 0
      child.textContent.replace(LTR_RUN_RE, (match, _g, offset) => {
        if (offset > lastIndex) {
          frag.appendChild(document.createTextNode(child.textContent.slice(lastIndex, offset)))
        }
        const span = document.createElement('span')
        span.className = 'freebuff-rtl-ltr-run'
        span.textContent = match
        frag.appendChild(span)
        lastIndex = offset + match.length
        return match
      })
      if (lastIndex < child.textContent.length) {
        frag.appendChild(document.createTextNode(child.textContent.slice(lastIndex)))
      }
      child.replaceWith(frag)
    })
  }

  const seen = new WeakSet()

  function scanTextNode(textNode) {
    if (seen.has(textNode)) return
    const text = textNode.textContent
    if (!text || !text.trim()) return
    const dir = config.forceDir || scriptDirection(text)
    if (!dir) return
    seen.add(textNode)
    const target = nearestTaggableAncestor(textNode)
    if (!target) return
    tag(target, dir)
    if (dir === 'rtl') wrapLtrRuns(target)
  }

  function scanSubtree(root) {
    if (!root || root.nodeType === Node.COMMENT_NODE) return
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const parentTag = node.parentElement && node.parentElement.tagName
        if (parentTag && SKIP_TAGS.has(parentTag)) return NodeFilter.FILTER_REJECT
        return NodeFilter.FILTER_ACCEPT
      },
    })
    let n
    while ((n = walker.nextNode())) scanTextNode(n)
  }

  // Initial pass.
  scanSubtree(document.body)

  // React re-renders constantly — observe and re-scan only added subtrees,
  // debounced so a burst of mutations (streaming LLM output) doesn't
  // thrash layout.
  let pending = null
  const observer = new MutationObserver((mutations) => {
    if (pending) return
    pending = requestAnimationFrame(() => {
      pending = null
      for (const m of mutations) {
        m.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE || node.nodeType === Node.TEXT_NODE) {
            scanSubtree(node)
          }
        })
        // Text content changed in place (e.g. streaming tokens appended
        // to an existing node) — characterData mutations target the text
        // node itself.
        if (m.type === 'characterData' && m.target) {
          seen.delete(m.target) // allow re-check since content changed
          scanTextNode(m.target)
        }
      }
    })
  })
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true,
  })

  // Live-flip the composer while typing, independent of the mutation
  // observer (input value changes don't always fire text-node mutations
  // the same way, especially in controlled React inputs).
  function bindLiveInput(el) {
    if (!el || el.dataset.freebuffRtlBound === '1') return
    if (el.tagName !== 'TEXTAREA' && el.tagName !== 'INPUT') return
    el.dataset.freebuffRtlBound = '1'
    const update = () => {
      const value = 'value' in el ? el.value : el.textContent
      const dir = scriptDirection(value || '')
      if (dir) tag(el, dir)
    }
    el.addEventListener('input', update)
    update()
  }

  document.addEventListener(
    'focusin',
    (e) => bindLiveInput(e.target),
    true
  )
  // Contenteditable composers (some chat UIs use a div instead of textarea).
  document.addEventListener(
    'input',
    (e) => {
      const el = e.target
      if (el && el.isContentEditable) {
        const dir = scriptDirection(el.textContent || '')
        if (dir) tag(el, dir)
      }
    },
    true
  )

  console.log('[freebuff-rtl] installed — mode:', config.mode)
})()
