# Android and Android TV for Nahhasio 0.3.0

[Project roadmap](roadmap.md#030-android-plan) · [Client architecture](../desktop/architecture.md)

## First APK

Start with a phone client for the family server over LAN. Reuse the Arabic RTL React/Vite viewing
UI and the generated OpenAPI contract for sign-in, browsing, search, work and episode details, and
watch progress. Keep administration on Linux for this milestone.

- Use a thin Kotlin shell with AndroidX WebView. Bundle the UI locally with
  [WebViewAssetLoader](https://developer.android.com/develop/ui/views/layout/webapps/load-local-content).
  Put host-specific calls behind a typed client adapter. Limit bridge access to the bundled UI,
  keep session credentials in the native layer, and verify LAN HTTPS trust without bypassing
  certificate validation. Keep cache and tracking tied to the selected server and account.
- Use native [Media3 ExoPlayer](https://developer.android.com/media/media3/exoplayer/supported-formats)
  for authenticated linked home-library video first. Verify seeking, resume, Arabic subtitles,
  alternate audio, and progress sync with representative family-library formats. Enable permitted
  direct HTTPS and HLS sources as they pass those checks. Evaluate trailer and other embeds
  separately because behavior depends on the provider and device.
- Reuse the UI's directional focus for Android TV. Verify launcher entry, D-pad navigation,
  Center and Back, focus restoration after dialogs and playback, and legibility from a sofa.
  Test with a physical remote on TV hardware. Ship the phone APK first if TV acceptance still
  needs work. [Android TV quality guidelines](https://developer.android.com/docs/quality-guidelines/tv-app-quality)
- Publish a versioned, signed APK through GitHub Releases after testing a fresh install and an
  in-place update on supported hardware. Document installation, supported devices, minimum
  compatible server version, and playback limitations. Keep the Android package ID and signing
  identity stable. Google Play distribution is a later decision.
  [Android app signing](https://developer.android.com/studio/publish/app-signing) ·
  [GitHub Releases](https://docs.github.com/en/repositories/releasing-projects-on-github/about-releases)

## Torrent and offline follow-up

Prototype a client-side port of the existing Rust transfer engine and its libtorrent dependency
with the Android NDK. Evaluate native library packaging for phone and TV, a seekable Media3
data source, cancellation, resume, storage quotas, and Android background restrictions before
committing to support. Keep the first APK's server-file playback independent of this experiment.

Preserve the three distinct actions. **Save work** caches catalog metadata and artwork.
**Download to device** retains video for disconnected playback. **Download to server** explicitly
queues a server job. Verify storage recovery and offline progress sync before shipping device
downloads. Keep whole-work files-only policy in force across all playback paths.
