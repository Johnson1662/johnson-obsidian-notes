"""Obsidian → MkDocs adaptation.

Handles the vault syntax that MkDocs does not understand natively:

* ``[[note]]`` / ``[[note|alias]]`` / ``[[note#heading]]`` wikilinks
* ``![[file.png|300]]`` embeds (images, documents)
* ``%%hidden%%`` comments

It also injects the site CSS/JS from ``hooks/site-assets`` so the vault
(``content/``) stays a clean Obsidian vault with no site-only files in it.
"""

from __future__ import annotations

import posixpath
import re
from pathlib import Path

from mkdocs.structure.files import File
from pymdownx.slugs import slugify as _slugify

HERE = Path(__file__).resolve().parent
_SLUG = _slugify(case="lower")
SITE_ASSETS = HERE / "site-assets"
SITE_ASSET_NAMES = ("extra.css", "extra.js", "reader.js", "mermaid.min.js")

IMAGE_EXT = {".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".bmp", ".avif"}
MEDIA_EXT = IMAGE_EXT | {".pdf", ".mp3", ".ogg", ".wav", ".m4a", ".mp4", ".webm"}

FENCE_RE = re.compile(r"^\s*(`{3,}|~{3,})")
EMBED_RE = re.compile(r"!\[\[([^\]|]+)(?:\|([^\]]*))?\]\]")
WIKILINK_RE = re.compile(r"\[\[([^\]|]+)(?:\|([^\]]*))?\]\]")
COMMENT_RE = re.compile(r"%%.*?%%")

_by_src: dict[str, str] = {}
_by_basename: dict[str, str] = {}


def _index(files) -> None:
    _by_src.clear()
    _by_basename.clear()
    for f in files:
        if f.src_uri.startswith("."):
            continue
        _by_src[f.src_uri.lower()] = f.src_uri
        _by_basename.setdefault(posixpath.basename(f.src_uri).lower(), f.src_uri)


def _resolve(target: str) -> str | None:
    """Resolve an Obsidian link target to a vault-relative path."""
    target = target.strip().lstrip("/")
    if target in _by_src:
        return _by_src[target]
    base = posixpath.basename(target).lower()
    if base in _by_basename:
        return _by_basename[base]
    if not posixpath.splitext(base)[1]:
        return _by_basename.get(base + ".md")
    return None


def _slug(heading: str) -> str:
    return _SLUG(heading, "-")


def _rel(page_dir: str, src_uri: str, extra: str = "") -> str:
    rel = posixpath.relpath(src_uri, page_dir or ".")
    return rel + extra


def _rewrite(text: str, page_dir: str) -> str:
    def embed(m: re.Match) -> str:
        raw, size = m.group(1).strip(), (m.group(2) or "").strip()
        target = raw.split("|")[0].split("#")[0]
        src = _resolve(target)
        if src is None:
            return m.group(0)
        ext = posixpath.splitext(src)[1].lower()
        if ext in MEDIA_EXT:
            alt = posixpath.basename(src)
            return f"![{alt}]({_rel(page_dir, src)})"
        # Document / note embed: degrade to a link, MkDocs has no transclusion.
        return f"[{posixpath.basename(src)}]({_rel(page_dir, src)})"

    def wikilink(m: re.Match) -> str:
        raw, alias = m.group(1).strip(), (m.group(2) or "").strip()
        target, _, anchor = raw.partition("#")
        src = _resolve(target) if target else None
        if src is None:
            return m.group(0)
        label = alias or (posixpath.basename(src).rsplit(".", 1)[0] if target else anchor)
        frag = ""
        if anchor and not anchor.startswith("^"):
            frag = "#" + _slug(anchor)
        return f"[{label}]({_rel(page_dir, src, frag)})"

    text = COMMENT_RE.sub("", text)
    text = EMBED_RE.sub(embed, text)
    text = WIKILINK_RE.sub(wikilink, text)
    return text


def _strip_empty_meta(markdown: str) -> str:
    """Drop a leading empty YAML block that Python-Markdown would turn into a ``---`` heading."""
    lines = markdown.split("\n")
    i = 0
    while i < len(lines) and not lines[i].strip():
        i += 1
    if i + 1 < len(lines) and lines[i].strip() == "---" and lines[i + 1].strip() == "---":
        del lines[i : i + 2]
    return "\n".join(lines)


def on_files(files, config):
    for name in SITE_ASSET_NAMES:
        files.append(File(name, str(SITE_ASSETS), config["site_dir"], config["use_directory_urls"]))
    _index(files)
    return files


def on_page_markdown(markdown, page, config, files):
    if not _by_src:
        _index(files)
    markdown = _strip_empty_meta(markdown)
    page_dir = posixpath.dirname(page.file.src_uri)
    out: list[str] = []
    fence = ""
    for line in markdown.split("\n"):
        m = FENCE_RE.match(line)
        if m:
            marker = m.group(1)[0]
            if not fence:
                fence = marker
            elif fence == marker:
                fence = ""
            out.append(line)
            continue
        out.append(line if fence else _rewrite(line, page_dir))
    return "\n".join(out)
