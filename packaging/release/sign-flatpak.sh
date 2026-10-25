#!/usr/bin/env bash
# Dedicated repository key: never reuse the server's PEM signing key as an OpenPGP key.
set -euo pipefail
test -n "${NAHHASIO_FLATPAK_GPG_KEY:-}"
test -n "${NAHHASIO_FLATPAK_GPG_FINGERPRINT:-}"
umask 077
export GNUPGHOME
GNUPGHOME=$(mktemp -d)
trap 'rm -rf "$GNUPGHOME"' EXIT
printf '%s\n' "$NAHHASIO_FLATPAK_GPG_KEY" | gpg --batch --import
key=$(gpg --batch --with-colons --list-secret-keys | awk -F: '$1=="fpr" {print $10; exit}')
test "$key" = "$NAHHASIO_FLATPAK_GPG_FINGERPRINT"
mkdir -p dist/release
tar --extract --gzip --file dist/unsigned-flatpak-repo.tar.gz
# Sign every exported app/extension commit, not only the primary application.
while IFS=/ read -r kind app arch branch; do
  case "$kind" in
    app) flags=() ;;
    runtime) flags=(--runtime) ;;
    *) continue ;;
  esac
  flatpak build-sign "${flags[@]}" --arch="$arch" --gpg-homedir="$GNUPGHOME" --gpg-sign="$key" dist/flatpak-repo "$app" "$branch"
done < <(ostree --repo=dist/flatpak-repo refs)
flatpak build-update-repo --gpg-homedir="$GNUPGHOME" --gpg-sign="$key" --generate-static-deltas dist/flatpak-repo
gpg --batch --export "$key" > dist/release/flatpak-key.gpg
python3 packaging/release/flatpak-descriptors.py dist/release/flatpak-key.gpg dist/flatpak-repo \
  "https://${GITHUB_REPOSITORY_OWNER,,}.github.io/${GITHUB_REPOSITORY#*/}/flatpak/"
cp dist/flatpak-repo/nahhasio.flatpakref dist/flatpak-repo/nahhasio.flatpakrepo dist/release/
flatpak build-bundle --gpg-homedir="$GNUPGHOME" --gpg-sign="$key" \
  --gpg-keys=dist/release/flatpak-key.gpg \
  --repo-url="https://${GITHUB_REPOSITORY_OWNER,,}.github.io/${GITHUB_REPOSITORY#*/}/flatpak/" \
  --runtime-repo=https://dl.flathub.org/repo/flathub.flatpakrepo \
  dist/flatpak-repo "dist/release/Nahhasio-$RELEASE_VERSION-x86_64.flatpak" io.nahhasio.Linux alpha
tar --create --gzip --hard-dereference --exclude=./tmp --file dist/release/flatpak-repository.tar.gz --directory dist/flatpak-repo .
