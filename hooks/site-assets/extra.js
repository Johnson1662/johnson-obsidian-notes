// KaTeX 渲染，跟随 Material 的 instant navigation 重新执行。
// Mermaid 由 Material 内置集成处理（它会自己把 pre.mermaid 渲染成 SVG），这里不要插手。

const MATH_CONFIG = {
  delimiters: [
    { left: "$$", right: "$$", display: true },
    { left: "\\[", right: "\\]", display: true },
    { left: "$", right: "$", display: false },
    { left: "\\(", right: "\\)", display: false },
  ],
  throwOnError: false,
  strict: "ignore",
  ignoredTags: ["script", "noscript", "style", "textarea", "pre", "code", "option"],
}

function renderMath() {
  if (typeof window.renderMathInElement !== "function") return
  window.renderMathInElement(document.body, MATH_CONFIG)
}

if (typeof window.document$ !== "undefined" && typeof document$.subscribe === "function") {
  document$.subscribe(renderMath)
} else {
  document.addEventListener("DOMContentLoaded", renderMath)
}
