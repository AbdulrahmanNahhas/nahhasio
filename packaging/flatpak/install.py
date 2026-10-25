#!/usr/bin/env python3
"""Bootstrap user Flatpak trust from an independently trusted signed release manifest."""
import argparse
import base64
import json
import os
from pathlib import Path
import shutil
import ssl
import subprocess
import tempfile
import urllib.parse
import urllib.request

APP = "io.nahhasio.Linux"
REMOTE = "nahhasio-alpha"
DEFAULT = "https://github.com/AbdulrahmanNahhas/nahhasio/releases/download/nahhasio-alpha/manifest.json"


class Redirects(urllib.request.HTTPRedirectHandler):
    def __init__(self, host):
        self.allowed = {host}
        if host == "github.com":
            self.allowed |= {"release-assets.githubusercontent.com", "objects.githubusercontent.com"}

    def redirect_request(self, request, fp, code, message, headers, target):
        parsed = urllib.parse.urlsplit(target)
        if parsed.scheme != "https" or parsed.hostname not in self.allowed or parsed.username or parsed.password or parsed.port not in (None, 443):
            raise ValueError("Release redirect left the trusted publisher hosts")
        return super().redirect_request(request, fp, code, message, headers, target)


def download(url, bound):
    parsed = urllib.parse.urlsplit(url)
    if parsed.scheme != "https" or not parsed.hostname or parsed.username or parsed.password or parsed.port not in (None, 443):
        raise ValueError("Release metadata must use credential-free HTTPS")
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}), Redirects(parsed.hostname),
                                        urllib.request.HTTPSHandler(context=ssl.create_default_context()))
    with opener.open(url, timeout=30) as response:
        result = response.read(bound + 1)
    if len(result) > bound:
        raise ValueError("Release metadata exceeds its size limit")
    return result


def install(public_key, manifest_url):
    if os.getuid() == 0:
        raise ValueError("Run the installer as the desktop user, without sudo")
    for dependency in ("openssl", "flatpak"):
        if not shutil.which(dependency):
            raise ValueError(f"Required host tool: {dependency}")
    raw = download(manifest_url, 262144)
    signature = base64.b64decode(download(manifest_url + ".sig", 1024).strip(), validate=True)
    der = subprocess.check_output(["openssl", "pkey", "-pubin", "-in", str(public_key), "-outform", "DER"], stderr=subprocess.DEVNULL)
    if len(der) != 44 or not der.startswith(bytes.fromhex("302a300506032b6570032100")) or len(signature) != 64:
        raise ValueError("The release verification key must be Ed25519")
    with tempfile.TemporaryDirectory(prefix="nahhasio-flatpak-") as directory:
        root = Path(directory)
        (root / "manifest").write_bytes(raw)
        (root / "signature").write_bytes(signature)
        subprocess.run(["openssl", "pkeyutl", "-verify", "-pubin", "-inkey", str(public_key), "-rawin", "-in", str(root / "manifest"), "-sigfile", str(root / "signature")], check=True, stdout=subprocess.DEVNULL)
        manifest = json.loads(raw)
        client = manifest["client"]
        if manifest.get("formatVersion") != 1 or manifest.get("apiVersion") != 1 or client.get("format") != "flatpak" or client.get("appId") != APP or client.get("branch") != "alpha":
            raise ValueError("This release does not describe the supported Flatpak client")
        repository = urllib.parse.urlsplit(client["repositoryUrl"])
        if repository.scheme != "https" or not repository.hostname or repository.username or repository.password or repository.port not in (None, 443) or repository.query or repository.fragment:
            raise ValueError("Flatpak repository must use credential-free HTTPS")
        key = base64.b64decode(client["gpgKey"], validate=True)
        if not 32 <= len(key) <= 65536:
            raise ValueError("Invalid Flatpak verification key")
        key_file = root / "flatpak-key.gpg"
        key_file.write_bytes(key)
        remotes = subprocess.check_output(["flatpak", "remotes", "--user", "--columns=name"], text=True).splitlines()
        if REMOTE in remotes:
            raise ValueError("Nahhasio remote already exists. Use Flatpak updates; changing publisher trust requires explicit review")
        subprocess.run(["flatpak", "remote-add", "--user", "--if-not-exists", "flathub", "https://dl.flathub.org/repo/flathub.flatpakrepo"], check=True)
        subprocess.run(["flatpak", "remote-add", "--user", "--no-use-for-deps", "--gpg-import=" + str(key_file), REMOTE, client["repositoryUrl"]], check=True)
        subprocess.run(["flatpak", "install", "--user", REMOTE, APP + "//alpha"], check=True)
    print("Installed. Launch with: flatpak run io.nahhasio.Linux")
    print("Future updates are owned by Flatpak and your desktop Software application.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--public-key", type=Path, required=True)
    parser.add_argument("--manifest-url", default=DEFAULT)
    args = parser.parse_args()
    os.umask(0o077)
    try:
        install(args.public_key.resolve(strict=True), args.manifest_url)
    except (OSError, ValueError, KeyError, subprocess.CalledProcessError) as error:
        raise SystemExit(f"Flatpak installation failed: {error}") from None
