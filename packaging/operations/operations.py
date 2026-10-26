#!/usr/bin/env python3
"""Rootless, fixed-operation maintenance worker. Never expose a Podman socket to the API."""

from __future__ import annotations

import argparse
import base64
import contextlib
import datetime as dt
import fcntl
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import re
import shutil
import ssl
import stat
import subprocess
import sys
import tarfile
import tempfile
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid

VERSION = 1
HOST_TOOLS_VERSION = "0.1.1"
_tools_spec = importlib.util.spec_from_file_location("nahhasio_host_tools", Path(__file__).resolve().with_name("host_tools.py"))
host_tools = importlib.util.module_from_spec(_tools_spec)
_tools_spec.loader.exec_module(host_tools)
OPERATIONS = {"backup", "restore", "check-update", "update"}
BACKUP_ID = re.compile(r"^[0-9]{8}T[0-9]{6}Z-[a-f0-9]{8}$")
SHA256 = re.compile(r"^[a-f0-9]{64}$")
DB_NAME = re.compile(r"^[a-z][a-z0-9_]{0,62}$")


def version_key(value):
    match = re.fullmatch(r"(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)(?:-([a-zA-Z0-9.-]+))?", value)
    if not match:
        raise ValueError("Release version is not supported SemVer")
    pre = match.group(4)
    parts = []
    if pre is not None:
        for part in pre.split("."):
            if not part or part.isdigit() and len(part) > 1 and part.startswith("0"):
                raise ValueError("Invalid release prerelease identifier")
            parts.append((0, int(part)) if part.isdigit() else (1, part))
    return tuple(int(match.group(index)) for index in (1, 2, 3)), pre is None, tuple(parts)


def now():
    return dt.datetime.now(dt.timezone.utc).isoformat().replace("+00:00", "Z")


def private_directory(path):
    path = Path(path)
    if not path.is_absolute():
        raise ValueError("Maintenance directories must be absolute paths")
    path.mkdir(mode=0o700, parents=True, exist_ok=True)
    info = path.lstat()
    if not stat.S_ISDIR(info.st_mode) or info.st_uid != os.getuid():
        raise ValueError("Maintenance directory must be owned by the service account")
    if info.st_mode & 0o077:
        raise ValueError("Maintenance directory must have mode 0700")
    return path


def read_json(path, maximum=1024 * 1024):
    info = path.lstat()
    if not stat.S_ISREG(info.st_mode) or info.st_size > maximum:
        raise ValueError("Invalid or oversized maintenance document")
    with path.open("rb") as stream:
        return json.load(stream)


def atomic_json(path, value):
    path = Path(path)
    fd, temporary = tempfile.mkstemp(prefix=".pending-", dir=path.parent)
    try:
        with os.fdopen(fd, "w") as stream:
            json.dump(value, stream, ensure_ascii=False, separators=(",", ":"))
            stream.write("\n")
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temporary, path)
        directory = os.open(path.parent, os.O_DIRECTORY)
        try:
            os.fsync(directory)
        finally:
            os.close(directory)
    finally:
        with contextlib.suppress(FileNotFoundError):
            os.unlink(temporary)


def run(arguments, *, output=None, input_bytes=None, timeout=3600):
    """Never log subprocess output: PostgreSQL and registry errors may contain secrets."""
    result = subprocess.run(arguments, input=input_bytes, stdout=output or subprocess.PIPE,
                            stderr=subprocess.PIPE, timeout=timeout, check=False)
    if result.returncode:
        raise RuntimeError(f"{Path(arguments[0]).name} operation failed (exit {result.returncode})")
    return result.stdout


def sha256(path):
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def quote(identifier):
    return '"' + identifier.replace('"', '""') + '"'


class FixedRedirects(urllib.request.HTTPRedirectHandler):
    def __init__(self, origin):
        self.origin = origin

    def redirect_request(self, request, fp, code, message, headers, newurl):
        destination = urllib.parse.urlparse(newurl)
        allowed = {self.origin.hostname}
        if self.origin.hostname == "github.com":
            allowed.add("release-assets.githubusercontent.com")
            allowed.add("objects.githubusercontent.com")
        if (destination.scheme != "https" or destination.hostname not in allowed
                or destination.username or destination.password
                or destination.port not in (None, 443)):
            raise ValueError("Release redirect is outside the configured trusted origin")
        return super().redirect_request(request, fp, code, message, headers, newurl)


def download(url, maximum):
    origin = urllib.parse.urlparse(url)
    if (origin.scheme != "https" or not origin.hostname or origin.username
            or origin.password or origin.port not in (None, 443) or origin.fragment):
        raise ValueError("Release URL must be HTTPS without credentials")
    opener = urllib.request.build_opener(
        urllib.request.ProxyHandler({}), FixedRedirects(origin),
        urllib.request.HTTPSHandler(context=ssl.create_default_context()))
    with opener.open(urllib.request.Request(url, headers={"User-Agent": "Nahhasio-maintenance/1"}),
                     timeout=30) as response:
        body = response.read(maximum + 1)
    if len(body) > maximum:
        raise ValueError("Release document is too large")
    return body


