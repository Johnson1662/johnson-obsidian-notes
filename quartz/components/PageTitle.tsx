import { pathToRoot } from "../util/path"
import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"
import { classNames } from "../util/lang"
import { i18n } from "../i18n"
import { countFilesAndFolders } from "../util/fileStats"

const PageTitle: QuartzComponent = ({
  fileData,
  cfg,
  displayClass,
  allFiles,
}: QuartzComponentProps) => {
  const title = cfg?.pageTitle ?? i18n(cfg.locale).propertyDefaults.title
  const baseDir = pathToRoot(fileData.slug!)
  const { files, folders } = countFilesAndFolders(allFiles)
  return (
    <div class={classNames(displayClass, "page-title-block")}>
      <h2 class="page-title">
        <a href={baseDir}>{title}</a>
      </h2>
      <div class="page-title-meta">
        {files} 个文件，{folders} 个文件夹
      </div>
    </div>
  )
}

PageTitle.css = `
.page-title {
  font-size: 1rem;
  font-weight: 700;
  line-height: 1.3;
  margin: 0;
  font-family: var(--headerFont);
}

.page-title-meta {
  font-size: 0.75rem;
  line-height: 1.5;
  color: var(--gray);
  margin-top: 0.1rem;
}

@media all and (max-width: 800px) {
  .page-title-meta {
    display: none;
  }
}
`

export default (() => PageTitle) satisfies QuartzComponentConstructor
