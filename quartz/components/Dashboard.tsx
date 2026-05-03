import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"
import { classNames } from "../util/lang"
import style from "./styles/dashboard.scss"

interface Options {
  welcomeTitle?: string
  welcomeSubtitle?: string
}

export default ((userOpts?: Options) => {
  const Dashboard: QuartzComponent = ({ displayClass }: QuartzComponentProps) => {
    const opts = {
      welcomeTitle: "Johnson1662's Digital Garden",
      ...userOpts,
    }

    return (
      <div class={classNames(displayClass, "dashboard")}>
        <header class="dashboard-hero">
          <div class="hero-glow" />
          <h1 class="dashboard-title">{opts.welcomeTitle}</h1>
        </header>
      </div>
    )
  }

  Dashboard.css = style
  return Dashboard
}) satisfies QuartzComponentConstructor
