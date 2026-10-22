#!/usr/bin/env python3
"""Isolated native-bridge HTTPS acceptance; no database or real credentials."""
import hashlib
import http.server
import json
import os
from pathlib import Path
import ssl
import subprocess
import tempfile
import threading

ROOT = Path(__file__).resolve().parents[3]


def openssl(*args):
    subprocess.run(["openssl", *map(str, args)], check=True, capture_output=True)


class Handler(http.server.BaseHTTPRequestHandler):
    requests = []

    def log_message(self, *_):
        pass

    def do_GET(self):
        self.requests.append((self.path, self.headers.get("Authorization")))
        if self.path == "/api/v1/server/info":
            value = {"product": "nahhasio", "name": "ن" * 100, "version": "0.1.0", "apiVersion": 1}
        elif self.path == "/api/health/ready":
            value = {"status": "ready"}
        else:
            self.send_error(404)
            return
        body = json.dumps(value).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


with tempfile.TemporaryDirectory(prefix="nahhasio-trust-") as folder:
    folder = Path(folder)
    ca, key = folder / "root.pem", folder / "root.key"
    cert, leaf_key = folder / "server.pem", folder / "server.key"
    csr, ext = folder / "server.csr", folder / "extensions"
    openssl("req", "-x509", "-newkey", "rsa:2048", "-nodes", "-days", "1", "-subj",
            "/CN=Nahhasio isolated fixture", "-addext", "basicConstraints=critical,CA:TRUE",
            "-keyout", key, "-out", ca)
    openssl("req", "-new", "-newkey", "rsa:2048", "-nodes", "-subj", "/CN=localhost",
            "-keyout", leaf_key, "-out", csr)
    ext.write_text("subjectAltName=DNS:localhost\nbasicConstraints=critical,CA:FALSE\nextendedKeyUsage=serverAuth\n")
    openssl("x509", "-req", "-in", csr, "-CA", ca, "-CAkey", key, "-CAcreateserial",
            "-days", "1", "-extfile", ext, "-out", cert)
    pem = ca.read_text()
    fingerprint = hashlib.sha256(ssl.PEM_cert_to_DER_cert(pem)).hexdigest()
    trust = {"certificate": pem, "fingerprint": fingerprint}
    server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), Handler)
    context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
    context.load_cert_chain(cert, leaf_key)
    server.socket = context.wrap_socket(server.socket, server_side=True)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    url = f"https://localhost:{server.server_port}/"
    env = {k: v for k, v in os.environ.items() if k not in {
        "DATABASE_URL", "NAHHASIO_SERVER_URL", "NAHHASIO_VIDEO_ROOT", "XDG_STATE_HOME", "HOME"
    }}
    env.update(HOME=str(folder), XDG_STATE_HOME=str(folder / "state"))
    binary = ROOT / "target/debug/nahhasio-linux"
    count = 0

    def bridge(commands):
        global count
        requests = [{"id": f"trust-{i}", "command": command, "payload": payload}
                    for i, (command, payload) in enumerate(commands)]
        child = subprocess.run(["bash", str(ROOT / "bin/nahhasio-native-runtime"), str(binary), "--bridge-smoke"],
                               input="".join(json.dumps(r) + "\n" for r in requests),
                               capture_output=True, text=True, env=env, timeout=30)
        assert child.returncode == 0, child.stderr
        replies = [json.loads(line) for line in child.stdout.splitlines()]
        assert len(replies) == len(commands), child.stdout
        count += len(replies)
        return replies

    try:
        replies = bridge([
            ("servers.probe", {"url": url}),
            ("servers.probe", {"url": url, "trust": {**trust, "fingerprint": "0" * 64}}),
            ("servers.probe", {"url": url, "trust": {**trust, "certificate": pem + pem}}),
            ("servers.probe", {"url": url, "trust": {**trust, "certificate": key.read_text()}}),
            ("servers.probe", {"url": f"https://127.0.0.1:{server.server_port}/", "trust": trust}),
            ("servers.probe", {"url": "http://192.168.1.50:23103/"}),
            ("servers.probe", {"url": "http://localhost:23103/", "trust": trust}),
        ])
        assert all(not reply["ok"] for reply in replies), replies
        assert not Handler.requests, "Rejected trust must not reach the application"
        reply, = bridge([("servers.probe", {"url": url, "trust": trust})])
        assert reply["ok"] and len(reply["result"]["info"]["name"]) == 100, reply
        # Testing never persists a certificate or a new connection.
        reply, = bridge([("servers.list", {})])
        assert len(reply["result"]["servers"]) == 1
        reply, = bridge([("servers.select", {"url": url, "trust": trust})])
        assert reply["ok"], reply
        state = reply["result"]
        assert state["selected"] == url and state["servers"][-1]["trustedFingerprint"] == fingerprint
        assert "BEGIN CERTIFICATE" not in json.dumps(state)
        # Restart the real native bridge: trust is loaded from its private saved connection.
        replies = bridge([
            ("servers.probe", {"url": url}),
            ("servers.probe", {"url": url, "trust": trust}),
            ("servers.probe", {"url": f"https://127.0.0.1:{server.server_port}/"}),
            ("servers.save", {"url": url, "name": "fixture"}),
        ])
        assert replies[0]["ok"] and not replies[1]["ok"] and not replies[2]["ok"] and replies[3]["ok"]
        assert all(auth is None for _, auth in Handler.requests)
        connections = folder / "state/nahhasio/connections.json"
        assert connections.stat().st_mode & 0o777 == 0o600
        assert json.loads(connections.read_text())["version"] == 2
        assert len(state["servers"][-1]["name"]) == 80
        print(f"Native HTTPS trust: {count} bridge checks passed; no database or real credentials used.")
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=5)
