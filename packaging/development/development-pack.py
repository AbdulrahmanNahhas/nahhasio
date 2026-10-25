#!/usr/bin/env python3
"""Export a bounded catalog sample; initialize a separate empty local development database."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import tempfile
import urllib.parse
import uuid

ROOT = Path(__file__).resolve().parents[2]
ALLOWED_REFERENCES = {"role", "planet", "genre", "tone", "tag", "country", "entity"}
ENVIRONMENT_NAME = re.compile(r"^[A-Z][A-Z0-9_]*$")


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def write_json(path, value):
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n")
    path.chmod(0o600)


def connection(name):
    if not ENVIRONMENT_NAME.fullmatch(name) or not os.environ.get(name):
        raise ValueError("Select an environment variable containing the database URL")
    url = os.environ[name]
    parsed = urllib.parse.urlparse(url)
    if parsed.scheme not in ("postgres", "postgresql"):
        raise ValueError("Database selection must be a PostgreSQL URL")
    return url, parsed


def clean_environment(url, artwork=None):
    environment = os.environ.copy()
    for key in tuple(environment):
        if key.startswith(("NAHHASIO_", "ARCADIA_", "PG")) or key == "DATABASE_URL":
            environment.pop(key)
    environment["DATABASE_URL"] = url
    if artwork:
        environment["NAHHASIO_MEDIA_ROOT"] = str(artwork)
        environment["NAHHASIO_PUBLIC_MEDIA_ROOT"] = str(artwork.parent)
    return environment


class CLI:
    def __init__(self, binary, url, artwork=None):
        self.binary = str(binary.resolve())
        self.environment = clean_environment(url, artwork)

    def call(self, *arguments):
        result = subprocess.run([self.binary, *arguments, "--json"], env=self.environment,
                                stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=180, check=False)
        if result.returncode:
            # Secret-safe: callers can diagnose locally with an explicitly selected CLI later.
            raise RuntimeError("Catalog CLI operation failed; no source database changes were requested")
        return json.loads(result.stdout)


def objects(document):
    yield document
    for part in document.get("installments", []):
        yield part
        yield from part.get("episodes", [])


def selected_file(path, uploads, public):
    if path.startswith("/media/uploads/"):
        root, relative = uploads, path.removeprefix("/media/uploads/")
    elif path.startswith("/media/"):
        root, relative = public, path.removeprefix("/media/")
    else:
        raise ValueError("Artwork path does not use the registered local media namespace")
    resolved = (root / relative).resolve(strict=True)
    if not resolved.is_relative_to(root.resolve()) or not resolved.is_file():
        raise ValueError("Artwork reference escapes the explicitly selected source root")
    if resolved.stat().st_size > 10 * 1024 * 1024:
        raise ValueError("Selected artwork exceeds the ingest limit")
    return resolved


def export_pack(args):
    source_url, _ = connection(args.source_url_env)
    selected = list(dict.fromkeys(str(uuid.UUID(value)) for value in args.work_id))
    if not 1 <= len(selected) <= 30:
        raise ValueError("Select between one and thirty explicit work UUIDs")
    if not args.output.is_absolute() or args.output.exists():
        raise ValueError("Pack output must be a new absolute directory")
    if not args.source_artwork_root.is_absolute() or not args.source_public_root.is_absolute():
        raise ValueError("Source artwork roots must be selected as absolute directories")
    args.output.mkdir(mode=0o700, parents=True)
    images = args.output / "images"
    images.mkdir(mode=0o700)
    cli = CLI(args.cli, source_url)
    documents = []
    references = {name: {} for name in sorted(ALLOWED_REFERENCES)}
    media = {}
    omitted_images = 0
    for identifier in selected:
        document = cli.call("work", "export", identifier)
        # This is an intentionally small development sample, not a recovery export.
        # Cross-work relations, ceremony links and private curator text are unnecessary here.
        document["relations"] = []
        document["curatorNotes"] = ""
        for part in document.get("installments", []):
            part["episodes"] = part.get("episodes", [])[:args.episodes_per_part]
        for award in document.get("awards", []):
            award["ceremonyId"] = None
        for field, resource in (("genres", "genre"), ("tones", "tone"), ("tags", "tag"),
                                ("countries", "country"), ("planets", "planet")):
            for reference in document.get(field, []):
                if reference not in references[resource]:
                    references[resource][reference] = cli.call(resource, "get", reference)
        for credit in document.get("credits", []):
            role = credit["role"]
            if role not in references["role"]:
                references["role"][role] = cli.call("role", "get", role)
            kind = references["role"][role]["entity_kind"]
            identity = kind + ":" + credit["entity"]
            if identity not in references["entity"]:
                resource = "person" if kind == "person" else "studio"
                references["entity"][identity] = cli.call(resource, "get", credit["entity"])
        for record in objects(document):
            for role, path in list(record.get("media", {}).items()):
                if path is None:
                    continue
                if path not in media:
                    if len(media) >= args.max_images:
                        record["media"].pop(role)
                        omitted_images += 1
                        continue
                    file = selected_file(path, args.source_artwork_root, args.source_public_root)
                    checksum = digest(file)
                    relative = "images/" + checksum + file.suffix.lower()
                    destination = args.output / relative
                    if not destination.exists():
                        shutil.copyfile(file, destination)
                        destination.chmod(0o600)
                    media[path] = {"file": relative, "sha256": checksum, "role": role}
        documents.append(document)
    pack = {"formatVersion": 1, "purpose": "development-only", "works": documents,
            "references": {resource: list(rows.values()) for resource, rows in references.items()},
            "artwork": media, "omittedImages": omitted_images, "episodesPerPart": args.episodes_per_part,
            "excludes": ["accounts", "sessions", "tracking", "provider-credentials", "host-configuration", "video-files"]}
    write_json(args.output / "pack.json", pack)
    print(json.dumps({"pack": str(args.output), "works": len(documents), "images": len(media),
                      "omittedImages": omitted_images, "sourceReadOnly": True}))


def import_pack(args):
    source_url, source = connection(args.source_url_env)
    target_url, target = connection(args.target_url_env)
    # Source identity is used only for a refusal check. No source command runs during import.
    source_identity = (source.port or 5432, urllib.parse.unquote(source.path))
    target_identity = (target.port or 5432, urllib.parse.unquote(target.path))
    query = urllib.parse.parse_qs(target.query)
    database = urllib.parse.unquote(target.path.removeprefix("/"))
    if source_url == target_url or source_identity == target_identity:
        raise ValueError("Development target must differ from the source database")
    if (target.hostname not in (None, "localhost", "127.0.0.1", "::1")
            or set(query) - {"host", "sslmode"}
            or any(not (host.startswith("/") or host in ("localhost", "127.0.0.1", "::1")) for host in query.get("host", []))
            or not re.fullmatch(r"nahhasio_dev_[a-z0-9_]+", database)
            or args.confirm_empty_database != database):
        raise ValueError("Target must be an explicitly confirmed local nahhasio_dev_* database")
    if not args.artwork_root.is_absolute() or args.artwork_root.exists():
        raise ValueError("Development artwork root must be a new absolute directory")
    pack_root = args.pack.resolve(strict=True)
    pack = json.loads((pack_root / "pack.json").read_text())
    if (pack.get("formatVersion") != 1 or pack.get("purpose") != "development-only"
            or not 1 <= len(pack.get("works", [])) <= 30
            or set(pack.get("references", {})) != ALLOWED_REFERENCES):
        raise ValueError("Unsupported development pack")
    for value in pack["artwork"].values():
        file = (pack_root / value["file"]).resolve(strict=True)
        if not file.is_relative_to(pack_root / "images") or digest(file) != value["sha256"]:
            raise ValueError("Development artwork checksum or containment failed")
    cli = CLI(args.cli, target_url, args.artwork_root)
    count = cli.call("sql", "SELECT count(*) AS count FROM information_schema.tables WHERE table_schema='public'")
    if count[0]["count"] != 0:
        raise ValueError("Refusing to initialize a database that already contains public tables")
    # The empty-target boundary is permanent for this run. Partial failures deliberately leave
    # recoverable development state; the tool never drops, truncates or resets a database.
    args.artwork_root.mkdir(mode=0o700, parents=True)
    cli.call("migrate", "apply", "--dry-run")
    cli.call("migrate", "apply", "--write")
    for resource in ("role", "planet", "genre", "tone", "tag", "country", "entity"):
        for record in pack["references"][resource]:
            conditions = ["--where", "name=" + record["name"], "--where", "kind=" + record["kind"]] if resource == "entity" else ["--where", "slug=" + record["slug"]]
            existing = cli.call(resource, "list", *conditions, "--all-columns", "--limit", "2")
            if len(existing) > 1:
                raise ValueError("A development reference is ambiguous")
            arguments = [resource, "update", existing[0]["id"]] if existing else [resource, "create"]
            for column, value in record.items():
                if column in ("created_at", "updated_at") or existing and column == "id":
                    continue
                arguments += ["--json-set", column + "=" + json.dumps(value, ensure_ascii=False)]
            cli.call(*arguments, "--dry-run")
            cli.call(*arguments, "--write")
    mapping = {}
    for original, value in pack["artwork"].items():
        asset = cli.call("media", "ingest", str(pack_root / value["file"]),
                         "--role", value["role"], "--write")
        mapping[original] = asset["path"]
    with tempfile.TemporaryDirectory(prefix="nahhasio-development-") as temporary:
        for document in pack["works"]:
            for record in objects(document):
                for role, path in list(record.get("media", {}).items()):
                    if path is not None:
                        record["media"][role] = mapping[path]
            path = Path(temporary) / (str(uuid.UUID(document["id"])) + ".json")
            write_json(path, document)
            cli.call("work", "apply", "--file", str(path), "--create-only", "--create-missing", "--dry-run")
            cli.call("work", "apply", "--file", str(path), "--create-only", "--create-missing", "--write")
    environment = clean_environment(target_url, args.artwork_root)
    environment["ARCADIA_SEED_DEMO_ACCOUNTS"] = "true"
    # Explicit development operation after the empty-target guard. The existing seeder owns
    # compatible password hashes and test identities; production auth rows are never exported.
    result = subprocess.run(["pnpm", "--filter", "@arcadia/database", "db:seed"], cwd=ROOT,
                            env=environment, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                            timeout=180, check=False)
    if result.returncode:
        raise RuntimeError("Development account seeding failed; the original source database was untouched")
    write_json(args.artwork_root.parent / "development-pack-import.json",
               {"purpose": "development-only", "database": database,
                "workIds": [work["id"] for work in pack["works"]], "artworkRoot": str(args.artwork_root)})
    print(json.dumps({"database": database, "works": len(pack["works"]), "images": len(mapping),
                      "newServerIdentity": True, "productionAccountsImported": False}))


def main():
    os.umask(0o077)
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--cli", type=Path, default=ROOT / "target/debug/nahhasio")
    commands = parser.add_subparsers(dest="operation", required=True)
    export = commands.add_parser("export")
    export.add_argument("--source-url-env", default="NAHHASIO_SOURCE_DATABASE_URL")
    export.add_argument("--work-id", action="append", required=True)
    export.add_argument("--source-artwork-root", type=Path, required=True)
    export.add_argument("--source-public-root", type=Path, required=True)
    export.add_argument("--output", type=Path, required=True)
    export.add_argument("--episodes-per-part", type=int, choices=range(1, 21), default=4)
    export.add_argument("--max-images", type=int, choices=range(0, 501), default=100)
    initialize = commands.add_parser("initialize")
    initialize.add_argument("--source-url-env", default="NAHHASIO_SOURCE_DATABASE_URL")
    initialize.add_argument("--target-url-env", default="NAHHASIO_DEVELOPMENT_DATABASE_URL")
    initialize.add_argument("--pack", type=Path, required=True)
    initialize.add_argument("--artwork-root", type=Path, required=True)
    initialize.add_argument("--confirm-empty-database", required=True)
    args = parser.parse_args()
    try:
        if args.operation == "export":
            export_pack(args)
        else:
            import_pack(args)
    except Exception as error:
        message = str(error) if isinstance(error, (ValueError, RuntimeError)) else "Development pack failed; inspect the selected local files and tools"
        print(message, file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
