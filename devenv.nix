{ config, pkgs, ... }:

{
  languages.javascript = {
    enable = true;
    package = pkgs.nodejs_24;
    npm.enable = false;
    pnpm = {
      enable = true;
      package = pkgs.pnpm_11;
      install.enable = true;
    };
  };
  languages.typescript.enable = true;
  languages.rust.enable = true;
  languages.rust.channel = "nixpkgs";
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
  env.NAHHASIO_BIND = "127.0.0.1:23103";

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
    gst_all_1.gstreamer
    gst_all_1.gst-plugins-base
    libtorrent-rasterbar
    libtorrent-rasterbar.dev
    boost.dev
    cmake
    stdenv.cc
  ];
  env.GST_PLUGIN_SYSTEM_PATH_1_0 = "${pkgs.gst_all_1.gst-plugins-base}/lib/gstreamer-1.0";
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
    exec = "nahhasio-client";
    after = [ "devenv:processes:server" ];
  };

  enterShell = ''
    echo "Nahhasio environment ready"
    echo "Run: devenv up (PostgreSQL -> Rust API -> GTK desktop)"
    echo "Desktop only: devenv shell -- nahhasio-client"
    echo "Backend only: devenv up postgres server"
  '';

  enterTest = ''
    pnpm check
  '';
}