class Maintenance:
    def __init__(self, config_root):
        self.config_root = private_directory(config_root)
        self.installation_path = self.config_root / "installation.json"
        self.config = read_json(self.installation_path)
        for key in ("database", "databaseAdmin", "databaseOwner", "databaseRuntime"):
            if not DB_NAME.fullmatch(self.config[key]):
                raise ValueError("Invalid configured PostgreSQL identifier")
        self.data = private_directory(self.config["dataRoot"])
        if Path(self.config["configRoot"]) != self.config_root:
            raise ValueError("Installation configuration root does not match")
        self.control = private_directory(self.data / "operations")
        self.private = private_directory(self.data / "maintenance-private")
        self.inbox = private_directory(self.control / "inbox")
        self.claimed = private_directory(self.private / "claimed")
        self.jobs = private_directory(self.control / "jobs")
        self.backups = private_directory(self.data / "backups")
        self.artwork = private_directory(self.data / "artwork")
        self.providers = private_directory(self.config_root / "private")
        self.container = self.config.get("databaseContainer", "nahhasio-postgres")
        self.unit = "nahhasio-server.service"
        self.status_path = self.control / "status.json"
        self.status = {"version": VERSION, "available": True, "backups": [],
                       "update": {"state": "unchecked", "currentVersion": self.config.get("version", "unknown")},
                       "activeJob": None, "lastJob": None}
        if self.status_path.exists():
            previous = read_json(self.status_path)
            self.status["lastJob"] = previous.get("lastJob")
            self.status["update"] = previous.get("update", self.status["update"])
        self.job = None
        self.tools = host_tools.Store(self.data / "tools")
        self.reload_tools = False

    @contextlib.contextmanager
    def lock(self):
        descriptor = os.open(self.private / "maintenance.lock", os.O_CREAT | os.O_RDWR | os.O_NOFOLLOW | os.O_CLOEXEC, 0o600)
        try:
            fcntl.flock(descriptor, fcntl.LOCK_EX | fcntl.LOCK_NB)
            yield
        finally:
            os.close(descriptor)

    def publish(self):
        self.status["backups"] = self.inventory()
        self.status["updatedAt"] = now()
        atomic_json(self.status_path, self.status)

    def progress(self, stage, message):
        if self.job:
            self.job.update(stage=stage, message=message)
            atomic_json(self.jobs / f'{self.job["id"]}.json', self.job)
            self.status["activeJob"] = self.job.copy()
            self.publish()

    def sql(self, statement, database=None):
        return run(["podman", "exec", "-i", self.container, "psql", "-X", "-q", "-A", "-t",
                    "-v", "ON_ERROR_STOP=1", "-U", self.config["databaseAdmin"],
                    "-d", database or self.config["database"], "-c", statement], timeout=120).decode().strip()

    def summary(self, database=None):
        tables = self.sql("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename", database).splitlines()
        counts = {}
        for table in tables:
            counts[table] = int(self.sql(f"SELECT count(*) FROM public.{quote(table)}", database))
        identity = self.sql("SELECT id::text FROM server_instance WHERE singleton", database)
        return {"serverId": identity, "counts": counts}

    def verify_artwork(self, root, database=None):
        """Verify registered originals against bounded database pages, not archive hashes alone."""
        offset = 0
        verified = 0
        while True:
            statement = ("SELECT coalesce(json_agg(row_to_json(assets)),'[]'::json) FROM "
                         "(SELECT path,sha256,byte_size FROM media_assets ORDER BY id "
                         f"LIMIT 256 OFFSET {offset}) assets")
            rows = json.loads(self.sql(statement, database))
            for row in rows:
                registered = row.get("path")
                if not isinstance(registered, str) or not registered.startswith("/media/"):
                    raise ValueError("Registered artwork uses an unsupported local namespace")
                relative = Path(registered.removeprefix("/media/"))
                if relative.is_absolute() or not relative.parts or ".." in relative.parts:
                    raise ValueError("Registered artwork escapes the configured root")
                file = root
                for part in relative.parts:
                    file = file / part
                    if file.is_symlink():
                        raise ValueError("Registered artwork contains a symlink")
                try:
                    info = file.lstat()
                    valid = (stat.S_ISREG(info.st_mode) and info.st_size == row["byte_size"]
                             and SHA256.fullmatch(row.get("sha256", ""))
                             and sha256(file) == row["sha256"])
                except OSError:
                    valid = False
                if not valid:
                    raise ValueError("Registered artwork is missing or does not match its database size/hash")
                verified += 1
            if len(rows) < 256:
                return verified
            offset += 256

    def active(self):
        result = subprocess.run(["systemctl", "--user", "is-active", "--quiet", self.unit], check=False)
        return result.returncode == 0

    def stop(self):
        run(["systemctl", "--user", "stop", self.unit], timeout=120)

    def start(self):
        run(["systemctl", "--user", "start", self.unit], timeout=180)
        self.ready()

    def ready(self):
        # The image health command checks the HTTPS readiness endpoint with its configured CA.
        for _ in range(30):
            result = subprocess.run(["podman", "healthcheck", "run", "nahhasio-server"],
                                    stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                                    check=False, timeout=15)
            if result.returncode == 0:
                return
            time.sleep(2)
        raise RuntimeError("Server did not become ready after maintenance")

    def inventory(self):
        result = []
        for directory in sorted(self.backups.iterdir(), reverse=True):
            if not BACKUP_ID.fullmatch(directory.name) or directory.is_symlink() or not directory.is_dir():
                continue
            try:
                manifest = read_json(directory / "manifest.json")
                if manifest.get("recoveryOnly"):
                    continue
                result.append({key: manifest[key] for key in
                               ("id", "createdAt", "reason", "byteSize", "version", "schema")})
            except (OSError, ValueError, KeyError):
                continue
        return result

    def archive(self, root, destination):
        with tarfile.open(destination, "w:gz", dereference=True) as archive:
            for path in sorted(root.rglob("*")):
                info = path.lstat()
                if not stat.S_ISREG(info.st_mode) and not stat.S_ISDIR(info.st_mode):
                    raise ValueError("Backup source contains a symlink or special file")
                archive.add(path, arcname=str(path.relative_to(root)), recursive=False)
        os.chmod(destination, 0o600)

    def host_recovery_archive(self, destination):
        # Restoring app data must not silently replace the current machine's DB credentials
        # or certificate trust. Keep these in an operator-only recovery archive instead.
        selected = ["tls", "authority", "postgres-password", "owner-password", "runtime-password",
                    "server.env", "operator.env", "release-key.pem"]
        with tarfile.open(destination, "w:gz", dereference=True) as archive:
            for name in selected:
                root = self.config_root / name
                if not root.exists():
                    continue
                paths = [root] + sorted(root.rglob("*")) if root.is_dir() else [root]
                for path in paths:
                    info = path.lstat()
                    if not stat.S_ISREG(info.st_mode) and not stat.S_ISDIR(info.st_mode):
                        raise ValueError("Host recovery source contains a symlink or special file")
                    archive.add(path, arcname=str(path.relative_to(self.config_root)), recursive=False)
        os.chmod(destination, 0o600)

    def backup(self, reason="manual", *, stopped=False, allow_damaged=False):
        if allow_damaged and reason != "before-restore":
            raise ValueError("Damaged-state capture is reserved for a verified restore operation")
        identifier = dt.datetime.now(dt.timezone.utc).strftime("%Y%m%dT%H%M%SZ-") + uuid.uuid4().hex[:8]
        temporary = self.backups / (".pending-" + identifier)
        temporary.mkdir(mode=0o700)
        restart = not stopped and self.active()
        backup_journal = self.private / "backup-journal.json"
        atomic_json(backup_journal, {"formatVersion": VERSION, "id": identifier,
                                     "stage": "capturing", "restartApi": restart})
        try:
            database_bytes = int(self.sql("SELECT pg_database_size(current_database())"))
            artwork_bytes = sum(path.stat().st_size for path in self.artwork.rglob("*") if path.is_file())
            if shutil.disk_usage(self.backups).free < database_bytes + artwork_bytes + 64 * 1024 * 1024:
                raise ValueError("Not enough disk space for a complete backup")
            self.progress("backup", "Creating a coordinated database, artwork and configuration backup")
            if restart:
                self.stop()
            summary = self.summary()
            damaged = False
            try:
                verified_artwork = self.verify_artwork(self.artwork)
            except ValueError:
                if not allow_damaged:
                    raise
                # The selected restore target has already passed full verification. Preserve
                # the damaged current state for manual recovery without advertising it as a
                # usable backup. Archive traversal still rejects symlinks and special files.
                verified_artwork = None
                damaged = True
            with (temporary / "database.dump").open("wb") as stream:
                os.chmod(temporary / "database.dump", 0o600)
                run(["podman", "exec", self.container, "pg_dump", "-U", self.config["databaseAdmin"],
                     "-d", self.config["database"], "--format=custom", "--no-owner", "--no-acl"], output=stream)
                stream.flush()
                os.fsync(stream.fileno())
            self.archive(self.artwork, temporary / "artwork.tar.gz")
            self.archive(self.providers, temporary / "configuration.tar.gz")
            self.host_recovery_archive(temporary / "host-recovery.tar.gz")
            # Installation metadata is needed for recovery but never includes credential values.
            atomic_json(temporary / "installation.json", self.config)
            files = {name: sha256(temporary / name) for name in
                     ("database.dump", "artwork.tar.gz", "configuration.tar.gz", "host-recovery.tar.gz", "installation.json")}
            manifest = {"formatVersion": VERSION, "id": identifier, "createdAt": now(), "reason": reason,
                        "version": self.config.get("version", "unknown"), "schema": self.config.get("schemaVersion", ""),
                        "byteSize": sum((temporary / name).stat().st_size for name in files),
                        "files": files, "catalog": summary, "databaseMajor": 17,
                        "verifiedArtwork": verified_artwork, "recoveryOnly": damaged,
                        "integrity": "damaged" if damaged else "verified"}
            for name in files:
                with (temporary / name).open("rb") as stream:
                    os.fsync(stream.fileno())
            atomic_json(temporary / "manifest.json", manifest)
            descriptor = os.open(temporary, os.O_DIRECTORY)
            try:
                os.fsync(descriptor)
            finally:
                os.close(descriptor)
            os.rename(temporary, self.backups / identifier)
            descriptor = os.open(self.backups, os.O_DIRECTORY)
            try:
                os.fsync(descriptor)
            finally:
                os.close(descriptor)
            self.prune()
            return {"backupId": identifier}
        finally:
            if temporary.exists():
                shutil.rmtree(temporary)
            if restart:
                self.start()
            atomic_json(backup_journal, {"formatVersion": VERSION, "id": identifier,
                                         "stage": "complete", "restartApi": False})

    def prune(self):
        daily = [item for item in self.inventory() if item["reason"] == "daily"]
        for item in daily[7:]:
            shutil.rmtree(self.backups / item["id"])
        for reason in ("before-update", "before-restore"):
            protected = [item for item in self.inventory() if item["reason"] == reason]
            for item in protected[2:]:
                shutil.rmtree(self.backups / item["id"])

    def validate_backup(self, identifier):
        if not BACKUP_ID.fullmatch(identifier):
            raise ValueError("Invalid backup identifier")
        root = self.backups / identifier
        if root.is_symlink() or not root.is_dir():
            raise ValueError("Backup is unavailable")
        manifest = read_json(root / "manifest.json")
        if manifest.get("recoveryOnly"):
            raise ValueError("Damaged-state recovery material cannot be restored as a verified backup")
        required = {"database.dump", "artwork.tar.gz", "configuration.tar.gz", "host-recovery.tar.gz", "installation.json"}
        if (manifest.get("formatVersion") != VERSION or manifest.get("id") != identifier
                or set(manifest.get("files", {})) != required):
            raise ValueError("Unsupported or incomplete backup")
        for name in required:
            path = root / name
            if path.is_symlink() or not path.is_file() or sha256(path) != manifest["files"][name]:
                raise ValueError("Backup checksum verification failed")
        if manifest.get("schema") != self.config.get("schemaVersion"):
            raise ValueError("Backup schema requires a matching application version before restore")
        return root, manifest

    def extract(self, archive_path, destination):
        destination.mkdir(mode=0o700)
        with tarfile.open(archive_path, "r:gz") as archive:
            for member in archive:
                path = Path(member.name)
                if path.is_absolute() or ".." in path.parts or not (member.isfile() or member.isdir()):
                    raise ValueError("Unsafe backup archive member")
                target = destination / path
                if member.isdir():
                    target.mkdir(mode=0o700, parents=True, exist_ok=True)
                else:
                    target.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
                    with archive.extractfile(member) as source, target.open("xb") as output:
                        os.chmod(target, 0o600)
                        shutil.copyfileobj(source, output)

    def terminate(self, database):
        self.sql("SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname="
                 + "'" + database.replace("'", "''") + "' AND pid<>pg_backend_pid()", "postgres")

    def restore(self, identifier, confirmation, *, initial=False):
        if identifier != confirmation:
            raise ValueError("Restore requires confirmation matching the selected backup identifier")
        was_active = self.active()
        if initial:
            tables = int(self.sql("SELECT count(*) FROM information_schema.tables WHERE table_schema='public'"))
            if tables != 0 or was_active:
                raise ValueError("Initial transfer requires an empty bootstrap database and an inactive API")
        source, manifest = self.validate_backup(identifier)
        suffix = uuid.uuid4().hex[:12]
        stage_db, old_db = "nahhasio_restore_" + suffix, "nahhasio_previous_" + suffix
        stage_art, old_art = self.data / (".restore-artwork-" + suffix), self.data / (".previous-artwork-" + suffix)
        stage_config, old_config = self.config_root / (".restore-private-" + suffix), self.config_root / (".previous-private-" + suffix)
        current = self.config["database"]
        journal = {"formatVersion": VERSION, "backupId": identifier, "database": current,
                   "initial": initial, "wasActive": was_active,
                   "stageDatabase": stage_db, "previousDatabase": old_db,
                   "stageArtwork": str(stage_art), "previousArtwork": str(old_art),
                   "stageConfig": str(stage_config), "previousConfig": str(old_config), "stage": "preparing"}
        journal_path = self.private / "restore-journal.json"
        if journal_path.exists():
            previous = read_json(journal_path)
            if previous.get("stage") not in ("complete", "rolled-back"):
                raise ValueError("An interrupted restore requires local recovery before another restore")
        atomic_json(journal_path, journal)
        self.progress("restore-validation", "Validating a separate restored database and artwork set")
        self.sql(f"CREATE DATABASE {quote(stage_db)} OWNER {quote(self.config['databaseOwner'])}", "postgres")
        switched = False
        paused = False
        try:
            with (source / "database.dump").open("rb") as stream:
                result = subprocess.run(["podman", "exec", "-i", self.container, "pg_restore", "--exit-on-error",
                                         "--no-owner", "--no-acl", "--role=" + self.config["databaseOwner"],
                                         "-U", self.config["databaseAdmin"], "-d", stage_db], stdin=stream,
                                        stdout=subprocess.DEVNULL, stderr=subprocess.PIPE, timeout=3600)
                if result.returncode:
                    raise RuntimeError("Restored database validation failed")
            # Dumps omit planner statistics. Refresh the staged database before serving
            # complex catalog/filter queries from the restored installation.
            self.sql("ANALYZE", stage_db)
            if self.summary(stage_db) != manifest["catalog"]:
                raise ValueError("Restored catalog identity or row counts do not match the backup")
            self.extract(source / "artwork.tar.gz", stage_art)
            self.extract(source / "configuration.tar.gz", stage_config)
            self.verify_artwork(stage_art, stage_db)
            self.grants(stage_db)
            self.stop()
            paused = True
            if not initial:
                self.backup("before-restore", stopped=True, allow_damaged=True)
            self.progress("restore-switch", "Switching to the verified backup; the server will reconnect")
            journal["stage"] = "switching"
            atomic_json(journal_path, journal)
            self.terminate(current)
            self.sql(f"ALTER DATABASE {quote(current)} RENAME TO {quote(old_db)}", "postgres")
            self.sql(f"ALTER DATABASE {quote(stage_db)} RENAME TO {quote(current)}", "postgres")
            self.artwork.rename(old_art)
            stage_art.rename(self.artwork)
            self.providers.rename(old_config)
            stage_config.rename(self.providers)
            switched = True
            self.start()
            journal["stage"] = "complete"
            atomic_json(journal_path, journal)
            return {"backupId": identifier, "reconnectRequired": True}
        except Exception:
            if paused:
                self.rollback_restore(journal)
                journal["stage"] = "rolled-back"
                atomic_json(journal_path, journal)
                if was_active:
                    self.start()
            raise
        finally:
            # Once switching starts retained state belongs to the journal/recovery path.
            if not paused and not switched:
                self.sql(f"DROP DATABASE IF EXISTS {quote(stage_db)}", "postgres")
                for path in (stage_art, stage_config):
                    if path.exists():
                        shutil.rmtree(path)
                journal["stage"] = "rolled-back"
                atomic_json(journal_path, journal)

    def grants(self, database):
        role = quote(self.config["databaseRuntime"])
        self.sql(f"REVOKE ALL ON DATABASE {quote(database)} FROM PUBLIC; "
                 "REVOKE CREATE ON SCHEMA public FROM PUBLIC; "
                 f"GRANT CONNECT ON DATABASE {quote(database)} TO {role}; "
                 f"GRANT USAGE ON SCHEMA public,drizzle TO {role}; "
                 f"GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA public TO {role}; "
                 f"GRANT USAGE,SELECT ON ALL SEQUENCES IN SCHEMA public TO {role}; "
                 f"GRANT SELECT ON ALL TABLES IN SCHEMA drizzle TO {role}", database)

    def rollback_restore(self, journal):
        self.stop()
        current, old = journal["database"], journal["previousDatabase"]
        names = self.sql("SELECT datname FROM pg_database", "postgres").splitlines()
        if old in names:
            if current in names:
                self.terminate(current)
                self.sql(f"ALTER DATABASE {quote(current)} RENAME TO {quote(journal['stageDatabase'])}", "postgres")
            self.sql(f"ALTER DATABASE {quote(old)} RENAME TO {quote(current)}", "postgres")
        for active, retained, stage in (
                (self.artwork, Path(journal["previousArtwork"]), Path(journal["stageArtwork"])),
                (self.providers, Path(journal["previousConfig"]), Path(journal["stageConfig"]))):
            if retained.exists():
                if active.exists():
                    active.rename(stage)
                retained.rename(active)

    def recover(self):
        journal = read_json(self.private / "restore-journal.json")
        if journal.get("stage") in ("complete", "rolled-back"):
            raise ValueError("No interrupted restore needs recovery")
        # Journal is host-owned; confirm destinations still match this installation before acting.
        for key, parent in (("previousArtwork", self.data), ("stageArtwork", self.data),
                            ("previousConfig", self.config_root), ("stageConfig", self.config_root)):
            if Path(journal[key]).parent != parent or Path(journal[key]).is_symlink():
                raise ValueError("Invalid restore recovery journal")
        for key in ("database", "previousDatabase", "stageDatabase"):
            if not DB_NAME.fullmatch(journal[key]):
                raise ValueError("Invalid recovery database")
        if journal["database"] != self.config["database"]:
            raise ValueError("Recovery belongs to a different installation")
        self.rollback_restore(journal)
        journal["stage"] = "rolled-back"
        atomic_json(self.private / "restore-journal.json", journal)
        if journal.get("wasActive", True):
            self.start()

    def release(self):
        key = self.config_root / "release-key.pem"
        if key.is_symlink() or not key.is_file():
            raise ValueError("Install a trusted release public key before enabling updates")
        public_der = run(["openssl", "pkey", "-pubin", "-in", str(key), "-pubout", "-outform", "DER"], timeout=10)
        if len(public_der) != 44 or not public_der.startswith(bytes.fromhex("302a300506032b6570032100")):
            raise ValueError("The pinned release public key must be Ed25519")
        url = self.config.get("releaseManifestUrl")
        if not url:
            raise ValueError("Release channel is not configured")
        manifest_bytes = download(url, 65536)
        signature = base64.b64decode(download(url + ".sig", 1024).strip(), validate=True)
        if len(signature) != 64:
            raise ValueError("Release signature must be Ed25519")
        with tempfile.TemporaryDirectory(dir=self.private, prefix=".verify-") as temporary:
            root = Path(temporary)
            (root / "manifest.json").write_bytes(manifest_bytes)
            (root / "manifest.sig").write_bytes(signature)
            run(["openssl", "pkeyutl", "-verify", "-pubin", "-inkey", str(key), "-rawin",
                 "-in", str(root / "manifest.json"), "-sigfile", str(root / "manifest.sig")], timeout=10)
        manifest = json.loads(manifest_bytes)
        if (manifest.get("formatVersion") != 1 or manifest.get("apiVersion") != 1
                or not isinstance(manifest.get("version"), str)
                or not re.fullmatch(r"[0-9]+\.[0-9]+\.[0-9]+(?:-[a-zA-Z0-9.-]+)?", manifest["version"])
                or not SHA256.fullmatch(manifest.get("schemaVersion", ""))):
            raise ValueError("Unsupported release manifest")
        image = manifest["server"]["image"]
        repository = self.config.get("serverRepository", "")
        if (not repository or not image.startswith(repository + "@sha256:")
                or not SHA256.fullmatch(image.removeprefix(repository + "@sha256:"))
                or manifest["server"].get("schemaVersion") != manifest["schemaVersion"]):
            raise ValueError("Release image does not match the configured repository")
        tools = manifest.get("hostTools", {})
        parsed = urllib.parse.urlsplit(tools.get("url", ""))
        origin = urllib.parse.urlsplit(url)
        expected_url = url.split("/releases/", 1)[0] + "/releases/download/nahhasio-v" + manifest["version"] + "/nahhasio-install.tar.gz"
        if (tools.get("apiVersion") != host_tools.API_VERSION
                or type(tools.get("size")) is not int or not 32 <= tools["size"] <= host_tools.MAX_ARCHIVE
                or not SHA256.fullmatch(tools.get("sha256", ""))
                or parsed.scheme != "https" or parsed.hostname != origin.hostname
                or parsed.username or parsed.password or parsed.port not in (None, 443)
                or parsed.query or parsed.fragment
                or origin.hostname == "github.com" and tools["url"] != expected_url):
            raise ValueError("Release lacks a compatible, signed host-tool bundle")
        return manifest

    def check_update(self):
        manifest = self.release()
        current = self.config.get("version", "0.0.0")
        version = manifest["version"]
        same_image = manifest["server"]["image"] == self.config["serverImage"]
        if version_key(version) < version_key(current) or not same_image and version_key(version) == version_key(current):
            raise ValueError("Release channel attempted a version downgrade")
        same_tools = self.config.get("hostToolsVersion") == version
        if same_tools:
            same_tools = self.tools.current() == "versions/" + version
        state = "up-to-date" if same_image and same_tools else "available"
        if manifest["schemaVersion"] != self.config.get("schemaVersion"):
            state = "maintenance-required"
        self.status["update"] = {"state": state, "currentVersion": current,
                                 "availableVersion": version, "checkedAt": now(),
                                 "message": "Schema maintenance is required" if state == "maintenance-required" else "Release signature verified"}
        self.publish()
        return manifest

    def update(self):
        manifest = self.check_update()
        if self.status["update"]["state"] == "maintenance-required":
            raise ValueError("This release needs explicit schema maintenance; automatic update was not applied")
        if self.status["update"]["state"] == "up-to-date":
            return {"version": self.config["version"], "changed": False}
        image = manifest["server"]["image"]
        previous_tools = self.tools.current()
        self.progress("update-tools", "Downloading and validating signed host maintenance tools")
        bundle = download(manifest["hostTools"]["url"], host_tools.MAX_ARCHIVE)
        target_tools = self.tools.stage(manifest["version"], host_tools.unpack(bundle, manifest["hostTools"]))
        candidate = self.tools.verify(target_tools)
        run([sys.executable, str(candidate / "operations.py"), "--help"], timeout=10)
        self.progress("update-download", "Downloading the verified server image")
        run(["podman", "pull", "--tls-verify=true", image], timeout=1800)
        # A digest-addressed pull must resolve the signed image reference locally.
        run(["podman", "image", "inspect", image], timeout=30)
        self.backup("before-update")
        root = Path(self.config.get("quadletRoot", str(Path.home() / ".config/containers/systemd")))
        override = root / "nahhasio-server.container.d" / "20-release.conf"
        override.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
        previous = override.read_bytes() if override.exists() else None
        journal_path = self.private / "update-journal.json"
        previous_installation = self.config.copy()
        journal = {"formatVersion": VERSION, "stage": "activating", "previousImage": self.config["serverImage"],
                   "nextImage": image, "nextVersion": manifest["version"],
                   "previousTools": previous_tools, "nextTools": target_tools,
                   "previousOverride": base64.b64encode(previous).decode() if previous is not None else None}
        atomic_json(journal_path, journal)
        self.progress("update-activate", "Activating the new server version")
        try:
            self.write_override(override, image)
            run(["systemctl", "--user", "daemon-reload"], timeout=60)
            run(["systemctl", "--user", "restart", self.unit], timeout=180)
            self.ready()
            self.tools.activate(target_tools)
            self.config.update(serverImage=image, version=manifest["version"], hostToolsVersion=manifest["version"])
            atomic_json(self.installation_path, self.config)
        except Exception:
            self.tools.activate(previous_tools)
            self.config = previous_installation
            atomic_json(self.installation_path, self.config)
            if previous is None:
                override.unlink(missing_ok=True)
            else:
                self.write_bytes(override, previous)
            run(["systemctl", "--user", "daemon-reload"], timeout=60)
            run(["systemctl", "--user", "restart", self.unit], timeout=180)
            self.ready()
            journal["stage"] = "rolled-back"
            atomic_json(journal_path, journal)
            raise RuntimeError("Server update failed; the previous image was restored") from None
        journal["stage"] = "complete"
        atomic_json(journal_path, journal)
        self.status["update"] = {"state": "up-to-date", "currentVersion": manifest["version"], "checkedAt": now()}
        self.reload_tools = target_tools != previous_tools
        return {"version": manifest["version"], "changed": True, "reconnectRequired": True}

    def recover_update(self):
        journal_path = self.private / "update-journal.json"
        if not journal_path.exists():
            return
        journal = read_json(journal_path)
        if journal.get("stage") in ("complete", "rolled-back"):
            return
        tools_committed = not journal.get("nextTools") or self.config.get("hostToolsVersion") == journal.get("nextVersion")
        if journal.get("nextImage") == self.config["serverImage"] and tools_committed:
            # Metadata commit follows successful readiness. A crash before journal completion
            # can safely finish that final bookkeeping without changing services.
            if journal.get("nextTools"):
                self.tools.activate(journal["nextTools"])
            journal["stage"] = "complete"
        else:
            if journal.get("previousImage") != self.config["serverImage"]:
                raise ValueError("Interrupted update does not match this installation")
            if journal.get("previousTools"):
                self.tools.activate(journal["previousTools"])
            root = Path(self.config.get("quadletRoot", str(Path.home() / ".config/containers/systemd")))
            override = root / "nahhasio-server.container.d" / "20-release.conf"
            previous = journal.get("previousOverride")
            if previous is None:
                override.unlink(missing_ok=True)
            else:
                self.write_bytes(override, base64.b64decode(previous, validate=True))
            run(["systemctl", "--user", "daemon-reload"], timeout=60)
            run(["systemctl", "--user", "restart", self.unit], timeout=180)
            self.ready()
            journal["stage"] = "rolled-back"
        atomic_json(journal_path, journal)

    @staticmethod
    def write_bytes(path, value):
        fd, temporary = tempfile.mkstemp(dir=path.parent, prefix=".pending-")
        try:
            with os.fdopen(fd, "wb") as stream:
                stream.write(value)
                stream.flush()
                os.fsync(stream.fileno())
            os.replace(temporary, path)
        finally:
            with contextlib.suppress(FileNotFoundError):
                os.unlink(temporary)

    def write_override(self, path, image):
        self.write_bytes(path, f"[Container]\nImage={image}\n".encode())

    def validate_request(self, request, identifier):
        if str(uuid.UUID(identifier)) != identifier:
            raise ValueError("Invalid job identifier")
        if (request.get("version") != VERSION or request.get("id") != identifier
                or request.get("operation") not in OPERATIONS
                or set(request) - {"version", "id", "operation", "requestedAt", "actorAccountId", "backupId", "confirmation"}):
            raise ValueError("Invalid maintenance request")
        if str(uuid.UUID(request["actorAccountId"])) != request["actorAccountId"]:
            raise ValueError("Invalid requesting account")
        if request["operation"] == "restore":
            if not BACKUP_ID.fullmatch(request.get("backupId", "")):
                raise ValueError("Invalid backup identifier")
        elif request.get("backupId") or request.get("confirmation"):
            raise ValueError("Unexpected restore parameters")

    def execute(self, request, *, reason="manual"):
        self.job = {"version": VERSION, "id": request["id"], "operation": request["operation"],
                    "state": "running", "startedAt": now(), "stage": "starting", "message": "Maintenance started"}
        self.progress("starting", "Maintenance started")
        try:
            journal_path = self.private / "restore-journal.json"
            if journal_path.exists() and read_json(journal_path).get("stage") not in ("complete", "rolled-back"):
                raise ValueError("An interrupted restore requires local recovery before maintenance can continue")
            operation = request["operation"]
            if operation == "backup":
                result = self.backup(reason)
            elif operation == "restore":
                result = self.restore(request["backupId"], request.get("confirmation"))
            elif operation == "check-update":
                self.check_update()
                result = self.status["update"]
            else:
                result = self.update()
            self.job.update(state="succeeded", stage="complete", message="Maintenance completed", result=result)
        except Exception as error:
            # Only controlled errors are public; upstream details/paths never enter UI status.
            public = str(error) if isinstance(error, (ValueError, RuntimeError)) else "Maintenance failed; inspect local service logs"
            self.job.update(state="failed", stage="failed", message=public)
        self.job["finishedAt"] = now()
        atomic_json(self.jobs / f'{self.job["id"]}.json', self.job)
        self.status["lastJob"] = self.job.copy()
        self.status["activeJob"] = None
        self.publish()
        result = self.job.copy()
        self.job = None
        return result

    def worker(self):
        with self.lock():
            self.recover_update()
            backup_journal = self.private / "backup-journal.json"
            if backup_journal.exists():
                interrupted = read_json(backup_journal)
                restore_journal = self.private / "restore-journal.json"
                restore_safe = not restore_journal.exists() or read_json(restore_journal).get("stage") in ("complete", "rolled-back")
                if interrupted.get("stage") == "capturing" and interrupted.get("restartApi") and restore_safe:
                    self.start()
                    interrupted.update(stage="interrupted", restartApi=False)
                    atomic_json(backup_journal, interrupted)
            # A host crash must not turn an unknown result into a success or repeat a restore.
            for path in self.claimed.glob("*.json"):
                identifier = path.stem
                try:
                    if str(uuid.UUID(identifier)) != identifier:
                        continue
                    finished = self.jobs / path.name
                    if finished.exists():
                        prior = read_json(finished)
                        if prior.get("state") in ("succeeded", "failed") and prior.get("finishedAt"):
                            self.status["lastJob"] = prior
                            path.unlink()
                            continue
                    job = {"version": VERSION, "id": identifier, "operation": "unknown", "state": "failed",
                           "stage": "interrupted", "message": "Maintenance was interrupted; inspect recovery status", "finishedAt": now()}
                    atomic_json(self.jobs / path.name, job)
                    self.status["lastJob"] = job
                    path.unlink()
                except (OSError, ValueError):
                    continue
            self.publish()
            heartbeat = time.monotonic()
            while True:
                for path in sorted(self.inbox.glob("*.json")):
                    claimed = self.claimed / path.name
                    try:
                        request = read_json(path, 8192)
                        self.validate_request(request, path.stem)
                        if (self.jobs / path.name).exists() or claimed.exists():
                            path.unlink()
                            continue
                        path.rename(claimed)
                    except (OSError, ValueError, KeyError, TypeError):
                        # Invalid files never become commands. Remove only the observed inbox entry.
                        path.unlink(missing_ok=True)
                        continue
                    reason = "manual"
                    daily = self.private / "daily-request.json"
                    if request["operation"] == "backup" and daily.exists():
                        try:
                            if read_json(daily).get("id") == request["id"]:
                                reason = "daily"
                                daily.unlink()
                        except (OSError, ValueError):
                            pass
                    self.execute(request, reason=reason)
                    claimed.unlink(missing_ok=True)
                    if self.reload_tools:
                        # The completed job/status and cleared claim are durable first. Python
                        # descriptors close on exec, releasing the old worker's maintenance lock.
                        os.execv(sys.executable, [sys.executable, str(self.data / "tools/operations.py"),
                                                 "--config-root", str(self.config_root), "worker"])
                if time.monotonic() - heartbeat > 30:
                    self.publish()
                    heartbeat = time.monotonic()
                time.sleep(1)


