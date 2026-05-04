import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"
import { getDate } from "./Date"
import { classNames } from "../util/lang"
import style from "./styles/dashboard.scss"
import { byDateAndAlphabetical } from "./PageList"
import { FullSlug, resolveRelative } from "../util/path"

interface Options {
  welcomeTitle?: string
  subtitle?: string
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
      welcomeTitle: "Johnson's Digital Garden",
      subtitle: "A space for thoughts, code, and explorations.",
      recentNotesLimit: 5,
      ...userOpts,
    }

    /* ==== 核心逻辑：只过滤并统计 "知识库" 目录下的笔记 ==== */
    const knowledgeFiles = allFiles.filter((f) => {
      if (!f.slug || f.slug === "index") return false
      // 只包含路径以 '知识库/' 开头的文件
      return f.slug.startsWith("知识库/")
    })

    const totalNotes = knowledgeFiles.length

    /* 提取 知识库内部分类统计 */
    const dirMap = new Map<string, number>()
    let latestDate: Date | null = null

    for (const f of knowledgeFiles) {
      const parts = f.slug!.split("/")
      // 此时路径必然是 ["知识库", "分类名称", "文件名.md"] 等
      if (parts.length >= 3) {
        // parts[0] 是 '知识库', parts[1] 就是子分类名 (如 'Agent', '数据库系统')
        const categoryDir = parts[1]
        dirMap.set(categoryDir, (dirMap.get(categoryDir) ?? 0) + 1)
      }

      const d = getDate(cfg, f)
      if (d && (!latestDate || d > latestDate)) latestDate = d
    }

    const totalDirs = dirMap.size

    const weekUpdated = knowledgeFiles.filter((f) => {
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
      { label: "总笔记", value: totalNotes },
      { label: "分类数", value: totalDirs },
      { label: "本周更新", value: weekUpdated },
      { label: "最后更新", value: formatDate(latestDate) },
    ]

    /* 提取 最近更新笔记 */
    const recentNotes = [...knowledgeFiles]
      .sort(byDateAndAlphabetical(cfg))
      .slice(0, opts.recentNotesLimit)

    /* 提取 分类目录列表并按数量排序 */
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
          <p class="dashboard-subtitle">{opts.subtitle}</p>

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
                    </div>
                  </li>
                )
              })}
            </ul>
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
              {categories.length > 0 ? (
                categories.map(([dir, count]) => (
                  <li class="dash-list-item">
                    <a
                      href={resolveRelative(fileData.slug!, `知识库/${dir}/` as FullSlug)}
                      class="dash-item-title internal"
                    >
                      {dir}
                    </a>
                    <span class="dash-item-count">{count} 篇</span>
                  </li>
                ))
              ) : (
                <p class="dash-empty">暂无分类目录</p>
              )}
            </ul>
          </section>
        </div>
      </div>
    )
  }

  Dashboard.css = style
  return Dashboard
}) satisfies QuartzComponentConstructor
