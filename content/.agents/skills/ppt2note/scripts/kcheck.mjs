// KaTeX 严格校验 + 表格内管道符检查: node kcheck.mjs <note.md>
import katex from "/home/johnson/quartz-repo/node_modules/katex/dist/katex.mjs";
import fs from "node:fs";

const src = fs.readFileSync(process.argv[2], "utf8");
const L = src.split("\n");
const warn = [];
const opt = (n, md) => ({
  throwOnError: true,
  displayMode: md,
  strict: (c, m) => {
    warn.push(`L${n} ${m}`);
    return "ignore";
  },
});

const blocks = [];
for (let i = 0; i < L.length; i++)
  if (L[i].trim() === "$$") {
    let j = i + 1;
    while (j < L.length && L[j].trim() !== "$$") j++;
    blocks.push([i + 1, L.slice(i + 1, j).join("\n")]);
    i = j;
  }

// 单行形式的 $$...$$（与多行块等价，之前漏检）
const single = [];
for (let i = 0; i < L.length; i++) {
  const m = L[i].match(/^\s*\$\$([\s\S]+)\$\$\s*$/);
  if (m) single.push([i + 1, m[1]]);
}

let fence = false;
const inline = [];
for (let i = 0; i < L.length; i++) {
  if (L[i].startsWith("```")) {
    fence = !fence;
    continue;
  }
  if (fence) continue;
  for (const m of L[i].matchAll(/(?<!\$)\$([^$\n]+)\$(?!\$)/g)) inline.push([i + 1, m[1]]);
}

for (const [n, b] of blocks)
  try {
    katex.renderToString(b, opt(n, true));
  } catch (e) {
    warn.push(`ERR L${n} ${e.message.slice(0, 120)}`);
  }
for (const [n, s] of inline)
  try {
    katex.renderToString(s, opt(n, false));
  } catch (e) {
    warn.push(`ERR INLINE L${n} ${e.message.slice(0, 120)}`);
  }
for (const [n, s] of single)
  try {
    katex.renderToString(s, opt(n, true));
  } catch (e) {
    warn.push(`ERR DISPLAY L${n} ${e.message.slice(0, 120)}`);
  }
for (let i = 0; i < L.length; i++)
  if (L[i].trimStart().startsWith("|"))
    for (const m of L[i].matchAll(/\$+([^$]+)\$+/g))
      if (m[1].includes("|")) warn.push(`PIPE-IN-TABLE L${i + 1}`);

if (warn.length) {
  console.log(warn.join("\n"));
  process.exitCode = 1;
} else console.log(`OK ${blocks.length + single.length} display / ${inline.length} inline`);
