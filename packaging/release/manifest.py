#!/usr/bin/env python3
"""Build the one signed release contract consumed by the server and client installers."""
import argparse
import base64
import hashlib
import json
from pathlib import Path
import re
import subprocess


def schema_fingerprint(root):
    root = Path(root)
    sources = sorted([*root.glob("*.sql"), root / "meta/_journal.json"])
    if len(sources) < 2 or any(not source.is_file() for source in sources):
        raise ValueError("The canonical migration sources and journal are required")
    digest = hashlib.sha256()
    for source in sources:
        digest.update(source.relative_to(root).as_posix().encode() + b"\0")
        digest.update(source.read_bytes() + b"\0")
    return digest.hexdigest()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--schema-root", type=Path, default=Path("packages/database/drizzle"))
    parser.add_argument("--fingerprint", action="store_true")
    parser.add_argument("--version")
    parser.add_argument("--client", type=Path)
    parser.add_argument("--client-url")
    parser.add_argument("--flatpak-key", type=Path)
    parser.add_argument("--flatpak-fingerprint")
    parser.add_argument("--flatpak-repo", type=Path)
    parser.add_argument("--repository-url", default="https://abdulrahmannahhas.github.io/nahhasio/flatpak/")
    parser.add_argument("--server-image")
    parser.add_argument("--signing-key", type=Path)
    parser.add_argument("--output", type=Path, default=Path("dist/release"))
    args = parser.parse_args()
    schema = schema_fingerprint(args.schema_root)
    if args.fingerprint:
        print(schema)
        return
    if not re.fullmatch(r"\d+\.\d+\.\d+(?:-[A-Za-z0-9.-]+)?", args.version or ""):
        parser.error("A semantic --version is required")
    if not re.fullmatch(r"ghcr\.io/[a-z0-9_./-]+@sha256:[0-9a-f]{64}", args.server_image or ""):
        parser.error("A digest-qualified GHCR --server-image is required")
    if not args.client_url or not args.client_url.startswith("https://github.com/"):
        parser.error("A GitHub HTTPS --client-url is required")
    if not args.client or not args.signing_key:
        parser.error("--client and --signing-key are required")
    if not args.flatpak_key or not args.flatpak_repo or not re.fullmatch(r"[A-F0-9]{40,64}", args.flatpak_fingerprint or ""):
        parser.error("A signed Flatpak repository, exported GPG key and full fingerprint are required")
    if not args.repository_url.startswith("https://") or not args.repository_url.endswith("/"):
        parser.error("The Flatpak repository must use an HTTPS directory URL")
    public_der = subprocess.run(["openssl", "pkey", "-in", str(args.signing_key), "-pubout", "-outform", "DER"], check=True, capture_output=True).stdout
    if len(public_der) != 44 or not public_der.startswith(bytes.fromhex("302a300506032b6570032100")):
        raise ValueError("An Ed25519 signing key is required")
    digest = hashlib.sha256()
    with args.client.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(block)
    manifest = {"formatVersion": 1, "version": args.version, "apiVersion": 1,
                "schemaVersion": schema,
                "client": {"url": args.client_url, "sha256": digest.hexdigest(),
                           "size": args.client.stat().st_size, "architecture": "x86_64",
                           "format": "flatpak", "appId": "io.nahhasio.Linux", "branch": "alpha",
                           "repositoryUrl": args.repository_url,
                           "gpgFingerprint": args.flatpak_fingerprint,
                           "gpgKey": base64.b64encode(args.flatpak_key.read_bytes()).decode(),
                           "repositoryArchive": {"sha256": hashlib.sha256(args.flatpak_repo.read_bytes()).hexdigest(), "size": args.flatpak_repo.stat().st_size}},
                "server": {"image": args.server_image, "schemaVersion": schema}}
    args.output.mkdir(parents=True, exist_ok=True)
    path = args.output / "manifest.json"
    path.write_text(json.dumps(manifest, separators=(",", ":"), sort_keys=True) + "\n")
    signature = subprocess.run(["openssl", "pkeyutl", "-sign", "-rawin", "-inkey", str(args.signing_key), "-in", str(path)], check=True, capture_output=True).stdout
    if len(signature) != 64:
        raise ValueError("An Ed25519 signing key is required")
    (args.output / "manifest.json.sig").write_text(base64.b64encode(signature).decode() + "\n")
    subprocess.run(["openssl", "pkey", "-in", str(args.signing_key), "-pubout", "-out", str(args.output / "release-key.pem")], check=True, capture_output=True)


if __name__ == "__main__":
    main()
