import { QuartzConfig } from "./quartz/cfg"
import * as Plugin from "./quartz/plugins"

/**
 * Quartz 4 Configuration
 *
 * See https://quartz.jzhao.xyz/configuration for more information.
 */
const config: QuartzConfig = {
  configuration: {
    pageTitle: "Johnson",
    pageTitleSuffix: "",
    enableSPA: true,
    enablePopovers: true,
    analytics: {
      provider: "plausible",
    },
    locale: "en-US",
    baseUrl: "johnson1662.github.io/johnson-obsidian-notes",
    ignorePatterns: ["private", "templates", ".obsidian"],
    defaultDateType: "modified",
    theme: {
      fontOrigin: "googleFonts",
      cdnCaching: true,
      typography: {
        header: "Google Sans",
        body: "Google Sans",
        code: "Hack",
      },
      colors: {
        lightMode: {
          light: "#faf9f6",
          lightgray: "#e8e4df",
          gray: "#a8a29e",
          darkgray: "#3d3a36",
          dark: "#292524",
          secondary: "#78716c",
          tertiary: "#a8a29e",
          highlight: "rgba(168, 162, 158, 0.15)",
          textHighlight: "#fde04788",
        },
        darkMode: {
          light: "#1c1917",
          lightgray: "#44403c",
          gray: "#78716c",
          darkgray: "#c4c1be",
          dark: "#f5f5f4",
          secondary: "#a8a29e",
          tertiary: "#d6d3d1",
          highlight: "rgba(168, 162, 158, 0.15)",
          textHighlight: "#fde04788",
        },
      },
    },
  },
  plugins: {
    transformers: [
      Plugin.FrontMatter(),
      Plugin.CreatedModifiedDate({
        priority: ["frontmatter", "git", "filesystem"],
      }),
      Plugin.SyntaxHighlighting({
        theme: {
          light: "github-light",
          dark: "github-dark",
        },
        keepBackground: false,
      }),
      Plugin.ObsidianFlavoredMarkdown({ enableInHtmlEmbed: false }),
      Plugin.GitHubFlavoredMarkdown(),
      Plugin.TableOfContents(),
      Plugin.CrawlLinks({ markdownLinkResolution: "relative" }),
      Plugin.Description(),
      Plugin.Latex({ renderEngine: "katex", katexOptions: { strict: false } }),
    ],
    filters: [Plugin.RemoveDrafts()],
    emitters: [
      Plugin.AliasRedirects(),
      Plugin.ComponentResources(),
      Plugin.ContentPage(),
      Plugin.FolderPage(),
      Plugin.TagPage(),
      Plugin.ContentIndex({
        enableSiteMap: true,
        enableRSS: true,
      }),
      Plugin.Assets(),
      Plugin.Static(),
      Plugin.Favicon(),
      Plugin.NotFoundPage(),
      // Comment out CustomOgImages to speed up build time
      // Plugin.CustomOgImages(),
    ],
  },
}

export default config
