#!/usr/bin/env python3
"""Explicit rootless installation; never starts, seeds or migrates on prepare."""

import argparse
import ipaddress
import json
import os
from pathlib import Path
import re
import secrets
import subprocess
import sys
import tempfile
from urllib.parse import quote


def fail(message):
    raise RuntimeError(message)


def run(argv, *, input_text=None, capture=False):
    result = subprocess.run(argv, input=input_text, text=True, capture_output=True)
    if result.returncode:
        # SQL, connection strings and private paths may appear in diagnostics.
        fail(f"{Path(argv[0]).name} failed (exit {result.returncode}); inspect the local service journal")
    if capture:
        return result.stdout.strip()
    return None


def private_directory(path):
    if path.is_symlink():
        fail("Refusing a symbolic-link installation directory")
    path.mkdir(parents=True, exist_ok=True, mode=0o700)
    stat = path.stat()
    if stat.st_uid != os.getuid() or stat.st_mode & 0o077:
        fail("Installation directories must be owned by this user and mode 0700")


def write(path, content, *, executable=False):
    if path.is_symlink():
        fail("Refusing a symbolic-link installation file")
    fd, name = tempfile.mkstemp(prefix=".install-", dir=path.parent)
    try:
        with os.fdopen(fd, "w") as output:
            output.write(content)
            output.flush()
            os.fsync(output.fileno())
        os.chmod(name, 0o700 if executable else 0o600)
        os.replace(name, path)
    finally:
        Path(name).unlink(missing_ok=True)


def absolute_root(value):
    path = Path(value).expanduser()
    if not path.is_absolute() or any(c in str(path) for c in "\n\r%\"\\"):
        fail("Installation roots must be absolute paths without unit-file metacharacters")
    if path.is_symlink():
        fail("Installation roots must not be symbolic links")
    # Fedora Atomic exposes /home through /var/home. Persist the canonical path rather than
    # rejecting the operating system's home-directory alias.
    return path.resolve()


def pinned_image(value):
    if not re.fullmatch(r"[a-z0-9][a-z0-9.:/_-]+@sha256:[0-9a-f]{64}", value):
        fail("Installed image references must be fully qualified and pinned with @sha256:<64 hex digits>")
    if "/" not in value.split("@", 1)[0]:
        fail("An explicit image registry/repository is required")
    return value


def environment(path):
    result = {}
    for line in path.read_text().splitlines():
        if line and not line.startswith("#"):
            key, value = line.split("=", 1)
            result[key] = value
    return result


def load(config):
    private_directory(config)
    path = config / "installation.json"
    if path.is_symlink() or path.stat().st_mode & 0o077:
        fail("installation.json must be a private regular file")
    return json.loads(path.read_text())


