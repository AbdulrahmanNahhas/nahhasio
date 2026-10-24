{ pkgs, resolverScript ? ../../apps/linux/anime/resolver.py }:
let
  python = pkgs.python313;
  api = python.pkgs.buildPythonPackage {
    pname = "anipy-api";
    version = "3.10.1";
    format = "wheel";
    src = pkgs.fetchurl {
      url = "https://files.pythonhosted.org/packages/8d/71/e776fba62f96d3265de2c686a611b1ec14151ed055a461cb0dbcd8832886/anipy_api-3.10.1-py3-none-any.whl";
      sha256 = "135451c19e5a671315a2f6c4e4eedf0cf13964f7223ea68761acf5234abe1604";
    };
    pythonRelaxDeps = true;
    # Playback/download modules are unused: Nahhasio owns both operations.
    pythonRemoveDeps = [ "python-mpv" "python-ffmpeg" ];
    nativeBuildInputs = [ python.pkgs.pythonRelaxDepsHook ];
    dependencies = with python.pkgs; [
      beautifulsoup4 dataclasses-json levenshtein m3u8 pycountry pycryptodomex
      rapidfuzz requests simpleeval urllib3
    ];
    pythonImportsCheck = [ "anipy_api.provider" ];
  };
  runtime = python.withPackages (_: [ api ]);
in
pkgs.writeShellScriptBin "nahhasio-anime-resolver" ''
  export SSL_CERT_FILE=${pkgs.cacert}/etc/ssl/certs/ca-bundle.crt
  exec ${runtime}/bin/python3 -I ${resolverScript}
''
