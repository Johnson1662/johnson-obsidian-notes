import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"
import { getDate } from "./Date"
import { classNames } from "../util/lang"
import style from "./styles/dashboard.scss"
import { byDateAndAlphabetical } from "./PageList"
import { FullSlug, resolveRelative } from "../util/path"

interface Options {
  welcomeTitle?: string
  recentNotesLimit?: number
  topTagsLimit?: number
}

export default ((userOpts?: Options) => {
  const Dashboard: QuartzComponent = ({
    allFiles,
    fileData,
    displayClass,
    cfg,
  }: QuartzComponentProps) => {
    const opts = {
      welcomeTitle: "Johnson1662's Digital Garden",
      recentNotesLimit: 5,
      topTagsLimit: 10,
      ...userOpts,
    }

    const totalNotes = allFiles.length

    /* ── 目录统计 ── */
    const dirMap = new Map<string, number>()
    let latestDate: Date | null = null
    for (const f of allFiles) {
      const p = f.filePath ?? ""
      const parts = p.replace(/\\/g, "/").split("/")
      const contentIdx = parts.indexOf("content")
      if (contentIdx !== -1 && parts.length > contentIdx + 1) {
        const topDir = parts[contentIdx + 1]
        if (!topDir.startsWith(".") && !topDir.startsWith("_")) {
          dirMap.set(topDir, (dirMap.get(topDir) ?? 0) + 1)
        }
      }
      const d = getDate(cfg, f)
      if (d && (!latestDate || d > latestDate)) latestDate = d
    }

    const totalDirs = dirMap.size

    const weekUpdated = allFiles.filter((f) => {
      const d = getDate(cfg, f)
      if (!d) return false
      const now = new Date()
      return now.getTime() - d.getTime() < 7 * 24 * 60 * 60 * 1000
    }).length

    const formatDate = (d: Date | null) => {
      if (!d) return "--"
      const m = d.getMonth() + 1
      const day = d.getDate()
      return `${m}/${day}`
    }

    const stats = [
      { label: "笔记", value: totalNotes },
      { label: "分类", value: totalDirs },
      { label: "本周", value: weekUpdated },
      { label: "最近", value: formatDate(latestDate) },
    ]

    /* ── 最近笔记 ── */
    const recentNotes = allFiles
      .filter((f) => f.slug !== "index")
      .sort(byDateAndAlphabetical(cfg))
      .slice(0, opts.recentNotesLimit)

    /* ── 热门标签 ── */
    const tagCounts = new Map<string, number>()
    for (const f of allFiles) {
      const tags = f.frontmatter?.tags ?? []
      for (const tag of tags) {
        tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1)
      }
    }
    const topTags = Array.from(tagCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, opts.topTagsLimit)
    const maxTagCount = topTags[0]?.[1] ?? 1

    /* ── 分类目录（按笔记数排序） ── */
    const categories = Array.from(dirMap.entries()).sort((a, b) => b[1] - a[1])

    return (
      <div class={classNames(displayClass, "dashboard")}>
        {/* ===== Hero 区域 ===== */}
        <header class="dashboard-hero">
          <div class="shape shape-1" />
          <div class="shape shape-2" />
          <div class="shape shape-3" />
          <div class="shape shape-4" />

          <h1 class="dashboard-title">{opts.welcomeTitle}</h1>
          <div class="title-line" />

          <div class="stats-row">
            {stats.map((s) => (
              <div class="stat-pill">
                <span class="stat-value">{s.value}</span>
                <span class="stat-label">{s.label}</span>
              </div>
            ))}
          </div>
        </header>

        {/* ===== 内容区域 ===== */}
        <div class="dashboard-content">
          {/* ── 最近笔记 ── */}
          <section class="dash-section dash-recent">
            <h2 class="dash-section-title">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              最近更新
            </h2>
            <ul class="dash-list">
              {recentNotes.map((page) => {
                const title = page.frontmatter?.title ?? "Untitled"
                const date = getDate(cfg, page)
                const tags = page.frontmatter?.tags ?? []
                return (
                  <li class="dash-list-item">
                    <a
                      href={resolveRelative(fileData.slug!, page.slug!)}
                      class="dash-item-title internal"
                    >
                      {title}
                    </a>
                    <div class="dash-item-meta">
                      {date && (
                        <span class="dash-item-date">
                          {date.getMonth() + 1}月{date.getDate()}日
                        </span>
                      )}
                      {tags.length > 0 && (
                        <span class="dash-item-tags">
                          {tags.slice(0, 3).map((tag) => (
                            <a
                              class="internal tag-link"
                              href={resolveRelative(fileData.slug!, `tags/${tag}` as FullSlug)}
                            >
                              #{tag}
                            </a>
                          ))}
                          {tags.length > 3 && <span class="dash-tag-more">+{tags.length - 3}</span>}
                        </span>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
          </section>

          {/* ── 热门标签 ── */}
          <section class="dash-section dash-tags">
            <h2 class="dash-section-title">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path d="M12 2H2v10l9.29 9.29c.94.94 2.48.94 3.42 0l6.58-6.58c.94-.94.94-2.48 0-3.42L12 2Z" />
                <circle cx="7" cy="7" r="2" />
              </svg>
              热门标签
            </h2>
            <div class="dash-tag-cloud">
              {topTags.map(([tag, count]) => {
                const weight = 0.75 + (count / maxTagCount) * 0.5
                return (
                  <a
                    href={resolveRelative(fileData.slug!, `tags/${tag}` as FullSlug)}
                    class="dash-tag-item internal"
                    style={`font-size: calc(0.8rem * ${weight.toFixed(2)})`}
                  >
                    <span class="dash-tag-name">{tag}</span>
                    <span class="dash-tag-count">{count}</span>
                  </a>
                )
              })}
            </div>
          </section>

          {/* ── 分类目录 ── */}
          <section class="dash-section dash-categories">
            <h2 class="dash-section-title">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z" />
              </svg>
              分类目录
            </h2>
            <ul class="dash-list">
              {categories.map(([dir, count]) => (
                <li class="dash-list-item">
                  <a
                    href={resolveRelative(fileData.slug!, `${dir}/` as FullSlug)}
                    class="dash-item-title internal"
                  >
                    {dir}
                  </a>
                  <span class="dash-item-count">{count} 篇</span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    )
  }

  Dashboard.css = style
  return Dashboard
}) satisfies QuartzComponentConstructor
