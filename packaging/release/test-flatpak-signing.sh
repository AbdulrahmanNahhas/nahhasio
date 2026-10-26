#!/usr/bin/env bash
# Real OSTree/Flatpak regression: pre-existing unsigned AppStream must become verifiable.
set -euo pipefail
repository=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
signer=${1:-"$repository/packaging/release/sign-flatpak.sh"}
fixture=$(mktemp -d)
trap 'rm -rf "$fixture"' EXIT
umask 077
export GNUPGHOME="$fixture/keys"
mkdir -m 700 "$GNUPGHOME"
gpg --batch --pinentry-mode loopback --passphrase '' \
  --quick-generate-key 'Nahhasio disposable release fixture' ed25519 sign 1d >/dev/null 2>&1
export NAHHASIO_FLATPAK_GPG_FINGERPRINT
NAHHASIO_FLATPAK_GPG_FINGERPRINT=$(gpg --batch --with-colons --list-secret-keys 2>/dev/null | awk -F: '$1=="fpr" {print $10; exit}')
export NAHHASIO_FLATPAK_GPG_KEY
NAHHASIO_FLATPAK_GPG_KEY=$(gpg --batch --armor --export-secret-keys "$NAHHASIO_FLATPAK_GPG_FINGERPRINT")
export GITHUB_REPOSITORY_OWNER=fixture GITHUB_REPOSITORY=fixture/nahhasio RELEASE_VERSION=0.1.0
mkdir -p "$fixture/packaging/release" "$fixture/build/files/share/applications" \
  "$fixture/build/files/share/icons/hicolor/512x512/apps" "$fixture/dist"
cp "$repository/packaging/release/flatpak-descriptors.py" "$fixture/packaging/release/"
cp "$repository/packaging/flatpak/io.nahhasio.Linux.desktop" "$fixture/build/files/share/applications/"
cp "$repository/packaging/flatpak/io.nahhasio.Linux.png" "$fixture/build/files/share/icons/hicolor/512x512/apps/"
cat > "$fixture/build/metadata" <<'EOF'
[Application]
name=io.nahhasio.Linux
runtime=org.gnome.Platform/x86_64/50
sdk=org.gnome.Sdk/x86_64/50
EOF
(
  cd "$fixture"
  flatpak build-finish --command=nahhasio build >/dev/null
  flatpak build-export --disable-sandbox --no-update-summary --arch=x86_64 dist/flatpak-repo build alpha >/dev/null
  flatpak build-update-repo dist/flatpak-repo >/dev/null
  # Require the metadata refs that GNOME Software pulls, before the signing step runs.
  ostree --repo=dist/flatpak-repo rev-parse appstream/x86_64 >/dev/null
  ostree --repo=dist/flatpak-repo rev-parse appstream2/x86_64 >/dev/null
  tar -czf dist/unsigned-flatpak-repo.tar.gz dist/flatpak-repo
  bash "$signer"
  ostree --repo=consumer init --mode=archive
  ostree --repo=consumer remote add --gpg-import=dist/release/flatpak-key.gpg \
    --set=gpg-verify-summary=true signed "file://$fixture/dist/flatpak-repo"
  # Actual signed pulls fail if a summary, application or metadata commit is unsigned.
  ostree --repo=consumer pull signed app/io.nahhasio.Linux/x86_64/alpha appstream/x86_64 appstream2/x86_64
  ostree --repo=consumer cat signed:app/io.nahhasio.Linux/x86_64/alpha \
    /export/share/icons/hicolor/512x512/apps/io.nahhasio.Linux.png > exported-icon.png
  cmp exported-icon.png "$repository/packaging/flatpak/io.nahhasio.Linux.png"
  echo 'Signed application, AppStream and AppStream2 pulls passed with GPG verification enabled.'
)
