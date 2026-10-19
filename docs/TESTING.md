# Verification guide

Read [PROJECT.md](PROJECT.md) and [ROADMAP.md](ROADMAP.md) for scope. Use compile/static checks
for approved implementation checkpoints; Aqua requested the consolidated full regression after
implementation rather than repeated full suites for small changes. The commands below are
available verification procedures, not a requirement to run every suite on every edit.
Use disposable restored databases for mutations. Documentation-only changes need link/format
checks, not application tests. Preserve Aqua's Rust-learning ownership.

## 1. Browser fixtures and ordinary checks

```sh
devenv shell -- pnpm --filter @nahhasio/linux-ui test:e2e work-page.spec.ts
devenv shell -- pnpm --filter @nahhasio/linux-ui test:e2e
devenv shell -- pnpm --filter @nahhasio/linux-ui test:e2e:player
devenv shell -- pnpm check
devenv shell -- pnpm build
devenv shell -- cargo test --workspace --locked
devenv shell -- pnpm --filter @nahhasio/api-contract test
```

When runtime verification is required, start with the relevant spec and broaden for unresolved risks. Linux Playwright tests inject a
fixture bridge; they do not certify native HTTP, GTK input, WebKit rendering or playback.
The root `pnpm test:e2e` targets the administration dashboard, not the Linux viewing UI.
Use Chromium supplied by devenv (`PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`); do not download browsers.

The client Playwright config uses port **23110** and reuses an existing server outside CI.
Know whether that is Vite dev or a freshly built preview. Never count a stale preview as
verification of current source. CI disables reuse and needs the port free; stop only your own
server, or obtain permission before stopping a shared development process.

Report failures accurately. If an unrelated formatter or test blocks an aggregate command,
run remaining relevant checks independently; do not silently skip failures or change unrelated
source to make the report green. Historical checkpoint results are recoverable in Git; they are not permanent exemptions or evidence for a newer artifact.

## 2. Fresh native application

```sh
devenv shell -- pnpm --filter @nahhasio/linux-ui build
devenv shell -- cargo build --locked -p nahhasio-linux
```

After fully closing the existing GTK window, `devenv shell -- nahhasio-client` rebuilds the
UI and launches Rust. Prefer packaged `ui/dist` for final verification; `NAHHASIO_UI_URL`
selects the separately running development UI and is not proof of the packaged result.
Do not run this persistent application as an unbounded agent terminal command. Use a user-run
launcher or the bounded native smoke described below.

**Single-instance trap:** launching a rebuilt binary can merely present an older running
process. Fully quit/relaunch after bridge changes. `Unknown desktop command` can mean new UI
assets are talking to an old shell. Check process start/executable identity and the bundle
actually loaded before changing command guards. `/proc` access may be denied; report that
limit instead of asserting the running binary matches. API endpoint changes also need a
fresh API process; `devenv processes restart server` is the targeted managed restart when
necessary and authorized. Do not restart PostgreSQL or the whole stack for a UI change.

## 3. Isolated native smoke

The actual shell supports these explicit modes:

| Mode / setting             | Purpose                                                                                                                                                      |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `--bridge-smoke`           | Newline-delimited JSON bridge requests on stdin; no GTK.                                                                                                     |
| `--ui-smoke`               | Real GTK/WebKit, synthetic login → home → work → back → logout; 90-second bound and failure exit. Uses `NON_UNIQUE`, so it does not activate the normal app. |
| `NAHHASIO_SERVER_URL`      | Explicit isolated loopback mock API address, never the live server for mutation tests.                                                                       |
| `NAHHASIO_UI_DIR`          | Absolute path to a prepared private copy of the freshly built production bundle.                                                                             |
| `NAHHASIO_SMOKE_OUTPUT`    | Private ignored directory for login/home/work PNGs.                                                                                                          |
| `NAHHASIO_SMOKE_WIDTH`     | Requested window width, 520–2560; measure actual CSS viewport and DPR separately.                                                                            |
| `NAHHASIO_SMOKE_HOME_ONLY` | Stops after home rendering; cannot certify the work page or logout.                                                                                          |

