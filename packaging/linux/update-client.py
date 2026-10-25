#!/usr/bin/env python3
"""Managed AppImage releases. No database, device-state or session files are touched."""
import argparse
import base64
import fcntl
import hashlib
import ipaddress
import json
import os
from pathlib import Path
import platform
import re
import shutil
import socket
import stat
import subprocess
import sys
import tempfile
import time
import urllib.parse
import urllib.request

VERSION = re.compile(r"^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$")
DIGEST = re.compile(r"^[0-9a-f]{64}$")
DEFAULT_MANIFEST = "https://github.com/AbdulrahmanNahhas/nahhasio/releases/download/nahhasio-alpha/manifest.json"
MAX_IMAGE = 8 * 1024**3
GITHUB_HOSTS = {"github.com", "objects.githubusercontent.com", "release-assets.githubusercontent.com"}


def private_directory(path):
    path = Path(path)
    if not path.is_absolute() or path.is_symlink():
        raise ValueError("The installation directory must be an absolute real directory")
    path.mkdir(mode=0o700, parents=True, exist_ok=True)
    info = path.stat()
    if info.st_uid != os.getuid() or stat.S_IMODE(info.st_mode) & 0o077:
        raise ValueError("The installation directory must be private and owned by this user")
    return path


def read_json(path, default=None):
    if not path.exists():
        return default
    if path.is_symlink() or not path.is_file() or path.stat().st_size > 65536 or path.stat().st_uid != os.getuid() or stat.S_IMODE(path.stat().st_mode) & 0o077:
        raise ValueError("Invalid installation metadata")
    return json.loads(path.read_bytes())


def atomic_json(path, value):
    data = json.dumps(value, ensure_ascii=True, separators=(",", ":")).encode()
    fd, name = tempfile.mkstemp(prefix=".state-", dir=path.parent)
    try:
        with os.fdopen(fd, "wb") as stream:
            stream.write(data)
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(name, path)
        sync_directory(path.parent)
    finally:
        Path(name).unlink(missing_ok=True)


def sync_directory(path):
    fd = os.open(path, os.O_RDONLY | os.O_DIRECTORY)
    try:
        os.fsync(fd)
    finally:
        os.close(fd)


def version_key(value):
    match = VERSION.fullmatch(value)
    if not match:
        raise ValueError("Invalid release version")
    major, minor, patch = (int(value) for value in match.groups()[:3])
    prerelease = match.group(4)
    if prerelease and any(part.isdigit() and len(part) > 1 and part.startswith("0") for part in prerelease.split(".")):
        raise ValueError("Invalid numeric release identifier")
    # SemVer numeric identifiers sort before nonnumeric identifiers; a release sorts last.
    parts = tuple((0, int(part)) if part.isdigit() else (1, part) for part in (prerelease or "").split("."))
    return major, minor, patch, prerelease is None, parts


def check_url(value, allowed):
    parsed = urllib.parse.urlsplit(value)
    if parsed.scheme != "https" or not parsed.hostname or parsed.username or parsed.password or parsed.port not in (None, 443) or parsed.fragment:
        raise ValueError("Release downloads require a public HTTPS URL")
    hostname = parsed.hostname.lower()
    if hostname not in allowed:
        raise ValueError("The release redirects outside its configured download hosts")
    addresses = socket.getaddrinfo(hostname, 443, type=socket.SOCK_STREAM)
    if not addresses or any(not ipaddress.ip_address(item[4][0]).is_global for item in addresses):
        raise ValueError("Release downloads cannot use private network destinations")
    return parsed


class SafeRedirect(urllib.request.HTTPRedirectHandler):
    max_redirections = 5
    max_repeats = 2

    def __init__(self, allowed):
        self.allowed = allowed

    def redirect_request(self, req, fp, code, msg, headers, newurl):
        check_url(newurl, self.allowed)
        return super().redirect_request(req, fp, code, msg, headers, newurl)


