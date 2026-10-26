# Nahhasio 0.1.2

- Fix native player startup with the Lua-free Flatpak mpv build. Missing `ytdl` is
  permitted only for that optional downloader setting; mandatory restrictions remain enforced.
- Make library types primary in Browse and preserve view preferences.
- Refine episode playback, download actions and trailer presentation on work pages.
- Update the browser regression for announced works whose Play action is disabled.

There is no catalog schema migration. Existing 0.1.1 host workers can update normally;
do not repeat the 0.1.0 bootstrap or restore the original transfer bundle.

## Build and publish

From the development checkout after committing:

```sh
git push origin main
gh workflow run nahhasio-release.yml --ref main -f version=0.1.2
```

After release preparation succeeds, publish its draft:

```sh
gh release edit nahhasio-v0.1.2 --draft=false
```

Wait for the release-channel publication workflow to succeed before updating Fedora.
The release workflow creates the tag/draft after its artifacts are built; a separate tag push
would trigger another release run and is unnecessary.

## Update Fedora

Run as the existing service account, without sudo:

```sh
flatpak update --user --appstream nahhasio-alpha
flatpak update --user io.nahhasio.Linux
python3 "$HOME/Nahhasio/data/tools/operations.py" \
  --config-root "$HOME/Nahhasio/config" enqueue update
```

Check completion and readiness:

```sh
python3 "$HOME/Nahhasio/data/tools/operations.py" \
  --config-root "$HOME/Nahhasio/config" status
curl --fail --silent --show-error \
  --cacert "$HOME/Nahhasio/config/tls/ca.crt" \
  https://localhost:8443/api/v1/server/info
curl --fail --silent --show-error \
  --cacert "$HOME/Nahhasio/config/tls/ca.crt" \
  https://localhost:8443/api/health/ready
flatpak info --user io.nahhasio.Linux
```

The update job should succeed, both version reports should show 0.1.2, and readiness
should report `ready`. Fully quit and reopen the client, then check the changed pages and
a previously failing torrent source. Existing enabled backup/update timers remain in use.

## Remaining playback limits

The laptop's embedded-video flicker improved with software decoding; Fedora's default
embedded playback was reported smooth. No global decoder override ships in this release.
The separate torrent metadata timeout is not established as fixed. Native playback acceptance
does not prove installed Flatpak playback; verify the newly installed artifact explicitly.
