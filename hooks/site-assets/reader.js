// 移动端翻页阅读：把正文按块切成一屏一页，左右滑/按键翻页；桌面端完全不启用。
// 无 JS 或超宽屏时保持原有整页滚动。
;(function () {
  const MOBILE = window.matchMedia("(max-width: 768px)")
  const HOST_SEL = ".md-content__inner"
  const state = { host: null, origin: null, reader: null, track: null, pages: [], index: 0, bar: null }

  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))

  function pageCount() {
    return state.pages.length
  }

  function buildBar() {
    if (state.bar) return state.bar

    const bar = document.createElement("nav")
    bar.className = "xhs-bar"
    bar.id = "xhs-bar"
    bar.innerHTML =
      '<button type="button" class="xhs-bar__btn" data-act="toc">目录</button>' +
      '<button type="button" class="xhs-bar__btn" data-act="prev">上一页</button>' +
      '<span class="xhs-bar__count" aria-live="polite"></span>' +
      '<button type="button" class="xhs-bar__btn" data-act="next">下一页</button>'
    bar.addEventListener("click", (e) => {
      const act = e.target.closest("[data-act]")?.dataset.act
      if (act === "prev") go(state.index - 1)
      else if (act === "next") go(state.index + 1)
      else if (act === "toc") document.querySelector('[for="__drawer"]')?.click()
    })
    document.body.appendChild(bar)
    state.bar = bar
    return bar
  }

  function teardown() {
    if (state.host && state.origin) state.host.replaceChildren(...state.origin)
    if (state.reader) state.reader.remove()
    if (state.bar) state.bar.remove()
    document.documentElement.classList.remove("xhs-on")
    state.host = null
    state.origin = null
    state.reader = null
    state.track = null
    state.pages = []
    state.index = 0
    state.bar = null
  }

  function go(i) {
    if (!pageCount()) return
    state.index = clamp(i, 0, pageCount() - 1)
    state.track.style.transform = "translateX(" + -state.index * 100 + "%)"
    state.bar.querySelector(".xhs-bar__count").textContent =
      state.index + 1 + " / " + pageCount()
    state.bar.querySelector('[data-act="prev"]').disabled = state.index === 0
    state.bar.querySelector('[data-act="next"]').disabled = state.index === pageCount() - 1
    const page = state.pages[state.index]
    if (page) page.scrollTop = 0
  }

  function jumpToHash() {
    const id = decodeURIComponent(location.hash.replace(/^#/, ""))
    if (!id) return
    const target = document.getElementById(id)
    if (!target) return
    const idx = state.pages.findIndex((p) => p.contains(target))
    if (idx >= 0) go(idx)
  }

  function newPage() {
    const page = document.createElement("section")
    page.className = "xhs-page"
    page.appendChild(document.createElement("div"))
    return page
  }

  function build() {
    const host = document.querySelector(HOST_SEL)
    if (!host) return
    if (!MOBILE.matches) {
      teardown()
      return
    }

    const restoreTo = state.index
    teardown()
    state.host = host
    state.origin = Array.from(host.childNodes)

    const header = document.querySelector(".md-header")
    const bar = buildBar()
    const headerH = header ? header.getBoundingClientRect().height : 56
    const barH = bar.getBoundingClientRect().height || 52
    const viewH = (window.visualViewport && window.visualViewport.height) || window.innerHeight
    const pageH = Math.max(240, Math.round(viewH - headerH - barH))

    const blocks = Array.from(host.children).filter(
      (el) => !/^(SCRIPT|STYLE|TEMPLATE|LINK)$/.test(el.tagName)
    )

    const reader = document.createElement("div")
    reader.className = "xhs-reader"
    reader.style.height = pageH + "px"
    const track = document.createElement("div")
    track.className = "xhs-track"
    reader.appendChild(track)
    host.replaceChildren(reader) // 先入 DOM，测量才有尺寸

    let page = newPage()
    track.appendChild(page)
    const pages = [page]
    const inner = () => page.firstElementChild
    const budget = () => page.clientHeight - 48

    // 按块装箱：放不下就起新页；单块自身超高时该页允许内部滚动。
    for (const block of blocks) {
      const filled = inner().getBoundingClientRect().height
      const onlyKicker =
        inner().childElementCount === 1 && inner().firstElementChild.classList.contains("xhs-kicker")
      const isHeading =
        /^H[12]$/.test(block.tagName) && inner().childElementCount > 0 && !onlyKicker && filled > budget() * 0.45
      if (isHeading) {
        page = newPage()
        track.appendChild(page)
        pages.push(page)
      }
      inner().appendChild(block)
      if (inner().getBoundingClientRect().height > budget() && inner().childElementCount > 1) {
        inner().removeChild(block)
        page = newPage()
        track.appendChild(page)
        pages.push(page)
        inner().appendChild(block)
      }
    }
    pages.forEach((p) => {
      if (p.firstElementChild.getBoundingClientRect().height > p.clientHeight - 48) {
        p.classList.add("is-tall")
      }
    })

    document.documentElement.classList.add("xhs-on")

    state.reader = reader
    state.track = track
    state.pages = pages
    state.index = 0

    reader.addEventListener(
      "touchstart",
      (e) => {
        state.t0 = {
          x: e.touches[0].clientX,
          y: e.touches[0].clientY,
          scroller: !!e.target.closest(".md-typeset__scrollwrap"),
        }
      },
      { passive: true }
    )
    reader.addEventListener(
      "touchend",
      (e) => {
        if (!state.t0) return
        const dx = e.changedTouches[0].clientX - state.t0.x
        const dy = e.changedTouches[0].clientY - state.t0.y
        const inScroller = state.t0.scroller
        state.t0 = null
        if (inScroller) return
        if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.2) {
          go(state.index + (dx < 0 ? 1 : -1))
        }
      },
      { passive: true }
    )
    // 页内跳转锚点：翻到目标所在页
    reader.addEventListener("click", (e) => {
      if (e.target.closest('a[href^="#"]')) setTimeout(jumpToHash, 0)
    })

    go(restoreTo)
    if (location.hash) jumpToHash()

    const clipped = pages.some(
      (p) => !p.classList.contains("is-tall") && p.scrollHeight > p.clientHeight + 2
    )
    if (clipped && attempts < 3) {
      attempts += 1
      setTimeout(build, 400)
    } else if (!clipped) {
      attempts = 0
    }
  }

  let timer
  let attempts = 0
  function schedule() {
    clearTimeout(timer)
    timer = setTimeout(build, 200)
  }

  function onKey(e) {
    if (!state.reader) return
    if (e.key === "ArrowRight") go(state.index + 1)
    else if (e.key === "ArrowLeft") go(state.index - 1)
  }

  document.addEventListener("keydown", onKey)
  MOBILE.addEventListener("change", schedule)
  window.addEventListener("resize", schedule)
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