def prepare(args, config):
    if (config / "installation.json").exists():
        fail("Installation already exists; prepare never overwrites an installed configuration")
    data = absolute_root(args.data_root)
    if config == data or config.is_relative_to(data) or data.is_relative_to(config):
        fail("Data and configuration roots must be separate")
    quadlets = absolute_root(args.quadlet_root)
    server_image = pinned_image(args.server_image)
    postgres_image = pinned_image(args.postgres_image)
    if not re.fullmatch(r"[a-f0-9]{64}", args.schema_version):
        fail("--schema-version must be the 64-hex schema digest from the release manifest")
    if args.manifest_url and not args.manifest_url.startswith("https://"):
        fail("Release manifests require HTTPS")
    private_directory(config)
    private_directory(data)
    for root in [data / "artwork", data / "artwork/uploads", data / "backups", data / "operations", data / "tools", config / "private", config / "tls"]:
        private_directory(root)
    quadlets.mkdir(parents=True, exist_ok=True, mode=0o700)
    if any((quadlets / name).exists() for name in ["nahhasio.network", "nahhasio-postgres-data.volume", "nahhasio-postgres.container", "nahhasio-server.container"]):
        fail("Existing Nahhasio Quadlets require explicit operator reconciliation")
    passwords = {}
    for role in ["postgres", "owner", "runtime"]:
        passwords[role] = secrets.token_hex(32)
        write(config / f"{role}-password", passwords[role] + "\n")
    runtime_url = f"postgresql://nahhasio_runtime:{quote(passwords['runtime'], safe='')}@nahhasio-postgres:5432/nahhasio"
    owner_url = f"postgresql://nahhasio_owner:{quote(passwords['owner'], safe='')}@nahhasio-postgres:5432/nahhasio"
    write(config / "server.env", f"DATABASE_URL={runtime_url}\n")
    write(config / "operator.env", f"DATABASE_URL={owner_url}\n")
    if args.release_key:
        key = Path(args.release_key).read_text()
        if "BEGIN PUBLIC KEY" not in key or "PRIVATE KEY" in key:
            fail("Only a release verification public key may be installed")
        write(config / "release-key.pem", key)
    metadata = {
        "formatVersion": 1,
        "version": args.version,
        "schemaVersion": args.schema_version,
        "dataRoot": str(data),
        "configRoot": str(config),
        "quadletRoot": str(quadlets),
        "database": "nahhasio",
        "databaseAdmin": "postgres",
        "databaseOwner": "nahhasio_owner",
        "databaseRuntime": "nahhasio_runtime",
        "databaseContainer": "nahhasio-postgres",
        "serverUnit": "nahhasio-server.service",
        "serverImage": server_image,
        "postgresImage": postgres_image,
        "serverRepository": server_image.split("@", 1)[0],
        "releaseManifestUrl": args.manifest_url or "",
        "port": args.port,
    }
    write(config / "installation.json", json.dumps(metadata, indent=2) + "\n")
    write(quadlets / "nahhasio.network", "[Network]\nNetworkName=nahhasio\n")
    write(quadlets / "nahhasio-postgres-data.volume", "[Volume]\nVolumeName=nahhasio-postgres-data\n")
    write(quadlets / "nahhasio-postgres.container", f"""[Unit]
Description=Nahhasio private PostgreSQL

[Container]
Image={postgres_image}
ContainerName=nahhasio-postgres
Network=nahhasio.network
Environment=POSTGRES_USER=postgres
Environment=POSTGRES_DB=postgres
Environment=POSTGRES_PASSWORD_FILE=/run/secrets/postgres-password
Volume=nahhasio-postgres-data.volume:/var/lib/postgresql/data
Volume={config}/postgres-password:/run/secrets/postgres-password:ro,Z
HealthCmd=pg_isready -U postgres -d postgres
HealthInterval=10s
HealthTimeout=5s
HealthRetries=5
Notify=healthy
NoNewPrivileges=true

[Service]
Restart=on-failure
RestartSec=5
TimeoutStartSec=900

[Install]
WantedBy=default.target
""")
    write(quadlets / "nahhasio-server.container", f"""[Unit]
Description=Nahhasio family catalog server
Requires=nahhasio-postgres.service
After=nahhasio-postgres.service

[Container]
Image={server_image}
ContainerName=nahhasio-server
Network=nahhasio.network
UserNS=keep-id
User=%U
PublishPort={args.bind_address}:{args.port}:8443
EnvironmentFile={config}/server.env
Environment=NAHHASIO_OPERATIONS_ROOT=/var/lib/nahhasio/operations
Volume={data}/artwork:/var/lib/nahhasio/artwork:z
Volume={config}/private:/var/lib/nahhasio/config:z
Volume={config}/tls:/var/lib/nahhasio/tls:ro,z
Volume={data}/operations:/var/lib/nahhasio/operations:z
ReadOnly=true
Tmpfs=/tmp:rw,nosuid,nodev,size=64m
DropCapability=ALL
NoNewPrivileges=true
HealthCmd=curl --fail --silent --cacert /var/lib/nahhasio/tls/ca.crt https://localhost:8443/api/health/ready
HealthInterval=15s
HealthTimeout=5s
HealthRetries=3
HealthStartPeriod=30s
HealthOnFailure=kill
Notify=healthy

[Service]
Restart=on-failure
RestartSec=5
TimeoutStartSec=900
TimeoutStopSec=35

[Install]
WantedBy=default.target
""")
    write(data / "tools/install.py", Path(__file__).read_text(), executable=True)
    print("Prepared private installation and rootless Quadlets; no services started or database changed.")


