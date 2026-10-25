#!/usr/bin/env bash
set -euo pipefail

# Reuse the release manifest's reviewed source/hash instead of maintaining another dependency pin.
: "${NAHHASIO_CI_NATIVE_ROOT:?Select the CI dependency installation directory}"
read -r source_url source_sha < <(python3 - <<'PY'
import json
with open('packaging/flatpak/io.nahhasio.Linux.json') as stream:
    manifest = json.load(stream)
source = next(module for module in manifest['modules'] if module['name'] == 'libtorrent')['sources'][0]
print(source['url'], source['sha256'])
PY
)

task_source=$(mktemp -d)
trap 'rm -rf "$task_source"' EXIT
curl --fail --location --retry 3 --proto '=https' --proto-redir '=https' \
  "$source_url" --output "$task_source/libtorrent.tar.gz"
printf '%s  %s\n' "$source_sha" "$task_source/libtorrent.tar.gz" | sha256sum --check --status
tar -xzf "$task_source/libtorrent.tar.gz" -C "$task_source" --strip-components=1
cmake -S "$task_source" -B "$task_source/build" -G Ninja \
  -DCMAKE_BUILD_TYPE=Release \
  -DCMAKE_INSTALL_PREFIX="$NAHHASIO_CI_NATIVE_ROOT" \
  -DCMAKE_INSTALL_LIBDIR=lib \
  -DBUILD_SHARED_LIBS=ON \
  -DCMAKE_CXX_STANDARD=17 \
  -DBoost_NO_BOOST_CMAKE=ON \
  -Dbuild_tests=OFF -Dbuild_examples=OFF -Dpython-bindings=OFF
cmake --build "$task_source/build" --parallel 2
cmake --install "$task_source/build"
