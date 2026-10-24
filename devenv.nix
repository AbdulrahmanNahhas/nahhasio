{
  config,
  pkgs,
  lib,
  ...
}:

{
  languages.javascript = {
    enable = true;
    package = pkgs.nodejs_24;
    npm.enable = false;
    pnpm = {
      enable = true;
      package = pkgs.pnpm_12;
      install.enable = true;
    };
  };
  languages.typescript.enable = true;
  languages.rust.enable = true;
  languages.rust.channel = "stable";
  dotenv.enable = true;

  # Reuse the existing persistent catalog. Startup never migrates or seeds it.
  services.postgres = {
    enable = true;
    package = pkgs.postgresql_17;
    initialDatabases = [ { name = "arcadia"; } ];
    listen_addresses = "127.0.0.1";
    port = 23102;
  };
  env.DATABASE_URL = "postgresql://127.0.0.1:23102/arcadia";
  # Profiles isolate DEVENV_STATE; both modes must keep using the existing catalog.
  env.PGDATA = lib.mkForce "${config.devenv.root}/.devenv/state/postgres";
  env.NAHHASIO_BIND = "127.0.0.1:23103";
  env.NAHHASIO_CONFIG_ROOT = "${config.devenv.root}/data/server-config";

  packages = with pkgs; [
    typos
    pkg-config
    openssl
    mpv
    ffmpeg
    chromium
    python3
    noto-fonts-color-emoji
    gtk4
    libadwaita
    webkitgtk_6_0
    gtk4.dev
    libadwaita.dev
    webkitgtk_6_0.dev
    glib-networking
    gst_all_1.gstreamer
    gst_all_1.gst-plugins-base
    gst_all_1.gst-plugins-good
    gst_all_1.gst-plugins-bad
    gst_all_1.gst-libav
    libtorrent-rasterbar
    libtorrent-rasterbar.dev
    boost.dev
    cmake
    stdenv.cc
  ];
  # Remote WebKit playback needs HTTPS plus HLS/MP4 demuxers and audio/video decoders.
  env.GIO_EXTRA_MODULES = "${pkgs.glib-networking}/lib/gio/modules";
  env.GST_PLUGIN_SYSTEM_PATH_1_0 = pkgs.lib.makeSearchPath "lib/gstreamer-1.0" [
    pkgs.gst_all_1.gst-plugins-base
    pkgs.gst_all_1.gst-plugins-good
    pkgs.gst_all_1.gst-plugins-bad
    pkgs.gst_all_1.gst-libav
  ];
  env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH = "${pkgs.chromium}/bin/chromium";

  # SQLx uses the system account database for its default user; the local Node CLI uses USER.
  # Make the development role explicit so both drivers reach the same existing catalog.
  processes.server.exec = ''
    export PGUSER="''${PGUSER:-$USER}"
    exec cargo run --locked -p nahhasio-server
  '';
  processes.server.after = [ "devenv:processes:postgres" ];
  processes.server.ready = {
    http.get = {
      port = 23103;
      path = "/api/health/ready";
    };
    period = 1;
    timeout = 120;
  };
  scripts.nahhasio-client.exec = ''
    exec "${config.devenv.root}/bin/nahhasio-client"
  '';
  processes.client = {
    exec = lib.mkDefault "nahhasio-client";
    after = [ "devenv:processes:server" ];
    start.enable = lib.mkDefault false;
  };

  profiles.dev.module = {
    scripts.nahhasio-client-dev.exec = ''
      set -euo pipefail
      cd "${config.devenv.root}"
      export NAHHASIO_UI_URL=http://127.0.0.1:23110/
      cargo build --locked -p nahhasio-linux -j 2
      exec bash "${config.devenv.root}/bin/nahhasio-native-runtime" "''${CARGO_TARGET_DIR:-target}/debug/nahhasio-linux" "$@"
    '';
    processes.ui = {
      exec = "pnpm --filter @nahhasio/linux-ui dev";
      ready = {
        http.get = {
          port = 23110;
          path = "/";
        };
        period = 1;
        timeout = 120;
      };
    };
    processes.client = {
      exec = "nahhasio-client-dev";
      after = [ "devenv:processes:ui" ];
      start.enable = true;
    };
  };

  enterShell = ''
    echo "Nahhasio environment ready"
    echo "Backend: devenv up (PostgreSQL -> Rust API)"
    echo "Live development: devenv --profile dev up (backend + Vite + GTK desktop)"
    echo "Built desktop: devenv up client"
  '';

  enterTest = ''
    pnpm check
  '';

  scripts.env-versions.exec = ''
    set -eu
    printf 'Project: %s\n' "$DEVENV_ROOT"
    command -v node
    node --version
    command -v pnpm
    pnpm --version
    command -v rustc
    rustc --version
    command -v cargo
    cargo --version
  '';

  scripts.env-check.exec = ''
    set -eu
    env-versions
    test "$(node -p 'process.versions.node.split(".")[0]')" = 24
    case "$(pnpm --version)" in 12.*) ;; *) echo "Expected pnpm 12" >&2; exit 1 ;; esac
    rustc --version | grep -Eq '^rustc [0-9]+\.[0-9]+\.[0-9]+ '
  '';
}
