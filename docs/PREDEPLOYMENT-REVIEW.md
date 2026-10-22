# Pre-deployment schema and logic review

Reviewed 2026-10-20 against commit `4453075`, the current development database and configured
artwork roots. This is a review checkpoint, not a production approval or a schema migration.
Concurrent account/avatar/profile/sidebar changes remain uncommitted and are outside acceptance
here. The authorization gaps described below also exist in the committed baseline.

## Follow-up — baseline adopted

Aqua approved replacing the historical chain with a baseline of the current database. This was
completed on 2026-10-20: all 75 public tables and database definitions were preserved, all 1,055
restored artwork hashes matched, and the native ledger now reports one applied baseline with no
pending migrations. [BASELINE](BASELINE.md) records the backups, rehearsal and exact boundary.
R1 below is retained as the initial finding and is resolved. At that checkpoint R2–R4 and the later
feature gates remained open; the dated follow-ups below record subsequent resolutions. The rest of this report records the pre-adoption inspection, not a current mismatch.

## Original review decision

Keep the existing schema and shared Rust architecture. Do not rebuild tables, replace UUIDs,
remove populated legacy records, or introduce a second migration history. The catalog/artwork/
tracking implementation can proceed toward packaging after the immediate items below are closed.
At initial inspection, three historical migration checksums differed and the Rust runner refused
the upgrade procedure. The approved baseline follow-up above resolves that mismatch.

Do not begin broad Overview/Settings controls before defining and implementing their services.
Migration provenance is now resolved through the restored baseline rehearsal. Close the
transactional authorization gaps before hosting. Production configuration follows in the Podman step.
Jellyfin/library acquisition and automatic installation remain separately gated features.

## Evidence and limits

All live database access in this review used the native CLI's default read-only transactions.
No catalog, identity, viewing state, job, ledger or artwork mutation was performed. No session,
password, provider key, account email/name, or job payload was exported into this report.
Private evidence is ignored under `data/previews/predeployment-review/`; it is not a backup.

| Observed measure                                           | Result                                           |
| ---------------------------------------------------------- | ------------------------------------------------ |
| Public tables / columns                                    | 75 / 621                                         |
| Foreign keys / check constraints                           | 117 / 66                                         |
| Primary keys / additional UNIQUE constraints               | 75 / 15                                          |
| Indexes, including constraint indexes                      | 197                                              |
| Unvalidated constraints / invalid indexes                  | 0 / 0                                            |
| Recorded migrations                                        | 31                                               |
| Works / installments / episodes                            | 252 / 421 / 1,879                                |
| Playback states / account title states / view-history rows | 1,626 / 17 / 98                                  |
| Registered artwork / assignments                           | 1,055 / 1,279                                    |
| Artwork existence, containment and recorded size           | All 1,055 passed                                 |
| Artwork SHA-256 verification                               | All 1,055 matched; 406,936,704 bytes read        |
| Accounts / registered devices                              | 5 / 4                                            |
| Background jobs                                            | 35, all completed historical maintenance records |
| Library roots / media files / media tracks                 | 0 / 0 / 0                                        |
| Jellyfin servers / items                                   | 0 / 0                                            |

Targeted aggregate checks found zero playback/download episode-to-installment mismatches, invalid
artwork-owner cardinalities, works with multiple planets, accounts without identities,
case-insensitive duplicate emails, users with multiple credential rows, or playback positions
beyond a positive recorded duration. These are targeted checks, not an exhaustive proof of all
historical or application-level invariants. Metadata and integrity queries used separate read-only
snapshots; other development activity was not paused.

The 31-migration Drizzle/Rust continuation and editor preservation fixtures passed at the preceding
cleanup checkpoint. They used disposable databases built from today's SQL. This review exposed
why those passing fixtures do not establish compatibility with the existing live ledger.
No new dump/restore rehearsal, Fedora installation, native UI, real streaming or update activation
was performed in this review.

## Immediate findings

### R1 — Historical migration provenance (resolved by the baseline)

The native `migrate status` command refuses `0004_furry_thunderbolts`. Comparing all ledger entries
shows matching timestamps but different SQL checksums for:

- `0004_furry_thunderbolts`;
- `0006_archive_control_room`;
- `0007_controlled_vocabulary_labels`.

The remaining 28 checksums match. The recorded `0007` checksum matches a version in Git commit
`e48e00ad042c`; no matching version for `0004` or `0006` was found among their file-changing commits
in currently available Git refs. Simple trailing-newline/CRLF variants did not explain the mismatch.
This establishes a provenance gap, not which schema or historical data is wrong.