For UI smoke, stdin is one bounded JSON line with `email` and `password`. Use synthetic
credentials against a mock with synthetic sessions, fixture catalog/artwork and **no SQL or
production forwarding**. Remove database credentials from the child environment. The mock
must reject unexpected routes and mutations except its synthetic login/logout. Real favorite/
watched mutation behavior belongs in the guarded disposable PostgreSQL suite documented in
[`apps/server/tests/README.md`](../apps/server/tests/README.md), never the family catalog.

A historical private controller may exist in `data/previews/work-review/native-harness.mjs`,
with preparation details in its `NATIVE-README.md`. These ignored files are **not shipped in
Git**: check they exist and read their setup before using them. If absent, prepare an equivalent
isolated fixture controller; do not substitute live credentials/API. Its scenarios run serially
because they share configuration, and the controller bounds its child at 105 seconds.
Freeze/hash the copied binary and bundle together; refresh them after source changes. Do not
restore a private test binary over `target/debug/nahhasio-linux` or resize/kill the normal app.

Never relax CSP, native origin restrictions, bridge validation or auth to make smoke pass.
Any private driver scripts must remain external same-origin assets in the private bundle.
Record blocked CSP events, failed artwork and graphics warnings instead of hiding them.
Credentials/tokens must not enter command arguments, logs, screenshots or committed fixtures.
Private captures belong under the existing ignored `data/previews/` tree.

## 4. Acceptance and reporting

- Inspect native screenshots, not just exit codes. Test desktop and narrow layouts (native
  minimum window width is 520; browser coverage can be narrower).
- Verify physical RTL arrow directions, Tab/Shift+Tab, Enter, Escape, dialogs/popovers, focus
  restoration, tab/season scroll preservation and episode links; no nested interactive controls.
- Check reduced motion, missing data/artwork, pending/error recovery, disabled future actions,
  no horizontal overflow and native F11/title-bar behavior where affected.
- Separate scripted handler checks from real physical input. Synthetic `isTrusted=false`
  events/DOM clicks do not certify GTK key delivery, held keys, modifier clicks or native defaults.
- Performance reports identify the tested binary/bundle, actual viewport/DPR, GPU/render mode,
  input method, measurement and remaining warnings. rAF intervals/programmatic scroll are not
  compositor FPS, physical input latency or proof of smooth playback. EGL failure/software
  rendering must be reported; compare like-for-like before claiming improvement.
- Handoff: exact commands/results, screenshots inspected, fixture isolation, tested artifact
  identity, known failures and unverified behavior. Stop for Aqua's checkpoint review.

## Current acceptance gaps

The complete work editor is committed, but its current transactional saves/uploads, all admin
permission paths and native UX still need consolidated acceptance. Older native/browser checks
cover particular artifacts only. Historical transfer fixtures encountered a peer/seed timeout;
public torrent-transfer success is not established. Report current facts instead of repeating old
pass/fail statements as current results. AppImage/cross-machine deployment and server-file playback
need dedicated acceptance once implemented.

## Desktop renderer compatibility

The native entry point defaults `WEBKIT_SKIA_ENABLE_CPU_RENDERING=1` before GTK or
worker threads start. On Shadow with WebKitGTK 2.54.1, Aqua confirmed that CPU
rasterization resolves posters turning partly/completely black during hover and scrolling.
This controls WebKit UI painting; libmpv playback configuration is unchanged.
The existing shared-memory presentation workaround remains in place.

Ordinary `devenv shell -- nahhasio-client` launches need no extra renderer variable.
For a deliberate GPU-painting comparison, fully quit the client first, then run
`WEBKIT_SKIA_ENABLE_CPU_RENDERING=0 devenv shell -- nahhasio-client`.
The entry point respects explicit renderer overrides. A running single instance cannot
adopt a new renderer setting through interface reload; quit/relaunch for comparisons.
CPU/GPU performance has not been benchmarked; the compatibility default is based on
confirmed visual correctness with the affected works.