def download(url, allowed, limit, destination=None, expected_digest=None):
    check_url(url, allowed)
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}), SafeRedirect(allowed))
    request = urllib.request.Request(url, headers={"User-Agent": "Nahhasio-Updater/1", "Accept-Encoding": "identity"})
    digest = hashlib.sha256()
    total = 0
    deadline = time.monotonic() + 900
    chunks = []
    with opener.open(request, timeout=30) as response:
        if response.status != 200:
            raise ValueError("The release download failed")
        content_length = response.headers.get("Content-Length")
        if content_length and int(content_length) > limit:
            raise ValueError("The release download exceeds its expected size")
        while True:
            if time.monotonic() > deadline:
                raise ValueError("The release download exceeded its time limit")
            chunk = response.read(1024 * 1024)
            if not chunk:
                break
            total += len(chunk)
            if total > limit:
                raise ValueError("The release download exceeds its expected size")
            digest.update(chunk)
            if destination:
                destination.write(chunk)
            else:
                chunks.append(chunk)
    if expected_digest and (total != limit or digest.hexdigest() != expected_digest):
        raise ValueError("The AppImage did not match its signed size and checksum")
    return b"".join(chunks)


def validate_manifest(value):
    if not isinstance(value, dict) or set(value) != {"formatVersion", "version", "apiVersion", "schemaVersion", "client", "server"}:
        raise ValueError("Unsupported release manifest")
    if value["formatVersion"] != 1 or value["apiVersion"] != 1 or not DIGEST.fullmatch(value["schemaVersion"]):
        raise ValueError("The release requires an unsupported API or manifest version")
    version_key(value["version"])
    client, server = value["client"], value["server"]
    if set(client) != {"url", "sha256", "size", "architecture"} or set(server) != {"image", "schemaVersion"}:
        raise ValueError("Invalid release artifacts")
    if client["architecture"] != "x86_64" or platform.machine() not in ("x86_64", "AMD64"):
        raise ValueError("This release does not support this CPU architecture")
    if not DIGEST.fullmatch(client["sha256"]) or type(client["size"]) is not int or not 0 < client["size"] <= MAX_IMAGE:
        raise ValueError("Invalid AppImage checksum or size")
    if server["schemaVersion"] != value["schemaVersion"] or not re.fullmatch(r"ghcr\.io/[a-z0-9._/-]+@sha256:[0-9a-f]{64}", server["image"]):
        raise ValueError("Invalid server release identity")
    return value