def certificates(args, config):
    load(config)
    if not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9.-]{0,252}", args.hostname):
        fail("Supply the stable local DNS hostname used by clients")
    tls = config / "tls"
    if any((tls / name).exists() for name in ["ca.key", "ca.crt", "server.key", "server.crt"]):
        fail("Certificates already exist; renewal must preserve/review client trust explicitly")
    names = [f"DNS:{args.hostname}", "DNS:localhost", "IP:127.0.0.1"]
    for address in args.ip:
        names.append(f"IP:{ipaddress.ip_address(address)}")
    run(["openssl", "req", "-x509", "-newkey", "ed25519", "-nodes", "-days", "3650", "-subj", "/CN=Nahhasio Home Root", "-addext", "basicConstraints=critical,CA:TRUE", "-addext", "keyUsage=critical,keyCertSign,cRLSign", "-keyout", str(tls / "ca.key"), "-out", str(tls / "ca.crt")])
    run(["openssl", "req", "-new", "-newkey", "ed25519", "-nodes", "-subj", f"/CN={args.hostname}", "-keyout", str(tls / "server.key"), "-out", str(tls / "server.csr")])
    write(tls / "server.ext", "basicConstraints=critical,CA:FALSE\nkeyUsage=critical,digitalSignature\nextendedKeyUsage=serverAuth\nsubjectAltName=" + ",".join(names) + "\n")
    run(["openssl", "x509", "-req", "-days", "365", "-in", str(tls / "server.csr"), "-CA", str(tls / "ca.crt"), "-CAkey", str(tls / "ca.key"), "-CAcreateserial", "-extfile", str(tls / "server.ext"), "-out", str(tls / "server.crt")])
    for path in tls.iterdir():
        os.chmod(path, 0o600)
    # The API never receives the CA signing key: retain it in a separate host-only directory.
    authority = config / "authority"
    private_directory(authority)
    for name in ["ca.key", "ca.srl"]:
        if (tls / name).exists():
            (tls / name).replace(authority / name)
    (tls / "server.csr").unlink(missing_ok=True)
    (tls / "server.ext").unlink(missing_ok=True)
    print("Public CA:", tls / "ca.crt")
    print(run(["openssl", "x509", "-in", str(tls / "ca.crt"), "-noout", "-fingerprint", "-sha256"], capture=True))
    print("Enroll this public CA and verify its fingerprint separately on each client.")


def psql(sql):
    run(["podman", "exec", "-i", "nahhasio-postgres", "psql", "--no-psqlrc", "--set", "ON_ERROR_STOP=1", "--quiet", "--username", "postgres", "--dbname", "postgres"], input_text=sql)


def bootstrap(config):
    load(config)
    owner = (config / "owner-password").read_text().strip()
    runtime = (config / "runtime-password").read_text().strip()
    if not all(re.fullmatch(r"[a-f0-9]{64}", password) for password in [owner, runtime]):
        fail("Invalid private role password file")
    # Refuse to alter existing database identities/credentials; restoration is a separate path.
    exists = run(["podman", "exec", "nahhasio-postgres", "psql", "-At", "-U", "postgres", "-d", "postgres", "-c", "select count(*) from pg_roles where rolname in ('nahhasio_owner','nahhasio_runtime')"], capture=True)
    if exists != "0":
        fail("Roles already exist; bootstrap is only for an empty installation")
    psql(f"CREATE ROLE nahhasio_owner LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION PASSWORD '{owner}';\nCREATE ROLE nahhasio_runtime LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION PASSWORD '{runtime}';\nCREATE DATABASE nahhasio OWNER nahhasio_owner;\nREVOKE ALL ON DATABASE nahhasio FROM PUBLIC;\nGRANT CONNECT ON DATABASE nahhasio TO nahhasio_owner,nahhasio_runtime;\n\\connect nahhasio\nREVOKE CREATE ON SCHEMA public FROM PUBLIC;\nGRANT ALL ON SCHEMA public TO nahhasio_owner;\n")
    print("Created empty database and separate owner/runtime roles; run explicit migration or restore next.")


def operator(args, config):
    installed = load(config)
    image = pinned_image(installed["serverImage"])
    argv = ["podman", "run", "--rm", "--network", "nahhasio", "--userns=keep-id", "--user", str(os.getuid()), "--read-only", "--cap-drop=all", "--security-opt=no-new-privileges", "--env-file", str(config / "operator.env"), "--entrypoint", "/usr/local/bin/nahhasio", image]
    print(run(argv + args.arguments, capture=True))