def install_units(config_root):
    config_root = private_directory(config_root)
    config = read_json(config_root / "installation.json")
    tools = private_directory(Path(config["dataRoot"]) / "tools")
    destination = tools / "operations.py"
    if subprocess.run(["systemctl", "--user", "is-active", "--quiet", "nahhasio-maintenance.service"],
                      stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=False).returncode == 0:
        raise ValueError("Stop nahhasio-maintenance.service before bootstrapping host tools")
    source = Path(__file__).resolve()
    if all((source.parent / name).is_file() for name in host_tools.FILES):
        files = {name: (source.parent / name).read_bytes() for name in host_tools.FILES}
    else:
        packaging = source.parent.parent
        files = {name: (packaging.parent / member).read_bytes() for name, member in host_tools.FILES.items()}
    host_tools.Store(tools).bootstrap(HOST_TOOLS_VERSION, files)
    config["hostToolsVersion"] = HOST_TOOLS_VERSION
    atomic_json(config_root / "installation.json", config)
    units = Path.home() / ".config/systemd/user"
    units.mkdir(mode=0o700, parents=True, exist_ok=True)
    # systemd quoting: do not invoke a shell and reject specifier expansion in supplied roots.
    if any("%" in str(path) or "\n" in str(path) for path in (config_root, destination)):
        raise ValueError("Installation paths cannot contain systemd specifiers or newlines")
    command = f'/usr/bin/python3 "{destination}" --config-root "{config_root}"'
    services = {
        "nahhasio-maintenance.service": f"[Unit]\nDescription=Nahhasio rootless maintenance worker\nAfter=nahhasio-postgres.service\n\n[Service]\nType=simple\nExecStart={command} worker\nRestart=on-failure\nRestartSec=5\nUMask=0077\n\n[Install]\nWantedBy=default.target\n",
        "nahhasio-backup.service": f"[Unit]\nDescription=Queue daily Nahhasio backup\n\n[Service]\nType=oneshot\nExecStart={command} enqueue backup --reason daily\nUMask=0077\n",
        "nahhasio-backup.timer": "[Unit]\nDescription=Daily Nahhasio backup\n\n[Timer]\nOnCalendar=*-*-* 04:00:00\nPersistent=true\nRandomizedDelaySec=15m\n\n[Install]\nWantedBy=timers.target\n",
        "nahhasio-update.service": f"[Unit]\nDescription=Queue compatible Nahhasio server update\n\n[Service]\nType=oneshot\nExecStart={command} enqueue update\nUMask=0077\n",
        "nahhasio-update.timer": "[Unit]\nDescription=Check Nahhasio compatible updates\n\n[Timer]\nOnCalendar=*-*-* 05:00:00\nPersistent=true\nRandomizedDelaySec=30m\n\n[Install]\nWantedBy=timers.target\n",
    }
    for name, content in services.items():
        Maintenance.write_bytes(units / name, content.encode())
    print("Maintenance units written. Enable with systemctl --user enable --now nahhasio-maintenance.service nahhasio-backup.timer")
    print("Enable nahhasio-update.timer after installing the trusted release key and publishing the release channel.")


