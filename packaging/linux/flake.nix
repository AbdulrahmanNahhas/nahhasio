{
  description = "Nahhasio Linux client AppImage from the pinned devenv build";
  inputs = {
    nixpkgs.url = "github:cachix/devenv-nixpkgs/760b85220489f69855e6df78a6d1dad5873f8bf6";
    appimage.url = "github:ralismark/nix-appimage/7946addbc0d97e358a6d7aefe5e82310f0fe6b18";
    appimage.inputs.nixpkgs.follows = "nixpkgs";
  };
  outputs =
    { nixpkgs, appimage, ... }:
    let
      system = "x86_64-linux";
      pkgs = import nixpkgs { inherit system; };
      lib = pkgs.lib;
      binary = builtins.path {
        path = builtins.getEnv "NAHHASIO_PACKAGE_BINARY";
        name = "nahhasio-binary";
      };
      ui = builtins.path {
        path = builtins.getEnv "NAHHASIO_PACKAGE_UI";
        name = "nahhasio-ui";
      };
      launcher = builtins.path {
        path = builtins.getEnv "NAHHASIO_PACKAGE_LAUNCHER";
        name = "nahhasio-native-runtime";
      };
      runtimePaths = map builtins.storePath (
        lib.splitString ":" (builtins.getEnv "NAHHASIO_PACKAGE_RUNTIME")
      );
      fonts = pkgs.makeFontsConf {
        fontDirectories = [
          pkgs.dejavu_fonts
          pkgs.noto-fonts-color-emoji
        ];
      };
      staticBubblewrap = pkgs.pkgsStatic.bubblewrap.override {
        libcap = pkgs.pkgsStatic.libcap.override { withGo = false; };
      };
      apprun = pkgs.runCommand "nahhasio-AppRun" { } ''
        mkdir -p $out/runtime
        install -m755 ${./AppRun} $out/AppRun
        install -m755 ${staticBubblewrap}/bin/bwrap $out/runtime/bwrap
      '';
      mkAppImage = pkgs.callPackage "${appimage}/mkAppImage.nix" {
        mkappimage-runtime = appimage.packages.${system}.appimage-runtimes.appimage-type2-runtime;
        mkappimage-apprun = apprun;
      };
      client =
        pkgs.runCommand "nahhasio-linux"
          {
            nativeBuildInputs = [
              pkgs.makeWrapper
              pkgs.binutils
            ];
            inherit runtimePaths;
          }
          ''
            mkdir -p $out/bin $out/libexec $out/share/nahhasio/ui $out/share/applications
            install -m755 ${binary} $out/libexec/nahhasio-linux
            install -m755 ${launcher} $out/libexec/nahhasio-native-runtime
            strip --strip-debug $out/libexec/nahhasio-linux
            cp -r ${ui}/. $out/share/nahhasio/ui/
            printf '%s\n' $runtimePaths > $out/share/nahhasio/runtime-references
            makeWrapper ${pkgs.bash}/bin/bash $out/bin/nahhasio \
              --add-flags "$out/libexec/nahhasio-native-runtime $out/libexec/nahhasio-linux" \
              --prefix PATH : ${
                lib.makeBinPath [
                  pkgs.binutils
                  pkgs.gnused
                ]
              } \
              --unset LD_LIBRARY_PATH \
              --set NAHHASIO_UI_DIR $out/share/nahhasio/ui \
              --set FONTCONFIG_FILE ${fonts} \
              --set-default SSL_CERT_FILE ${pkgs.cacert}/etc/ssl/certs/ca-bundle.crt \
              --prefix XDG_DATA_DIRS : ${
                lib.makeSearchPath "share" [
                  pkgs.gsettings-desktop-schemas
                  pkgs.gtk4
                  pkgs.adwaita-icon-theme
                  pkgs.hicolor-icon-theme
                ]
              } \
              --prefix GIO_EXTRA_MODULES : ${pkgs.glib-networking}/lib/gio/modules \
              --set GST_PLUGIN_SYSTEM_PATH_1_0 ${
                lib.makeSearchPath "lib/gstreamer-1.0" [
                  pkgs.gst_all_1.gst-plugins-base
                  pkgs.gst_all_1.gst-plugins-good
                  pkgs.gst_all_1.gst-plugins-bad
                  pkgs.gst_all_1.gst-libav
                ]
              }
            cat > $out/share/applications/io.nahhasio.Linux.desktop <<EOF
            [Desktop Entry]
            Type=Application
            Name=Nahhasio
            Comment=Family media catalog and Linux player
            Exec=nahhasio
            Icon=video-x-generic
            Terminal=false
            Categories=AudioVideo;Video;
            StartupWMClass=io.nahhasio.Linux
            EOF
          '';
    in
    {
      packages.${system}.default = mkAppImage {
        program = "${client}/bin/nahhasio";
        name = "Nahhasio-x86_64.AppImage";
        squashfsArgs = [
          "-processors"
          "2"
        ];
      };
    };
}
