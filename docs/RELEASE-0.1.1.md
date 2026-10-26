# Nahhasio 0.1.1

## Changes

- Disable PostgreSQL JIT in application pools, incorporating the confirmed Fedora Browse/Home fix.
- Sign app, runtime, AppStream and AppStream2 commits, including unchanged metadata from Builder.
- Package the approved brand icon and select the matching GTK window icon.
- Coordinate server-image and host-tool updates through one verified manifest and recovery journal.
- Refresh restored database statistics, fix Quadlet mount quoting/service dependencies, and select
  source database connection fields explicitly without placing credentials in command arguments.
- Retain the catalog draft visibility and primary-studio grouping changes with their authorization fixtures.
- Repair native bridge event fixtures and reject stale responses when switching servers.
- Refresh browser fixtures for the current profile, Home, calendar, filters and display controls;
  run isolated browser journeys with two workers in CI.

The schema/API compatibility version is unchanged. No catalog migration or reimport is needed.
Fedora Software/Flatpak owns client/runtime updates. The rootless Nahhasio worker owns server and
host-tool updates, including backup/compatibility/readiness checks and rollback. Fedora OS updates
are a separate host responsibility. Never disable GPG verification to bypass metadata errors.

## One-time upgrade from the 0.1.0 host worker

The original worker cannot update its own code. After publishing 0.1.1 and confirming the
update-channel publication workflow succeeded, run this once on Fedora
as the existing service account, without sudo. Use the public release key already pinned during
installation; do not replace it with an unverified downloaded key. This bootstraps only managed
host tools and their existing service units, preserving data, credentials, CA trust and Quadlets.

```sh
(
set -eu
umask 077
mkdir -p "$HOME/Nahhasio/releases/0.1.1"
cd "$HOME/Nahhasio/releases/0.1.1"
release_url="https://github.com/AbdulrahmanNahhas/nahhasio/releases/download/nahhasio-v0.1.1"
for file in nahhasio-install.tar.gz nahhasio-install.tar.gz.sig; do
    curl --fail --location --retry 3 --proto '=https' --proto-redir '=https' \
        "$release_url/$file" --output "$file"
done
base64 --decode nahhasio-install.tar.gz.sig > installer.sig
openssl pkeyutl -verify -pubin \
    -inkey "$HOME/Nahhasio/config/release-key.pem" -rawin \
    -in nahhasio-install.tar.gz -sigfile installer.sig
tar -xzf nahhasio-install.tar.gz
systemctl --user stop nahhasio-maintenance.service
python3 packaging/server/install.py --config-root "$HOME/Nahhasio/config" maintenance-install
systemctl --user daemon-reload
systemctl --user enable --now nahhasio-maintenance.service
python3 "$HOME/Nahhasio/data/tools/operations.py" \
    --config-root "$HOME/Nahhasio/config" enqueue update
)
```

Inspect progress through the app Maintenance page or the installed worker:

```sh
python3 "$HOME/Nahhasio/data/tools/operations.py" \
    --config-root "$HOME/Nahhasio/config" status
journalctl --user -u nahhasio-maintenance.service -n 60 --no-pager
```

The update fetches the signed manifest, verifies the installer size/hash and tool compatibility,
stages immutable tool files, checks their Python startup, pulls the pinned server image, and takes
a backup. It activates the server and tools together; failures restore the previous image/tool
selection. A successful worker reload happens after the job receipt and claim removal are durable.
Schema-changing releases still require explicit maintenance. PostgreSQL major upgrades remain separate.

Daily backups and automatic server updates are separate activation choices after recovery testing:

```sh
systemctl --user enable --now nahhasio-backup.timer
systemctl --user enable --now nahhasio-update.timer
```

## Client update

After the corrected signed repository is published:

```sh
flatpak update --user --appstream nahhasio-alpha
flatpak update --user io.nahhasio.Linux
```

Fedora Software provides the same Flatpak update path. Fully quit/relaunch the app afterward.
The AppStream signing error should disappear and the application should use the brand icon.
Installed Fedora update acceptance is still required; source tests do not establish it.

## File ownership and cleanup

- `~/Nahhasio/config`: credentials, TLS and installation metadata; always retain.
- `~/Nahhasio/data`: artwork, backups, maintenance state and installed host tools; always retain.
- `data/tools/versions/<version>`: immutable verified tools, selected through `data/tools/current`.
  Stable entry links and systemd units use the selected version. Previous versions and legacy
  direct scripts remain available for recovery; never remove the selected version.
- `~/Nahhasio/releases`: downloaded/extracted installers only. After successful bootstrap/update
  verification, old copies can be removed without affecting runtime. Keeping one verified bundle
  for offline recovery is optional. Normal automatic updates do not depend on this cache.
- `~/Nahhasio/incoming`: transfer staging; remove duplicate imports only after verifying retained backups.
- PostgreSQL's `nahhasio-postgres-data` volume: the active database, not a disposable cache.

Do not rerun `prepare`, bootstrap a fresh database, or restore the original transfer over new family
edits merely to update software. Client Flatpak state, server configuration and video libraries
remain independent. Source checkout changes require a new build/publication before Fedora receives them.
