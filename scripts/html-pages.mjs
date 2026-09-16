import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { parse } from "parse5";
export function attr(node, name) {
  return node.attrs?.find((item) => item.name === name)?.value;
}
export function text(node) {
  return node.nodeName === "#text"
    ? node.value
    : (node.childNodes || []).map(text).join("");
}
export function elements(document) {
  const result = [];
  function walk(node) {
    if (node.tagName) result.push(node);
    node.childNodes?.forEach(walk);
  }
  walk(document);
  return result;
}
export async function readPages(directory) {
  const pages = [];
  async function walk(dir) {
    for (const item of await readdir(dir, { withFileTypes: true })) {
      const file = join(dir, item.name);
      if (item.isDirectory()) await walk(file);
      else if (item.name.endsWith(".html")) {
        const html = await readFile(file, "utf8");
        const path = "/" + relative(directory, file).replaceAll("\\", "/");
        const route = path.replace(/index\.html$/, "");
        pages.push({ file, html, route, nodes: elements(parse(html)) });
      }
    }
  }
  await walk(directory);
  return pages.sort((a, b) => a.route.localeCompare(b.route));
}
export const robotsOf = (page) =>
  page.nodes
    .filter((n) => n.tagName === "meta" && attr(n, "name") === "robots")
    .map((n) => attr(n, "content") || "")
    .join(",");