def grants(config):
    load(config)
    psql("\\connect nahhasio\nREVOKE CREATE ON SCHEMA public FROM PUBLIC;\nGRANT USAGE ON SCHEMA public TO nahhasio_runtime;\nGRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA public TO nahhasio_runtime;\nGRANT USAGE,SELECT ON ALL SEQUENCES IN SCHEMA public TO nahhasio_runtime;\nGRANT USAGE ON SCHEMA drizzle TO nahhasio_runtime;\nGRANT SELECT ON ALL TABLES IN SCHEMA drizzle TO nahhasio_runtime;\nALTER ROLE nahhasio_runtime SET default_transaction_read_only=on;\n")
    print("Granted existing application DML and read-only migration-ledger access; runtime owns no schema.")


def maintenance_install(config):
    installed = load(config)
    target = Path(installed["dataRoot"]) / "tools/operations.py"
    source = Path(__file__).resolve().parent.parent / "operations/operations.py"
    if source.is_file():
        # Execute the verified bundle's tool to bootstrap versioned files atomically;
        # never overwrite a running worker or its managed entry links in place.
        selected = source
    elif target.is_file():
        selected = target
    else:
        fail("Install the operations.py release artifact into the installation tools directory first")
    result = subprocess.run([sys.executable, str(selected), "--config-root", str(config), "install-units"], check=False)
    if result.returncode:
        fail("Host-tool installation failed; see the diagnostic above")
    print("Installed host maintenance units; review their configuration before enabling timers.")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--config-root", default=str(Path.home() / ".config/nahhasio-server"))
    sub = parser.add_subparsers(dest="command", required=True)
    prepare_parser = sub.add_parser("prepare", help="write installation files; do not start services")
    prepare_parser.add_argument("--data-root", default=str(Path.home() / ".local/share/nahhasio-server"))
    prepare_parser.add_argument("--quadlet-root", default=str(Path.home() / ".config/containers/systemd"))
    prepare_parser.add_argument("--server-image", required=True)
    prepare_parser.add_argument("--postgres-image", required=True)
    prepare_parser.add_argument("--schema-version", required=True)
    prepare_parser.add_argument("--version", required=True)
    prepare_parser.add_argument("--release-key")
    prepare_parser.add_argument("--manifest-url")
    prepare_parser.add_argument("--port", type=int, choices=range(1024, 65536), default=8443, metavar="1024..65535")
    prepare_parser.add_argument("--bind-address", type=ipaddress.IPv4Address, default=ipaddress.IPv4Address("0.0.0.0"))
    cert = sub.add_parser("certificates", help="create a private local CA and LAN server certificate")
    cert.add_argument("--hostname", required=True)
    cert.add_argument("--ip", action="append", default=[])
    sub.add_parser("bootstrap", help="explicitly create fresh database and roles; database must be running")
    sub.add_parser("grants", help="explicitly grant runtime DML after migrations/restoration")
    operator_parser = sub.add_parser("operator", help="run trusted CLI with separate migration-owner credentials")
    operator_parser.add_argument("arguments", nargs=argparse.REMAINDER)
    sub.add_parser("reload", help="reload user unit definitions; does not start services")
    sub.add_parser("start-database", help="start private PostgreSQL only")
    sub.add_parser("start", help="start installed server; does not migrate or seed")
    sub.add_parser("status", help="read systemd service status")
    sub.add_parser("maintenance-install", help="install the host backup/update worker units")
    args = parser.parse_args()
    if os.getuid() == 0:
        fail("Run as the dedicated unprivileged service user; rootful installation is unsupported")
    os.umask(0o077)
    config = absolute_root(args.config_root)
    if args.command == "prepare":
        prepare(args, config)
    elif args.command == "certificates":
        certificates(args, config)
    elif args.command == "bootstrap":
        bootstrap(config)
    elif args.command == "grants":
        grants(config)
    elif args.command == "operator":
        operator(args, config)
    elif args.command == "maintenance-install":
        maintenance_install(config)
    else:
        load(config)
        if args.command == "reload":
            run(["systemctl", "--user", "daemon-reload"])
        elif args.command == "start-database":
            run(["systemctl", "--user", "start", "nahhasio-postgres.service"])
        elif args.command == "start":
            run(["systemctl", "--user", "start", "nahhasio-server.service"])
        else:
            subprocess.run(["systemctl", "--user", "status", "nahhasio-postgres.service", "nahhasio-server.service"], check=False)


if __name__ == "__main__":
    try:
        main()
    except (OSError, ValueError, RuntimeError) as error:
        print(f"Installation: {error}", file=sys.stderr)
        raise SystemExit(1) from None
