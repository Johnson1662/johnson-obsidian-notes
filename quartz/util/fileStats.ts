import { QuartzPluginData } from "../plugins/vfile"

/** Obsidian 侧栏头的「N 个文件，M 个文件夹」统计 */
export function countFilesAndFolders(allFiles: QuartzPluginData[]) {
  const dirs = new Set<string>()
  let files = 0
  for (const f of allFiles) {
    if (!f.slug) continue
    if (f.slug !== "index") files++
    const parts = f.slug.split("/")
    for (let i = 1; i < parts.length; i++) dirs.add(parts.slice(0, i).join("/"))
  }
  return { files, folders: dirs.size }
}
