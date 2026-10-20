# Shared account avatars

These 111 supplied PNGs are the canonical curated account-image assets. They are persistent
project resources, packaged into the Linux UI and embedded in the authenticated Rust server.
They do not depend on `~/Pictures`, Downloads, or the catalog artwork directory. The old book/orbit SVGs are no longer selectable; their stored keys display `anon-1.png`
for compatibility without changing saved account data.

The account stores the relative filename, including `square-aspect/` where applicable. Existing
filenames are stable identifiers: keep them when adding images. Add lowercase, hyphenated PNG
filenames (at most 512 KiB), then run:

```sh
devenv shell -- python3 bin/update-avatar-catalog
devenv shell -- pnpm client:generate
```

Rebuild both server and client after catalog changes. The UI discovers these assets with Vite;
the server accepts only entries in its generated embedded allowlist. No database migration or
local image-directory configuration is required. Rebuild AppImages separately for distribution.
