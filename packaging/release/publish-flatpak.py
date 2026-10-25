#!/usr/bin/env python3
"""Verify the signed release's repository archive and retain older commits during promotion."""
import argparse
import hashlib
import json
from pathlib import Path
import shutil
import tarfile
import tempfile


def merge(manifest, archive, destination):
    expected = json.loads(manifest.read_text())["client"]["repositoryArchive"]
    digest = hashlib.sha256()
    with archive.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    if archive.stat().st_size != expected["size"] or digest.hexdigest() != expected["sha256"]:
        raise ValueError("Published repository archive does not match the signed release")
    if destination.is_symlink():
        raise ValueError("Repository destination cannot be a symlink")
    destination.mkdir(parents=True, exist_ok=True)
    if any(path.is_symlink() for path in destination.rglob("*")):
        raise ValueError("Retained repository cannot contain symlinks")
    with tempfile.TemporaryDirectory() as directory:
        temporary = Path(directory)
        total = 0
        with tarfile.open(archive, "r:gz") as source:
            for member in source:
                relative = Path(member.name)
                if relative.is_absolute() or ".." in relative.parts or not (member.isfile() or member.isdir()):
                    raise ValueError("Invalid repository archive member")
                total += member.size
                if total > 2 * 1024**3:
                    raise ValueError("Repository archive exceeds the publication bound")
                target = temporary / relative
                if member.isdir():
                    target.mkdir(parents=True, exist_ok=True)
                else:
                    target.parent.mkdir(parents=True, exist_ok=True)
                    with source.extractfile(member) as contents, target.open("xb") as output:
                        shutil.copyfileobj(contents, output)
        for required in ("summary", "summary.sig", "config", "objects", "refs"):
            if not (temporary / required).exists():
                raise ValueError("Signed Flatpak repository is incomplete")
        # Do not prune: older signed commits/objects remain available for rollback.
        shutil.copytree(temporary, destination, dirs_exist_ok=True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("manifest", type=Path)
    parser.add_argument("archive", type=Path)
    parser.add_argument("destination", type=Path)
    args = parser.parse_args()
    merge(args.manifest, args.archive, args.destination)
