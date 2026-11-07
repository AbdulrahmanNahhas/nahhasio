"""Create conventional Software installation descriptors with the repository public key."""
import base64
from pathlib import Path
import sys

key, destination, url = Path(sys.argv[1]), Path(sys.argv[2]), sys.argv[3]
branch = sys.argv[4] if len(sys.argv) > 4 else "alpha"
if branch not in {"alpha", "rc"}:
    raise ValueError("Unsupported Flatpak release branch")
encoded = base64.b64encode(key.read_bytes()).decode()
(destination / "nahhasio.flatpakrepo").write_text(
    f"[Flatpak Repo]\nTitle=Nahhasio {branch.upper()}\nUrl={url}\nGPGKey={encoded}\n"
)
(destination / "nahhasio.flatpakref").write_text(
    f"[Flatpak Ref]\nName=io.nahhasio.Linux\nBranch={branch}\nTitle=Nahhasio\n"
    f"Url={url}\nIsRuntime=false\nSuggestRemoteName=nahhasio-{branch}\nGPGKey={encoded}\n"
    "RuntimeRepo=https://dl.flathub.org/repo/flathub.flatpakrepo\n"
)
