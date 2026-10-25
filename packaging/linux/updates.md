# Managed Linux client updates

The managed AppImage lives under `~/.local/share/nahhasio-client`, independently of
`~/.local/state/nahhasio` and retained device videos. Development/source clients do not
update themselves. Supported release architecture is x86_64 Linux.

## Initial installation

The Fedora desktop needs Python 3, OpenSSL with Ed25519 support, and the AppImage runtime
requirements. Obtain `release-key.pem` from the publisher through a trusted channel and
check its fingerprint independently. The installer never downloads or replaces that trust key.
From a release installation bundle or this checkout:

```sh
./bin/nahhasio-client-install --public-key /absolute/path/release-key.pem
```

An alternative release channel can be supplied with `--manifest-url https://…/manifest.json`.
The manifest and `manifest.json.sig` must be reachable by HTTPS. GitHub release-asset redirects
are permitted to GitHub's fixed asset hosts; other redirects outside the configured publisher
host are refused. Proxy environment settings are not inherited by the downloader. Private
network download destinations are rejected. The application API connection is unrelated to
this release transport and can remain LAN-only.

The installer verifies the initial release, installs a user launcher at `~/.local/bin/nahhasio`
and a desktop entry, and does not start the application. It refuses to overwrite an existing
launcher or managed installation. No sudo, source checkout, Node or Nix is needed to run the
installed AppImage. Installation/update helper operations require host Python and OpenSSL.

## Update behavior

On launch, the launcher activates a verified pending AppImage, starts a bounded background
update check/staging process when the last successful check is older than one day, and launches
the current version. The existing running AppImage is never overwritten. A newly downloaded
version takes effect at the next launch. Client Settings can also check or stage an update through
the fixed native bridge. Status reads require no network and do not wait for the update lock.

Release manifests use format version 1 and API version 1. Their exact JSON bytes are verified
with the installed Ed25519 public key before any artifact URL is used. The base64 detached
signature is `manifest.json.sig`. The signed client URL, SHA-256 and exact byte size must match;
partial downloads never become pending releases. Older versions are refused. Versions use SemVer
and must be unique; publishing changed bytes under an existing version is not an update.

Only one check, stage, activation or rollback operation holds the private update lock at a time.
Current and previous AppImages are retained. Interrupted downloads can be retried; private partial
files are removed on the next staging operation. Sessions, server connections, saved metadata,
tracking and videos are not copied, deleted or rewritten by the updater.

## Recovery

Close Nahhasio, then select the previous retained AppImage with:

```sh
python3 ~/.local/share/nahhasio-client/update-client.py rollback
```

Rollback disables automatic staging until explicitly re-enabled in the private
`installation.json` (`automatic` field). Manual check/stage remains available. A rollback cannot
reverse changes to device-state formats made by a newer client; release compatibility review
must preserve supported persistent formats. Keep the state directory before deliberate downgrades.

The helper is installed separately from the AppImage and supports manifest format 1. A future
incompatible updater/manifest format needs an explicit installer/helper upgrade; downloading an
AppImage does not silently replace the publisher trust key or host helper.

## Verification boundary

Python syntax and shell parsing can be checked without downloads or installation. Real signed
release downloads, AppImage execution, desktop integration, restart activation and rollback are
part of deferred consolidated installation acceptance. No such acceptance is implied by code.
