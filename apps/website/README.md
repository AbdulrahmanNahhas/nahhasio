# Nahhasio website

Static product site for the landing page, features, gallery, guides, and changelog. React and
the local shadcn components render at build time. The browser receives HTML, CSS and a small
script. The viewer and administration UI run separately in [apps/linux/ui](../linux/ui/README.md).

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
- Screenshot captions and slot IDs are defined in `src/content.ts`. Add captures such as
  `assets/screen-desktop-browse.webp` or `assets/screen-mobile-work.webp`. The build accepts
  AVIF, WebP, PNG, and JPEG, plus short names such as `screen-browse.png` for desktop slots.
  Use demo data for every public image.
- Guide and changelog Markdown is trusted repository content rendered by `build.mjs`.
  Keep it independently readable and ground product claims in the owning guides linked above.
- Use a local built copy to verify direct guide links, search, keyboard dismissal, both
  gallery layouts and a real fixture capture. A successful build verifies generation.