[The Rust runner](../crates/catalog-core/src/migrations.rs) checks each timestamp and checksum before
applying anything. [The TypeScript runner](../packages/database/src/run-migrations.ts) uses the same
ledger and maintenance lock but delegates continuation to Drizzle without the equivalent explicit
full-history check. Do not use the latter as a bypass for the Rust failure.

Required resolution:

1. Back up the current PostgreSQL database and artwork, preserving their identity and the current
   ledger exactly; retain the private review evidence. Before production, make an independent copy.
2. Restore to an isolated database and compare its complete definitions with a fresh 31-migration
   database: columns/defaults, constraints, indexes, enums, functions and triggers. Compare data
   content/UUIDs and viewing state with the original restored baseline as well.
3. Recover the original SQL from existing recovery sources if possible. Choose a reviewed repair:
   recovered immutable history plus additive corrections, or an explicitly documented baseline
   reconciliation supported by structural/data equivalence and retained original ledger evidence.
4. Rehearse the chosen procedure on the restored copy, then verify the native status command and
   no-op reapplication. Make all operator migration entry points enforce the same history policy.
5. Obtain approval for the concrete live reconciliation after the preserved rehearsal passes.

Do not overwrite the ledger with today's hashes simply to make the check green, edit applied SQL,
run all migrations again against populated tables, or disable the history guard.

### R2 — Revalidate mutation sessions and access inside their transaction

[Viewer mutations](../apps/server/src/catalog/viewer_state.rs) lock/recheck the account and identity,
but their `account()` helper does not require the still-active session. `favorite()` has no session
revalidation inside its transaction. `session_device()` returns no device if the session no longer
exists or has expired; it does not reject the mutation. Consequently a request that passed the
middleware can still write if logout/password rotation removes its session before the write begins.

[Admin mutations](../apps/server/src/auth/mod.rs) do lock an active admin session, but
`lock_admin_session()` omits the revoked-device predicate used by `lookup()`. Device registration
also rechecks session/account status without checking whether its currently bound device was
revoked. Revocation after the middleware lookup therefore has a revalidation gap.

`ensure_work()` checks existence/locks the title but does not repeat public/published visibility.
A title moved to private/draft after middleware authorization can still reach the in-flight viewer
write. This is separate from the normal guards, which already reject private/draft work and revoked
devices on a fresh request.

Use a shared transaction-level guard for writes: bind the session to the expected account, require
expiry/status/device validity, lock the relevant session/account rows consistently, and recheck
catalog visibility for ordinary viewers. Define locking with the future revocation operation so
concurrent revoke/write outcomes are deliberate. Preserve the admin bypass for editorial access.
Keep expected-revision checks and owner-scoped playback conflict behavior.

Acceptance needs disposable concurrent logout/password rotation/revocation/private-work fixtures,
plus rejection with no state/audit changes. No live-family mutation or exploit attempt is needed.
This is a code/fixture fix; it does not require changing catalog identity or adding tables.

### R3 — Make installation readiness mean application compatibility

[Readiness](../apps/server/src/lib.rs) currently checks `SELECT 1`. That is useful database liveness,
but it can report ready for the wrong/empty schema or missing `server_instance`. It cannot certify
that the selected application image can serve its API or that artwork roots are usable.

Keep startup free of migrations/seeding/cleanup. Add a read-only release preflight that verifies
migration status/compatibility and required schema/server identity, and validates explicit storage
configuration. Use application readiness in the installer/update acceptance before switching to a
new image. Do not hash 400 MB of artwork on every health request; retain deep content checks as
explicit verification jobs. A cached read-only compatibility result or small required-schema query
is sufficient for routine health checks once preflight semantics are defined.

### R4 — Supply production roles, storage and private configuration

The inspected development connection has superuser, role/database creation and RLS-bypass
privileges. That is a development configuration, not evidence of a production role design.
A default-read-only pool is good protection against accidental writes; it is not a substitute for
PostgreSQL privileges because authorized transactions explicitly enable writes.

Prepare separate runtime and migration/operator credentials. Runtime needs bounded DML/sequence
and required function access, not superuser, role creation or schema ownership. Test it against
existing sequences, triggers, helpers and every supported mutation on a disposable database.
Do not change local grants as part of this report.

