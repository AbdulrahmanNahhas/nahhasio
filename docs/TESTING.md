# Verification guide

Read [PROJECT.md](PROJECT.md) and [ROADMAP.md](ROADMAP.md) for scope. Use compile/static checks
for approved implementation checkpoints; Aqua requested the consolidated full regression after
implementation rather than repeated full suites for small changes. The commands below are
available verification procedures, not a requirement to run every suite on every edit.
Use disposable restored databases for mutations. Documentation-only changes need link/format
checks, not application tests. Preserve Aqua's Rust-learning ownership.

## Rust CLI and migration acceptance

```sh
devenv shell -- bash bin/test-rust-catalog
```

This starts and removes a private socket-only PostgreSQL cluster under `/tmp`; it never uses the
development/family `DATABASE_URL`. It exercises the bundled migration history, rollback, the shared
maintenance lock, guarded/audited mutations, reference/scoped lookup, redaction and the actual CLI
binary's JSON/exit behavior. Separate empty fixture databases prove Rust → Drizzle and Drizzle →
Rust continuation of the same ledger without replaying migrations. The ignored Rust integration
test requires `NAHHASIO_TEST_DATABASE_URL` and refuses databases outside its named socket fixture.
Do not set that variable to the family catalog. These checks are local runtime acceptance, not
production migration, Fedora installation, native desktop or independent-backup acceptance.

The same script runs `apps/server/tests/editor_postgres.rs` with private artwork storage and no
usable Node worker. It covers Planets, People/Studios, credits, JSON reviews, work create/review/save,
reference lookup, image upload/deduplication/assignment/rename/unlink/deletion, stale/tampered tickets,
retained files and old image paths, authorization, rollback and composite foreign-key deletion guards.
It compares Rust and legacy TypeScript exports of the same persisted fixture and exercises the
compiled CLI's whole-work merge import and rollback. It also compares all ten report presets,
checks typed aggregation/discovery, explicit missing-reference creation, native media commands
and guarded purge with retained files. All migrations use the single Drizzle ledger.
These checks do not call live providers or prove Fedora/container/native UI acceptance. Provider
credentials, real artwork downloads, broad catalog-shape parity and production transfer require
separate acceptance. No live catalog mutation is authorized by this script.

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
The root `pnpm test:e2e` runs these same Linux UI browser fixtures.
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

### Focused device-root regression

`devenv shell -- cargo test --locked -p nahhasio-linux media_storage::tests` runs directory
validation and a subprocess check proving server artwork configuration cannot override the
client video root. It performs no live catalog or retained-video mutations. Native UI inspection,
physical input and playback remain separate acceptance.

For an explicitly requested live read-only provider search, run the isolated catalog fixture with
`NAHHASIO_LIVE_PROVIDER_ACCEPTANCE=1`. It uses existing environment keys and reports only candidate
counts and warnings; it neither ingests images nor changes the live catalog. TMDB and Fanart
returned candidates at the 2026-10-20 local checkpoint; that does not establish AniList, every
provider endpoint or production connectivity acceptance.

### Retired runtime boundaries

The web dashboard and Hono API suites are retired with their applications. `pnpm test:e2e`
now runs the Linux UI browser fixtures. This remains distinct from GTK/native acceptance.
`bin/test-rust-catalog` retains its socket-only PostgreSQL comparison oracle in
`tools/catalog-reference`; it must never target the live catalog.
Contract schema drift is checked by `pnpm --filter @arcadia/contracts check:rust-editor`.
Recovery imports require explicit `ARCADIA_V1_DB_PATH` and `ARCADIA_V1_ARTWORK_ROOT` selections;
artwork paths are resolved under that recovery root, never under a deleted website directory.
`pnpm --filter @arcadia/database schema:graph /absolute/path/schema.json` exports the
schema graph without a frontend dependency.

### Current baseline acceptance — 2026-10-20

The active migration history is now `0000_current_catalog`, not the retired 31-file chain.
`bin/test-rust-catalog` continues to test empty bootstrap, rollback, shared locking and both
Drizzle/Rust continuation directions, plus catalog/editor/media/report preservation. The current
baseline snapshot also produced no changes through Drizzle generation. The real restored-data
and artwork rehearsal, 23 constraint assertions and live adoption receipt are documented in
[BASELINE](BASELINE.md). These results do not establish independent recovery or Fedora deployment.

## Server administration services

