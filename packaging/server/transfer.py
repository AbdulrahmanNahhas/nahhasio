#!/usr/bin/env python3
"""Portable read-only-source catalog capture and explicit local installation import."""

import argparse
import datetime as dt
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import re
import shutil
import stat
import subprocess
import sys
import tarfile
import tempfile
import uuid


FILES = {"database.dump", "artwork.tar.gz", "configuration.tar.gz", "host-recovery.tar.gz", "installation.json"}
BACKUP_ID = re.compile(r"[0-9]{8}T[0-9]{6}Z-[a-f0-9]{8}")


def sha256(path):
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def private_directory(path):
    if not path.is_absolute() or path.is_symlink():
        raise ValueError("Use an absolute, non-symlink directory")
    path.mkdir(mode=0o700, parents=True, exist_ok=True)
    info = path.stat()
    if not stat.S_ISDIR(info.st_mode) or info.st_uid != os.getuid() or info.st_mode & 0o077:
        raise ValueError("Output/config directories must be owned by this user with mode 0700")


def source_directory(path):
    if not path.is_absolute() or path.is_symlink() or not path.is_dir():
        raise ValueError("Source roots must be explicit absolute, non-symlink directories")
    return path.resolve()


def postgres(command, *, sql=None, output=None):
    database = os.environ.get("DATABASE_URL")
    if not database:
        raise ValueError("DATABASE_URL must explicitly select the source database")
    environment = {key: value for key, value in os.environ.items()
                   if key in ("PATH", "LANG", "LC_ALL", "HOME", "PGUSER", "PGPASSFILE", "PGSSLCERT", "PGSSLKEY", "PGSSLROOTCERT")}
    environment.update(PGDATABASE=database, PGAPPNAME="nahhasio-transfer-export",
                       PGOPTIONS="-c default_transaction_read_only=on -c lock_timeout=5000")
    result = subprocess.run(command, input=sql, stdout=output or subprocess.PIPE,
                            stderr=subprocess.PIPE, env=environment, timeout=3600, check=False)
    if result.returncode:
        raise RuntimeError(f"{command[0]} failed; source was not changed (private diagnostics suppressed)")
    return result.stdout


def query(sql):
    return postgres(["psql", "--no-psqlrc", "--quiet", "--tuples-only", "--no-align", "--set", "ON_ERROR_STOP=1"], sql=sql.encode()).decode().strip()


def source_schema(root, expected_fingerprint):
    root = source_directory(root)
    journal = json.loads((root / "meta/_journal.json").read_text())
    if journal.get("dialect") != "postgresql" or not journal.get("entries"):
        raise ValueError("Canonical PostgreSQL migration journal is required")
    sources = sorted([*root.glob("*.sql"), root / "meta/_journal.json"])
    fingerprint = hashlib.sha256()
    for path in sources:
        if path.is_symlink() or not path.is_file():
            raise ValueError("Canonical migration sources must be regular files")
        fingerprint.update(path.relative_to(root).as_posix().encode() + b"\0")
        fingerprint.update(path.read_bytes() + b"\0")
    if fingerprint.hexdigest() != expected_fingerprint:
        raise ValueError("Selected schema fingerprint does not match the canonical source history")
    history = []
    for index, entry in enumerate(journal["entries"]):
        tag = entry.get("tag", "")
        if (entry.get("idx") != index or not re.fullmatch(r"[a-z0-9_]+", tag)
                or not isinstance(entry.get("when"), int) or entry["when"] <= 0
                or history and entry["when"] <= history[-1]["when"]):
            raise ValueError("Canonical migration journal has invalid ordering/identity")
        history.append({"when": entry["when"], "hash": sha256(root / (tag + ".sql"))})
    if len(sources) != len(history) + 1:
        raise ValueError("Unjournaled SQL sources require reconciliation before transfer")
    applied = json.loads(query("SELECT coalesce(json_agg(json_build_object('when',created_at,'hash',hash) ORDER BY created_at,id),'[]') FROM drizzle.__drizzle_migrations"))
    if applied != history:
        raise ValueError("Source migration ledger is pending, changed or newer than the selected release; transfer refused")


