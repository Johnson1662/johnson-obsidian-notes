// 移动端整屏翻页（小说阅读器式）：正文用 CSS 多栏按屏切页；
// 表格这类不能拆的块单独占一页，避免在多栏里被挤变形。
// 拖动跟手、松手吸附；左右三分之一点击翻页，点中间显示/隐藏底部条。
// 当前全尺寸都不启用，保留代码以便随时恢复。
;(function () {
  const MOBILE = window.matchMedia("(max-width: 0px)") // 整屏翻页已停用：窄屏改用桌面同款长页滚动
  const HOST_SEL = ".md-content__inner"
  const state = {
    host: null,
    origin: null,
    reader: null,
    track: null,
    viewport: null,
    bar: null,
    sheet: null,
    sections: [],
    pages: 1,
    index: 0,
    colW: 0,
    drag: null,
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
      else if (act === "toc") openSheet()
    })
    parent.appendChild(bar)
    state.bar = bar
    return bar
  }

  function buildSheet(parent) {
    const sheet = document.createElement("div")
    sheet.className = "xhs-sheet"
    sheet.innerHTML =
      '<div class="xhs-sheet__backdrop" data-sheet="close"></div>' +
      '<div class="xhs-sheet__panel" role="dialog" aria-label="目录">' +
      '<div class="xhs-sheet__grip"></div>' +
      '<div class="xhs-sheet__head"><span>目录</span>' +
      '<button type="button" class="xhs-sheet__close" data-sheet="close">关闭</button></div>' +
      '<div class="xhs-sheet__tabs">' +
      '<button type="button" class="xhs-sheet__tab is-active" data-tab="doc">本文</button>' +
      '<button type="button" class="xhs-sheet__tab" data-tab="site">全部笔记</button>' +
      "</div>" +
      '<div class="xhs-sheet__list"></div>' +
      "</div>"
    sheet.addEventListener("click", (e) => {
      e.preventDefault()
      e.stopPropagation()
      const tab = e.target.closest("[data-tab]")
      if (tab) {
        state.sheetTab = tab.dataset.tab
        sheet.querySelectorAll("[data-tab]").forEach((el) => {
          el.classList.toggle("is-active", el.dataset.tab === state.sheetTab)
        })
        fillSheet()
        return
      }
      const item = e.target.closest("[data-page]")
      if (item) {
        go(Number(item.dataset.page), false)
        closeSheet()
        return
      }
      const toggle = e.target.closest("[data-toggle]")
      if (toggle) {
        const key = toggle.dataset.toggle
        if (state.open.has(key)) state.open.delete(key)
        else state.open.add(key)
        fillSheet()
        return
      }
      const link = e.target.closest("[data-href]")
      if (link) {
        location.href = link.dataset.href
        return
      }
      if (e.target.closest('[data-sheet="close"]')) closeSheet()
    })
    const panel = sheet.querySelector(".xhs-sheet__panel")
    let y0 = null
    panel.addEventListener(
      "touchstart",
      (e) => {
        if (!e.target.closest(".xhs-sheet__grip, .xhs-sheet__head")) return
        y0 = e.touches[0].clientY
      },
      { passive: true }
    )
    panel.addEventListener(
      "touchend",
      (e) => {
        if (y0 === null) return
        const dy = e.changedTouches[0].clientY - y0
        y0 = null
        if (dy > 50) closeSheet()
      },
      { passive: true }
    )
    parent.appendChild(sheet)
    state.sheet = sheet
    return sheet
  }

  function setUI(open) {
    document.documentElement.classList.toggle("xhs-ui", open)
  }

  function teardown() {
    if (state.host && state.origin) state.host.replaceChildren(...state.origin)
    if (state.reader) state.reader.remove()
    if (state.bar) state.bar.remove()
    if (state.sheet) state.sheet.remove()
    document.documentElement.classList.remove("xhs-on", "xhs-ui")
    state.host = null
    state.origin = null
    state.reader = null
    state.track = null
    state.viewport = null
    state.bar = null
    state.sheet = null
    state.open = new Set()
    state.siteTree = null
    state.sections = []
    state.pages = 1
    state.index = 0
  }

  function translate(px, animate) {
    if (!state.track) return
    state.track.style.transition = animate ? "transform .22s cubic-bezier(.25,.8,.3,1)" : "none"
    state.track.style.transform = "translateX(" + px + "px)"
  }

  function pageOrigin(page) {
    let start = 0
    for (const sec of state.sections) {
      if (page < start + sec.pages) {
        return { offset: sec.offset, local: page - start }
      }
      start += sec.pages
    }
    const last = state.sections[state.sections.length - 1]
    return last ? { offset: last.offset, local: last.pages - 1 } : { offset: 0, local: 0 }
  }

  function go(i, animate = true) {
    if (!state.sections.length) return
    state.index = clamp(i, 0, state.pages - 1)
    const pos = pageOrigin(state.index)
    translate(-(pos.offset + pos.local * state.colW), animate)
    if (state.bar) {
      state.bar.querySelector(".xhs-bar__count").textContent = state.index + 1 + " / " + state.pages
      state.bar.querySelector('[data-act="prev"]').disabled = state.index === 0
      state.bar.querySelector('[data-act="next"]').disabled = state.index === state.pages - 1
    }
    const chip = document.querySelector(".xhs-count")
    if (chip) chip.textContent = state.index + 1 + " / " + state.pages
    markCurrent()
  }

  // 多列表格在手机上装不下：改成竖排卡片（列名 + 值），只上下滚动
  function stackTables() {
    state.sections.forEach((sec) => {
      if (sec.type !== "block") return
      const table = sec.el.querySelector("table")
      if (!table) return
      const heads = Array.from(table.querySelectorAll("thead th")).map((th) =>
        th.textContent.trim()
      )
      if (heads.length < 3) return
      if (table.scrollWidth <= state.colW + 2) return

      const wrap = document.createElement("div")
      wrap.className = "xhs-stack"
      table.querySelectorAll("tbody tr").forEach((tr) => {
        const row = document.createElement("div")
        row.className = "xhs-stack__row"
        Array.from(tr.children).forEach((td, i) => {
          const cell = document.createElement("div")
          cell.className = "xhs-stack__cell"
          const label = document.createElement("span")
          label.className = "xhs-stack__label"
          label.textContent = heads[i] || ""
          const value = document.createElement("span")
          value.className = "xhs-stack__value"
          value.innerHTML = td.innerHTML
          cell.append(label, value)
          row.appendChild(cell)
        })
        wrap.appendChild(row)
      })
      const box = table.closest(".md-typeset__scrollwrap") || table
      box.replaceWith(wrap)
    })
  }

  // 公式适配：正文里的轻微超宽按 0.8 兜底缩放；
  // 独占一页的长公式按栏宽整幅缩放，保证一屏看全
  function fitMath() {
    state.track.querySelectorAll(".katex-display").forEach((d) => {
      d.style.fontSize = ""
      const base = parseFloat(getComputedStyle(d).fontSize)
      const avail = d.clientWidth - 4
      if (!avail) return
      // scrollWidth 反映被容器裁掉前的真实宽度
      const need = d.scrollWidth
      if (need <= avail + 1) return
      const blockPage = !!d.closest(".xhs-sec--block")
      const floor = blockPage ? 0.5 : 0.85
      const k = Math.max(floor, avail / need)
      if (k < 0.995) d.style.fontSize = (base * k).toFixed(1) + "px"
    })
  }

  const isFixedBlock = (el) => {
    if (el.tagName === "TABLE" || el.querySelector("table")) return true
    if (el.tagName === "PRE" || el.querySelector("pre")) return true
    const math = el.querySelector(".katex-display")
    return !!math && el.textContent.trim().length > 250
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
    const track = document.createElement("div")
    track.className = "xhs-track"
    viewport.appendChild(track)
    reader.appendChild(viewport)
    document.body.appendChild(reader)

    const count = document.createElement("div")
    count.className = "xhs-count"
    reader.appendChild(count)
    buildBar(reader)
    buildSheet(reader)

    document.documentElement.classList.add("xhs-on")
    state.reader = reader
    state.track = track
    state.viewport = viewport

    // 先量栏宽：viewport 的可用内容宽度（要扣掉左右内边距）
    const probe = document.createElement("div")
    probe.style.height = "0"
    viewport.appendChild(probe)
    const colW = Math.max(200, probe.clientWidth)
    probe.remove()
    state.colW = colW

    // 把块分成「可流式正文段」与「整块表格段」
    const groups = []
    let flow = null
    for (const block of blocks) {
      if (isFixedBlock(block)) {
        groups.push({ type: "block", nodes: [block] })
        flow = null
      } else {
        if (!flow) {
          flow = { type: "flow", nodes: [] }
          groups.push(flow)
        }
        flow.nodes.push(block)
      }
    }

    state.sections = []
    let offset = 0
    let start = 0

    groups.forEach((group) => {
      const sec = document.createElement("section")
      sec.className = group.type === "flow" ? "xhs-sec xhs-sec--flow md-typeset" : "xhs-sec xhs-sec--block md-typeset"
      sec.style.width = colW + "px"
      if (group.type === "flow") sec.style.columnWidth = colW + "px"
      group.nodes.forEach((n) => sec.appendChild(n))
      track.appendChild(sec)

      let pages = 1
      if (group.type === "flow") {
        const range = document.createRange()
        range.selectNodeContents(sec)
        const rect = range.getBoundingClientRect()
        const secRect = sec.getBoundingClientRect()
        const used = rect.width + (rect.left - secRect.left)
        pages = Math.max(1, Math.ceil((used - 1) / colW))
        sec.style.width = pages * colW + "px"
      }

      state.sections.push({ el: sec, type: group.type, pages, offset, start })
      offset += pages * colW
      start += pages
    })

    state.pages = Math.max(1, start)
    stackTables()
    fitMath()
    state.sections.forEach((sec) => {
      const boxes = sec.el.querySelectorAll(".md-typeset__scrollwrap, .highlight, pre")
      const wide = Array.from(boxes).some((b) => b.scrollWidth > b.clientWidth + 2)
      if (wide || sec.el.scrollWidth > sec.el.clientWidth + 2) sec.el.classList.add("is-wide")
    })

    // 表格段若比一屏还高，允许页内纵向滚动（样式在 CSS 里）
    go(clamp(keep, 0, state.pages - 1), false)
    if (location.hash) jumpToHash()
    bindGestures(viewport)
  }

  function jumpToHash() {
    const id = decodeURIComponent(location.hash.replace(/^#/, ""))
    if (!id) return
    const target = document.getElementById(id)
    if (!target) return
    for (const sec of state.sections) {
      if (!sec.el.contains(target)) continue
      const local = Math.floor(Math.max(0, target.offsetLeft) / state.colW)
      go(sec.start + Math.min(local, sec.pages - 1), false)
      return
    }
  }

  function markCurrent() {
    if (!state.sheet) return
    state.sheet.querySelectorAll("[data-page]").forEach((el) => {
      el.classList.toggle("is-current", Number(el.dataset.page) === state.index)
    })
  }

  // 站点目录树：整棵解析出来，只在展开的分支里渲染
  function siteTree() {
    const root = document.querySelector(".md-nav--primary")
    if (!root) return []
    const top = root.querySelector("ul")
    if (!top) return []
    const current = decodeURI(location.pathname)
      .replace(/index\.html$/, "")
      .replace(/\/$/, "")

    const walk = (ul, path) =>
      Array.from(ul.children)
        .map((li, i) => {
          if (li.tagName !== "LI") return null
          // 有链接优先用链接（页面自身带子目录时 label 只是折叠按钮）
          let own =
            li.querySelector(":scope > a.md-nav__link") ||
            li.querySelector(":scope > .md-nav__container > a.md-nav__link") ||
            li.querySelector(":scope > label.md-nav__link") ||
            li.querySelector(":scope > .md-nav__container .md-nav__link")
          if (!own) return null
          const text = own.textContent.trim()
          if (!text) return null
          const href = own.getAttribute("href")
          const nav = Array.from(li.children).find(
            (c) => c.tagName === "NAV" && !c.classList.contains("md-nav--secondary")
          )
          const subUl = nav ? nav.querySelector("ul") : null
          const key = path.concat(i).join(".")
          const node = {
            key,
            text,
            href,
            children: subUl ? walk(subUl, path.concat(i)) : [],
            current:
              !!href &&
              decodeURI(new URL(href, location.href).pathname).replace(/\/$/, "") === current,
          }
          return node
        })
        .filter(Boolean)

    return walk(top, [])
  }

  function openAncestors(nodes) {
    let hit = false
    nodes.forEach((n) => {
      const childHit = n.children.length ? openAncestors(n.children) : false
      if (n.current || childHit) {
        state.open.add(n.key)
        hit = true
      }
    })
    return hit
  }

  function renderTree(nodes, list, depth) {
    nodes.forEach((node) => {
      const row = document.createElement("div")
      row.className = "xhs-tree__row"
      row.style.paddingLeft = 8 + depth * 14 + "px"

      if (node.children.length) {
        const caret = document.createElement("button")
        caret.type = "button"
        caret.className = "xhs-tree__caret"
        caret.dataset.toggle = node.key
        caret.setAttribute("aria-expanded", state.open.has(node.key) ? "true" : "false")
        caret.textContent = "›"
        row.appendChild(caret)
      } else {
        const gap = document.createElement("span")
        gap.className = "xhs-tree__gap"
        row.appendChild(gap)
      }

      const label = document.createElement("button")
      label.type = "button"
      label.className = "xhs-tree__label" + (node.current ? " is-current" : "")
      label.textContent = node.text
      if (node.href) label.dataset.href = node.href
      else label.dataset.toggle = node.key
      row.appendChild(label)

      list.appendChild(row)
      if (node.children.length && state.open.has(node.key)) {
        renderTree(node.children, list, depth + 1)
      }
    })
  }

  function fillSheet() {
    if (!state.sheet) return
    const list = state.sheet.querySelector(".xhs-sheet__list")
    if (state.sheetTab === "site") {
      if (!state.siteTree) {
        state.siteTree = siteTree()
        openAncestors(state.siteTree)
      }
      list.replaceChildren()
      renderTree(state.siteTree, list, 0)
      return
    }

    const items = []
    state.sections.forEach((sec) => {
      if (sec.type !== "flow") return
      sec.el.querySelectorAll("h1, h2, h3").forEach((h) => {
        if (h.tagName === "H1" && sec.start !== 0) return
        const local = Math.floor(Math.max(0, h.offsetLeft) / state.colW)
        const item = document.createElement("button")
        item.type = "button"
        item.className =
          "xhs-sheet__item" +
          (h.tagName === "H3" ? " xhs-sheet__item--h3" : "") +
          (h.tagName === "H1" ? " xhs-sheet__item--h1" : "")
        item.dataset.page = String(sec.start + Math.min(local, sec.pages - 1))
        item.textContent = h.textContent.replace(/¶/g, "").trim()
        items.push(item)
      })
    })
    list.replaceChildren(...items)
    if (!items.length) {
      const empty = document.createElement("p")
      empty.className = "xhs-sheet__empty"
      empty.textContent = "本文没有小节标题"
      list.appendChild(empty)
    }
    markCurrent()
  }

  function openSheet() {
    state.sheetTab = "doc"
    if (state.sheet) {
      state.sheet.querySelectorAll("[data-tab]").forEach((el) => {
        el.classList.toggle("is-active", el.dataset.tab === "doc")
      })
    }
    fillSheet()
    setUI(false)
    state.sheet?.classList.add("is-open")
  }

  function closeSheet() {
    state.sheet?.classList.remove("is-open")
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
        const scroller = e.target.closest(
          ".md-typeset__scrollwrap, .katex-display, pre, .highlight, .xhs-sec--block"
        )
        const canPan = !!scroller && scroller.scrollWidth > scroller.clientWidth + 2
        state.drag = { x: startX, t: Date.now(), target: e.target, canPan }
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
        const pos = pageOrigin(state.index)
        let offset = dx
        if (
          (state.index === 0 && dx > 0) ||
          (state.index === state.pages - 1 && dx < 0)
        ) {
          offset = dx * 0.35
        }
        translate(-(pos.offset + pos.local * state.colW) + offset, false)
      },
      { passive: false }
    )

    viewport.addEventListener("touchend", (e) => {
      if (!state.drag) return
      const dx = e.changedTouches[0].clientX - startX
      const dy = e.changedTouches[0].clientY - startY
      const dt = Math.max(1, Date.now() - state.drag.t)
      const tapTarget = state.drag.target
      const canPan = state.drag.canPan
      state.drag = null

      if (moved && horizontal) {
        if (canPan) return
        const velocity = Math.abs(dx) / dt
        const flip = Math.abs(dx) > state.colW * 0.18 || velocity > 0.4
        go(state.index + (flip ? (dx < 0 ? 1 : -1) : 0))
        return
      }

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
  let settled = 0
  function schedule() {
    clearTimeout(timer)
    timer = setTimeout(() => {
      build()
      if (settled < 3) {
        settled += 1
        clearTimeout(timer)
        timer = setTimeout(() => {
          if (!state.reader) return
          build()
          go(clamp(state.index, 0, state.pages - 1), false)
        }, 400)
      }
    }, 180)
  }

  function onKey(e) {
    if (!state.reader) return
    if (e.key === "ArrowRight" || e.key === "PageDown") go(state.index + 1)
    else if (e.key === "ArrowLeft" || e.key === "PageUp") go(state.index - 1)
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
