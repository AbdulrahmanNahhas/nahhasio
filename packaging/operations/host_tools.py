"""Versioned, verified host-tool storage. Never manages configuration or application data."""
import ast
import hashlib
import io
import json
import os
from pathlib import Path
import re
import shutil
import stat
import tarfile
import tempfile
import uuid

API_VERSION = 1
MAX_ARCHIVE = 8 * 1024 * 1024
FILES = {
    "operations.py": "packaging/operations/operations.py",
    "host_tools.py": "packaging/operations/host_tools.py",
    "install.py": "packaging/server/install.py",
    "transfer.py": "packaging/server/transfer.py",
    "manifest.py": "packaging/release/manifest.py",
}
VERSION = re.compile(r"(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)(?:-[A-Za-z0-9.-]+)?")


def digest(value):
    return hashlib.sha256(value).hexdigest()


def private(path):
    path = Path(path)
    path.mkdir(mode=0o700, parents=True, exist_ok=True)
    info = path.lstat()
    if not stat.S_ISDIR(info.st_mode) or info.st_uid != os.getuid() or info.st_mode & 0o077:
        raise ValueError("Host-tool directories must be private and owned by the service user")
    return path


def sync_directory(path):
    fd = os.open(path, os.O_RDONLY | os.O_DIRECTORY)
    try:
        os.fsync(fd)
    finally:
        os.close(fd)


def selected_version(files):
    for name, body in files.items():
        if len(body) > 1024 * 1024:
            raise ValueError("Host tool exceeds its size bound")
        compile(body, name, "exec")
    tree = ast.parse(files["operations.py"])
    for item in tree.body:
        if isinstance(item, ast.Assign) and any(isinstance(target, ast.Name) and target.id == "HOST_TOOLS_VERSION" for target in item.targets):
            version = ast.literal_eval(item.value)
            if isinstance(version, str) and VERSION.fullmatch(version):
                return version
    raise ValueError("Host tools have no supported release version")


def unpack(archive, expected):
    if len(archive) != expected["size"] or digest(archive) != expected["sha256"]:
        raise ValueError("Host-tool archive does not match the signed manifest")
    files, seen, total = {}, set(), 0
    members = {source: name for name, source in FILES.items()}
    with tarfile.open(fileobj=io.BytesIO(archive), mode="r:gz") as source:
        for member in source:
            path = Path(member.name)
            normalized = path.as_posix()
            if path.is_absolute() or ".." in path.parts or normalized in seen or not (member.isfile() or member.isdir()):
                raise ValueError("Invalid host-tool archive member")
            seen.add(normalized)
            total += member.size
            if total > MAX_ARCHIVE or len(seen) > 4096:
                raise ValueError("Host-tool archive exceeds its extraction bound")
            if normalized in members and member.isfile():
                files[members[normalized]] = source.extractfile(member).read()
    if set(files) != set(FILES):
        raise ValueError("Host-tool archive is incomplete")
    return files


class Store:
    def __init__(self, root):
        self.root = private(root)
        self.versions = private(self.root / "versions")

    def current(self):
        link = self.root / "current"
        if not link.is_symlink():
            raise ValueError("Bootstrap managed host tools before enabling coordinated updates")
        target = os.readlink(link)
        self.verify(target)
        return target

    def verify(self, target):
        path = Path(target)
        if len(path.parts) != 2 or path.parts[0] != "versions" or not VERSION.fullmatch(path.parts[1]):
            raise ValueError("Invalid managed host-tool target")
        directory = self.root / path
        try:
            info = directory.lstat()
        except FileNotFoundError:
            raise ValueError("Selected host-tool version is missing") from None
        if not stat.S_ISDIR(info.st_mode) or info.st_uid != os.getuid() or info.st_mode & 0o077:
            raise ValueError("Selected host-tool version must be private and service-owned")
        receipt = directory / "tools.json"
        if receipt.is_symlink() or not receipt.is_file() or receipt.stat().st_size > 8192:
            raise ValueError("Invalid host-tool receipt")
        evidence = json.loads(receipt.read_text())
        if evidence.get("version") != path.parts[1] or evidence.get("apiVersion") != API_VERSION or set(evidence.get("files", {})) != set(FILES):
            raise ValueError("Host-tool receipt does not match the selected version")
        for name, expected in evidence["files"].items():
            file = directory / name
            if file.is_symlink() or not file.is_file() or file.stat().st_size > 1024 * 1024 or digest(file.read_bytes()) != expected:
                raise ValueError("Installed host-tool integrity check failed")
        return directory

    def stage(self, version, files):
        if not VERSION.fullmatch(version) or set(files) != set(FILES) or selected_version(files) != version:
            raise ValueError("Host tools do not match the signed release version")
        target = "versions/" + version
        directory = self.root / target
        evidence = {"apiVersion": API_VERSION, "version": version, "files": {name: digest(body) for name, body in files.items()}}
        if directory.exists() or directory.is_symlink():
            self.verify(target)
            if json.loads((directory / "tools.json").read_text()) != evidence:
                raise ValueError("A different host-tool build already uses this version")
            return target
        pending = Path(tempfile.mkdtemp(prefix=".stage-", dir=self.versions))
        try:
            for name, body in files.items():
                with (pending / name).open("xb") as output:
                    os.chmod(pending / name, 0o600)
                    output.write(body)
                    output.flush()
                    os.fsync(output.fileno())
            with (pending / "tools.json").open("x") as output:
                os.chmod(pending / "tools.json", 0o600)
                json.dump(evidence, output)
                output.flush()
                os.fsync(output.fileno())
            sync_directory(pending)
            pending.rename(directory)
            sync_directory(self.versions)
        finally:
            if pending.exists():
                shutil.rmtree(pending)
        return target

    def activate(self, target):
        self.verify(target)
        current = self.root / "current"
        if current.exists() and not current.is_symlink():
            raise ValueError("Refusing to overwrite an unmanaged host-tool selector")
        temporary = self.root / (".current-" + uuid.uuid4().hex)
        try:
            temporary.symlink_to(target)
            os.replace(temporary, current)
            sync_directory(self.root)
        finally:
            temporary.unlink(missing_ok=True)

    def bootstrap(self, version, files):
        target = self.stage(version, files)
        # Keep direct 0.1.0 scripts for recovery; never overwrite/delete their contents.
        legacy = private(self.root / "legacy")
        for name in FILES:
            destination = self.root / name
            if destination.is_symlink():
                if os.readlink(destination) != "current/" + name:
                    raise ValueError("Refusing an unexpected host-tool entry link")
            elif destination.exists():
                if not destination.is_file():
                    raise ValueError("Invalid legacy host-tool entry")
                retained = legacy / name
                if not retained.exists():
                    shutil.copy2(destination, retained)
        self.activate(target)
        for name in FILES:
            temporary = self.root / (".entry-" + uuid.uuid4().hex)
            temporary.symlink_to("current/" + name)
            os.replace(temporary, self.root / name)
        sync_directory(self.root)
        return target
