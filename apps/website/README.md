# Nahhasio website

Static product website with a landing page, features, screenshot gallery, searchable guides, and changelog. The site builds with React and shadcn components at build time and serves HTML, CSS, and a small script for navigation and search.

## Preview

From the workspace root, with the declared development environment and workspace dependencies installed:

```sh
pnpm --filter @nahhasio/website build:site
python3 -m http.server 4178 --bind 127.0.0.1 --directory apps/website/dist
```

Open [the local preview](http://127.0.0.1:4178/). Build output lives under `apps/website/dist`. The site uses relative assets and its own build command, with no dependency on a running Nahhasio installation or release service.

## Edit the site

- `src/site.tsx` owns the layout, and `src/site.css` owns the visual design.
- `src/content.ts` owns feature descriptions, guide navigation, and screenshot captions.
- `content/guides/` and `content/changes/` hold the Markdown shown on the website. Use the [project guide](../../docs/project/overview.md), [client behavior guide](../../docs/desktop/behavior.md), and [release notes](../../docs/releases/README.md) to check product claims.
- Add a capture under `assets/` using `screen-browse`, `screen-work`, `screen-watch`, or `screen-library` with one of the extensions `.avif`, `.webp`, `.png`, or `.jpg`. Rebuild to replace the corresponding placeholder. Use demo data for captures intended for public use.
- The hero uses the project’s existing mark until a Browse capture is added, then displays that capture. The shadcn Base UI primitives in `src/shadcn/` are local to this website.
