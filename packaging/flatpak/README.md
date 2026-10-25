# Linux client: Flatpak

Flatpak is the supported installed client, including Fedora Atomic/Silverblue. The server remains
a rootless Podman/Quadlet installation. Nix/devenv is development tooling on Shadow only: neither
the client release workflow nor the installed client uses Nix, a Nix store, a custom Bubblewrap
launcher or a host ELF-loader override. The previous AppImage packaging is retired in Git.

## Build and runtime

`io.nahhasio.Linux.json` targets GNOME Platform/SDK 50 and the matching Rust SDK extension.
GNOME 50 is the deliberately selected supported runtime baseline, not a claim to follow every
new runtime immediately. Runtime updates are handled by Flatpak; moving to a new major runtime
requires a reviewed manifest/dependency update. The build checks its Python 3.13 ABI explicitly.

The UI builds conventionally with Node 24 and pnpm 12.9.0. `prepare.py` stages a bounded source
tree, built UI, Cargo.lock-verified vendored Rust dependencies and SHA-256-locked Python wheels.
It includes no database, artwork, provider keys, host sessions, `.env` files or signing keys.
Native compilation then happens offline inside the Flatpak SDK. External module sources use
fixed hashes/commits, including Boost headers, libtorrent 2.0.12, FFmpeg, libass, libplacebo and mpv.
The resolver is isolated in an application virtual environment and retains its bounded native
protocol/network guard. The application does not install Python packages at runtime.

The workflow separates source preparation, SDK compilation and secret-bearing signing. Its
official builder container and actions are pinned; Flatpak Builder caches dependency modules
between builds. The builder needs a privileged CI container for nested build namespaces; this
does not make the Fedora application or server privileged. First builds can still take time to
compile native dependencies; no build-duration promise follows from changing package formats.

For a local packaging build on a machine with Flatpak Builder, Rust/Cargo, Node/pnpm and Python:

```sh
flatpak remote-add --user --if-not-exists flathub https://dl.flathub.org/repo/flathub.flatpakrepo
./bin/nahhasio-flatpak
```

This produces an unsigned local test repository/bundle. Production signing belongs to the release
workflow. It does not install the local build or change an existing client.

## Permissions and persistent data

The sandbox grants network access for LAN/API/provider requests, Wayland with fallback X11,
audio and GPU rendering. It grants direct filesystem access only to `xdg-videos/nahhasio` for
retained videos. GTK file dialogs use document portals for explicitly selected files/subtitles.
It does not grant whole-home/host access, host command spawning, a Podman socket or unrestricted
D-Bus access. WebKit keeps its own sandbox; no disable-sandbox environment variable is set.
The Flatpak does not inherit Shadow's renderer/loader workarounds.

Flatpak owns the application's private directories under `~/.var/app/io.nahhasio.Linux`.
The existing native XDG state resolver runs inside that scope; it does not automatically import
host-development sessions/caches. Retained video files remain a distinct Videos/nahhasio root.
Preserve the complete app-private directory and video root when moving a device installation.
An existing development/AppImage state import requires a separate reviewed copy and root check;
this packaging change never resets or moves it automatically. A family-server catalog transfer
is independent from the client sandbox and keeps its own identities/backups.

## Signed release repository

Server manifests/installer archives retain the existing Ed25519 signing key. Flatpak commits
and repository summaries use a separate OpenPGP signing key, as required by Flatpak/OSTree.
The signed Ed25519 manifest binds the Flatpak public key, repository URL, application identity,
branch, bundle hash and repository-archive hash. All exported application/extension commits are
signed. Initial host installation can therefore authenticate Flatpak trust through the publisher
key that was already distributed independently.

One-time GitHub configuration:

- Actions secret `NAHHASIO_FLATPAK_GPG_KEY`: a dedicated armored OpenPGP secret signing key,
  without a passphrase, protected by GitHub Actions secrets and used only in the release job.
- Actions variable `NAHHASIO_FLATPAK_GPG_FINGERPRINT`: its complete uppercase fingerprint.
- Repository Settings → Pages → Source: **GitHub Actions**. Pages serves a static signed package
  repository, not a Nahhasio website/application runtime.

If the `github-pages` environment has deployment branch/tag restrictions, allow the
`nahhasio-v*` release tags used by the publication workflow. Release preparation still does not
deploy Pages; only the explicit publication event does.

Generate the dedicated key in persistent private storage, outside committed files:

```sh
umask 077
mkdir -p data/backups/flatpak-signing
chmod 700 data/backups/flatpak-signing
gpg --homedir "$PWD/data/backups/flatpak-signing" --batch --pinentry-mode loopback \
  --passphrase '' --quick-generate-key 'Nahhasio Flatpak Releases' ed25519 sign 2y
```

Record the full fingerprint with `gpg --homedir ... --with-colons --list-secret-keys`, export the
selected key using `gpg --homedir ... --armor --export-secret-keys FINGERPRINT` into a protected
ignored file, then feed that file directly into `gh secret set`. Never paste private keys into
chat, logs or committed configuration. Retain an independent recovery copy. Renew the key before
expiry; replacing the trusted key is an explicit operation, not an automatic client action.

Release preparation creates a draft with a signed `.flatpak` test bundle, repository archive,
`.flatpakref`, `.flatpakrepo`, public keys and the server manifest/install bundle. It publishes no
client feed at this stage. Publishing an approved `nahhasio-v*` release verifies its manifest and
repository archive, merges the new objects into the retained `flatpak-repository` branch, and
deploys Pages. Previous commit objects remain available; no repository prune runs automatically.
The server alpha manifest is promoted only after Pages deployment succeeds.

Default client repository: `https://abdulrahmannahhas.github.io/nahhasio/flatpak/`.
Static Pages hosting has storage/bandwidth limits; repository size must be checked as releases
accumulate. Flathub or dedicated Flatpak hosting can replace this endpoint later through an
explicit trust-preserving migration. This does not expose the home server to the internet.

## Install and update

After the approved release is published, run as the **desktop user**, without sudo:

```sh
./bin/nahhasio-client-install --public-key /trusted/release-key.pem
flatpak run io.nahhasio.Linux
```

The host installer verifies the Ed25519 manifest before importing the bound Flatpak public key.
Flatpak presents its normal installation/permission review and installs dependencies from Flathub.
The `.flatpakref` is also available for Software-based installation when its origin is trusted.
No custom host updater or background Python helper is installed.

Later application/runtime updates use Software or:

```sh
flatpak update --user
```

GNOME Software's automatic-update policy belongs to the host and user settings. The app cannot
infer that policy or claim a newer version is available from inside its sandbox; its Device
settings show the running version and explain who manages updates. Relaunch after an update.
An operator can choose a retained commit with `flatpak update --user --commit=COMMIT
io.nahhasio.Linux`; binary rollback does not undo newer device-state format changes.

## Verification boundary

Run `devenv shell -- python3 -m unittest discover -s packaging/release -p test_release.py` for
offline release-boundary fixtures. Python/JSON/XML/shell validation and application static checks
do not prove a complete SDK build, Fedora portal behavior, GPU playback or installed updates.
The complete SDK build passed in [release preparation run 40210314390](https://github.com/AbdulrahmanNahhas/nahhasio/actions/runs/40210314390). Fedora installation and updates remain acceptance steps. No live
catalog mutation, client-state import or family-PC installation occurs during source validation.