Artwork fallback paths in [the editor](../crates/catalog-core/src/editor/storage.rs) and
[viewer](../apps/server/src/catalog/artwork.rs) are anchored to compile-time source locations.
Installed releases must use explicit absolute persistent roots. Fail a deployment preflight if
those roots are absent, unsuitable or unwritable for required operations; do not silently use a
build-machine path. Keep uploads/public roots consistent and separate from client video storage.

Provider keys currently come from server environment, not a finished masked configuration service.
Before enabling Settings actions, implement private server-owned persistence, write-only updates,
masked status, authorization and audit that excludes the values. A private atomically replaced
configuration/credential file is a small initial design; do not add generic secret-bearing JSON
columns to browsable catalog tables. Preserve existing provider endpoints, no-redirect behavior,
request bounds and trusted certificate verification.

Production preparation also needs LAN HTTPS trust, owner provisioning, private Podman networking,
Fedora volume permissions/SELinux labels, restart ordering and independent recovery. These are
installation tasks rather than reasons to redesign catalog tables.

## Ownership and relationships to keep

The detailed 75-table owner inventory remains in [SCHEMA-FOUNDATION](SCHEMA-FOUNDATION.md#complete-database-coverage-boundary).
The controlling boundaries are:

| Owner                  | Canonical records and boundary                                                                                               |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Nahhasio catalog       | Works, parts/episodes, scores, Arabic/editorial text, vocabulary, credits, planets, awards and external identities           |
| Nahhasio artwork       | Asset UUID/hash/path/provenance and owner/role assignments; moving storage changes configured roots, not UUIDs               |
| Identity/access        | Existing auth identity/password ownership plus account/profile, session, capabilities and content policy as distinct records |
| Nahhasio tracking      | Favorites, explicit/manual watched state, progress/revisions and viewing history; no Jellyfin synchronization                |
| Server instance/device | Stable home-server identity; global installation record distinct from the current account session                            |
| Server library         | Approved roots, media-file identity/readiness and delivery tracks; do not move originals during linking                      |
| Client                 | Server/account-scoped snapshots, queued tracking, session files, transfer state/private payloads and device video            |
| Jellyfin               | Media-only external server/item mappings and necessary delivery/track identity; no metadata/artwork authority                |
| Jobs/audit             | Explicit server acquisition/maintenance jobs and durable operator/editor history; not device transfer state                  |

Important existing protections include one planet per work; exactly one artwork owner; composite
foreign keys that keep episode playback/download ownership within its installment; award
category/ceremony organization ownership; contribution role/entity triggers; and playback revision
and rating projection triggers. There are six enabled application triggers. Do not treat Drizzle
column snapshots alone as the complete database contract.

Legacy device installations are intentional compatibility data: three of the four IDs are not
UUID-shaped. `account_downloads.device_id` references the installation text key, while sessions and
last-playback-device use the registry's UUID. New registrations validate UUID-shaped installation
IDs. Preserve the old keys and their seven download records; do not convert or delete them merely
to make all columns look alike.

A production restore keeps `server_instance.id` so existing clients retain server-scoped ownership.
A test restore must stay isolated from real clients; development clones need a deliberate identity
policy before they can be advertised as another server.

## Deletion and preservation

The live foreign keys specify 91 CASCADE, 13 RESTRICT and 13 SET NULL actions. Most cascades clear
owned child records; restrictions protect shared vocabulary/planet/library-root ownership; actor
SET NULL retains audit/history rows when an account is removed. Cascades are not permission to
delete a populated catalog root without reviewing its dependent viewing/download/history records.

The whole-work editor blocks installment removal and checks episode dependencies before deletion,
including composite foreign keys. Entity deletion previews dependencies and requires credit-removal
confirmation; artwork deletion blocks assignments/variants/retained revisions and retains bytes.
Keep those guards. The trusted SQL operator can deliberately issue destructive SQL; raw inspection
and ordinary family administration must never inherit that authority.

`source_evidence`, revision snapshots and audit targets use polymorphic text references. They do
not all have catalog-root foreign keys. Do not delete apparently orphaned evidence/history as a
cleanup, and do not interpret an entity's deletion as permission to remove referenced image bytes.
Future deletion tools must explicitly account for those references and distinguish retained history
from an active broken relationship. No historical cleanup is justified by this review.

Keep a coordinated database/artwork backup or stop edits during the transfer window. A database
dump alone does not preserve artwork. An image rollback does not undo a schema migration, and
restoring an old database over newer family edits loses those edits. Restore into a separate
instance first. A project-local backup is not independent recovery.

## Index and performance assessment

The current scale does not justify blanket index additions or a new database. Existing indexes
already cover installment/episode order, owner-scoped tracking, media owners, recent revisions,
job eligibility and external Jellyfin item identity. All inspected indexes are valid. This review
is not a latency benchmark and did not run a production workload.

A conservative full-FK-prefix scan raised 39 candidates, but it overcounts useful existing access:
for example, playback already has both episode and installment indexes, and a partial index may
be appropriate for a specific predicate. Do not turn that count into 39 migrations.

Evaluate these only with the actual query/EXPLAIN on a representative restored dataset:

- `auth_sessions(device_id)` when device revocation is implemented, and `expires_at` when explicit
  session-retention maintenance is introduced. There are currently 80 expired session rows;
  expiry is enforced on reads, and this small count is not an emergency cleanup.
- `organization_relations(source_id)` if both directions of the editor relation query justify it;
  only `target_id` currently has its own index and there are 16 relation rows.
- `media_assets(variant_of_asset_id)` if variant/deletion queries become significant.
- Actor/account foreign-key indexes only when deletion or account-history workloads justify them.
- Search indexes that match the actual expression: the existing title trigram index covers
  `canonical_title`; it is not automatic coverage for every lower/concatenated/alias expression.

Do not add a duplicate `media_asset_assignments(asset_id)` index: it already exists. Avoid dropping
its narrow index solely because a wider unique index also begins with the asset ID; measure first.

Before adding account-creation/email-edit UI, align login identity constraints with its lookup:
login uses `lower(email)`, but the existing email uniqueness is case-sensitive. Existing data has
no case-insensitive duplicates. Rehearse a unique expression index or equivalent normalization
policy while preserving auth-user IDs. Likewise enforce one credential row per auth user before
adding another writer; today's broader provider/account identity uniqueness alone does not express
that invariant. These changes are conditional on enabling the account-management feature, not a
reason to rewrite existing identity tables during this review.

## Jobs and deferred feature gates

There is no Rust queue worker/lease heartbeat/retry executor behind `background_jobs` yet. The
35 completed rows are historical maintenance results, not evidence of a functioning acquisition
service. The schema already has scheduling, attempts, lease, heartbeat, cancellation and an
idempotency index; reuse it instead of adding another queue table.

Before enabling Download to server, implement authenticated explicit enqueue, payload validation,
claim/lease expiry/retry/cancel semantics, staging/quota checks, content probing, atomic promotion
and restart fixtures. Startup must not silently resume destructive cleanup or import jobs.
Client torrents remain in `media-transfer`; account-download rows are not a server queue.

Jellyfin/library tables are empty and the Rust runtime has no completed linking/delivery adapter.
Gate those actions until existing-file linking, missing-file detection, delivery authentication and
track mapping work. Preserve originals and Nahhasio metadata/tracking. Catalog/admin/tracking
hosting does not depend on making this feature available on day one.

Restricted policies currently fail closed instead of being fully filtered. The current middleware
uses an admin/unrestricted-access model rather than a complete fine-grained capability service.
Do not expose functioning-looking policy/capability editors until their API enforcement exists.
The initial unrestricted family account model can ship with those controls disabled.

Verified server/AppImage automatic installation is also unfinished. Gate it behind artifact trust,
API/schema compatibility, persistent-state preservation, pre-upgrade backup, health acceptance and
recovery. PostgreSQL and Jellyfin upgrades stay separately owned. File extensions do not establish
safe video content; real decoder/network/content validation remains a separate playback acceptance.

## Next checkpoints

1. Completed: R1 baseline adoption with verified backup/restored comparison and unchanged public data.
2. Implement R2 transactional authorization fixtures/fix without changing identities/history.
3. Prepare R3/R4 release preflight and the Podman installation with restricted roles, explicit roots,
   private configuration, LAN HTTPS and independent backup/restore acceptance.
4. Implement Overview/Settings against those real services; keep unfinished actions disabled.
5. Deliver verified artifacts/update recovery and complete actual Linux/Fedora acceptance. Enable
   acquisition/Jellyfin/account-policy features only after their own gates pass.

No new table, index, grant, credential store, live repair or automatic job is authorized by the
existence of this report. The current step ends at review; implementation follows Aqua's approval.

## Overview/Settings follow-up — 2026-10-20

The current Overview/Settings implementation closes the admin revoked-device predicate gap in R2:
admin mutations lock the bound device and recheck its revocation inside the authorization transaction.
Viewer writes, self-service profile writes and device registration retain their separately listed
transaction follow-ups; R2 is not fully closed. R3's routine readiness now checks exact bundled ledger
compatibility, pending migrations and server identity. Storage/role/HTTPS installation preflight is still
required. R4 now has a private, atomic server-owned provider-key store and real authenticated dashboard
controls, with masked read status and immediate shared-provider use. Production roles/mounts/Quadlets,
independent recovery, live providers and native/installed acceptance remain open. This follow-up adds
no schema migration and performs no live catalog mutation.

## Authorization and deployment review — 2026-10-21

**R2 is closed for the implemented HTTP mutation paths.** Viewer favorite, watched, tracking and
comment writes; profile/password changes; device registration; and admin editor/Settings mutations
now share transaction-level session authorization. Identity → account → session → device is the
lock order, before policy/catalog locks. Expected middleware account identity is checked again;
expiry, suspension, bans, role and device revocation are rechecked from locked current rows.
The unrestricted policy grant is locked for ordinary viewer writes. Work visibility is checked
again under a title lock using the fresh admin flag, including after demotion. A missing/expired
session is rejected rather than becoming a device-less write. Profiles retain optimistic revisions;
tracking retains its revision/idempotency behavior and admin editorial access remains available.

An established session cannot move to another installation. A new installation signs in to obtain
its own session; first registration and registration refresh on the same installation remain supported.
Login now also locks identity/account before issuing a session. This closes a further race in which
old-password verification could otherwise overlap password rotation and insert a surviving session.
Future account/policy/device management must follow the same lock order; this is not a claim that
all future capability-policy or device-management services already exist.

The isolated fixture uses a separate, non-superuser HTTP runtime role with public-table DML and
read-only migration-ledger access; fixture creation, revocation and fingerprints use its separate
operator role. The runtime cannot create public tables or write the migration ledger. Fifty-three
controlled races cover logout/password rotation, expired sessions, revoked devices, suspension,
policy removal, private/draft works, stale admin bypass and login issuance. Whole-table fingerprints
around each rejected request prove no additional state/audit/credential/device change; positive
controls prove the guarded operations still work. Scrypt runs normally in these tests; the fixture
waits up to 15 seconds for its lock barrier, without extending application request/lock timeouts.
No live account, catalog, grant or schema change is involved.

Overview now reports read-only deployment checks for dangerous database-role flags, explicit
absolute readable artwork roots and private-configuration selection/readability. It does not change
permissions, create storage, probe writes, scan artwork, or certify a complete installation. Delivery,
editing and diagnostics now share artwork-root selection, including existing environment fallbacks.
Settings has a reload action after a stale server-name conflict. The private provider file now carries
a format version; old unversioned files are accepted as version 1, and unsupported future versions
are rejected without replacement. No key is returned or recorded in database audit logs.

### What must be delivered in the Podman foundation

| Gate                             | Current evidence and required next work                                                                                                                                                                                                                                                                                                                                                         |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| LAN HTTPS and client trust       | The Rust listener currently serves plain HTTP; the native client deliberately rejects non-loopback HTTP. Its reqwest `rustls-tls` feature selects webpki roots, with no custom home-CA enrollment path. Implement trusted HTTPS and verified client trust; never disable certificate checks. Native Rust TLS can preserve the intended three-service deployment without adding a proxy process. |
| Runtime/operator separation      | Restricted-role profile/viewer/Settings fixtures now pass. Supply production grants and separate migration credentials; verify every editor operation against those grants and ensure the runtime cannot own/create schema or alter the ledger. Do not apply grants to the development/family database as a side effect.                                                                        |
| Persistent storage and preflight | The shared root resolver removes duplicate configuration logic. Production must require explicit absolute artwork/config paths and validate ownership, real read/write access and SELinux mounts before activation. The dashboard's preliminary checks do not replace that write/permission preflight. Keep database, artwork, private configuration and backup mounts distinct.                |
| Recovery and controlled upgrades | A local verified baseline checkpoint exists. An independently stored PostgreSQL/artwork/private-config backup and restore rehearsal remain required before the family server becomes authoritative. Coordinate backup → explicit migration → image replacement → readiness; older-image rollback cannot undo schema changes.                                                                    |
| Reproducible release artifacts   | Deliver a pinned Rust-only server image, release manifest/digest/trust and local install/update commands. Compile-time migrations/contracts/avatar assets belong in the image build context; Node remains a UI/build dependency. Existing AppImage workflow creates a draft but hosted build/install acceptance and verified installation/updater behavior remain unproven.                     |
| Installed acceptance             | Test on Fedora: restricted role, volume/SELinux access, trusted LAN login, desktop session persistence, image editing/tracking, reboot/reconnect, a controlled upgrade and recovery into a separate instance. Development/browser/isolated native probes do not certify this.                                                                                                                   |

**No further broad application rewrite or dashboard feature is a prerequisite to start the Podman
foundation.** The gates above should be built/tested as part of that installation, then accepted before
real family use. Existing database accounts can be preserved during transfer; a fresh empty install
still needs an explicit first-owner setup operation before it is offered as a general installation.
Account-creation/email writers must first enforce case-insensitive email and one-credential ownership
constraints described earlier; that is not needed to preserve and transfer existing accounts.

Full user/device/policy editors, queue workers, server acquisition, automatic installation and Jellyfin
linking/delivery can follow their own reviewed checkpoints. They must not appear enabled merely
because their tables exist. Jellyfin remains delivery/playback only; Nahhasio owns catalog/artwork/
tracking. Real video-content/decoder/network acceptance remains required for playback claims and
is not established by filename filtering or these authorization tests.

## Local application follow-up — 2026-10-22

The family target is now specified as Fedora Silverblue 44, approximately 300 GB initially, with SSH
access deferred. Video storage is deferred. This checkpoint changes application readiness only;
it neither installs Podman nor changes the authoritative database/artwork or credentials.

Implemented here:

- Origin-scoped home-CA enrollment through the desktop connection form, with a required out-of-band
  SHA-256 fingerprint. TLS verification remains enabled. A probe cannot persist trust; saving follows
  successful server-info/readiness probes. Existing origin trust cannot be silently replaced. The
  public CA is stored in private versioned native state, and removing a connection clears its session.
- Server information accepts the same 100-character name as Settings. Saved device connection names
  retain their 80-character bound; an automatically suggested name is shortened for that field only.
- Dashboard and Rust CLI share preliminary role/storage diagnostics. The role check also detects
  inherited schema/table ownership. Configuration must exist, be private/readable, and remain outside
  artwork storage, with canonical path comparison. `nahhasio preflight --json` additionally checks
  schema and server identity and returns a failing exit status for a failed report.

Remaining release boundaries are explicit:

| Area              | Required work before acceptance                                                                                                                                                                                      |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Backup/recovery   | Implement the pg_dump/artwork/private-config backup coordinator, encrypted USB snapshots, mount identity checks, retention, dashboard status and isolated restore rehearsal. No scheduled backup service exists yet. |
| Installed server  | Supply private bootstrap configuration, runtime/operator grants, persistent mounts, TLS termination/certificates, health/startup and Fedora SELinux/firewall integration.                                            |
| Releases/updates  | Build and accept actual AppImages/container artifacts, verify their provenance, compatibility and recovery, then enable the approved automatic update target. No automatic installation is enabled.                  |
| Native acceptance | Fresh packaged GTK client, trusted LAN login/session persistence, offline reconnect/sync, editing/artwork/tracking, reboot, controlled upgrade and restore on the selected machines.                                 |
| Optional services | Jellyfin delivery, video acquisition and fine-grained account/policy management retain their own gates; table inspection is not a management service.                                                                |

There is no justified catalog/schema rewrite or blanket index addition in this checkpoint. Keep
existing IDs, viewing history, artwork paths and migration ownership. The application pass cannot
certify storage, hardware or services that have not been installed. Read-only preflight is not a
substitute for write/restore acceptance.

Verification for this follow-up: the rebuilt native bridge passed 14 isolated HTTPS checks; 13
shared-service unit tests and two CLI unit tests passed. The disposable account/profile suite passed
including runtime/owner diagnostics and all 53 controlled authorization races. The disposable catalog
suite passed CLI preflight failure reporting, both migration runners, editor/artwork/report/import
acceptance. Five focused browser cases passed on a freshly bundled preview at isolated port 23114;
the two enrollment cases were rerun to capture the stable dialogs at 1440×1000 and 520×1000, and
those captures were inspected. This is browser plus native-service verification, not GTK acceptance.
Server/catalog/CLI strict Clippy and client-only `--no-deps` Clippy passed. Aggregate lint, Oxfmt and
workspace TypeScript checks passed on the final run; Rust formatting was blocked by concurrently
edited Awards fixtures. Workspace strict Clippy separately exposes the existing transfer engine's
`fetch_update` deprecation under the newly selected compiler. Neither failure was hidden or suppressed.
Concurrent Awards work remains outside this checkpoint's acceptance. No commit or deployment occurred.
