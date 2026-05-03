import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"
import { getDate } from "./Date"
import { classNames } from "../util/lang"
import style from "./styles/dashboard.scss"

interface Options {
  welcomeTitle?: string
}

export default ((userOpts?: Options) => {
  const Dashboard: QuartzComponent = ({
    allFiles,
    displayClass,
    cfg,
  }: QuartzComponentProps) => {
    const opts = {
      welcomeTitle: "Johnson1662's Digital Garden",
      ...userOpts,
    }

    const totalNotes = allFiles.length

    const dirSet = new Set<string>()
    let latestDate: Date | null = null
    for (const f of allFiles) {
      const p = f.filePath ?? ""
      const parts = p.replace(/\\/g, "/").split("/")
      const contentIdx = parts.indexOf("content")
      if (contentIdx !== -1 && parts.length > contentIdx + 1) {
        const topDir = parts[contentIdx + 1]
        if (!topDir.startsWith(".") && !topDir.startsWith("_")) {
          dirSet.add(topDir)
        }
      }
      const d = getDate(cfg, f)
      if (d && (!latestDate || d > latestDate)) latestDate = d
    }

    const totalDirs = dirSet.size

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

    return (
      <div class={classNames(displayClass, "dashboard")}>
        <header class="dashboard-hero">
          <div class="shape shape-1" />
          <div class="shape shape-2" />
          <div class="shape shape-3" />
          <div class="shape shape-4" />
          <div class="hero-glow" />

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
      </div>
    )
  }

  Dashboard.css = style
  return Dashboard
}) satisfies QuartzComponentConstructor