`devenv shell -- bash bin/test-account-profile` now also exercises real Overview/Settings handlers
in the same synthetic socket-only database and a temporary `NAHHASIO_CONFIG_ROOT`. It checks
admin/member/revoked-device access, server rename and provider revision conflicts, persisted masked
key status, shared-provider reload/disable, and readiness rejection of an incompatible migration
ledger. The fixture deletes its database and credential directory afterward. It never uses the
family database or calls real providers.

`devenv shell -- pnpm --filter @nahhasio/linux-ui exec playwright test admin-server.spec.ts`
checks the typed native-gateway fixture, name/key controls, secret input clearing, failure/retry,
disabled unconfigured storage and 1440/520-pixel layouts. Build the bundle before starting preview;
do not rebuild the same output while browser tests run. Browser captures remain separate from GTK,
physical keyboard, real credentials, AppImage installation and Fedora acceptance.

2026-10-20 acceptance: `pnpm check`, workspace build, all 24 server unit tests, private provider-file
unit checks and the extended disposable API fixture passed. Both new administration browser tests
passed; sidebar/selection regressions passed, including a separate rerun of the one navigation case
interrupted by a concurrent bundle rebuild. Browser captures were inspected at 1440×900 and 520×900.
A fresh copied native binary (`8f65ca976112d701b89244573c271ce7c8e8ecefb38cb791569044c1866d9984`)
and production bundle also rendered Overview/Settings through real GTK/WebKit and native HTTP
against an isolated mock. Private captures/receipt are in `data/previews/admin-server-native`.
The compositor initially selected a 708×793 CSS viewport; its own test window was then narrowed to
520 requested width and captured again. This was an intentionally terminated rendering probe,
not a completed built-in smoke journey or physical-input/real-provider/AppImage/Fedora acceptance.
The probe required synthetic login/device registration; it never contacted the family API/database.

2026-10-21 authorization follow-up: the extended profile fixture runs HTTP requests as a non-superuser
runtime role, while setup/revocation/snapshots use a separate operator connection in its own temporary
socket-only cluster. Runtime has DML but no public-schema CREATE or migration-ledger INSERT. Fifty-three
deterministic races wait for an actual blocked PostgreSQL request, commit revocation/visibility/role
changes, then require rejection and equal fingerprints for state, identities, credentials, devices and
audit. Positive viewer/profile/password/device flows remain required. The test's 15-second barrier
allows actual scrypt work before the write lock; production lock/request timeouts are unchanged.
`admin-server.spec.ts` adds the deployment signals and stale-name reload case. A migration unit fixture
now uses synthetic ordered entries instead of assuming two or more real baseline migrations.

Final 2026-10-21 checks: `pnpm check`, server/native builds, all 12 catalog + 24 server unit tests,
`bin/test-rust-catalog`, the runtime-role 53-race profile/Settings fixture, and all three focused
Overview/Settings browser scenarios passed. Documentation links and `git diff --check` passed.
Today's isolated native rendering probe timed out before issuing any API requests and produced no
new captures; the 2026-10-20 native result is historical, not acceptance of today's small UI additions.
No live catalog/account/artwork/grant change or deployment/release activation was performed.

After those passing checks, concurrent development-environment changes appeared in the worktree
(pnpm/Nix/CI and related files). They were preserved. A later repository-wide format check flags the
concurrently edited root `package.json`; it is outside this authorization/Overview checkpoint.
Reconcile that environment checkpoint before treating a new repository-wide run as accepted.

## Home-server HTTPS trust acceptance

```sh
devenv shell -- cargo build --locked -p nahhasio-linux
devenv shell -- python3 apps/linux/tests/server_trust.py
devenv shell -- pnpm --filter @nahhasio/linux-ui test:e2e server-connections.spec.ts admin-server.spec.ts
devenv shell -- cargo test --locked -p nahhasio-catalog --lib deployment
```

The Python fixture creates ephemeral certificates with OpenSSL and an HTTPS server on loopback,
then exercises the actual native `--bridge-smoke` process with isolated HOME/XDG state. It checks
untrusted CA, incorrect fingerprint, bundles/private keys, hostname mismatch, forbidden LAN HTTP,
successful enrollment, restart persistence, origin isolation, replacement refusal and private state
permissions. No GTK, database, real provider or real session is involved. Browser fixtures cover the
connection form and saved fingerprint at desktop/narrow sizes; their captures are private under
`data/previews/server-trust`. Neither proves a deployed HTTPS server or physical GTK behavior.
The existing disposable profile suite also verifies shared diagnostics against owner/runtime roles.
