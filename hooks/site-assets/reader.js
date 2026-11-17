// 移动端整屏翻页（小说阅读器式）：正文用 CSS 多栏切成整屏页，拖动跟手、松手吸附；
// 页边点击翻页，点中间显示/隐藏底部工具条。桌面端完全不启用。
;(function () {
  const MOBILE = window.matchMedia("(max-width: 768px)")
  const HOST_SEL = ".md-content__inner"
  const state = {
    host: null,
    origin: null,
    reader: null,
    flow: null,
    bar: null,
    pages: 1,
    index: 0,
    colW: 0,
    drag: null,
    attempts: 0,
  }

  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))

  function buildBar(parent) {
    const bar = document.createElement("nav")
    bar.className = "xhs-bar"
    bar.id = "xhs-bar"
    bar.innerHTML =
      '<button type="button" class="xhs-bar__btn" data-act="toc">目录</button>' +
      '<button type="button" class="xhs-bar__btn" data-act="prev">上一页</button>' +
      '<span class="xhs-bar__count" aria-live="polite"></span>' +
      '<button type="button" class="xhs-bar__btn" data-act="next">下一页</button>'
    bar.addEventListener("click", (e) => {
      e.preventDefault()
      e.stopPropagation()
      const act = e.target.closest("[data-act]")?.dataset.act
      if (act === "prev") go(state.index - 1)
      else if (act === "next") go(state.index + 1)
      else if (act === "toc") toggle("__drawer")
    })
    parent.appendChild(bar)
    state.bar = bar
    return bar
  }

  // 直接翻 Material 的开关，不依赖被隐藏的 label
  function toggle(id) {
    const box = document.getElementById(id)
    if (!box) return
    box.checked = !box.checked
    box.dispatchEvent(new Event("change", { bubbles: true }))
  }

  function setUI(open) {
    document.documentElement.classList.toggle("xhs-ui", open)
  }

  function teardown() {
    if (state.host && state.origin) state.host.replaceChildren(...state.origin)
    if (state.reader) state.reader.remove()
    if (state.bar) state.bar.remove()
    document.documentElement.classList.remove("xhs-on", "xhs-ui")
    state.host = null
    state.origin = null
    state.reader = null
    state.flow = null
    state.bar = null
    state.pages = 1
    state.index = 0
  }

  function translate(px, animate) {
    if (!state.flow) return
    state.flow.style.transition = animate ? "transform .22s cubic-bezier(.25,.8,.3,1)" : "none"
    state.flow.style.transform = "translateX(" + px + "px)"
  }

  function go(i, animate = true) {
    if (!state.flow) return
    state.index = clamp(i, 0, state.pages - 1)
    translate(-state.index * state.colW, animate)
    if (state.bar) {
      state.bar.querySelector(".xhs-bar__count").textContent = state.index + 1 + " / " + state.pages
      state.bar.querySelector('[data-act="prev"]').disabled = state.index === 0
      state.bar.querySelector('[data-act="next"]').disabled = state.index === state.pages - 1
    }
    const chip = document.querySelector(".xhs-count")
    if (chip) chip.textContent = state.index + 1 + " / " + state.pages
  }

  function measure() {
    const flow = state.flow
    const width = flow.clientWidth
    if (!width) return
    flow.style.columnWidth = width + "px"
    flow.style.setProperty("--xhs-col", width + "px")
    state.colW = width

    // 超宽的公式块按栏宽等比缩小，避免被剪掉
    flow.querySelectorAll(".katex-display").forEach((d) => {
      d.style.fontSize = ""
      for (let i = 0; i < 2 && d.scrollWidth > d.clientWidth + 1; i += 1) {
        const k = d.clientWidth / d.scrollWidth
        const base = parseFloat(getComputedStyle(d).fontSize) * 0.96
        d.style.fontSize = Math.max(9, base * k).toFixed(1) + "px"
      }
    })

    const range = document.createRange()
    range.selectNodeContents(flow)
    const rect = range.getBoundingClientRect()
    const flowRect = flow.getBoundingClientRect()
    const used = rect.width + (rect.left - flowRect.left)
    state.pages = Math.max(1, Math.ceil((used - 1) / width))
  }

  function jumpToHash() {
    const id = decodeURIComponent(location.hash.replace(/^#/, ""))
    if (!id) return
    const target = document.getElementById(id)
    if (!target || !target.offsetParent) return
    go(Math.round(target.offsetLeft / state.colW), false)
  }

  function build() {
    const host = document.querySelector(HOST_SEL)
    if (!host) return
    if (!MOBILE.matches) {
      teardown()
      return
    }

    const keep = state.index
    teardown()
    state.host = host
    state.origin = Array.from(host.childNodes)

    const blocks = Array.from(host.children).filter(
      (el) => !/^(SCRIPT|STYLE|TEMPLATE|LINK)$/.test(el.tagName)
    )

    const reader = document.createElement("div")
    reader.className = "xhs-reader"
    const viewport = document.createElement("div")
    viewport.className = "xhs-viewport"
    const flow = document.createElement("div")
    flow.className = "xhs-flow"
    viewport.appendChild(flow)
    reader.appendChild(viewport)
    document.body.appendChild(reader)

    blocks.forEach((b) => flow.appendChild(b))
    flow.querySelectorAll("table").forEach((t) => {
      const box = document.createElement("div")
      box.className = "xhs-tablewrap"
      t.replaceWith(box)
      box.appendChild(t)
    })

    const count = document.createElement("div")
    count.className = "xhs-count"
    reader.appendChild(count)
    buildBar(reader)

    document.documentElement.classList.add("xhs-on")

    state.reader = reader
    state.flow = flow

    measure()
    go(clamp(keep, 0, state.pages - 1), false)
    if (location.hash) jumpToHash()

    bindGestures(viewport)

    // 字体、图片、公式晚到会改变栏宽与页数：重排并保留页码
    const settled = () => {
      if (!state.flow) return
      measure()
      go(clamp(state.index, 0, state.pages - 1), false)
    }
    if (state.attempts < 3) {
      state.attempts += 1
      setTimeout(settled, 300)
    }
  }

  function bindGestures(viewport) {
    let startX = 0
    let startY = 0
    let moved = false
    let horizontal = null

    viewport.addEventListener(
      "touchstart",
      (e) => {
        if (e.touches.length !== 1) return
        startX = e.touches[0].clientX
        startY = e.touches[0].clientY
        moved = false
        horizontal = null
        state.drag = { x: startX, t: Date.now(), target: e.target }
      },
      { passive: true }
    )

    viewport.addEventListener(
      "touchmove",
      (e) => {
        if (!state.drag) return
        const dx = e.touches[0].clientX - startX
        const dy = e.touches[0].clientY - startY
        if (horizontal === null && (Math.abs(dx) > 6 || Math.abs(dy) > 6)) {
          horizontal = Math.abs(dx) > Math.abs(dy)
        }
        if (!horizontal) return
        e.preventDefault()
        moved = true
        let offset = dx
        if ((state.index === 0 && dx > 0) || (state.index === state.pages - 1 && dx < 0)) {
          offset = dx * 0.35
        }
        translate(-state.index * state.colW + offset, false)
      },
      { passive: false }
    )

    viewport.addEventListener("touchend", (e) => {
      if (!state.drag) return
      const dx = e.changedTouches[0].clientX - startX
      const dy = e.changedTouches[0].clientY - startY
      const dt = Math.max(1, Date.now() - state.drag.t)
      const tapTarget = state.drag.target
      state.drag = null

      if (moved && horizontal) {
        const velocity = Math.abs(dx) / dt
        const flip = Math.abs(dx) > state.colW * 0.18 || velocity > 0.4
        if (flip) go(state.index + (dx < 0 ? 1 : -1))
        else go(state.index)
        return
      }

      // 点在链接或控件上：交给它们自己处理，不翻页
      if (tapTarget && tapTarget.closest("a, button, summary, label, input")) return

      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) {
        const x = e.changedTouches[0].clientX
        if (x < window.innerWidth * 0.3) go(state.index - 1)
        else if (x > window.innerWidth * 0.7) go(state.index + 1)
        else setUI(!document.documentElement.classList.contains("xhs-ui"))
      }
    })
  }

  let timer
  function schedule() {
    clearTimeout(timer)
    timer = setTimeout(build, 180)
  }

  function onKey(e) {
    if (!state.reader) return
    if (e.key === "ArrowRight" || e.key === "PageDown") go(state.index + 1)
    else if (e.key === "ArrowLeft" || e.key === "PageUp") go(state.index - 1)
  }

  document.addEventListener("keydown", onKey)
  MOBILE.addEventListener("change", schedule)
  window.addEventListener("resize", () => {
    clearTimeout(timer)
    timer = setTimeout(() => {
      if (!state.flow) return build()
      measure()
      go(clamp(state.index, 0, state.pages - 1), false)
    }, 180)
  })
  window.addEventListener("load", schedule)
  if (document.fonts) document.fonts.ready.then(schedule)
  if (typeof window.document$ !== "undefined" && typeof document$.subscribe === "function") {
    document$.subscribe(() => {
      schedule()
      setTimeout(schedule, 700)
    })
  } else {
    document.addEventListener("DOMContentLoaded", schedule)
  }
})()