def verify_manifest(root, manifest_bytes, signature_bytes):
    try:
        signature = base64.b64decode(signature_bytes.strip(), validate=True)
    except ValueError as error:
        raise ValueError("Invalid release signature") from error
    if len(signature) != 64:
        raise ValueError("Invalid Ed25519 release signature")
    key = root / "release-key.pem"
    if key.is_symlink() or not key.is_file() or key.stat().st_size > 8192:
        raise ValueError("The pinned release key is unavailable")
    public_der = subprocess.run(["openssl", "pkey", "-pubin", "-in", str(key), "-pubout", "-outform", "DER"], capture_output=True, timeout=15, check=False)
    if public_der.returncode or len(public_der.stdout) != 44 or not public_der.stdout.startswith(bytes.fromhex("302a300506032b6570032100")):
        raise ValueError("The pinned publisher key must be Ed25519")
    with tempfile.TemporaryDirectory(prefix=".verify-", dir=root) as folder:
        manifest_file, signature_file = Path(folder) / "manifest.json", Path(folder) / "manifest.sig"
        manifest_file.write_bytes(manifest_bytes)
        signature_file.write_bytes(signature)
        result = subprocess.run(["openssl", "pkeyutl", "-verify", "-pubin", "-inkey", str(key), "-rawin", "-in", str(manifest_file), "-sigfile", str(signature_file)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=15, check=False)
        if result.returncode:
            raise ValueError("The release signature does not match the pinned publisher key")
    return validate_manifest(json.loads(manifest_bytes))


def config(root):
    value = read_json(root / "installation.json")
    if not isinstance(value, dict) or value.get("formatVersion") != 1:
        raise ValueError("The managed client installation is unavailable")
    parsed = urllib.parse.urlsplit(value["manifestUrl"])
    hosts = GITHUB_HOSTS | {parsed.hostname}
    check_url(value["manifestUrl"], hosts)
    return value, hosts


def fetch_manifest(root):
    settings, hosts = config(root)
    url = settings["manifestUrl"]
    return verify_manifest(root, download(url, hosts, 65536), download(url + ".sig", hosts, 1024)), hosts


def status(root):
    settings = read_json(root / "installation.json", {})
    current = read_json(root / "current.json", {})
    available = read_json(root / "available.json", {})
    pending = read_json(root / "pending.json", {})
    available_version = available.get("version")
    current_version = current.get("version")
    newer = bool(available_version and current_version and version_key(available_version) > version_key(current_version))
    return {"available": True, "currentVersion": current_version or "unknown", "availableVersion": available_version if newer else None, "pendingVersion": pending.get("version"), "state": "staged" if pending else "available" if newer else "current", "message": "سيُثبّت التحديث عند تشغيل التطبيق مرة أخرى." if pending else "يوجد تحديث جاهز للتنزيل." if newer else "التطبيق محدّث.", "automatic": settings.get("automatic", True), "lastCheck": available.get("checkedAt")}


def check(root):
    manifest, _ = fetch_manifest(root)
    current = read_json(root / "current.json", {})
    if current.get("version") and version_key(manifest["version"]) < version_key(current["version"]):
        raise ValueError("An older release cannot replace the installed client")
    atomic_json(root / "available.json", {"version": manifest["version"], "checkedAt": int(time.time())})
    return status(root)


def stage(root):
    manifest, hosts = fetch_manifest(root)
    current = read_json(root / "current.json", {})
    if current.get("version") and version_key(manifest["version"]) <= version_key(current["version"]):
        atomic_json(root / "available.json", {"version": manifest["version"], "checkedAt": int(time.time())})
        return status(root)
    image = manifest["client"]
    target = root / "versions" / (manifest["version"] + ".AppImage")
    versions = private_directory(root / "versions")
    for unfinished in versions.glob(".download-*"):
        if unfinished.is_file() and not unfinished.is_symlink():
            unfinished.unlink()
    if target.is_symlink():
        raise ValueError("The update destination is not a regular file")
    if not target.exists() or sha256_file(target) != image["sha256"]:
        fd, temporary = tempfile.mkstemp(prefix=".download-", dir=versions)
        try:
            with os.fdopen(fd, "wb") as stream:
                download(image["url"], hosts, image["size"], stream, image["sha256"])
                stream.flush()
                os.fsync(stream.fileno())
            os.chmod(temporary, 0o700)
            os.replace(temporary, target)
            sync_directory(versions)
        finally:
            Path(temporary).unlink(missing_ok=True)
    atomic_json(root / "pending.json", {"version": manifest["version"], "sha256": image["sha256"], "size": image["size"]})
    atomic_json(root / "available.json", {"version": manifest["version"], "checkedAt": int(time.time())})
    return status(root)


def sha256_file(path):
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def select(root, record):
    version_key(record["version"])
    target = root / "versions" / (record["version"] + ".AppImage")
    if target.is_symlink() or not target.is_file() or target.stat().st_size != record["size"] or sha256_file(target) != record["sha256"]:
        raise ValueError("The selected AppImage no longer matches its verified release")
    temporary = root / ".current-next"
    temporary.unlink(missing_ok=True)
    temporary.symlink_to("versions/" + target.name)
    os.replace(temporary, root / "current")
    atomic_json(root / "current.json", record)
    sync_directory(root)


def activate(root):
    pending = read_json(root / "pending.json")
    if not pending:
        return status(root)
    current = read_json(root / "current.json")
    if current and current["version"] != pending["version"]:
        atomic_json(root / "previous.json", current)
    select(root, pending)
    (root / "pending.json").unlink()
    # Retain current and previous versions; never touch device caches or downloads.
    previous = read_json(root / "previous.json", {})
    keep = {pending["version"], previous.get("version")}
    for image in (root / "versions").glob("*.AppImage"):
        if image.name.removesuffix(".AppImage") not in keep and not image.is_symlink():
            image.unlink()
    return status(root)


def rollback(root):
    previous = read_json(root / "previous.json")
    if not previous:
        raise ValueError("There is no previous client version")
    current = read_json(root / "current.json")
    select(root, previous)
    if current:
        atomic_json(root / "previous.json", current)
    (root / "pending.json").unlink(missing_ok=True)
    settings = read_json(root / "installation.json")
    settings["automatic"] = False
    atomic_json(root / "installation.json", settings)
    return status(root)


def install(args):
    root = private_directory(args.root)
    link = Path.home() / ".local/bin/nahhasio"
    if link.exists() or link.is_symlink():
        raise ValueError("~/.local/bin/nahhasio already exists; rename it before installing")
    if (root / "installation.json").exists():
        raise ValueError("A managed installation already exists; use its updater")
    source = Path(args.public_key).resolve(strict=True)
    if source.stat().st_size > 8192:
        raise ValueError("Invalid release public key")
    key = root / "release-key.pem"
    shutil.copyfile(source, key)
    key.chmod(0o600)
    atomic_json(root / "installation.json", {"formatVersion": 1, "manifestUrl": args.manifest_url, "automatic": True})
    shutil.copyfile(Path(__file__).resolve(), root / "update-client.py")
    (root / "update-client.py").chmod(0o700)
    try:
        stage(root)
        activate(root)
    except Exception:
        (root / "installation.json").unlink(missing_ok=True)
        raise
    launcher = root / "launch"
    launcher.write_text('#!/bin/sh\nset -eu\nroot=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd -P)\nexport NAHHASIO_CLIENT_INSTALL_ROOT="$root"\npython3 "$root/update-client.py" --root "$root" activate >/dev/null || true\npython3 "$root/update-client.py" --root "$root" automatic >/dev/null 2>&1 &\nexec "$root/current" "$@"\n')
    launcher.chmod(0o700)
    local_bin = Path.home() / ".local/bin"
    local_bin.mkdir(parents=True, exist_ok=True)
    link = local_bin / "nahhasio"
    if link.exists() or link.is_symlink():
        raise ValueError("~/.local/bin/nahhasio already exists; remove or rename it before registering this installation")
    link.symlink_to(launcher)
    applications = Path(os.environ.get("XDG_DATA_HOME", str(Path.home() / ".local/share"))) / "applications"
    applications.mkdir(parents=True, exist_ok=True)
    # Desktop Exec quoting protects spaces and metacharacters in a user's home path.
    quoted = str(launcher).replace("\\", "\\\\").replace('"', '\\"').replace("`", "\\`").replace("$", "\\$").replace("%", "%%")
    (applications / "io.nahhasio.Linux.desktop").write_text('[Desktop Entry]\nType=Application\nName=Nahhasio\nName[ar]=نحّاسيو\nExec="' + quoted + '"\nIcon=video-x-generic\nTerminal=false\nCategories=AudioVideo;Video;\n')
    return status(root)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", default=str(Path.home() / ".local/share/nahhasio-client"))
    parser.add_argument("action", choices=("status", "check", "stage", "activate", "automatic", "rollback", "install"))
    parser.add_argument("--public-key")
    parser.add_argument("--manifest-url", default=DEFAULT_MANIFEST)
    args = parser.parse_args()
    os.umask(0o077)
    try:
        root = private_directory(args.root)
        if args.action == "status":
            result = status(root)
        else:
            lock = os.open(root / "update.lock", os.O_CREAT | os.O_RDWR | os.O_NOFOLLOW, 0o600)
            with os.fdopen(lock, "w") as stream:
                fcntl.flock(stream, fcntl.LOCK_EX | fcntl.LOCK_NB)
                if args.action == "install":
                    if not args.public_key:
                        parser.error("install requires --public-key")
                    result = install(args)
                elif args.action == "automatic":
                    settings = read_json(root / "installation.json", {})
                    last = read_json(root / "available.json", {}).get("checkedAt", 0)
                    result = stage(root) if settings.get("automatic", True) and time.time() - last > 86400 else status(root)
                else:
                    result = {"check": check, "stage": stage, "activate": activate, "rollback": rollback}[args.action](root)
        print(json.dumps(result, ensure_ascii=True))
    except BlockingIOError:
        print(json.dumps({"error": "A client update operation is already running"}))
        return 1
    except (OSError, ValueError, KeyError, TypeError, subprocess.SubprocessError):
        # Provider URLs, filesystem paths and command output never reach the WebView.
        print(json.dumps({"error": "Client update failed; check network access, installation permissions and the publisher signature"}))
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