def main():
    os.umask(0o077)
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--config-root", type=Path, default=Path.home() / ".config/nahhasio-server")
    commands = parser.add_subparsers(dest="command", required=True)
    commands.add_parser("worker")
    commands.add_parser("status")
    commands.add_parser("install-units")
    commands.add_parser("recover-interrupted-restore")
    enqueue = commands.add_parser("enqueue")
    enqueue.add_argument("operation", choices=sorted(OPERATIONS))
    enqueue.add_argument("--backup-id")
    enqueue.add_argument("--confirm")
    enqueue.add_argument("--reason", choices=("manual", "daily"), default="manual")
    direct = commands.add_parser("run")
    direct.add_argument("operation", choices=sorted(OPERATIONS))
    direct.add_argument("--backup-id")
    direct.add_argument("--confirm")
    args = parser.parse_args()
    try:
        if args.command == "install-units":
            install_units(args.config_root)
            return 0
        maintenance = Maintenance(args.config_root)
        if args.command == "worker":
            maintenance.worker()
        elif args.command == "status":
            print(json.dumps(read_json(maintenance.status_path), ensure_ascii=False))
        elif args.command == "recover-interrupted-restore":
            with maintenance.lock():
                maintenance.recover()
        else:
            identifier = str(uuid.uuid4())
            request = {"version": VERSION, "id": identifier, "operation": args.operation,
                       "requestedAt": now(), "actorAccountId": "00000000-0000-4000-8000-000000000000"}
            if args.backup_id:
                request["backupId"] = args.backup_id
            if args.confirm:
                request["confirmation"] = args.confirm
            maintenance.validate_request(request, identifier)
            if args.command == "enqueue":
                # Timer intent is host-owned separately; never accept reason in API request files.
                if args.reason == "daily":
                    atomic_json(maintenance.private / "daily-request.json", {"id": identifier})
                atomic_json(maintenance.inbox / f"{identifier}.json", request)
                print(json.dumps({"id": identifier, "state": "queued"}))
            else:
                with maintenance.lock():
                    result = maintenance.execute(request)
                    print(json.dumps(result, ensure_ascii=False))
                    return 0 if result["state"] == "succeeded" else 1
    except (Exception, KeyboardInterrupt) as error:
        public = str(error) if isinstance(error, (ValueError, RuntimeError)) else "Maintenance command failed; inspect local service state"
        print(public, file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
