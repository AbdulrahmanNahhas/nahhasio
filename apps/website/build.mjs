import { readFile, writeFile, readdir, mkdir, cp, mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { compile } from "@tailwindcss/node";
import { Scanner } from "@tailwindcss/oxide";
import { build } from "esbuild";
import { Marked } from "marked";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

const base = fileURLToPath(new URL(".", import.meta.url));
const src = join(base, "src");
const output = join(base, "dist");
const scratch = await mkdtemp(join(base, ".render-"));
const renderModule = join(scratch, "site-render.mjs");
try {
  await mkdir(output, { recursive: true });
  const pending = [
    build({
      entryPoints: [join(src, "site.tsx")],
      platform: "node",
      jsx: "automatic",
      format: "esm",
      bundle: true,
      packages: "external",
      outfile: renderModule,
    }),
    readFile(join(src, "site.css"), "utf8").then((source) =>
      compile(source, { base: src, onDependency() {} }),
    ),
    readFile(join(src, "site.js"), "utf8"),
  ];
  const [, compiler, script] = await Promise.all(pending);
  const scanner = new Scanner({
    sources: [{ base: src, pattern: "**/*.{ts,tsx}", negated: false }],
  });
  const css = compiler.build(scanner.scan());

  async function loadEntries(folder) {
    const directory = join(base, "content", folder);
    const filenames = (await readdir(directory)).filter((name) => name.endsWith(".md"));
    return Promise.all(
      filenames.map(async (filename) => {
        const id = filename.slice(0, -3);
        const text = await readFile(join(directory, filename), "utf8");
        const title = text.match(/^# (.+)$/m)?.[1];
        if (!title) throw new Error(`Missing title in ${filename}`);
        const headings = [];
        const markdown = new Marked({
          renderer: {
            heading(token) {
              const anchor = token.text
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, "-")
                .replace(/^-|-$/g, "");
              headings.push({ id: anchor, title: token.text });
              return `<h${token.depth} id="${id}-${anchor}">${this.parser.parseInline(token.tokens)}</h${token.depth}>\n`;
            },
            html() {
              return "";
            },
          },
        });
        const html = markdown.parse(text.replace(/^# .+\n+/m, ""));
        return { id, title, text, html, headings };
      }),
    );
  }

  const { Site, screenshots: screenshotSlots } = await import(pathToFileURL(renderModule));
  const guides = await loadEntries("guides");
  const changes = (await loadEntries("changes")).toSorted((a, b) =>
    b.id.localeCompare(a.id, "en", { numeric: true }),
  );
  const screenshots = {};
  const slotIds = new Set(screenshotSlots.map((slot) => slot.id));
  for (const file of await readdir(join(base, "assets"))) {
    const match = /^screen-([a-z-]+)\.(?:avif|webp|png|jpg)$/.exec(file);
    if (!match) continue;
    const [, name] = match;
    const id = slotIds.has(name) ? name : `desktop-${name}`;
    if (!slotIds.has(id)) continue;
    if (screenshots[id]) throw new Error(`Multiple captures for ${id}`);
    screenshots[id] = `assets/${file}`;
  }
  const assets = { mark: "assets/mark.png", screenshots };
  const render = (files) =>
    renderToStaticMarkup(createElement(Site, { guides, changes, assets: files }));
  const documentStart =
    '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Nahhasio · A family media library</title><link rel="icon" href="assets/mark.png"><link rel="stylesheet" href="site.css"></head><body>';
  await Promise.all([
    writeFile(
      join(output, "index.html"),
      `${documentStart}${render(assets)}<script src="site.js"></script></body></html>`,
    ),
    writeFile(join(output, "site.css"), css),
    writeFile(join(output, "site.js"), script),
    cp(join(base, "assets"), join(output, "assets"), { recursive: true }),
  ]);
} finally {
  await rm(scratch, { recursive: true, force: true });
}