def verify_artwork(root):
    assets = json.loads(query("SELECT coalesce(json_agg(json_build_object('path',path,'sha256',sha256,'byteSize',byte_size)),'[]') FROM media_assets"))
    for asset in assets:
        path = asset["path"]
        if not isinstance(path, str) or not path.startswith("/media/"):
            raise ValueError("Registered artwork uses an unsupported source namespace")
        relative = Path(path.removeprefix("/media/"))
        if relative.is_absolute() or ".." in relative.parts:
            raise ValueError("Registered artwork escapes its selected root")
        candidate = root / relative
        if (candidate.is_symlink() or not candidate.is_file()
                or not candidate.resolve().is_relative_to(root)
                or candidate.stat().st_size != asset["byteSize"]
                or sha256(candidate) != asset["sha256"]):
            raise ValueError("Registered artwork is missing or does not match its database size/hash; transfer refused")
    return len(assets)


def archive(root, destination):
    with tarfile.open(destination, "w:gz", dereference=True) as output:
        if root is None:
            return
        for path in sorted(root.rglob("*")):
            info = path.lstat()
            if not stat.S_ISREG(info.st_mode) and not stat.S_ISDIR(info.st_mode):
                raise ValueError("Source tree contains symlinks/special files; reconcile them explicitly before transfer")
            output.add(path, arcname=str(path.relative_to(root)), recursive=False)


def export(args):
    if not args.source_quiesced:
        raise ValueError("Stop the source API and all catalog/artwork writers, then pass --source-quiesced")
    if not re.fullmatch(r"[0-9a-f]{64}", args.schema_version):
        raise ValueError("Supply the release's exact 64-hex schema fingerprint")
    artwork = source_directory(args.artwork_root)
    configuration = source_directory(args.private_config_root)
    if not (artwork / "uploads").is_dir():
        raise ValueError("Artwork root must be the public media root containing uploads/; do not pass uploads/ itself")
    if configuration == artwork or configuration.is_relative_to(artwork):
        raise ValueError("Private provider configuration must be separate from public artwork")
    output = args.output_root
    private_directory(output)
    output = output.resolve()
    if output.is_relative_to(artwork) or output.is_relative_to(configuration):
        raise ValueError("Backup output cannot be inside either captured source root")
    major = int(query("SHOW server_version_num")) // 10000
    if major != 17:
        raise ValueError("This release transfer targets PostgreSQL 17; a major-version conversion is separate")
    source_schema(args.schema_root, args.schema_version)
    verified_artwork = verify_artwork(artwork)
    tables = json.loads(query("SELECT coalesce(json_agg(tablename ORDER BY tablename),'[]') FROM pg_tables WHERE schemaname='public'"))
    counts = {}
    for table in tables:
        quoted = '"' + table.replace('"', '""') + '"'
        counts[table] = int(query(f"SELECT count(*) FROM public.{quoted}"))
    server_id = query("SELECT id::text FROM server_instance WHERE singleton")
    if str(uuid.UUID(server_id)) != server_id:
        raise ValueError("Source needs its current stable server identity before transfer")
    identifier = dt.datetime.now(dt.timezone.utc).strftime("%Y%m%dT%H%M%SZ-") + uuid.uuid4().hex[:8]
    pending = Path(tempfile.mkdtemp(prefix=".transfer-", dir=output))
    try:
        with (pending / "database.dump").open("wb") as stream:
            postgres(["pg_dump", "--format=custom", "--no-owner", "--no-acl"], output=stream)
            stream.flush()
            os.fsync(stream.fileno())
        archive(artwork, pending / "artwork.tar.gz")
        archive(configuration, pending / "configuration.tar.gz")
        # A source checkout has no installed host credentials/CA to replay onto the family PC.
        archive(None, pending / "host-recovery.tar.gz")
        metadata = {"formatVersion": 1, "source": "development-checkout", "version": args.version,
                    "schemaVersion": args.schema_version, "databaseMajor": major}
        (pending / "installation.json").write_text(json.dumps(metadata, indent=2) + "\n")
        files = {name: sha256(pending / name) for name in sorted(FILES)}
        manifest = {"formatVersion": 1, "id": identifier,
                    "createdAt": dt.datetime.now(dt.timezone.utc).isoformat().replace("+00:00", "Z"),
                    "reason": "transfer", "version": args.version, "schema": args.schema_version,
                    "byteSize": sum((pending / name).stat().st_size for name in FILES),
                    "files": files, "catalog": {"serverId": server_id, "counts": counts},
                    "databaseMajor": major, "verifiedArtwork": verified_artwork}
        (pending / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
        for path in pending.iterdir():
            os.chmod(path, 0o600)
        destination = output / identifier
        pending.rename(destination)
        print(json.dumps({"backupId": identifier, "directory": str(destination), "sourceChanged": False}))
    finally:
        if pending.exists():
            shutil.rmtree(pending)


def validate(source):
    source_directory(source)
    manifest_path = source / "manifest.json"
    if manifest_path.is_symlink() or not manifest_path.is_file() or manifest_path.stat().st_size > 1024 * 1024:
        raise ValueError("Invalid transfer manifest")
    manifest = json.loads(manifest_path.read_text())
    if (manifest.get("formatVersion") != 1 or not BACKUP_ID.fullmatch(manifest.get("id", ""))
            or manifest.get("databaseMajor") != 17 or set(manifest.get("files", {})) != FILES):
        raise ValueError("Unsupported or incomplete transfer")
    for name in FILES:
        path = source / name
        if path.is_symlink() or not path.is_file() or sha256(path) != manifest["files"][name]:
            raise ValueError("Transfer checksum validation failed")
    return manifest


def import_backup(args):
    manifest = validate(args.source)
    if not args.write:
        print(json.dumps({"backupId": manifest["id"], "checksumsValid": True,
                          "write": False, "next": "Repeat with --write and --confirm matching the backup ID"}))
        return
    if args.confirm != manifest["id"]:
        raise ValueError("--confirm must exactly match the transfer backup ID")
    if not args.operations_script.is_file() or args.operations_script.is_symlink():
        raise ValueError("Supply the installed trusted operations.py through --operations-script")
    spec = importlib.util.spec_from_file_location("nahhasio_host_operations", args.operations_script)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    maintenance = module.Maintenance(args.config_root)
    if manifest.get("schema") != maintenance.config.get("schemaVersion"):
        raise ValueError("Install the matching application/schema version before transfer")
    with maintenance.lock():
        destination = maintenance.backups / manifest["id"]
        if destination.exists():
            # Only reuse an exactly identical, fully verified completed transfer.
            _, existing = maintenance.validate_backup(manifest["id"])
            if existing != manifest:
                raise ValueError("A different backup already uses this identifier")
        else:
            required = sum((args.source / name).stat().st_size for name in FILES)
            if shutil.disk_usage(maintenance.backups).free < required + 64 * 1024 * 1024:
                raise ValueError("Not enough free space to receive the transfer bundle")
            pending = Path(tempfile.mkdtemp(prefix=".import-", dir=maintenance.backups))
            try:
                for name in FILES | {"manifest.json"}:
                    with (args.source / name).open("rb") as source, (pending / name).open("xb") as target:
                        shutil.copyfileobj(source, target)
                        target.flush()
                        os.fsync(target.fileno())
                    os.chmod(pending / name, 0o600)
                if validate(pending) != manifest:
                    raise ValueError("Transfer changed while copying")
                pending.rename(destination)
            finally:
                if pending.exists():
                    shutil.rmtree(pending)
        result = maintenance.restore(manifest["id"], args.confirm, initial=args.initial)
        maintenance.publish()
        print(json.dumps(result))


def main():
    os.umask(0o077)
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)
    capture = commands.add_parser("export", help="capture source database/artwork/config without changing it")
    capture.add_argument("--artwork-root", type=Path, required=True)
    capture.add_argument("--private-config-root", type=Path, required=True)
    capture.add_argument("--output-root", type=Path, required=True)
    capture.add_argument("--schema-version", required=True)
    capture.add_argument("--schema-root", type=Path, required=True)
    capture.add_argument("--version", required=True)
    capture.add_argument("--source-quiesced", action="store_true")
    receive = commands.add_parser("import", help="verify or explicitly restore a trusted transfer bundle")
    receive.add_argument("--source", type=Path, required=True)
    receive.add_argument("--config-root", type=Path, default=Path.home() / ".config/nahhasio-server")
    receive.add_argument("--operations-script", type=Path, default=Path.home() / ".local/share/nahhasio-server/tools/operations.py")
    receive.add_argument("--initial", action="store_true", help="require a fresh empty target with inactive API")
    receive.add_argument("--write", action="store_true")
    receive.add_argument("--confirm")
    args = parser.parse_args()
    if args.command == "export":
        export(args)
    else:
        import_backup(args)


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        # No connection strings, SQL diagnostics or tracebacks leave this operator boundary.
        message = str(error) if isinstance(error, (ValueError, RuntimeError)) else "Transfer failed; inspect the private inputs and local service state"
        print(f"Transfer: {message}", file=sys.stderr)
        raise SystemExit(1) from None
